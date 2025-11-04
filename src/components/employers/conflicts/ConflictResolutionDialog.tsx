'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  Clock,
  GitMerge,
  Zap,
  AlertCircle,
  ChevronRight
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ConflictingField {
  field: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  auto_resolvable: boolean
  value_1: string
  value_2: string
}

interface ConflictDetails {
  id: string
  employer_id: string
  conflicting_change_id_1: string
  conflicting_change_id_2: string
  conflict_detected_at: string
  conflicting_fields: ConflictingField[]
  conflict_severity: 'low' | 'medium' | 'high' | 'critical'
  resolution_status: 'pending' | 'resolved' | 'deferred' | 'escalated'
  resolved_by: string | null
  resolved_at: string | null
  resolution_method: string | null
  resolution_notes: string | null
  resolved_values: Record<string, any> | null
  created_at: string
  updated_at: string
  conflicting_change_1?: {
    id: string
    changed_by: string
    changed_at: string
    change_type: string
    changed_fields: Record<string, boolean>
    new_values: Record<string, any>
  }
  conflicting_change_2?: {
    id: string
    changed_by: string
    changed_at: string
    change_type: string
    changed_fields: Record<string, boolean>
    new_values: Record<string, any>
  }
}

interface ConflictResolutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflictId: string | null
  employerId: string
  onResolved?: () => void
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  conflictId,
  employerId,
  onResolved
}: ConflictResolutionDialogProps) {
  const [conflict, setConflict] = useState<ConflictDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [resolutionStrategy, setResolutionStrategy] = useState<'prefer_latest' | 'prefer_first' | 'merge_safe'>('merge_safe')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [manualResolutions, setManualResolutions] = useState<Record<string, string>>({})

  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Fetch conflict details
  const fetchConflict = useCallback(async () => {
    if (!conflictId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/employers/${employerId}/conflicts`)
      if (!response.ok) {
        throw new Error('Failed to fetch conflict details')
      }

      const data = await response.json()
      const conflictData = data.conflicts.find((c: ConflictDetails) => c.id === conflictId)
      setConflict(conflictData || null)

      // Initialize manual resolutions
      if (conflictData) {
        const initialResolutions: Record<string, string> = {}
        conflictData.conflicting_fields.forEach((field: ConflictingField) => {
          if (!field.auto_resolvable) {
            initialResolutions[field.field] = field.value_1 // Default to first value
          }
        })
        setManualResolutions(initialResolutions)
      }
    } catch (error) {
      console.error('Error fetching conflict:', error)
      toast({
        title: 'Error',
        description: 'Failed to load conflict details',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [conflictId, employerId, toast])

  // Auto-resolve conflict
  const autoResolve = useCallback(async () => {
    if (!conflictId) return

    setIsResolving(true)
    try {
      const response = await fetch(`/api/employers/${employerId}/conflicts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'auto_resolve',
          conflict_id: conflictId,
          resolution_strategy: resolutionStrategy
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resolve conflict')
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Conflict Resolved',
          description: 'The conflict has been automatically resolved.',
        })
        onResolved?.()
        onOpenChange(false)
      } else {
        toast({
          title: 'Partial Resolution',
          description: `${result.unresolved_fields.length} fields require manual resolution.`,
        })
        // Keep dialog open for manual resolution
      }
    } catch (error) {
      console.error('Error resolving conflict:', error)
      toast({
        title: 'Error',
        description: 'Failed to resolve conflict',
        variant: 'destructive'
      })
    } finally {
      setIsResolving(false)
    }
  }, [conflictId, employerId, resolutionStrategy, toast, onResolved, onOpenChange])

  // Manual resolution
  const manualResolve = useCallback(async () => {
    if (!conflictId || !conflict) return

    setIsResolving(true)
    try {
      // Build resolved data
      const resolvedData: Record<string, any> = {}

      // Start with existing data from the latest change
      const baseData = conflict.conflicting_change_2?.new_values || conflict.conflicting_change_1?.new_values || {}

      // Apply manual resolutions
      Object.entries(manualResolutions).forEach(([field, value]) => {
        resolvedData[field] = value
      })

      const response = await fetch(`/api/employers/${employerId}/conflicts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'manual_resolve',
          conflict_id: conflictId,
          resolved_data: resolvedData,
          resolution_notes: resolutionNotes
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resolve conflict')
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Conflict Resolved',
          description: 'The conflict has been manually resolved.',
        })
        onResolved?.()
        onOpenChange(false)
      } else {
        throw new Error('Resolution failed')
      }
    } catch (error) {
      console.error('Error resolving conflict:', error)
      toast({
        title: 'Error',
        description: 'Failed to resolve conflict',
        variant: 'destructive'
      })
    } finally {
      setIsResolving(false)
    }
  }, [conflictId, conflict, employerId, manualResolutions, resolutionNotes, toast, onResolved, onOpenChange])

  // Load conflict when dialog opens
  useEffect(() => {
    if (open && conflictId) {
      fetchConflict()
    }
  }, [open, conflictId, fetchConflict])

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Format user name
  const formatUserName = (userId: string) => {
    return `User ${userId.slice(0, 8)}...`
  }

  const hasUnresolvableFields = conflict?.conflicting_fields.some(field => !field.auto_resolvable)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Conflict Resolution
          </DialogTitle>
          <DialogDescription>
            Resolve conflicting changes to employer data
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : conflict ? (
          <div className="space-y-4">
            {/* Conflict Summary */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Conflict Summary</CardTitle>
                  <Badge className={getSeverityColor(conflict.conflict_severity)}>
                    {conflict.conflict_severity.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Detected</p>
                    <p className="text-gray-600">
                      {new Date(conflict.conflict_detected_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Status</p>
                    <Badge variant={conflict.resolution_status === 'resolved' ? 'default' : 'secondary'}>
                      {conflict.resolution_status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Change 1
                    </p>
                    <div className="p-2 bg-blue-50 rounded text-sm">
                      <p>By: {formatUserName(conflict.conflicting_change_1?.changed_by || '')}</p>
                      <p className="text-gray-600">
                        {new Date(conflict.conflicting_change_1?.changed_at || '').toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Change 2
                    </p>
                    <div className="p-2 bg-green-50 rounded text-sm">
                      <p>By: {formatUserName(conflict.conflicting_change_2?.changed_by || '')}</p>
                      <p className="text-gray-600">
                        {new Date(conflict.conflicting_change_2?.changed_at || '').toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">
                      {conflict.conflicting_fields.length} conflicting field{conflict.conflicting_fields.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">
                      {conflict.conflicting_fields.filter(f => f.auto_resolvable).length} auto-resolvable
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conflicting Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conflicting Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {conflict.conflicting_fields.map((field, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{field.field}</span>
                            <Badge variant="outline" className="text-xs">
                              {field.type}
                            </Badge>
                            <Badge className={cn('text-xs', getSeverityColor(field.severity))}>
                              {field.severity}
                            </Badge>
                            {field.auto_resolvable && (
                              <Badge variant="outline" className="text-xs text-green-600">
                                <Zap className="h-3 w-3 mr-1" />
                                Auto
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <p className="text-gray-600">Change 1:</p>
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              {field.value_1 || '<empty>'}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-gray-600">Change 2:</p>
                            <div className="p-2 bg-green-50 rounded border border-green-200">
                              {field.value_2 || '<empty>'}
                            </div>
                          </div>
                        </div>

                        {!field.auto_resolvable && (
                          <div className="mt-3 space-y-2">
                            <Label className="text-sm font-medium">Manual Resolution:</Label>
                            <RadioGroup
                              value={manualResolutions[field.field]}
                              onValueChange={(value) =>
                                setManualResolutions(prev => ({
                                  ...prev,
                                  [field.field]: value
                                }))
                              }
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value={field.value_1} id={`${field.field}-value1`} />
                                <Label htmlFor={`${field.field}-value1`} className="text-sm">
                                  Use Change 1 value
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value={field.value_2} id={`${field.field}-value2`} />
                                <Label htmlFor={`${field.field}-value2`} className="text-sm">
                                  Use Change 2 value
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Resolution Options */}
            <Tabs defaultValue="auto" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="auto" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Auto Resolve
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <GitMerge className="h-4 w-4" />
                  Manual Resolve
                </TabsTrigger>
              </TabsList>

              <TabsContent value="auto" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Auto-Resolution Strategy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup
                      value={resolutionStrategy}
                      onValueChange={(value: 'prefer_latest' | 'prefer_first' | 'merge_safe') =>
                        setResolutionStrategy(value)
                      }
                    >
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="prefer_latest" id="prefer_latest" className="mt-1" />
                        <div className="space-y-1">
                          <Label htmlFor="prefer_latest" className="font-medium">
                            Prefer Latest Changes
                          </Label>
                          <p className="text-sm text-gray-600">
                            Use values from the most recent change for all conflicting fields
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="prefer_first" id="prefer_first" className="mt-1" />
                        <div className="space-y-1">
                          <Label htmlFor="prefer_first" className="font-medium">
                            Prefer First Changes
                          </Label>
                          <p className="text-sm text-gray-600">
                            Use values from the first detected change for all conflicting fields
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="merge_safe" id="merge_safe" className="mt-1" />
                        <div className="space-y-1">
                          <Label htmlFor="merge_safe" className="font-medium">
                            Safe Merge (Recommended)
                          </Label>
                          <p className="text-sm text-gray-600">
                            Intelligently merge changes using the most complete and appropriate values
                          </p>
                        </div>
                      </div>
                    </RadioGroup>

                    <Button
                      onClick={autoResolve}
                      disabled={isResolving}
                      className="w-full"
                    >
                      {isResolving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Resolving...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Auto-Resolve Conflict
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="manual" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Manual Resolution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="resolution-notes" className="font-medium">
                        Resolution Notes (Optional)
                      </Label>
                      <Textarea
                        id="resolution-notes"
                        placeholder="Add notes about how you resolved this conflict..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="mt-2"
                        rows={3}
                      />
                    </div>

                    {hasUnresolvableFields && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium text-sm">Manual Selection Required</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Some fields cannot be auto-resolved. Please review the conflicting fields above
                          and select your preferred values.
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={manualResolve}
                      disabled={isResolving || (hasUnresolvableFields && Object.keys(manualResolutions).length === 0)}
                      className="w-full"
                    >
                      {isResolving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Resolving...
                        </>
                      ) : (
                        <>
                          <GitMerge className="h-4 w-4 mr-2" />
                          Apply Manual Resolution
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No conflict data available</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}