"use client"

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { WizardButton } from './WizardButton'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle, MapPin, Clock } from 'lucide-react'

interface SiteVisitRecordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  mainJobSiteId?: string | null
  onComplete?: () => void
  onSkip?: () => void
  // Pre-selected reason names based on visited views
  preSelectedReasonNames?: string[]
}

interface VisitReasonDefinition {
  id: string
  name: string
  display_name: string
  description: string | null
  is_global: boolean
}

export function SiteVisitRecordDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  mainJobSiteId,
  onComplete,
  onSkip,
  preSelectedReasonNames = [],
}: SiteVisitRecordDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [hasAutoSelected, setHasAutoSelected] = useState(false)
  
  // Fetch visit reason definitions
  const { data: reasonDefinitions = [], isLoading: loadingReasons } = useQuery({
    queryKey: ['site-visit-reason-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_visit_reason_definitions')
        .select('id, name, display_name, description, is_global')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      
      if (error) throw error
      return (data || []) as VisitReasonDefinition[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
  
  // Auto-select reasons based on preSelectedReasonNames when dialog opens and definitions are loaded
  useEffect(() => {
    if (open && reasonDefinitions.length > 0 && preSelectedReasonNames.length > 0 && !hasAutoSelected) {
      const matchingIds = reasonDefinitions
        .filter(def => preSelectedReasonNames.includes(def.name))
        .map(def => def.id)
      
      if (matchingIds.length > 0) {
        setSelectedReasons(matchingIds)
        setHasAutoSelected(true)
      }
    }
  }, [open, reasonDefinitions, preSelectedReasonNames, hasAutoSelected])
  
  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedReasons([])
      setNotes('')
      setHasAutoSelected(false)
    }
  }, [open])
  
  // Create site visit mutation
  const createVisitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      // First, get the job site ID for this project
      let jobSiteId = mainJobSiteId
      
      if (!jobSiteId) {
        // Try to get the main job site for this project
        const { data: sites } = await supabase
          .from('job_sites')
          .select('id')
          .eq('project_id', projectId)
          .limit(1)
        
        jobSiteId = sites?.[0]?.id || null
      }
      
      if (!jobSiteId) {
        throw new Error('No job site found for this project')
      }
      
      // Create the site visit
      const { data: visit, error: visitError } = await supabase
        .from('site_visit')
        .insert({
          job_site_id: jobSiteId,
          project_id: projectId,
          organiser_id: user.id,
          date: new Date().toISOString(),
          notes: notes || null,
          visit_status: 'completed',
          created_by: user.id,
        })
        .select('id')
        .single()
      
      if (visitError) throw visitError
      
      // Add visit reasons if selected
      if (selectedReasons.length > 0 && visit?.id) {
        const reasonsToInsert = selectedReasons.map(reasonId => ({
          site_visit_id: visit.id,
          reason_definition_id: reasonId,
        }))
        
        await supabase
          .from('site_visit_reasons')
          .insert(reasonsToInsert)
      }
      
      return visit
    },
    onSuccess: () => {
      toast({
        title: 'Site visit recorded',
        description: `Visit to ${projectName} has been logged.`,
      })
      queryClient.invalidateQueries({ queryKey: ['project-site-visits', projectId] })
      queryClient.invalidateQueries({ queryKey: ['v_project_last_visit'] })
      onComplete?.()
      onOpenChange(false)
    },
    onError: (error) => {
      console.error('Failed to record site visit:', error)
      toast({
        title: 'Failed to record visit',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    },
  })
  
  const toggleReason = (reasonId: string) => {
    setSelectedReasons(prev => 
      prev.includes(reasonId)
        ? prev.filter(id => id !== reasonId)
        : [...prev, reasonId]
    )
  }
  
  const handleSubmit = () => {
    createVisitMutation.mutate()
  }
  
  const handleSkip = () => {
    onSkip?.()
    onOpenChange(false)
  }
  
  const currentTime = new Date().toLocaleTimeString('en-AU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
  const currentDate = new Date().toLocaleDateString('en-AU', { 
    weekday: 'short',
    day: 'numeric', 
    month: 'short' 
  })
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg mx-4 p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 bg-blue-600 text-white">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Record Site Visit?
          </DialogTitle>
          <DialogDescription className="text-blue-100 mt-1">
            Would you like to log this visit to {projectName}?
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-6">
          {/* Time stamp display */}
          <div className="flex items-center justify-center gap-4 py-3 px-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-5 w-5" />
              <span className="font-medium">{currentTime}</span>
            </div>
            <div className="w-px h-6 bg-gray-300" />
            <span className="text-gray-600">{currentDate}</span>
          </div>
          
          {/* Visit reasons */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Visit reason(s)
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </Label>
            
            {loadingReasons ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {reasonDefinitions.map((reason) => (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => toggleReason(reason.id)}
                    className={cn(
                      'px-4 py-2.5 rounded-full text-sm font-medium',
                      'transition-all duration-200 touch-manipulation',
                      'border-2',
                      selectedReasons.includes(reason.id)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    )}
                  >
                    {selectedReasons.includes(reason.id) && (
                      <CheckCircle className="inline h-4 w-4 mr-1.5 -mt-0.5" />
                    )}
                    {reason.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="visit-notes" className="text-base font-semibold">
              Notes
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </Label>
            <Textarea
              id="visit-notes"
              placeholder="Add any notes about this visit..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px] text-base resize-none"
            />
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <WizardButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleSubmit}
              loading={createVisitMutation.isPending}
              icon={<CheckCircle className="h-5 w-5" />}
            >
              Yes, Record Visit
            </WizardButton>
            
            <WizardButton
              variant="ghost"
              size="md"
              fullWidth
              onClick={handleSkip}
              disabled={createVisitMutation.isPending}
            >
              No, Exit Without Recording
            </WizardButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
