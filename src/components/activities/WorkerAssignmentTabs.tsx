import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Building2, 
  MapPin, 
  Users, 
  Search,
  CheckCircle2
} from "lucide-react";

export interface WorkerAssignment {
  workerId: string;
  workerName: string;
  method: 'individual' | 'by_employer' | 'by_job_site' | 'by_organiser' | 'by_employer_site';
  sourceId?: string;
  sourceName?: string;
}

type WorkerRecord = {
  id: string;
  first_name: string;
  surname: string;
  member_number: string | null;
  union_membership_status: string;
  organiser_id: string | null;
}

type Employer = { id: string; name: string }
type JobSite = { id: string; name: string; location: string }
type OrganiserRecord = { id: string; full_name: string }
type WorkerPlacementRecord = {
  worker_id: string;
  employer_id: string;
  job_site_id: string;
  workers?: { id: string; first_name: string; surname: string };
  employers?: { id: string; name: string };
  job_sites?: { id: string; name: string; location: string };
}

interface WorkerAssignmentTabsProps {
  selectedWorkers: WorkerAssignment[];
  onWorkersChange: (workers: WorkerAssignment[]) => void;
}

export function WorkerAssignmentTabs({ selectedWorkers, onWorkersChange }: WorkerAssignmentTabsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployers, setSelectedEmployers] = useState<string[]>([]);
  const [selectedJobSites, setSelectedJobSites] = useState<string[]>([]);
  const [selectedOrganisers, setSelectedOrganisers] = useState<string[]>([]);
  const [employerSiteSelections, setEmployerSiteSelections] = useState<Record<string, string[]>>({});

  // Fetch workers
  const { data: workers = [] } = useQuery<WorkerRecord[]>({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workers")
        .select(`
          id,
          first_name,
          surname,
          member_number,
          union_membership_status,
          organiser_id
        `)
        .order("first_name");
      
      if (error) throw error;
      return (data || []) as WorkerRecord[];
    }
  });

  // Fetch employers
  const { data: employers = [] } = useQuery<Employer[]>({
    queryKey: ["employers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employers")
        .select("id, name")
        .order("name");
      
      if (error) throw error;
      return (data || []) as Employer[];
    }
  });

  // Fetch job sites
  const { data: jobSites = [] } = useQuery<JobSite[]>({
    queryKey: ["job_sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name, location")
        .order("name");
      
      if (error) throw error;
      return (data || []) as JobSite[];
    }
  });

  // Fetch organisers
  const { data: organisers = [] } = useQuery<OrganiserRecord[]>({
    queryKey: ["organisers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      
      if (error) throw error;
      return (data || []).map((p: any) => ({ id: p.id, full_name: p.full_name })) as OrganiserRecord[];
    }
  });

  // Fetch worker placements for employer-site combinations
  const { data: workerPlacements = [] } = useQuery<WorkerPlacementRecord[]>({
    queryKey: ["worker_placements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_placements")
        .select(`
          worker_id,
          employer_id,
          job_site_id,
          workers!inner(id, first_name, surname),
          employers!inner(id, name),
          job_sites!inner(id, name, location)
        `)
        .not("end_date", "lt", new Date().toISOString().split('T')[0]);
      
      if (error) throw error;
      return ((data || []) as unknown) as WorkerPlacementRecord[];
    }
  });

  const filteredWorkers = workers.filter(worker =>
    `${worker.first_name} ${worker.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (worker.member_number && worker.member_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleIndividualWorkerToggle = (worker: any, checked: boolean) => {
    if (checked) {
      const newAssignment: WorkerAssignment = {
        workerId: worker.id,
        workerName: `${worker.first_name} ${worker.surname}`,
        method: 'individual'
      };
      onWorkersChange([...selectedWorkers.filter(w => w.workerId !== worker.id), newAssignment]);
    } else {
      onWorkersChange(selectedWorkers.filter(w => w.workerId !== worker.id));
    }
  };

  const handleEmployerSelection = (employerId: string, checked: boolean) => {
    const newSelectedEmployers = checked
      ? [...selectedEmployers, employerId]
      : selectedEmployers.filter(id => id !== employerId);
    
    setSelectedEmployers(newSelectedEmployers);
    updateWorkerAssignments();
  };

  const handleJobSiteSelection = (jobSiteId: string, checked: boolean) => {
    const newSelectedJobSites = checked
      ? [...selectedJobSites, jobSiteId]
      : selectedJobSites.filter(id => id !== jobSiteId);
    
    setSelectedJobSites(newSelectedJobSites);
    updateWorkerAssignments();
  };

  const handleOrganiserSelection = (organiserId: string, checked: boolean) => {
    const newSelectedOrganisers = checked
      ? [...selectedOrganisers, organiserId]
      : selectedOrganisers.filter(id => id !== organiserId);
    
    setSelectedOrganisers(newSelectedOrganisers);
    updateWorkerAssignments();
  };

  const handleEmployerSiteSelection = (employerId: string, jobSiteId: string, checked: boolean) => {
    const current = employerSiteSelections[employerId] || [];
    const updated = checked
      ? [...current, jobSiteId]
      : current.filter(id => id !== jobSiteId);
    
    setEmployerSiteSelections({
      ...employerSiteSelections,
      [employerId]: updated
    });
    updateWorkerAssignments();
  };

  const updateWorkerAssignments = useCallback(() => {
    const newAssignments: WorkerAssignment[] = [];

    // Add assignments from employers
    selectedEmployers.forEach(employerId => {
      const employer = employers.find(e => e.id === employerId);
      const employerWorkers = workerPlacements.filter(wp => wp.employer_id === employerId);
      
      employerWorkers.forEach(wp => {
        if (wp.workers) {
          newAssignments.push({
            workerId: wp.worker_id,
            workerName: `${wp.workers.first_name} ${wp.workers.surname}`,
            method: 'by_employer',
            sourceId: employerId,
            sourceName: employer?.name
          });
        }
      });
    });

    // Add assignments from job sites
    selectedJobSites.forEach(jobSiteId => {
      const jobSite = jobSites.find(js => js.id === jobSiteId);
      const siteWorkers = workerPlacements.filter(wp => wp.job_site_id === jobSiteId);
      
      siteWorkers.forEach(wp => {
        if (wp.workers) {
          newAssignments.push({
            workerId: wp.worker_id,
            workerName: `${wp.workers.first_name} ${wp.workers.surname}`,
            method: 'by_job_site',
            sourceId: jobSiteId,
            sourceName: jobSite?.name
          });
        }
      });
    });

    // Add assignments from organisers
    selectedOrganisers.forEach(organiserId => {
      const organiser = organisers.find((o: any) => o.id === organiserId);
      const organiserWorkers = workers.filter(w => w.organiser_id === organiserId);
      
      organiserWorkers.forEach(worker => {
        newAssignments.push({
          workerId: worker.id,
          workerName: `${worker.first_name} ${worker.surname}`,
          method: 'by_organiser',
          sourceId: organiserId,
          sourceName: organiser?.full_name
        });
      });
    });

    // Add assignments from employer-site combinations
    Object.entries(employerSiteSelections).forEach(([employerId, jobSiteIds]) => {
      const employer = employers.find(e => e.id === employerId);
      
      jobSiteIds.forEach(jobSiteId => {
        const jobSite = jobSites.find(js => js.id === jobSiteId);
        const combinationWorkers = workerPlacements.filter(
          wp => wp.employer_id === employerId && wp.job_site_id === jobSiteId
        );
        
        combinationWorkers.forEach(wp => {
          if (wp.workers) {
            newAssignments.push({
              workerId: wp.worker_id,
              workerName: `${wp.workers.first_name} ${wp.workers.surname}`,
              method: 'by_employer_site',
              sourceId: `${employerId}-${jobSiteId}`,
              sourceName: `${employer?.name} - ${jobSite?.name}`
            });
          }
        });
      });
    });

    // Combine with individually selected workers
    const individualAssignments = selectedWorkers.filter(w => w.method === 'individual');
    
    // Remove duplicates by worker ID, prioritizing method order
    const uniqueAssignments = new Map<string, WorkerAssignment>();
    [...individualAssignments, ...newAssignments].forEach(assignment => {
      if (!uniqueAssignments.has(assignment.workerId)) {
        uniqueAssignments.set(assignment.workerId, assignment);
      }
    });

    onWorkersChange(Array.from(uniqueAssignments.values()));
  }, [
    selectedEmployers,
    employers,
    workerPlacements,
    selectedJobSites,
    jobSites,
    selectedOrganisers,
    organisers,
    employerSiteSelections,
    selectedWorkers,
    onWorkersChange
  ]);

  useEffect(() => {
    updateWorkerAssignments();
  }, [updateWorkerAssignments]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Assign Workers</h3>
        <p className="text-sm text-muted-foreground">
          Select workers individually or assign by employer, job site, or organiser.
        </p>
      </div>

      <Tabs defaultValue="individual" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Individual
          </TabsTrigger>
          <TabsTrigger value="employer" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            By Employer
          </TabsTrigger>
          <TabsTrigger value="jobsite" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            By Job Site
          </TabsTrigger>
          <TabsTrigger value="organiser" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            By Organiser
          </TabsTrigger>
          <TabsTrigger value="combination" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Employer + Site
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workers by name or member number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {filteredWorkers.map((worker) => {
                const isSelected = selectedWorkers.some(w => w.workerId === worker.id);
                
                return (
                  <Card key={worker.id} className="p-3">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked: boolean | "indeterminate") => 
                          handleIndividualWorkerToggle(worker, Boolean(checked))
                        }
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {worker.first_name} {worker.surname}
                          </span>
                          {worker.member_number && (
                            <Badge variant="outline" className="text-xs">
                              {worker.member_number}
                            </Badge>
                          )}
                          <Badge 
                            variant={worker.union_membership_status === 'member' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {worker.union_membership_status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="employer" className="space-y-4">
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {employers.map((employer) => {
                const workerCount = workerPlacements.filter(wp => wp.employer_id === employer.id).length;
                const isSelected = selectedEmployers.includes(employer.id);
                
                return (
                  <Card key={employer.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked: boolean | "indeterminate") => 
                            handleEmployerSelection(employer.id, Boolean(checked))
                          }
                        />
                        <div>
                          <span className="font-medium">{employer.name}</span>
                          <p className="text-sm text-muted-foreground">
                            {workerCount} workers
                          </p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="jobsite" className="space-y-4">
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {jobSites.map((jobSite) => {
                const workerCount = workerPlacements.filter(wp => wp.job_site_id === jobSite.id).length;
                const isSelected = selectedJobSites.includes(jobSite.id);
                
                return (
                  <Card key={jobSite.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked: boolean | "indeterminate") => 
                            handleJobSiteSelection(jobSite.id, Boolean(checked))
                          }
                        />
                        <div>
                          <span className="font-medium">{jobSite.name}</span>
                          <p className="text-sm text-muted-foreground">
                            {jobSite.location} • {workerCount} workers
                          </p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="organiser" className="space-y-4">
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {organisers.map((organiser: any) => {
                const workerCount = workers.filter(w => w.organiser_id === organiser.id).length;
                const isSelected = selectedOrganisers.includes(organiser.id);
                
                return (
                  <Card key={organiser.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked: boolean | "indeterminate") => 
                            handleOrganiserSelection(organiser.id, Boolean(checked))
                          }
                        />
                        <div>
                          <span className="font-medium">{organiser.full_name}</span>
                          <p className="text-sm text-muted-foreground">
                            {workerCount} workers
                          </p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="combination" className="space-y-4">
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {employers.map((employer) => {
                const employerJobSites = workerPlacements
                  .filter(wp => wp.employer_id === employer.id)
                  .reduce((acc, wp) => {
                    if (wp.job_sites && !acc.find(js => js.id === wp.job_site_id)) {
                      acc.push(wp.job_sites);
                    }
                    return acc;
                  }, [] as any[]);

                if (employerJobSites.length === 0) return null;

                return (
                  <Card key={employer.id} className="p-4">
                    <h4 className="font-medium mb-3">{employer.name}</h4>
                    <div className="space-y-2">
                      {employerJobSites.map((jobSite) => {
                        const workerCount = workerPlacements.filter(
                          wp => wp.employer_id === employer.id && wp.job_site_id === jobSite.id
                        ).length;
                        const isSelected = (employerSiteSelections[employer.id] || []).includes(jobSite.id);
                        
                        return (
                          <div key={jobSite.id} className="flex items-center justify-between pl-4">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked: boolean | "indeterminate") => 
                                  handleEmployerSiteSelection(employer.id, jobSite.id, Boolean(checked))
                                }
                              />
                              <div>
                                <span className="text-sm font-medium">{jobSite.name}</span>
                                <p className="text-xs text-muted-foreground">
                                  {jobSite.location} • {workerCount} workers
                                </p>
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Selected Workers</h4>
            <p className="text-sm text-muted-foreground">
              {selectedWorkers.length} workers selected
            </p>
          </div>
          <Badge variant="secondary">{selectedWorkers.length}</Badge>
        </div>
      </Card>
    </div>
  );
}