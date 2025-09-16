"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  AlertTriangle, 
  CheckCircle, 
  Settings, 
  RefreshCw,
  Eye,
  Save,
  Undo2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ProjectWithOrganizingUniverse {
  id: string
  name: string
  tier: string
  organising_universe: string
  organising_universe_manual_override: boolean
  organising_universe_auto_assigned: boolean
  organising_universe_change_reason: string
  calculated_universe: string
  builder_name: string
  builder_has_eba: boolean
  has_patch_assignment: boolean
}

/**
 * Admin component for managing organizing universe classifications
 * Allows manual overrides and bulk operations while respecting the auto-assignment rules
 */
export default function OrganizingUniverseManager() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [bulkUniverse, setBulkUniverse] = useState<string>("")
  const [bulkReason, setBulkReason] = useState<string>("")
  const [showPreview, setShowPreview] = useState(false)

  // Get organizing universe analysis data
  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ["organizing-universe-analysis"],
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organising_universe_impact_analysis")
        .select("*")
        .order("tier, name")
      
      if (error) throw error
      return data || []
    }
  })

  // Get recent changes
  const { data: recentChanges = [] } = useQuery({
    queryKey: ["organizing-universe-recent-changes"],
    staleTime: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organising_universe_change_log")
        .select(`
          *,
          projects!inner(name)
        `)
        .order("applied_at", { ascending: false })
        .limit(10)
      
      if (error) throw error
      return data || []
    }
  })

  // Manual override mutation
  const manualOverrideMutation = useMutation({
    mutationFn: async ({ projectId, universe, reason }: {
      projectId: string
      universe: string  
      reason: string
    }) => {
      const { data, error } = await supabase.rpc('set_organising_universe_manual', {
        p_project_id: projectId,
        p_universe: universe,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_reason: reason
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizing-universe-analysis"] })
      queryClient.invalidateQueries({ queryKey: ["organizing-universe-recent-changes"] })
      toast({ title: "Successfully updated organizing universe" })
    },
    onError: (error) => {
      toast({ 
        title: "Failed to update organizing universe", 
        description: error.message,
        variant: "destructive" 
      })
    }
  })

  // Remove override mutation
  const removeOverrideMutation = useMutation({
    mutationFn: async ({ projectId, reason }: {
      projectId: string
      reason: string
    }) => {
      const { data, error } = await supabase.rpc('remove_organising_universe_manual_override', {
        p_project_id: projectId,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_reason: reason
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizing-universe-analysis"] })
      queryClient.invalidateQueries({ queryKey: ["organizing-universe-recent-changes"] })
      toast({ title: "Successfully removed manual override" })
    },
    onError: (error) => {
      toast({
        title: "Failed to remove override",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  // Bulk override mutation
  const bulkOverrideMutation = useMutation({
    mutationFn: async () => {
      const projectIds = Array.from(selectedProjects)
      const { data, error } = await supabase.rpc('bulk_set_organising_universe_manual', {
        p_project_ids: projectIds,
        p_universe: bulkUniverse,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_reason: bulkReason || `Bulk update to ${bulkUniverse}`
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizing-universe-analysis"] })
      queryClient.invalidateQueries({ queryKey: ["organizing-universe-recent-changes"] })
      setSelectedProjects(new Set())
      setBulkReason("")
      toast({ 
        title: `Successfully updated ${data.success_count} projects`,
        description: data.error_count > 0 ? `${data.error_count} errors occurred` : undefined
      })
    },
    onError: (error) => {
      toast({
        title: "Bulk update failed",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const toggleProjectSelection = (projectId: string) => {
    const newSet = new Set(selectedProjects)
    if (newSet.has(projectId)) {
      newSet.delete(projectId)
    } else {
      newSet.add(projectId)
    }
    setSelectedProjects(newSet)
  }

  const getUniverseBadgeColor = (universe: string) => {
    switch (universe) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'potential': return 'bg-orange-100 text-orange-800 border-orange-200'  
      case 'excluded': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const getChangeTypeBadge = (changeType: string) => {
    switch (changeType) {
      case 'NO_CHANGE': return <Badge variant="outline" className="text-xs">No Change</Badge>
      case 'WOULD_CHANGE': return <Badge variant="secondary" className="text-xs">Would Change</Badge>
      case 'NEW_ASSIGNMENT': return <Badge variant="default" className="text-xs">New Assignment</Badge>
      default: return <Badge variant="outline" className="text-xs">{changeType}</Badge>
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Organizing Universe Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-red-700">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Error Loading Organizing Universe Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  const changesNeeded = projects.filter(p => p.change_type !== 'NO_CHANGE')

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Organizing Universe Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
              <div className="text-sm text-gray-600">Total Projects</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{changesNeeded.length}</div>
              <div className="text-sm text-gray-600">Need Updates</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {projects.filter(p => p.organising_universe_manual_override).length}
              </div>
              <div className="text-sm text-gray-600">Manual Overrides</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {projects.filter(p => p.organising_universe_auto_assigned).length}
              </div>
              <div className="text-sm text-gray-600">Auto-Assigned</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Operations */}
      {selectedProjects.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800">
              Bulk Update ({selectedProjects.size} projects selected)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>New Organizing Universe</Label>
                <Select value={bulkUniverse} onValueChange={setBulkUniverse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select universe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="potential">Potential</SelectItem>
                    <SelectItem value="excluded">Excluded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="md:col-span-2">
                <Label>Reason for Change</Label>
                <Input
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Why are you making this change?"
                />
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                onClick={() => bulkOverrideMutation.mutate()}
                disabled={!bulkUniverse || bulkOverrideMutation.isPending}
                className="flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Apply Bulk Update
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setSelectedProjects(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Project Classifications</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide' : 'Show'} Preview Mode
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {projects.map((project) => (
              <div 
                key={project.id}
                className={`p-3 border rounded-lg ${
                  selectedProjects.has(project.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={() => toggleProjectSelection(project.id)}
                      className="rounded"
                    />
                    
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-sm text-gray-600">
                        {project.tier} • Builder: {project.builder_name || 'None'} 
                        {project.builder_has_eba && <span className="text-green-600"> (EBA)</span>}
                        {project.has_patch_assignment && <span className="text-blue-600"> (Patched)</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {getChangeTypeBadge(project.change_type)}
                    
                    <Badge className={getUniverseBadgeColor(project.current_universe)}>
                      {project.current_universe || 'NULL'}
                    </Badge>
                    
                    {showPreview && project.calculated_universe !== project.current_universe && (
                      <>
                        <span className="text-gray-400">→</span>
                        <Badge className={getUniverseBadgeColor(project.calculated_universe)}>
                          {project.calculated_universe}
                        </Badge>
                      </>
                    )}
                    
                    {project.organising_universe_manual_override && (
                      <Badge variant="outline" className="text-xs">
                        Manual Override
                      </Badge>
                    )}
                  </div>
                </div>
                
                {project.organising_universe_change_reason && (
                  <div className="mt-2 text-xs text-gray-500 pl-6">
                    {project.organising_universe_change_reason}
                  </div>
                )}
                
                <div className="mt-2 flex justify-end space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const reason = prompt(`Set manual organizing universe for ${project.name}.\n\nReason for change:`)
                      if (reason) {
                        const universe = prompt(`Choose universe: active, potential, or excluded`)
                        if (universe && ['active', 'potential', 'excluded'].includes(universe)) {
                          manualOverrideMutation.mutate({
                            projectId: project.id,
                            universe,
                            reason
                          })
                        }
                      }
                    }}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Manual Set
                  </Button>
                  
                  {project.organising_universe_manual_override && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const reason = prompt(`Remove manual override for ${project.name}.\n\nThis will allow auto-assignment based on tier/EBA/patch rules.\n\nReason:`)
                        if (reason) {
                          removeOverrideMutation.mutate({
                            projectId: project.id,
                            reason
                          })
                        }
                      }}
                    >
                      <Undo2 className="h-3 w-3 mr-1" />
                      Remove Override
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Changes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <RefreshCw className="h-5 w-5 mr-2" />
            Recent Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentChanges.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent changes</p>
          ) : (
            <div className="space-y-2">
              {recentChanges.map((change: any) => (
                <div key={change.id} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{change.projects?.name}</div>
                      <div className="text-sm text-gray-600">
                        {change.old_value} → {change.new_value}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(change.applied_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {change.change_reason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
