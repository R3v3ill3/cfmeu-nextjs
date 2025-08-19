import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link as LinkIcon, Trash2 } from "lucide-react";

interface RoleHierarchyManagerProps {
  users: Array<{ id: string; full_name: string; email: string; role: string }>;
}

export const RoleHierarchyManager = ({ users }: RoleHierarchyManagerProps) => {
  const { toast } = useToast();
  const [leadId, setLeadId] = useState<string>("");
  const [organiserId, setOrganiserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<Array<{ id: string; parent_user_id: string; child_user_id: string }>>([]);

  const leads = useMemo(() => users.filter(u => u.role === "lead_organiser"), [users]);
  const organisers = useMemo(() => users.filter(u => u.role === "organiser"), [users]);

  const getName = (id: string) => users.find(u => u.id === id)?.full_name || users.find(u => u.id === id)?.email || id;

  useEffect(() => {
    const fetchLinks = async () => {
      const { data, error } = await supabase
        .from("role_hierarchy")
        .select("id,parent_user_id,child_user_id")
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

  const addLink = async () => {
    if (!leadId || !organiserId) {
      toast({ title: "Select both users", description: "Choose a lead and an organiser" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("role_hierarchy").insert({
        parent_user_id: leadId,
        child_user_id: organiserId,
      });
      if (error) throw error;
      toast({ title: "Linked", description: "Lead organiser linked to organiser" });
      setLeadId("");
      setOrganiserId("");
      // refresh
      const { data } = await supabase
        .from("role_hierarchy")
        .select("id,parent_user_id,child_user_id")
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
      const { error } = await supabase.from("role_hierarchy").delete().eq("id", id);
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
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-2" />}
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
      </CardContent>
    </Card>
  );
};
