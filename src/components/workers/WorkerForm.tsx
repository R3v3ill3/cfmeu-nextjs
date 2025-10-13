import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";

const workerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  surname: z.string().min(1, "Surname is required"),
  other_name: z.string().optional(),
  nickname: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  mobile_phone: z.string().optional(),
  home_phone: z.string().optional(),
  work_phone: z.string().optional(),
  home_address_line_1: z.string().optional(),
  home_address_line_2: z.string().optional(),
  home_address_suburb: z.string().optional(),
  home_address_postcode: z.string().optional(),
  home_address_state: z.string().optional(),
  union_membership_status: z.enum(["member", "non_member", "potential", "declined"]),
  gender: z.string().optional(),
  date_of_birth: z.coerce.date().optional(),
  // Optional union role fields for creation
  union_role_name: z.enum(["site_delegate", "hsr", "shift_delegate", "company_delegate", "member", "contact"]).optional(),
  union_role_job_site_id: z.string().optional(),
  union_role_start_date: z.coerce.date().optional(),
  union_role_end_date: z.coerce.date().optional(),
  union_role_is_senior: z.boolean().optional(),
  union_role_gets_paid_time: z.boolean().optional(),
  union_role_rating: z.string().optional(),
  union_role_experience_level: z.string().optional(),
  union_role_notes: z.string().optional(),
});

type WorkerFormData = z.infer<typeof workerSchema>;

interface WorkerFormProps {
  worker?: any;
  onSuccess: () => void | Promise<void>;
  hideUnionSection?: boolean;
}

