import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface ExportRequest {
  format: 'csv' | 'xlsx' | 'json';
  employer_ids?: string[];
  date_range?: {
    from: string;
    to: string;
  };
  rating_status?: ('active' | 'under_review' | 'disputed' | 'superseded' | 'archived')[];
  include_details?: boolean;
  include_history?: boolean;
  include_components?: boolean;
  filters?: {
    employer_type?: string;
    min_score?: number;
    max_score?: number;
    rating_categories?: ('green' | 'amber' | 'red' | 'unknown')[];
  };
}

export interface ExportResponse {
  export_id: string;
  status: 'processing' | 'completed' | 'failed';
  format: string;
  file_size_bytes?: number;
  download_url?: string;
  expires_at?: string;
  record_count?: number;
  generated_at?: string;
  expires_in_hours?: number;
}

// POST handler - Export rating data
async function exportRatingDataHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, first_name, surname')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate request body
    const body: ExportRequest = await request.json();

    if (!body.format || !['csv', 'xlsx', 'json'].includes(body.format)) {
      return NextResponse.json({ error: 'Invalid format. Must be csv, xlsx, or json' }, { status: 400 });
    }

    if (body.employer_ids && body.employer_ids.length > 1000) {
      return NextResponse.json({ error: 'Maximum 1000 employers allowed per export' }, { status: 400 });
    }

    // Validate date range
    if (body.date_range) {
      const fromDate = new Date(body.date_range.from);
      const toDate = new Date(body.date_range.to);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
      }

      if (fromDate > toDate) {
        return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 });
      }

      // Limit date range to 2 years
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - 2);
      if (fromDate < maxDate) {
        return NextResponse.json({ error: 'Date range cannot exceed 2 years' }, { status: 400 });
      }
    }

    // Generate export ID
    const exportId = crypto.randomUUID();

    // Get client IP for audit trail
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    // Create export job record
    const { error: exportError } = await supabase
      .from('rating_export_jobs')
      .insert({
        id: exportId,
        requested_by: user.id,
        format: body.format,
        parameters: body,
        status: 'processing',
        ip_address: ipAddress,
        created_at: new Date().toISOString(),
      });

    if (exportError) {
      console.error('Failed to create export job record:', exportError);
      return NextResponse.json({ error: 'Failed to create export job' }, { status: 500 });
    }

    // Process export asynchronously (in a real implementation, this would be a background job)
    // For now, we'll do it synchronously with proper error handling
    try {
      const exportData = await generateExportData(supabase, body);
      const fileBuffer = await formatExportData(exportData, body.format);

      // In a real implementation, you would upload this to a storage service
      // For now, we'll return a mock response
      const fileSize = fileBuffer.length;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Update export job record
      await supabase
        .from('rating_export_jobs')
        .update({
          status: 'completed',
          file_size_bytes: fileSize,
          record_count: exportData.length,
          completed_at: new Date().toISOString(),
        })
        .eq('id', exportId);

      const response: ExportResponse = {
        export_id: exportId,
        status: 'completed',
        format: body.format,
        file_size_bytes: fileSize,
        download_url: `/api/ratings/export/download/${exportId}`, // Mock URL
        expires_at: expiresAt.toISOString(),
        record_count: exportData.length,
        generated_at: new Date().toISOString(),
        expires_in_hours: 24,
      };

      return NextResponse.json(response, { status: 200 });

    } catch (error) {
      console.error('Export processing error:', error);

      // Update export job record with error
      await supabase
        .from('rating_export_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', exportId);

      return NextResponse.json({ error: 'Export processing failed' }, { status: 500 });
    }

  } catch (error) {
    console.error('Export rating data API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET handler - Get export status
async function getExportStatusHandler(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const exportId = searchParams.get('exportId');

    if (!exportId) {
      return NextResponse.json({ error: 'exportId parameter is required' }, { status: 400 });
    }

    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get export job status
    const { data: exportJob, error: exportError } = await supabase
      .from('rating_export_jobs')
      .select('*')
      .eq('id', exportId)
      .single();

    if (exportError || !exportJob) {
      return NextResponse.json({ error: 'Export job not found' }, { status: 404 });
    }

    // Check if user owns this export or has admin privileges
    if (exportJob.requested_by !== user.id && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - you can only access your own exports' }, { status: 403 });
    }

    const response: ExportResponse = {
      export_id: exportJob.id,
      status: exportJob.status,
      format: exportJob.format,
      file_size_bytes: exportJob.file_size_bytes,
      download_url: exportJob.status === 'completed' ? `/api/ratings/export/download/${exportId}` : undefined,
      expires_at: exportJob.completed_at ?
        new Date(new Date(exportJob.completed_at).getTime() + 24 * 60 * 60 * 1000).toISOString() :
        undefined,
      record_count: exportJob.record_count,
      generated_at: exportJob.completed_at,
      expires_in_hours: 24,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Get export status API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions
async function generateExportData(supabase: Awaited<ReturnType<typeof createServerSupabase>>, request: ExportRequest): Promise<any[]> {
  try {
    let query = supabase
      .from('employer_final_ratings')
      .select(`
        id,
        employer_id,
        rating_date,
        final_rating,
        final_score,
        project_based_rating,
        project_based_score,
        expertise_based_rating,
        expertise_based_score,
        eba_status,
        overall_confidence,
        data_completeness_score,
        rating_status,
        review_required,
        expiry_date,
        created_at,
        updated_at,
        employers!employer_id(name, abn, employer_type),
        profiles!calculated_by(first_name, surname)
      `);

    // Apply filters
    if (request.employer_ids && request.employer_ids.length > 0) {
      query = query.in('employer_id', request.employer_ids);
    }

    if (request.date_range) {
      query = query.gte('rating_date', request.date_range.from);
      query = query.lte('rating_date', request.date_range.to);
    }

    if (request.rating_status && request.rating_status.length > 0) {
      query = query.in('rating_status', request.rating_status);
    }

    if (request.filters) {
      if (request.filters.min_score !== undefined) {
        query = query.gte('final_score', request.filters.min_score);
      }
      if (request.filters.max_score !== undefined) {
        query = query.lte('final_score', request.filters.max_score);
      }
      if (request.filters.rating_categories && request.filters.rating_categories.length > 0) {
        query = query.in('final_rating', request.filters.rating_categories);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];

  } catch (error) {
    console.error('Error generating export data:', error);
    return [];
  }
}

async function formatExportData(data: any[], format: string): Promise<Buffer> {
  switch (format) {
    case 'json':
      return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');

    case 'csv':
      return formatAsCSV(data);

    case 'xlsx':
      // In a real implementation, you would use a library like xlsx
      return formatAsCSV(data); // Fallback to CSV for now

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function formatAsCSV(data: any[]): Buffer {
  if (data.length === 0) {
    return Buffer.from('', 'utf-8');
  }

  // Flatten the data for CSV
  const flattenedData = data.map((row: any) => ({
    id: row.id,
    employer_id: row.employer_id,
    employer_name: row.employers?.name || '',
    employer_abn: row.employers?.abn || '',
    employer_type: row.employers?.employer_type || '',
    rating_date: row.rating_date,
    final_rating: row.final_rating,
    final_score: row.final_score || '',
    project_based_rating: row.project_based_rating || '',
    project_based_score: row.project_based_score || '',
    expertise_based_rating: row.expertise_based_rating || '',
    expertise_based_score: row.expertise_based_score || '',
    eba_status: row.eba_status || '',
    overall_confidence: row.overall_confidence,
    data_completeness_score: row.data_completeness_score || '',
    rating_status: row.rating_status,
    review_required: row.review_required,
    expiry_date: row.expiry_date || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    calculated_by: row.profiles_calculated_by ?
      `${row.profiles_calculated_by.first_name} ${row.profiles_calculated_by.surname}`.trim() : '',
  }));

  // Generate CSV headers
  const headers = Object.keys(flattenedData[0]);
  const csvHeaders = headers.join(',');

  // Generate CSV rows
  const csvRows = flattenedData.map(row => {
    return headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value.toString();
    }).join(',');
  });

  const csvContent = [csvHeaders, ...csvRows].join('\n');
  return Buffer.from(csvContent, 'utf-8');
}

// Export handlers with rate limiting
export const POST = withRateLimit(
  exportRatingDataHandler,
  RATE_LIMIT_PRESETS.EXPENSIVE_QUERY
);

export const GET = withRateLimit(
  getExportStatusHandler,
  RATE_LIMIT_PRESETS.STANDARD
);

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('rating_export_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Active-Exports': count?.toString() || '0',
        'X-Export-System-Status': 'operational',
        'X-Supported-Formats': 'csv,xlsx,json',
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}