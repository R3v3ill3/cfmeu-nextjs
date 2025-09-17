"use client"
export const dynamic = 'force-dynamic'

import { PendingUsersTable } from "@/components/admin/PendingUsersTable"
import { InviteUserDialog } from "@/components/admin/InviteUserDialog"
import { AddDraftUserDialog } from "@/components/admin/AddDraftUserDialog"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import UsersTable from "@/components/admin/UsersTable"
import RoleGuard from "@/components/guards/RoleGuard"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { RoleHierarchyManager } from "@/components/admin/RoleHierarchyManager"
import { OrganiserScopeManager } from "@/components/admin/OrganiserScopeManager"
import PatchManager from "@/components/admin/PatchManager"
import SpatialAssignmentTool from "@/components/admin/SpatialAssignmentTool"
import AddressLookupDialog from "@/components/AddressLookupDialog"
import DuplicateEmployerManager from "@/components/admin/DuplicateEmployerManager"
import DataUploadTab from "@/components/admin/DataUploadTab"
import { NavigationVisibilityManager } from "@/components/admin/NavigationVisibilityManager"
import { useAuth } from "@/hooks/useAuth"

export default function AdminPage() {
  const [open, setOpen] = useState(false)
  const [addDraftOpen, setAddDraftOpen] = useState(false)
  const [lookupOpen, setLookupOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const { user } = useAuth()

  // Get user role
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      setUserRole((profile as { role?: string } | null)?.role || null)
    }
    checkUserRole()
  }, [user])

  // Determine available tabs based on role
  const isAdmin = userRole === "admin"
  const isLeadOrganiser = userRole === "lead_organiser"
  const defaultTab = isAdmin ? "users" : "invites" // Lead organisers start with invites tab

  return (
    <RoleGuard allow={["admin", "lead_organiser"]}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            {isAdmin ? "Administration" : "Co-ordinator Management"}
          </h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => setLookupOpen(true)}>Address Lookup</Button>
            )}
            <Button onClick={() => setOpen(true)}>Invite User</Button>
          </div>
        </div>
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
            <TabsTrigger value="invites">Invites</TabsTrigger>
            {isAdmin && <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>}
            <TabsTrigger value="patches">Patches</TabsTrigger>
            {isAdmin && <TabsTrigger value="spatial">Spatial Assignment</TabsTrigger>}
            <TabsTrigger value="scoping">Scoping</TabsTrigger>
            <TabsTrigger value="data-management">Data Management</TabsTrigger>
            {isAdmin && <TabsTrigger value="navigation">Navigation</TabsTrigger>}
          </TabsList>
          {isAdmin && (
            <TabsContent value="users">
              <UsersTable />
            </TabsContent>
          )}
          <TabsContent value="invites">
            <div className="flex items-center justify-between mb-2">
              <div />
              <Button variant="outline" onClick={() => setAddDraftOpen(true)}>Add draft organiser</Button>
            </div>
            <PendingUsersTable />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="hierarchy">
              <AdminHierarchyTab />
            </TabsContent>
          )}
          <TabsContent value="patches">
            <PatchManager />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="spatial">
              <SpatialAssignmentTool />
            </TabsContent>
          )}
          <TabsContent value="scoping">
            <OrganiserScopeManager />
          </TabsContent>
          <TabsContent value="data-management">
            <DataUploadTab />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="navigation">
              <NavigationVisibilityManager />
            </TabsContent>
          )}
        </Tabs>
        <InviteUserDialog open={open} onOpenChange={setOpen} onSuccess={() => {}} />
        {isAdmin && <AddressLookupDialog open={lookupOpen} onOpenChange={setLookupOpen} />}
        <AddDraftUserDialog open={addDraftOpen} onOpenChange={setAddDraftOpen} onSuccess={() => {}} />
      </div>
    </RoleGuard>
  )
}

function AdminHierarchyTab() {
  const { data: users = [] } = useQuery({
    queryKey: ["admin-hierarchy-users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, role")
        .order("full_name")
      if (error) throw error
      return data || []
    }
  })
  return <RoleHierarchyManager users={users as any} />
}

