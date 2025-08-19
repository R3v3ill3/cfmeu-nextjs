import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface ContractorSiteAssignmentModalProps {
  projectId: string;
}

export default function ContractorSiteAssignmentModal({ projectId }: ContractorSiteAssignmentModalProps) {
  const queryClient = useQueryClient();

  const { data: sites = [] } = useQuery({
    queryKey: ["csa-sites", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name")
        .eq("project_id", projectId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const siteIds = useMemo(() => sites.map((s: any) => s.id), [sites]);

  const { data: pct = [] } = useQuery({
    queryKey: ["csa-pct", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_contractor_trades")
        .select("id, employer_id, trade_type, eba_signatory, employers(id, name)")
        .eq("project_id", projectId)
        .order("trade_type");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sct = [] } = useQuery({
    queryKey: ["csa-sct", siteIds],
    enabled: siteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_contractor_trades")
        .select("id, job_site_id, employer_id, trade_type")
        .in("job_site_id", siteIds);
      if (error) throw error;
      return data || [];
    },
  });

  const assignmentSet = useMemo(() => {
    const set = new Set<string>();
    (sct || []).forEach((row: any) => set.add(`${row.job_site_id}:${row.employer_id}:${row.trade_type}`));
    return set;
  }, [sct]);

  const assignMutation = useMutation({
    mutationFn: async ({ siteId, employerId, tradeType }: { siteId: string; employerId: string; tradeType: string }) => {
      const base = (pct as any[]).find(r => r.employer_id === employerId && String(r.trade_type) === String(tradeType));
      const eba = base?.eba_signatory ?? "not_specified";
      const { error } = await (supabase as any)
        .from("site_contractor_trades")
        .insert({ job_site_id: siteId, employer_id: employerId, trade_type: tradeType, eba_signatory: eba });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assigned");
      queryClient.invalidateQueries({ queryKey: ["csa-sct"] });
      // Also refresh page-level queries
      queryClient.invalidateQueries({ predicate: q => Array.isArray(q.queryKey) && String(q.queryKey[0]).includes("project-contractors") });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const unassignMutation = useMutation({
    mutationFn: async ({ siteId, employerId, tradeType }: { siteId: string; employerId: string; tradeType: string }) => {
      const { error } = await (supabase as any)
        .from("site_contractor_trades")
        .delete()
        .eq("job_site_id", siteId)
        .eq("employer_id", employerId)
        .eq("trade_type", tradeType);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Unassigned");
      queryClient.invalidateQueries({ queryKey: ["csa-sct"] });
      queryClient.invalidateQueries({ predicate: q => Array.isArray(q.queryKey) && String(q.queryKey[0]).includes("project-contractors") });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const toggle = (siteId: string, employerId: string, tradeType: string, checked: boolean | string) => {
    const key = `${siteId}:${employerId}:${tradeType}`;
    if (checked) assignMutation.mutate({ siteId, employerId, tradeType });
    else if (assignmentSet.has(key)) unassignMutation.mutate({ siteId, employerId, tradeType });
  };

  return (
    <Card className="overflow-x-auto">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employer</TableHead>
              <TableHead>Trade</TableHead>
              {sites.map((s: any) => (
                <TableHead key={s.id}>{s.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(pct as any[]).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  {row.employers?.name}
                  {row.eba_signatory && row.eba_signatory !== "not_specified" && (
                    <Badge variant="secondary">{String(row.eba_signatory).replace("_", " ")}</Badge>
                  )}
                </TableCell>
                <TableCell>{String(row.trade_type)}</TableCell>
                {sites.map((s: any) => {
                  const key = `${s.id}:${row.employer_id}:${row.trade_type}`;
                  const isChecked = assignmentSet.has(key);
                  return (
                    <TableCell key={s.id} className="text-center">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) => toggle(s.id, row.employer_id, String(row.trade_type), v)}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {pct.length === 0 && (
              <TableRow>
                <TableCell colSpan={2 + sites.length} className="text-center text-sm text-muted-foreground">
                  No project-level contractors to assign.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
