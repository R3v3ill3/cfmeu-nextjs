// CFMEU Employer Rating System - Weighting Management API
// Main API endpoints for user-configurable weighting system

import { createClient } from '@/integrations/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  UserWeightingProfile,
  Track1Weightings,
  Track2Weightings,
  CreateWeightingProfileRequest,
  UpdateWeightingProfileRequest,
  UpdateTrack1WeightingsRequest,
  UpdateTrack2WeightingsRequest,
  WeightingProfileResponse,
  WeightingProfilesResponse,
  WeightingValidationResponse
} from '@/lib/weighting-system/types/WeightingTypes';
import { WeightingEngine } from '@/lib/weighting-system/WeightingEngine';
import { WeightingValidator } from '@/lib/weighting-system/WeightingValidator';

// =============================================================================
// GET - Retrieve weighting profiles
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const userId = searchParams.get('user_id');
    const userRole = searchParams.get('user_role');
    const profileType = searchParams.get('profile_type');
    const isActive = searchParams.get('is_active');
    const includeWeightings = searchParams.get('include_weightings') === 'true';
    const isDefault = searchParams.get('is_default') === 'true';

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Build query
    let query = supabase
      .from('user_weighting_profiles')
      .select(`
        *,
        track1_weightings (*),
        track2_weightings (*)
      `);

    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      // If no user specified, only return current user's profiles
      query = query.eq('user_id', user.id);
    }

    if (userRole) {
      query = query.eq('user_role', userRole);
    }

    if (profileType) {
      query = query.eq('profile_type', profileType);
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (isDefault) {
      query = query.eq('is_default', true);
    }

    // Only include active profiles unless specifically requested
    if (isActive === null) {
      query = query.eq('is_active', true);
    }

    // Order by default status first, then by name
    query = query.order('is_default', { ascending: false }).order('profile_name', { ascending: true });

    const { data: profiles, error } = await query;

    if (error) {
      console.error('Error fetching weighting profiles:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Process and format response
    const processedProfiles = profiles?.map((profile: any) => {
      const track1Weightings = profile.track1_weightings?.[0];
      const track2Weightings = profile.track2_weightings?.[0];

      return {
        ...profile,
        track1_weightings: includeWeightings && track1Weightings ? track1Weightings : undefined,
        track2_weightings: includeWeightings && track2Weightings ? track2Weightings : undefined
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: processedProfiles,
      count: processedProfiles.length
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/weightings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create new weighting profile
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CreateWeightingProfileRequest = await request.json();

    // Validate required fields
    if (!body.profile_name || !body.profile_type || !body.user_role) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: profile_name, profile_type, user_role' },
        { status: 400 }
      );
    }

    // Set default values
    const profileData: Partial<UserWeightingProfile> = {
      user_id: user.id,
      profile_name: body.profile_name,
      description: body.description,
      profile_type: body.profile_type,
      user_role: body.user_role,
      employer_category_focus: body.employer_category_focus || 'all',
      project_data_weight: body.project_data_weight ?? 0.6,
      organiser_expertise_weight: body.organiser_expertise_weight ?? 0.4,
      min_data_requirements: {
        min_project_assessments: 3,
        min_expertise_assessments: 1,
        min_data_age_days: 365,
        require_eba_status: false,
        require_safety_data: false,
        ...body.min_data_requirements
      },
      confidence_thresholds: {
        high_confidence_min: 0.8,
        medium_confidence_min: 0.6,
        low_confidence_min: 0.4,
        very_low_confidence_max: 0.4,
        ...body.confidence_thresholds
      },
      is_default: body.is_default || false,
      is_public: body.is_public || false,
      is_active: true,
      version: 1,
      created_by: user.id,
      last_updated_by: user.id
    };

    // If setting as default, unset other defaults for this role
    if (profileData.is_default) {
      await supabase
        .from('user_weighting_profiles')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('user_role', profileData.user_role!);
    }

    // Create the profile
    const { data: newProfile, error: profileError } = await supabase
      .from('user_weighting_profiles')
      .insert(profileData)
      .select()
      .single();

    if (profileError) {
      console.error('Error creating weighting profile:', profileError);
      return NextResponse.json(
        { success: false, error: profileError.message },
        { status: 500 }
      );
    }

    // Create default Track 1 weightings
    const defaultTrack1Weightings = {
      profile_id: newProfile.id,
      cbus_paying_weight: 0.15,
      cbus_on_time_weight: 0.10,
      cbus_all_workers_weight: 0.10,
      incolink_entitlements_weight: 0.15,
      incolink_on_time_weight: 0.10,
      incolink_all_workers_weight: 0.10,
      union_relations_right_of_entry_weight: 0.15,
      union_relations_delegate_accommodation_weight: 0.10,
      union_relations_access_to_info_weight: 0.10,
      union_relations_access_to_inductions_weight: 0.05,
      safety_hsr_respect_weight: 0.20,
      safety_general_standards_weight: 0.15,
      safety_incidents_weight: 0.25,
      subcontractor_usage_levels_weight: 0.30,
      subcontractor_practices_weight: 0.70,
      builder_tender_consultation_weight: 0.15,
      builder_communication_weight: 0.15,
      builder_delegate_facilities_weight: 0.10,
      builder_contractor_compliance_weight: 0.20,
      builder_eba_contractor_percentage_weight: 0.40
    };

    const { data: track1Weightings, error: track1Error } = await supabase
      .from('track1_weightings')
      .insert(defaultTrack1Weightings)
      .select()
      .single();

    // Create default Track 2 weightings
    const defaultTrack2Weightings = {
      profile_id: newProfile.id,
      cbus_overall_assessment_weight: 0.20,
      incolink_overall_assessment_weight: 0.20,
      union_relations_overall_weight: 0.25,
      safety_culture_overall_weight: 0.20,
      historical_relationship_quality_weight: 0.10,
      eba_status_weight: 0.05,
      organiser_confidence_multiplier: 1.00
    };

    const { data: track2Weightings, error: track2Error } = await supabase
      .from('track2_weightings')
      .insert(defaultTrack2Weightings)
      .select()
      .single();

    // Validate the created profile
    const validationResult = WeightingEngine.validateWeightingProfile(
      newProfile,
      track1Weightings!,
      track2Weightings!
    );

    const response: WeightingProfileResponse = {
      success: true,
      data: newProfile,
      track1_weightings: track1Weightings || undefined,
      track2_weightings: track2Weightings || undefined,
      validation_result: validationResult,
      warnings: validationResult.validation_state === 'warning' ? validationResult.warnings?.map(w => w.message) : []
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Unexpected error in POST /api/weightings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update weighting profile
// =============================================================================

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { profile_id, updates, track1_updates, track2_updates } = body;

    if (!profile_id) {
      return NextResponse.json(
        { success: false, error: 'profile_id is required' },
        { status: 400 }
      );
    }

    // Get current profile
    const { data: currentProfile, error: fetchError } = await supabase
      .from('user_weighting_profiles')
      .select(`
        *,
        track1_weightings (*),
        track2_weightings (*)
      `)
      .eq('id', profile_id)
      .single();

    if (fetchError || !currentProfile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (currentProfile.user_id !== user.id) {
      // Check if user is admin
      const { data: userData } = await supabase
        .from('auth.users')
        .select('raw_user_meta_data')
        .eq('id', user.id)
        .single();

      const userRole = userData?.raw_user_meta_data?.role;
      if (userRole !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    // Validate updates
    let validationErrors: string[] = [];
    let warnings: string[] = [];

    if (updates) {
      const profileValidation = WeightingValidator.validateProfileUpdate(
        currentProfile,
        updates
      );
      validationErrors.push(...profileValidation.errors.map(e => e.message));
      warnings.push(...profileValidation.warnings);
    }

    if (track1_updates && currentProfile.track1_weightings?.[0]) {
      const track1Validation = WeightingValidator.validateTrack1Update(
        currentProfile.track1_weightings[0],
        track1_updates
      );
      validationErrors.push(...track1Validation.errors.map(e => e.message));
      warnings.push(...track1Validation.warnings);
    }

    if (track2_updates && currentProfile.track2_weightings?.[0]) {
      const track2Validation = WeightingValidator.validateTrack2Update(
        currentProfile.track2_weightings[0],
        track2_updates
      );
      validationErrors.push(...track2Validation.errors.map(e => e.message));
      warnings.push(...track2Validation.warnings);
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // Update profile version
    const updatedProfileData = {
      ...updates,
      version: (currentProfile.version || 1) + 1,
      updated_at: new Date().toISOString(),
      last_updated_by: user.id
    };

    // Handle default profile logic
    if (updates?.is_default) {
      await supabase
        .from('user_weighting_profiles')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('user_role', currentProfile.user_role);
    }

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_weighting_profiles')
      .update(updatedProfileData)
      .eq('id', profile_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating weighting profile:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Update Track 1 weightings if provided
    let updatedTrack1Weightings;
    if (track1_updates && currentProfile.track1_weightings?.[0]) {
      const { data: track1Data, error: track1Error } = await supabase
        .from('track1_weightings')
        .update({
          ...track1_updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentProfile.track1_weightings[0].id)
        .select()
        .single();

      if (track1Error) {
        console.error('Error updating Track 1 weightings:', track1Error);
        return NextResponse.json(
          { success: false, error: track1Error.message },
          { status: 500 }
        );
      }
      updatedTrack1Weightings = track1Data;
    }

    // Update Track 2 weightings if provided
    let updatedTrack2Weightings;
    if (track2_updates && currentProfile.track2_weightings?.[0]) {
      const { data: track2Data, error: track2Error } = await supabase
        .from('track2_weightings')
        .update({
          ...track2_updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentProfile.track2_weightings[0].id)
        .select()
        .single();

      if (track2Error) {
        console.error('Error updating Track 2 weightings:', track2Error);
        return NextResponse.json(
          { success: false, error: track2Error.message },
          { status: 500 }
        );
      }
      updatedTrack2Weightings = track2Data;
    }

    // Get final profile data for validation
    const { data: finalProfile, error: finalFetchError } = await supabase
      .from('user_weighting_profiles')
      .select(`
        *,
        track1_weightings (*),
        track2_weightings (*)
      `)
      .eq('id', profile_id)
      .single();

    if (finalFetchError) {
      console.error('Error fetching final profile:', finalFetchError);
    }

    // Validate final configuration
    let validationResult;
    if (finalProfile) {
      validationResult = WeightingEngine.validateWeightingProfile(
        finalProfile,
        finalProfile.track1_weightings?.[0] || updatedTrack1Weightings,
        finalProfile.track2_weightings?.[0] || updatedTrack2Weightings
      );
    }

    const response: WeightingProfileResponse = {
      success: true,
      data: updatedProfile,
      track1_weightings: updatedTrack1Weightings,
      track2_weightings: updatedTrack2Weightings,
      validation_result: validationResult,
      warnings: warnings.length > 0 ? warnings : (validationResult?.validation_state === 'warning' ? validationResult.warnings?.map(w => w.message) : [])
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Unexpected error in PUT /api/weightings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete weighting profile
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profile_id');

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'profile_id is required' },
        { status: 400 }
      );
    }

    // Get current profile
    const { data: currentProfile, error: fetchError } = await supabase
      .from('user_weighting_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (fetchError || !currentProfile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (currentProfile.user_id !== user.id) {
      // Check if user is admin
      const { data: userData } = await supabase
        .from('auth.users')
        .select('raw_user_meta_data')
        .eq('id', user.id)
        .single();

      const userRole = userData?.raw_user_meta_data?.role;
      if (userRole !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    // Check if profile is being used (prevent deletion of active profiles)
    const { data: activeUsage } = await supabase
      .from('weighting_performance_analytics')
      .select('id')
      .eq('profile_id', profileId)
      .limit(1);

    if (activeUsage && activeUsage.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete profile that has been used for calculations' },
        { status: 400 }
      );
    }

    // Delete related weightings first (due to foreign key constraints)
    await supabase
      .from('track1_weightings')
      .delete()
      .eq('profile_id', profileId);

    await supabase
      .from('track2_weightings')
      .delete()
      .eq('profile_id', profileId);

    // Delete the profile
    const { error: deleteError } = await supabase
      .from('user_weighting_profiles')
      .delete()
      .eq('id', profileId);

    if (deleteError) {
      console.error('Error deleting weighting profile:', deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Weighting profile deleted successfully'
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/weightings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}