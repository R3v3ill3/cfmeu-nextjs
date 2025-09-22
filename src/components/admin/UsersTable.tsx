"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type Profile = { id: string; email: string | null; full_name: string | null; role: string | null; is_active: boolean | null }

const ROLES = ["admin", "lead_organiser", "organiser", "delegate", "viewer"]

export function UsersTable() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data: users = [], isFetching } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, email, full_name, role, is_active")
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => u.email && resetPassword.mutate({ email: u.email })}
                      disabled={!u.email || resetPassword.isPending}
                    >
                      {resetPassword.isPending ? "Sending..." : "Reset Password"}
                    </Button>
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
    </Card>
  )
}

export default UsersTable

