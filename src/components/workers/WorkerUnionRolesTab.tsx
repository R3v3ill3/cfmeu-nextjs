import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Award, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import DateInput from "@/components/ui/date-input";

const unionRoleSchema = z.object({
  name: z.enum(["site_delegate", "hsr", "shift_delegate", "company_delegate", "member", "contact", "ohs_committee_chair"]),
  job_site_id: z.string().optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().optional(),
  is_senior: z.boolean().default(false),
  gets_paid_time: z.boolean().default(false),
  rating: z.string().optional(),
  experience_level: z.string().optional(),
  notes: z.string().optional(),
  elected_by: z.string().optional(),
  date_elected: z.string().optional(),
  ohs_training_date: z.string().optional(),
  ohs_refresher_training_date: z.string().optional(),
});

// Dues (worker_memberships) schema
const duesSchema = z.object({
  payment_method: z.enum(["direct_debit", "payroll_deduction", "cash", "card", "unknown"]),
  dd_status: z.enum(["not_started", "in_progress", "active", "failed"]),
  dd_mandate_id: z.string().optional(),
  arrears_amount: z.string().optional(),
  last_payment_at: z.string().optional(),
  notes: z.string().optional(),
});

type DuesFormData = z.infer<typeof duesSchema>;

type UnionRoleFormData = z.input<typeof unionRoleSchema>;

interface WorkerUnionRolesTabProps {
  workerId: string | null;
  onUpdate: () => void;
}

const unionRoleTypes = [
  { value: "site_delegate", label: "Site Delegate" },
  { value: "hsr", label: "Health & Safety Representative" },
  { value: "shift_delegate", label: "Shift Delegate" },
  { value: "company_delegate", label: "Company Delegate" },
  { value: "ohs_committee_chair", label: "OHS Committee Chair" },
  { value: "member", label: "Member" },
  { value: "contact", label: "Contact" },
];

