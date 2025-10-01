"use client"

import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DateInput from "@/components/ui/date-input";
import { toast } from "sonner";
import { MappingSiteContactsTable } from "./MappingSiteContactsTable";
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useMappingSheetData } from "@/hooks/useMappingSheetData";
import { AutoMatchIndicator } from "@/components/projects/mapping/AutoMatchIndicator";
import { ShareLinkGenerator } from "./ShareLinkGenerator";
import { UploadMappingSheetDialog } from "./UploadMappingSheetDialog";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal";

type ProjectData = {
  id: string;
  name: string;
  value: number | null;
  tier: string | null;
  proposed_start_date: string | null;
  proposed_finish_date: string | null;
  roe_email: string | null;
  project_type: string | null;
  state_funding: number;
  federal_funding: number;
  builder_id: string | null;
  main_job_site_id: string | null;
  address: string | null;
  builderName: string | null;
  builderHasEba: boolean | null;
  organisers: string;
  workerTotals: { totalWorkers: number; totalMembers: number; totalLeaders: number; } | null;
  ebaStats: { ebaCount: number; employerCount: number; } | null;
  lastVisit: string | null;
  patches: Array<{ id: string; name: string }>;
};

interface MappingSheetPage1Props {
  projectData: ProjectData;
  onProjectUpdate: (patch: Partial<ProjectData>) => void;
  onAddressUpdate: (address: string) => void;
}

