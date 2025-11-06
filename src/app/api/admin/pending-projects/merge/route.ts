import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withValidation } from '@/lib/validation/middleware';
import { schemas } from '@/lib/validation/schemas';
import { mergePendingProjects } from '@/lib/projects/mergePendingProjects';
import type { ProjectConflictResolution } from '@/types/pendingProjectReview';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pending-projects/merge
 * Merges multiple pending projects into one canonical project with comprehensive validation
 */
export const POST = withValidation(
  async (request, { data, user }) => {
    const supabase = await createServerSupabase();

    // Validate that canonical project exists
    const { data: canonicalProject, error: canonicalError } = await supabase
      .from('projects')
      .select('id, name, value, stage, status, address')
      .eq('id', data.canonicalProjectId)
      .single();

    if (canonicalError || !canonicalProject) {
      return NextResponse.json({
        success: false,
        error: 'Canonical project not found',
        hint: 'Please verify the canonical project ID and try again'
      }, { status: 404 });
    }

    // Validate that all merge projects exist
    const { data: mergeProjects, error: mergeError } = await supabase
      .from('projects')
      .select('id, name, value, stage, status, address')
      .in('id', data.mergeProjectIds);

    if (mergeError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to validate merge projects',
        details: mergeError.message
      }, { status: 500 });
    }

    if (!mergeProjects || mergeProjects.length !== data.mergeProjectIds.length) {
      return NextResponse.json({
        success: false,
        error: 'Some merge projects not found',
        details: {
          requested: data.mergeProjectIds,
          found: mergeProjects?.map(p => p.id) || []
        }
      }, { status: 404 });
    }

    // Check for circular merges (canonical project in merge list)
    if (data.mergeProjectIds.includes(data.canonicalProjectId)) {
      return NextResponse.json({
        success: false,
        error: 'Cannot merge a project into itself',
        hint: 'Remove the canonical project from the merge list'
      }, { status: 400 });
    }

    // Additional business logic validation
    const hasConflictingValues = mergeProjects.some(project =>
      project.value && canonicalProject.value &&
      Math.abs(project.value - canonicalProject.value) > (canonicalProject.value * 0.1)
    );

    if (hasConflictingValues && !data.autoMerge) {
      return NextResponse.json({
        success: false,
        error: 'Cannot merge projects with significantly different values',
        details: {
          canonicalValue: canonicalProject.value,
          conflictingProjects: mergeProjects
            .filter(project =>
              project.value && canonicalProject.value &&
              Math.abs(project.value - canonicalProject.value) > (canonicalProject.value * 0.1)
            )
            .map(project => ({
              id: project.id,
              name: project.name,
              value: project.value
            }))
        },
        hint: 'Use conflict resolutions to handle value differences or enable auto-merge'
      }, { status: 409 });
    }

    // Validate project stage compatibility
    const incompatibleStages = mergeProjects.filter(project =>
      project.stage && project.stage !== canonicalProject.stage &&
      !['archived', 'future'].includes(canonicalProject.stage)
    );

    if (incompatibleStages.length > 0 && !data.autoMerge) {
      return NextResponse.json({
        success: false,
        error: 'Cannot merge projects in different active stages',
        details: {
          canonicalStage: canonicalProject.stage,
          incompatibleProjects: incompatibleStages.map(project => ({
            id: project.id,
            name: project.name,
            stage: project.stage
          }))
        },
        hint: 'Use conflict resolutions to handle stage differences or enable auto-merge'
      }, { status: 409 });
    }

    // Perform the merge using the existing helper function
    const result = await mergePendingProjects(supabase, {
      canonicalProjectId: data.canonicalProjectId,
      mergeProjectIds: data.mergeProjectIds,
      conflictResolutions: data.conflictResolutions || {},
      autoMerge: data.autoMerge || false,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Merge failed',
        hint: 'Check project data and try again, or contact system administrator'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ...result,
      mergedBy: user.full_name || user.email,
      mergedAt: new Date().toISOString(),
      summary: {
        canonicalProject: canonicalProject.name,
        mergedProjects: mergeProjects.map(p => p.name),
        totalMerged: data.mergeProjectIds.length,
        totalValue: canonicalProject.value + mergeProjects.reduce((sum, p) => sum + (p.value || 0), 0)
      }
    });
  },
  schemas.project.mergeProjects,
  {
    requireAuth: true,
    requiredRoles: ['admin', 'lead_organiser'],
    returnValidationErrors: process.env.NODE_ENV === 'development'
  }
);
