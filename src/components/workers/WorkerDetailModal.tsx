import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkerForm } from "./WorkerForm";
import { WorkerPlacementsTab } from "./WorkerPlacementsTab";
import { WorkerUnionRolesTab } from "./WorkerUnionRolesTab";
import { WorkerActivitiesTab } from "./WorkerActivitiesTab";
import { WorkerRatingsTab } from "./WorkerRatingsTab";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, MapPin } from "lucide-react";
import { getWorkerColorCoding } from "@/utils/workerColorCoding";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface WorkerDetailModalProps {
  workerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export const WorkerDetailModal = ({ workerId, isOpen, onClose, onUpdate }: WorkerDetailModalProps) => {
  const [activeTab, setActiveTab] = useState("personal");
  const queryClient = useQueryClient();

  const { data: worker, isLoading } = useQuery({
    queryKey: ["worker-detail", workerId],
    queryFn: async () => {
      if (!workerId) return null;
      
      const { data, error } = await supabase
        .from("workers")
        .select(`
          *,
          incolink_member_id,
          organisers (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          worker_placements (
            id,
            start_date,
            end_date,
            job_title,
            employment_status,
            shift,
            job_sites (
              id,
              name,
              location
            ),
            employers (
              id,
              name
            )
          ),
          union_roles (
            id,
            name,
            start_date,
            end_date,
            is_senior,
            gets_paid_time,
            rating,
            experience_level,
            notes,
            job_sites (
              id,
              name
            )
          )
        `)
        .eq("id", workerId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!workerId && isOpen,
  });

  const handleWorkerUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["worker-detail", workerId] });
    onUpdate?.();
  };

  const getUnionStatusColor = (status: string, hasIncolinkId?: boolean) => {
    const info = getWorkerColorCoding(status || null, [], hasIncolinkId);
    return `${info.badgeClass} ${info.textColor} border`;
  };

  const formatUnionStatus = (status: string, hasIncolinkId?: boolean) => {
    if ((status === "unknown" || !status) && hasIncolinkId) {
      return "Incolink";
    }
    switch (status) {
      case "member":
        return "Member";
      case "non_member":
        return "Non-member";
      case "potential":
        return "Potential";
      case "declined":
        return "Declined";
      case "unknown":
        return "Unknown";
      default:
        return status || "Unknown";
    }
  };

  const getInitials = (firstName: string, surname: string) => {
    return `${firstName?.charAt(0) || ""}${surname?.charAt(0) || ""}`.toUpperCase();
  };

  if (!isOpen) return null;

  const fullName = worker ? `${worker.first_name || ""} ${worker.surname || ""}`.trim() : "";
  const currentPlacement = worker?.worker_placements?.[0];
  type WorkerUnionRole = { end_date: string | null } & Record<string, unknown>;
  const activeUnionRoles = worker?.union_roles?.filter((role: WorkerUnionRole) => !role.end_date || new Date(role.end_date) > new Date());
  const safeWorkerId = worker?.id ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>Worker Details</DialogTitle>
            {worker && (
              <Badge 
                className={getUnionStatusColor(worker.union_membership_status, !!worker.incolink_member_id)}
                style={{ ...getWorkerColorCoding(worker.union_membership_status || null, [], !!worker.incolink_member_id).badgeStyle, ...getWorkerColorCoding(worker.union_membership_status || null, [], !!worker.incolink_member_id).borderStyle }}
              >
                {formatUnionStatus(worker.union_membership_status, !!worker.incolink_member_id)}
              </Badge>
            )}
          </div>
          
          {worker && (
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <Avatar className="h-16 w-16">
                <AvatarFallback 
                  className={getUnionStatusColor(worker.union_membership_status, !!worker.incolink_member_id)}
                  style={{ ...getWorkerColorCoding(worker.union_membership_status || null, [], !!worker.incolink_member_id).badgeStyle, ...getWorkerColorCoding(worker.union_membership_status || null, [], !!worker.incolink_member_id).borderStyle }}
                >
                  {getInitials(worker.first_name, worker.surname)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{fullName}</h2>
                {worker.nickname && (
                  <p className="text-muted-foreground">"{worker.nickname}"</p>
                )}
                {worker.member_number && (
                  <p className="text-sm text-muted-foreground">Union Member: {worker.member_number}</p>
                )}
                {worker.incolink_member_id && !worker.member_number && (
                  <p className="text-sm text-muted-foreground">Incolink ID: {worker.incolink_member_id}</p>
                )}
                
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {worker.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {worker.email}
                    </div>
                  )}
                  {worker.mobile_phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {worker.mobile_phone}
                    </div>
                  )}
                  {currentPlacement?.job_sites?.name && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {currentPlacement.job_sites.name}
                    </div>
                  )}
                </div>
                
                {activeUnionRoles && activeUnionRoles.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {activeUnionRoles.map((role: WorkerUnionRole & { id: string; name: string; is_senior?: boolean }) => (
                      <Badge key={role.id} variant="outline">{role.name}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading worker details…</div>
        ) : worker ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList>
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="placements">Placements</TabsTrigger>
              <TabsTrigger value="roles">Union Roles</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="ratings">Ratings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="personal" className="p-2">
              <WorkerForm worker={worker} onSuccess={handleWorkerUpdate} />
            </TabsContent>
            <TabsContent value="placements" className="p-2">
              <WorkerPlacementsTab workerId={safeWorkerId} onUpdate={handleWorkerUpdate} />
            </TabsContent>
            <TabsContent value="roles" className="p-2">
              <WorkerUnionRolesTab workerId={safeWorkerId} onUpdate={handleWorkerUpdate} />
            </TabsContent>
            <TabsContent value="activity" className="p-2">
              <WorkerActivitiesTab workerId={safeWorkerId} onUpdate={handleWorkerUpdate} />
            </TabsContent>
            <TabsContent value="ratings" className="p-2">
              <WorkerRatingsTab workerId={safeWorkerId} onUpdate={handleWorkerUpdate} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">Worker not found.</div>
        )}
      </DialogContent>
    </Dialog>
  );
};
