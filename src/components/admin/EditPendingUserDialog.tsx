import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Pencil } from "lucide-react";

interface EditPendingUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingUser: { id: string; email: string; full_name: string | null; role: string; status: string } | null;
  onSaved: () => void;
}

export default function EditPendingUserDialog({ open, onOpenChange, pendingUser, onSaved }: EditPendingUserDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("organiser");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pendingUser) {
      setEmail(pendingUser.email || "");
      setFullName(pendingUser.full_name || "");
      setRole(pendingUser.role || "organiser");
    }
  }, [pendingUser]);

  const handleSave = async () => {
    if (!pendingUser) return;
    if (pendingUser.status !== "draft") {
      toast({ title: "Not editable", description: "Only draft users can be edited", variant: "destructive" });
      return;
    }
    const emailLower = (email || "").trim().toLowerCase();
    if (!emailLower) {
      toast({ title: "Missing email", description: "Email is required" , variant: "destructive"});
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("pending_users")
        .update({ email: emailLower, full_name: fullName || null, role })
        .eq("id", pendingUser.id)
        .eq("status", "draft");
      if (error) throw error;
      toast({ title: "Saved", description: "Draft user updated" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message || "Failed to save", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit Draft User
          </DialogTitle>
          <DialogDescription>Update email, name and role for a draft user.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="organiser">Organiser</SelectItem>
                <SelectItem value="lead_organiser">Lead Organiser</SelectItem>
                <SelectItem value="delegate">Delegate</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || !pendingUser || pendingUser.status !== "draft"}>
            {loading ? (<><img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" />Saving...</>) : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}