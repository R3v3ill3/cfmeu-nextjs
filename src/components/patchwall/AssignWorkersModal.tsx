import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import Papa from "papaparse";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import DateInput from "@/components/ui/date-input";

interface AssignWorkersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employerId: string;
  employerName?: string;
  projectId: string | null;
  siteOptions: Array<{ id: string; name: string }>;
  defaultSiteId?: string | null;
  onAssigned?: () => void;
}

interface WorkerListItem {
  id: string;
  first_name: string | null;
  surname: string | null;
  email: string | null;
}

export function AssignWorkersModal({
  open,
  onOpenChange,
  employerId,
  employerName,
  projectId,
  siteOptions,
  defaultSiteId,
  onAssigned,
}: AssignWorkersModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"existing" | "csv" | "manual">("existing");

  const [allSites, setAllSites] = useState<boolean>(true);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [employmentStatus, setEmploymentStatus] = useState<string>("permanent");
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [selectAllWorkforce, setSelectAllWorkforce] = useState<boolean>(true);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<WorkerListItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Manual add fields
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  // CSV state
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    // initialize site selection
    if (open) {
      if (defaultSiteId) {
        setAllSites(false);
        setSelectedSiteIds([defaultSiteId]);
      } else {
        setAllSites(true);
        setSelectedSiteIds(siteOptions.map((s) => s.id));
      }
    } else {
      setSelectedWorkerIds([]);
      setSelectAllWorkforce(true);
      setSearch("");
      setSearchResults([]);
      setFirstName("");
      setSurname("");
      setEmail("");
      setMobile("");
      setCsvRows([]);
      setTab("existing");
    }
  }, [open, defaultSiteId, siteOptions]);

  const effectiveSiteIds = useMemo(
    () => (allSites ? siteOptions.map((s) => s.id) : selectedSiteIds),
    [allSites, selectedSiteIds, siteOptions]
  );

  const { data: workforce = [], isLoading: loadingWorkforce } = useQuery({
    queryKey: ["assign-workforce", employerId],
    enabled: open && !!employerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_placements")
        .select("worker_id, workers(id, first_name, surname, email), end_date")
        .eq("employer_id", employerId);
      if (error) throw error;
      const map = new Map<string, WorkerListItem>();
      (data || []).forEach((row: any) => {
        if (!map.has(row.worker_id)) {
          map.set(row.worker_id, {
            id: row.workers?.id || row.worker_id,
            first_name: row.workers?.first_name || null,
            surname: row.workers?.surname || null,
            email: row.workers?.email || null,
          });
        }
      });
      return Array.from(map.values());
    },
  });

  const toggleWorker = (id: string) => {
    setSelectedWorkerIds((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
  };

  const runSearch = async () => {
    setSearching(true);
    try {
      const ilike = `%${search}%`;
      const { data, error } = await supabase
        .from("workers")
        .select("id, first_name, surname, email")
        .or(`first_name.ilike.${ilike},surname.ilike.${ilike},email.ilike.${ilike}`)
        .limit(20);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Search failed", description: "Could not search workers", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const assignPlacements = async (workerIds: string[]) => {
    if (!employerId || workerIds.length === 0 || effectiveSiteIds.length === 0) {
      toast({ title: "Missing info", description: "Select at least one worker and one site" });
      return;
    }

    try {
      // Detect conflicts: for the same employer, find active placements on other sites
      const { data: currentActive } = await supabase
        .from("worker_placements")
        .select("worker_id, job_site_id")
        .eq("employer_id", employerId)
        .is("end_date", null)
        .in("worker_id", workerIds)

      const byWorkerSites = new Map<string, Set<string>>()
      ;((currentActive as any[]) || []).forEach((r: any) => {
        if (!byWorkerSites.has(r.worker_id)) byWorkerSites.set(r.worker_id, new Set<string>())
        byWorkerSites.get(r.worker_id)!.add(String(r.job_site_id))
      })

      // If any worker is already placed at different sites than selected, prompt once for policy
      let policy: "move" | "keep" | "multi" = "move"
      const hasConflict = workerIds.some((wid) => {
        const set = byWorkerSites.get(wid)
        if (!set || set.size === 0) return false
        // conflict if selected sites include a site not already in set or vice versa
        const selected = new Set(effectiveSiteIds)
        const already = set
        const diff = Array.from(selected).some((sid) => !already.has(sid)) || Array.from(already).some((sid) => !selected.has(sid))
        return diff
      })

      if (hasConflict) {
        // Lightweight prompt using window.confirm fallbacks to avoid adding extra UI dependencies
        // First ask if move; if not, ask if multi-assign; else keep
        const move = window.confirm("Some selected workers are already assigned to a different site for this employer. Click OK to move them to the new site(s). Click Cancel for more options.")
        if (move) policy = "move"
        else {
          const multi = window.confirm("Assign these workers to multiple sites for this employer? Click OK for multi-assign, Cancel to keep them only at their current sites.")
          policy = multi ? "multi" : "keep"
        }
      }

      // Apply policy per worker
      const today = new Date().toISOString().slice(0, 10)
      for (const wid of workerIds) {
        const already = byWorkerSites.get(wid) || new Set<string>()
        const targetSet = new Set(effectiveSiteIds)

        if (policy === "move") {
          // End all current placements for this employer/worker on other sites
          if (already.size > 0) {
            await supabase
              .from("worker_placements")
              .update({ end_date: today })
              .eq("worker_id", wid)
              .eq("employer_id", employerId)
              .is("end_date", null)
          }
          // Insert new placements for selected sites
          const toInsert = Array.from(targetSet).map((sid) => ({
            worker_id: wid,
            employer_id: employerId,
            job_site_id: sid,
            employment_status: employmentStatus as any,
            start_date: startDate,
          }))
          if (toInsert.length > 0) await supabase.from("worker_placements").insert(toInsert)
        } else if (policy === "multi") {
          // Keep existing; add missing selected sites
          const toInsert = Array.from(targetSet)
            .filter((sid) => !already.has(sid))
            .map((sid) => ({
              worker_id: wid,
              employer_id: employerId,
              job_site_id: sid,
              employment_status: employmentStatus as any,
              start_date: startDate,
            }))
          if (toInsert.length > 0) await supabase.from("worker_placements").insert(toInsert)
        } else {
          // keep: do nothing if already elsewhere; only add where not placed anywhere
          if (already.size === 0) {
            const toInsert = Array.from(targetSet).map((sid) => ({
              worker_id: wid,
              employer_id: employerId,
              job_site_id: sid,
              employment_status: employmentStatus as any,
              start_date: startDate,
            }))
            if (toInsert.length > 0) await supabase.from("worker_placements").insert(toInsert)
          }
        }
      }
      toast({ title: "Workers assigned", description: `${workerIds.length} worker(s) assigned` });
      qc.invalidateQueries({ queryKey: ["employer-worker-chart"] });
      onAssigned?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast({ title: "Assignment failed", description: "Please try again", variant: "destructive" });
    }
  };

  const handleAssignExisting = async () => {
    const ids = new Set<string>();
    if (selectAllWorkforce) {
      workforce.forEach((w: any) => ids.add(w.id));
    } else {
      selectedWorkerIds.forEach((id) => ids.add(id));
    }
    await assignPlacements(Array.from(ids));
  };

  const handleManualCreate = async () => {
    if (!firstName || !surname) {
      toast({ title: "Name required", description: "First and last name are required", variant: "destructive" });
      return;
    }
    try {
      const { data: w, error } = await supabase
        .from("workers")
        .insert({ first_name: firstName, surname, email: email || null, mobile_phone: mobile || null })
        .select("id")
        .single();
      if (error) throw error;
      await assignPlacements([w.id]);
    } catch (e) {
      console.error(e);
      toast({ title: "Create failed", description: "Could not create worker", variant: "destructive" });
    }
  };

  const onCsvFile = (file: File) => {
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setCsvRows(res.data as any[]);
        setParsing(false);
        toast({ title: "CSV loaded", description: `${(res.data as any[]).length} rows parsed` });
      },
      error: (err) => {
        console.error(err);
        setParsing(false);
        toast({ title: "CSV error", description: "Could not parse file", variant: "destructive" });
      },
    });
  };

  const handleCsvImport = async () => {
    if (csvRows.length === 0) return;
    const createdIds: string[] = [];
    try {
      for (const row of csvRows) {
        const fn = (row.first_name || row.firstname || row.FirstName || "").toString().trim();
        const ln = (row.surname || row.last_name || row.lastname || row.LastName || "").toString().trim();
        const em = (row.email || row.Email || "").toString().trim();
        const mm = (row.member_number || row.memberNumber || "").toString().trim();
        const mob = (row.mobile || row.mobile_phone || row.phone || "").toString().trim();
        if (!fn || !ln) continue;
        // Try to find existing
        let workerId: string | null = null;
        if (em) {
          const { data } = await supabase.from("workers").select("id").eq("email", em).maybeSingle();
          if (data?.id) workerId = data.id;
        }
        if (!workerId && mm) {
          const { data } = await supabase.from("workers").select("id").eq("member_number", mm).maybeSingle();
          if (data?.id) workerId = data.id;
        }
        if (!workerId) {
          const { data: maybe } = await supabase
            .from("workers")
            .select("id")
            .eq("first_name", fn)
            .eq("surname", ln)
            .maybeSingle();
          if (maybe?.id) workerId = maybe.id;
        }
        if (!workerId) {
          const { data: created, error } = await supabase
            .from("workers")
            .insert({ first_name: fn, surname: ln, email: em || null, mobile_phone: mob || null, member_number: mm || null })
            .select("id")
            .single();
          if (error) throw error;
          workerId = created.id;
        }
        if (workerId) createdIds.push(workerId);
      }
      await assignPlacements(createdIds);
    } catch (e) {
      console.error(e);
      toast({ title: "Import failed", description: "Some rows could not be imported", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign workers to {employerName || "employer"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="text-sm font-medium">Assign to sites</div>
            <div className="flex items-center gap-3">
              <Checkbox id="allsites" checked={allSites} onCheckedChange={(v: boolean | "indeterminate") => setAllSites(!!v)} />
              <label htmlFor="allsites" className="text-sm">All sites in this project</label>
            </div>
            {!allSites && (
              <div className="flex flex-wrap gap-3">
                {siteOptions.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedSiteIds.includes(s.id)}
                      onCheckedChange={(v: boolean | "indeterminate") => {
                        const checked = !!v;
                        setSelectedSiteIds((prev) => (checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)));
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Employment status</label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3"
                value={employmentStatus}
                onChange={(e) => setEmploymentStatus(e.target.value)}
              >
                <option value="permanent">Permanent</option>
                <option value="casual">Casual</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="apprentice">Apprentice</option>
                <option value="trainee">Trainee</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Start date</label>
              <DateInput value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v: string) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="existing">Existing</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="csv">CSV Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="pt-3">
              <div className="flex items-center gap-3 mb-3">
                <Checkbox id="allworkforce" checked={selectAllWorkforce} onCheckedChange={(v: boolean | "indeterminate") => setSelectAllWorkforce(!!v)} />
                <label htmlFor="allworkforce" className="text-sm">Assign all current workers at {employerName}</label>
                <Badge variant="secondary">{workforce.length}</Badge>
              </div>
              {!selectAllWorkforce && (
                <div className="grid gap-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search workers by name or email"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runSearch()}
                    />
                    <Button onClick={runSearch} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}</Button>
                  </div>
                  <div className="max-h-56 overflow-auto border rounded-md p-2">
                    {loadingWorkforce ? (
                      <div className="text-sm text-muted-foreground">Loading…</div>
                    ) : (
                      <div className="space-y-2">
                        {workforce.map((w: WorkerListItem) => (
                          <label key={w.id} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={selectedWorkerIds.includes(w.id)} onCheckedChange={() => toggleWorker(w.id)} />
                            <span className="font-medium">{`${w.first_name ?? ""} ${w.surname ?? ""}`.trim() || "Unnamed"}</span>
                            {w.email && <span className="text-muted-foreground">{w.email}</span>}
                          </label>
                        ))}
                        {workforce.length === 0 && (
                          <div className="text-sm text-muted-foreground">No existing workers found for this employer.</div>
                        )}
                      </div>
                    )}
                  </div>
                  {searchResults.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Search results</div>
                      <div className="max-h-40 overflow-auto border rounded-md p-2 space-y-2">
                        {searchResults.map((w) => (
                          <div key={w.id} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium">{`${w.first_name ?? ""} ${w.surname ?? ""}`.trim() || "Unnamed"}</span>
                              {w.email && <span className="ml-2 text-muted-foreground">{w.email}</span>}
                            </div>
                            <Button size="sm" variant="outline" onClick={() => toggleWorker(w.id)}>
                              {selectedWorkerIds.includes(w.id) ? "Selected" : "Select"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={handleAssignExisting}>Assign selected</Button>
                  </div>
                </div>
              )}
              {selectAllWorkforce && (
                <div className="flex justify-end">
                  <Button onClick={handleAssignExisting}>Assign all</Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">First name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Surname</label>
                  <Input value={surname} onChange={(e) => setSurname(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Mobile</label>
                  <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <Button onClick={handleManualCreate}>Create and assign</Button>
              </div>
            </TabsContent>

            <TabsContent value="csv" className="pt-3">
              <div className="grid gap-3">
                <div className="flex items-center gap-3">
                  <Input type="file" accept=".csv" onChange={(e) => e.target.files && onCsvFile(e.target.files[0])} />
                  {parsing && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                {csvRows.length > 0 && (
                  <div className="text-sm text-muted-foreground">{csvRows.length} rows ready</div>
                )}
                <div className="flex justify-end">
                  <Button onClick={handleCsvImport} disabled={csvRows.length === 0}>
                    <Upload className="h-4 w-4 mr-2" /> Import and assign
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}