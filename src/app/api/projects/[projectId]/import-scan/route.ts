import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceSupabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params
    const body = await request.json()
    const { scanId, projectDecisions, contactsDecisions, subcontractorDecisions } = body

    // Get user from session
    const supabase = await createServerSupabase()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let updatedFields = 0
    let contactsCreated = 0
    let subcontractorsCreated = 0

    // 1. Update project fields (filter out non-database columns)
    if (projectDecisions && Object.keys(projectDecisions).length > 0) {
      // Valid columns in projects table
      const validProjectColumns = [
        'name', 'value', 'proposed_start_date', 'proposed_finish_date', 
        'roe_email', 'state_funding', 'federal_funding', 'project_type'
      ]
      
      // Filter to only include valid columns
      const validUpdates: any = {}
      Object.entries(projectDecisions).forEach(([key, value]) => {
        if (validProjectColumns.includes(key)) {
          validUpdates[key] = value
        }
      })

      // Handle builder_name separately (update builder_id)
      if (projectDecisions.builder_name && projectDecisions.builder_employer_id) {
        validUpdates.builder_id = projectDecisions.builder_employer_id
      }

      // Update project if we have valid fields
      if (Object.keys(validUpdates).length > 0) {
        const { error } = await serviceSupabase
          .from('projects')
          .update(validUpdates)
          .eq('id', projectId)

        if (error) {
          console.error('Failed to update project:', error)
          throw new Error('Failed to update project fields')
        }
      }

      // Handle address update (job_sites table)
      if (projectDecisions.address) {
        const { data: project } = await serviceSupabase
          .from('projects')
          .select('main_job_site_id')
          .eq('id', projectId)
          .single()

        if (project?.main_job_site_id) {
          await serviceSupabase
            .from('job_sites')
            .update({ 
              full_address: projectDecisions.address,
              location: projectDecisions.address 
            })
            .eq('id', project.main_job_site_id)
        }
      }

      updatedFields = Object.keys(projectDecisions).length
    }

    // 2. Update/create site contacts
    if (contactsDecisions && contactsDecisions.length > 0) {
      // Get project's main site
      const { data: project } = await serviceSupabase
        .from('projects')
        .select('main_job_site_id')
        .eq('id', projectId)
        .single()

      if (!project?.main_job_site_id) {
        throw new Error('Project has no main job site')
      }

      for (const contact of contactsDecisions) {
        if (contact.existingId) {
          // Update existing
          const { error } = await serviceSupabase
            .from('site_contacts')
            .update({
              name: contact.name,
              email: contact.email || null,
              phone: contact.phone || null,
            })
            .eq('id', contact.existingId)

          if (error) {
            console.error('Failed to update contact:', error)
          }
        } else {
          // Create new
          const { error } = await serviceSupabase
            .from('site_contacts')
            .insert({
              job_site_id: project.main_job_site_id,
              role: contact.role,
              name: contact.name,
              email: contact.email || null,
              phone: contact.phone || null,
            })

          if (error) {
            console.error('Failed to create contact:', error)
          } else {
            contactsCreated++
          }
        }
      }
    }

    // 3. Create subcontractor assignments
    if (subcontractorDecisions && subcontractorDecisions.length > 0) {
      for (const sub of subcontractorDecisions) {
        if (!sub.matchedEmployer) continue

        try {
          // Map trade name to trade_type code
          const tradeCode = mapTradeNameToCode(sub.trade)
          
          // Get trade_type_id
          const { data: tradeType } = await serviceSupabase
            .from('trade_types')
            .select('id')
            .eq('code', tradeCode)
            .single()

          if (!tradeType) {
            console.warn(`Trade type not found for: ${sub.trade}`)
            continue
          }

          // Create project assignment
          const { error } = await serviceSupabase
            .from('project_assignments')
            .insert({
              project_id: projectId,
              employer_id: sub.matchedEmployer.id,
              assignment_type: 'trade_work',
              trade_type_id: tradeType.id,
              source: 'scanned_mapping_sheet',
              match_status: 'confirmed',
              match_confidence: sub.matchConfidence || 1.0,
              confirmed_at: new Date().toISOString(),
              confirmed_by: user.id,
            })

          if (error) {
            // Check if it's a duplicate
            if (error.code === '23505') {
              console.log('Assignment already exists:', sub.matchedEmployer.name, tradeCode)
            } else {
              console.error('Failed to create assignment:', error)
            }
          } else {
            subcontractorsCreated++
          }
        } catch (error) {
          console.error('Error processing subcontractor:', sub, error)
        }
      }
    }

    // 4. Update scan record
    await serviceSupabase
      .from('mapping_sheet_scans')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,
        reviewed_by: user.id,
      })
      .eq('id', scanId)

    return NextResponse.json({
      success: true,
      updatedFields,
      contactsCreated,
      subcontractorsCreated,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}

// Helper function to map trade names to codes
function mapTradeNameToCode(tradeName: string): string {
  const mapping: Record<string, string> = {
    'demo': 'demolition',
    'demolition': 'demolition',
    'piling': 'piling',
    'excavations': 'earthworks',
    'scaffold': 'scaffolding',
    'scaffolding': 'scaffolding',
    'cleaners': 'cleaning',
    'traffic control': 'traffic_control',
    'labour hire': 'labour_hire',
    'steel fixer': 'steel_fixing',
    'steel fixers': 'steel_fixing',
    'tower crane': 'tower_crane',
    'mobile crane': 'mobile_crane',
    'concreters': 'concreting',
    'concrete': 'concreting',
    'stressor': 'post_tensioning',
    'formwork': 'form_work',
    'bricklayer': 'bricklaying',
    'bricklaying': 'bricklaying',
    'structural steel': 'structural_steel',
    'facade': 'facade',
    'carpenter': 'carpentry',
    'carpentry': 'carpentry',
    'plasterer': 'plastering',
    'plastering': 'plastering',
    'painters': 'painting',
    'painting': 'painting',
    'tiling': 'tiling',
    'kitchens': 'kitchens',
    'flooring': 'flooring',
    'landscaping': 'landscaping',
    'final clean': 'cleaning',
  }

  const normalized = tradeName.toLowerCase().trim()
  return mapping[normalized] || normalized.replace(/\s+/g, '_')
}
