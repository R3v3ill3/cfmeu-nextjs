import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceSupabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

export async function POST(request: NextRequest) {
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

  // Load scan
  const { data: scanData, error: scanError } = await serviceSupabase
    .from('mapping_sheet_scans')
    .select('*')
    .eq('id', scanId)
    .single()

  if (scanError || !scanData) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
  }

  if (scanData.project_id || scanData.created_project_id) {
    return NextResponse.json({ error: 'Scan already linked to a project' }, { status: 400 })
  }

  if (scanData.upload_mode !== 'new_project') {
    return NextResponse.json({ error: 'Scan is not marked for new project creation' }, { status: 400 })
  }

  // Begin manual transaction
  const { error: beginError } = await serviceSupabase.rpc('perform_transaction', {
    action: 'begin'
  })

  if (beginError) {
    console.error('Failed to begin transaction', beginError)
    return NextResponse.json({ error: 'Failed to start transaction' }, { status: 500 })
  }

  const rollback = async () => {
    const { error: rollbackError } = await serviceSupabase.rpc('perform_transaction', {
      action: 'rollback'
    })
    if (rollbackError) {
      console.error('Failed to rollback transaction', rollbackError)
    }
  }

  try {
    // 1. Create project
    const projectInsert: Record<string, any> = {
      name: projectDecisions?.name || scanData.extracted_data?.project?.project_name || 'New Project',
      value: projectDecisions?.value ?? null,
      proposed_start_date: projectDecisions?.proposed_start_date || null,
      proposed_finish_date: projectDecisions?.proposed_finish_date || null,
      roe_email: projectDecisions?.roe_email || null,
      project_type: projectDecisions?.project_type || null,
      state_funding: projectDecisions?.state_funding ?? 0,
      federal_funding: projectDecisions?.federal_funding ?? 0,
    }

    const { data: projectRow, error: projectError } = await serviceSupabase
      .from('projects')
      .insert(projectInsert)
      .select('id')
      .single()

    if (projectError || !projectRow) {
      throw projectError || new Error('Failed to create project')
    }

    const projectId = projectRow.id

    // 2. Create main job site if address provided
    let jobSiteId: string | null = null
    const address = projectDecisions?.address || scanData.extracted_data?.project?.address || null

    if (address) {
      const { data: jobSiteRow, error: jobSiteError } = await serviceSupabase
        .from('job_sites')
        .insert({
          project_id: projectId,
          name: projectInsert.name,
          is_main_site: true,
          location: address,
          full_address: address,
        })
        .select('id')
        .single()

      if (jobSiteError || !jobSiteRow) {
        throw jobSiteError || new Error('Failed to create job site')
      }

      jobSiteId = jobSiteRow.id

      await serviceSupabase
        .from('projects')
        .update({ main_job_site_id: jobSiteId })
        .eq('id', projectId)
    }

    const resolveEmployerId = async (entry: any) => {
      if (!entry) return null

      if (entry.matchedEmployer?.id) {
        return entry.matchedEmployer.id
      }

      if (entry.createNew && entry.newEmployerData) {
        const { data: newEmployer, error: newEmployerError } = await serviceSupabase
          .from('employers')
          .insert({
            name: entry.newEmployerData.name,
            contractor_type: entry.newEmployerData.contractor_type || null,
            website: entry.newEmployerData.website || null,
            notes: entry.newEmployerData.notes || null,
          })
          .select('id')
          .single()

        if (newEmployerError || !newEmployer) {
          throw newEmployerError || new Error('Failed to create employer')
        }

        return newEmployer.id
      }

      return null
    }

    // 3. Builder / contractor roles
    const builderEntry = projectDecisions?.builder
    if (builderEntry) {
      const builderId = await resolveEmployerId(builderEntry)
      if (builderId) {
        await serviceSupabase.rpc('assign_contractor_role', {
          p_project_id: projectId,
          p_employer_id: builderId,
          p_role_code: 'builder',
          p_company_name: builderEntry.displayName || 'Builder',
          p_is_primary: true,
          p_source: 'scanned_mapping_sheet',
          p_match_confidence: builderEntry.matchConfidence || 1.0,
          p_match_notes: builderEntry.matchNotes || null,
        })

        await serviceSupabase
          .from('projects')
          .update({ builder_id: builderId })
          .eq('id', projectId)
      }
    }

    // 4. Contacts
    if (contactsDecisions && contactsDecisions.length > 0 && jobSiteId) {
      for (const contact of contactsDecisions) {
        await serviceSupabase
          .from('site_contacts')
          .insert({
            job_site_id: jobSiteId,
            role: contact.role,
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
          })
      }
    }

    // 5. Subcontractors
    if (subcontractorDecisions && subcontractorDecisions.length > 0) {
      for (const sub of subcontractorDecisions) {
        if (!sub.matchedEmployer) continue

        const employerId = sub.matchedEmployer.id

        const tradeCode = sub.trade_type_code || null
        let tradeTypeId: string | null = null
        if (tradeCode) {
          const { data: tradeType, error: tradeError } = await serviceSupabase
            .from('trade_types')
            .select('id')
            .eq('code', tradeCode)
            .single()

          if (!tradeError && tradeType) {
            tradeTypeId = tradeType.id
          }
        }

        await serviceSupabase
          .from('project_assignments')
          .insert({
            project_id: projectId,
            employer_id: employerId,
            assignment_type: 'trade_work',
            trade_type_id: tradeTypeId,
            source: 'scanned_mapping_sheet',
            match_status: 'confirmed',
            match_confidence: sub.matchConfidence || 1.0,
            match_notes: sub.matchNotes || null,
          })
      }
    }

    // 6. Update scan
    await serviceSupabase
      .from('mapping_sheet_scans')
      .update({
        status: 'under_review',
        created_project_id: projectId,
        project_id: projectId,
      })
      .eq('id', scanId)

    const { error: commitError } = await serviceSupabase.rpc('perform_transaction', {
      action: 'commit'
    })

    if (commitError) {
      console.error('Failed to commit transaction', commitError)
      await rollback()
      return NextResponse.json({ error: 'Failed to commit transaction' }, { status: 500 })
    }

    return NextResponse.json({ success: true, projectId })
  } catch (error) {
    console.error('New project import error:', error)
    await rollback()
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}

