"use client"
export const dynamic = 'force-dynamic'

import { PendingUsersTable } from "@/components/admin/PendingUsersTable"
import { InviteUserDialog } from "@/components/admin/InviteUserDialog"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import UsersTable from "@/components/admin/UsersTable"

export default function AdminPage() {
  const [open, setOpen] = useState(false)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <Button onClick={() => setOpen(true)}>Invite User</Button>
      </div>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTable />
        </TabsContent>
        <TabsContent value="invites">
          <PendingUsersTable />
        </TabsContent>
      </Tabs>
      <InviteUserDialog open={open} onOpenChange={setOpen} onSuccess={() => {}} />
    </div>
  )
}

