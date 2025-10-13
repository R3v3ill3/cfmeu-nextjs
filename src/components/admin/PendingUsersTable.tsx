import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Trash2, Pencil, UserCheck } from "lucide-react";
import EditPendingUserDialog from "@/components/admin/EditPendingUserDialog";
import ActivatePendingUserDialog from "@/components/admin/ActivatePendingUserDialog";
import { format } from "date-fns";
import { canActivatePendingUser } from "@/utils/emailConversion";

interface PendingUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  created_at: string;
  invited_at: string | null;
  assigned_patch_ids: string[];
}

export const PendingUsersTable = () => {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<PendingUser | null>(null);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activatingUser, setActivatingUser] = useState<PendingUser | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pending_users")
        .select("id,email,full_name,role,status,created_at,invited_at,assigned_patch_ids")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPending(data || []);
    } catch (err) {
      console.error("Failed to load pending users", err);
      toast({ title: "Error", description: "Failed to load draft users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sendInvite = async (row: PendingUser) => {
    setInvitingId(row.id);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: row.email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
          data: { role: row.role, full_name: row.full_name || row.email.split("@")[0] },
        },
      });
      if (otpError) throw otpError;

      await supabase
        .from("pending_users")
        .update({ status: "invited", invited_at: new Date().toISOString() })
        .eq("id", row.id);

      toast({ title: "Invitation sent", description: `Invitation sent to ${row.email}` });
      load();
    } catch (err: any) {
      console.error("Invite error", err);
      toast({ title: "Error", description: err.message || "Failed to send invite", variant: "destructive" });
    } finally {
      setInvitingId(null);
    }
  };

  const removeDraft = async (row: PendingUser) => {
    try {
      const { error } = await supabase.from("pending_users").delete().eq("id", row.id);
      if (error) throw error;
      toast({ title: "Draft removed", description: `${row.email} was removed.` });
      setPending((prev) => prev.filter((p) => p.id !== row.id));
    } catch (err: any) {
      console.error("Delete draft error", err);
      toast({ title: "Error", description: err.message || "Failed to remove draft", variant: "destructive" });
    }
  };

  const openEdit = (row: PendingUser) => {
    setEditingRow(row);
    setEditOpen(true);
  };

  const openActivate = (row: PendingUser) => {
    setActivatingUser(row);
    setActivateOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft Users</CardTitle>
        <CardDescription>Create and manage draft users before sending invitations.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <img src="/spinner.gif" alt="Loading" className="h-4 w-4" /> Loading drafts...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No draft users yet.
                  </TableCell>
                </TableRow>
              )}
              {pending.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.full_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={row.role === "admin" ? "destructive" : row.role === "viewer" ? "secondary" : "default"}>
                      {row.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === "draft" ? "secondary" : row.status === "invited" ? "default" : "outline"}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(row.created_at), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      {row.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </Button>
                      )}
                      {canActivatePendingUser(row.email, row.status) && (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => openActivate(row)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <UserCheck className="h-4 w-4 mr-2" /> Activate
                        </Button>
                      )}
                      <Button size="sm" onClick={() => sendInvite(row)} disabled={invitingId === row.id}>
                        {invitingId === row.id ? (
                          <>
                            <img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" /> Sending
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-2" /> Invite
                          </>
                        )}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => removeDraft(row)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <EditPendingUserDialog
          open={editOpen}
          onOpenChange={(o) => { setEditOpen(o); if (!o) setEditingRow(null) }}
          pendingUser={editingRow}
          onSaved={() => load()}
        />
        <ActivatePendingUserDialog
          open={activateOpen}
          onOpenChange={(o) => { setActivateOpen(o); if (!o) setActivatingUser(null) }}
          pendingUser={activatingUser}
          onSuccess={() => {
            load();
            toast({ 
              title: "Success", 
              description: "User successfully activated with all relationships migrated." 
            });
          }}
        />
      </CardContent>
    </Card>
  );
};