export const WorkerForm = ({ worker, onSuccess, hideUnionSection = false }: WorkerFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];
  const [isUnionStartDefault, setIsUnionStartDefault] = useState(true);

  const { data: jobSites = [] } = useQuery({
    queryKey: ["job-sites-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name, location")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const form = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      first_name: worker?.first_name || "",
      surname: worker?.surname || "",
      other_name: worker?.other_name || "",
      nickname: worker?.nickname || "",
      email: worker?.email || "",
      mobile_phone: worker?.mobile_phone || "",
      home_phone: worker?.home_phone || "",
      work_phone: worker?.work_phone || "",
      home_address_line_1: worker?.home_address_line_1 || "",
      home_address_line_2: worker?.home_address_line_2 || "",
      home_address_suburb: worker?.home_address_suburb || "",
      home_address_postcode: worker?.home_address_postcode || "",
      home_address_state: worker?.home_address_state || "",
      union_membership_status: worker?.union_membership_status || "non_member",
      gender: worker?.gender || "",
      date_of_birth: worker?.date_of_birth || "",
      // Union role defaults
      union_role_name: undefined,
      union_role_job_site_id: "",
      union_role_start_date: today,
      union_role_end_date: "",
      union_role_is_senior: false,
      union_role_gets_paid_time: false,
      union_role_rating: "",
      union_role_experience_level: "",
      union_role_notes: "",
    },
  });

  const onSubmit = async (data: WorkerFormData) => {
    setIsSubmitting(true);
    try {
      // Convert empty strings to null for optional fields, keep required fields
      const cleanedData = {
        first_name: data.first_name,
        surname: data.surname,
        union_membership_status: data.union_membership_status,
        email: data.email === "" ? null : data.email,
        mobile_phone: data.mobile_phone === "" ? null : data.mobile_phone,
        home_phone: data.home_phone === "" ? null : data.home_phone,
        work_phone: data.work_phone === "" ? null : data.work_phone,
        other_name: data.other_name === "" ? null : data.other_name,
        nickname: data.nickname === "" ? null : data.nickname,
        home_address_line_1: data.home_address_line_1 === "" ? null : data.home_address_line_1,
        home_address_line_2: data.home_address_line_2 === "" ? null : data.home_address_line_2,
        home_address_suburb: data.home_address_suburb === "" ? null : data.home_address_suburb,
        home_address_postcode: data.home_address_postcode === "" ? null : data.home_address_postcode,
        home_address_state: data.home_address_state === "" ? null : data.home_address_state,
        gender: data.gender === "" ? null : data.gender,
        date_of_birth: data.date_of_birth === "" ? null : data.date_of_birth,
      } as any;

      if (worker?.id) {
        // Update existing worker
        const { error } = await supabase
          .from("workers")
          .update(cleanedData)
          .eq("id", worker.id);

        if (error) throw error;

        // Optionally create a union role if provided
        if (data.union_role_name) {
          const rolePayload = {
            worker_id: worker.id,
            name: data.union_role_name,
            job_site_id: data.union_role_job_site_id || null,
            start_date: (data.union_role_start_date || today),
            end_date: data.union_role_end_date || null,
            is_senior: !!data.union_role_is_senior,
            gets_paid_time: !!data.union_role_gets_paid_time,
            rating: data.union_role_rating || null,
            experience_level: data.union_role_experience_level || null,
            notes: data.union_role_notes || null,
          } as any;
          const { error: roleError } = await supabase
            .from("union_roles")
            .insert(rolePayload);
          if (roleError) throw roleError;
        }

        toast({
          title: "Worker updated",
          description: "The worker information has been successfully updated.",
        });
      } else {
        // Create new worker and optionally a union role
        const { data: inserted, error } = await supabase
          .from("workers")
          .insert(cleanedData)
          .select("id")
          .single();

        if (error) throw error;

        const newWorkerId = inserted?.id;
        if (newWorkerId && data.union_role_name) {
          const rolePayload = {
            worker_id: newWorkerId,
            name: data.union_role_name,
            job_site_id: data.union_role_job_site_id || null,
            start_date: (data.union_role_start_date || today),
            end_date: data.union_role_end_date || null,
            is_senior: !!data.union_role_is_senior,
            gets_paid_time: !!data.union_role_gets_paid_time,
            rating: data.union_role_rating || null,
            experience_level: data.union_role_experience_level || null,
            notes: data.union_role_notes || null,
          } as any;
          const { error: roleError } = await supabase
            .from("union_roles")
            .insert(rolePayload);
          if (roleError) throw roleError;
        }

        toast({
          title: "Worker added",
          description: "The new worker has been successfully added.",
        });
      }

      await onSuccess();
    } catch (error) {
      console.error("Error saving worker:", error);
      toast({
        title: "Error",
        description: "Failed to save worker information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className={`grid w-full ${hideUnionSection ? "grid-cols-3" : "grid-cols-4"}`}>
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            {!hideUnionSection && <TabsTrigger value="union">Union</TabsTrigger>}
          </TabsList>

          <ScrollArea className="h-96 mt-4">
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Surname *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="other_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nickname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nickname</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Union Membership Status moved to Union tab */}
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="mobile_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="home_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="work_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4">
              <FormField
                control={form.control}
                name="home_address_line_1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="home_address_line_2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="home_address_suburb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Suburb</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="home_address_postcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="home_address_state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NSW">NSW</SelectItem>
                        <SelectItem value="VIC">VIC</SelectItem>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="WA">WA</SelectItem>
                        <SelectItem value="SA">SA</SelectItem>
                        <SelectItem value="TAS">TAS</SelectItem>
                        <SelectItem value="ACT">ACT</SelectItem>
                        <SelectItem value="NT">NT</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            {!hideUnionSection && (
              <TabsContent value="union" className="space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="union_membership_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Union Membership Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="non_member">Non-member</SelectItem>
                            <SelectItem value="potential">Potential</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Add Union Role (optional)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="union_role_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="site_delegate">Site Delegate</SelectItem>
                              <SelectItem value="hsr">Health & Safety Representative</SelectItem>
                              <SelectItem value="shift_delegate">Shift Delegate</SelectItem>
                              <SelectItem value="company_delegate">Company Delegate</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="contact">Contact</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="union_role_job_site_id"
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
                              {jobSites.map((site: any) => (
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="union_role_start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date"
                              {...field} 
                              className={field.value === today && isUnionStartDefault ? "bg-amber-50 dark:bg-amber-900/30" : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setIsUnionStartDefault(v === today);
                                field.onChange(v);
                              }}
                            />
                          </FormControl>
                          {field.value === today && isUnionStartDefault && (
                            <p className="text-xs text-muted-foreground">Defaulted to today</p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="union_role_end_date"
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

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="union_role_is_senior"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Senior Role</FormLabel>
                          </div>
                          <FormControl>
                            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="union_role_gets_paid_time"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Gets Paid Time</FormLabel>
                          </div>
                          <FormControl>
                            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="union_role_experience_level"
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
                      name="union_role_rating"
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
                    name="union_role_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="min-h-[80px]" placeholder="Additional notes about this role..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : worker?.id ? "Update Worker" : "Add Worker"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
