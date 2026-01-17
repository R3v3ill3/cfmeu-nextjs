"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { WizardButton } from '../shared/WizardButton'
import { cn } from '@/lib/utils'
import { FWCSearchResult } from '@/types/fwcLookup'
import { Progress } from '@/components/ui/progress'
import { 
  FileCheck, 
  Building, 
  ExternalLink,
  Loader2,
  CheckCircle,
  XCircle,
  Search,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { useScraperJobRealtime } from '@/hooks/useScraperJobRealtime'

interface EbaViewProps {
  projectId: string
  projectName: string
}

interface BuilderEbaStatus {
  builderId: string | null
  builderName: string | null
  hasEba: boolean | null
  fwcDocumentUrl: string | null
  nominalExpiryDate: string | null
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

export function EbaView({ projectId, projectName }: EbaViewProps) {
  const { toast } = useToast()
  const [jobId, setJobId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [results, setResults] = useState<FWCSearchResult[]>([])
  
  const lastStatusRef = useRef<ScraperJobStatus | null>(null)

  // Fetch builder EBA status - must be defined before useScraperJobRealtime since refetch is used in callback
  const { data: ebaData, isLoading, refetch } = useQuery({
    queryKey: ['wizard-eba-status', projectId],
    queryFn: async () => {
      // Get builder assignment
      const { data: builderAssignment, error } = await supabase
        .from('project_assignments')
        .select(`
          employers (
            id,
            name,
            enterprise_agreement_status
          ),
          contractor_role_types (
            code
          )
        `)
        .eq('project_id', projectId)
        .eq('assignment_type', 'contractor_role')
        .in('contractor_role_types.code', ['builder', 'head_contractor'])
        .limit(1)
        .maybeSingle()
      
      if (error) throw error
      
      const builder = builderAssignment?.employers as any
      
      if (!builder) {
        return {
          builderId: null,
          builderName: null,
          hasEba: null,
          fwcDocumentUrl: null,
          nominalExpiryDate: null,
        } as BuilderEbaStatus
      }
      
      // Get EBA record if exists
      const { data: ebaRecord } = await supabase
        .from('company_eba_records')
        .select('fwc_document_url, nominal_expiry_date')
        .eq('employer_id', builder.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      return {
        builderId: builder.id,
        builderName: builder.name,
        hasEba: builder.enterprise_agreement_status === true,
        fwcDocumentUrl: ebaRecord?.fwc_document_url || null,
        nominalExpiryDate: ebaRecord?.nominal_expiry_date || null,
      } as BuilderEbaStatus
    },
    staleTime: 30000,
  })

  // Real-time job updates - refetch is now defined above
  const {
    job,
    events: jobEvents,
    error: jobError,
  } = useScraperJobRealtime({
    jobId,
    enabled: !!jobId,
    pollingInterval: 2000,
    onJobComplete: useCallback(
      (jobData: ScraperJob) => {
        if (lastStatusRef.current === jobData.status) return
        lastStatusRef.current = jobData.status

        if (jobData.status === "succeeded") {
          setErrorMessage(null)
          toast({
            title: "FWC lookup completed",
            description: "EBA data has been updated. Refreshing...",
          })
          // Refetch EBA data after a short delay to allow database to update
          setTimeout(() => {
            refetch()
          }, 1000)
        } else if (jobData.status === "failed") {
          toast({
            title: "FWC lookup failed",
            description: "The search encountered an error. Please try again.",
            variant: "destructive",
          })
        }
      },
      [refetch, toast]
    ),
  })

  // Update error message if job error occurs
  useEffect(() => {
    if (jobError) {
      setErrorMessage(jobError.message)
    }
  }, [jobError])

  const handleQueueLookup = async () => {
    if (!ebaData?.builderId || !ebaData?.builderName) {
      toast({
        title: "Cannot search",
        description: "Builder information is required to search FWC.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setResults([])
    setJobId(null)
    
    try {
      const body = {
        jobType: "fwc_lookup",
        payload: {
          employerIds: [ebaData.builderId],
          options: {
            autoLink: true, // Auto-link the best match
            searchOverrides: {
              [ebaData.builderId]: ebaData.builderName.trim(),
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
      toast({ 
        title: "Failed to queue lookup", 
        description: message, 
        variant: "destructive" 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Extract results from job events
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

  const handleViewDocument = () => {
    if (ebaData?.fwcDocumentUrl) {
      window.open(ebaData.fwcDocumentUrl, '_blank')
    }
  }

  const handleSearchFwc = () => {
    handleQueueLookup()
  }

  const progressPercent = job && job.progress_total ? Math.round((job.progress_completed ?? 0) / job.progress_total * 100) : 0
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  
  return (
    <div className="p-4 space-y-4 pb-safe-bottom">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !ebaData?.builderName ? (
        // No builder assigned
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Building className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No builder assigned</p>
          <p className="text-sm text-gray-400 mt-1">
            Assign a builder to check EBA status
          </p>
        </div>
      ) : (
        <>
          {/* Builder card */}
          <div className={cn(
            'rounded-2xl border-2 p-5',
            ebaData.hasEba 
              ? 'bg-green-50 border-green-200' 
              : ebaData.hasEba === false
              ? 'bg-red-50 border-red-200'
              : 'bg-gray-50 border-gray-200'
          )}>
            <div className="flex items-start gap-4">
              <div className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
                ebaData.hasEba 
                  ? 'bg-green-100' 
                  : ebaData.hasEba === false
                  ? 'bg-red-100'
                  : 'bg-gray-100'
              )}>
                {ebaData.hasEba === true ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : ebaData.hasEba === false ? (
                  <XCircle className="h-8 w-8 text-red-600" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-gray-500" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 truncate">
                  {ebaData.builderName}
                </h3>
                <p className="text-sm text-gray-600 mt-1">Builder / Head Contractor</p>
                
                <div className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold mt-3',
                  ebaData.hasEba 
                    ? 'bg-green-100 text-green-700' 
                    : ebaData.hasEba === false
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
                )}>
                  {ebaData.hasEba === true ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      EBA Active
                    </>
                  ) : ebaData.hasEba === false ? (
                    <>
                      <XCircle className="h-4 w-4" />
                      Non-EBA Builder
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      EBA Status Unknown
                    </>
                  )}
                </div>
                
                {ebaData.nominalExpiryDate && (
                  <p className="text-sm text-gray-500 mt-2">
                    Expires: {formatDate(ebaData.nominalExpiryDate)}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Actions based on EBA status */}
          <div className="space-y-3 pt-2">
            {/* Has EBA and document link */}
            {ebaData.hasEba && ebaData.fwcDocumentUrl && (
              <WizardButton
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleViewDocument}
                icon={<FileText className="h-5 w-5" />}
              >
                View EBA Document
              </WizardButton>
            )}
            
            {/* Has EBA but no document, or unknown status */}
            {(ebaData.hasEba === true && !ebaData.fwcDocumentUrl) || 
             ebaData.hasEba === null ? (
              <>
                {!job ? (
                  <WizardButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSearchFwc}
                    loading={isSubmitting}
                    icon={<Search className="h-5 w-5" />}
                  >
                    Search FWC for EBA
                  </WizardButton>
                ) : (
                  <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">Search Status</span>
                      <span className="capitalize text-gray-600">{job.status}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Progress: {job.progress_completed ?? 0}/{job.progress_total ?? 1} ({progressPercent}%)
                    </div>
                    {(["queued", "running"] as ScraperJobStatus[]).includes(job.status) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Searching FWC database...</span>
                      </div>
                    )}
                    <Progress value={progressPercent} className="h-2" />
                    {errorMessage && (
                      <p className="text-sm text-red-600">{errorMessage}</p>
                    )}
                    {job.status === 'succeeded' && results.length > 0 && (
                      <div className="mt-2 text-sm text-green-600">
                        Found {results.length} EBA agreement(s). Data has been updated.
                      </div>
                    )}
                    {job.status === 'succeeded' && results.length === 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        No EBA agreements found for this builder.
                      </div>
                    )}
                    {job.status === 'failed' && (
                      <div className="mt-2 text-sm text-red-600">
                        The search failed. Please try again.
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
            
            {/* Non-EBA builder - show different message */}
            {ebaData.hasEba === false && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-red-700 font-medium">
                  This builder does not have a CFMEU EBA
                </p>
                <p className="text-sm text-red-600 mt-1">
                  Consider escalating or checking alternative agreements
                </p>
              </div>
            )}
            
            {/* Always show option to search FWC manually */}
            {ebaData.hasEba === false && (
              <>
                {!job ? (
                  <WizardButton
                    variant="outline"
                    size="md"
                    fullWidth
                    onClick={handleSearchFwc}
                    loading={isSubmitting}
                    icon={<Search className="h-4 w-4" />}
                  >
                    Search FWC Anyway
                  </WizardButton>
                ) : (
                  <div className="space-y-2 bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700">Search Status</span>
                      <span className="capitalize text-gray-600">{job.status}</span>
                    </div>
                    {(["queued", "running"] as ScraperJobStatus[]).includes(job.status) && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Searching...</span>
                      </div>
                    )}
                    <Progress value={progressPercent} className="h-1.5" />
                    {job.status === 'succeeded' && (
                      <div className="text-xs text-gray-600">
                        {results.length > 0 
                          ? `Found ${results.length} agreement(s)` 
                          : 'No agreements found'}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            
            {/* Link to full employer view */}
            {ebaData.builderId && (
              <WizardButton
                variant="ghost"
                size="md"
                fullWidth
                onClick={() => window.open(`/employers/${ebaData.builderId}`, '_blank')}
                icon={<ExternalLink className="h-4 w-4" />}
              >
                View Full Employer Profile
              </WizardButton>
            )}
          </div>
        </>
      )}
    </div>
  )
}

