import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DateInput from "@/components/ui/date-input";
import { toast } from "sonner";
import { JVSelector } from "@/components/projects/JVSelector";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { calculateProjectTier } from "@/components/projects/types"
import { GoogleAddressInput, GoogleAddress, AddressValidationError } from "@/components/projects/GoogleAddressInput"
import { UploadMappingSheetDialog } from "@/components/projects/mapping/UploadMappingSheetDialog"
import { ProjectQuickFinder } from "@/components/projects/ProjectQuickFinder"
import { FileText, Edit, AlertCircle, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { useMobileKeyboard } from "@/hooks/useMobileKeyboard"
import { Alert, AlertDescription } from "@/components/ui/alert"

type DialogMode = 'choice' | 'manual' | 'scan'

type ValidationErrors = {
  name?: string;
  address?: string;
  value?: string;
  start?: string;
  finish?: string;
  roeEmail?: string;
  stateFunding?: string;
  federalFunding?: string;
  general?: string;
}

export default function CreateProjectDialog() {
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()
  const { scrollToInput, dismissKeyboard } = useMobileKeyboard({
    enableAutoScroll: true,
    scrollOffset: 100,
    enableDismissOnTapOutside: true,
    enableDismissOnScroll: false
  })
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('choice');
  const [name, setName] = useState("");
  const [addressData, setAddressData] = useState<GoogleAddress | null>(null);
  const [addressValidationError, setAddressValidationError] = useState<AddressValidationError | null>(null);
  const [value, setValue] = useState("");
  const [start, setStart] = useState("");
  const [finish, setFinish] = useState("");
  const [roeEmail, setRoeEmail] = useState("");
  const [projectType, setProjectType] = useState<string>("");
  const [stateFunding, setStateFunding] = useState<string>("");
  const [federalFunding, setFederalFunding] = useState<string>("");
  const [builderId, setBuilderId] = useState<string>("");
  const [jvStatus, setJvStatus] = useState<"yes" | "no" | "unsure">("no");
  const [jvLabel, setJvLabel] = useState<string>("");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [scanToReview, setScanToReview] = useState<{ scanId: string; projectId?: string } | null>(null);
  const closingFromUploadResultRef = useRef(false)

  // Error handling state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const canSubmit = useMemo(() => {
    return name.trim() &&
           addressData?.formatted &&
           !addressValidationError &&
           addressData?.place_id; // Ensure address was selected from autocomplete
  }, [name, addressData, addressValidationError]);

  // Validation function
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    // Required field validation
    if (!name.trim()) {
      errors.name = "Project name is required";
    } else if (name.trim().length < 3) {
      errors.name = "Project name must be at least 3 characters";
    } else if (name.trim().length > 200) {
      errors.name = "Project name must be less than 200 characters";
    }

    if (!addressData?.formatted?.trim()) {
      errors.address = "Main job site address is required";
    }

    // Email validation
    if (roeEmail && roeEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(roeEmail.trim())) {
        errors.roeEmail = "Please enter a valid email address";
      }
    }

    // Date validation
    if (start && finish) {
      const startDate = new Date(start);
      const finishDate = new Date(finish);
      if (startDate > finishDate) {
        errors.finish = "Finish date must be after start date";
      }
    }

    // Numeric validation
    if (value && value.trim()) {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0) {
        errors.value = "Project value must be a positive number";
      } else if (numValue > 10000000000) {
        errors.value = "Project value seems unusually high - please verify";
      }
    }

    if (stateFunding && stateFunding.trim()) {
      const cleanValue = stateFunding.replace(/[^0-9.]/g, "");
      const numValue = Number(cleanValue);
      if (isNaN(numValue) || numValue < 0) {
        errors.stateFunding = "State funding must be a positive number";
      }
    }

    if (federalFunding && federalFunding.trim()) {
      const cleanValue = federalFunding.replace(/[^0-9.]/g, "");
      const numValue = Number(cleanValue);
      if (isNaN(numValue) || numValue < 0) {
        errors.federalFunding = "Federal funding must be a positive number";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Clear field error when user starts typing
  const clearFieldError = (field: keyof ValidationErrors) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  // Reset form state
  const resetForm = () => {
    setName("");
    setAddressData(null);
    setValue("");
    setStart("");
    setFinish("");
    setRoeEmail("");
    setProjectType("");
    setStateFunding("");
    setFederalFunding("");
    setBuilderId("");
    setJvStatus("no");
    setJvLabel("");
    setValidationErrors({});
    setShowSuccess(false);
  };

  // Reset dialog mode when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setDialogMode('choice')
      setScanToReview(null)
      // Don't reset form immediately to allow success message to show
      setTimeout(() => {
        if (!showSuccess) {
          resetForm();
        }
      }, 300);
    }
  }, [open, showSuccess])

  // Calculate tier based on value
  const calculatedTier = useMemo(() => {
    if (!value) return null
    const numValue = Number(value)
    return calculateProjectTier(numValue)
  }, [value])

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      // Validate form before submission
      if (!validateForm()) {
        throw new Error("Please fix the validation errors before submitting");
      }

      // Clear any previous general errors
      setValidationErrors(prev => {
        const { general, ...rest } = prev;
        return rest;
      });

      try {
        const payload: any = {
          name: name.trim(),
          value: value ? Number(value) : null,
          proposed_start_date: start || null,
          proposed_finish_date: finish || null,
          roe_email: roeEmail ? roeEmail.trim() : null,
          project_type: projectType || null,
          state_funding: stateFunding ? Number(stateFunding.replace(/[^0-9.]/g, "")) : 0,
          federal_funding: federalFunding ? Number(federalFunding.replace(/[^0-9.]/g, "")) : 0,
          builder_id: builderId || null,
          // Note: organising_universe will be auto-assigned by trigger based on tier/EBA/patch rules
        };

        // Insert project
        const { data: proj, error: projErr } = await supabase
          .from("projects")
          .insert(payload)
          .select("id")
          .single();

        if (projErr) {
          // Handle specific database errors
          if (projErr.code === '23505') {
            throw new Error("A project with this name already exists. Please use a different name.");
          } else if (projErr.code === '23503') {
            throw new Error("Invalid builder selected. Please choose a different builder or leave it empty.");
          } else if (projErr.code === 'PGRST116') {
            throw new Error("Unable to create project. Please check your permissions.");
          } else if (projErr.message?.includes('permission')) {
            throw new Error("You don't have permission to create projects. Please contact an administrator.");
          }
          throw new Error(`Failed to create project: ${projErr.message || 'Unknown error'}`);
        }

        const projectId = (proj as any).id as string;

        // Create main job site with address and coordinates
        const sitePayload: any = {
          project_id: projectId,
          name: name.trim(),
          is_main_site: true,
          location: addressData?.formatted || "",
          full_address: addressData?.formatted || ""
        }

        // Add coordinates if available for patch matching
        if (addressData?.lat && addressData?.lng) {
          sitePayload.latitude = addressData.lat
          sitePayload.longitude = addressData.lng
        }

        const { data: site, error: siteErr } = await supabase
          .from("job_sites")
          .insert(sitePayload)
          .select("id")
          .single();

        if (siteErr) {
          // Attempt cleanup if job site creation fails
          await supabase.from("projects").delete().eq("id", projectId).catch(() => {});
          throw new Error(`Failed to create job site: ${siteErr.message || 'Unknown error'}`);
        }

        const siteId = (site as any).id as string;

        const { error: linkErr } = await supabase
          .from("projects")
          .update({ main_job_site_id: siteId })
          .eq("id", projectId);

        if (linkErr) {
          throw new Error(`Failed to link job site: ${linkErr.message || 'Unknown error'}`);
        }

        // Assign builder role if specified
        if (builderId) {
          try {
            const { data: builderResult, error: assignErr } = await supabase.rpc('set_project_builder', {
              p_project_id: projectId,
              p_employer_id: builderId,
              p_source: 'manual',
              p_match_status: 'confirmed',
              p_match_confidence: 1,
              p_match_notes: 'Assigned via create project dialog'
            })
            if (assignErr) {
              console.error('Failed to assign builder role', assignErr)
            } else {
              const result = builderResult?.[0]
              if (result && !result.success) {
                console.warn('Builder assignment reported issue:', result.message)
              }
            }
          } catch (err) {
            console.warn('Error assigning builder:', err);
            // Non-critical error - continue
          }
        }

        // Update JV status if specified
        if (jvStatus) {
          try {
            const { error: jvErr } = await (supabase as any)
              .from("project_builder_jv")
              .upsert({
                project_id: projectId,
                status: jvStatus,
                label: jvStatus === 'yes' ? (jvLabel || null) : null
              }, { onConflict: "project_id" });

            if (jvErr) {
              console.warn('Failed to update JV status:', jvErr);
              // Non-critical error - continue
            }
          } catch (err) {
            console.warn('Error updating JV status:', err);
            // Non-critical error - continue
          }
        }

        return projectId;
      } catch (error: any) {
        // Network/connection errors
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          throw new Error("Network error. Please check your connection and try again.");
        }

        // Re-throw the error to be handled by onError
        throw error;
      }
    },
    onSuccess: (id) => {
      setShowSuccess(true);
      toast.success("Project created successfully!", {
        description: "Redirecting to project page...",
        duration: 3000,
      });

      qc.invalidateQueries({ queryKey: ["projects-list"] });

      // Delay navigation to show success message
      setTimeout(() => {
        setOpen(false);
        resetForm();
        try {
          router.push(`/projects/${id}`)
        } catch (navErr) {
          console.error('Navigation error:', navErr);
          toast.error("Project created but failed to navigate. Please refresh the page.");
        }
      }, 1000);
    },
    onError: (error: any) => {
      console.error('Project creation error:', error);

      // Set general error for display in the form
      setValidationErrors(prev => ({
        ...prev,
        general: error?.message || 'Failed to create project. Please try again.'
      }));

      // Show toast with actionable message
      toast.error("Failed to create project", {
        description: error?.message || 'An unexpected error occurred. Please try again.',
        duration: 5000,
      });
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="xl" className="font-medium">New Project</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-lg:max-w-[95vw] max-lg:max-h-[90vh] max-lg:overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 max-lg:text-lg max-lg:leading-tight max-lg:break-words max-lg:hyphens-auto">Create Project</DialogTitle>
          </DialogHeader>

          {/* Choice Screen */}
          {dialogMode === 'choice' && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Choose how you'd like to create a new project:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Manual Creation Option */}
                <button
                  type="button"
                  onClick={() => setDialogMode('manual')}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg hover:border-primary hover:bg-accent/50 transition-colors text-center group"
                >
                  <Edit className="h-12 w-12 mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  <h3 className="font-semibold text-lg mb-2">Create Manually</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter project details manually using a form
                  </p>
                </button>

                {/* Scan Upload Option */}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setIsUploadDialogOpen(true)
                  }}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg hover:border-primary hover:bg-accent/50 transition-colors text-center group"
                >
                  <FileText className="h-12 w-12 mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  <h3 className="font-semibold text-lg mb-2">Create from Scanned Data</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload a scanned mapping sheet and let AI extract the data
                  </p>
                </button>
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Manual Creation Form */}
          {dialogMode === 'manual' && (
            <div className="space-y-4">
          {/* General Error Alert */}
          {validationErrors.general && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationErrors.general}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {showSuccess && (
            <Alert className="border-green-500 bg-green-50 text-green-900">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>Project created successfully! Redirecting...</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="cp_name" className="text-sm font-medium text-gray-700">
              Project Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cp_name"
              name="project-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearFieldError('name');
              }}
              placeholder="Enter project name"
              autoComplete="organization"
              mobileOptimization={true}
              className={`h-12 px-4 py-3 text-gray-900 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${validationErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              disabled={createMutation.isPending}
              onFocus={(e) => scrollToInput(e.target)}
            />
            {validationErrors.name && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {validationErrors.name}
              </p>
            )}
          </div>
          <div>
            <GoogleAddressInput
              value={addressData?.formatted || ""}
              onChange={(addr, error) => {
                setAddressData(addr);
                setAddressValidationError(error || null);
                clearFieldError('address');
              }}
              placeholder="Start typing an Australian address..."
              required={true}
              requireSelection={true}
              onValidationChange={setAddressValidationError}
            />
            {validationErrors.address && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {validationErrors.address}
              </p>
            )}
          </div>
          {/* Project Value with Tier Preview */}
          <div className="space-y-2">
            <Label htmlFor="value">Project Value (AUD)</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  id="value"
                  name="project-value"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    clearFieldError('value');
                  }}
                  autoComplete="off"
                  mobileOptimization={true}
                  className={validationErrors.value ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
                  disabled={createMutation.isPending}
                  onFocus={(e) => scrollToInput(e.target)}
                />
              </div>
              {calculatedTier && (
                <ProjectTierBadge tier={calculatedTier} size="sm" />
              )}
            </div>
            {validationErrors.value ? (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {validationErrors.value}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tier 1: $500M+ | Tier 2: $100M-$500M | Tier 3: &lt;$100M
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Proposed Start</Label>
                <DateInput
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    clearFieldError('start');
                  }}
                  disabled={createMutation.isPending}
                />
                {validationErrors.start && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.start}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Proposed Finish</Label>
                <DateInput
                  value={finish}
                  onChange={(e) => {
                    setFinish(e.target.value);
                    clearFieldError('finish');
                  }}
                  disabled={createMutation.isPending}
                />
                {validationErrors.finish && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.finish}
                  </p>
                )}
              </div>
            </div>
          <div>
            <Label htmlFor="cp_roe" className="text-sm font-medium text-gray-700">ROE Email</Label>
            <Input
              id="cp_roe"
              name="email"
              type="email"
              inputMode="email"
              value={roeEmail}
              onChange={(e) => {
                setRoeEmail(e.target.value);
                clearFieldError('roeEmail');
              }}
              placeholder="rightofentry@example.com"
              autoComplete="email"
              mobileOptimization={true}
              className={`h-12 px-4 py-3 text-gray-900 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${validationErrors.roeEmail ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              disabled={createMutation.isPending}
              onFocus={(e) => scrollToInput(e.target)}
            />
            {validationErrors.roeEmail && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {validationErrors.roeEmail}
              </p>
            )}
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">Project Type</Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger className="h-12 px-4 py-3 text-gray-900 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="government">Government</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cp_state" className="text-sm font-medium text-gray-700">State funding (AUD)</Label>
                <Input
                  id="cp_state"
                  name="state-funding"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={stateFunding}
                  onChange={(e) => {
                    setStateFunding(e.target.value);
                    clearFieldError('stateFunding');
                  }}
                  placeholder="0.00"
                  autoComplete="off"
                  mobileOptimization={true}
                  className={`h-12 px-4 py-3 text-gray-900 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${validationErrors.stateFunding ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                  disabled={createMutation.isPending}
                  onFocus={(e) => scrollToInput(e.target)}
                />
                {validationErrors.stateFunding && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.stateFunding}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="cp_fed" className="text-sm font-medium text-gray-700">Federal funding (AUD)</Label>
                <Input
                  id="cp_fed"
                  name="federal-funding"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={federalFunding}
                  onChange={(e) => {
                    setFederalFunding(e.target.value);
                    clearFieldError('federalFunding');
                  }}
                  placeholder="0.00"
                  autoComplete="off"
                  mobileOptimization={true}
                  className={`h-12 px-4 py-3 text-gray-900 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${validationErrors.federalFunding ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                  disabled={createMutation.isPending}
                  onFocus={(e) => scrollToInput(e.target)}
                />
                {validationErrors.federalFunding && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.federalFunding}
                  </p>
                )}
              </div>
            </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">Builder (optional)</Label>
            <SingleEmployerDialogPicker
              label="Builder"
              selectedId={builderId}
              onChange={(id: string) => setBuilderId(id)}
              prioritizedTag="builder"
              triggerText="Select"
            />
          </div>
          <JVSelector status={jvStatus} label={jvLabel} onChangeStatus={setJvStatus} onChangeLabel={setJvLabel} />
          <div className="flex justify-end gap-4 pt-6">
            <Button
              variant="outline"
              onClick={() => setDialogMode('choice')}
              size="xl"
              className="font-medium"
              disabled={createMutation.isPending}
            >
              Back
            </Button>
            <Button
              disabled={!canSubmit || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              size="xl"
              className="font-medium"
            >
              {createMutation.isPending ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
          </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Mapping Sheet Dialog */}
      <UploadMappingSheetDialog
        mode="new_project"
        open={isUploadDialogOpen}
        onOpenChange={(open) => {
          setIsUploadDialogOpen(open)
          if (!open) {
            if (closingFromUploadResultRef.current) {
              closingFromUploadResultRef.current = false
              return
            }
            setScanToReview(null)
            setOpen(true) // Re-open main dialog when upload is cancelled
          } else {
            setOpen(false)
          }
        }}
        onScanReady={(scanId, projectId) => {
          closingFromUploadResultRef.current = true
          if (projectId) {
            startNavigation(`/projects/${projectId}/scan-review/${scanId}`)
            setTimeout(() => router.push(`/projects/${projectId}/scan-review/${scanId}`), 50)
            return
          }
          setScanToReview({ scanId })
        }}
      />

      {/* Project Quick Finder */}
      <ProjectQuickFinder
        open={scanToReview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setScanToReview(null)
            setOpen(true) // Re-open main dialog when finder is cancelled
          }
        }}
        onSelectExistingProject={(projectId) => {
          if (!scanToReview) return
          startNavigation(`/projects/${projectId}/scan-review/${scanToReview.scanId}`)
          setTimeout(() => router.push(`/projects/${projectId}/scan-review/${scanToReview.scanId}`), 50)
        }}
        onCreateNewProject={() => {
          if (!scanToReview) return
          startNavigation(`/projects/new-scan-review/${scanToReview.scanId}`)
          setTimeout(() => router.push(`/projects/new-scan-review/${scanToReview.scanId}`), 50)
        }}
      />
    </>
  );
}
