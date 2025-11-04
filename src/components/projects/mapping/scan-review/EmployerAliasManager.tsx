"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Database,
  FileText,
  TrendingUp,
  Eye,
  EyeOff
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface EmployerAlias {
  id: string
  alias: string
  alias_normalized: string
  is_authoritative: boolean
  source_system?: string
  source_identifier?: string
  collected_at?: string
  collected_by?: string
  created_at: string
  created_by?: string
  notes?: string
  // Analytics fields
  match_count?: number
  last_used_at?: string
}

interface EmployerAliasManagerProps {
  employerId: string
  employerName: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onAliasUpdate?: () => void
  suggestedAlias?: string // Pre-fill alias name when creating from a suggestion
}

interface AliasFormData {
  alias: string
  notes: string
  isAuthoritative: boolean
}

export function EmployerAliasManager({
  employerId,
  employerName,
  isOpen,
  onOpenChange,
  onAliasUpdate,
  suggestedAlias
}: EmployerAliasManagerProps) {
  const [aliases, setAliases] = useState<EmployerAlias[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editDialog, setEditDialog] = useState<{ open: boolean; alias?: EmployerAlias; mode: 'create' | 'edit' }>({
    open: false,
    mode: 'create'
  })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; alias?: EmployerAlias }>({
    open: false
  })
  const [formData, setFormData] = useState<AliasFormData>({
    alias: '',
    notes: '',
    isAuthoritative: false
  })
  const [submitting, setSubmitting] = useState(false)
  const [hasAutoOpened, setHasAutoOpened] = useState(false)
  
  // Auto-open create dialog with suggested alias when provided
  useEffect(() => {
    if (isOpen && suggestedAlias && !editDialog.open && !hasAutoOpened) {
      // Small delay to ensure dialog is fully mounted
      const timer = setTimeout(() => {
        setFormData({
          alias: suggestedAlias,
          notes: `Added from scanned document`,
          isAuthoritative: true // Auto-enable for suggested aliases
        })
        setEditDialog({ open: true, mode: 'create' })
        setHasAutoOpened(true)
      }, 100)
      return () => clearTimeout(timer)
    }
    
    // Reset when dialog closes
    if (!isOpen) {
      setHasAutoOpened(false)
    }
  }, [isOpen, suggestedAlias, editDialog.open, hasAutoOpened]) // Only react to isOpen and suggestedAlias changes

  // Fetch aliases for this employer
  useEffect(() => {
    if (!employerId || !isOpen) return

    const fetchAliases = async () => {
      try {
        const { data, error } = await supabase
          .from('employer_aliases')
          .select('*')
          .eq('employer_id', employerId)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Fetch analytics data for aliases
        const aliasIds = data?.map(a => a.id) || []
        let analytics: any = {}

        if (aliasIds.length > 0) {
          const { data: analyticsData } = await supabase
            .from('employer_alias_analytics')
            .select('alias_id, match_count, last_used_at')
            .in('alias_id', aliasIds)

          if (analyticsData) {
            analytics = analyticsData.reduce((acc, item) => {
              acc[item.alias_id] = {
                match_count: item.match_count,
                last_used_at: item.last_used_at
              }
              return acc
            }, {} as Record<string, any>)
          }
        }

        const enrichedAliases = data?.map(alias => ({
          ...alias,
          ...analytics[alias.id]
        })) || []

        setAliases(enrichedAliases)
      } catch (error) {
        console.error('Failed to fetch aliases:', error)
        toast.error('Failed to load aliases')
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    fetchAliases()
  }, [employerId, isOpen])

  // Filter aliases based on search
  const filteredAliases = aliases.filter(alias => {
    const matchesSearch = !searchQuery ||
      alias.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alias.alias_normalized.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesActive = showInactive || alias.is_authoritative

    return matchesSearch && matchesActive
  })

  const handleCreateAlias = () => {
    setFormData({ 
      alias: suggestedAlias || '', 
      notes: suggestedAlias ? `Added from scanned document` : '', 
      isAuthoritative: !!suggestedAlias 
    })
    setEditDialog({ open: true, mode: 'create' })
  }

  const handleEditAlias = (alias: EmployerAlias) => {
    setFormData({
      alias: alias.alias,
      notes: alias.notes || '',
      isAuthoritative: alias.is_authoritative
    })
    setEditDialog({ open: true, alias, mode: 'edit' })
  }

  const handleDeleteAlias = (alias: EmployerAlias) => {
    setDeleteDialog({ open: true, alias })
  }

  const handleSaveAlias = async () => {
    if (!formData.alias.trim()) {
      toast.error('Please enter an alias')
      return
    }

    setSubmitting(true)

    try {
      const normalizedAlias = formData.alias.trim().toLowerCase()
      
      // Check if alias already exists for this employer
      const { data: existingAliases } = await supabase
        .from('employer_aliases')
        .select('id, alias')
        .eq('employer_id', employerId)
        .eq('alias_normalized', normalizedAlias)

      if (existingAliases && existingAliases.length > 0) {
        if (editDialog.mode === 'create' || 
            (editDialog.mode === 'edit' && editDialog.alias && existingAliases.some(a => a.id !== editDialog.alias!.id))) {
          toast.error(`An alias "${existingAliases[0].alias}" already exists for this employer`)
          setSubmitting(false)
          return
        }
      }

      if (editDialog.mode === 'create') {
        const insertData = {
          alias: formData.alias.trim(),
          alias_normalized: normalizedAlias,
          notes: formData.notes.trim() || null,
          is_authoritative: formData.isAuthoritative,
          employer_id: employerId,
          source_system: 'manual',
          source_identifier: suggestedAlias || null,
          collected_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }

        const { error } = await supabase
          .from('employer_aliases')
          .insert(insertData)

        if (error) {
          // Handle duplicate constraint violation more gracefully
          if (error.code === '23505') { // Unique violation
            toast.error(`An alias "${formData.alias.trim()}" already exists for this employer`)
          } else {
            throw error
          }
        } else {
          toast.success('Alias created successfully')
        }
      } else {
        const updateData = {
          alias: formData.alias.trim(),
          alias_normalized: normalizedAlias,
          notes: formData.notes.trim() || null,
          is_authoritative: formData.isAuthoritative,
          updated_at: new Date().toISOString()
        }

        const { error } = await supabase
          .from('employer_aliases')
          .update(updateData)
          .eq('id', editDialog.alias!.id)

        if (error) {
          if (error.code === '23505') { // Unique violation
            toast.error(`An alias "${formData.alias.trim()}" already exists for this employer`)
          } else {
            throw error
          }
        } else {
          toast.success('Alias updated successfully')
        }
      }

      // Refetch aliases
      const { data } = await supabase
        .from('employer_aliases')
        .select('*')
        .eq('employer_id', employerId)
        .order('created_at', { ascending: false })

      setAliases(data || [])
      setEditDialog({ open: false, mode: 'create' })
      setFormData({ alias: '', notes: '', isAuthoritative: false })
      onAliasUpdate?.()
    } catch (error: any) {
      console.error('Failed to save alias:', error)
      const errorMessage = error?.message || 'Failed to save alias'
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteDialog.alias) return

    try {
      const { error } = await supabase
        .from('employer_aliases')
        .delete()
        .eq('id', deleteDialog.alias.id)

      if (error) throw error

      setAliases(prev => prev.filter(a => a.id !== deleteDialog.alias!.id))
      setDeleteDialog({ open: false })
      toast.success('Alias deleted successfully')
      onAliasUpdate?.()
    } catch (error) {
      console.error('Failed to delete alias:', error)
      toast.error('Failed to delete alias')
    }
  }

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'manual': return <User className="h-3 w-3" />
      case 'bulk_import': return <Database className="h-3 w-3" />
      case 'scanned_document': return <FileText className="h-3 w-3" />
      default: return <Database className="h-3 w-3" />
    }
  }

  const formatLastUsed = (date?: string) => {
    if (!date) return 'Never used'
    const used = new Date(date)
    const now = new Date()
    const daysAgo = Math.floor((now.getTime() - used.getTime()) / (1000 * 60 * 60 * 24))

    if (daysAgo === 0) return 'Used today'
    if (daysAgo === 1) return 'Used yesterday'
    if (daysAgo < 7) return `Used ${daysAgo} days ago`
    if (daysAgo < 30) return `Used ${Math.floor(daysAgo / 7)} weeks ago`
    return `Used ${Math.floor(daysAgo / 30)} months ago`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Manage Aliases for "{employerName}"
          </DialogTitle>
          <DialogDescription>
            Create and manage alternative names that will match this employer in searches and imports
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-[60vh]">
          {/* Search and Controls */}
          <div className="flex items-center gap-4 p-4 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search aliases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
              className="gap-2"
            >
              {showInactive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showInactive ? 'Hide' : 'Show'} Inactive
            </Button>
            <Button onClick={handleCreateAlias} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Alias
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="aliases" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="aliases">Aliases ({filteredAliases.length})</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="aliases" className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-sm text-gray-500">Loading aliases...</div>
                  </div>
                ) : filteredAliases.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No aliases found</h3>
                    <p className="text-gray-500 mb-4">
                      {searchQuery ? 'Try adjusting your search' : 'Create your first alias to help with matching'}
                    </p>
                    {!searchQuery && (
                      <Button onClick={handleCreateAlias} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create First Alias
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAliases.map((alias) => (
                      <Card key={alias.id} className={`${!alias.is_authoritative ? 'opacity-60' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium">{alias.alias}</span>
                                {alias.is_authoritative && (
                                  <Badge variant="default" className="text-xs">Active</Badge>
                                )}
                                {alias.match_count !== undefined && alias.match_count > 0 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="secondary" className="text-xs gap-1">
                                          <TrendingUp className="h-3 w-3" />
                                          {alias.match_count} matches
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>This alias has been used {alias.match_count} times</p>
                                        <p className="text-xs">{formatLastUsed(alias.last_used_at)}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>

                              <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                                <div className="flex items-center gap-1">
                                  {getSourceIcon(alias.source_system)}
                                  <span>Source: {alias.source_system || 'Manual'}</span>
                                </div>
                                {alias.created_at && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>Created: {new Date(alias.created_at).toLocaleDateString()}</span>
                                  </div>
                                )}
                                {alias.last_used_at && (
                                  <div className="flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    <span>{formatLastUsed(alias.last_used_at)}</span>
                                  </div>
                                )}
                              </div>

                              {alias.notes && (
                                <p className="text-sm text-gray-600 mb-2">{alias.notes}</p>
                              )}

                              {alias.source_identifier && (
                                <div className="text-xs text-gray-400">
                                  Source ID: {alias.source_identifier}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 ml-4">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditAlias(alias)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit alias</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteAlias(alias)}
                                      className="h-8 w-8 p-0 hover:text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete alias</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="analytics" className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Alias Performance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">{aliases.length}</div>
                          <div className="text-sm text-gray-500">Total Aliases</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">
                            {aliases.filter(a => a.match_count && a.match_count > 0).length}
                          </div>
                          <div className="text-sm text-gray-500">Active Aliases</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">
                            {aliases.reduce((sum, a) => sum + (a.match_count || 0), 0)}
                          </div>
                          <div className="text-sm text-gray-500">Total Matches</div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {aliases.filter(a => a.match_count && a.match_count > 0).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Most Used Aliases</h4>
                      <div className="space-y-2">
                        {aliases
                          .filter(a => a.match_count && a.match_count > 0)
                          .sort((a, b) => (b.match_count || 0) - (a.match_count || 0))
                          .slice(0, 5)
                          .map((alias) => (
                            <div key={alias.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <span className="font-medium">{alias.alias}</span>
                              <Badge variant="secondary">{alias.match_count} uses</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Edit/Create Dialog */}
        <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ ...editDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editDialog.mode === 'create' ? 'Create New Alias' : 'Edit Alias'}
              </DialogTitle>
              <DialogDescription>
                {editDialog.mode === 'create'
                  ? 'Add an alternative name that will match this employer'
                  : 'Modify the alias details'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="alias">Alias Name</Label>
                <Input
                  id="alias"
                  value={formData.alias}
                  onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                  placeholder="Enter alternative name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any context about this alias"
                  className="mt-1"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isAuthoritative"
                  checked={formData.isAuthoritative}
                  onChange={(e) => setFormData({ ...formData, isAuthoritative: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isAuthoritative">Active (use for matching)</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog({ ...editDialog, open: false })}>
                Cancel
              </Button>
              <Button onClick={handleSaveAlias} disabled={submitting || !formData.alias.trim()}>
                {submitting ? 'Saving...' : editDialog.mode === 'create' ? 'Create' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Alias</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the alias "{deleteDialog.alias?.alias}"?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Deleting this alias may reduce matching accuracy for future imports and searches.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog({ ...deleteDialog, open: false })}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Delete Alias
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}