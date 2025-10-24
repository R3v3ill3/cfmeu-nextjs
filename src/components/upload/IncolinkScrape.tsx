"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Search, Play, CheckCircle, XCircle } from "lucide-react"

type EmployerRow = {
  id: string
  name: string
  suburb: string | null
  state: string | null
  incolink_id: string | null
  last_incolink_payment?: string | null
}

type RunStatus = {
  status: "idle" | "queued" | "running" | "success" | "error"
  invoiceNumber?: string
  invoiceDate?: string | null
  counts?: { createdWorkers: number; matchedWorkers: number; placementsCreated: number; placementsSkipped: number; totalParsed: number }
  error?: string
}

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

export default function IncolinkScrape() {
  const { toast } = useToast()
  const [employers, setEmployers] = useState<EmployerRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [runMap, setRunMap] = useState<Record<string, RunStatus>>({})

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await (supabase as any)
          .from("employers")
          .select("id, name, suburb, state, incolink_id, last_incolink_payment")
          .not("incolink_id", "is", null)
          .order("name")
        if (error) throw error
        setEmployers((data || []) as EmployerRow[])
      } catch (e) {
        console.error("Failed to load employers with Incolink IDs", e)
        toast({ title: "Load failed", description: "Could not load employers with Incolink IDs.", variant: "destructive" })
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [toast])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return employers
    return employers.filter((e) => {
      const hay = [e.name, e.suburb || "", e.state || "", e.incolink_id || ""].join(" ").toLowerCase()
      return hay.includes(q)
    })
  }, [employers, filter])

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id))
  const someFilteredSelected = filtered.some((e) => selected.has(e.id)) && !allFilteredSelected

  const toggleSelectAll = (_checked: boolean | string) => {
    const next = new Set(selected)
    if (allFilteredSelected) {
      filtered.forEach((e) => next.delete(e.id))
    } else {
      filtered.forEach((e) => next.add(e.id))
    }
    setSelected(next)
  }

  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const runForSelected = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setIsRunning(true)
    try {
      setRunMap((prev) => {
        const next = { ...prev }
        ids.forEach((id) => (next[id] = { status: "queued" }))
        return next
      })

      for (const employerId of ids) {
        setRunMap((prev) => ({ ...prev, [employerId]: { status: "running" } }))
        try {
          const job = await queueIncolinkJob(employerId)
          const result = await pollJob(job.id)
          const summary = extractSummary(result.events)
          setRunMap((prev) => ({
            ...prev,
            [employerId]: {
              status: result.job.status === "succeeded" ? "success" : "error",
              invoiceNumber: summary?.invoiceNumber,
              invoiceDate: summary?.invoiceDate ?? null,
              counts: summary?.counts,
              error: result.job.status === "succeeded" ? undefined : summary?.error,
            },
          }))
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Import failed"
          setRunMap((prev) => ({ ...prev, [employerId]: { status: "error", error: msg } }))
        }
      }

      toast({ title: "Incolink import finished", description: `Processed ${ids.length} employer(s).` })
    } finally {
      setIsRunning(false)
    }
  }

  const queueIncolinkJob = async (employerId: string): Promise<ScraperJob> => {
    const body = {
      jobType: "incolink_sync",
      payload: {
        employerIds: [employerId],
        invoiceNumber: invoiceNumber.trim() || undefined,
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
    await sleep(1000)
    return data.job
  }

  const pollJob = async (
    jobId: string
  ): Promise<{ job: ScraperJob; events: ScraperJobEvent[] }> => {
    const MAX_ATTEMPTS = 10
    const RETRY_DELAY = 2000

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const response = await fetch(`/api/scraper-jobs?id=${jobId}&includeEvents=1`, {
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const data = (await response.json()) as { job: ScraperJob; events?: ScraperJobEvent[] }
      const events = data.events ?? []
      const { status } = data.job

      if (["succeeded", "failed", "cancelled"].includes(status)) {
        const hasSuccessEvent = events.some((event) => event.event_type === "incolink_employer_succeeded")

        if (status !== "succeeded" || hasSuccessEvent || attempt === MAX_ATTEMPTS - 1) {
          return { job: data.job, events }
        }
      }

      await sleep(attempt === 0 ? 3000 : RETRY_DELAY)
    }

    throw new Error("Incolink job finished but success event never arrived")
  }

  const extractSummary = (
    events: ScraperJobEvent[]
  ): { counts?: RunStatus["counts"]; invoiceNumber?: string; invoiceDate?: string | null; error?: string } | undefined => {
    const successEvent = events.find((event) => event.event_type === "incolink_employer_succeeded")
    if (successEvent) {
      const payload = successEvent.payload ?? {}
      const counts = (payload.counts ?? undefined) as RunStatus["counts"] | undefined
      return {
        counts,
        invoiceNumber: (payload.invoiceNumber as string) ?? undefined,
        invoiceDate: (payload.invoiceDate as string | null) ?? null,
      }
    }
    const failureEvent = events.find((event) => event.event_type === "incolink_employer_failed")
    if (failureEvent) {
      return { error: (failureEvent.payload?.error as string) ?? "Import failed" }
    }
    return undefined
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Web Scraping</CardTitle>
          <CardDescription>
            Select one or more employers with an Incolink ID and run the scraper. Workers will be created/matched and placements added.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Input id="search" placeholder="Search by name, suburb, state, or Incolink ID" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <Search className="h-4 w-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2" />
              </div>
            </div>
            <div>
              <Label htmlFor="invoice">Invoice number (optional)</Label>
              <Input id="invoice" placeholder="e.g. 123456" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={toggleSelectAll}
                aria-checked={allFilteredSelected ? "true" : someFilteredSelected ? "mixed" : "false"}
              />
              <span className="text-sm">Select all in view ({filtered.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0 || isRunning}>Clear selection</Button>
              <Button onClick={runForSelected} disabled={selected.size === 0 || isRunning} aria-busy={isRunning}>
                {isRunning ? (
                  <span className="inline-flex items-center"><img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" /> Running…</span>
                ) : (
                  <span className="inline-flex items-center"><Play className="h-4 w-4 mr-2" /> Import selected ({selected.size})</span>
                )}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Employers with Incolink IDs</CardTitle>
              <CardDescription>
                Showing {isLoading ? "…" : filtered.length} of {employers.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Incolink ID</TableHead>
                      <TableHead className="w-[160px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          <span className="inline-flex items-center"><img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" /> Loading…</span>
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No employers match your search.</TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((e) => {
                        const st = runMap[e.id]
                        return (
                          <TableRow key={e.id} className="align-middle">
                            <TableCell>
                              <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleOne(e.id)} />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{e.name}</span>
                                {e.last_incolink_payment && (
                                  <Badge variant="outline" title="Last Incolink payment date">{e.last_incolink_payment}</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">{[e.suburb, e.state].filter(Boolean).join(", ")}</span>
                            </TableCell>
                            <TableCell><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{e.incolink_id}</code></TableCell>
                            <TableCell>
                              {!st || st.status === "idle" ? (
                                <Badge variant="outline">Idle</Badge>
                              ) : st.status === "queued" ? (
                                <span className="inline-flex items-center text-sm text-muted-foreground"><img src="/spinner.gif" alt="" className="h-4 w-4 mr-2" />Queued</span>
                              ) : st.status === "running" ? (
                                <span className="inline-flex items-center text-sm text-muted-foreground"><img src="/spinner.gif" alt="" className="h-4 w-4 mr-2" />Running…</span>
                              ) : st.status === "success" ? (
                                <span className="inline-flex items-center text-sm text-green-700"><CheckCircle className="h-4 w-4 mr-1" /> Imported {st.counts?.createdWorkers ?? 0}+{st.counts?.matchedWorkers ?? 0}</span>
                              ) : (
                                <span className="inline-flex items-center text-sm text-red-700" title={st.error}><XCircle className="h-4 w-4 mr-1" /> Failed</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
