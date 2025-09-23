import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

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