export function MappingSheetPage1({ projectData, onProjectUpdate, onAddressUpdate }: MappingSheetPage1Props) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);
  const [isEmployerDetailOpen, setIsEmployerDetailOpen] = useState(false);
  
  // Get unified contractor data
  const { data: mappingData, isLoading: isLoadingContractors } = useMappingSheetData(projectData.id);

  const scheduleUpdate = (patch: Partial<ProjectData>) => {
    setSaveStatus('dirty');
    if (savedMessageTimerRef.current) clearTimeout(savedMessageTimerRef.current);
    
    onProjectUpdate(patch);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const { error } = await supabase.from("projects").update(patch as any).eq("id", projectData.id);
        if (error) throw error;
        setSaveStatus('saved');
        savedMessageTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e: any) {
        toast.error(e?.message || "Failed to save project");
        setSaveStatus('dirty');
      }
    }, 800);
  };

  const saveAddress = (val: string) => {
    setSaveStatus('dirty');
    if (savedMessageTimerRef.current) clearTimeout(savedMessageTimerRef.current);

    onAddressUpdate(val);
    if (!projectData.main_job_site_id) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const { error } = await (supabase as any)
          .from("job_sites")
          .update({ full_address: val, location: val })
          .eq("id", projectData.main_job_site_id);
        if (error) throw error;
        setSaveStatus('saved');
        savedMessageTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e: any) {
        toast.error(e?.message || "Failed to save address");
        setSaveStatus('dirty');
      }
    }, 800);
  };

  const SaveStatus = () => {
    switch (saveStatus) {
      case 'dirty':
        return <span className="text-yellow-500">Some changes not saved</span>;
      case 'saving':
        return <span>Saving…</span>;
      case 'saved':
        return <span className="text-green-600">All changes saved</span>;
      case 'idle':
      default:
        return <span>&nbsp;</span>; // Keep space to prevent layout shift
    }
  };

  return (
    <div className="print-border p-4">
      {/* Paper-style header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/cfmeu-logo.png" alt="CFMEU" width={120} height={40} className="object-contain" />
          <div>
            <div className="text-xl font-black tracking-tight">Mapping Sheets</div>
            <div className="text-xs text-muted-foreground leading-snug">Organiser: {projectData.organisers || "—"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="no-print flex items-center gap-2">
            <Button
              onClick={() => setShowUploadDialog(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload Scanned Sheet
            </Button>
            <ShareLinkGenerator projectId={projectData.id} projectName={projectData.name} />
          </div>
          <div className="text-right text-xs">
            <div>Form MS-01</div>
            <div className="text-muted-foreground">Rev {new Date().getFullYear()}</div>
          </div>
        </div>
      </div>
      
      {/* Project Header with Tier */}
      <div className="border-b border-gray-200 pb-4 mb-4">
        <h2 className="text-2xl font-bold mb-2">{projectData.name}</h2>
        <div className="flex items-center gap-3">
          <ProjectTierBadge tier={projectData.tier || null} size="md" />
          {projectData.value && (
            <span className="text-lg text-muted-foreground">
              ${(projectData.value / 1000000).toFixed(1)}M
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        {/* Row 1 */}
        <div className="md:col-span-2">
          <label className="text-sm font-semibold">Project Name</label>
          <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={projectData.name || ""} onChange={(e) => scheduleUpdate({ name: e.target.value })} placeholder="" />
        </div>
        <div>
          <label className="text-sm font-semibold">Project Value (AUD)</label>
          <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={String(projectData.value ?? "")} onChange={(e) => scheduleUpdate({ value: e.target.value ? Number(e.target.value) : null })} placeholder="" />
        </div>

        {/* Row 2 */}
        <div className="md:col-span-3">
          <label className="text-sm font-semibold">Address</label>
          <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={projectData.address || ""} onChange={(e) => saveAddress(e.target.value)} placeholder="" />
        </div>

        {/* Row 3 - Dynamic Contractor Roles */}
        {isLoadingContractors ? (
          <div className="md:col-span-3 text-sm text-muted-foreground">Loading contractor information...</div>
        ) : (
          <>
            {mappingData?.contractorRoles.slice(0, 2).map((contractor, index) => (
              <div key={contractor.id} className={index === 0 ? "md:col-span-2" : ""}>
                <label className="text-sm font-semibold">{contractor.roleLabel}</label>
                <div className="flex items-center gap-2">
                  {contractor.employerId ? (
                    <button
                      onClick={() => {
                        setSelectedEmployerId(contractor.employerId!);
                        setIsEmployerDetailOpen(true);
                      }}
                      className={`rounded-none border-0 border-b border-black px-0 flex-1 text-left underline hover:text-primary ${
                        contractor.matchStatus === 'auto_matched' 
                          ? 'italic text-gray-500' 
                          : ''
                      }`}
                    >
                      {contractor.employerName || "—"}
                    </button>
                  ) : (
                    <div className="rounded-none border-0 border-b border-black px-0 flex-1 text-gray-400">
                      {contractor.employerName || "—"}
                    </div>
                  )}
                  {/* Show auto-match indicator */}
                  {contractor.employerName && (
                    <AutoMatchIndicator
                      matchStatus={contractor.matchStatus}
                      dataSource={contractor.dataSource}
                      matchConfidence={contractor.matchConfidence}
                      matchNotes={contractor.matchNotes}
                      className="text-xs ml-1"
                    />
                  )}
                </div>
              </div>
            ))}
            {mappingData?.contractorRoles.length === 0 && (
              <>
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold">Builder</label>
                  <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={projectData.builderName || "—"} readOnly disabled />
                </div>
                <div>
                  <label className="text-sm font-semibold">EBA with CFMEU</label>
                  <div className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0 py-2 flex items-center gap-2">
                    {projectData.builderName === "—" ? "—" : (
                      projectData.builderHasEba === null ? "—" : (
                        projectData.builderHasEba ? (
                          <>
                            <span>Yes</span>
                            <Image src="/eurekaflag.gif" alt="Eureka Flag" width={20} height={12} className="inline-block" />
                          </>
                        ) : "No"
                      )
                    )}
                  </div>
                </div>
              </>
            )}
            {mappingData?.contractorRoles.length === 1 && (
              <div>
                <label className="text-sm font-semibold">EBA with CFMEU</label>
                <div className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0 py-2 flex items-center gap-2">
                  {mappingData.contractorRoles[0].ebaStatus === null ? "—" : (
                    mappingData.contractorRoles[0].ebaStatus ? (
                      <>
                        <span>Yes</span>
                        <Image src="/eurekaflag.gif" alt="Eureka Flag" width={20} height={12} className="inline-block" />
                      </>
                    ) : "No"
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Accordion type="single" collapsible className="w-full mt-4">
        {/* Additional Contractor Roles Section */}
        {mappingData && mappingData.contractorRoles.length > 2 && (
          <AccordionItem value="additional-contractors">
            <AccordionTrigger className="text-sm font-semibold">Additional Contractor Roles</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
                {mappingData.contractorRoles.slice(2).map((contractor) => (
                  <div key={contractor.id}>
                    <label className="text-sm font-semibold">{contractor.roleLabel}</label>
                    <div className="flex items-center gap-2">
                      {contractor.employerId ? (
                        <button
                          onClick={() => {
                            setSelectedEmployerId(contractor.employerId!);
                            setIsEmployerDetailOpen(true);
                          }}
                          className={`rounded-none border-0 border-b border-black px-0 flex-1 text-left underline hover:text-primary ${
                            contractor.matchStatus === 'auto_matched' 
                              ? 'italic text-gray-500' 
                              : ''
                          }`}
                        >
                          {contractor.employerName || "—"}
                        </button>
                      ) : (
                        <div className="rounded-none border-0 border-b border-black px-0 flex-1 text-gray-400">
                          {contractor.employerName || "—"}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>EBA:</span>
                        {contractor.ebaStatus === null ? "—" : (
                          contractor.ebaStatus ? (
                            <span className="flex items-center gap-1">
                              <span>Yes</span>
                              <Image src="/eurekaflag.gif" alt="Eureka Flag" width={16} height={10} className="inline-block" />
                            </span>
                          ) : "No"
                        )}
                      </span>
                      {/* Show auto-match indicator */}
                      {contractor.employerName && (
                        <AutoMatchIndicator
                          matchStatus={contractor.matchStatus}
                          dataSource={contractor.dataSource}
                          matchConfidence={contractor.matchConfidence}
                          matchNotes={contractor.matchNotes}
                          className="text-xs ml-1"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        
        <AccordionItem value="project-details">
          <AccordionTrigger className="text-sm font-semibold">Project Details</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 pt-2">
              <div>
                <label className="text-sm font-semibold">Proposed start date</label>
                <DateInput className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={projectData.proposed_start_date || ""} onChange={(e) => scheduleUpdate({ proposed_start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Proposed finish date</label>
                <DateInput className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={projectData.proposed_finish_date || ""} onChange={(e) => scheduleUpdate({ proposed_finish_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Funding Type</label>
                <Select value={projectData.project_type || ""} onValueChange={(v) => scheduleUpdate({ project_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold">State Funding (AUD)</label>
                <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={String(projectData.state_funding ?? 0)} onChange={(e) => scheduleUpdate({ state_funding: Number(e.target.value.replace(/[^0-9.]/g, "")) })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Federal Funding (AUD)</label>
                <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={String(projectData.federal_funding ?? 0)} onChange={(e) => scheduleUpdate({ federal_funding: Number(e.target.value.replace(/[^0-9.]/g, "")) })} />
              </div>
              <div className="no-print">
                  <label className="text-sm font-semibold">Preferred email for ROE</label>
                  <Input type="email" className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={projectData.roe_email || ""} onChange={(e) => scheduleUpdate({ roe_email: e.target.value })} placeholder="" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm p-4 border rounded-lg bg-muted/20">
        <div className="space-y-1">
          <div className="font-medium">Total workers</div>
          <div className="text-muted-foreground">{projectData.workerTotals?.totalWorkers ?? '—'}</div>
        </div>
        <div className="space-y-1">
          <div className="font-medium">Total members</div>
          <div className="text-muted-foreground">{projectData.workerTotals?.totalMembers ?? '—'}</div>
        </div>
        <div className="space-y-1">
          <div className="font-medium">Total leaders</div>
          <div className="text-muted-foreground">{projectData.workerTotals?.totalLeaders ?? '—'}</div>
        </div>
        <div className="space-y-1">
          <div className="font-medium">EBA coverage</div>
          <div className="text-muted-foreground">{projectData.ebaStats ? `${projectData.ebaStats.ebaCount} / ${projectData.ebaStats.employerCount}` : "—"}</div>
        </div>
        <div className="space-y-1">
          <div className="font-medium">Last site visit</div>
          <div className="text-muted-foreground">{projectData.lastVisit || "—"}</div>
        </div>
        <div className="space-y-1">
          <div className="font-medium">Patch</div>
          <div className="text-muted-foreground truncate">
            {projectData.patches.length > 0 ? `${projectData.patches[0]?.name}${projectData.patches.length > 1 ? ` +${projectData.patches.length - 1}` : ''}` : '—'}
          </div>
        </div>
      </div>

      <MappingSiteContactsTable projectId={projectData.id} mainSiteId={projectData.main_job_site_id} />

      <div className="text-sm text-muted-foreground mt-2" aria-live="polite"><SaveStatus /></div>
      
      {/* Upload Scanned Mapping Sheet Dialog */}
      {showUploadDialog && (
        <UploadMappingSheetDialog
          projectId={projectData.id}
          projectName={projectData.name}
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
        />
      )}

      {/* Employer Detail Modal */}
      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={isEmployerDetailOpen}
        onClose={() => setIsEmployerDetailOpen(false)}
        initialTab="overview"
      />
    </div>
  );
}

