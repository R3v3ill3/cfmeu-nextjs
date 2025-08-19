
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Impact = {
  site_count: number;
  site_contractor_trades_count: number;
  site_contacts_count: number;
  site_employers_count: number;
  union_activities_count: number;
  worker_placements_count: number;
  project_contractor_trades_count: number;
  project_employer_roles_count: number;
  project_organisers_count: number;
  project_builder_jv_count: number;
  project_eba_details_count: number;
};

export function DeleteProjectDialog({
  projectId,
  projectName,
  triggerText = "Delete",
}: {
  projectId: string;
  projectName: string;
  triggerText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();

  const { data: impact, isLoading, refetch } = useQuery({
    queryKey: ["project-delete-impact", projectId],
    enabled: false, // only fetch when dialog opens
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_project_delete_impact", { p_project_id: projectId });
      if (error) throw error;
      // returns table -> array of one row
      const row = (data as Impact[] | null)?.[0] || null;
      return row;
    },
  });

  useEffect(() => {
    if (open) {
      setConfirmText("");
      refetch();
    }
  }, [open, refetch]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_project_cascade", { p_project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
    },
    onError: (err) => {
      toast.error("Failed to delete project: " + (err as Error).message);
    },
  });

  const canDelete = useMemo(() => confirmText.trim().toUpperCase() === "DELETE", [confirmText]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">{triggerText}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            This will permanently remove “{projectName}” and related data. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <div className="font-medium mb-2">What will be deleted</div>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading impact...</div>
            ) : impact ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Job Sites</span>
                  <Badge variant="secondary">{impact.site_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Site Contractor Trades</span>
                  <Badge variant="secondary">{impact.site_contractor_trades_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Site Contacts</span>
                  <Badge variant="secondary">{impact.site_contacts_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Site Employers</span>
                  <Badge variant="secondary">{impact.site_employers_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Union Activities</span>
                  <Badge variant="secondary">{impact.union_activities_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Worker Placements</span>
                  <Badge variant="secondary">{impact.worker_placements_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Project Trade Contractors</span>
                  <Badge variant="secondary">{impact.project_contractor_trades_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Employer Roles</span>
                  <Badge variant="secondary">{impact.project_employer_roles_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Organisers</span>
                  <Badge variant="secondary">{impact.project_organisers_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Builder JV Metadata</span>
                  <Badge variant="secondary">{impact.project_builder_jv_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Project EBA Details</span>
                  <Badge variant="secondary">{impact.project_eba_details_count}</Badge>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No impact data available.</div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_delete">Type DELETE to confirm</Label>
            <Input
              id="confirm_delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={!canDelete || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteProjectDialog;
