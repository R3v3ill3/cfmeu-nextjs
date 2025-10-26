
;
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ROLE_OPTIONS, AppRole } from "@/constants/roles";

type ProfileEditable = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  role?: AppRole | string | null;
  is_active?: boolean | null;
};

type EditUserDialogProps = {
  user: ProfileEditable;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: ProfileEditable) => void;
};

const fieldContainer = "flex flex-col gap-2";
const fieldRow = "flex items-center justify-between gap-3";
const fieldLabel = "text-sm font-medium";
const fieldControl = "flex-1";

export default function EditUserDialog({ user, open, onOpenChange, onSaved }: EditUserDialogProps) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState<AppRole | string>((user.role as AppRole) ?? "viewer");
  const [active, setActive] = useState<boolean>(user.is_active ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Refresh form when a different user is provided
    setFullName(user.full_name ?? "");
    setPhone(user.phone ?? "");
    setRole((user.role as AppRole) ?? "viewer");
    setActive(user.is_active ?? true);
  }, [user]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      console.log("[EditUserDialog] Updating user profile", { id: user.id, fullName, phone, role, active });
      const { data, error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          role: role as AppRole,
          is_active: active,
        })
        .eq("id", user.id)
        .select("*")
        .single();

      if (error) {
        console.error("[EditUserDialog] Update error", error);
        toast({ title: "Failed to save user details", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "User updated", description: "The user details were saved successfully." });
      onSaved?.({
        ...user,
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
        is_active: data.is_active,
      });
      onOpenChange(false);
    } catch (e: any) {
      console.error("[EditUserDialog] Unexpected error", e);
      toast({ title: "Failed to save user details", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update contact details and role for this user.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className={fieldContainer}>
            <Label className={fieldLabel} htmlFor="email">Email</Label>
            <Input id="email" value={user.email ?? ""} readOnly className="bg-muted/40" />
          </div>

          <div className={fieldContainer}>
            <Label className={fieldLabel} htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className={fieldContainer}>
            <Label className={fieldLabel} htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className={fieldContainer}>
            <Label className={fieldLabel}>Role</Label>
            <Select value={role as string} onValueChange={(v: string) => setRole(v as AppRole)}>
              <SelectTrigger className={fieldControl}>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={fieldRow}>
            <Label className={fieldLabel} htmlFor="active">Active</Label>
            <Switch id="active" checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
