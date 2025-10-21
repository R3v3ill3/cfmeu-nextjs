"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import {
  useLeadOrganiserCustomReasons,
  useCreateSiteVisitReason,
  useUpdateSiteVisitReason,
  useDeleteSiteVisitReason,
  type SiteVisitReasonDefinition
} from "@/hooks/useSiteVisitReasons"
import { toast } from "sonner"

export default function SiteVisitReasonsPage() {
  const [open, setOpen] = useState(false)
  const [editingReason, setEditingReason] = useState<SiteVisitReasonDefinition | null>(null)
  
  // Form state
  const [displayName, setDisplayName] = useState("")
  const [description, setDescription] = useState("")
  const [alwaysVisible, setAlwaysVisible] = useState(false)
  const [displayOrder, setDisplayOrder] = useState(100)

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-lead"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth?.user) return null
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", auth.user.id)
        .single()
      
      return profile
    }
  })

  const { data: customReasons = [], isLoading } = useLeadOrganiserCustomReasons(currentUser?.id)
  const createMutation = useCreateSiteVisitReason()
  const updateMutation = useUpdateSiteVisitReason()
  const deleteMutation = useDeleteSiteVisitReason()

  // Check if user is a lead organiser
  if (currentUser && currentUser.role !== "lead_organiser") {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              This page is only accessible to lead organisers.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const openDialog = (reason?: SiteVisitReasonDefinition) => {
    if (reason) {
      setEditingReason(reason)
      setDisplayName(reason.display_name)
      setDescription(reason.description || "")
      setAlwaysVisible(reason.always_visible)
      setDisplayOrder(reason.display_order)
    } else {
      setEditingReason(null)
      setDisplayName("")
      setDescription("")
      setAlwaysVisible(false)
      setDisplayOrder(Math.max(...customReasons.map(r => r.display_order), 0) + 10)
    }
    setOpen(true)
  }

  const closeDialog = () => {
    setOpen(false)
    setEditingReason(null)
    setDisplayName("")
    setDescription("")
    setAlwaysVisible(false)
    setDisplayOrder(100)
  }

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error("Display name is required")
      return
    }

    if (!currentUser?.id) {
      toast.error("User not found")
      return
    }

    // Generate name from display name (lowercase, underscores)
    const name = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    if (editingReason) {
      // Update existing
      await updateMutation.mutateAsync({
        id: editingReason.id,
        updates: {
          display_name: displayName.trim(),
          description: description.trim() || null,
          always_visible: alwaysVisible,
          display_order: displayOrder,
        }
      })
    } else {
      // Create new
      await createMutation.mutateAsync({
        name,
        display_name: displayName.trim(),
        description: description.trim() || null,
        is_global: false,
        created_by_lead_organiser_id: currentUser.id,
        is_active: true,
        display_order: displayOrder,
        always_visible: alwaysVisible,
      })
    }

    closeDialog()
  }

  const handleDelete = async (reason: SiteVisitReasonDefinition) => {
    if (!confirm(`Are you sure you want to deactivate "${reason.display_name}"?`)) {
      return
    }
    await deleteMutation.mutateAsync(reason.id)
  }

  const handleMoveUp = async (reason: SiteVisitReasonDefinition) => {
    const currentIndex = customReasons.findIndex(r => r.id === reason.id)
    if (currentIndex <= 0) return

    const prevReason = customReasons[currentIndex - 1]
    await updateMutation.mutateAsync({
      id: reason.id,
      updates: { display_order: prevReason.display_order }
    })
    await updateMutation.mutateAsync({
      id: prevReason.id,
      updates: { display_order: reason.display_order }
    })
  }

  const handleMoveDown = async (reason: SiteVisitReasonDefinition) => {
    const currentIndex = customReasons.findIndex(r => r.id === reason.id)
    if (currentIndex >= customReasons.length - 1) return

    const nextReason = customReasons[currentIndex + 1]
    await updateMutation.mutateAsync({
      id: reason.id,
      updates: { display_order: nextReason.display_order }
    })
    await updateMutation.mutateAsync({
      id: nextReason.id,
      updates: { display_order: reason.display_order }
    })
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Site Visit Reasons</h1>
          <p className="text-muted-foreground mt-1">
            Manage custom visit reasons for your team
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Reason
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingReason ? "Edit Visit Reason" : "Add Custom Visit Reason"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Display Name *</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Safety Inspection"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of when to use this reason..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Always Visible</Label>
                  <p className="text-sm text-muted-foreground">
                    Show by default (not in "more" section)
                  </p>
                </div>
                <Switch
                  checked={alwaysVisible}
                  onCheckedChange={setAlwaysVisible}
                />
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers appear first
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingReason ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Custom Visit Reasons</CardTitle>
          <CardDescription>
            These custom reasons will be available to all organisers in your team, in addition to the global reasons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : customReasons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No custom visit reasons yet.</p>
              <p className="text-sm mt-2">Click "Add Custom Reason" to create one.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customReasons.map((reason, index) => (
                  <TableRow key={reason.id}>
                    <TableCell className="font-medium">
                      {reason.display_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                      {reason.description || "—"}
                    </TableCell>
                    <TableCell>
                      {reason.always_visible ? (
                        <Badge variant="default">Always</Badge>
                      ) : (
                        <Badge variant="secondary">More</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveUp(reason)}
                          disabled={index === 0 || updateMutation.isPending}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveDown(reason)}
                          disabled={index === customReasons.length - 1 || updateMutation.isPending}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <span className="text-sm text-muted-foreground ml-2">
                          {reason.display_order}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDialog(reason)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(reason)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global Visit Reasons</CardTitle>
          <CardDescription>
            These standard reasons are available to all organisers across the organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Badge variant="outline">Compliance Audit</Badge>
              <Badge variant="outline">Delegate Election</Badge>
              <Badge variant="outline">EBA Vote</Badge>
              <Badge variant="outline">Safety Issue</Badge>
              <Badge variant="outline">Employer Meeting</Badge>
              <Badge variant="outline">Delegate 1-on-1</Badge>
              <Badge variant="outline">Site Meeting</Badge>
              <Badge variant="outline">General Visit</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Global reasons cannot be edited or removed. Contact an administrator to request changes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

