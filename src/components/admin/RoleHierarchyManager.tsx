import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Link as LinkIcon, Trash2 } from "lucide-react";

interface RoleHierarchyManagerProps {
  users: Array<{ id: string; full_name: string; email: string; role: string }>;
}

export const RoleHierarchyManager = ({ users }: RoleHierarchyManagerProps) => {
  const { toast } = useToast();
  const [leadId, setLeadId] = useState<string>("");
  const [organiserId, setOrganiserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<Array<{ id: string; parent_user_id: string; child_user_id: string }>>([]);
  // Draft link management
  const [draftLeadId, setDraftLeadId] = useState<string>("");
  const [draftPendingId, setDraftPendingId] = useState<string>("");
  const [draftLinks, setDraftLinks] = useState<Array<{ id: string; lead_user_id: string; pending_user_id: string }>>([]);
  const [pendingOrganisers, setPendingOrganisers] = useState<Array<{ id: string; email: string; full_name: string | null; status: string }>>([]);
  // Draft Lead management
  const [pendingLeads, setPendingLeads] = useState<Array<{ id: string; email: string; full_name: string | null; status: string }>>([]);
  const [draftLeadPendingId, setDraftLeadPendingId] = useState<string>("");
  const [draftLeadToOrganiserId, setDraftLeadToOrganiserId] = useState<string>("");
  const [draftLeadToPendingId, setDraftLeadToPendingId] = useState<string>("");
  const [draftLeadLinks, setDraftLeadLinks] = useState<Array<{ id: string; draft_lead_pending_user_id: string; organiser_user_id: string | null; organiser_pending_user_id: string | null }>>([]);

  const leads = useMemo(() => users.filter(u => u.role === "lead_organiser"), [users]);
  const organisers = useMemo(() => users.filter(u => u.role === "organiser"), [users]);

  const getName = (id: string) => users.find(u => u.id === id)?.full_name || users.find(u => u.id === id)?.email || id;

  useEffect(() => {
    const fetchLinks = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("role_hierarchy")
        .select("id,parent_user_id,child_user_id")
        .eq("is_active", true)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order("created_at", { ascending: false });
      if (error) {
        console.error(error);
        toast({ title: "Error", description: "Failed to load role links", variant: "destructive" });
      } else {
        setLinks(data || []);
      }
    };
    fetchLinks();
  }, [toast]);

  useEffect(() => {
    const fetchDraftData = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [
        { data: pending, error: pErr },
        { data: dl, error: dErr },
        { data: pLeads, error: plErr },
        { data: draftLeadRows, error: draftLeadErr }
      ] = await Promise.all([
        supabase
          .from("pending_users")
          .select("id,email,full_name,status")
          .eq("role", "organiser")
          .in("status", ["draft", "invited"]) 
          .order("created_at", { ascending: false }),
        supabase
          .from("lead_draft_organiser_links")
          .select("id,lead_user_id,pending_user_id")
          .eq("is_active", true)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .order("created_at", { ascending: false }),
        supabase
          .from("pending_users")
          .select("id,email,full_name,status")
          .eq("role", "lead_organiser")
          .in("status", ["draft", "invited"]) 
          .order("created_at", { ascending: false }),
        supabase
          .from("draft_lead_organiser_links")
          .select("id,draft_lead_pending_user_id,organiser_user_id,organiser_pending_user_id")
          .eq("is_active", true)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .order("created_at", { ascending: false })
      ]);
      if (pErr) {
        console.error(pErr);
        toast({ title: "Error", description: "Failed to load draft organisers", variant: "destructive" });
      } else {
        setPendingOrganisers(pending || []);
      }
      if (dErr) {
        console.error(dErr);
        toast({ title: "Error", description: "Failed to load draft links", variant: "destructive" });
      } else {
        setDraftLinks(dl || []);
      }
      if (plErr) {
        console.error(plErr);
        toast({ title: "Error", description: "Failed to load draft leads", variant: "destructive" });
      } else {
        setPendingLeads(pLeads || []);
      }
      if (draftLeadErr) {
        console.error(draftLeadErr);
        toast({ title: "Error", description: "Failed to load draft lead links", variant: "destructive" });
      } else {
        setDraftLeadLinks(draftLeadRows || []);
      }
    };
    fetchDraftData();
  }, [toast]);

  const addLink = async () => {
    if (!leadId || !organiserId) {
      toast({ title: "Select both users", description: "Choose a lead and an organiser" });
      return;
    }
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const assignedBy = (auth as any)?.user?.id ?? null;
      const { error } = await supabase.from("role_hierarchy").insert({
        parent_user_id: leadId,
        child_user_id: organiserId,
        assigned_by: assignedBy,
      } as any);
      if (error) throw error;
      toast({ title: "Linked", description: "Lead organiser linked to organiser" });
      setLeadId("");
      setOrganiserId("");
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("role_hierarchy")
        .select("id,parent_user_id,child_user_id")
        .eq("is_active", true)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order("created_at", { ascending: false });
      setLinks(data || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to create link", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const removeLink = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("role_hierarchy").update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
      if (error) throw error;
      setLinks(prev => prev.filter(l => l.id !== id));
      toast({ title: "Removed", description: "Link removed" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to remove link", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addDraftLink = async () => {
    if (!draftLeadId || !draftPendingId) {
      toast({ title: "Select both users", description: "Choose a lead and a draft organiser" });
      return;
    }
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const assignedBy = (auth as any)?.user?.id ?? null;
      const { error } = await supabase.from("lead_draft_organiser_links").insert({
        lead_user_id: draftLeadId,
        pending_user_id: draftPendingId,
        assigned_by: assignedBy,
      } as any);
      if (error) throw error;
      toast({ title: "Draft linked", description: "Lead organiser linked to draft organiser" });
      setDraftLeadId("");
      setDraftPendingId("");
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("lead_draft_organiser_links")
        .select("id,lead_user_id,pending_user_id")
        .eq("is_active", true)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order("created_at", { ascending: false });
      setDraftLinks(data || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to create draft link", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const removeDraftLink = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("lead_draft_organiser_links").update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
      if (error) throw error;
      setDraftLinks(prev => prev.filter(l => l.id !== id));
      toast({ title: "Removed", description: "Draft link removed" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to remove draft link", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const pendingLabel = (id: string) => {
    const p = pendingOrganisers.find(x => x.id === id);
    return p?.full_name || p?.email || id;
  };
  const pendingLeadLabel = (id: string) => {
    const p = pendingLeads.find(x => x.id === id);
    return p?.full_name || p?.email || id;
  };

  const addDraftLeadLink = async () => {
    if (!draftLeadPendingId || (!draftLeadToOrganiserId && !draftLeadToPendingId)) {
      toast({ title: "Select draft lead and a target", description: "Choose a draft lead and an organiser (live or draft)" });
      return;
    }
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const assignedBy = (auth as any)?.user?.id ?? null;
      const payload: any = { draft_lead_pending_user_id: draftLeadPendingId, assigned_by: assignedBy };
      if (draftLeadToOrganiserId) payload.organiser_user_id = draftLeadToOrganiserId;
      if (draftLeadToPendingId) payload.organiser_pending_user_id = draftLeadToPendingId;
      const { error } = await supabase.from("draft_lead_organiser_links").insert(payload);
      if (error) throw error;
      toast({ title: "Draft lead linked", description: "Draft lead linked to organiser" });
      setDraftLeadPendingId("");
      setDraftLeadToOrganiserId("");
      setDraftLeadToPendingId("");
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("draft_lead_organiser_links")
        .select("id,draft_lead_pending_user_id,organiser_user_id,organiser_pending_user_id")
        .eq("is_active", true)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order("created_at", { ascending: false });
      setDraftLeadLinks(data || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to create draft lead link", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const removeDraftLeadLink = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("draft_lead_organiser_links").update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
      if (error) throw error;
      setDraftLeadLinks(prev => prev.filter(l => l.id !== id));
      toast({ title: "Removed", description: "Draft lead link removed" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to remove draft lead link", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Organiser ↔ Organiser Links</CardTitle>
        <CardDescription>Assign lead organisers to manage organisers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm mb-2">Lead Organiser</div>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Select lead organiser" />
              </SelectTrigger>
              <SelectContent>
                {leads.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.full_name || l.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm mb-2">Organiser</div>
            <Select value={organiserId} onValueChange={setOrganiserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select organiser" />
              </SelectTrigger>
              <SelectContent>
                {organisers.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.full_name || o.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={addLink} disabled={loading} className="w-full">
              {loading ? <img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
              Link
            </Button>
          </div>
        </div>

        <div className="pt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead Organiser</TableHead>
                <TableHead>Organiser</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map(link => (
                <TableRow key={link.id}>
                  <TableCell>{getName(link.parent_user_id)}</TableCell>
                  <TableCell>{getName(link.child_user_id)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => removeLink(link.id)} disabled={loading}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="pt-6">
          <CardTitle>Lead Organiser ↔ Draft Organiser Links</CardTitle>
          <CardDescription>Plan relationships before inviting users</CardDescription>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <div className="text-sm mb-2">Lead Organiser</div>
              <Select value={draftLeadId} onValueChange={setDraftLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select lead organiser" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.full_name || l.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-sm mb-2">Draft organiser</div>
              <Select value={draftPendingId} onValueChange={setDraftPendingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select draft organiser" />
                </SelectTrigger>
                <SelectContent>
                  {pendingOrganisers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{pendingLabel(p.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={addDraftLink} disabled={loading} className="w-full">
                {loading ? <img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                Link draft
              </Button>
            </div>
          </div>
          <div className="pt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Organiser</TableHead>
                  <TableHead>Draft Organiser</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftLinks.map(link => (
                  <TableRow key={link.id}>
                    <TableCell>{getName(link.lead_user_id)}</TableCell>
                    <TableCell>{pendingLabel(link.pending_user_id)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => removeDraftLink(link.id)} disabled={loading}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="pt-6">
          <CardTitle>Draft Lead ↔ Organiser Links</CardTitle>
          <CardDescription>Allow draft leads to manage organisers (live or draft)</CardDescription>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
            <div>
              <div className="text-sm mb-2">Draft Lead</div>
              <Select value={draftLeadPendingId} onValueChange={setDraftLeadPendingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select draft lead" />
                </SelectTrigger>
                <SelectContent>
                  {pendingLeads.map(l => (
                    <SelectItem key={l.id} value={l.id}>{pendingLeadLabel(l.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-sm mb-2">Live Organiser</div>
              <Select value={draftLeadToOrganiserId} onValueChange={setDraftLeadToOrganiserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organiser (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {organisers.filter(o => o.role === 'organiser').map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.full_name || o.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-sm mb-2">Draft Organiser</div>
              <Select value={draftLeadToPendingId} onValueChange={setDraftLeadToPendingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select draft organiser (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {pendingOrganisers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{pendingLabel(p.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={addDraftLeadLink} disabled={loading} className="w-full">
                {loading ? <img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                Link draft lead
              </Button>
            </div>
          </div>
          <div className="pt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Draft Lead</TableHead>
                  <TableHead>Organiser</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftLeadLinks.map(link => {
                  const child = link.organiser_user_id ? (users.find(u => u.id === link.organiser_user_id)?.full_name || users.find(u => u.id === link.organiser_user_id)?.email || link.organiser_user_id) : pendingLabel(link.organiser_pending_user_id as string)
                  return (
                    <TableRow key={link.id}>
                      <TableCell>{pendingLeadLabel(link.draft_lead_pending_user_id)}</TableCell>
                      <TableCell>{child}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => removeDraftLeadLink(link.id)} disabled={loading}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
