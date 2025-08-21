import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, AlertCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ImportResults = {
  created: number;
  updated: number;
  organiserLinks: number;
  failed: number;
  errors: string[];
};

interface PatchImportProps {
  csvData: Record<string, any>[];
  onImportComplete: (results: ImportResults) => void;
  onBack: () => void;
}

// Helper to coerce to integer (or null)
function toInt(value: any): number | null {
  if (value === null || value === undefined) return null;
  const n = parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

export default function PatchImport({ csvData, onImportComplete, onBack }: PatchImportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [organisers, setOrganisers] = useState<Array<{ id: string; full_name: string; email: string | null }>>([]);
  const [resolverOpen, setResolverOpen] = useState(false);
  const [nameToOrganiserId, setNameToOrganiserId] = useState<Record<string, string>>({});
  const [pendingNewOrganisers, setPendingNewOrganisers] = useState<Record<string, { full_name: string; email: string }>>({});
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      setOrganisers((data as any[]) || []);
    };
    load();
  }, []);

  // Normalize rows into a consistent structure for preview and import
  const normalizedRows = useMemo(() => {
    const lower = (s: any) => (s ? String(s).toLowerCase() : "");
    const isTruthy = (v: any) => v !== undefined && v !== null && String(v).trim() !== "";
    const rows = (csvData || []).map((r) => {
      const code = toInt(r["code"] ?? r["Patch code"] ?? r["patch_code"] ?? r["patch code"]);
      const name = r["name"] ?? r["Patch name"] ?? r["patch"] ?? r["Patch"] ?? r["Patch description"] ?? r["description"];
      const description = r["description"] ?? r["Patch description"] ?? r["patch_description"];
      const org1 = r["organiser1"] ?? r["organiser 1"] ?? r["Organiser 1"] ?? r["Organizer 1"];
      const org2 = r["organiser2"] ?? r["organiser 2"] ?? r["Organiser 2"] ?? r["Organizer 2"];
      // Collect any columns that look like sub-sector definitions
      const subCols = Object.keys(r).filter((k) => /sub\s*-?\s*sector|subsector|sub_sector/i.test(k));
      const subSectors = subCols
        .map((k) => String(r[k]).trim())
        .filter((v) => isTruthy(v));
      const type = subSectors.length > 0 || /trade/.test(lower(description)) ? "trade" : "geo";
      return { code, name: name ? String(name).trim() : null, description: description || null, organiser1: org1 || null, organiser2: org2 || null, subSectors, type };
    });
    return rows.filter((r) => r.code !== null || r.name);
  }, [csvData]);

  useEffect(() => {
    setPreview(normalizedRows.slice(0, 10));
  }, [normalizedRows]);

  // Collect unique organiser strings from the CSV
  const uniqueOrganiserNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of normalizedRows) {
      if (r.organiser1 && String(r.organiser1).trim()) set.add(String(r.organiser1).trim());
      if (r.organiser2 && String(r.organiser2).trim()) set.add(String(r.organiser2).trim());
    }
    return Array.from(set);
  }, [normalizedRows]);

  // Pre-resolve obvious matches
  useEffect(() => {
    const map: Record<string, string> = {};
    uniqueOrganiserNames.forEach((name) => {
      const id = findOrganiserId(name);
      if (id) map[name] = id;
    });
    setNameToOrganiserId((prev) => ({ ...map, ...prev }));
  }, [uniqueOrganiserNames]);

  const unresolvedOrganiserNames = useMemo(() => {
    return uniqueOrganiserNames.filter((name) => !nameToOrganiserId[name]);
  }, [uniqueOrganiserNames, nameToOrganiserId]);

  const suggestMatches = (query: string) => {
    const q = String(query).toLowerCase();
    return organisers
      .filter((o) => (o.full_name || "").toLowerCase().includes(q) || (o.email || "").toLowerCase().includes(q))
      .slice(0, 10);
  };

  const handleResolverConfirm = async () => {
    // Create pending users for any entries marked for creation
    for (const [label, info] of Object.entries(pendingNewOrganisers)) {
      if (!info.full_name || !info.email) continue;
      try {
        const { error } = await (supabase as any)
          .from("pending_users")
          .insert({ email: info.email, full_name: info.full_name, role: "organiser", status: "draft" });
        if (error) throw error;
      } catch (e: any) {
        toast({ title: "Failed to create pending organiser", description: e?.message || String(e), variant: "destructive" });
        return;
      }
    }
    setResolverOpen(false);
    toast({ title: "Organiser resolution saved", description: "New organisers drafted where needed." });
  };

  const findOrganiserId = (value: any): string | null => {
    if (!value) return null;
    const target = String(value).trim().toLowerCase();
    const exact = organisers.find((o) => (o.full_name || "").toLowerCase() === target || (o.email || "").toLowerCase() === target);
    if (exact) return exact.id;
    // Loose contains match on name if no exact match
    const loose = organisers.find((o) => (o.full_name || "").toLowerCase().includes(target));
    return loose ? loose.id : null;
  };

  const upsertOrganiserLink = async (organiserId: string, patchId: string) => {
    try {
      await (supabase as any).rpc("upsert_organiser_patch", { p_org: organiserId, p_patch: patchId });
      return true;
    } catch {
      return false;
    }
  };

  const importRows = async () => {
    setIsImporting(true);
    const results: ImportResults = { created: 0, updated: 0, organiserLinks: 0, failed: 0, errors: [] };

    for (const row of normalizedRows) {
      try {
        // Resolve existing patch by code (preferred) or by case-insensitive name
        let existing: any = null;
        if (row.code !== null) {
          const { data } = await supabase.from("patches").select("id, code").eq("code", row.code).maybeSingle();
          existing = data || null;
        }
        if (!existing && row.name) {
          const { data } = await supabase.from("patches").select("id, name").ilike("name", row.name).limit(1).maybeSingle();
          existing = data || null;
        }

        let patchId: string;
        if (existing) {
          // Try full update first; if it fails due to unknown columns, retry with minimal fields
          const tryUpdate = async (payload: any) => {
            const res = await supabase.from("patches").update(payload).eq("id", existing.id).select("id").single();
            return res;
          };
          let { data, error } = await tryUpdate({
            name: row.name,
            description: row.description,
            type: row.type,
            sub_sectors: row.subSectors.length > 0 ? row.subSectors : null,
            code: row.code,
          });
          if (error && /column .* does not exist/i.test(error.message || "")) {
            ({ data, error } = await tryUpdate({ name: row.name, description: row.description, type: row.type }));
          }
          if (error) throw error;
          patchId = (data as any).id;
          results.updated++;
        } else {
          const tryInsert = async (payload: any) => {
            const res = await supabase.from("patches").insert(payload).select("id").single();
            return res;
          };
          let { data, error } = await tryInsert({
            name: row.name,
            description: row.description,
            type: row.type,
            sub_sectors: row.subSectors.length > 0 ? row.subSectors : null,
            code: row.code,
          });
          if (error && /column .* does not exist/i.test(error.message || "")) {
            ({ data, error } = await tryInsert({ name: row.name, description: row.description, type: row.type }));
          }
          if (error) throw error;
          patchId = (data as any).id;
          results.created++;
        }

        // Link organisers (resolved mapping preferred)
        const resolved1 = nameToOrganiserId[String(row.organiser1 || "")] || findOrganiserId(row.organiser1);
        const resolved2 = nameToOrganiserId[String(row.organiser2 || "")] || findOrganiserId(row.organiser2);
        if (resolved1) {
          const ok = await upsertOrganiserLink(resolved1, patchId);
          if (ok) results.organiserLinks++;
        }
        if (resolved2 && resolved2 !== resolved1) {
          const ok = await upsertOrganiserLink(resolved2, patchId);
          if (ok) results.organiserLinks++;
        }
      } catch (e: any) {
        results.failed++;
        results.errors.push(e?.message || "Unknown error");
      }
    }

    if (results.failed > 0) {
      toast({ title: "Import completed with errors", description: `${results.created} created, ${results.updated} updated, ${results.organiserLinks} organiser links. ${results.failed} failed.`, variant: "destructive" });
    } else {
      toast({ title: "Patches imported", description: `${results.created} created, ${results.updated} updated, ${results.organiserLinks} organiser links.` });
    }
    onImportComplete(results);
    setIsImporting(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Patch Import
          </CardTitle>
          <CardDescription>
            We will create or update patches by code or name, store descriptions and sub-sectors, and link up to two organisers per row.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No rows detected. Please check your CSV mapping.</AlertDescription>
            </Alert>
          ) : (
            <>
              {unresolvedOrganiserNames.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {unresolvedOrganiserNames.length} organiser name(s) require resolution. Please match to an existing organiser or create a new draft organiser.
                    <Button variant="outline" size="sm" className="ml-2" onClick={() => setResolverOpen(true)}>Resolve organisers</Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{csvData.length}</div>
                  <div className="text-sm text-muted-foreground">Total Rows</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-green-600">{preview.filter((r) => r.type === "geo").length}</div>
                  <div className="text-sm text-muted-foreground">Sample Geo</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-blue-600">{preview.filter((r) => r.type === "trade").length}</div>
                  <div className="text-sm text-muted-foreground">Sample Trade</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold flex items-center justify-center gap-1">
                    <Users className="h-5 w-5" />
                    {preview.filter((r) => r.organiser1 || r.organiser2).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Rows with organisers</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Preview (first 10 rows)</h4>
                <ScrollArea className="max-h-80">
                  <div className="grid grid-cols-1 gap-2 pr-2">
                    {preview.map((r, i) => (
                      <div key={i} className="p-3 rounded border text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{r.code ?? "—"} — {r.name ?? "(no name)"}</div>
                          <Badge variant="secondary">{r.type}</Badge>
                        </div>
                        {r.description && <div className="text-muted-foreground">{r.description}</div>}
                        {r.subSectors?.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">Sub-sectors: {r.subSectors.join(", ")}</div>
                        )}
                        {(r.organiser1 || r.organiser2) && (
                          <div className="text-xs text-muted-foreground mt-1">Organisers: {[r.organiser1, r.organiser2].filter(Boolean).join(", ")}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={onBack}>Back to Mapping</Button>
                <Button onClick={importRows} disabled={isImporting || unresolvedOrganiserNames.length > 0} className="ml-auto">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isImporting ? "Importing..." : `Import ${csvData.length} Patches`}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={resolverOpen} onOpenChange={setResolverOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolve organisers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {unresolvedOrganiserNames.length === 0 ? (
              <div className="text-sm text-muted-foreground">No unresolved organisers.</div>
            ) : (
              <div className="space-y-4">
                {unresolvedOrganiserNames.map((label) => {
                  const suggestions = suggestMatches(label);
                  const selectedExisting = nameToOrganiserId[label] || "";
                  const newInfo = pendingNewOrganisers[label] || { full_name: label, email: "" };
                  return (
                    <Card key={label}>
                      <CardHeader>
                        <CardTitle className="text-base">{label}</CardTitle>
                        <CardDescription>Match to an existing organiser or create a new draft organiser</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Match existing</div>
                            <Select
                              value={selectedExisting}
                              onValueChange={(v) => {
                                setNameToOrganiserId((prev) => ({ ...prev, [label]: v }));
                                setPendingNewOrganisers((prev) => {
                                  const clone = { ...prev } as any;
                                  delete clone[label];
                                  return clone;
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={suggestions.length ? `Suggest: ${suggestions[0].full_name}` : "Search by name/email"} />
                              </SelectTrigger>
                              <SelectContent>
                                {suggestions.map((o) => (
                                  <SelectItem key={o.id} value={o.id}>{o.full_name} {o.email ? `(${o.email})` : ""}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Or create new draft</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Input
                                placeholder="Full name"
                                value={newInfo.full_name}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPendingNewOrganisers((prev) => ({ ...prev, [label]: { ...newInfo, full_name: v } }));
                                  setNameToOrganiserId((prev) => {
                                    const clone = { ...prev } as any;
                                    delete clone[label];
                                    return clone;
                                  });
                                }}
                              />
                              <Input
                                placeholder="Email"
                                value={newInfo.email}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPendingNewOrganisers((prev) => ({ ...prev, [label]: { ...newInfo, email: v } }));
                                  setNameToOrganiserId((prev) => {
                                    const clone = { ...prev } as any;
                                    delete clone[label];
                                    return clone;
                                  });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResolverOpen(false)}>Close</Button>
              <Button onClick={handleResolverConfirm}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}