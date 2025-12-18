import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CoreComplianceData {
  delegateIdentified: boolean;
  hsrChairExists: boolean;
  delegateInfo?: {
    name: string;
    email?: string;
    phone?: string;
  };
  hsrInfo?: {
    name: string;
    email?: string;
    phone?: string;
  };
}

export function useCoreComplianceData(projectId: string) {
  return useQuery({
    queryKey: ["core-compliance", projectId],
    queryFn: async (): Promise<CoreComplianceData> => {
      // Get site contacts from mapping sheets
      const { data: siteContacts, error: siteError } = await supabase
        .from("site_contacts")
        .select(
          `
            id,
            role,
            name,
            email,
            phone,
            job_site_id,
            job_sites!inner(project_id)
          `
        )
        .eq("job_sites.project_id", projectId);

      if (siteError && siteError.code !== 'PGRST116') {
        console.error("Error fetching site contacts:", siteError);
      }

      // Get union roles as backup/additional source
      const { data: unionRoles, error: unionError } = await supabase
        .from("union_roles")
        .select(`
          *,
          workers!inner(
            first_name,
            surname,
            email,
            mobile_phone
          ),
          job_sites!inner(project_id)
        `)
        .eq("job_sites.project_id", projectId)
        .is("end_date", null);

      if (unionError && unionError.code !== 'PGRST116') {
        console.error("Error fetching union roles:", unionError);
      }

      // Check for delegate
      const delegateContact = siteContacts?.find(contact => contact.role === 'site_delegate');
      const delegateRole = unionRoles?.find(role => role.name === 'site_delegate');

      const delegateIdentified = !!(delegateContact || delegateRole);
      const delegateInfo = delegateContact ? {
        name: delegateContact.name || '',
        email: delegateContact.email || undefined,
        phone: delegateContact.phone || undefined
      } : delegateRole ? {
        name: `${delegateRole.workers.first_name} ${delegateRole.workers.surname}`,
        email: delegateRole.workers.email || undefined,
        phone: delegateRole.workers.mobile_phone || undefined
      } : undefined;

      // Check for HSR
      const hsrContact = siteContacts?.find(contact => contact.role === 'site_hsr');
      const hsrRole = unionRoles?.find(role => role.name === 'hsr');

      const hsrChairExists = !!(hsrContact || hsrRole);
      const hsrInfo = hsrContact ? {
        name: hsrContact.name || '',
        email: hsrContact.email || undefined,
        phone: hsrContact.phone || undefined
      } : hsrRole ? {
        name: `${hsrRole.workers.first_name} ${hsrRole.workers.surname}`,
        email: hsrRole.workers.email || undefined,
        phone: hsrRole.workers.mobile_phone || undefined
      } : undefined;

      return {
        delegateIdentified,
        hsrChairExists,
        delegateInfo,
        hsrInfo
      };
    },
    enabled: !!projectId
  });
}