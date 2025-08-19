"use client"
export const dynamic = 'force-dynamic'

import { PendingUsersTable } from "@/components/admin/PendingUsersTable"
import { InviteUserDialog } from "@/components/admin/InviteUserDialog"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function AdminPage() {
  const [open, setOpen] = useState(false)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <Button onClick={() => setOpen(true)}>Invite User</Button>
      </div>
      <PendingUsersTable />
      <InviteUserDialog open={open} onOpenChange={setOpen} onSuccess={() => {}} />
    </div>
  )
}

