import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { withValidation } from '@/lib/validation/middleware'
import { schemas } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/approve-project
 * Approves a pending project with proper validation and business logic checks
 */
export const POST = withValidation(
  async (request, { data, user }) => {
    const supabase = await createServerSupabase()

    // Verify the project exists and is in a pending state
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, status, created_at')
      .eq('id', data.projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found',
        hint: 'Please verify the project ID and try again'
      }, { status: 404 })
    }

    // Check if project is already approved
    if (project.status === 'approved') {
      return NextResponse.json({
        success: false,
        error: 'Project is already approved',
        details: { projectId: project.id, currentStatus: project.status }
      }, { status: 409 })
    }

    // Call the RPC function with validated data
    const { data: result, error: rpcError } = await supabase.rpc('approve_project', {
      p_project_id: data.projectId,
      p_admin_user_id: user.id,
      p_notes: data.notes || null,
    })

    if (rpcError) {
      console.error('RPC error approving project:', rpcError)
      return NextResponse.json({
        success: false,
        error: 'Failed to approve project',
        details: rpcError.message,
        hint: 'Contact system administrator if this persists'
      }, { status: 500 })
    }

    if (result?.error) {
      return NextResponse.json({
        success: false,
        error: result.error,
        ...(result.status && { httpStatus: result.status })
      }, { status: result.status || 500 })
    }

    return NextResponse.json({
      success: true,
      projectId: result.projectId,
      projectName: project.name,
      approvedBy: user.full_name || user.email,
      approvedAt: new Date().toISOString()
    })
  },
  schemas.project.approveProject,
  {
    requireAuth: true,
    requiredRoles: ['admin', 'lead_organiser'],
    returnValidationErrors: process.env.NODE_ENV === 'development'
  }
)
