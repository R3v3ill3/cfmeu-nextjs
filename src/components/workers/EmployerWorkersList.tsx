import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, Shield, Phone, Mail, Plus } from "lucide-react";
import { UnionRoleAssignmentModal } from "./UnionRoleAssignmentModal";
import { WorkerDetailModal } from "./WorkerDetailModal";
import { WorkerCard } from "./WorkerCard";

interface EmployerWorkersListProps {
  employerId: string;
}

type WorkerWithRoles = {
  id: string;
  first_name: string;
  surname: string;
  email: string | null;
  mobile_phone: string | null;
  union_membership_status: string;
  member_number: string | null;
  worker_placements: Array<{
    job_title: string | null;
    employment_status: string;
    start_date: string;
    end_date: string | null;
  }>;
  union_roles: Array<{
    id: string;
    name: string;
    is_senior: boolean;
    gets_paid_time: boolean;
    start_date: string;
    end_date: string | null;
  }>;
};

export const EmployerWorkersList = ({ employerId }: EmployerWorkersListProps) => {
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [showWorkerDetail, setShowWorkerDetail] = useState(false);

  const { data: workers, isLoading, refetch } = useQuery({
    queryKey: ["employer-workers", employerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workers")
        .select(`
          id,
          first_name,
          surname,
          email,
          mobile_phone,
          union_membership_status,
          member_number,
          worker_placements!inner (
            job_title,
            employment_status,
            start_date,
            end_date
          ),
          union_roles (
            id,
            name,
            is_senior,
            gets_paid_time,
            start_date,
            end_date
          )
        `)
        .eq("worker_placements.employer_id", employerId);

      if (error) throw error;
      return data as WorkerWithRoles[];
    },
    enabled: !!employerId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!workers || workers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Workers</h3>
          <p className="text-muted-foreground text-center">
            No workers are currently allocated to this employer.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Categorize workers by union roles
  const delegates = workers.filter(w => w.union_roles.some(r => r.name.includes('delegate')));
  const hsrs = workers.filter(w => w.union_roles.some(r => r.name === 'hsr'));
  const regularWorkers = workers.filter(w => w.union_roles.length === 0);
  const hasUnionRoles = delegates.length > 0 || hsrs.length > 0;

  const getUnionStatusVariant = (status: string) => {
    switch (status) {
      case 'member': return 'default';
      case 'non_member': return 'secondary';
      case 'former_member': return 'outline';
      default: return 'secondary';
    }
  };

  const formatUnionStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleWorkerClick = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setShowWorkerDetail(true);
  };

  return (
    <div className="space-y-6">
      {/* Union Roles Assignment Prompt */}
      {!hasUnionRoles && (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <UserCheck className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Assign Union Roles</h3>
            <p className="text-muted-foreground text-center mb-4">
              You have {workers.length} workers but no delegates or HSRs assigned. 
              Assign union roles to help organize your workplace.
            </p>
            <Button onClick={() => setShowRoleAssignment(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Assign Union Roles
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delegates Section */}
      {delegates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              Delegates ({delegates.length})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowRoleAssignment(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </div>
          {delegates.map(worker => (
            <WorkerCard 
              key={worker.id} 
              worker={worker} 
              variant="card"
              onClick={() => handleWorkerClick(worker.id)}
              onUpdate={refetch}
            />
          ))}
        </div>
      )}

      {/* HSRs Section */}
      {hsrs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              Health & Safety Representatives ({hsrs.length})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowRoleAssignment(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </div>
          {hsrs.map(worker => (
            <WorkerCard 
              key={worker.id} 
              worker={worker} 
              variant="card"
              onClick={() => handleWorkerClick(worker.id)}
              onUpdate={refetch}
            />
          ))}
        </div>
      )}

      {/* Regular Workers Section */}
      {regularWorkers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Workers ({regularWorkers.length})
            </CardTitle>
            {hasUnionRoles && (
              <Button size="sm" variant="outline" onClick={() => setShowRoleAssignment(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Role
              </Button>
            )}
          </div>
          {regularWorkers.map(worker => (
            <WorkerCard 
              key={worker.id} 
              worker={worker} 
              variant="card"
              onClick={() => handleWorkerClick(worker.id)}
              onUpdate={refetch}
            />
          ))}
        </div>
      )}

      {/* Union Role Assignment Modal */}
      <UnionRoleAssignmentModal
        isOpen={showRoleAssignment}
        onClose={() => setShowRoleAssignment(false)}
        employerId={employerId}
        workers={workers}
        onSuccess={() => {
          setShowRoleAssignment(false);
          refetch();
        }}
      />

      {/* Worker Detail Modal */}
      <WorkerDetailModal
        workerId={selectedWorkerId}
        isOpen={showWorkerDetail}
        onClose={() => {
          setShowWorkerDetail(false);
          setSelectedWorkerId(null);
        }}
        onUpdate={refetch}
      />
    </div>
  );
};