import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// GET - Fetch current weights and weight history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const track = searchParams.get('track');
    const history = searchParams.get('history') === 'true';

    // Get current user and verify admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (history === 'true') {
      // Get weight history
      const { data, error } = await supabase.rpc('get_weight_history', {
        p_track: track,
        p_limit: 50
      });

      if (error) {
        console.error('Error fetching weight history:', error);
        return NextResponse.json({ error: 'Failed to fetch weight history' }, { status: 500 });
      }

      return NextResponse.json({ history: data });
    } else {
      // Get current weights for all tracks
      const { data: organiserWeights } = await supabase.rpc('get_rating_weights', {
        p_track: 'organiser_expertise'
      });

      const { data: projectWeights } = await supabase.rpc('get_rating_weights', {
        p_track: 'project_data'
      });

      const { data: configs, error: configError } = await supabase
        .from('rating_weight_configs')
        .select('*')
        .eq('is_active', true)
        .order('track');

      if (configError) {
        console.error('Error fetching weight configs:', configError);
        return NextResponse.json({ error: 'Failed to fetch weight configs' }, { status: 500 });
      }

      return NextResponse.json({
        current_weights: {
          organiser_expertise: organiserWeights,
          project_data: projectWeights
        },
        configurations: configs
      });
    }
  } catch (error) {
    console.error('Error in GET /api/admin/rating-weights:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Update weights for a track
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const body = await request.json();

    // Get current user and verify admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Validate required fields
    const { track, weights, name, description } = body;
    if (!track || !weights) {
      return NextResponse.json(
        { error: 'Missing required fields: track, weights' },
        { status: 400 }
      );
    }

    // Update weights
    const { data, error } = await supabase.rpc('update_rating_weights', {
      p_track: track,
      p_weights: weights,
      p_name: name,
      p_description: description,
      p_updated_by: user.id
    });

    if (error) {
      console.error('Error updating weights:', error);
      return NextResponse.json({ error: 'Failed to update weights', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Weights updated successfully',
      data: data
    });
  } catch (error) {
    console.error('Error in POST /api/admin/rating-weights:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}