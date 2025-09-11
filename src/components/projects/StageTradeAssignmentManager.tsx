import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getTradeOptionsByStage, getAllStages, getStageLabel, type TradeStage } from "@/utils/tradeUtils";

const STAGES: Array<{ key: TradeStage; label: string }> = getAllStages().map(stage => ({
  key: stage,
  label: getStageLabel(stage),
}));

// Get trade options dynamically from the canonical source
const TRADES_BY_STAGE = getTradeOptionsByStage();

type AssignmentRow = { id: string; employer_id: string; employer_name: string; trade_type: string; stage: string; estimated_project_workforce: number | null };

export default function StageTradeAssignmentManager({ projectId }: { projectId: string }) {
  const [stage, setStage] = useState<string>("early_works");
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [availability, setAvailability] = useState<Record<string, "active" | "na">>({});
  const [employers, setEmployers] = useState<Array<{ id: string; name: string }>>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [chosenTrade, setChosenTrade] = useState<string>("");
  const [chosenEmployer, setChosenEmployer] = useState<string>("");
  const [estimate, setEstimate] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const { data: emps } = await supabase.from("employers").select("id,name").order("name");
      setEmployers((emps || []) as any);
    };
    load();
  }, []);

  const loadStageData = async (stg: string) => {
    const { data: rows } = await (supabase as any)
      .from("project_contractor_trades")
      .select("id, employer_id, trade_type, stage, estimated_project_workforce, employers(name)")
      .eq("project_id", projectId)
      .eq("stage", stg);
    const mapped: AssignmentRow[] = ((rows as any[]) || []).map((r: any) => ({
      id: r.id,
      employer_id: r.employer_id,
      employer_name: r.employers?.name || r.employer_id,
      trade_type: r.trade_type,
      stage: r.stage,
      estimated_project_workforce: r.estimated_project_workforce ?? null,
    }));
    setAssignments(mapped);

    const { data: av } = await (supabase as any)
      .from("project_trade_availability")
      .select("trade_type, status")
      .eq("project_id", projectId)
      .eq("stage", stg);
    const map: Record<string, "active" | "na"> = {};
    ((av as any[]) || []).forEach((r: any) => { map[r.trade_type] = (r.status === 'na' ? 'na' : 'active'); });
    setAvailability(map);
  };

  useEffect(() => { loadStageData(stage); }, [stage, projectId, loadStageData]);

  const toggleNA = async (trade: string) => {
    try {
      const current = availability[trade] || 'active';
      const next = current === 'na' ? 'active' : 'na';
      // upsert record
      await (supabase as any)
        .from("project_trade_availability")
        .upsert({ project_id: projectId, stage, trade_type: trade, status: next }, { onConflict: "project_id,stage,trade_type" });
      setAvailability({ ...availability, [trade]: next });
      toast.success(`Set ${trade} to ${next.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update availability');
    }
  };

  const removeAssignment = async (id: string) => {
    try {
      await (supabase as any).from("project_contractor_trades").delete().eq("id", id);
      setAssignments(assignments.filter((a) => a.id !== id));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove assignment');
    }
  };

  const addAssignment = async () => {
    if (!chosenTrade || !chosenEmployer) return;
    try {
      const payload: any = {
        project_id: projectId,
        employer_id: chosenEmployer,
        trade_type: chosenTrade,
        stage,
      };
      if (estimate.trim()) payload.estimated_project_workforce = Number(estimate);
      const { data, error } = await (supabase as any)
        .from("project_contractor_trades")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      const empName = employers.find((e) => e.id === chosenEmployer)?.name || chosenEmployer;
      setAssignments([...assignments, { id: data.id, employer_id: chosenEmployer, employer_name: empName, trade_type: chosenTrade, stage, estimated_project_workforce: estimate.trim() ? Number(estimate) : null }]);
      setChosenEmployer("");
      setChosenTrade("");
      setEstimate("");
      setAddOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add assignment');
    }
  };

  const filteredEmployers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employers;
    return employers.filter((e) => e.name.toLowerCase().includes(q));
  }, [employers, search]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade assignment by stage</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={stage} onValueChange={setStage}>
          <TabsList>
            {STAGES.map((s) => (
              <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>
            ))}
          </TabsList>
          {STAGES.map((s) => (
            <TabsContent key={s.key} value={s.key} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(TRADES_BY_STAGE[s.key] || []).map((t) => {
                  const na = availability[t.value] === 'na';
                  const list = assignments.filter((a) => a.trade_type === t.value);
                  return (
                    <div key={t.value} className="rounded border p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{t.label}</div>
                        <Button size="sm" variant={na ? "default" : "outline"} onClick={() => toggleNA(t.value)}>{na ? 'Set Active' : 'Set N/A'}</Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {list.map((a) => (
                          <Badge key={a.id} variant="secondary" className="flex items-center gap-1">
                            {a.employer_name}
                            {typeof a.estimated_project_workforce === 'number' && (
                              <span className="ml-1 text-xs text-muted-foreground">(Est: {a.estimated_project_workforce})</span>
                            )}
                            <button className="ml-1 hover:text-destructive" onClick={() => removeAssignment(a.id)} aria-label="Remove"><Trash2 className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                        <Dialog open={addOpen && chosenTrade === t.value} onOpenChange={(v: boolean) => { if (!v) { setAddOpen(false); setChosenTrade(""); setChosenEmployer(""); setEstimate(""); } }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" disabled={na} onClick={() => { setAddOpen(true); setChosenTrade(t.value); }}>
                              <Plus className="h-4 w-4 mr-1" /> Add employer
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Add employer for {t.label}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-3">
                              <div>
                                <Label htmlFor="stam_search">Search employers</Label>
                                <Input id="stam_search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to filter..." />
                              </div>
                              <div>
                                <Label>Employer</Label>
                                <div className="max-h-72 overflow-auto rounded border p-2 space-y-1">
                                  {filteredEmployers.map((e) => (
                                    <button key={e.id} onClick={() => setChosenEmployer(e.id)} className={`w-full text-left px-3 py-2 rounded hover:bg-accent transition ${chosenEmployer === e.id ? 'bg-accent' : ''}`}>{e.name}</button>
                                  ))}
                                  {filteredEmployers.length === 0 && (
                                    <div className="text-sm text-muted-foreground p-2">No employers match your search.</div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="stam_est">Estimated workforce (optional)</Label>
                                <Input id="stam_est" type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="e.g. 10" />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => { setAddOpen(false); }}>Cancel</Button>
                                <Button onClick={addAssignment} disabled={!chosenEmployer}>Add</Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}