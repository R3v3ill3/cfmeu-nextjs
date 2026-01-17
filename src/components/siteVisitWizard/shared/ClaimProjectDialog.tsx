"use client"

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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
import { toast } from 'sonner'
import { UserPlus, Building, MapPin, AlertCircle } from 'lucide-react'

interface ProjectToClaim {
  id: string
  name: string
  address?: string | null
  builderName?: string | null
  mainJobSiteId?: string | null
}

interface ClaimProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectToClaim | null
  onSuccess: () => void
}

interface ClaimResponse {
  success: boolean
  claimId: string
  projectId: string
  projectName: string
}

interface ClaimError {
  error: string
  assigned_to?: string[]
  patch_name?: string
}

export function ClaimProjectDialog({
  open,
  onOpenChange,
  project,
  onSuccess,
}: ClaimProjectDialogProps) {
  const [notes, setNotes] = useState('')
  
  // Claim project mutation
  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error('No project to claim')
      
      const response = await fetch(`/api/projects/${project.id}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: notes || undefined }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        const errorData = data as ClaimError
        throw new Error(errorData.error || 'Failed to claim project')
      }
      
      return data as ClaimResponse
    },
    onSuccess: (data) => {
      toast.success('Project claimed', {
        description: `You now have access to ${data.projectName}`,
      })
      setNotes('')
      onSuccess()
    },
    onError: (error) => {
      console.error('Failed to claim project:', error)
      toast.error('Failed to claim project', {
        description: error instanceof Error ? error.message : 'An error occurred',
      })
    },
  })
  
  const handleClaim = () => {
    claimMutation.mutate()
  }
  
  const handleClose = () => {
    if (!claimMutation.isPending) {
      setNotes('')
      onOpenChange(false)
    }
  }
  
  if (!project) return null
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg mx-4 p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 bg-amber-500 text-white">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="h-6 w-6" />
            Claim Project
          </DialogTitle>
          <DialogDescription className="text-amber-100 mt-1">
            This project is not assigned to any organiser. Would you like to claim it?
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-6">
          {/* Project info card */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <h3 className="text-lg font-bold text-gray-900">
              {project.name}
            </h3>
            {project.builderName && (
              <p className="text-sm text-gray-600 flex items-center gap-1.5">
                <Building className="h-4 w-4 flex-shrink-0" />
                {project.builderName}
              </p>
            )}
            {project.address && (
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                {project.address}
              </p>
            )}
          </div>
          
          {/* Info message */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 text-amber-800 rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">What happens when you claim a project?</p>
              <p className="mt-1 text-amber-700">
                You&apos;ll get access to view and edit this project&apos;s details, even if it&apos;s 
                outside your assigned patches. You can release the claim later if needed.
              </p>
            </div>
          </div>
          
          {/* Notes (optional) */}
          <div className="space-y-2">
            <Label htmlFor="claim-notes" className="text-sm font-medium">
              Notes
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </Label>
            <Textarea
              id="claim-notes"
              placeholder="Add a note about why you're claiming this project..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] text-base resize-none"
              disabled={claimMutation.isPending}
            />
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <WizardButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleClaim}
              loading={claimMutation.isPending}
              icon={<UserPlus className="h-5 w-5" />}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Claim This Project
            </WizardButton>
            
            <WizardButton
              variant="ghost"
              size="md"
              fullWidth
              onClick={handleClose}
              disabled={claimMutation.isPending}
            >
              Cancel
            </WizardButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
