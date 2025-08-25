import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/withTimeout";
import { useAuth } from "@/hooks/useAuth";

export const useDashboardData = () => {
  const { session, loading } = useAuth();

  return useQuery({
    queryKey: ["dashboard-data"],
    enabled: !loading && !!session,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const errors: string[] = [];
      const timeoutMs = 4000;

      const workersCountP = withTimeout(
        Promise.resolve(supabase.from("workers").select("*", { count: "exact", head: true })),
        timeoutMs,
        'workers-count'
      );
      const employersCountP = withTimeout(
        Promise.resolve(supabase.from("employers").select("*", { count: "exact", head: true })),
        timeoutMs,
        'employers-count'
      );
      const sitesCountP = withTimeout(
        Promise.resolve(supabase.from("job_sites").select("*", { count: "exact", head: true })),
        timeoutMs,
        'sites-count'
      );
      const activitiesCountP = withTimeout(
        Promise.resolve(supabase.from("union_activities").select("*", { count: "exact", head: true })),
        timeoutMs,
        'activities-count'
      );
      const ebasCountP = withTimeout(
        Promise.resolve(supabase.from("company_eba_records").select("*", { count: "exact", head: true })),
        timeoutMs,
        'ebas-count'
      );
      const membersCountP = withTimeout(
        Promise.resolve(supabase.from("workers").select("*", { count: "exact", head: true }).eq("union_membership_status", "member")),
        timeoutMs,
        'members-count'
      );
      const ebaDataP = withTimeout(
        Promise.resolve(supabase.from("company_eba_records").select("nominal_expiry_date, fwc_certified_date, date_eba_signed, eba_lodged_fwc")),
        timeoutMs,
        'eba-data'
      );
      const employerAnalyticsP = withTimeout(
        Promise.resolve(supabase.from("employer_analytics").select("*")),
        timeoutMs,
        'employer-analytics'
      );

      const [
        workersRes,
        employersRes,
        sitesRes,
        activitiesRes,
        ebasRes,
        membersRes,
        ebaDataRes,
        employerAnalyticsRes,
      ] = await Promise.allSettled([
        workersCountP,
        employersCountP,
        sitesCountP,
        activitiesCountP,
        ebasCountP,
        membersCountP,
        ebaDataP,
        employerAnalyticsP,
      ]);

      const safeCount = (res: any, label: string) => {
        if (res.status === 'fulfilled') return res.value.count || 0;
        errors.push(`${label}: ${res.reason?.message || 'failed'}`);
        return 0;
      };
      const safeData = (res: any, label: string) => {
        if (res.status === 'fulfilled') return res.value.data || [];
        errors.push(`${label}: ${res.reason?.message || 'failed'}`);
        return [];
      };

      const totalWorkers = safeCount(workersRes, 'workers');
      const totalEmployers = safeCount(employersRes, 'employers');
      const totalSites = safeCount(sitesRes, 'sites');
      const totalActivities = safeCount(activitiesRes, 'activities');
      const totalEbas = safeCount(ebasRes, 'ebas');
      const memberCount = safeCount(membersRes, 'members');
      const ebaData = safeData(ebaDataRes, 'ebaData');
      const employerAnalytics = safeData(employerAnalyticsRes, 'employerAnalytics');

      const membershipRate = totalWorkers ? (memberCount / totalWorkers) * 100 : 0;

      const now = new Date();
      const sixWeeks = new Date(now.getTime() + (6 * 7 * 24 * 60 * 60 * 1000));
      const threeMonths = new Date(now.getTime() + (3 * 30 * 24 * 60 * 60 * 1000));
      const sixMonths = new Date(now.getTime() + (6 * 30 * 24 * 60 * 60 * 1000));

      const ebaExpiry = {
        expired: 0,
        expiring6Weeks: 0,
        expiring3Months: 0,
        expiring6Months: 0,
        certified: 0,
        signed: 0,
        lodged: 0,
      } as Record<string, number> & {
        expired: number; expiring6Weeks: number; expiring3Months: number; expiring6Months: number;
        certified: number; signed: number; lodged: number;
      };

      (ebaData as any[])?.forEach((eba: any) => {
        if (eba.fwc_certified_date) ebaExpiry.certified++;
        if (eba.date_eba_signed) ebaExpiry.signed++;
        if (eba.eba_lodged_fwc) ebaExpiry.lodged++;

        if (eba.nominal_expiry_date) {
          const expiryDate = new Date(eba.nominal_expiry_date);
          if (expiryDate < now) {
            ebaExpiry.expired++;
          } else if (expiryDate <= sixWeeks) {
            ebaExpiry.expiring6Weeks++;
          } else if (expiryDate <= threeMonths) {
            ebaExpiry.expiring3Months++;
          } else if (expiryDate <= sixMonths) {
            ebaExpiry.expiring6Months++;
          }
        }
      });

      const mappedEmployers = (employerAnalytics as any[])?.filter((e: any) => 
        e.estimated_worker_count && e.estimated_worker_count > 0 && e.current_worker_count && e.current_worker_count > 0
      ) || [];

      const avgMemberDensity = mappedEmployers.length > 0 
        ? mappedEmployers.reduce((sum: number, emp: any) => sum + (emp.member_density_percent || 0), 0) / mappedEmployers.length
        : 0;

      const ebaPercentage = totalEmployers ? (totalEbas / totalEmployers) * 100 : 0;

      return {
        totalWorkers,
        totalEmployers,
        totalSites,
        totalActivities,
        totalEbas,
        memberCount,
        membershipRate,
        ebaPercentage,
        avgMemberDensity,
        mappedEmployersCount: mappedEmployers.length,
        ebaExpiry,
        errors,
      };
    },
  });
};