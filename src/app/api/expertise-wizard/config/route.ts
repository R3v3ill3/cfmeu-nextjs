import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Configuration endpoint for expertise wizard
export const GET = withRateLimit(
  async function GET() {
    try {
      const supabase = createServerSupabase();

      const { count, error } = await supabase
        .from('organiser_wizard_config')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) throw error;

      return new NextResponse(null, {
        status: 200,
        headers: {
          'X-Total-Wizard-Steps': count?.toString() || '0',
          'X-Wizard-Version': '1.0',
          'X-Last-Updated': new Date().toISOString()
        }
      });
    } catch (error) {
      return new NextResponse(null, { status: 503 });
    }
  },
  RATE_LIMIT_PRESETS.RELAXED
);

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('organiser_wizard_config')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Wizard-Steps': count?.toString() || '0',
        'X-Wizard-Version': '1.0',
        'X-Last-Updated': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}