import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ActivityTypeSelector, type ActivityTemplate } from "./ActivityTypeSelector";
import { WorkerAssignmentTabs, type WorkerAssignment } from "./WorkerAssignmentTabs";
import { DelegationManager, type DelegationAssignment } from "./DelegationManager";

const activitySchema = z.object({
  template_id: z.string().optional(),
  custom_activity_type: z.string().optional(),
  activity_type: z.string().min(1, "Activity type is required"),
  date: z.date({
    message: "Date is required",
  }),
  job_site_id: z.string().optional(),
  topic: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.template_id || data.custom_activity_type,
  {
    message: "Either select a template or create a custom activity type",
    path: ["template_id"],
  }
);

interface EnhancedActivityCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ActivityTemplate[];
  jobSites: Array<{ id: string; name: string; location: string }>;
  onSubmit: (data: {
    formData: z.infer<typeof activitySchema>;
    selectedWorkers: WorkerAssignment[];
    delegations: DelegationAssignment[];
  }) => void;
  onCustomActivityCreate: (name: string, description: string) => void;
  isLoading?: boolean;
}

const steps = [
  { id: 'type', label: 'Activity Type', description: 'Choose activity type' },
  { id: 'workers', label: 'Assign Workers', description: 'Select participants' },
  { id: 'delegations', label: 'Delegations', description: 'Set up delegation structure' },
  { id: 'details', label: 'Details', description: 'Add activity details' }
];

export function EnhancedActivityCreationDialog({
  open,
  onOpenChange,
  templates,
  jobSites,
  onSubmit,
  onCustomActivityCreate,
  isLoading = false
}: EnhancedActivityCreationDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ActivityTemplate | null>(null);
  const [selectedWorkers, setSelectedWorkers] = useState<WorkerAssignment[]>([]);
  const [delegations, setDelegations] = useState<DelegationAssignment[]>([]);

  const form = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      template_id: "",
      custom_activity_type: "",
      activity_type: "",
      date: new Date(),
      job_site_id: "",
      topic: "",
      notes: "",
    },
  });

  const resetForm = () => {
    form.reset();
    setSelectedTemplate(null);
    setSelectedWorkers([]);
    setDelegations([]);
    setCurrentStep(0);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleTemplateSelect = (template: ActivityTemplate | null) => {
    setSelectedTemplate(template);
    if (template) {
      form.setValue('template_id', template.id);
      form.setValue('activity_type', template.name);
      form.setValue('custom_activity_type', '');
    } else {
      form.setValue('template_id', '');
      form.setValue('activity_type', '');
    }
  };

  const handleCustomActivityCreate = (name: string, description: string) => {
    onCustomActivityCreate(name, description);
    form.setValue('custom_activity_type', name);
    form.setValue('activity_type', name);
    form.setValue('template_id', '');
  };

  const onFormSubmit = (data: z.infer<typeof activitySchema>) => {
    onSubmit({
      formData: data,
      selectedWorkers,
      delegations
    });
  };

  const canProceedFromStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: // Activity type
        return selectedTemplate !== null || form.getValues('custom_activity_type') !== '';
      case 1: // Workers
        return selectedWorkers.length > 0;
      case 2: // Delegations
        return true; // Optional step
      case 3: // Details
        return form.formState.isValid;
      default:
        return false;
    }
  };

  const progressPercentage = ((currentStep + 1) / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Activity</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="space-y-4">
            <Progress value={progressPercentage} className="w-full" />
            <div className="flex justify-between">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center space-y-1 ${
                    index === currentStep ? 'text-primary' : 
                    index < currentStep ? 'text-green-600' : 'text-muted-foreground'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                    index === currentStep ? 'border-primary bg-primary text-primary-foreground' :
                    index < currentStep ? 'border-green-600 bg-green-600 text-white' : 'border-muted-foreground'
                  }`}>
                    {index < currentStep ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">{step.label}</div>
                    <div className="text-xs">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="min-h-[400px]">
            {currentStep === 0 && (
              <ActivityTypeSelector
                templates={templates}
                selectedTemplate={selectedTemplate ?? undefined}
                onTemplateSelect={handleTemplateSelect}
                onCustomActivityCreate={handleCustomActivityCreate}
              />
            )}

            {currentStep === 1 && (
              <WorkerAssignmentTabs
                selectedWorkers={selectedWorkers}
                onWorkersChange={setSelectedWorkers}
              />
            )}

            {currentStep === 2 && (
              <DelegationManager
                selectedWorkers={selectedWorkers}
                delegations={delegations}
                onDelegationsChange={setDelegations}
                enableCarryForward={true}
              />
            )}

            {currentStep === 3 && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-6">
                  <Card className="p-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Activity Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date: Date) =>
                                      date > new Date() || date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
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
                              <Select onValueChange={(v: string) => field.onChange(v === "none" ? "" : v)} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a job site" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">No specific job site</SelectItem>
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
                      </div>

                      <FormField
                        control={form.control}
                        name="topic"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Topic/Subject (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter the main topic or subject" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Add any additional notes or details"
                                className="min-h-[100px]"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>

                  {/* Summary */}
                  <Card className="p-4 bg-muted/50">
                    <h4 className="font-medium mb-3">Activity Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Type</div>
                        <div className="text-muted-foreground">
                          {selectedTemplate?.name || form.getValues('custom_activity_type') || 'Not selected'}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Participants</div>
                        <div className="text-muted-foreground">{selectedWorkers.length} workers</div>
                      </div>
                      <div>
                        <div className="font-medium">Delegates</div>
                        <div className="text-muted-foreground">{delegations.length} delegates</div>
                      </div>
                      <div>
                        <div className="font-medium">Date</div>
                        <div className="text-muted-foreground">
                          {form.getValues('date') ? format(form.getValues('date'), "MMM d, yyyy") : 'Not set'}
                        </div>
                      </div>
                    </div>
                  </Card>
                </form>
              </Form>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              
              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceedFromStep(currentStep)}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={form.handleSubmit(onFormSubmit)}
                  disabled={!canProceedFromStep(currentStep) || isLoading}
                >
                  {isLoading ? 'Creating...' : 'Create Activity'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}