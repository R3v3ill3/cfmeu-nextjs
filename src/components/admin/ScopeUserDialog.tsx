import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export interface ScopeUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    scoped_sites?: string[];
    scoped_employers?: string[];
  };
  employers: { id: string; name: string }[];
  jobSites: { id: string; name: string; location?: string }[];
  onSave: (params: { userId: string; scopedSites: string[]; scopedEmployers: string[] }) => Promise<void> | void;
}

const ScopeUserDialog = ({ open, onOpenChange, user, employers, jobSites, onSave }: ScopeUserDialogProps) => {
  const [siteQuery, setSiteQuery] = useState("");
  const [employerQuery, setEmployerQuery] = useState("");
  const [selectedSites, setSelectedSites] = useState<string[]>(user.scoped_sites ?? []);
  const [selectedEmployers, setSelectedEmployers] = useState<string[]>(user.scoped_employers ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedSites(user.scoped_sites ?? []);
      setSelectedEmployers(user.scoped_employers ?? []);
      setSiteQuery("");
      setEmployerQuery("");
    }
  }, [open, user]);

  const filteredSites = useMemo(() => {
    const q = siteQuery.toLowerCase();
    return jobSites.filter((s) =>
      [s.name, s.location].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [jobSites, siteQuery]);

  const filteredEmployers = useMemo(() => {
    const q = employerQuery.toLowerCase();
    return employers.filter((e) => e.name.toLowerCase().includes(q));
  }, [employers, employerQuery]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ userId: user.id, scopedSites: selectedSites, scopedEmployers: selectedEmployers });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const titleName = user.full_name || user.email || "User";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Scope access for {titleName}</DialogTitle>
          <DialogDescription>
            Select which Job Sites and Employers this organiser can access. Leave empty for full access.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h3 className="text-sm font-medium mb-2">Job Sites</h3>
            <Input
              placeholder="Search sites..."
              value={siteQuery}
              onChange={(e) => setSiteQuery(e.target.value)}
              className="mb-2"
            />
            <div className="flex items-center gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedSites(filteredSites.map((s) => s.id))}>
                Select visible
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedSites([])}>
                Clear
              </Button>
            </div>
            <ScrollArea className="h-64 rounded border p-2">
              <ul className="space-y-2">
                {filteredSites.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedSites.includes(s.id)}
                      onCheckedChange={() => toggle(selectedSites, setSelectedSites, s.id)}
                      id={`site-${s.id}`}
                    />
                    <label htmlFor={`site-${s.id}`} className="text-sm cursor-pointer select-none">
                      <span className="font-medium">{s.name}</span>
                      {s.location ? <span className="text-muted-foreground"> — {s.location}</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <p className="text-xs text-muted-foreground mt-2">Selected: {selectedSites.length}</p>
          </section>

          <section>
            <h3 className="text-sm font-medium mb-2">Employers</h3>
            <Input
              placeholder="Search employers..."
              value={employerQuery}
              onChange={(e) => setEmployerQuery(e.target.value)}
              className="mb-2"
            />
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEmployers(filteredEmployers.map((e) => e.id))}
              >
                Select visible
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEmployers([])}>
                Clear
              </Button>
            </div>
            <ScrollArea className="h-64 rounded border p-2">
              <ul className="space-y-2">
                {filteredEmployers.map((e) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedEmployers.includes(e.id)}
                      onCheckedChange={() => toggle(selectedEmployers, setSelectedEmployers, e.id)}
                      id={`employer-${e.id}`}
                    />
                    <label htmlFor={`employer-${e.id}`} className="text-sm cursor-pointer select-none">
                      {e.name}
                    </label>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <p className="text-xs text-muted-foreground mt-2">Selected: {selectedEmployers.length}</p>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save scope"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScopeUserDialog;
