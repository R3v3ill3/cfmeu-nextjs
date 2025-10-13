import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      scanId,
      projectDecisions,
      contactsDecisions,
      subcontractorDecisions,
      employerCreations,
    } = body

    if (!scanId) {
      return NextResponse.json({ error: 'Missing scanId' }, { status: 400 })
    }

    // Use anon SSR client (no service-role key!)
    const supabase = await createServerSupabase()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Prepare project data for RPC
    const projectData = {
      name: projectDecisions?.name,
      value: projectDecisions?.value,
      proposed_start_date: projectDecisions?.proposed_start_date,
      proposed_finish_date: projectDecisions?.proposed_finish_date,
      roe_email: projectDecisions?.roe_email,
      project_type: projectDecisions?.project_type,
      state_funding: projectDecisions?.state_funding,
      federal_funding: projectDecisions?.federal_funding,
      address: projectDecisions?.address,
      latitude: projectDecisions?.address_latitude,
      longitude: projectDecisions?.address_longitude,
      builder: projectDecisions?.builder ? {
        matchedEmployerId: projectDecisions.builder.matchedEmployer?.id,
        createNew: projectDecisions.builder.createNew,
        newEmployerData: projectDecisions.builder.newEmployerData,
        displayName: projectDecisions.builder.displayName,
        matchConfidence: projectDecisions.builder.matchConfidence,
        matchNotes: projectDecisions.builder.matchNotes,
      } : null,
    }

    // Call comprehensive RPC to create project
    const { data: result, error: rpcError } = await supabase.rpc('create_project_from_scan', {
      p_user_id: user.id,
      p_scan_id: scanId,
      p_project_data: projectData as any,
      p_contacts: (contactsDecisions || []) as any,
      p_subcontractors: (subcontractorDecisions || []) as any,
      p_employer_creations: (employerCreations || []) as any,
      p_require_approval: true,  // NEW - always require approval for scan uploads
    })

    if (rpcError) {
      console.error('RPC error creating project from scan:', rpcError)
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      )
    }

    if (result?.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      )
    }

    let organisingUniverseUpdated = false

    if (result?.projectId) {
      const { data: ouResult, error: ouError } = await supabase.rpc('set_organising_universe_manual', {
        p_project_id: result.projectId,
        p_universe: 'active',
        p_user_id: user.id,
        p_reason: 'Set to active via mapping sheet upload',
      })

      if (ouError) {
        console.error('Failed to set organising universe to active:', ouError)
        return NextResponse.json(
          { error: ouError.message || 'Failed to set organising universe to active' },
          { status: 500 }
        )
      }

      if (!(ouResult as any)?.success) {
        const details = (ouResult as any)?.error
        console.error('Failed to set organising universe to active:', details)
        return NextResponse.json(
          { error: details || 'Failed to set organising universe to active' },
          { status: 500 }
        )
      }

      organisingUniverseUpdated = true
    }

    return NextResponse.json({
      success: result.success,
      projectId: result.projectId,
      jobSiteId: result.jobSiteId,
      organisingUniverseUpdated,
    })

  } catch (error) {
    console.error('New project from scan error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}
