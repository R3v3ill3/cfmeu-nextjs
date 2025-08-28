import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { calculateProjectTier } from "@/components/projects/types"

export type ProjectImportResults = {
  successful: number;
  failed: number;
  errors: string[];
  newEmployers: number;
};

type ProjectImportProps = {
  csvData: any[];
  onImportComplete: (results?: ProjectImportResults) => void;
  onBack: () => void;
};

export default function ProjectImport({ csvData, onImportComplete, onBack }: ProjectImportProps) {
  const [isImporting, setIsImporting] = useState(false);

  const previewRows = useMemo(() => {
    return (csvData || []).map((row) => {
      const name = row.name || row.project_name || row.Name || null;
      const address = row.main_job_site_address || row.address || row.site_address || row.project_address || row.full_address || row.location || null;
      const employerName = row.employer_name || row.builder_name || row.builder || null;
      const value = row.value != null ? Number(row.value) : null;
      const proposed_start_date = row.proposed_start_date || null;
      const proposed_finish_date = row.proposed_finish_date || null;
      const roe_email = row.roe_email || row.roe || null;
      const project_type = row.project_type || null;
      const state_funding = row.state_funding != null && row.state_funding !== "" ? Number(String(row.state_funding).replace(/[^0-9.]/g, "")) : 0;
      const federal_funding = row.federal_funding != null && row.federal_funding !== "" ? Number(String(row.federal_funding).replace(/[^0-9.]/g, "")) : 0;
      const jv_status = row.jv_status || null;
      const jv_label = row.jv_label || null;
      
      // Calculate tier for preview
      const tier = calculateProjectTier(value);
      
      return { 
        name, 
        address, 
        employerName, 
        value, 
        tier,
        proposed_start_date, 
        proposed_finish_date, 
        roe_email, 
        project_type, 
        state_funding, 
        federal_funding, 
        jv_status, 
        jv_label 
      };
    });
  }, [csvData]);

  const requiredMissing = useMemo(() => {
    return previewRows.filter((r) => !r.name || !r.address);
  }, [previewRows]);

  const handleImport = async () => {
    setIsImporting(true);
    const results: ProjectImportResults = { successful: 0, failed: 0, errors: [], newEmployers: 0 };

    try {
      for (const row of previewRows) {
        try {
          if (!row.name || !row.address) throw new Error("Missing required name or address");

          // Resolve employer (optional)
          let employerId: string | null = null;
          if (row.employerName) {
            const { data: matches } = await supabase
              .from("employers")
              .select("id, name")
              .ilike("name", row.employerName);

            if ((matches || []).length === 1) {
              employerId = (matches as any[])[0].id as string;
            } else if ((matches || []).length > 1) {
              // Pick exact case-insensitive match first
              const exact = (matches as any[]).find((m: any) => String(m.name).toLowerCase() === String(row.employerName).toLowerCase());
              if (exact) employerId = exact.id as string;
            }

            if (!employerId) {
              // Attempt creation if not found
              const { data: newEmp, error: empErr } = await supabase
                .from("employers")
                .insert({ name: row.employerName, employer_type: "builder" as any })
                .select("id")
                .single();
              if (empErr) throw empErr;
              employerId = newEmp?.id as string;
              results.newEmployers++;
            }
          }

          // 1) Create project
          const { data: proj, error: projErr } = await supabase
            .from("projects")
            .insert({
              name: row.name,
              value: row.value,
              proposed_start_date: row.proposed_start_date,
              proposed_finish_date: row.proposed_finish_date,
              roe_email: row.roe_email,
              project_type: row.project_type ? String(row.project_type).toLowerCase() as any : null,
              state_funding: row.state_funding ?? 0,
              federal_funding: row.federal_funding ?? 0,
              builder_id: employerId || null,
            })
            .select("id")
            .single();
          if (projErr) throw projErr;
          const projectId = proj!.id as string;

          // 2) Create main job site with address and set pointer
          const { data: site, error: siteErr } = await supabase
            .from("job_sites")
            .insert({ project_id: projectId, name: row.name, is_main_site: true, location: row.address, full_address: row.address })
            .select("id")
            .single();
          if (siteErr) throw siteErr;
          const siteId = site!.id as string;
          const { error: linkErr } = await supabase
            .from("projects")
            .update({ main_job_site_id: siteId })
            .eq("id", projectId);
          if (linkErr) throw linkErr;

          // 3) Add roles (builder/head as applicable)
          if (employerId) {
            await (supabase as any)
              .from("project_employer_roles")
              .insert({ project_id: projectId, employer_id: employerId, role: "builder", start_date: new Date().toISOString().split('T')[0] });
          }

          // 4) JV
          if (row.jv_status) {
            await (supabase as any)
              .from("project_builder_jv")
              .upsert({ project_id: projectId, status: String(row.jv_status).toLowerCase(), label: row.jv_status === 'yes' ? (row.jv_label || null) : null }, { onConflict: "project_id" });
          }

          results.successful++;
        } catch (e: any) {
          results.failed++;
          results.errors.push(`${row.name || 'Unknown'}: ${e?.message || 'Unknown error'}`);
        }
      }

      if (results.failed > 0) {
        toast.error(`Import completed with errors. ${results.successful} succeeded, ${results.failed} failed.`);
      } else {
        toast.success(`Imported ${results.successful} projects`);
      }

      onImportComplete(results);
    } catch (e: any) {
      toast.error(e?.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  if (requiredMissing.length > 0) {
    return (
      <Alert>
        <AlertTitle>Missing required fields</AlertTitle>
        <AlertDescription>
          {requiredMissing.length} row(s) are missing name or address. Please go back and adjust your mapping.
        </AlertDescription>
        <div className="mt-3">
          <Button variant="outline" onClick={onBack}>Back to mapping</Button>
        </div>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="text-sm text-muted-foreground">Ready to import {previewRows.length} projects.</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={isImporting}>Back</Button>
          <Button onClick={handleImport} disabled={isImporting || previewRows.length === 0}>
            {isImporting ? 'Importing…' : 'Import Projects'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}