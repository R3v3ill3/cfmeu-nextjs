import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, MapPin, Building, Calendar } from "lucide-react";
import { format } from "date-fns";

const placementSchema = z.object({
  employer_id: z.string().min(1, "Employer is required"),
  job_site_id: z.string().min(1, "Job site is required"),
  job_title: z.string().optional(),
  employment_status: z.enum(["permanent", "casual", "subcontractor", "apprentice", "trainee"]),
  shift: z.enum(["day", "night", "split", "weekend"]).optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().optional(),
});

type PlacementFormData = z.infer<typeof placementSchema>;

interface WorkerPlacementsTabProps {
  workerId: string | null;
  onUpdate: () => void;
}

export const WorkerPlacementsTab = ({ workerId, onUpdate }: WorkerPlacementsTabProps) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: placements = [], isLoading } = useQuery({
    queryKey: ["worker-placements", workerId],
    queryFn: async () => {
      if (!workerId) return [];
      
      const { data, error } = await supabase
        .from("worker_placements")
        .select(`
          *,
          employers (
            id,
            name
          ),
          job_sites (
            id,
            name,
            location
          )
        `)
        .eq("worker_id", workerId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!workerId,
  });

  const { data: employers = [] } = useQuery({
    queryKey: ["employers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: jobSites = [] } = useQuery({
    queryKey: ["job-sites-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name, location")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<PlacementFormData>({
    resolver: zodResolver(placementSchema),
    defaultValues: {
      employer_id: "",
      job_site_id: "",
      job_title: "",
      employment_status: "permanent",
      shift: "day",
      start_date: "",
      end_date: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PlacementFormData) => {
      const cleanedData = {
        worker_id: workerId,
        employer_id: data.employer_id,
        job_site_id: data.job_site_id,
        job_title: data.job_title || null,
        employment_status: data.employment_status,
        shift: data.shift || null,
        start_date: data.start_date,
        end_date: data.end_date || null,
      };

      const { error } = await supabase
        .from("worker_placements")
        .insert(cleanedData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Placement added",
        description: "Worker placement has been successfully added.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-placements", workerId] });
      setShowAddDialog(false);
      form.reset();
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add placement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PlacementFormData) => {
      const cleanedData = {
        employer_id: data.employer_id,
        job_site_id: data.job_site_id,
        job_title: data.job_title || null,
        employment_status: data.employment_status,
        shift: data.shift || null,
        start_date: data.start_date,
        end_date: data.end_date || null,
      };

      const { error } = await supabase
        .from("worker_placements")
        .update(cleanedData)
        .eq("id", editingPlacement.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Placement updated",
        description: "Worker placement has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-placements", workerId] });
      setEditingPlacement(null);
      form.reset();
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update placement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (placementId: string) => {
      const { error } = await supabase
        .from("worker_placements")
        .delete()
        .eq("id", placementId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Placement deleted",
        description: "Worker placement has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-placements", workerId] });
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete placement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PlacementFormData) => {
    if (editingPlacement) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (placement: any) => {
    setEditingPlacement(placement);
    form.reset({
      employer_id: placement.employer_id,
      job_site_id: placement.job_site_id,
      job_title: placement.job_title || "",
      employment_status: placement.employment_status,
      shift: placement.shift || "day",
      start_date: placement.start_date,
      end_date: placement.end_date || "",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "permanent":
        return "bg-green-100 text-green-800";
      case "casual":
        return "bg-blue-100 text-blue-800";
      case "subcontractor":
        return "bg-purple-100 text-purple-800";
      case "apprentice":
        return "bg-orange-100 text-orange-800";
      case "trainee":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Worker Placements</h3>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Placement
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground">Loading placements...</div>
      ) : placements.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No placements found. Add a placement to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {placements.map((placement) => (
            <Card key={placement.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{placement.job_title || "Placement"}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(placement.employment_status)}>
                      {placement.employment_status}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(placement)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMutation.mutate(placement.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{placement.employers?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{placement.job_sites?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(placement.start_date), "MMM dd, yyyy")}
                      {placement.end_date && ` - ${format(new Date(placement.end_date), "MMM dd, yyyy")}`}
                    </span>
                  </div>
                  {placement.shift && (
                    <div className="flex items-center gap-2">
                      <span className="capitalize">{placement.shift} Shift</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog 
        open={showAddDialog || !!editingPlacement} 
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingPlacement(null);
            form.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPlacement ? "Edit Placement" : "Add New Placement"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="employer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employers.map((employer) => (
                          <SelectItem key={employer.id} value={employer.id}>
                            {employer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="job_site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Site</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {jobSites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name} - {site.location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="job_title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Site Foreman" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employment_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="permanent">Permanent</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="subcontractor">Subcontractor</SelectItem>
                          <SelectItem value="apprentice">Apprentice</SelectItem>
                          <SelectItem value="trainee">Trainee</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shift"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="day">Day</SelectItem>
                          <SelectItem value="night">Night</SelectItem>
                          <SelectItem value="split">Split</SelectItem>
                          <SelectItem value="weekend">Weekend</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddDialog(false);
                    setEditingPlacement(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingPlacement ? "Update" : "Add"} Placement
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};