import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  User, 
  Users, 
  Search,
  CheckCircle2,
  UserCheck,
  ArrowRight,
  History
} from "lucide-react";
import type { WorkerAssignment } from "./WorkerAssignmentTabs";
import { format } from "date-fns";

type AssignedWorker = {
  workerId: string;
  workerName: string;
};

type PreviousDelegation = {
  delegateWorkerId: string;
  delegateWorkerName: string;
  assignedWorkers: AssignedWorker[];
  activityId: string;
  activityDate: string;
};

export interface DelegationAssignment {
  delegateWorkerId: string;
  delegateWorkerName: string;
  assignedWorkerIds: string[];
  assignedWorkerNames: string[];
  sourceActivityId?: string;
  assignmentType: 'manual' | 'carry_forward' | 'auto_assigned';
}

interface DelegationManagerProps {
  selectedWorkers: WorkerAssignment[];
  delegations: DelegationAssignment[];
  onDelegationsChange: (delegations: DelegationAssignment[]) => void;
  enableCarryForward?: boolean;
}

export function DelegationManager({ 
  selectedWorkers, 
  delegations, 
  onDelegationsChange,
  enableCarryForward = true 
}: DelegationManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [autoCarryForward, setAutoCarryForward] = useState(enableCarryForward);

  // Get previous "1" rated workers who could be delegates
  const { data: potentialDelegates = [] } = useQuery({
    queryKey: ["potential_delegates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_activity_ratings")
        .select(`
          worker_id,
          activity_id,
          workers!inner(id, first_name, surname, member_number),
          union_activities!inner(id, date, activity_type)
        `)
        .eq("rating_type", "support_level")
        .eq("rating_value", 1)
        .order("activity_id", { foreignTable: "union_activities", ascending: false });
      
      if (error) throw error;
      
      // Group by worker and get their most recent "1" rating
      const delegateMap = new Map();
      data.forEach((rating: any) => {
        if (!delegateMap.has(rating.worker_id)) {
          delegateMap.set(rating.worker_id, {
            workerId: rating.worker_id,
            workerName: `${rating.workers.first_name} ${rating.workers.surname}`,
            memberNumber: rating.workers.member_number,
            lastActivityId: rating.activity_id,
            lastActivityDate: rating.union_activities.date,
            lastActivityType: rating.union_activities.activity_type
          });
        }
      });
      
      return Array.from(delegateMap.values());
    }
  });

  // Get previous delegations for carry-forward
  const { data: previousDelegations = [] } = useQuery<PreviousDelegation[]>({
    queryKey: ["previous_delegations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_delegations")
        .select(`
          delegate_worker_id,
          assigned_worker_id,
          activity_id,
          workers!activity_delegations_delegate_worker_id_fkey(first_name, surname),
          assigned_workers:workers!activity_delegations_assigned_worker_id_fkey(first_name, surname),
          union_activities!inner(date)
        `)
        .order("activity_id", { foreignTable: "union_activities", ascending: false });
      
      if (error) throw error;
      
      // Group by delegate and get their most recent delegations
      const delegationMap = new Map<string, PreviousDelegation>();
      data.forEach((del: any) => {
        const key = String(del.delegate_worker_id);
        if (!delegationMap.has(key)) {
          delegationMap.set(key, {
            delegateWorkerId: del.delegate_worker_id,
            delegateWorkerName: `${del.workers.first_name} ${del.workers.surname}`,
            assignedWorkers: [],
            activityId: del.activity_id,
            activityDate: del.union_activities.date
          });
        }
        const delegation = delegationMap.get(key)!;
        delegation.assignedWorkers.push({
          workerId: del.assigned_worker_id,
          workerName: `${del.assigned_workers.first_name} ${del.assigned_workers.surname}`
        });
      });
      return Array.from(delegationMap.values());
    },
    enabled: enableCarryForward
  });

  const filteredDelegates = potentialDelegates.filter(delegate =>
    delegate.workerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (delegate.memberNumber && delegate.memberNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const availableWorkers = selectedWorkers.filter(worker => 
    !delegations.some(del => 
      del.delegateWorkerId === worker.workerId || 
      del.assignedWorkerIds.includes(worker.workerId)
    )
  );

  const handleDelegateSelection = (delegate: any) => {
    const existingDelegation = delegations.find(d => d.delegateWorkerId === delegate.workerId);
    
    if (existingDelegation) {
      // Remove delegation
      onDelegationsChange(delegations.filter(d => d.delegateWorkerId !== delegate.workerId));
    } else {
      // Add new delegation
      let assignedWorkerIds: string[] = [];
      let assignedWorkerNames: string[] = [];
      let assignmentType: 'manual' | 'carry_forward' | 'auto_assigned' = 'manual';
      let sourceActivityId: string | undefined;

      // Check if we should carry forward from previous activity
      if (autoCarryForward) {
        const previousDelegation = previousDelegations.find(pd => pd.delegateWorkerId === delegate.workerId);
        if (previousDelegation) {
          // Only carry forward workers who are in the selected workers list
          const carryForwardWorkers = previousDelegation.assignedWorkers.filter((aw: AssignedWorker) =>
            selectedWorkers.some(sw => sw.workerId === aw.workerId)
          );
          
          if (carryForwardWorkers.length > 0) {
            assignedWorkerIds = carryForwardWorkers.map(w => w.workerId);
            assignedWorkerNames = carryForwardWorkers.map(w => w.workerName);
            assignmentType = 'carry_forward';
            sourceActivityId = previousDelegation.activityId;
          }
        }
      }

      const newDelegation: DelegationAssignment = {
        delegateWorkerId: delegate.workerId,
        delegateWorkerName: delegate.workerName,
        assignedWorkerIds,
        assignedWorkerNames,
        sourceActivityId,
        assignmentType
      };

      onDelegationsChange([...delegations, newDelegation]);
    }
  };

  const handleWorkerAssignment = (delegateWorkerId: string, workerId: string, workerName: string, assigned: boolean) => {
    const updatedDelegations = delegations.map(delegation => {
      if (delegation.delegateWorkerId === delegateWorkerId) {
        if (assigned) {
          return {
            ...delegation,
            assignedWorkerIds: [...delegation.assignedWorkerIds, workerId],
            assignedWorkerNames: [...delegation.assignedWorkerNames, workerName]
          };
        } else {
          return {
            ...delegation,
            assignedWorkerIds: delegation.assignedWorkerIds.filter(id => id !== workerId),
            assignedWorkerNames: delegation.assignedWorkerNames.filter(name => name !== workerName)
          };
        }
      }
      return delegation;
    });

    onDelegationsChange(updatedDelegations);
  };

  const getDelegationStats = () => {
    const totalDelegates = delegations.length;
    const totalAssigned = delegations.reduce((sum, del) => sum + del.assignedWorkerIds.length, 0);
    const unassigned = selectedWorkers.length - totalAssigned - totalDelegates;
    
    return { totalDelegates, totalAssigned, unassigned };
  };

  const stats = getDelegationStats();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Delegation Management</h3>
        <p className="text-sm text-muted-foreground">
          Assign workers to delegates who have previously shown strong engagement (rated "1").
        </p>
      </div>

      {enableCarryForward && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-carry-forward" className="text-sm font-medium">
                Auto Carry-Forward Previous Delegations
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically assign workers from previous activities to the same delegates
              </p>
            </div>
            <Switch
              id="auto-carry-forward"
              checked={autoCarryForward}
              onCheckedChange={setAutoCarryForward}
            />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delegate Selection */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Select Delegates
              </h4>
              <Badge variant="secondary">
                {filteredDelegates.length} available
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search delegates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredDelegates.map((delegate) => {
                  const isSelected = delegations.some(d => d.delegateWorkerId === delegate.workerId);
                  const carryForwardCount = autoCarryForward 
                    ? previousDelegations.find(pd => pd.delegateWorkerId === delegate.workerId)?.assignedWorkers.length || 0
                    : 0;
                  
                  return (
                    <div
                      key={delegate.workerId}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleDelegateSelection(delegate)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{delegate.workerName}</span>
                            {delegate.memberNumber && (
                              <Badge variant="outline" className="text-xs">
                                {delegate.memberNumber}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <History className="h-3 w-3" />
                            Last "1" rating: {format(new Date(delegate.lastActivityDate), "dd/MM/yyyy")}
                            {carryForwardCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {carryForwardCount} to carry forward
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </Card>

        {/* Worker Assignment */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assign Workers
              </h4>
              <Badge variant="secondary">
                {availableWorkers.length} unassigned
              </Badge>
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-4">
                {delegations.map((delegation) => (
                  <div key={delegation.delegateWorkerId} className="space-y-3">
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <UserCheck className="h-4 w-4" />
                      <span className="font-medium">{delegation.delegateWorkerName}</span>
                      {delegation.assignmentType === 'carry_forward' && (
                        <Badge variant="outline" className="text-xs">
                          Carried Forward
                        </Badge>
                      )}
                    </div>

                    <div className="pl-6 space-y-2">
                      {selectedWorkers
                        .filter(worker => 
                          worker.workerId !== delegation.delegateWorkerId &&
                          !delegations.some(del => 
                            del.delegateWorkerId !== delegation.delegateWorkerId && 
                            del.assignedWorkerIds.includes(worker.workerId)
                          )
                        )
                        .map((worker) => {
                          const isAssigned = delegation.assignedWorkerIds.includes(worker.workerId);
                          
                          return (
                            <div key={worker.workerId} className="flex items-center space-x-3">
                              <Checkbox
                                checked={isAssigned}
                                onCheckedChange={(checked: boolean | "indeterminate") => 
                                  handleWorkerAssignment(
                                    delegation.delegateWorkerId, 
                                    worker.workerId, 
                                    worker.workerName, 
                                    Boolean(checked)
                                  )
                                }
                              />
                              <span className="text-sm">{worker.workerName}</span>
                              <Badge variant="outline" className="text-xs">
                                {worker.method.replace('_', ' ')}
                              </Badge>
                            </div>
                          );
                        })}
                    </div>

                    {delegation.assignedWorkerIds.length > 0 && (
                      <div className="pl-6 text-xs text-muted-foreground">
                        {delegation.assignedWorkerIds.length} workers assigned
                      </div>
                    )}

                    <Separator />
                  </div>
                ))}

                {delegations.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Select delegates to start assigning workers</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </Card>
      </div>

      {/* Summary */}
      <Card className="p-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">{stats.totalDelegates}</div>
            <div className="text-sm text-muted-foreground">Delegates</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.totalAssigned}</div>
            <div className="text-sm text-muted-foreground">Assigned Workers</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{stats.unassigned}</div>
            <div className="text-sm text-muted-foreground">Unassigned</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{selectedWorkers.length}</div>
            <div className="text-sm text-muted-foreground">Total Workers</div>
          </div>
        </div>
      </Card>
    </div>
  );
}