"use client"
export const dynamic = 'force-dynamic'

import { PendingUsersTable } from "@/components/admin/PendingUsersTable"
import { InviteUserDialog } from "@/components/admin/InviteUserDialog"
import { AddDraftUserDialog } from "@/components/admin/AddDraftUserDialog"
import { useState } from "react"
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

export default function AdminPage() {
  const [open, setOpen] = useState(false)
  const [addDraftOpen, setAddDraftOpen] = useState(false)

  return (
    <RoleGuard allow={["admin"]}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Administration</h1>
          <Button onClick={() => setOpen(true)}>Invite User</Button>
        </div>
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="invites">Invites</TabsTrigger>
            <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
            <TabsTrigger value="patches">Patches</TabsTrigger>
            <TabsTrigger value="spatial">Spatial Assignment</TabsTrigger>
            <TabsTrigger value="scoping">Scoping</TabsTrigger>
          </TabsList>
          <TabsContent value="users">
            <UsersTable />
          </TabsContent>
          <TabsContent value="invites">
            <div className="flex items-center justify-between mb-2">
              <div />
              <Button variant="outline" onClick={() => setAddDraftOpen(true)}>Add draft organiser</Button>
            </div>
            <PendingUsersTable />
          </TabsContent>
          <TabsContent value="hierarchy">
            <AdminHierarchyTab />
          </TabsContent>
          <TabsContent value="patches">
            <PatchManager />
          </TabsContent>
          <TabsContent value="spatial">
            <SpatialAssignmentTool />
          </TabsContent>
          <TabsContent value="scoping">
            <OrganiserScopeManager />
          </TabsContent>
        </Tabs>
        <InviteUserDialog open={open} onOpenChange={setOpen} onSuccess={() => {}} />
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

