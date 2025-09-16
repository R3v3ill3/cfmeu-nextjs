"use client"

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface WorkerSelectorProps {
  projectId: string;
  title: string;
  onSelect: (workerId: string) => void;
  onClose: () => void;
}

export function WorkerSelector({ projectId, title, onSelect, onClose }: WorkerSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddWorker, setShowAddWorker] = useState(false);

  // Fetch workers on this project
  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["project-workers", projectId],
    queryFn: async () => {
      // Get all job sites for this project
      const { data: jobSites, error: sitesError } = await supabase
        .from("job_sites")
        .select("id")
        .eq("project_id", projectId);

      if (sitesError) throw sitesError;

      if (!jobSites || jobSites.length === 0) return [];

      // Get all worker placements for these job sites
      const siteIds = jobSites.map(s => s.id);
      const { data: placements, error: placementsError } = await supabase
        .from("worker_placements")
        .select(`
          worker_id,
          workers (
            id,
            first_name,
            surname,
            mobile_phone,
            union_membership_status,
            employers (
              id,
              name
            )
          )
        `)
        .in("job_site_id", siteIds);

      if (placementsError) throw placementsError;

      // Deduplicate workers
      const uniqueWorkers = new Map();
      (placements || []).forEach((p: any) => {
        if (p.workers && !uniqueWorkers.has(p.workers.id)) {
          uniqueWorkers.set(p.workers.id, p.workers);
        }
      });

      return Array.from(uniqueWorkers.values());
    },
    enabled: !!projectId
  });

  const filteredWorkers = workers.filter((worker: any) => {
    const fullName = `${worker.first_name} ${worker.surname}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  const handleAddWorker = () => {
    // TODO: Implement add worker functionality
    setShowAddWorker(true);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Workers List */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading workers...</div>
          ) : workers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No workers found on this project</p>
              <Button onClick={handleAddWorker}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Workers
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredWorkers.map((worker: any) => (
                  <div
                    key={worker.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => onSelect(worker.id)}
                  >
                    <div>
                      <div className="font-medium">
                        {worker.first_name} {worker.surname}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {worker.mobile_phone || "No phone"}
                        {worker.employers && (
                          <span className="ml-2">• {worker.employers.name}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant={worker.union_membership_status === 'member' ? 'default' : 'secondary'}>
                      {worker.union_membership_status || 'Unknown'}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* No results */}
          {workers.length > 0 && filteredWorkers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No workers match your search</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
