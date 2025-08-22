import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Loader2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { WorkerDetailModal } from "@/components/workers/WorkerDetailModal";
import { UnionRoleAssignmentModal } from "@/components/workers/UnionRoleAssignmentModal";
import { AssignWorkersModal } from "./AssignWorkersModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getWorkerColorCoding } from "@/utils/workerColorCoding";

import { QuickAddWorkerModal } from "@/components/workers/QuickAddWorkerModal";

interface EmployerWorkerChartProps {
  isOpen: boolean;
  onClose: () => void;
  employerId: string | null;
  employerName?: string;
  projectIds?: string[];
  siteIds?: string[];
  contextSiteId?: string | null;
  siteOptions?: Array<{ id: string; name: string }>;
}

interface WorkerLite {
  id: string;
  first_name: string | null;
  surname: string | null;
  union_membership_status: string | null;
}

interface WorkerRoleLite {
  name: string;
  is_senior: boolean | null;
  gets_paid_time: boolean | null;
}

export const EmployerWorkerChart = ({
  isOpen,
  onClose,
  employerId,
  employerName,
  projectIds = [],
  siteIds = [],
  contextSiteId = null,
  siteOptions = [],
}: EmployerWorkerChartProps) => {
  const qc = useQueryClient();
  const [detailWorkerId, setDetailWorkerId] = useState<string | null>(null);
  const [showRole, setShowRole] = useState(false);
  const [roleWorkerId, setRoleWorkerId] = useState<string>("");
  const [showAssign, setShowAssign] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [autoAdjustedMsg, setAutoAdjustedMsg] = useState<string | null>(null);

  const filters = useMemo(() => ({ employerId, projectIds, siteIds, contextSiteId }), [employerId, projectIds, siteIds, contextSiteId]);

  const [membershipFilter, setMembershipFilter] = useState<"all" | "member" | "potential" | "non_member" | "declined">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"membership" | "activity" | "dd_status">("membership");

  const { data, isLoading } = useQuery({
    queryKey: ["employer-worker-chart", filters],
    enabled: isOpen && !!employerId,
    queryFn: async () => {
      if (!employerId) return { workers: [] as WorkerLite[], roles: {} as Record<string, WorkerRoleLite[]>, ratings: {} as Record<string, any[]> };

      // 1) Which workers are on these projects/sites for this employer?
      let vpw = supabase
        .from("v_project_workers")
        .select("worker_id, employer_id, job_site_id, project_id")
        .eq("employer_id", employerId);

      if (siteIds && siteIds.length > 0) {
        vpw = vpw.in("job_site_id", siteIds);
      } else if (projectIds && projectIds.length > 0) {
        vpw = vpw.in("project_id", projectIds);
      }

      const { data: vWorkers, error: vErr } = await vpw;
      if (vErr) throw vErr;
      const workerIds = Array.from(new Set((vWorkers || []).map((v: any) => v.worker_id).filter(Boolean)));

      if (workerIds.length === 0) {
        return { workers: [] as WorkerLite[], roles: {}, ratings: {} } as any;
      }

      // 2) Basic worker details
      const { data: wRows, error: wErr } = await supabase
        .from("workers")
        .select("id, first_name, surname, union_membership_status")
        .in("id", workerIds);
      if (wErr) throw wErr;

      // 3) Current union roles (with details)
      const today = new Date().toISOString().slice(0, 10);
      const { data: roleRows, error: rErr } = await supabase
        .from("union_roles")
        .select("worker_id, name, end_date, is_senior, gets_paid_time")
        .in("worker_id", workerIds)
        .or(`end_date.is.null,end_date.gte.${today}`);
      if (rErr) throw rErr;
      const roles: Record<string, WorkerRoleLite[]> = {};
      (roleRows || []).forEach((r: any) => {
        if (!roles[r.worker_id]) roles[r.worker_id] = [];
        roles[r.worker_id].push({ name: r.name, is_senior: r.is_senior, gets_paid_time: r.gets_paid_time });
      });

      // 4) Recent ratings (limit overall to keep light)
      const { data: ratingRows, error: ratErr } = await supabase
        .from("worker_activity_ratings")
        .select("worker_id, rating_type, rating_value, created_at")
        .in("worker_id", workerIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (ratErr) throw ratErr;
      const ratings: Record<string, any[]> = {};
      (ratingRows || []).forEach((r: any) => {
        if (!ratings[r.worker_id]) ratings[r.worker_id] = [];
        if (ratings[r.worker_id].length < 5) ratings[r.worker_id].push(r);
      });

      // 5) Membership dues status for DD sorting
      const { data: duesRows } = await supabase
        .from("worker_memberships")
        .select("worker_id, dd_status")
        .in("worker_id", workerIds);
      const dues: Record<string, string> = {};
      (duesRows || []).forEach((r: any) => { if (r.worker_id) dues[r.worker_id] = r.dd_status });

      // 6) Estimated counts: prefer employer+project, else employer
      let estimated: number | null = null;
      let estimatedScope: "project" | "employer" | null = null;
      if (projectIds && projectIds.length > 0) {
        const { data: pctRows } = await (supabase as any)
          .from("project_contractor_trades")
          .select("estimated_project_workforce, project_id")
          .eq("employer_id", employerId)
          .in("project_id", projectIds)
        const vals = ((pctRows || []) as any[])
          .map(r => Number(r.estimated_project_workforce) || 0)
          .filter(v => Number.isFinite(v) && v > 0)
        if (vals.length > 0) {
          estimated = Math.max(...vals)
          estimatedScope = "project"
        }
      }
      if (estimated == null) {
        const { data: empRow } = await (supabase as any)
          .from("employers")
          .select("estimated_worker_count")
          .eq("id", employerId)
          .maybeSingle()
        const v = Number((empRow as any)?.estimated_worker_count)
        if (Number.isFinite(v) && v > 0) {
          estimated = v
          estimatedScope = "employer"
        }
      }

      return { workers: wRows || [], roles, ratings, dues, estimated, estimatedScope } as any;
    },
  });

  const qcInvalidate = () => {
    qc.invalidateQueries({ queryKey: ["employer-worker-chart"] })
  }

  useEffect(() => {
    if (!data) return
    const actual = (data.workers || []).length
    const est = (data as any).estimated as number | null
    const scope = (data as any).estimatedScope as "project" | "employer" | null
    if (est != null && actual > est) {
      const adjust = async () => {
        try {
          if (scope === "project" && projectIds && projectIds.length > 0) {
            await (supabase as any)
              .from("project_contractor_trades")
              .update({ estimated_project_workforce: actual })
              .eq("employer_id", employerId)
              .in("project_id", projectIds)
          } else if (scope === "employer") {
            await (supabase as any)
              .from("employers")
              .update({ estimated_worker_count: actual })
              .eq("id", employerId)
          }
          setAutoAdjustedMsg(`Estimate adjusted to ${actual} to match assigned workers`)
          qcInvalidate()
        } catch (e) {
          console.error(e)
        }
      }
      adjust()
    } else {
      setAutoAdjustedMsg(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify({ count: data?.workers?.length || 0, est: (data as any)?.estimated || null, scope: (data as any)?.estimatedScope || null })])

  const endPlacements = async (where: Record<string, any>) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("worker_placements")
      .update({ end_date: today })
      .match({ ...where })
      .is("end_date", null);
    if (error) throw error;
  };

  const removeFromEmployer = async (workerId: string) => {
    try {
      await endPlacements({ employer_id: employerId, worker_id: workerId });
      toast.success("Removed from employer");
      qc.invalidateQueries({ queryKey: ["employer-worker-chart"] });
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove from employer");
    }
  };

  const removeFromProject = async (workerId: string) => {
    try {
      if (!siteIds || siteIds.length === 0) return;
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("worker_placements")
        .update({ end_date: today })
        .eq("worker_id", workerId)
        .eq("employer_id", employerId)
        .in("job_site_id", siteIds)
        .is("end_date", null);
      if (error) throw error;
      toast.success("Removed from project");
      qc.invalidateQueries({ queryKey: ["employer-worker-chart"] });
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove from project");
    }
  };

  const removeFromSite = async (workerId: string) => {
    try {
      if (!contextSiteId) return;
      await endPlacements({ worker_id: workerId, employer_id: employerId, job_site_id: contextSiteId });
      toast.success("Removed from site");
      qc.invalidateQueries({ queryKey: ["employer-worker-chart"] });
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove from site");
    }
  };

  const roleOptions = useMemo(() => {
    const present = new Set<string>();
    const rolesMap = (data?.roles || {}) as Record<string, WorkerRoleLite[]>;
    Object.values(rolesMap).forEach((roleArr) => {
      roleArr.forEach((r) => {
        if (r && typeof r.name === "string") present.add(r.name);
      });
    });
    return Array.from(present).sort();
  }, [data]);

  const formatName = (w: WorkerLite) => `${w.first_name ?? ""} ${w.surname ?? ""}`.trim() || "Unnamed";
  const membershipBadge = (status: string | null) => {
    const info = getWorkerColorCoding(status || null);
    return (
      <Badge className={`${info.badgeClass} ${info.textColor} border`} style={{ ...info.badgeStyle, ...info.borderStyle }}>
        {status ? status.split("_").join(" ") : "unknown"}
      </Badge>
    );
  };

const roleBadge = (role: WorkerRoleLite) => (
  <Badge key={role.name} variant="secondary">
    {role.name.split("_").join(" ")}
    {role.is_senior ? " (Senior)" : ""}
    {role.gets_paid_time ? " • Paid time" : ""}
  </Badge>
);

  const filteredSortedWorkers = useMemo(() => {
    if (!data) return [] as WorkerLite[];
    const rolesMap = (data.roles || {}) as Record<string, WorkerRoleLite[]>;
    const duesMap = (data as any).dues as Record<string, string> | undefined;

    const matchesMembership = (w: WorkerLite) =>
      membershipFilter === "all" || (w.union_membership_status as any) === membershipFilter;

    const matchesRole = (w: WorkerLite) => {
      if (roleFilter === "all") return true;
      const workerRoles = rolesMap[w.id] || [];
      return workerRoles.some((r) => r.name === roleFilter);
    };

    const hasAdditionalRole = (w: WorkerLite) => {
      const workerRoles = rolesMap[w.id] || [];
      return workerRoles.some((r) => r.name !== "member");
    };

    const membershipPriority: Record<string, number> = {
      member: 0,
      potential: 1,
      non_member: 2,
      declined: 3,
    } as const as any;

    const ddPriority: Record<string, number> = { active: 0, in_progress: 1, not_started: 2, failed: 3 } as const as any;
    const activityScore = (w: WorkerLite): number => {
      const list = (data.ratings || ({} as any))[w.id] as any[] | undefined;
      if (!list || list.length === 0) return Number.POSITIVE_INFINITY; // lowest activity last
      // newer activity first: earlier date -> lower score
      return 0 - new Date(list[0].created_at).getTime();
    };
    const toPriorityTuple = (w: WorkerLite): [number, number, number, string] => {
      const p0 = hasAdditionalRole(w) ? 0 : 1;
      const pName = formatName(w).toLowerCase();
      if (sortBy === "membership") {
        const p1 = membershipPriority[w.union_membership_status || "zzz"] ?? 4;
        return [p0, p1, 0, pName];
      }
      if (sortBy === "activity") {
        const p1 = activityScore(w);
        return [p0, p1, 0, pName];
      }
      // dd_status
      const status = duesMap?.[w.id] || "zzz";
      const p1 = ddPriority[status] ?? 5;
      return [p0, p1, 0, pName];
    };

    return (data.workers as WorkerLite[])
      .filter((w) => matchesMembership(w) && matchesRole(w))
      .sort((a, b) => {
        const ta = toPriorityTuple(a);
        const tb = toPriorityTuple(b);
        for (let i = 0; i < 3; i++) {
          if (ta[i] !== tb[i]) return ta[i] < tb[i] ? -1 : 1;
        }
        return ta[3] < tb[3] ? -1 : ta[3] > tb[3] ? 1 : 0;
      });
  }, [data, membershipFilter, roleFilter, sortBy]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Workers at {employerName || "Employer"}</span>
            <div className="flex items-center gap-2">
              {siteOptions && siteOptions.length > 0 && (
                <Button onClick={() => setShowAssign(true)}>Assign Workers</Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Filters and sort controls */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Filter by union membership</div>
            <Select value={membershipFilter} onValueChange={(v: string) => setMembershipFilter(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="potential">Potential</SelectItem>
                <SelectItem value="non_member">Non-member</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Filter by union role</div>
            <Select value={roleFilter} onValueChange={(v: string) => setRoleFilter(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>{r.split("_").join(" ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Sort by</div>
            <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="membership">Membership status</SelectItem>
                <SelectItem value="activity">Activity rating</SelectItem>
                <SelectItem value="dd_status">DD status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading workers…</div>
        ) : data && data.workers.length > 0 ? (

          <>

            {autoAdjustedMsg && (
              <div className="mb-3 text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300/50">
                {autoAdjustedMsg}
              </div>
            )}
            {/* Legend removed as per design: colours are self-evident with labels */}


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredSortedWorkers.map((w) => {
                const workerRoles = (data.roles[w.id] || []) as WorkerRoleLite[];
                const roleNames = workerRoles.map(r => r.name);
                const colorInfo = getWorkerColorCoding(w.union_membership_status || null, roleNames);
                return (
                  <Card key={w.id} className={`p-3 border ${colorInfo.bgFadedClass}`} style={colorInfo.bgStyle}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{formatName(w)}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {membershipBadge(w.union_membership_status)}
                          {workerRoles.map((r) => roleBadge(r))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full mt-1 ${colorInfo.indicatorClass}`} style={colorInfo.indicatorStyle} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailWorkerId(w.id)}>View details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setRoleWorkerId(w.id); setShowRole(true); }}>Assign union role</DropdownMenuItem>
                            {siteIds && siteIds.length > 0 && (
                              <DropdownMenuItem onClick={() => removeFromProject(w.id)}>Remove from project</DropdownMenuItem>
                            )}
                            {contextSiteId && (
                              <DropdownMenuItem onClick={() => removeFromSite(w.id)}>Remove from site</DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => removeFromEmployer(w.id)}>Remove from employer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {(() => {
                const actual = filteredSortedWorkers.length
                const est = (data as any).estimated as number | null
                const placeholders = est && est > actual ? est - actual : 0
                if (placeholders <= 0) return null
                return Array.from({ length: placeholders }).map((_, idx) => (
                  <Card key={`unknown-${idx}`} className="p-3 border border-dashed cursor-pointer hover:bg-muted/50" onClick={() => setShowQuickAdd(true)}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">Unknown worker</div>
                        <div className="mt-1 text-xs text-muted-foreground">Click to add details</div>
                        <div className="mt-1">
                          <Badge variant="secondary">unknown</Badge>
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full mt-1 bg-muted-foreground/40" />
                    </div>
                  </Card>
                ))
              })()}
            </div>

            <WorkerDetailModal
              workerId={detailWorkerId}
              isOpen={!!detailWorkerId}
              onClose={() => setDetailWorkerId(null)}
            />

            <UnionRoleAssignmentModal
              isOpen={showRole}
              onClose={() => setShowRole(false)}
              employerId={employerId!}
              workers={filteredSortedWorkers.map((w) => ({
                id: w.id,
                first_name: w.first_name ?? "",
                surname: w.surname ?? "",
              }))}
              onSuccess={() => qc.invalidateQueries({ queryKey: ["employer-worker-chart"] })}
            />

            <AssignWorkersModal
              open={showAssign}
              onOpenChange={setShowAssign}
              employerId={employerId!}
              employerName={employerName}
              projectId={null}
              siteOptions={siteOptions}
              defaultSiteId={contextSiteId ?? null}
              onAssigned={() => qc.invalidateQueries({ queryKey: ["employer-worker-chart"] })}
            />
          </>
        ) : (
          <div className="text-sm text-muted-foreground">No workers found for this selection.</div>
        )}
        <QuickAddWorkerModal
          open={showQuickAdd}
          onOpenChange={setShowQuickAdd}
          employerId={employerId!}
          jobSiteId={contextSiteId || null}
          onAdded={() => qcInvalidate()}
        />
      </DialogContent>
    </Dialog>
  );
};