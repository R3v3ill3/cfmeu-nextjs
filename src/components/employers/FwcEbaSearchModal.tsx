"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

type ScraperJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"

type ScraperJob = {
  id: string
  status: ScraperJobStatus
  progress_total: number | null
  progress_completed: number | null
  created_at: string
  updated_at: string
}

type ScraperJobEvent = {
  id: number
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

interface FwcEbaSearchModalProps {
  isOpen: boolean
  onClose: () => void
  employerId: string
  employerName: string
  abn?: string
  onLinkEba: () => void
}

export function FwcEbaSearchModal({ isOpen, onClose, employerId, employerName, onLinkEba }: FwcEbaSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState(employerName)
  const [job, setJob] = useState<ScraperJob | null>(null)
  const [jobEvents, setJobEvents] = useState<ScraperJobEvent[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { toast } = useToast()

  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const lastStatusRef = useRef<ScraperJobStatus | null>(null)

  const clearPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const resetState = useCallback(() => {
    clearPolling()
    setJob(null)
    setJobEvents([])
    setErrorMessage(null)
    lastStatusRef.current = null
    setSearchTerm(employerName)
  }, [clearPolling, employerName])

  useEffect(() => {
    if (!isOpen) {
      resetState()
    }
  }, [isOpen, resetState])

  const fetchJobStatus = useCallback(
    async (jobId: string) => {
      const response = await fetch(`/api/scraper-jobs?id=${jobId}&includeEvents=1`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = (await response.json()) as { job: ScraperJob; events?: ScraperJobEvent[] }
      setJob(data.job)
      setJobEvents(data.events ?? [])
      return data.job
    },
    []
  )

  const handleJobUpdate = useCallback(
    (jobData: ScraperJob) => {
      if (!jobData) return
      const terminal: ScraperJobStatus[] = ["succeeded", "failed", "cancelled"]
      if (!terminal.includes(jobData.status)) return

      if (lastStatusRef.current === jobData.status) return
      lastStatusRef.current = jobData.status

      clearPolling()

      if (jobData.status === "succeeded") {
        toast({
          title: "FWC lookup complete",
          description: "EBA data refreshed from the FWC search.",
        })
        onLinkEba()
      } else if (jobData.status === "failed") {
        toast({
          title: "FWC lookup failed",
          description: "Check the job timeline for details and try again.",
          variant: "destructive",
        })
      }
    },
    [clearPolling, onLinkEba, toast]
  )

  const startPolling = useCallback(
    (jobId: string) => {
      clearPolling()

      const poll = async () => {
        try {
          const latest = await fetchJobStatus(jobId)
          handleJobUpdate(latest)
        } catch (error) {
          console.error("Failed to poll FWC job", error)
          setErrorMessage(error instanceof Error ? error.message : "Failed to poll job status")
          clearPolling()
        }
      }

      poll()
      pollRef.current = setInterval(poll, 3000)
    },
    [clearPolling, fetchJobStatus, handleJobUpdate]
  )

  const handleQueueLookup = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const body = {
        jobType: "fwc_lookup",
        payload: {
          employerIds: [employerId],
          options: {
            searchOverrides: {
              [employerId]: searchTerm.trim(),
            },
          },
        },
        priority: 5,
        progressTotal: 1,
      }

      const response = await fetch("/api/scraper-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = (await response.json()) as { job: ScraperJob }
      setJob(data.job)
      setJobEvents([])
      toast({
        title: "FWC lookup queued",
        description: "The background worker will fetch the latest EBA data shortly.",
      })
      startPolling(data.job.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to queue FWC lookup"
      setErrorMessage(message)
      toast({ title: "Failed to queue lookup", description: message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const progressPercent = job && job.progress_total ? Math.round((job.progress_completed ?? 0) / job.progress_total * 100) : 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl space-y-4">
        <DialogHeader>
          <DialogTitle>Search FWC for EBA</DialogTitle>
          <DialogDescription>
            Queue a background lookup to search the Fair Work Commission database and link the best matching EBA to {employerName}.
          </DialogDescription>
        </DialogHeader>

        {!job && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Adjust the search term if needed, then enqueue a lookup. Results will appear after the worker completes.
            </p>
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="e.g. CFMEU Construction Hydraulics"
            />
            <div className="flex gap-2 justify-end">
              <Button onClick={handleQueueLookup} disabled={isSubmitting}>
                {isSubmitting ? "Queueing..." : "Queue FWC Lookup"}
              </Button>
            </div>
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          </div>
        )}

        {job && (
          <div className="space-y-3">
            <div className="rounded border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Job Status</span>
                <span className="capitalize">{job.status}</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Progress: {job.progress_completed ?? 0}/{job.progress_total ?? 1} ({progressPercent}%)
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Last updated: {new Date(job.updated_at).toLocaleString()}
              </div>
            </div>

            {jobEvents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Job Timeline</h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {jobEvents.map((event) => (
                    <div key={event.id} className="rounded border p-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{event.event_type}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                      {event.payload && Object.keys(event.payload).length > 0 && (
                        <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
