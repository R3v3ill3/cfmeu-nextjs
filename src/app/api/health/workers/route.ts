import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface WorkerHealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'disabled' | 'error';
  responseTime?: number;
  error?: string;
  url?: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = await createServerSupabase();
    
    // Check authentication and admin role
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const healthChecks: WorkerHealthCheck[] = [];
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    // Check Dashboard Worker
    const dashboardWorkerUrl = process.env.NEXT_PUBLIC_DASHBOARD_WORKER_URL;
    if (dashboardWorkerUrl && process.env.NEXT_PUBLIC_USE_WORKER_DASHBOARD === 'true') {
      try {
        const workerStartTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
          const response = await fetch(`${dashboardWorkerUrl.replace(/\/$/, '')}/health`, {
            method: 'GET',
            headers: {
              'User-Agent': 'CFMEU-NextJS-Health-Check',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          healthChecks.push({
            service: 'Dashboard Worker',
            status: response.ok ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - workerStartTime,
            url: dashboardWorkerUrl,
            error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (error) {
        healthChecks.push({
          service: 'Dashboard Worker',
          status: 'error',
          responseTime: Date.now() - startTime,
          url: dashboardWorkerUrl,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      healthChecks.push({
        service: 'Dashboard Worker',
        status: 'disabled',
        url: dashboardWorkerUrl || 'Not configured',
      });
    }

    // Check BCI Import Worker
    const bciWorkerUrl = process.env.BCI_WORKER_URL || (!isProd ? 'http://localhost:3250' : undefined);
    if (bciWorkerUrl) {
      try {
        const workerStartTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(`${bciWorkerUrl.replace(/\/$/, '')}/health`, {
            method: 'GET',
            headers: {
              'User-Agent': 'CFMEU-NextJS-Health-Check',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          healthChecks.push({
            service: 'BCI Import Worker',
            status: response.ok ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - workerStartTime,
            url: bciWorkerUrl,
            error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (error) {
        healthChecks.push({
          service: 'BCI Import Worker',
          status: 'error',
          responseTime: Date.now() - startTime,
          url: bciWorkerUrl,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      healthChecks.push({
        service: 'BCI Import Worker',
        status: 'disabled',
        url: isProd ? 'Not configured (set BCI_WORKER_URL)' : 'http://localhost:3250',
      });
    }

    // Check Scraper Worker queue health via Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      const queueCheckStart = Date.now();

      try {
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false },
        });

        const staleMinutes = Number(process.env.SCRAPER_WORKER_STALE_MINUTES ?? 15);
        const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();

        const { data: staleQueuedJobs, error: staleQueuedError } = await serviceClient
          .from('scraper_jobs')
          .select('id, job_type, created_at')
          .eq('status', 'queued')
          .lte('created_at', staleThreshold)
          .limit(5);

        if (staleQueuedError) {
          throw staleQueuedError;
        }

        const { data: staleRunningJobs, error: staleRunningError } = await serviceClient
          .from('scraper_jobs')
          .select('id, job_type, locked_at')
          .eq('status', 'running')
          .lte('locked_at', staleThreshold)
          .limit(5);

        if (staleRunningError) {
          throw staleRunningError;
        }

        const hasQueuedBacklog = (staleQueuedJobs?.length ?? 0) > 0;
        const hasStaleRunning = (staleRunningJobs?.length ?? 0) > 0;

        const status: WorkerHealthCheck['status'] = hasQueuedBacklog || hasStaleRunning ? 'unhealthy' : 'healthy';

        const issues: string[] = [];
        if (hasQueuedBacklog) {
          const example = staleQueuedJobs?.[0];
          issues.push(`Queued jobs waiting since ${example?.created_at ?? 'unknown time'}`);
        }
        if (hasStaleRunning) {
          const example = staleRunningJobs?.[0];
          issues.push(`Running job locked since ${example?.locked_at ?? 'unknown time'}`);
        }

        healthChecks.push({
          service: 'Scraper Worker',
          status,
          responseTime: Date.now() - queueCheckStart,
          url: 'Supabase scraper_jobs queue',
          error: issues.length > 0 ? issues.join('; ') : undefined,
        });
      } catch (error) {
        healthChecks.push({
          service: 'Scraper Worker',
          status: 'error',
          responseTime: Date.now() - queueCheckStart,
          url: 'Supabase scraper_jobs queue',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      healthChecks.push({
        service: 'Scraper Worker',
        status: 'disabled',
        url: 'Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      });
    }

    // Test dashboard worker with actual data call
    if (dashboardWorkerUrl && process.env.NEXT_PUBLIC_USE_WORKER_DASHBOARD === 'true') {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!sessionError && session?.access_token) {
          const dataStartTime = Date.now();
          const dataController = new AbortController();
          const dataTimeoutId = setTimeout(() => dataController.abort(), 15000); // 15 second timeout for data calls
          
          try {
            const testResponse = await fetch(`${dashboardWorkerUrl.replace(/\/$/, '')}/v1/dashboard?tier=tier1&limit=1`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'CFMEU-NextJS-Health-Check',
              },
              signal: dataController.signal,
            });
              clearTimeout(dataTimeoutId);

            healthChecks.push({
              service: 'Dashboard Worker Data API',
              status: testResponse.ok ? 'healthy' : 'unhealthy',
              responseTime: Date.now() - dataStartTime,
              url: `${dashboardWorkerUrl}/v1/dashboard`,
              error: testResponse.ok ? undefined : `HTTP ${testResponse.status}: ${testResponse.statusText}`,
            });
          } catch (fetchError) {
            clearTimeout(dataTimeoutId);
            throw fetchError;
          }
        }
      } catch (error) {
        healthChecks.push({
          service: 'Dashboard Worker Data API',
          status: 'error',
          url: `${dashboardWorkerUrl}/v1/dashboard`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const totalResponseTime = Date.now() - startTime;
    const overallStatus = healthChecks.every(check => 
      check.status === 'healthy' || check.status === 'disabled'
    ) ? 'healthy' : healthChecks.some(check => check.status === 'error') ? 'error' : 'unhealthy';

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overallStatus,
      totalResponseTime,
      checks: healthChecks,
    });

  } catch (error) {
    console.error('Worker health check error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

