import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface DiagnosticResponse {
  auth: {
    hasUser: boolean;
    userId: string | null;
    timestamp: string;
    error?: string;
  };
  environment: {
    hasSupabaseUrl: boolean;
    hasSupabaseKey: boolean;
    hasServiceKey: boolean;
    nodeEnv: string;
  };
  vercel: {
    region: string | undefined;
    deployment: string | undefined;
    url: string | undefined;
  };
  supabase: {
    connectionTest: string;
    responseTime?: number;
    error?: string;
  };
  performance: {
    totalDuration: number;
    authDuration?: number;
    dbDuration?: number;
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const result: DiagnosticResponse = {
    auth: {
      hasUser: false,
      userId: null,
      timestamp: new Date().toISOString(),
    },
    environment: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV || 'unknown',
    },
    vercel: {
      region: process.env.VERCEL_REGION,
      deployment: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7),
      url: process.env.VERCEL_URL,
    },
    supabase: {
      connectionTest: 'not-tested',
    },
    performance: {
      totalDuration: 0,
    },
  };

  // Test authentication
  try {
    const authStartTime = Date.now();
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const authDuration = Date.now() - authStartTime;
    
    result.performance.authDuration = authDuration;
    
    if (authError) {
      result.auth.error = authError.message;
    } else {
      result.auth.hasUser = !!user;
      result.auth.userId = user?.id || null;
    }

    // Test basic database connection
    try {
      const dbStartTime = Date.now();
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      const dbDuration = Date.now() - dbStartTime;
      
      result.performance.dbDuration = dbDuration;
      
      if (dbError) {
        result.supabase.connectionTest = 'failed';
        result.supabase.error = dbError.message;
      } else {
        result.supabase.connectionTest = 'success';
        result.supabase.responseTime = dbDuration;
      }
    } catch (dbError) {
      result.supabase.connectionTest = 'error';
      result.supabase.error = dbError instanceof Error ? dbError.message : 'Unknown database error';
    }
  } catch (error) {
    result.auth.error = error instanceof Error ? error.message : 'Unknown auth error';
  }

  result.performance.totalDuration = Date.now() - startTime;

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

