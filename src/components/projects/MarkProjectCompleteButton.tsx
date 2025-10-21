"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

interface MarkProjectCompleteButtonProps {
  projectId: string
  projectName: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
}

export function MarkProjectCompleteButton({
  projectId,
  projectName,
  variant = 'outline',
  size = 'default',
}: MarkProjectCompleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const queryClient = useQueryClient()

  const handleMarkComplete = async () => {
    setIsProcessing(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase.rpc('mark_project_complete', {
        p_project_id: projectId,
        p_user_id: user.id,
      })

      if (error) throw error

      if (data?.error) {
        throw new Error(data.error)
      }

      const totalUpdated = data?.total_updated || 0

      toast.success('Project marked complete', {
        description: `${totalUpdated} trade assignment${totalUpdated !== 1 ? 's' : ''} marked as completed`,
      })

      // Invalidate relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['mapping-sheet-data', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })

      setOpen(false)
    } catch (error) {
      console.error('Failed to mark project complete:', error)
      toast.error('Failed to mark project complete', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        Mark Project Complete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Project Complete</DialogTitle>
            <DialogDescription>
              This will mark ALL trade assignments on "{projectName}" as completed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">What will happen:</h4>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>All active, planned, and tendering trades → Completed</li>
                <li>End dates set to today (if not already set)</li>
                <li>Project finish date updated (if not already set)</li>
                <li>Status timestamps recorded</li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Note:</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>You can still change individual statuses afterward</li>
                <li>This doesn't affect completed or cancelled trades</li>
                <li>Changes are permanent (no undo)</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkComplete}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm - Mark Complete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

