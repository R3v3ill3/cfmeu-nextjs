"use client"

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MappingSheetPage1 } from "@/components/projects/mapping/MappingSheetPage1";
import { MappingSubcontractorsTable } from "@/components/projects/mapping/MappingSubcontractorsTable";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePatchOrganiserLabels } from "@/hooks/usePatchOrganiserLabels";

export default function ProjectPrintPage() {
  const params = useParams();
  const sp = useSearchParams();
  const projectId = params?.projectId as string;

  // Fetch project data
  const { data: project } = useQuery({
    queryKey: ["project-print", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, value, tier, proposed_start_date, proposed_finish_date, roe_email, project_type, state_funding, federal_funding, builder_id, main_job_site_id")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Fetch main site address
  const { data: siteData } = useQuery({
    queryKey: ["project-site", project?.main_job_site_id],
    enabled: !!project?.main_job_site_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("full_address, location")
        .eq("id", project!.main_job_site_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Fetch builder info
  const { data: builderData } = useQuery({
    queryKey: ["builder", project?.builder_id],
    enabled: !!project?.builder_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employers")
        .select("name, enterprise_agreement_status")
        .eq("id", project!.builder_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Fetch patches
  const { data: patches = [] } = useQuery({
    queryKey: ["project-patches", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patch_projects")
        .select("patches(id, name)")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data || []).map((pp: any) => pp.patches).filter(Boolean);
    }
  });

  const patchOrganisers = usePatchOrganiserLabels(projectId);

  useEffect(() => {
    const qp = sp.get("print");
    if (qp === "1") {
      try {
        // Give the page a moment to render, then trigger print
        setTimeout(() => {
          window.print();
        }, 300);
      } catch {}
    }

    // Attempt to auto-close tab/window after printing when opened via window.open
    const handleAfterPrint = () => {
      try {
        // Some browsers block window.close() unless window was opened by script
        window.close();
      } catch {}
    };
    try {
      window.addEventListener("afterprint", handleAfterPrint);
    } catch {}
    return () => {
      try { window.removeEventListener("afterprint", handleAfterPrint); } catch {}
    };
  }, [sp]);

  if (!project) {
    return <div className="p-4">Loading...</div>;
  }

  const projectData = {
    ...project,
    address: siteData?.full_address || siteData?.location || null,
    builderName: builderData?.name || null,
    builderHasEba: builderData?.enterprise_agreement_status === 'covered' ? true : builderData?.enterprise_agreement_status === 'not_covered' ? false : null,
    organisers: (patchOrganisers as any[])?.join?.(', ') || '',
    workerTotals: null,
    ebaStats: null,
    lastVisit: null,
    patches: patches || [],
  };

  return (
    <div className="space-y-6">
      {/* Screen toolbar (hidden on print) */}
      <div className="no-print flex items-center justify-end gap-2 p-2 border-b">
        <Button variant="outline" onClick={() => { try { window.print(); } catch {} }}>Print</Button>
        <Button variant="outline" onClick={() => { try { window.close(); } catch {} }}>Close</Button>
      </div>

      <div className="print-only" />
      <div className="print-border p-4 break-after-page">
        <MappingSheetPage1 
          projectData={projectData}
          onProjectUpdate={() => {}}
          onAddressUpdate={() => {}}
        />
      </div>
      <div className="print-border p-4">
        <MappingSubcontractorsTable projectId={projectId} />
      </div>
    </div>
  );
}

