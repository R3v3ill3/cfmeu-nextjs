import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SystemHealthMetrics {
  database: {
    status: 'healthy' | 'unhealthy' | 'error';
    responseTime: number;
    error?: string;
    connectionPool?: {
      active: number;
      waiting: number;
    };
  };
  api: {
    status: 'healthy' | 'unhealthy' | 'error';
    responseTime: number;
    error?: string;
  };
  workers: {
    status: 'healthy' | 'unhealthy' | 'disabled' | 'error';
    responseTime?: number;
    error?: string;
  };
  environment: {
    nodeEnv: string;
    nextjsVersion: string;
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
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

    const metrics: SystemHealthMetrics = {
      database: {
        status: 'healthy',
        responseTime: 0,
      },
      api: {
        status: 'healthy',
        responseTime: 0,
      },
      workers: {
        status: 'disabled',
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        nextjsVersion: process.env.npm_package_version || 'unknown',
        uptime: process.uptime(),
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
        },
      },
    };

    // Test Database Connection & Performance
    try {
      const dbStartTime = Date.now();
      
      // Simple query to test connectivity
      const { data: connectionTest, error: connectionError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (connectionError) {
        throw connectionError;
      }

      // Test a more complex query for performance
      const { data: performanceTest, error: perfError } = await supabase
        .from('projects')
        .select('id, name, tier')
        .limit(10);

      if (perfError) {
        throw perfError;
      }

      metrics.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStartTime,
      };

    } catch (error) {
      metrics.database = {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }

    // Test API Performance
    try {
      const apiStartTime = Date.now();
      
      // Test internal API call
      const testUrl = new URL('/api/workers?page=1&pageSize=1', request.url);
      const apiController = new AbortController();
      const apiTimeoutId = setTimeout(() => apiController.abort(), 10000);
      
      try {
        const apiResponse = await fetch(testUrl, {
          headers: {
            'Cookie': request.headers.get('Cookie') || '',
          },
          signal: apiController.signal,
        });
        clearTimeout(apiTimeoutId);

        metrics.api = {
          status: apiResponse.ok ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - apiStartTime,
          error: apiResponse.ok ? undefined : `HTTP ${apiResponse.status}: ${apiResponse.statusText}`,
        };
      } catch (fetchError) {
        clearTimeout(apiTimeoutId);
        throw fetchError;
      }

    } catch (error) {
      metrics.api = {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'API test failed',
      };
    }

    // Check Worker Status (call our worker health endpoint)
    try {
      const workerStartTime = Date.now();
      const workerUrl = new URL('/api/health/workers', request.url);
      const workerController = new AbortController();
      const workerTimeoutId = setTimeout(() => workerController.abort(), 15000);
      
      try {
        const workerResponse = await fetch(workerUrl, {
          headers: {
            'Cookie': request.headers.get('Cookie') || '',
          },
          signal: workerController.signal,
        });
        clearTimeout(workerTimeoutId);

        if (workerResponse.ok) {
          const workerData = await workerResponse.json();
          metrics.workers = {
            status: workerData.overallStatus,
            responseTime: Date.now() - workerStartTime,
          };
        } else {
          metrics.workers = {
            status: 'error',
            responseTime: Date.now() - workerStartTime,
            error: `Worker health check failed: HTTP ${workerResponse.status}`,
          };
        }
      } catch (fetchError) {
        clearTimeout(workerTimeoutId);
        throw fetchError;
      }

    } catch (error) {
      metrics.workers = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Worker check failed',
      };
    }

    // Calculate overall system status
    const overallStatus = 
      metrics.database.status === 'error' || metrics.api.status === 'error' ? 'error' :
      metrics.database.status === 'unhealthy' || metrics.api.status === 'unhealthy' || metrics.workers.status === 'unhealthy' ? 'unhealthy' :
      'healthy';

    const totalResponseTime = Date.now() - startTime;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overallStatus,
      totalResponseTime,
      metrics,
      uptime: {
        process: process.uptime(),
        formatted: formatUptime(process.uptime()),
      },
    });

  } catch (error) {
    console.error('System health check error:', error);
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

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

