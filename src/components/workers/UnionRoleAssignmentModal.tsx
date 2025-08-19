import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UnionRoleAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employerId: string;
  workers: Array<{
    id: string;
    first_name: string;
    surname: string;
  }>;
  onSuccess: () => void;
}

const unionRoleTypes = [
  { value: "site_delegate", label: "Site Delegate" },
  { value: "shift_delegate", label: "Shift Delegate" },
  { value: "company_delegate", label: "Company Delegate" },
  { value: "hsr", label: "Health & Safety Representative" },
  { value: "member", label: "Member" },
  { value: "contact", label: "Contact" },
];

export const UnionRoleAssignmentModal = ({
  isOpen,
  onClose,
  employerId,
  workers,
  onSuccess,
}: UnionRoleAssignmentModalProps) => {
  const [formData, setFormData] = useState({
    workerId: "",
    roleType: "",
    jobSiteId: "",
    isSenior: false,
    getPaidTime: false,
    startDate: new Date(),
    endDate: null as Date | null,
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch job sites for the employer
  const { data: jobSites } = useQuery({
    queryKey: ["employer-job-sites", employerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name, location")
        .eq("main_builder_id", employerId);

      if (error) throw error;
      return data;
    },
    enabled: !!employerId && isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.workerId || !formData.roleType) {
      toast.error("Please select a worker and role type");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("union_roles").insert({
        worker_id: formData.workerId,
        name: formData.roleType as "site_delegate" | "shift_delegate" | "company_delegate" | "hsr" | "member" | "contact",
        job_site_id: formData.jobSiteId || null,
        is_senior: formData.isSenior,
        gets_paid_time: formData.getPaidTime,
        start_date: formData.startDate.toISOString().split('T')[0],
        end_date: formData.endDate ? formData.endDate.toISOString().split('T')[0] : null,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast.success("Union role assigned successfully");
      onSuccess();
      setFormData({
        workerId: "",
        roleType: "",
        jobSiteId: "",
        isSenior: false,
        getPaidTime: false,
        startDate: new Date(),
        endDate: null,
        notes: "",
      });
    } catch (error) {
      console.error("Error assigning union role:", error);
      toast.error("Failed to assign union role");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Union Role</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="worker">Worker</Label>
            <Select value={formData.workerId} onValueChange={(value) => setFormData({ ...formData, workerId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a worker" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.first_name} {worker.surname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roleType">Role Type</Label>
            <Select value={formData.roleType} onValueChange={(value) => setFormData({ ...formData, roleType: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select role type" />
              </SelectTrigger>
              <SelectContent>
                {unionRoleTypes.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {jobSites && jobSites.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="jobSite">Job Site (Optional)</Label>
              <Select value={formData.jobSiteId} onValueChange={(value) => setFormData({ ...formData, jobSiteId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job site" />
                </SelectTrigger>
                <SelectContent>
                  {jobSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name} - {site.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="isSenior"
              checked={formData.isSenior}
              onCheckedChange={(checked) => setFormData({ ...formData, isSenior: checked })}
            />
            <Label htmlFor="isSenior">Senior Role</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="getPaidTime"
              checked={formData.getPaidTime}
              onCheckedChange={(checked) => setFormData({ ...formData, getPaidTime: checked })}
            />
            <Label htmlFor="getPaidTime">Gets Paid Time</Label>
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.startDate ? format(formData.startDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.startDate}
                  onSelect={(date) => date && setFormData({ ...formData, startDate: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>End Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.endDate ? format(formData.endDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.endDate ?? undefined}
                  onSelect={(date) => setFormData({ ...formData, endDate: date ?? null })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this role assignment..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Assigning..." : "Assign Role"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};