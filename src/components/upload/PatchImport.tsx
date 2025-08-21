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
  const [pendingNewOrganisers, setPendingNewOrganisers] = useState<Record<string, { full_name: string; email: string; created?: boolean }>>({});
  const [resolverSearch, setResolverSearch] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("id, full_name, email, role")
          .in("role", ["organiser", "lead_organiser"]) // align with policies and admin views
          .order("full_name");
        if (error) throw error;
        setOrganisers((data as any[]) || []);
      } catch (e) {
        console.warn("Failed to load organisers for resolver", e);
        setOrganisers([]);
      }
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
    // Consider entries resolved only if matched to existing (nameToOrganiserId) or a draft was actually created
    return uniqueOrganiserNames.filter((name) => {
      if (nameToOrganiserId[name]) return false;
      const pending = pendingNewOrganisers[name];
      return !(pending && pending.created);
    });
  }, [uniqueOrganiserNames, nameToOrganiserId, pendingNewOrganisers]);

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
      if (info.created) continue; // already created via the button
      try {
        // Avoid duplicate drafts by checking existing pending/invited by email
        const { data: existing } = await (supabase as any)
          .from("pending_users")
          .select("id")
          .eq("email", info.email)
          .eq("role", "organiser")
          .maybeSingle();
        if (!existing) {
          const { error } = await (supabase as any)
            .from("pending_users")
            .insert({ email: info.email, full_name: info.full_name, role: "organiser", status: "draft" });
          if (error) throw error;
        }
        // Mark as created in local state so it is treated as resolved
        setPendingNewOrganisers((prev) => ({ ...prev, [label]: { ...info, created: true } }));
      } catch (e: any) {
        toast({ title: "Failed to create pending organiser", description: e?.message || String(e), variant: "destructive" });
        return;
      }
    }
    setResolverOpen(false);
    toast({ title: "Organiser resolution saved", description: "New organisers drafted where needed." });
  };

  const createDraftForLabel = async (label: string) => {
    const info = pendingNewOrganisers[label];
    if (!info || !info.full_name || !info.email) {
      toast({ title: "Missing details", description: "Enter full name and email to create a draft organiser.", variant: "destructive" });
      return;
    }
    try {
      // Skip insert if already exists
      const { data: existing } = await (supabase as any)
        .from("pending_users")
        .select("id")
        .eq("email", info.email)
        .eq("role", "organiser")
        .maybeSingle();
      if (!existing) {
        const { error } = await (supabase as any)
          .from("pending_users")
          .insert({ email: info.email, full_name: info.full_name, role: "organiser", status: "draft" });
        if (error) throw error;
      }
      setPendingNewOrganisers((prev) => ({ ...prev, [label]: { ...info, created: true } }));
      toast({ title: "Draft organiser created", description: `${info.full_name} (${info.email})` });
    } catch (e: any) {
      toast({ title: "Failed to create draft", description: e?.message || String(e), variant: "destructive" });
    }
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
        // Resolve existing patch by case-insensitive name only (schema does not include code)
        let existing: any = null;
        if (row.name) {
          const { data } = await supabase
            .from("patches")
            .select("id, name")
            .ilike("name", row.name)
            .limit(1)
            .maybeSingle();
          existing = data || null;
        }

        let patchId: string;
        if (existing) {
          // Update only columns that exist in schema
          const { data, error } = await supabase
            .from("patches")
            .update({ name: row.name, type: row.type })
            .eq("id", existing.id)
            .select("id")
            .single();
          if (error) throw error;
          patchId = (data as any).id;
          results.updated++;
        } else {
          // Insert only columns that exist in schema
          const { data, error } = await supabase
            .from("patches")
            .insert({ name: row.name, type: row.type })
            .select("id")
            .single();
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
                    {unresolvedOrganiserNames.length} organiser name(s) are unresolved. You can resolve them now or proceed; unresolved names will be skipped when linking organisers.
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
                <Button onClick={importRows} disabled={isImporting} className="ml-auto">
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
                {unresolvedOrganiserNames.map((label, index) => {
                  const selectedExisting = nameToOrganiserId[label] || "";
                  const newInfo = pendingNewOrganisers[label] || { full_name: label, email: "" };
                  return (
                    <Card key={`${label}-${index}`}>
                      <CardHeader>
                        <CardTitle className="text-base">{label}</CardTitle>
                        <CardDescription>Match to an existing organiser or create a new draft organiser</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Match existing</div>
                            <div className="space-y-2">
                              <Input
                                placeholder="Search by name or email"
                                value={resolverSearch[label] ?? ""}
                                onChange={(e) => setResolverSearch((prev) => ({ ...prev, [label]: e.target.value }))}
                              />
                              <div className="rounded border max-h-40 overflow-y-auto">
                                {suggestMatches(resolverSearch[label] ?? label).map((o) => (
                                  <button
                                    key={o.id}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${selectedExisting === o.id ? "bg-accent" : ""}`}
                                    onClick={() => {
                                      setNameToOrganiserId((prev) => ({ ...prev, [label]: o.id }));
                                      setPendingNewOrganisers((prev) => {
                                        const clone = { ...prev } as any;
                                        delete clone[label];
                                        return clone;
                                      });
                                    }}
                                  >
                                    {o.full_name} {o.email ? `(${o.email})` : ""}
                                  </button>
                                ))}
                                {suggestMatches(resolverSearch[label] ?? label).length === 0 && (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
                                )}
                              </div>
                            </div>
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
                            <div className="mt-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!newInfo.full_name?.trim() || !newInfo.email?.trim() || Boolean(newInfo.created)}
                                onClick={() => createDraftForLabel(label)}
                              >
                                {newInfo.created ? "Draft created" : "Create draft organiser"}
                              </Button>
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
              <Button type="button" variant="outline" onClick={() => setResolverOpen(false)}>Close</Button>
              <Button type="button" onClick={handleResolverConfirm}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}