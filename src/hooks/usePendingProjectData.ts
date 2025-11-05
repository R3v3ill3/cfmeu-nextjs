import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { PendingProject } from '@/types/pendingProjectReview';

interface UsePendingProjectDataOptions {
  projectId: string | null;
  enabled?: boolean;
}

export function usePendingProjectData({ projectId, enabled = true }: UsePendingProjectDataOptions) {
  const [data, setData] = useState<PendingProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !enabled) {
      setData(null);
      setError(null);
      return;
    }

    const fetchProjectData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseBrowserClient();

        // Fetch complete project data with all relations
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select(`
            *,
            main_job_site:job_sites!main_job_site_id (
              id,
              full_address,
              address_line_1,
              suburb,
              state,
              postcode,
              latitude,
              longitude,
              site_contacts (
                id,
                name,
                role,
                phone,
                email,
                created_at,
                updated_at
              )
            ),
            project_assignments (
              id,
              assignment_type,
              employer_id,
              contractor_role_id,
              trade_type_id,
              created_at,
              source,
              employer:employers!employer_id (
                id,
                name,
                employer_type,
                enterprise_agreement_status,
                eba_status_source,
                approval_status,
                website,
                phone,
                email
              ),
              contractor_role:contractor_role_types (
                name,
                code
              ),
              trade_type:trade_types (
                name,
                code
              )
            ),
            scan:mapping_sheet_scans!mapping_sheet_scans_project_id_fkey (
              id,
              file_name,
              uploaded_at,
              uploaded_by,
              file_size_bytes,
              status,
              upload_mode,
              created_at
            )
          `)
          .eq('id', projectId)
          .eq('approval_status', 'pending')
          .single();

        if (projectError) {
          throw new Error(projectError.message);
        }

        // Fetch uploader profiles separately if we have scans with uploaded_by
        let projectWithUploaders = project;
        if (project?.scan && Array.isArray(project.scan) && project.scan.length > 0) {
          const uploaderIds = project.scan
            .map((scan: any) => scan.uploaded_by)
            .filter((id: string | null) => id !== null) as string[];

          if (uploaderIds.length > 0) {
            const { data: uploaderProfiles } = await supabase
              .from('profiles')
              .select('id, email, full_name')
              .in('id', uploaderIds);

            if (uploaderProfiles) {
              const uploaderMap = new Map(
                uploaderProfiles.map((p: any) => [p.id, p])
              );

              // Attach uploader profiles to scans
              projectWithUploaders = {
                ...project,
                scan: project.scan.map((scan: any) => ({
                  ...scan,
                  uploader: scan.uploaded_by ? uploaderMap.get(scan.uploaded_by) ?? null : null,
                })),
              };
            }
          }
        }

        setData(projectWithUploaders as PendingProject);
      } catch (err) {
        console.error('Error fetching project data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch project data');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId, enabled]);

  return {
    data,
    isLoading,
    error,
    refetch: () => {
      if (projectId && enabled) {
        setData(null);
        setError(null);
      }
    },
  };
}
