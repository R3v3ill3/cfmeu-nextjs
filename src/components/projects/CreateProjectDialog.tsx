import { useEffect, useMemo, useState } from "react";
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
import { GoogleAddressInput, GoogleAddress } from "@/components/projects/GoogleAddressInput"
import { UploadMappingSheetDialog } from "@/components/projects/mapping/UploadMappingSheetDialog"
import { ProjectQuickFinder } from "@/components/projects/ProjectQuickFinder"
import { FileText, Edit } from "lucide-react"
import { useRouter } from "next/navigation"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"

type DialogMode = 'choice' | 'manual' | 'scan'

export default function CreateProjectDialog() {
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('choice');
  const [name, setName] = useState("");
  const [addressData, setAddressData] = useState<GoogleAddress | null>(null);
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

  const canSubmit = useMemo(() => name.trim() && addressData?.formatted, [name, addressData]);

  // Reset dialog mode when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setDialogMode('choice')
      setScanToReview(null)
    }
  }, [open])

  // Calculate tier based on value
  const calculatedTier = useMemo(() => {
    if (!value) return null
    const numValue = Number(value)
    return calculateProjectTier(numValue)
  }, [value])

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: name.trim(),
        value: value ? Number(value) : null,
        proposed_start_date: start || null,
        proposed_finish_date: finish || null,
        roe_email: roeEmail || null,
        project_type: projectType || null,
        state_funding: stateFunding ? Number(stateFunding.replace(/[^0-9.]/g, "")) : 0,
        federal_funding: federalFunding ? Number(federalFunding.replace(/[^0-9.]/g, "")) : 0,
        builder_id: builderId || null,
        // Note: organising_universe will be auto-assigned by trigger based on tier/EBA/patch rules
      };
      const { data: proj, error: projErr } = await supabase
        .from("projects")
        .insert(payload)
        .select("id")
        .single();
      if (projErr) throw projErr;
      const projectId = (proj as any).id as string;

      // create main job site with address and coordinates
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
      if (siteErr) throw siteErr;
      const siteId = (site as any).id as string;
      const { error: linkErr } = await supabase
        .from("projects")
        .update({ main_job_site_id: siteId })
        .eq("id", projectId);
      if (linkErr) throw linkErr;

      if (builderId) {
        // Use RPC function to assign builder role in new system
        await supabase.rpc('assign_contractor_role', {
          p_project_id: projectId,
          p_employer_id: builderId,
          p_role_code: 'builder',
          p_company_name: 'Builder',
          p_is_primary: true
        });
      }

      if (jvStatus) {
        await (supabase as any)
          .from("project_builder_jv")
          .upsert({ project_id: projectId, status: jvStatus, label: jvStatus === 'yes' ? (jvLabel || null) : null }, { onConflict: "project_id" });
      }

      return projectId;
    },
    onSuccess: (id) => {
      toast.success("Project created");
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      try { window.location.href = `/projects/${id}` } catch {}
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create project'),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="xl" className="font-medium">New Project</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">Create Project</DialogTitle>
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
          <div>
            <Label htmlFor="cp_name" className="text-sm font-medium text-gray-700">Project Name</Label>
            <Input id="cp_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-12 px-4 py-3 text-gray-900 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div>
            <Label htmlFor="cp_addr" className="text-sm font-medium text-gray-700">Main Job Site Address</Label>
            <GoogleAddressInput
              value={addressData?.formatted || ""}
              onChange={setAddressData}
              placeholder="Start typing an address..."
            />
          </div>
          {/* Project Value with Tier Preview */}
          <div className="space-y-2">
            <Label htmlFor="value">Project Value (AUD)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="value"
                type="number"
                placeholder="Enter project value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              {calculatedTier && (
                <ProjectTierBadge tier={calculatedTier} size="sm" />
              )}
            </div>
                         <p className="text-sm text-muted-foreground">
               Tier 1: $500M+ | Tier 2: $100M-$500M | Tier 3: &lt;$100M
             </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Proposed Start</Label>
                <DateInput value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Proposed Finish</Label>
                <DateInput value={finish} onChange={(e) => setFinish(e.target.value)} />
              </div>
            </div>
          <div>
            <Label htmlFor="cp_roe" className="text-sm font-medium text-gray-700">ROE Email</Label>
            <Input id="cp_roe" type="email" value={roeEmail} onChange={(e) => setRoeEmail(e.target.value)} placeholder="rightofentry@example.com" className="h-12 px-4 py-3 text-gray-900 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
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
                <Input id="cp_state" value={stateFunding} onChange={(e) => setStateFunding(e.target.value)} placeholder="0" className="h-12 px-4 py-3 text-gray-900 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
              </div>
              <div>
                <Label htmlFor="cp_fed" className="text-sm font-medium text-gray-700">Federal funding (AUD)</Label>
                <Input id="cp_fed" value={federalFunding} onChange={(e) => setFederalFunding(e.target.value)} placeholder="0" className="h-12 px-4 py-3 text-gray-900 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
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
            <Button variant="outline" onClick={() => setDialogMode('choice')} size="xl" className="font-medium">Back</Button>
            <Button disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()} size="xl" className="font-medium">Create</Button>
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
            setScanToReview(null)
            setOpen(true) // Re-open main dialog when upload is cancelled
          }
        }}
        onScanReady={(scanId, projectId) => {
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