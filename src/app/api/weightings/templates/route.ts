// CFMEU Employer Rating System - Weighting Templates API
// Template management and preset functionality

import { createClient } from '@/integrations/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  WeightingTemplate,
  WeightingTemplatesResponse,
  WeightingTemplateData,
  TemplateCategory,
  UserRole
} from '@/lib/weighting-system/types/WeightingTypes';
import { WeightingEngine } from '@/lib/weighting-system/WeightingEngine';
import { WeightingValidator } from '@/lib/weighting-system/WeightingValidator';

// =============================================================================
// GET - Retrieve weighting templates
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const category = searchParams.get('category') as TemplateCategory;
    const targetRole = searchParams.get('target_role') as UserRole;
    const employerType = searchParams.get('employer_type');
    const isSystemTemplate = searchParams.get('is_system_template');
    const isActive = searchParams.get('is_active');
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const searchQuery = searchParams.get('search');

    // Build query
    let query = supabase
      .from('weighting_templates')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('average_rating', { ascending: false })
      .order('template_name', { ascending: true });

    // Apply filters
    if (category) {
      query = query.eq('template_category', category);
    }

    if (targetRole) {
      query = query.eq('target_role', targetRole);
    }

    if (employerType && employerType !== 'all') {
      query = query.eq('target_employer_type', employerType);
    }

    if (isSystemTemplate !== null) {
      query = query.eq('is_system_template', isSystemTemplate === 'true');
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    } else if (!includeInactive) {
      // Default to active templates only
      query = query.eq('is_active', true);
    }

    if (searchQuery && searchQuery.trim()) {
      query = query.or(`template_name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('Error fetching weighting templates:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get unique categories for response
    const { data: categoriesData } = await supabase
      .from('weighting_templates')
      .select('template_category')
      .eq('is_active', true);

    const categories = [...new Set(categoriesData?.map(t => t.template_category) || [])];

    const response: WeightingTemplatesResponse = {
      success: true,
      data: templates || [],
      count: templates?.length || 0,
      categories: categories as TemplateCategory[]
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Unexpected error in GET /api/weightings/templates:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create new weighting template
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
    const body = await request.json();
    const {
      template_name,
      description,
      template_category,
      target_role,
      target_employer_type,
      template_data,
      is_system_template = false
    } = body;

    // Validate required fields
    if (!template_name || !template_category || !target_role || !template_data) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: template_name, template_category, target_role, template_data' },
        { status: 400 }
      );
    }

    // Check if template name already exists
    const { data: existingTemplate } = await supabase
      .from('weighting_templates')
      .select('id')
      .eq('template_name', template_name.trim())
      .single();

    if (existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template with this name already exists' },
        { status: 409 }
      );
    }

    // Validate template data structure
    const templateValidation = validateTemplateData(template_data);
    if (!templateValidation.isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid template data', details: templateValidation.errors },
        { status: 400 }
      );
    }

    // Check permissions for system templates
    if (is_system_template) {
      const { data: userData } = await supabase
        .from('auth.users')
        .select('raw_user_meta_data')
        .eq('id', user.id)
        .single();

      const userRole = userData?.raw_user_meta_data?.role;
      if (userRole !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Only admins can create system templates' },
          { status: 403 }
        );
      }
    }

    // Create template
    const templateRecord = {
      template_name: template_name.trim(),
      description: description?.trim() || null,
      template_category,
      target_role,
      target_employer_type: target_employer_type || 'all',
      is_system_template,
      is_active: true,
      usage_count: 0,
      average_rating: null,
      template_data,
      validation_status: 'validated', // Would be calculated based on actual validation
      validation_notes: templateValidation.errors.length > 0 ? templateValidation.errors.join('; ') : null,
      created_by: user.id
    };

    const { data: newTemplate, error: createError } = await supabase
      .from('weighting_templates')
      .insert(templateRecord)
      .select()
      .single();

    if (createError) {
      console.error('Error creating weighting template:', createError);
      return NextResponse.json(
        { success: false, error: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newTemplate,
      message: 'Template created successfully'
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/weightings/templates:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update weighting template
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
    const { template_id, updates } = body;

    if (!template_id || !updates) {
      return NextResponse.json(
        { success: false, error: 'template_id and updates are required' },
        { status: 400 }
      );
    }

    // Get current template
    const { data: currentTemplate, error: fetchError } = await supabase
      .from('weighting_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (fetchError || !currentTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (currentTemplate.created_by !== user.id) {
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

    // Prevent modification of system templates by non-admins
    if (currentTemplate.is_system_template) {
      const { data: userData } = await supabase
        .from('auth.users')
        .select('raw_user_meta_data')
        .eq('id', user.id)
        .single();

      const userRole = userData?.raw_user_meta_data?.role;
      if (userRole !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Cannot modify system templates' },
          { status: 403 }
        );
      }
    }

    // Validate template data if being updated
    if (updates.template_data) {
      const templateValidation = validateTemplateData(updates.template_data);
      if (!templateValidation.isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid template data', details: templateValidation.errors },
          { status: 400 }
        );
      }
    }

    // Check for duplicate name if updating name
    if (updates.template_name && updates.template_name !== currentTemplate.template_name) {
      const { data: existingTemplate } = await supabase
        .from('weighting_templates')
        .select('id')
        .eq('template_name', updates.template_name.trim())
        .neq('id', template_id)
        .single();

      if (existingTemplate) {
        return NextResponse.json(
          { success: false, error: 'Template with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update template
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    if (updates.template_name) {
      updateData.template_name = updates.template_name.trim();
    }

    if (updates.description) {
      updateData.description = updates.description.trim();
    }

    const { data: updatedTemplate, error: updateError } = await supabase
      .from('weighting_templates')
      .update(updateData)
      .eq('id', template_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating weighting template:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedTemplate,
      message: 'Template updated successfully'
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/weightings/templates:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete weighting template
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
    const templateId = searchParams.get('template_id');

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'template_id is required' },
        { status: 400 }
      );
    }

    // Get current template
    const { data: currentTemplate, error: fetchError } = await supabase
      .from('weighting_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (fetchError || !currentTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (currentTemplate.created_by !== user.id) {
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

    // Prevent deletion of system templates
    if (currentTemplate.is_system_template) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete system templates' },
        { status: 400 }
      );
    }

    // Check if template is being used (soft delete instead)
    if (currentTemplate.usage_count > 0) {
      // Soft delete - deactivate instead of removing
      const { error: deactivateError } = await supabase
        .from('weighting_templates')
        .update({ is_active: false })
        .eq('id', templateId);

      if (deactivateError) {
        console.error('Error deactivating weighting template:', deactivateError);
        return NextResponse.json(
          { success: false, error: deactivateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Template deactivated (was in use, so not permanently deleted)'
      });
    }

    // Hard delete if not in use
    const { error: deleteError } = await supabase
      .from('weighting_templates')
      .delete()
      .eq('id', templateId);

    if (deleteError) {
      console.error('Error deleting weighting template:', deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/weightings/templates:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate template data structure
 */
function validateTemplateData(templateData: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  const requiredFields = [
    'profile_name',
    'profile_type',
    'user_role',
    'employer_category_focus',
    'project_data_weight',
    'organiser_expertise_weight',
    'track1_weightings',
    'track2_weightings'
  ];

  for (const field of requiredFields) {
    if (!templateData[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate weightings sum to 1.0
  if (templateData.project_data_weight && templateData.organiser_expertise_weight) {
    const sum = templateData.project_data_weight + templateData.organiser_expertise_weight;
    if (Math.abs(sum - 1.0) > 0.01) {
      errors.push(`Main weightings must sum to 1.0. Current sum: ${sum.toFixed(3)}`);
    }
  }

  // Validate track1 weightings structure
  if (templateData.track1_weightings) {
    const track1Required = [
      'cbus_paying_weight',
      'incolink_entitlements_weight',
      'union_relations_right_of_entry_weight',
      'safety_hsr_respect_weight',
      'subcontractor_usage_levels_weight'
    ];

    for (const field of track1Required) {
      if (typeof templateData.track1_weightings[field] !== 'number') {
        errors.push(`Missing or invalid Track 1 weighting: ${field}`);
      }
    }
  }

  // Validate track2 weightings structure
  if (templateData.track2_weightings) {
    const track2Required = [
      'cbus_overall_assessment_weight',
      'incolink_overall_assessment_weight',
      'union_relations_overall_weight',
      'safety_culture_overall_weight',
      'organiser_confidence_multiplier'
    ];

    for (const field of track2Required) {
      if (typeof templateData.track2_weightings[field] !== 'number') {
        errors.push(`Missing or invalid Track 2 weighting: ${field}`);
      }
    }
  }

  // Validate data types
  if (templateData.project_data_weight !== undefined && typeof templateData.project_data_weight !== 'number') {
    errors.push('project_data_weight must be a number');
  }

  if (templateData.organiser_expertise_weight !== undefined && typeof templateData.organiser_expertise_weight !== 'number') {
    errors.push('organiser_expertise_weight must be a number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}