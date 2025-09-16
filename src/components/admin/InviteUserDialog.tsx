import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail } from "lucide-react";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const InviteUserDialog = ({ open, onOpenChange, onSuccess }: InviteUserDialogProps) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const emailLower = email.trim().toLowerCase();
      const redirectUrl = `${window.location.origin}/`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: emailLower,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
          data: { role },
        },
      });

      if (otpError) throw otpError;

      // Try to find an existing pending row (store emails in lower-case to align with unique index)
      const { data: existing, error: selErr } = await supabase
        .from("pending_users")
        .select("id")
        .eq("email", emailLower)
        .eq("role", role)
        .limit(1);
      if (selErr) throw selErr;

      if (existing && existing.length > 0) {
        const { error: updErr } = await supabase
          .from("pending_users")
          .update({ status: "invited", invited_at: new Date().toISOString() })
          .eq("id", existing[0].id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("pending_users")
          .insert({
            email: emailLower,
            full_name: emailLower.split('@')[0],
            role,
            status: "invited",
            invited_at: new Date().toISOString(),
          } as any);
        if (insErr) throw insErr;
      }

      toast({ title: "Success", description: `Invitation sent to ${emailLower}` });

      setEmail("");
      setRole("viewer");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast({ title: "Error", description: error.message || "Failed to send invitation", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite New User
          </DialogTitle>
          <DialogDescription>
            Send an email invitation to a new user with the specified role.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
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
                <SelectItem value="lead_organiser">Co-ordinator</SelectItem>
                <SelectItem value="delegate">Delegate</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleInvite} disabled={loading}>
            {loading ? (<><img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" />Sending...</>) : (<><Mail className="h-4 w-4 mr-2" />Send Invitation</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}