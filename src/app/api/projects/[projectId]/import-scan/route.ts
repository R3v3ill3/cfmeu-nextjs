import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import type { Database } from '@/types/database'
import { normalizeProjectType } from '@/utils/projectType'
import { normalizeSiteContactRole } from '@/utils/siteContactRole'

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
    const safeProjectDecisions = projectDecisions ? { ...projectDecisions } : {}

    if (Object.prototype.hasOwnProperty.call(safeProjectDecisions, 'project_type')) {
      const rawProjectType = safeProjectDecisions.project_type
      if (rawProjectType === null || rawProjectType === undefined || rawProjectType === '') {
        safeProjectDecisions.project_type = null
      } else {
        const normalizedType = normalizeProjectType(rawProjectType)
        if (!normalizedType) {
          throw new Error(`Unsupported project type value: ${rawProjectType}`)
        }
        safeProjectDecisions.project_type = normalizedType
      }
    }

    if (Object.keys(safeProjectDecisions).length > 0) {
      // Valid columns in projects table
      const validProjectColumns = [
        'name', 'value', 'proposed_start_date', 'proposed_finish_date', 
        'roe_email', 'state_funding', 'federal_funding', 'project_type'
      ]
      
      // Filter to only include valid columns
      const validUpdates: any = {}
      Object.entries(safeProjectDecisions).forEach(([key, value]) => {
        if (validProjectColumns.includes(key)) {
          validUpdates[key] = value
        }
      })

      // Handle builder_name separately (update builder_id)
      if (safeProjectDecisions.builder_name && safeProjectDecisions.builder_employer_id) {
        validUpdates.builder_id = safeProjectDecisions.builder_employer_id
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
      if (safeProjectDecisions.address) {
        const { data: project } = await serviceSupabase
          .from('projects')
          .select('main_job_site_id')
          .eq('id', projectId)
          .single()

        if (project?.main_job_site_id) {
          await serviceSupabase
            .from('job_sites')
            .update({ 
              full_address: safeProjectDecisions.address,
              location: safeProjectDecisions.address 
            })
            .eq('id', project.main_job_site_id)
        }
      }

    }

    updatedFields = Object.keys(safeProjectDecisions).length

    // 2. Update/create site contacts
    if (contactsDecisions && contactsDecisions.length > 0) {
      const preparedContacts = contactsDecisions
        .filter((contact: any) => !contact.action || contact.action === 'update')
        .map((contact: any) => ({
          ...contact,
          role: normalizeSiteContactRole(contact.role),
        }))

      // Get project's main site
      const { data: project } = await serviceSupabase
        .from('projects')
        .select('main_job_site_id')
        .eq('id', projectId)
        .single()

      if (!project?.main_job_site_id) {
        throw new Error('Project has no main job site')
      }

      for (const contact of preparedContacts) {
        if (contact.existingId) {
          const name = contact.name?.trim() || null
          const email = contact.email?.trim() || null
          const phone = contact.phone?.trim() || null
          // Update existing
          const { error } = await serviceSupabase
            .from('site_contacts')
            .update({
              name,
              email,
              phone,
            })
            .eq('id', contact.existingId)

          if (error) {
            console.error('Failed to update contact:', error)
          }
        } else {
          if (!contact.role) {
            console.warn('Skipping site contact with invalid role:', contact)
            continue
          }
          const name = contact.name?.trim() || null
          const email = contact.email?.trim() || null
          const phone = contact.phone?.trim() || null
          
          // Skip contacts without valid names (handles "Nil" or empty values from scans)
          if (!name || name.toLowerCase() === 'nil') {
            console.log(`Skipping contact with role ${contact.role} - no valid name (${contact.name})`)
            continue
          }
          
          // Create new
          const { error } = await serviceSupabase
            .from('site_contacts')
            .insert({
              job_site_id: project.main_job_site_id,
              role: contact.role,
              name,
              email,
              phone,
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
      const tradeTypeErrors: string[] = []
      
      for (const sub of subcontractorDecisions) {
        if (!sub.matchedEmployer) continue

        try {
          // Try to use trade_type_code from decision first, then fall back to mapping
          let tradeCode: string | null = null
          
          if (sub.trade_type_code && sub.trade_type_code.trim()) {
            // Use the trade_type_code from the decision if available
            tradeCode = sub.trade_type_code.trim()
          } else if (sub.trade && sub.trade.trim()) {
            // Fall back to mapping the trade name
            tradeCode = mapTradeNameToCode(sub.trade.trim())
          }
          
          if (!tradeCode) {
            const errorMsg = `No valid trade type code for subcontractor "${sub.matchedEmployer?.name || sub.company}" (trade: "${sub.trade || 'unknown'}")`
            console.error(errorMsg)
            tradeTypeErrors.push(errorMsg)
            continue
          }
          
          // Get trade_type_id - validate it exists in database
          let { data: tradeType, error: tradeTypeError } = await serviceSupabase
            .from('trade_types')
            .select('id')
            .eq('code', tradeCode)
            .single()

          // If trade type doesn't exist, try fallback to general_construction
          if (tradeTypeError || !tradeType) {
            console.warn(`Trade type "${tradeCode}" not found, trying fallback "general_construction" for "${sub.matchedEmployer?.name || sub.company}"`)
            
            const { data: fallbackTradeType, error: fallbackError } = await serviceSupabase
              .from('trade_types')
              .select('id')
              .eq('code', 'general_construction')
              .single()

            if (fallbackError || !fallbackTradeType) {
              // Even fallback doesn't exist - this is a serious database issue
              const errorMsg = `Trade type "${tradeCode}" not found and fallback "general_construction" also not found. Cannot create assignment for "${sub.matchedEmployer?.name || sub.company}" (original trade: "${sub.trade || 'unknown'}")`
              console.error(errorMsg, tradeTypeError, fallbackError)
              tradeTypeErrors.push(errorMsg)
              continue
            }
            
            tradeType = fallbackTradeType
            console.log(`Using fallback trade type "general_construction" for "${sub.matchedEmployer?.name || sub.company}" (original: "${sub.trade}")`)
          }

          // Create project assignment
          const { error } = await serviceSupabase
            .from('project_assignments')
            .insert({
              project_id: projectId,
              employer_id: sub.matchedEmployer.id,
              assignment_type: 'trade_work',
              trade_type_id: tradeType.id, // This must be valid to pass constraint
              status: sub.status || 'active',  // Include status from scan review
              status_updated_at: new Date().toISOString(),
              status_updated_by: user.id,
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
            } else if (error.code === '23514') {
              // Check constraint violation
              const errorMsg = `Check constraint violation for "${sub.matchedEmployer.name}" (trade: "${sub.trade}", code: "${tradeCode}"). This usually means the trade type is invalid or missing.`
              console.error(errorMsg, error)
              tradeTypeErrors.push(errorMsg)
            } else {
              console.error('Failed to create assignment:', error)
              tradeTypeErrors.push(`Failed to create assignment for "${sub.matchedEmployer.name}": ${error.message}`)
            }
          } else {
            subcontractorsCreated++
          }
        } catch (error: any) {
          const errorMsg = `Error processing subcontractor "${sub.matchedEmployer?.name || sub.company}": ${error?.message || String(error)}`
          console.error(errorMsg, error)
          tradeTypeErrors.push(errorMsg)
        }
      }
      
      // If there were trade type errors, include them in the response
      if (tradeTypeErrors.length > 0) {
        console.error('Trade type errors during import:', tradeTypeErrors)
        // Don't fail the whole import, but log the errors
        // The errors are already logged above
      }
    }

    // 4. Apply organising universe override (set to active)
    const { data: ouResult, error: ouError } = await serviceSupabase.rpc('set_organising_universe_manual', {
      p_project_id: projectId,
      p_universe: 'active',
      p_user_id: user.id,
      p_reason: 'Set to active via mapping sheet upload',
    })

    if (ouError) {
      console.error('Failed to set organising universe to active for project import:', ouError)
      throw new Error(ouError.message || 'Failed to set organising universe to active')
    }

    if (!(ouResult as any)?.success) {
      const details = (ouResult as any)?.error
      console.error('Failed to set organising universe to active for project import:', details)
      throw new Error(details || 'Failed to set organising universe to active')
    }

    // 5. Update scan record
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
      organisingUniverseUpdated: true,
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
  if (!tradeName) {
    return 'general_construction'
  }
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
