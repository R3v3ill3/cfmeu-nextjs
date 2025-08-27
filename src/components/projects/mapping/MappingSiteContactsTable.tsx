"use client"

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type RoleKey = "project_manager" | "site_manager" | "site_delegate" | "site_hsr";

const ROLE_LABELS: Record<RoleKey, string> = {
  project_manager: "Project Manager",
  site_manager: "Site Manager",
  site_delegate: "Site Delegate",
  site_hsr: "Site HSR",
};

type ContactRow = {
  id?: string;
  role: RoleKey;
  name: string;
  email: string;
  phone: string;
};

export function MappingSiteContactsTable({ projectId, mainSiteId }: { projectId: string; mainSiteId: string | null }) {
  const fixedRoles: RoleKey[] = ["project_manager", "site_manager", "site_delegate", "site_hsr"];
  const [rows, setRows] = useState<Record<RoleKey, ContactRow>>({
    project_manager: { role: "project_manager", name: "", email: "", phone: "" },
    site_manager: { role: "site_manager", name: "", email: "", phone: "" },
    site_delegate: { role: "site_delegate", name: "", email: "", phone: "" },
    site_hsr: { role: "site_hsr", name: "", email: "", phone: "" },
  });
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!mainSiteId) return;
      const { data, error } = await supabase
        .from("site_contacts")
        .select("id, role, name, email, phone")
        .eq("job_site_id", mainSiteId);
      if (error) { toast.error(error.message); return; }
      const map = { ...rows } as Record<RoleKey, ContactRow>;
      (data || []).forEach((r: any) => {
        const key = r.role as RoleKey;
        if (fixedRoles.includes(key)) {
          map[key] = {
            id: r.id as string,
            role: key,
            name: r.name || "",
            email: r.email || "",
            phone: r.phone || "",
          };
        }
      });
      setRows(map);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, mainSiteId]);

  const persist = async (role: RoleKey, patch: Partial<ContactRow>) => {
    if (!mainSiteId) return;
    setSaving(true);
    try {
      const current = rows[role];
      const payload = {
        job_site_id: mainSiteId,
        role,
        name: (patch.name ?? current.name).trim(),
        email: (patch.email ?? current.email) || null,
        phone: (patch.phone ?? current.phone) || null,
      } as any;
      if (current.id) {
        const { error } = await supabase.from("site_contacts").update(payload).eq("id", current.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("site_contacts").insert(payload).select("id").single();
        if (error) throw error;
        rows[role].id = (data as any).id as string;
        setRows({ ...rows });
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed saving contact");
    } finally {
      setSaving(false);
    }
  };

  const scheduleSave = (role: RoleKey, patch: Partial<ContactRow>) => {
    setRows((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(role, patch), 500);
  };

  const emailInvalid = (val: string) => val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  return (
    <div className="mt-4">
      <div className="font-semibold mb-2 uppercase tracking-wide text-sm">Site Contacts</div>
      <div className="overflow-x-auto">
        <Table className="print-table print-border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Role</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-64">Email</TableHead>
              <TableHead className="w-40">Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fixedRoles.map((rk) => {
              const r = rows[rk];
              return (
                <TableRow key={rk}>
                  <TableCell>{ROLE_LABELS[rk]}</TableCell>
                  <TableCell>
                    <Input
                      value={r?.name || ""}
                      onChange={(e) => scheduleSave(rk, { name: e.target.value })}
                      placeholder="Full name"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="email"
                      className={emailInvalid(r?.email || "") ? "border-red-500" : ""}
                      value={r?.email || ""}
                      onChange={(e) => scheduleSave(rk, { email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={r?.phone || ""}
                      onChange={(e) => scheduleSave(rk, { phone: e.target.value })}
                      placeholder="Phone"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground mt-2" aria-live="polite">{saving ? "Saving…" : "All changes saved"}</div>
    </div>
  );
}

