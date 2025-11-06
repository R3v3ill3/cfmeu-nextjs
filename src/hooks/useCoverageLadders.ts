import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export interface CoverageLaddersData {
  projects: {
    total: number;
    knownBuilders: number;
    ebaBuilders: number;
    unknownBuilders: number;
    knownNonEbaBuilders: number;
    knownBuilderPercentage: number;
    ebaOfKnownPercentage: number;
    chartData: Array<{
      name: string;
      "Unknown builder": number;
      "Known, non-EBA builder": number;
      "EBA builder": number;
    }>;
  };
  contractors: {
    total: number;
    identified: number;
    eba: number;
    unidentified: number;
    identifiedNonEba: number;
    identifiedPercentage: number;
    ebaOfIdentifiedPercentage: number;
    chartData: Array<{
      name: string;
      "Unidentified slot": number;
      "Identified contractor, non-EBA": number;
      "Identified contractor, EBA": number;
    }>;
  };
  debug?: {
    queryTime: number;
    stage: string;
    universe: string;
    patchIds: string[] | null;
  };
}

export const useCoverageLadders = (opts?: {
  patchIds?: string[];
  tier?: string;
  stage?: string;
  universe?: string
}) => {
  const { session, loading } = useAuth();
  const workerEnabled = process.env.NEXT_PUBLIC_USE_WORKER_DASHBOARD === 'true';
  const workerUrl = process.env.NEXT_PUBLIC_DASHBOARD_WORKER_URL || '';

  return useQuery({
    queryKey: ["coverage-ladders", opts?.patchIds?.slice().sort() || [], opts?.tier, opts?.stage, opts?.universe],
    enabled: !loading && !!session,
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
    queryFn: async (): Promise<CoverageLaddersData> => {
      const startTime = Date.now();

      // If worker enabled, try to use it with fallback to direct query
      if (workerEnabled && workerUrl && session?.access_token) {
        const searchParams = new URLSearchParams();
        if (opts?.tier && opts.tier !== 'all') searchParams.set('tier', opts.tier);
        if (opts?.stage && opts.stage !== 'all') searchParams.set('stage', opts.stage);
        if (opts?.universe && opts.universe !== 'all') searchParams.set('universe', opts.universe);
        if (opts?.patchIds && opts.patchIds.length > 0) searchParams.set('patchIds', opts.patchIds.join(','));

        const url = `${workerUrl.replace(/\/$/, '')}/v1/coverage-ladders?${searchParams.toString()}`;

        try {
          const resp = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!resp.ok) {
            const status = resp.status;
            // For 5xx or 429 errors, fallback to direct query
            if (status >= 500 || status === 429) {
              console.warn(`⚠️ Coverage Ladders worker responded with ${status}, falling back to direct query`);
              throw new Error(`Worker error ${status} - falling back`);
            }
            throw new Error(`Coverage Ladders worker error ${resp.status}`);
          }

          const data = await resp.json();
          return {
            ...data,
            debug: {
              ...data.debug,
              queryTime: Date.now() - startTime,
            }
          };
        } catch (error) {
          // Connection refused, network error, or worker error - fallback to direct query
          console.warn('⚠️ Coverage Ladders worker request failed, falling back to direct query', error);
          throw error;
        }
      }

      // Worker not enabled, throw error to trigger fallback
      throw new Error('Worker not enabled for Coverage Ladders');
    }
  });
};