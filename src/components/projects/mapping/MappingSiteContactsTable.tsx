"use client"

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Edit, UserCheck, Users, Mail, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { DelegateRegistrationDialog } from "./DelegateRegistrationDialog";
import { PhoneLink, EmailLink, ContactActions } from "@/components/ui/ContactActions";
import { useIsMobile } from "@/hooks/use-mobile";

type RoleKey = "project_manager" | "site_manager" | "site_delegate" | "site_hsr";

const ROLE_LABELS: Record<RoleKey, string> = {
  project_manager: "Project Manager",
  site_manager: "Site Manager",
  site_delegate: "Site Delegate",
  site_hsr: "Site HSR",
};

// Shorter labels for mobile
const ROLE_LABELS_SHORT: Record<RoleKey, string> = {
  project_manager: "PM",
  site_manager: "Site Mgr",
  site_delegate: "Delegate",
  site_hsr: "HSR",
};

type ContactRow = {
  id?: string;
  role: RoleKey;
  name: string;
  email: string;
  phone: string;
};

export function MappingSiteContactsTable({ projectId, mainSiteId }: { projectId: string; mainSiteId: string | null }) {
  const isMobile = useIsMobile();
  const fixedRoles: RoleKey[] = ["project_manager", "site_manager", "site_delegate", "site_hsr"];
  const [rows, setRows] = useState<Record<RoleKey, ContactRow>>({
    project_manager: { role: "project_manager", name: "", email: "", phone: "" },
    site_manager: { role: "site_manager", name: "", email: "", phone: "" },
    site_delegate: { role: "site_delegate", name: "", email: "", phone: "" },
    site_hsr: { role: "site_hsr", name: "", email: "", phone: "" },
  });
  const [saving, setSaving] = useState(false);
  const [showDelegateDialog, setShowDelegateDialog] = useState(false);
  const [delegateDialogMode, setDelegateDialogMode] = useState<'add' | 'change' | 'additional' | 'register'>('add');
  const [selectedRole, setSelectedRole] = useState<'site_delegate' | 'site_hsr'>('site_delegate');
  const [expandedRoles, setExpandedRoles] = useState<Set<RoleKey>>(new Set());
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

  const handleRepresentativeAction = (role: 'site_delegate' | 'site_hsr', mode: 'add' | 'change' | 'additional' | 'register') => {
    setSelectedRole(role);
    setDelegateDialogMode(mode);
    setShowDelegateDialog(true);
  };

  const toggleExpanded = (role: RoleKey) => {
    setExpandedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const getRepresentativeButtons = (role: RoleKey, compact = false) => {
    if (role !== 'site_delegate' && role !== 'site_hsr') return null;

    const hasData = rows[role]?.name?.trim();

    if (compact) {
      return (
        <div className="flex gap-1 flex-wrap">
          {!hasData ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRepresentativeAction(role, 'add')}
              className="text-xs min-h-[44px]"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRepresentativeAction(role, 'change')}
                className="text-xs min-h-[44px] px-2"
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRepresentativeAction(role, 'register')}
                className="text-xs min-h-[44px] px-2"
              >
                <UserCheck className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="flex gap-1 mt-1">
        {!hasData ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRepresentativeAction(role, 'add')}
            className="text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Representative
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRepresentativeAction(role, 'additional')}
              className="text-xs"
            >
              <Users className="w-3 h-3 mr-1" />
              Add Additional
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRepresentativeAction(role, 'change')}
              className="text-xs"
            >
              <Edit className="w-3 h-3 mr-1" />
              Change
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRepresentativeAction(role, 'register')}
              className="text-xs"
            >
              <UserCheck className="w-3 h-3 mr-1" />
              Register
            </Button>
          </>
        )}
      </div>
    );
  };

  // Mobile card-based layout
  const renderMobileView = () => (
    <div className="space-y-2">
      {fixedRoles.map((rk) => {
        const r = rows[rk];
        const hasEmail = !!r?.email?.trim();
        const hasPhone = !!r?.phone?.trim();
        const isExpanded = expandedRoles.has(rk);
        const isDelegateOrHsr = rk === 'site_delegate' || rk === 'site_hsr';

        return (
          <Card key={rk} className="border">
            <CardContent className="p-3">
              {/* Row 1: Role label + Name input (full width) */}
              <div className="flex items-center gap-2">
                {/* Role label */}
                <div className="text-xs font-medium text-muted-foreground w-16 flex-shrink-0">
                  {ROLE_LABELS_SHORT[rk]}
                </div>

                {/* Name input - takes remaining space */}
                <Input
                  value={r?.name || ""}
                  onChange={(e) => scheduleSave(rk, { name: e.target.value })}
                  placeholder="Enter name"
                  className="flex-1 h-11 text-base"
                />
              </div>

              {/* Row 2: Email/Phone icons + Actions */}
              <div className="mt-2 flex items-center gap-1 flex-wrap">
                {/* Email icon */}
                <button
                  onClick={() => {
                    if (hasEmail) {
                      window.location.href = `mailto:${r.email}`;
                    } else {
                      toggleExpanded(rk);
                    }
                  }}
                  className={`p-2 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center ${hasEmail
                    ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}
                  title={hasEmail ? `Email: ${r.email}` : 'Add email'}
                >
                  <Mail className="w-5 h-5" />
                </button>

                {/* Phone icon */}
                <button
                  onClick={() => {
                    if (hasPhone) {
                      window.location.href = `tel:${r.phone}`;
                    } else {
                      toggleExpanded(rk);
                    }
                  }}
                  className={`p-2 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center ${hasPhone
                    ? 'bg-green-50 text-green-600 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}
                  title={hasPhone ? `Phone: ${r.phone}` : 'Add phone'}
                >
                  <Phone className="w-5 h-5" />
                </button>

                {/* Expand toggle for non-delegate roles */}
                {!isDelegateOrHsr && (
                  <button
                    onClick={() => toggleExpanded(rk)}
                    className="p-2 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:bg-gray-100"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}

                {/* Action buttons for delegate/HSR */}
                {isDelegateOrHsr && (
                  <>
                    {!r?.name?.trim() ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRepresentativeAction(rk, 'add')}
                        className="text-xs min-h-[44px] ml-1"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add {rk === 'site_delegate' ? 'Delegate' : 'HSR'}
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRepresentativeAction(rk, 'additional')}
                          className="text-xs min-h-[44px] ml-1"
                        >
                          <Users className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRepresentativeAction(rk, 'change')}
                          className="text-xs min-h-[44px]"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Change
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRepresentativeAction(rk, 'register')}
                          className="text-xs min-h-[44px]"
                        >
                          <UserCheck className="w-3 h-3 mr-1" />
                          Register
                        </Button>
                      </>
                    )}
                    {/* Expand toggle for delegate/HSR */}
                    <button
                      onClick={() => toggleExpanded(rk)}
                      className="p-2 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:bg-gray-100 ml-auto"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>

              {/* Expanded section for email/phone entry */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Email</label>
                    <Input
                      type="email"
                      className={`h-11 text-base ${emailInvalid(r?.email || "") ? "border-red-500" : ""}`}
                      value={r?.email || ""}
                      onChange={(e) => scheduleSave(rk, { email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Phone</label>
                    <Input
                      value={r?.phone || ""}
                      onChange={(e) => scheduleSave(rk, { phone: e.target.value })}
                      placeholder="Phone number"
                      className="h-11 text-base"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  // Desktop table layout
  const renderDesktopView = () => (
    <div className="overflow-x-auto">
      <Table className="print-table print-border">
        <TableHeader>
          <TableRow>
            <TableHead className="w-48">Role</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-64">Email</TableHead>
            <TableHead className="w-40">Phone</TableHead>
            <TableHead className="w-48">Actions</TableHead>
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
                <TableCell>
                  {getRepresentativeButtons(rk)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="mt-4 max-w-full">
      <div className="font-semibold mb-2 uppercase tracking-wide text-sm">Site Contacts</div>
      {isMobile ? renderMobileView() : renderDesktopView()}

      {showDelegateDialog && (
        <DelegateRegistrationDialog
          projectId={projectId}
          mainSiteId={mainSiteId}
          role={selectedRole}
          mode={delegateDialogMode}
          onClose={() => setShowDelegateDialog(false)}
          onSuccess={() => {
            setShowDelegateDialog(false);
            // Refresh the contacts data
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

