import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { normalizeProjectType, ProjectTypeValue } from '@/utils/projectType'
import { normalizeSiteContactRole } from '@/utils/siteContactRole'
import { ScanContactDecision, NormalizedContact, CreateProjectFromScanResult, OrganisingUniverseResult } from '@/types/api'

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
    let projectTypeValue: ProjectTypeValue | null | undefined = undefined

    if (
      projectDecisions &&
      Object.prototype.hasOwnProperty.call(projectDecisions, 'project_type')
    ) {
      const rawProjectType = projectDecisions.project_type
      if (rawProjectType === null || rawProjectType === undefined || rawProjectType === '') {
        projectTypeValue = null
      } else {
        const normalizedType = normalizeProjectType(rawProjectType)
        if (!normalizedType) {
          throw new Error(`Unsupported project type value: ${rawProjectType}`)
        }
        projectTypeValue = normalizedType
      }
    }

    const normalizedContacts = (contactsDecisions || [])
      .map((contact: ScanContactDecision): NormalizedContact => ({
        role: normalizeSiteContactRole(contact.role),
        existingId: contact.existingId,
        name: contact.name ?? null,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
      }))
      .filter((contact: NormalizedContact) => {
        // Only include contacts that have:
        // 1. Either an existingId OR a role
        // 2. A valid name (not null, not empty, not "Nil")
        if (!contact.existingId && !contact.role) return false

        // Skip contacts without a valid name (handles "Nil" or empty values from scans)
        const name = contact.name?.trim()
        if (!name || name.toLowerCase() === 'nil') return false

        return true
      })

    const projectData = {
      name: projectDecisions?.name,
      value: projectDecisions?.value,
      proposed_start_date: projectDecisions?.proposed_start_date,
      proposed_finish_date: projectDecisions?.proposed_finish_date,
      roe_email: projectDecisions?.roe_email,
      project_type: projectTypeValue,
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
      p_project_data: projectData,
      p_contacts: normalizedContacts,
      p_subcontractors: (subcontractorDecisions || []),
      p_employer_creations: (employerCreations || []),
      p_require_approval: true,  // NEW - always require approval for scan uploads
    })

    if (rpcError) {
      console.error('RPC error creating project from scan:', rpcError)
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      )
    }

    const createResult = result as CreateProjectFromScanResult
    if (createResult?.error) {
      return NextResponse.json(
        { error: createResult.error },
        { status: createResult.status || 500 }
      )
    }

    let organisingUniverseUpdated = false

    if (createResult?.projectId) {
      const { data: ouResult, error: ouError } = await supabase.rpc('set_organising_universe_manual', {
        p_project_id: createResult.projectId,
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

      const orgResult = ouResult as OrganisingUniverseResult
      if (!orgResult?.success) {
        const details = orgResult?.error
        console.error('Failed to set organising universe to active:', details)
        return NextResponse.json(
          { error: details || 'Failed to set organising universe to active' },
          { status: 500 }
        )
      }

      organisingUniverseUpdated = true
    }

    return NextResponse.json({
      success: createResult.success,
      projectId: createResult.projectId,
      jobSiteId: createResult.jobSiteId,
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
