import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Loader2 } from "lucide-react";

interface AddDraftUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddDraftUserDialog = ({ open, onOpenChange, onSuccess }: AddDraftUserDialogProps) => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("viewer");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const inferDefaultEmail = (name: string): string => {
    const parts = String(name || '').trim().split(/\s+/)
    if (parts.length === 0) return ''
    const first = parts[0] || ''
    const last = parts[parts.length - 1] || ''
    const local = `${first.slice(0,1)}${last}`.toLowerCase().replace(/[^a-z0-9]/g, '')
    return local ? `${local}@testing.org` : ''
  }

  const handleAdd = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: me } = await supabase.auth.getUser();
      const createdBy = me.user?.id ?? null;

      const { error } = await supabase.from("pending_users" as any).insert({
        email: email || inferDefaultEmail(fullName),
        full_name: fullName || (email ? email.split("@")[0] : ""),
        role,
        notes: notes || null,
        status: "draft",
        created_by: createdBy,
      });

      if (error) throw error;

      toast({ title: "Draft created", description: `Saved ${email} as a draft user.` });
      setEmail("");
      setFullName("");
      setRole("viewer");
      setNotes("");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("Error adding draft user:", err);
      toast({ title: "Error", description: err.message || "Failed to create draft", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Draft User
          </DialogTitle>
          <DialogDescription>Pre-create a user to configure before inviting them.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Full name (optional)"
              value={fullName}
              onChange={(e) => {
                const v = e.target.value
                setFullName(v)
                // If email not manually set, derive default from name
                if (!email || email === inferDefaultEmail(fullName)) {
                  setEmail(inferDefaultEmail(v))
                }
              }}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Initial Role</Label>
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

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Internal notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Save Draft
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
