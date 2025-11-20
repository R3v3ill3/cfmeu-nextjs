"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { isTestingEmail } from "@/utils/emailConversion"
import { Shield, Key, Copy, CheckCircle2, Edit } from "lucide-react"
import EditUserDialog from "@/components/admin/EditUserDialog"

type Profile = { id: string; email: string | null; full_name: string | null; role: string | null; is_active: boolean | null; apple_email?: string | null; phone?: string | null }

const ROLES = ["admin", "lead_organiser", "organiser", "delegate", "viewer"]

export function UsersTable() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const { data: users = [], isFetching } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, email, full_name, role, is_active, apple_email, phone")
        .order("full_name")
      if (error) throw error
      return data || []
    }
  })

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ role })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: "Role updated" })
      qc.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (e) => toast({ title: "Failed to update role", description: (e as Error).message, variant: "destructive" })
  })

  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const resetPassword = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      toast({ 
        title: "Password reset sent", 
        description: `Password reset email sent to ${variables.email}` 
      })
    },
    onError: (e) => toast({ 
      title: "Failed to send password reset", 
      description: (e as Error).message, 
      variant: "destructive" 
    })
  })

  const resetTestingPassword = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const response = await fetch('/api/admin/reset-testing-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to reset password')
      }

      return result.data
    },
    onSuccess: (data) => {
      setNewPassword(data.new_password)
      setResetDialogOpen(true)
      toast({
        title: "Password reset successful",
        description: "New password generated. It will be displayed in the dialog."
      })
    },
    onError: (e) => {
      toast({
        title: "Failed to reset password",
        description: (e as Error).message,
        variant: "destructive"
      })
    }
  })

  const handleResetTestingPassword = (email: string) => {
    setResetEmail(email)
    setNewPassword(null)
    resetTestingPassword.mutate({ email })
  }

  const copyPassword = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: "Password copied",
        description: "Password copied to clipboard"
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Manage user roles and activation.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users as Profile[]).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name || "—"}</TableCell>
                  <TableCell>{u.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "outline"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={u.role || "viewer"} onValueChange={(v: string) => updateRole.mutate({ id: u.id, role: v })}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r} value={r}>{r.replaceAll("_"," ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingUser(u)
                          setEditDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      {u.email && isTestingEmail(u.email) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetTestingPassword(u.email!)}
                          disabled={resetTestingPassword.isPending}
                        >
                          <Key className="h-4 w-4 mr-2" />
                          {resetTestingPassword.isPending ? "Resetting..." : "Reset Password"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => u.email && resetPassword.mutate({ email: u.email })}
                          disabled={!u.email || resetPassword.isPending}
                        >
                          {resetPassword.isPending ? "Sending..." : "Reset Password"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && !isFetching && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No users found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Password Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Testing Password Reset</DialogTitle>
            <DialogDescription>
              A new password has been generated for this testing account.
            </DialogDescription>
          </DialogHeader>
          
          {newPassword && (
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800">New Login Credentials</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Email:</span> {resetEmail}
                  </div>
                  <div>
                    <span className="font-medium">New Password:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-white px-3 py-2 rounded border border-blue-300 font-mono text-blue-800 flex-1">
                        {newPassword}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyPassword}
                        className="shrink-0"
                      >
                        {copied ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="text-blue-700 mt-3 text-xs">
                    <strong>Important:</strong> Share this password securely with the user. They can login immediately with these credentials.
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setResetDialogOpen(false)} className="w-full">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSaved={(updated) => {
            qc.invalidateQueries({ queryKey: ["admin-users"] })
            setEditingUser(null)
          }}
        />
      )}
    </Card>
  )
}

export default UsersTable