export const WorkerUnionRolesTab = ({ workerId, onUpdate }: WorkerUnionRolesTabProps) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: unionRoles = [], isLoading } = useQuery({
    queryKey: ["worker-union-roles", workerId],
    queryFn: async () => {
      if (!workerId) return [];
      
      const { data, error } = await supabase
        .from("union_roles")
        .select(`
          *,
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

  // Fetch worker membership status for display/edit here
  const { data: worker } = useQuery({
    queryKey: ["worker-basic", workerId],
    queryFn: async () => {
      if (!workerId) return null;
      const { data, error } = await supabase
        .from("workers")
        .select("id, union_membership_status")
        .eq("id", workerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!workerId,
  });

  // Fetch worker_memberships dues record
  const { data: membership } = useQuery({
    queryKey: ["worker-membership", workerId],
    queryFn: async () => {
      if (!workerId) return null;
      const { data, error } = await supabase
        .from("worker_memberships")
        .select("payment_method, dd_status, dd_mandate_id, arrears_amount, last_payment_at, notes")
        .eq("worker_id", workerId)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
    enabled: !!workerId,
  });

  const [selectedStatus, setSelectedStatus] = useState<"member" | "non_member" | "potential" | "declined">("non_member");
  useEffect(() => {
    const s = (worker?.union_membership_status as any) || "non_member";
    setSelectedStatus(s);
  }, [worker?.union_membership_status]);

  // Dues form
  const duesForm = useForm<DuesFormData>({
    resolver: zodResolver(duesSchema),
    defaultValues: {
      payment_method: "unknown",
      dd_status: "not_started",
      dd_mandate_id: "",
      arrears_amount: "",
      last_payment_at: "",
      notes: "",
    },
  });

  useEffect(() => {
    duesForm.reset({
      payment_method: (membership?.payment_method as any) || "unknown",
      dd_status: (membership?.dd_status as any) || "not_started",
      dd_mandate_id: membership?.dd_mandate_id || "",
      arrears_amount: membership?.arrears_amount != null ? String(membership.arrears_amount) : "",
      last_payment_at: membership?.last_payment_at ? String(membership.last_payment_at).slice(0, 10) : "",
      notes: membership?.notes || "",
    });
  }, [membership, duesForm]);

  const saveMembership = async (value: "member" | "non_member" | "potential" | "declined") => {
    if (!workerId) return;
    const { error } = await supabase
      .from("workers")
      .update({ union_membership_status: value })
      .eq("id", workerId);
    if (error) throw error;
    // Refresh queries
    queryClient.invalidateQueries({ queryKey: ["worker-basic", workerId] });
    queryClient.invalidateQueries({ queryKey: ["worker-detail", workerId] });
    onUpdate();
  };

  // Save dues mutation
  const saveDues = useMutation({
    mutationFn: async (values: DuesFormData) => {
      if (!workerId) return;
      const payload: any = {
        payment_method: values.payment_method,
        dd_status: values.dd_status,
        dd_mandate_id: values.dd_mandate_id?.trim() || null,
        arrears_amount: values.arrears_amount ? Number(values.arrears_amount) : null,
        last_payment_at: values.last_payment_at || null,
        notes: values.notes?.trim() || null,
      };
      if (membership) {
        const { error } = await supabase
          .from("worker_memberships")
          .update(payload)
          .eq("worker_id", workerId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("worker_memberships")
          .insert({ worker_id: workerId, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Dues updated", description: "Membership dues have been saved." });
      queryClient.invalidateQueries({ queryKey: ["worker-membership", workerId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save dues information.", variant: "destructive" });
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

  const form = useForm<UnionRoleFormData>({
    resolver: zodResolver(unionRoleSchema),
    defaultValues: {
      name: "site_delegate",
      job_site_id: "",
      start_date: "",
      end_date: "",
      is_senior: false,
      gets_paid_time: false,
      rating: "",
      experience_level: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: UnionRoleFormData) => {
      const cleanedData = {
        worker_id: workerId,
        name: data.name,
        job_site_id: data.job_site_id || null,
        start_date: data.start_date,
        end_date: data.end_date || null,
        is_senior: data.is_senior,
        gets_paid_time: data.gets_paid_time,
        rating: data.rating || null,
        experience_level: data.experience_level || null,
        notes: data.notes || null,
      };

      const { error } = await supabase
        .from("union_roles")
        .insert(cleanedData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Union role added",
        description: "Union role has been successfully added.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-union-roles", workerId] });
      setShowAddDialog(false);
      form.reset();
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add union role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UnionRoleFormData) => {
      const cleanedData = {
        name: data.name,
        job_site_id: data.job_site_id || null,
        start_date: data.start_date,
        end_date: data.end_date || null,
        is_senior: data.is_senior,
        gets_paid_time: data.gets_paid_time,
        rating: data.rating || null,
        experience_level: data.experience_level || null,
        notes: data.notes || null,
      };

      const { error } = await supabase
        .from("union_roles")
        .update(cleanedData)
        .eq("id", editingRole.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Union role updated",
        description: "Union role has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-union-roles", workerId] });
      setEditingRole(null);
      form.reset();
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update union role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from("union_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Union role deleted",
        description: "Union role has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-union-roles", workerId] });
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete union role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UnionRoleFormData) => {
    if (editingRole) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (role: any) => {
    setEditingRole(role);
    form.reset({
      name: role.name,
      job_site_id: role.job_site_id || "",
      start_date: role.start_date,
      end_date: role.end_date || "",
      is_senior: role.is_senior || false,
      gets_paid_time: role.gets_paid_time || false,
      rating: role.rating || "",
      experience_level: role.experience_level || "",
      notes: role.notes || "",
    });
  };

  const getRoleLabel = (name: string) => {
    return unionRoleTypes.find(type => type.value === name)?.label || name;
  };

  const isActiveRole = (role: any) => {
    return !role.end_date || new Date(role.end_date) > new Date();
  };

  // Helper to style membership status select trigger
  const getMembershipClass = (status: string) => {
    switch (status) {
      case "member":
        return "bg-green-100 text-green-800 border border-green-200";
      case "potential":
        return "bg-blue-100 text-blue-800 border border-blue-200";
      case "declined":
        return "bg-yellow-100 text-yellow-800 border border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200";
    }
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Union Roles</h3>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      {/* Active roles summary */}
      {unionRoles && unionRoles.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-muted-foreground">Active roles:</span>
          {unionRoles.filter(isActiveRole).map((role) => (
            <Badge key={role.id} variant="secondary">{getRoleLabel(role.name)}</Badge>
          ))}
        </div>
      )}

      {/* Membership & Payment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Membership & Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Union Membership Status</Label>
              <Select
                value={selectedStatus}
                onValueChange={(v) => setSelectedStatus(v as any)}
              >
                <SelectTrigger className={`w-[220px] ${getMembershipClass(selectedStatus)}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="non_member">Non-member</SelectItem>
                  <SelectItem value="potential">Potential</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedStatus === "member" && (
              <div>
                <Label className="text-xs text-muted-foreground">Payment Method</Label>
                <Select
                  value={duesForm.getValues("payment_method") as any}
                  onValueChange={(v) => duesForm.setValue("payment_method", v as any)}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct_debit">Direct Debit</SelectItem>
                    <SelectItem value="payroll_deduction">Payroll Deduction</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              type="button"
              onClick={async () => {
                await saveMembership(selectedStatus as any);
                const values = duesForm.getValues();
                // Save only payment method/related fields, avoid null dd_status
                const payload: any = {
                  payment_method: values.payment_method,
                  arrears_amount: values.arrears_amount,
                  last_payment_at: values.last_payment_at,
                  notes: values.notes,
                };
                if (values.payment_method === "direct_debit") {
                  payload.dd_status = values.dd_status as any;
                }
                await saveDues.mutateAsync(payload);
              }}
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dues & Payment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dues & Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...duesForm}>
            <form onSubmit={duesForm.handleSubmit((values) => saveDues.mutate(values))} className="space-y-4">
              {duesForm.watch("payment_method") === "direct_debit" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={duesForm.control}
                    name="dd_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Direct Debit Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="not_started">Not Started</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={duesForm.control}
                  name="arrears_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arrears Amount</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={duesForm.control}
                  name="last_payment_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Payment Date</FormLabel>
                      <FormControl>
                        <DateInput value={field.value || ""} onChange={field.onChange} name={field.name} onBlur={field.onBlur} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={duesForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Internal notes about dues/payment" className="min-h-[80px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="submit" disabled={saveDues.isPending}>
                  {saveDues.isPending ? "Saving..." : membership ? "Update Dues" : "Create Dues"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Add New Union Role (inline) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add New Union Role</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unionRoleTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
                    <FormLabel>Job Site (Optional)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "none" ? "" : v)} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No specific site</SelectItem>
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <DateInput value={field.value || ""} onChange={field.onChange} name={field.name} onBlur={field.onBlur} />
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
                        <DateInput value={field.value || ""} onChange={field.onChange} name={field.name} onBlur={field.onBlur} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="is_senior"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Senior Role</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gets_paid_time"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Gets Paid Time</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="experience_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="experienced">Experienced</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Excellent, Good" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes about this role..." className="min-h-[80px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                >
                  Add Role
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center text-muted-foreground">Loading union roles...</div>
      ) : unionRoles.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No union roles assigned. Add a role to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {unionRoles.map((role) => (
            <Card key={role.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    {getRoleLabel(role.name)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={isActiveRole(role) ? "default" : "secondary"}>
                      {isActiveRole(role) ? "Active" : "Ended"}
                    </Badge>
                    {role.is_senior && (
                      <Badge variant="outline">Senior</Badge>
                    )}
                    {role.gets_paid_time && (
                      <Badge variant="outline">Paid Time</Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleEdit(role)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMutation.mutate(role.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {role.job_sites && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{role.job_sites.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(role.start_date), "dd/MM/yyyy")}
                      {role.end_date && ` - ${format(new Date(role.end_date), "dd/MM/yyyy")}`}
                    </span>
                  </div>
                  {role.experience_level && (
                    <div>
                      <span className="text-muted-foreground">Experience: </span>
                      <span>{role.experience_level}</span>
                    </div>
                  )}
                  {role.rating && (
                    <div>
                      <span className="text-muted-foreground">Rating: </span>
                      <span>{role.rating}</span>
                    </div>
                  )}
                </div>
                {role.notes && (
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <p className="text-sm">{role.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog 
        open={showAddDialog || !!editingRole} 
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingRole(null);
            form.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Edit Union Role" : "Add New Union Role"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unionRoleTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
                    <FormLabel>Job Site (Optional)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "none" ? "" : v)} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No specific site</SelectItem>
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <DateInput value={field.value || ""} onChange={field.onChange} name={field.name} onBlur={field.onBlur} />
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
                        <DateInput value={field.value || ""} onChange={field.onChange} name={field.name} onBlur={field.onBlur} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="is_senior"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Senior Role</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gets_paid_time"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Gets Paid Time</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="experience_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="experienced">Experienced</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Excellent, Good" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Additional notes about this role..."
                        className="min-h-[80px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddDialog(false);
                    setEditingRole(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingRole ? "Update" : "Add"} Role
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};