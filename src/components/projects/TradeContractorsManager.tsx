
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TRADE_OPTIONS } from "@/constants/trades";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

type Employer = { id: string; name: string };

export type TradeAssignment = {
  employer_id: string;
  trade_type: string;
  estimated_project_workforce?: number | null;
};

export function TradeContractorsManager({
  assignments,
  onChange,
}: {
  assignments: TradeAssignment[];
  onChange: (list: TradeAssignment[]) => void;
}) {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [open, setOpen] = useState(false);
  const [chosenEmployer, setChosenEmployer] = useState("");
  const [chosenTrade, setChosenTrade] = useState("");
  const [search, setSearch] = useState("");
  const [tradeEmployers, setTradeEmployers] = useState<Record<string, Set<string>>>({});
  const [estimate, setEstimate] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("employers").select("id, name").order("name");
      setEmployers((data ?? []) as Employer[]);

      const { data: caps } = await (supabase as any)
        .from("contractor_trade_capabilities")
        .select("employer_id, trade_type");
      const map: Record<string, Set<string>> = {};
      (caps ?? []).forEach((row: any) => {
        const t = row.trade_type as string;
        if (!map[t]) map[t] = new Set();
        if (row.employer_id) map[t].add(row.employer_id as string);
      });
      setTradeEmployers(map);
    };
    load();
  }, []);

  const employerName = useMemo(() => {
    const map = new Map(employers.map((e) => [e.id, e.name]));
    return (id: string) => map.get(id) ?? id;
  }, [employers]);

  const prioritizedEmployers = useMemo(() => {
    const list = [...employers];
    if (!chosenTrade) return list;
    const set = tradeEmployers[chosenTrade] || new Set<string>();
    return list.sort((a, b) => {
      const aHas = set.has(a.id);
      const bHas = set.has(b.id);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [employers, chosenTrade, tradeEmployers]);

  const filteredEmployers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prioritizedEmployers;
    return prioritizedEmployers.filter((e) => e.name.toLowerCase().includes(q));
  }, [prioritizedEmployers, search]);

  const addAssignment = () => {
    if (!chosenEmployer || !chosenTrade) return;
    const exists = assignments.some(
      (a) => a.employer_id === chosenEmployer && a.trade_type === chosenTrade
    );
    if (exists) return;
    const est = estimate.trim() ? Number(estimate) : null;
    onChange([...assignments, { employer_id: chosenEmployer, trade_type: chosenTrade, estimated_project_workforce: est }]);
    setChosenEmployer("");
    setChosenTrade("");
    setEstimate("");
    setOpen(false);
  };

  const removeAt = (idx: number) => {
    const copy = [...assignments];
    copy.splice(idx, 1);
    onChange(copy);
  };

  return (
    <div className="space-y-2">
      <Label>Trade contractors</Label>

      <div className="flex flex-wrap gap-2">
        {assignments.map((a, idx) => (
          <Badge key={`${a.employer_id}-${a.trade_type}-${idx}`} variant="secondary" className="flex items-center gap-1">
            {employerName(a.employer_id)} — {TRADE_OPTIONS.find(t => t.value === a.trade_type)?.label ?? a.trade_type}
            {typeof a.estimated_project_workforce === 'number' && (
              <span className="ml-1 text-xs text-muted-foreground">(Est: {a.estimated_project_workforce})</span>
            )}
            <button onClick={() => removeAt(idx)} className="ml-1 hover:text-destructive" aria-label="Remove">
              <Trash2 className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add trade contractor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add trade contractor</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Trade type</Label>
                <Select value={chosenTrade} onValueChange={(v) => { setChosenTrade(v); setChosenEmployer(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {TRADE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tc_search">Search employers</Label>
                <Input
                  id="tc_search"
                  placeholder="Type to filter companies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div>
                <Label>Employer</Label>
                <div className="max-h-72 overflow-auto rounded border p-2 space-y-1">
                  {filteredEmployers.map((e) => {
                    const set = tradeEmployers[chosenTrade] || new Set<string>();
                    const highlight = !!chosenTrade && set.has(e.id);
                    const isSelected = chosenEmployer === e.id;
                    return (
                      <button
                        key={e.id}
                        onClick={() => setChosenEmployer(e.id)}
                        className={`w-full text-left px-3 py-2 rounded hover:bg-accent transition ${isSelected ? "bg-accent" : ""} ${highlight ? "font-semibold" : ""}`}
                        disabled={!chosenTrade}
                      >
                        {e.name} {highlight ? <span className="text-muted-foreground">(prioritised)</span> : null}
                      </button>
                    );
                  })}
                  {filteredEmployers.length === 0 && (
                    <div className="text-sm text-muted-foreground p-2">
                      {chosenTrade ? "No employers match your search." : "Select a trade first"}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="estimate">Estimated workforce on this project (optional)</Label>
                <Input id="estimate" type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="e.g. 25" />
              </div>

              <div className="pt-1">
                <Button onClick={addAssignment} disabled={!chosenTrade || !chosenEmployer}>Add</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
