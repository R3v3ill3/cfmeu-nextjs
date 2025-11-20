"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { useAliasTelemetry, type AliasInsertEvent } from "@/hooks/useAliasTelemetry"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"

type CanonicalPromotionQueueItem = {
  alias_id: string
  employer_id: string
  proposed_name: string
  alias_normalized: string | null
  source_system: string | null
  source_identifier: string | null
  collected_at: string | null
  collected_by: string | null
  is_authoritative: boolean | null
  alias_notes: string | null
  current_canonical_name: string | null
  bci_company_id: string | null
  incolink_id: string | null
  priority: number | null
  conflict_warnings: Array<{
    employer_id: string
    employer_name: string
    similarity?: number
  }> | null
  previous_decision: string | null
  total_aliases: number | null
  alias_created_at: string
}

type DecisionDialogState = {
  open: boolean
  action: 'promote' | 'reject' | 'defer' | null
  item: CanonicalPromotionQueueItem | null
  rationale: string
  isSubmitting: boolean
}

export default function CanonicalPromotionConsole() {
  const { user } = useAuth()
  const telemetry = useAliasTelemetry({ scope: 'canonical_promotion_console', actorId: user?.id })
  
  const [queueItems, setQueueItems] = useState<CanonicalPromotionQueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [decisionDialog, setDecisionDialog] = useState<DecisionDialogState>({
    open: false,
    action: null,
    item: null,
    rationale: '',
    isSubmitting: false,
  })

  useEffect(() => {
    loadQueue()
  }, [])

  const loadQueue = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('canonical_promotion_queue')
        .select('*')
        .order('priority', { ascending: false })
        .order('alias_created_at', { ascending: false })

      if (error) {
        console.error('Error loading canonical promotion queue:', error)
        toast.error('Failed to load promotion queue')
        return
      }

      setQueueItems(data || [])
    } catch (err) {
      console.error('Error loading queue:', err)
      toast.error('An error occurred while loading the queue')
    } finally {
      setIsLoading(false)
    }
  }

  const openDecisionDialog = (
    action: 'promote' | 'reject' | 'defer',
    item: CanonicalPromotionQueueItem
  ) => {
    setDecisionDialog({
      open: true,
      action,
      item,
      rationale: '',
      isSubmitting: false,
    })
  }

  const closeDecisionDialog = () => {
    setDecisionDialog({
      open: false,
      action: null,
      item: null,
      rationale: '',
      isSubmitting: false,
    })
  }

  const handleDecision = async () => {
    if (!decisionDialog.item || !decisionDialog.action) return

    setDecisionDialog(prev => ({ ...prev, isSubmitting: true }))

    try {
      const { alias_id, proposed_name, employer_id } = decisionDialog.item
      
      let result
      
      switch (decisionDialog.action) {
        case 'promote':
          result = await supabase.rpc('promote_alias_to_canonical', {
            p_alias_id: alias_id,
            p_decision_rationale: decisionDialog.rationale || null,
          })
          
          if (result.error) {
            console.error('[CanonicalPromotion] Promote error:', result.error)
            throw new Error(result.error.message || 'Failed to promote alias to canonical')
          }
          
          // Validate response structure
          if (!result.data) {
            console.error('[CanonicalPromotion] No data returned from promote RPC')
            throw new Error('Invalid response from server')
          }
          
          // Log telemetry
          try {
            telemetry.logInsert({
              employerId: employer_id,
              alias: proposed_name,
              normalized: decisionDialog.item.alias_normalized || '',
              sourceSystem: decisionDialog.item.source_system || undefined,
              sourceIdentifier: decisionDialog.item.source_identifier,
              notes: `Promoted to canonical via console: ${decisionDialog.rationale}`,
            })
          } catch (telemetryError) {
            console.warn('[CanonicalPromotion] Telemetry logging failed:', telemetryError)
            // Don't fail the operation if telemetry fails
          }
          
          toast.success(`Promoted "${proposed_name}" to canonical name`)
          break

        case 'reject':
          if (!decisionDialog.rationale.trim()) {
            toast.error('Please provide a reason for rejection')
            setDecisionDialog(prev => ({ ...prev, isSubmitting: false }))
            return
          }
          
          result = await supabase.rpc('reject_canonical_promotion', {
            p_alias_id: alias_id,
            p_decision_rationale: decisionDialog.rationale,
          })
          
          if (result.error) {
            console.error('[CanonicalPromotion] Reject error:', result.error)
            throw new Error(result.error.message || 'Failed to reject promotion')
          }
          
          // Validate response structure
          if (!result.data) {
            console.error('[CanonicalPromotion] No data returned from reject RPC')
            throw new Error('Invalid response from server')
          }
          
          toast.success('Promotion rejected')
          break

        case 'defer':
          if (!decisionDialog.rationale.trim()) {
            toast.error('Please provide a reason for deferral')
            setDecisionDialog(prev => ({ ...prev, isSubmitting: false }))
            return
          }
          
          result = await supabase.rpc('defer_canonical_promotion', {
            p_alias_id: alias_id,
            p_decision_rationale: decisionDialog.rationale,
          })
          
          if (result.error) {
            console.error('[CanonicalPromotion] Defer error:', result.error)
            throw new Error(result.error.message || 'Failed to defer promotion')
          }
          
          // Validate response structure
          if (!result.data) {
            console.error('[CanonicalPromotion] No data returned from defer RPC')
            throw new Error('Invalid response from server')
          }
          
          toast.success('Decision deferred for later review')
          break
      }

      // Only close dialog and reload queue on success
      closeDecisionDialog()
      await loadQueue() // Reload the queue
    } catch (error: any) {
      console.error('[CanonicalPromotion] Error submitting decision:', error)
      const errorMessage = error?.message || error?.toString() || 'Failed to submit decision'
      toast.error(errorMessage)
      // Reset submitting state but keep dialog open so user can retry or cancel
      setDecisionDialog(prev => ({ ...prev, isSubmitting: false }))
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getPriorityBadge = (priority: number | null) => {
    if (!priority) return null
    if (priority >= 10) return <Badge variant="destructive">High Priority</Badge>
    if (priority >= 5) return <Badge>Medium Priority</Badge>
    return <Badge variant="outline">Low Priority</Badge>
  }

  const getSourceBadge = (sourceSystem: string | null, isAuthoritative: boolean | null) => {
    if (isAuthoritative) {
      return <Badge className="bg-green-600">Authoritative</Badge>
    }
    
    const sourceColors: Record<string, string> = {
      bci: 'bg-blue-600',
      incolink: 'bg-purple-600',
      fwc: 'bg-orange-600',
      eba: 'bg-pink-600',
    }
    
    const color = sourceSystem ? sourceColors[sourceSystem.toLowerCase()] : 'bg-gray-600'
    return <Badge className={color}>{sourceSystem || 'Unknown'}</Badge>
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Canonical Name Promotion Console</h2>
          <p className="text-muted-foreground">Loading review queue...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Canonical Name Promotion Console</h2>
        <p className="text-muted-foreground">
          Review and approve authoritative employer name changes from verified sources.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>About Canonical Promotions</AlertTitle>
        <AlertDescription>
          This console shows aliases from authoritative sources (BCI, Incolink, EBA, FWC) that could
          become the canonical (official) name for an employer. Promoting an alias updates the employer's
          primary name across the system.
        </AlertDescription>
      </Alert>

      {queueItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground text-center">
              There are no pending canonical name promotions to review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queueItems.map(item => (
            <Card key={item.alias_id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <span>{item.proposed_name}</span>
                      {getSourceBadge(item.source_system, item.is_authoritative)}
                      {getPriorityBadge(item.priority)}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Current canonical: <strong>{item.current_canonical_name}</strong>
                      {item.employer_id && (
                        <Button
                          variant="link"
                          className="ml-2 h-auto p-0 text-blue-600 hover:underline"
                          onClick={() => setSelectedEmployerId(item.employer_id)}
                        >
                          View employer <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Source System:</span>{' '}
                    <strong>{item.source_system || 'Unknown'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Collected:</span>{' '}
                    <strong>{formatDate(item.collected_at)}</strong>
                  </div>
                  {item.source_identifier && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">External ID:</span>{' '}
                      <strong>{item.source_identifier}</strong>
                    </div>
                  )}
                  {item.total_aliases && (
                    <div>
                      <span className="text-muted-foreground">Total aliases:</span>{' '}
                      <strong>{item.total_aliases}</strong>
                    </div>
                  )}
                </div>

                {item.alias_notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="mt-1 text-sm bg-muted p-2 rounded">{item.alias_notes}</p>
                  </div>
                )}

                {item.conflict_warnings && item.conflict_warnings.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Potential Conflicts Detected</AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">
                        Similar names found in other employer records. Review before promoting:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {item.conflict_warnings.map((conflict, idx) => (
                          <li key={idx}>
                            <strong>{conflict.employer_name}</strong>
                            {conflict.similarity && (
                              <span className="text-muted-foreground">
                                {' '}(similarity: {Math.round(conflict.similarity * 100)}%)
                              </span>
                            )}
                            <Button
                              variant="link"
                              className="ml-2 h-auto p-0 text-blue-600 hover:underline inline-flex items-center"
                              onClick={() => setSelectedEmployerId(conflict.employer_id)}
                            >
                              View <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {item.previous_decision === 'defer' && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertTitle>Previously Deferred</AlertTitle>
                    <AlertDescription>
                      This promotion was previously deferred for later review.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>

              <CardFooter className="flex justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => openDecisionDialog('defer', item)}
                >
                  Defer
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => openDecisionDialog('reject', item)}
                >
                  Reject
                </Button>
                <Button
                  variant="default"
                  onClick={() => openDecisionDialog('promote', item)}
                >
                  Promote to Canonical
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Decision Dialog */}
      <Dialog open={decisionDialog.open} onOpenChange={(open) => !open && closeDecisionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionDialog.action === 'promote' && 'Promote to Canonical Name'}
              {decisionDialog.action === 'reject' && 'Reject Promotion'}
              {decisionDialog.action === 'defer' && 'Defer Decision'}
            </DialogTitle>
            <DialogDescription>
              {decisionDialog.item && (
                <>
                  {decisionDialog.action === 'promote' && (
                    <>
                      You are about to change the canonical name from{' '}
                      <strong>"{decisionDialog.item.current_canonical_name}"</strong> to{' '}
                      <strong>"{decisionDialog.item.proposed_name}"</strong>.
                    </>
                  )}
                  {decisionDialog.action === 'reject' && (
                    <>
                      You are rejecting the promotion of{' '}
                      <strong>"{decisionDialog.item.proposed_name}"</strong> as the canonical name.
                    </>
                  )}
                  {decisionDialog.action === 'defer' && (
                    <>
                      You are deferring the decision for{' '}
                      <strong>"{decisionDialog.item.proposed_name}"</strong> to review later.
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rationale">
                {decisionDialog.action === 'promote' 
                  ? 'Rationale (optional)' 
                  : 'Rationale (required)'}
              </Label>
              <Textarea
                id="rationale"
                placeholder={
                  decisionDialog.action === 'promote'
                    ? 'Optional: Why is this the correct canonical name?'
                    : 'Required: Why are you making this decision?'
                }
                value={decisionDialog.rationale}
                onChange={(e) =>
                  setDecisionDialog(prev => ({ ...prev, rationale: e.target.value }))
                }
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDecisionDialog}
              disabled={decisionDialog.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDecision}
              disabled={decisionDialog.isSubmitting}
              variant={decisionDialog.action === 'promote' ? 'default' : 'destructive'}
            >
              {decisionDialog.isSubmitting ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employer Detail Modal */}
      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={!!selectedEmployerId}
        onClose={() => setSelectedEmployerId(null)}
        onEmployerUpdated={() => {
          // Reload queue when employer is updated
          loadQueue()
        }}
      />
    </div>
  )
}

