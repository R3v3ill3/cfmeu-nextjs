"use client"
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw, Database, CheckCircle } from "lucide-react"

/**
 * Admin utility to manually sync lead organiser patch assignments
 * This populates the lead_organiser_patch_assignments table using the proven patches selector logic
 */
export function LeadOrganiserPatchSync() {
  const { toast } = useToast()
  const [lastResult, setLastResult] = useState<any>(null)

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_sync_all_lead_organiser_patches')
      
      if (error) {
        throw new Error(`Sync failed: ${error.message}`)
      }
      
      return data
    },
    onSuccess: (result) => {
      setLastResult(result)
      toast({
        title: "Sync completed successfully",
        description: `Processed ${result?.summary?.total_leads_processed || 0} live co-ordinators`,
      })
    },
    onError: (error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="h-5 w-5 mr-2" />
          Co-ordinator Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>
            This utility synchronizes the <code>lead_organiser_patch_assignments</code> table 
            using the same logic as the working patches selector. This ensures co-ordinator 
            dashboard data shows correctly and provides a single source of truth for other features.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync All Co-ordinator Patches'}
          </Button>
        </div>

        {lastResult && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              <div><strong>Last sync results:</strong></div>
              <div>• Live co-ordinators processed: {lastResult.summary?.total_leads_processed || 0}</div>
              <div>• Patches added: {lastResult.summary?.total_patches_added || 0}</div>
              <div>• Patches removed: {lastResult.summary?.total_patches_removed || 0}</div>
              <div className="text-xs text-muted-foreground mt-2">
                Completed: {lastResult.timestamp ? new Date(lastResult.timestamp).toLocaleString() : 'Unknown'}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground">
          <p>
            <strong>Note:</strong> This sync only updates the database table for live co-ordinators. 
            Draft co-ordinators are handled dynamically when needed. The sync runs automatically 
            when role assignments change, but you can manually trigger it here if needed.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
