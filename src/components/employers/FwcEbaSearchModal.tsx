"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { FWCSearchResult } from "@/types/fwcLookup"
import { Progress } from "@/components/ui/progress"
import { deriveStepIndexForJob, FWC_JOB_STEPS } from "@/utils/scraperJobSteps"
import { useScraperJobRealtime } from "@/hooks/useScraperJobRealtime"

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
  const [jobId, setJobId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [results, setResults] = useState<FWCSearchResult[]>([])
  const [isLinking, setIsLinking] = useState(false)
  const { toast } = useToast()

  const lastStatusRef = useRef<ScraperJobStatus | null>(null)

  // Real-time job updates
  const {
    job,
    events: jobEvents,
    isRealtimeActive,
    isPolling,
    error: jobError,
  } = useScraperJobRealtime({
    jobId,
    enabled: !!jobId && isOpen,
    pollingInterval: 2000,
    onJobComplete: useCallback(
      (jobData: ScraperJob) => {
        if (lastStatusRef.current === jobData.status) return
        lastStatusRef.current = jobData.status

        if (jobData.status === "succeeded") {
          setErrorMessage(null)
        } else if (jobData.status === "failed") {
          toast({
            title: "FWC lookup failed",
            description: "Check the job timeline for details and try again.",
            variant: "destructive",
          })
        }
      },
      [toast]
    ),
  })

  const resetState = useCallback(() => {
    setJobId(null)
    setResults([])
    setErrorMessage(null)
    setIsLinking(false)
    lastStatusRef.current = null
    setSearchTerm(employerName)
  }, [employerName])

  useEffect(() => {
    if (!isOpen) {
      resetState()
    }
  }, [isOpen, resetState])

  // Update error message if job error occurs
  useEffect(() => {
    if (jobError) {
      setErrorMessage(jobError.message)
    }
  }, [jobError])

  const handleQueueLookup = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)
    setResults([])
    try {
      const body = {
        jobType: "fwc_lookup",
        payload: {
          employerIds: [employerId],
          options: {
            autoLink: false,
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
    setJobId(data.job.id)
    toast({
      title: "FWC lookup queued",
      description: "The background worker will fetch the latest EBA data shortly.",
    })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to queue FWC lookup"
      setErrorMessage(message)
      toast({ title: "Failed to queue lookup", description: message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const progressPercent = job && job.progress_total ? Math.round((job.progress_completed ?? 0) / job.progress_total * 100) : 0

  // Event-based step derivation for better UX
  const currentStepIndex = deriveStepIndexForJob(job, jobEvents)

  useEffect(() => {
    if (!jobEvents.length) return
    const latestCandidates = [...jobEvents]
      .reverse()
      .find((event) => event.event_type === "fwc_employer_candidates" || event.event_type === "fwc_employer_results")

    if (latestCandidates && latestCandidates.payload) {
      const payloadResults = latestCandidates.payload.results as FWCSearchResult[] | undefined
      if (Array.isArray(payloadResults)) {
        setResults(payloadResults)
      }
    }

    const failureEvent = [...jobEvents]
      .reverse()
      .find((event) => event.event_type === "fwc_employer_failed")
    if (failureEvent?.payload?.error) {
      setErrorMessage(String(failureEvent.payload.error))
    }
  }, [jobEvents])

  const handleLinkEba = async (eba: FWCSearchResult) => {
    setIsLinking(true)
    try {
      const sanitized = {
        title: eba.title,
        status: eba.status,
        approvedDate: normalizeDateForRpc(eba.approvedDate),
        expiryDate: normalizeDateForRpc(eba.expiryDate),
        documentUrl: eba.documentUrl,
        summaryUrl: eba.summaryUrl,
        lodgementNumber: eba.lodgementNumber,
      }

      const nullified = Object.fromEntries(
        Object.entries(sanitized).map(([key, value]) => [key, value ?? null])
      )

      const { error } = await supabase.rpc('link_eba_to_employer', {
        p_employer_id: employerId,
        p_eba_data: nullified,
      })
      if (error) throw error

      toast({
        title: 'EBA linked',
        description: `${eba.title} has been linked to ${employerName}.`,
      })
      onLinkEba()
      onClose()
    } catch (error) {
      toast({
        title: 'Linking failed',
        description: error instanceof Error ? error.message : 'Could not link EBA.',
        variant: 'destructive',
      })
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl space-y-4 break-words">
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
              {(["queued", "running"] as ScraperJobStatus[]).includes(job.status) && (
                <div className="mt-2 flex items-center gap-2">
                  <img src="/spinner.gif" alt="Loading" className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">Searching FWC database...</span>
                </div>
              )}
              <div className="mt-2">
                <Progress value={progressPercent} />
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  {FWC_JOB_STEPS.map((label, idx) => {
                    const isCompleted = idx < currentStepIndex
                    const isCurrent = idx === currentStepIndex
                    return (
                      <div key={label} className="flex items-center flex-1 min-w-0">
                        <div
                          className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                            isCompleted ? 'bg-green-600 text-white' : isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="ml-2 text-xs truncate">{label}</div>
                        {idx < FWC_JOB_STEPS.length - 1 && (
                          <div className={`mx-2 h-0.5 flex-1 ${idx < currentStepIndex ? 'bg-green-600' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            {/* Hide debug timeline in user-facing UI */}
            {false && jobEvents.length > 0 && (
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

            {job.status === 'succeeded' && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Possible matches</h4>
                {results.length > 0 ? (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {results.map((result, index) => (
                      <li key={`${result.title}-${index}`} className="border rounded p-3 space-y-2">
                        <div>
                          <p className="font-semibold">{result.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Status: {result.status} • Approved: {result.approvedDate || 'N/A'} • Expires: {result.expiryDate || 'N/A'}
                          </p>
                          {result.documentUrl && (
                            <p className="text-xs text-muted-foreground break-words">
                              Document: <a href={result.documentUrl} target="_blank" rel="noreferrer" className="underline">{result.documentUrl}</a>
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleLinkEba(result)} disabled={isLinking}>
                            {isLinking ? 'Linking…' : 'Link to employer'}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No EBA matches were returned for this search.</p>
                )}
              </div>
            )}
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
const normalizeDateForRpc = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  const pattern = trimmed.match(/^(\d{1,2})[\/\-\s](\w+|\d{1,2})[\/\-\s](\d{2,4})$/)
  if (pattern) {
    const day = pattern[1].padStart(2, '0')
    let month = pattern[2]
    const yearRaw = pattern[3]

    const monthIndex = new Date(`${month} 1, ${yearRaw}`).getMonth()
    if (!Number.isNaN(monthIndex)) {
      month = String(monthIndex + 1).padStart(2, '0')
    } else {
      month = month.padStart(2, '0')
    }

    let year = yearRaw
    if (year.length === 2) {
      year = (Number(year) > 50 ? '19' : '20') + year
    }

    return `${year}-${month}-${day}`
  }

  return null
}
