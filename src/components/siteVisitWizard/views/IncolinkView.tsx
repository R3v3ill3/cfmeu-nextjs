"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { WizardButton } from '../shared/WizardButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { 
  Link2, 
  Building, 
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Users,
  Calendar,
  Save,
} from 'lucide-react'

interface IncolinkViewProps {
  projectId: string
  projectName: string
}

interface BuilderIncolinkStatus {
  builderId: string | null
  builderName: string | null
  incolinkId: string | null
  lastPaymentDate: string | null
  workerCount: number | null
}

export function IncolinkView({ projectId, projectName }: IncolinkViewProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [newIncolinkId, setNewIncolinkId] = useState('')
  
  // Fetch builder incolink status
  const { data: incolinkData, isLoading, refetch } = useQuery({
    queryKey: ['wizard-incolink-status', projectId],
    queryFn: async () => {
      // Get builder assignment
      const { data: builderAssignment, error } = await supabase
        .from('project_assignments')
        .select(`
          employers (
            id,
            name,
            incolink_id,
            last_incolink_payment,
            estimated_worker_count
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
          incolinkId: null,
          lastPaymentDate: null,
          workerCount: null,
        } as BuilderIncolinkStatus
      }
      
      return {
        builderId: builder.id,
        builderName: builder.name,
        incolinkId: builder.incolink_id || null,
        lastPaymentDate: builder.last_incolink_payment || null,
        workerCount: builder.estimated_worker_count || null,
      } as BuilderIncolinkStatus
    },
    staleTime: 30000,
  })
  
  // Update incolink ID mutation
  const updateIncolinkMutation = useMutation({
    mutationFn: async (incolinkId: string) => {
      if (!incolinkData?.builderId) throw new Error('No builder found')
      
      const { error } = await supabase
        .from('employers')
        .update({ 
          incolink_id: incolinkId.trim(),
          incolink_last_matched: new Date().toISOString().split('T')[0]
        })
        .eq('id', incolinkData.builderId)
      
      if (error) throw error
    },
    onSuccess: () => {
      toast({
        title: 'Incolink ID saved',
        description: 'The Incolink ID has been updated.',
      })
      setNewIncolinkId('')
      queryClient.invalidateQueries({ queryKey: ['wizard-incolink-status', projectId] })
    },
    onError: (error) => {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    },
  })
  
  // Refresh incolink data mutation (triggers scraper)
  const refreshIncolinkMutation = useMutation({
    mutationFn: async () => {
      if (!incolinkData?.builderId) throw new Error('No builder found')
      
      const response = await fetch('/api/scraper-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType: 'incolink_sync',
          payload: {
            employerIds: [incolinkData.builderId],
          },
          priority: 5,
          progressTotal: 1,
        }),
      })
      
      if (!response.ok) {
        throw new Error(await response.text())
      }
      
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: 'Refresh queued',
        description: 'Incolink data will be updated shortly.',
      })
    },
    onError: (error) => {
      toast({
        title: 'Failed to refresh',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    },
  })
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  
  const handleSaveIncolinkId = () => {
    if (!newIncolinkId.trim()) return
    updateIncolinkMutation.mutate(newIncolinkId)
  }
  
  return (
    <div className="p-4 space-y-4 pb-safe-bottom">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !incolinkData?.builderName ? (
        // No builder assigned
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Building className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No builder assigned</p>
          <p className="text-sm text-gray-400 mt-1">
            Assign a builder to check Incolink status
          </p>
        </div>
      ) : (
        <>
          {/* Builder card */}
          <div className={cn(
            'rounded-2xl border-2 p-5',
            incolinkData.incolinkId 
              ? 'bg-emerald-50 border-emerald-200' 
              : 'bg-gray-50 border-gray-200'
          )}>
            <div className="flex items-start gap-4">
              <div className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
                incolinkData.incolinkId ? 'bg-emerald-100' : 'bg-gray-100'
              )}>
                {incolinkData.incolinkId ? (
                  <Link2 className="h-8 w-8 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-gray-500" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 truncate">
                  {incolinkData.builderName}
                </h3>
                <p className="text-sm text-gray-600 mt-1">Builder / Head Contractor</p>
                
                {incolinkData.incolinkId ? (
                  <>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold mt-3">
                      <CheckCircle className="h-4 w-4" />
                      Incolink Linked
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      ID: <span className="font-mono font-medium">{incolinkData.incolinkId}</span>
                    </p>
                  </>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold mt-3">
                    <AlertCircle className="h-4 w-4" />
                    No Incolink ID
                  </div>
                )}
              </div>
            </div>
            
            {/* Stats */}
            {incolinkData.incolinkId && (
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-emerald-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Last Payment</div>
                    <div className="font-semibold text-gray-900">
                      {formatDate(incolinkData.lastPaymentDate) || 'Unknown'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Workers</div>
                    <div className="font-semibold text-gray-900">
                      {incolinkData.workerCount ?? 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Enter Incolink ID form */}
          {!incolinkData.incolinkId && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <Label htmlFor="incolink-id" className="text-base font-semibold">
                Enter Incolink Employer ID
              </Label>
              <div className="flex gap-2">
                <Input
                  id="incolink-id"
                  type="text"
                  value={newIncolinkId}
                  onChange={(e) => setNewIncolinkId(e.target.value)}
                  placeholder="e.g., 1234567"
                  className="h-12 text-lg"
                />
                <WizardButton
                  variant="primary"
                  size="md"
                  onClick={handleSaveIncolinkId}
                  loading={updateIncolinkMutation.isPending}
                  disabled={!newIncolinkId.trim()}
                  icon={<Save className="h-4 w-4" />}
                >
                  Save
                </WizardButton>
              </div>
              <p className="text-sm text-gray-500">
                Enter the employer's Incolink ID to enable payment tracking
              </p>
            </div>
          )}
          
          {/* Actions */}
          <div className="space-y-3 pt-2">
            {incolinkData.incolinkId && (
              <WizardButton
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => refreshIncolinkMutation.mutate()}
                loading={refreshIncolinkMutation.isPending}
                icon={<RefreshCw className="h-5 w-5" />}
              >
                Refresh Incolink Data
              </WizardButton>
            )}
            
            {incolinkData.builderId && (
              <WizardButton
                variant="outline"
                size="md"
                fullWidth
                onClick={() => window.open(`/employers/${incolinkData.builderId}`, '_blank')}
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

