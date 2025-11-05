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
          .select('main_job_site_id, name')
          .eq('id', projectId)
          .single()

        if (project?.main_job_site_id) {
          // Update existing job site
          await serviceSupabase
            .from('job_sites')
            .update({ 
              full_address: safeProjectDecisions.address,
              location: safeProjectDecisions.address,
              latitude: safeProjectDecisions.address_latitude || null,
              longitude: safeProjectDecisions.address_longitude || null,
            })
            .eq('id', project.main_job_site_id)
        } else {
          // Create new job site if it doesn't exist
          const { data: newJobSite, error: jobSiteError } = await serviceSupabase
            .from('job_sites')
            .insert({
              project_id: projectId,
              name: project?.name || 'Main Site',
              is_main_site: true,
              location: safeProjectDecisions.address,
              full_address: safeProjectDecisions.address,
              latitude: safeProjectDecisions.address_latitude || null,
              longitude: safeProjectDecisions.address_longitude || null,
            })
            .select('id')
            .single()

          if (!jobSiteError && newJobSite) {
            // Update project with the new main_job_site_id
            await serviceSupabase
              .from('projects')
              .update({ main_job_site_id: newJobSite.id })
              .eq('id', projectId)
          }
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
        .select('main_job_site_id, name')
        .eq('id', projectId)
        .single()

      let mainJobSiteId = project?.main_job_site_id

      // If project doesn't have a main job site, create one from scan data
      if (!mainJobSiteId) {
        // Try to get address from project decisions or scan data
        const address = safeProjectDecisions.address || projectDecisions?.address
        
        if (address) {
          // Create a new job site for this project
          const { data: newJobSite, error: jobSiteError } = await serviceSupabase
            .from('job_sites')
            .insert({
              project_id: projectId,
              name: project?.name || 'Main Site',
              is_main_site: true,
              location: address,
              full_address: address,
              latitude: safeProjectDecisions.address_latitude || projectDecisions?.address_latitude || null,
              longitude: safeProjectDecisions.address_longitude || projectDecisions?.address_longitude || null,
            })
            .select('id')
            .single()

          if (jobSiteError || !newJobSite) {
            console.error('Failed to create job site:', jobSiteError)
            throw new Error(`Failed to create job site: ${jobSiteError?.message || 'Unknown error'}`)
          }

          // Update project with the new main_job_site_id
          const { error: updateError } = await serviceSupabase
            .from('projects')
            .update({ main_job_site_id: newJobSite.id })
            .eq('id', projectId)

          if (updateError) {
            console.error('Failed to update project with main_job_site_id:', updateError)
            throw new Error(`Failed to update project: ${updateError.message}`)
          }

          mainJobSiteId = newJobSite.id
          console.log('Created main job site for project:', projectId, 'Job site ID:', mainJobSiteId)
        } else {
          // No address available - cannot create contacts without a job site
          console.warn('Project has no main job site and no address data available. Skipping contact creation.')
          // Skip contact creation but continue with rest of import
        }
      }

      // Only proceed with contact creation if we have a job site
      if (mainJobSiteId) {
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
            
            // Create new contact
            const { error } = await serviceSupabase
              .from('site_contacts')
              .insert({
                job_site_id: mainJobSiteId,
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
      } else {
        console.log('Skipping contact creation - no job site available')
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

          // Create project assignment - use upsert to handle duplicates gracefully
          // Check if assignment already exists first to avoid constraint violation
          const { data: existingAssignment } = await serviceSupabase
            .from('project_assignments')
            .select('id')
            .eq('project_id', projectId)
            .eq('employer_id', sub.matchedEmployer.id)
            .eq('trade_type_id', tradeType.id)
            .eq('assignment_type', 'trade_work')
            .maybeSingle()

          if (existingAssignment) {
            // Assignment already exists - skip silently
            console.log('Assignment already exists:', sub.matchedEmployer.name, tradeCode)
            continue
          }

          // Insert new assignment
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
            // Check if it's a duplicate (race condition - another request created it)
            if (error.code === '23505') {
              console.log('Assignment already exists (race condition):', sub.matchedEmployer.name, tradeCode)
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
