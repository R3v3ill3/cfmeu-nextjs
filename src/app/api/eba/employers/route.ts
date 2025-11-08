import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { mergeOrganiserNameLists, PENDING_USER_DASHBOARD_STATUSES } from '@/utils/organiserDisplay'

export const dynamic = 'force-dynamic'

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback
  const v = value.toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return fallback
}

function mapCategoryType(t: string | null): 'contractor_role' | 'trade' | null {
  if (!t) return null
  if (t === 'role' || t === 'contractor_role') return 'contractor_role'
  if (t === 'trade') return 'trade'
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const typeParam = mapCategoryType(searchParams.get('type'))
    const code = searchParams.get('code') || undefined
    const currentOnly = parseBool(searchParams.get('currentOnly'), true)
    const includeDerived = parseBool(searchParams.get('includeDerived'), true)
    const includeManual = parseBool(searchParams.get('includeManual'), true)
    const keyOnly = parseBool(searchParams.get('keyOnly'), false)
    const includeExtendedData = parseBool(searchParams.get('includeExtendedData'), false)
    const includePatchData = parseBool(searchParams.get('includePatchData'), false)

    if (keyOnly && typeParam && typeParam !== 'trade') {
      return NextResponse.json({ error: 'keyOnly is only supported when type=trade' }, { status: 400 })
    }

    if (!includeDerived && !includeManual) {
      return NextResponse.json({ data: [] })
    }

    const supabase = await createServerSupabase()
    let query = supabase
      .from('v_eba_active_employer_categories')
      .select('employer_id, employer_name, category_type, category_code, project_id, is_current, source')

    if (typeParam) {
      query = query.eq('category_type', typeParam)
    }

    if (code) {
      query = query.eq('category_code', code)
    }

    if (currentOnly) {
      query = query.eq('is_current', true)
    }

    if (includeDerived && !includeManual) {
      query = query.neq('source', 'manual_capability')
    } else if (!includeDerived && includeManual) {
      query = query.eq('source', 'manual_capability')
    }

    if (keyOnly) {
      // Fetch key trades from database (dynamic system)
      const { data: keyTradesData } = await (supabase as any)
        .from('key_contractor_trades')
        .select('trade_type')
        .eq('is_active', true)
      
      const keyTradesList = (keyTradesData || []).map((t: any) => t.trade_type)
      query = query.eq('category_type', 'trade').in('category_code', keyTradesList)
    }

    const { data: rows, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const employersMap = new Map<string, { employer_id: string; employer_name: string; project_ids: Set<string> }>()
    const projectIds: Set<string> = new Set()

    ;(rows || []).forEach((r: any) => {
      const id = r.employer_id as string
      if (!employersMap.has(id)) {
        employersMap.set(id, { employer_id: id, employer_name: r.employer_name as string, project_ids: new Set<string>() })
      }
      if (r.project_id) projectIds.add(r.project_id as string)
      if (r.project_id) employersMap.get(id)!.project_ids.add(r.project_id as string)
    })

    let projectsById: Record<string, any> = {}
    const projectIdList = Array.from(projectIds)
    if (projectIds.size > 0) {
      if (includeExtendedData) {
        // Fetch extended project data including tier, address, and builder
        const { data: projects, error: pErr } = await supabase
          .from('projects')
          .select('id, name, tier, full_address')
          .in('id', projectIdList)
        
        if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
        
        // Get builder/head contractor role type IDs
        const { data: roleTypes, error: rtErr } = await supabase
          .from('contractor_role_types')
          .select('id, code')
          .in('code', ['builder', 'head_contractor'])
        
        if (rtErr) {
          console.error('Error fetching role types:', rtErr)
          return NextResponse.json({ error: `Failed to fetch role types: ${rtErr.message}` }, { status: 500 })
        }
        
        const builderRoleIds = (roleTypes || []).map((rt: any) => rt.id)
        
        // Get builder information for each project (only if we have role IDs)
        let builderAssignments: any[] = []
        if (builderRoleIds.length > 0) {
          const { data, error: bErr } = await supabase
            .from('project_assignments')
            .select('project_id, employer_id, contractor_role_type_id, employers(name)')
            .in('project_id', projectIdList)
            .eq('assignment_type', 'contractor_role')
            .eq('is_primary_for_role', true)
            .in('contractor_role_type_id', builderRoleIds)
          
          if (bErr) {
            console.error('Error fetching builder assignments:', bErr)
            return NextResponse.json({ error: `Failed to fetch builder assignments: ${bErr.message}` }, { status: 500 })
          }
          
          builderAssignments = data || []
        }
        
        // Map builders to projects
        const buildersByProject: Record<string, string> = {}
        ;(builderAssignments || []).forEach((ba: any) => {
          if (ba.project_id && ba.employers?.name && !buildersByProject[ba.project_id]) {
            buildersByProject[ba.project_id] = ba.employers.name
          }
        })
        
        projectsById = Object.fromEntries((projects || []).map((p: any) => [
          p.id as string, 
          { 
            id: p.id as string, 
            name: p.name as string,
            tier: p.tier as string | null,
            full_address: p.full_address as string | null,
            builder_name: buildersByProject[p.id] || null
          }
        ]))
      } else {
        // Basic project data (name only)
        const { data: projects, error: pErr } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIdList)
        if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
        projectsById = Object.fromEntries((projects || []).map((p: any) => [p.id as string, { id: p.id as string, name: p.name as string }]))
      }
    }

    const organisersByPatch: Record<string, Set<string>> = {}
    const pendingOrganisersByPatch: Record<string, Array<{ full_name?: string | null; email?: string | null; role?: string | null; status?: string | null }>> = {}
    const projectPatchAssignments: Record<string, { patch_id: string; patch_name: string; organiser_names: string[] }[]> = {}

    if (includePatchData && projectIdList.length > 0) {
      try {
        const { data: patchMappings, error: patchMappingErr } = await supabase
          .from('patch_project_mapping_view')
          .select('project_id, patch_id, patch_name')
          .in('project_id', projectIdList)

        if (patchMappingErr) {
          console.error('Error fetching patch mapping view for EBA employers:', patchMappingErr)
        } else {
          const patchIdSet = new Set<string>()

          ;(patchMappings || []).forEach((row: any) => {
            const projectId = row?.project_id as string | null
            const patchId = row?.patch_id as string | null
            const patchName = row?.patch_name as string | null

            if (!projectId || !patchId || !patchName) {
              return
            }

            if (!projectPatchAssignments[projectId]) {
              projectPatchAssignments[projectId] = []
            }

            if (!projectPatchAssignments[projectId].some((assignment) => assignment.patch_id === patchId)) {
              projectPatchAssignments[projectId].push({
                patch_id: patchId,
                patch_name: patchName,
                organiser_names: []
              })
            }

            patchIdSet.add(patchId)
            if (!organisersByPatch[patchId]) {
              organisersByPatch[patchId] = new Set<string>()
            }
          })

          if (patchIdSet.size > 0) {
            const patchIdArray = Array.from(patchIdSet)

            const { data: organiserRows, error: organiserErr } = await supabase
              .from('organiser_patch_assignments')
              .select(`
                patch_id,
                profiles:organiser_id(full_name)
              `)
              .in('patch_id', patchIdArray)
              .is('effective_to', null)

            if (organiserErr) {
              console.error('Error fetching organiser assignments for EBA employers:', organiserErr)
            } else {
              ;(organiserRows || []).forEach((row: any) => {
                const patchId = row?.patch_id as string | null
                if (!patchId) {
                  return
                }
                if (!organisersByPatch[patchId]) {
                  organisersByPatch[patchId] = new Set<string>()
                }
                const profRaw = row?.profiles
                const profile = Array.isArray(profRaw) ? profRaw[0] : profRaw
                if (profile) {
                  const fullName = typeof profile.full_name === 'string' ? profile.full_name.trim() : ''
                  if (fullName) {
                    organisersByPatch[patchId]!.add(fullName)
                  }
                }
              })
            }

            try {
            const { data: pendingRows, error: pendingErr } = await supabase
                .from('pending_users')
              .select('full_name, email, role, assigned_patch_ids, status')
              .in('status', Array.from(PENDING_USER_DASHBOARD_STATUSES))

              if (pendingErr) {
                console.warn('Warning: Failed to fetch pending organisers for patch assignments:', pendingErr)
              } else {
                const wantedPatchIds = new Set(patchIdArray)
              ;(pendingRows || []).forEach((row: any) => {
                const fullName = typeof row?.full_name === 'string' ? row.full_name.trim() : ''
                const email = typeof row?.email === 'string' ? row.email.trim() : ''
                const displayName = fullName || email
                if (!displayName) return

                  const assigned: string[] = Array.isArray(row?.assigned_patch_ids)
                    ? row.assigned_patch_ids.map((pid: any) => String(pid))
                    : []

                  assigned.forEach((pid) => {
                    if (!wantedPatchIds.has(pid)) return
                  if (!pendingOrganisersByPatch[pid]) pendingOrganisersByPatch[pid] = []
                  pendingOrganisersByPatch[pid]!.push({
                    full_name: fullName || null,
                    email: email || null,
                    role: row?.role ?? null,
                    status: row?.status ?? null,
                  })
                  })
                })
              }
            } catch (pendingError) {
              console.warn('Warning: Unexpected error while loading pending organisers for patch assignments:', pendingError)
            }
          }

          Object.entries(projectPatchAssignments).forEach(([projectId, assignments]) => {
            assignments.forEach((assignment) => {
              const patchId = assignment.patch_id
            const liveNames = organisersByPatch[patchId]
              ? Array.from(organisersByPatch[patchId]!)
              : []
            const pendingList = pendingOrganisersByPatch[patchId] || []
            const mergedNames = mergeOrganiserNameLists(liveNames, pendingList)
            assignment.organiser_names = mergedNames.sort((a, b) => a.localeCompare(b))
            })
          })
        }
      } catch (patchDataError) {
        console.error('Unexpected error while building patch assignments for EBA employers:', patchDataError)
      }
    }

    const result = Array.from(employersMap.values()).map((e) => {
      const projectList = Array.from(e.project_ids).map((pid) => projectsById[pid]).filter(Boolean)

      let patchAssignments: { patch_id: string; patch_name: string; organiser_names: string[] }[] | undefined
      if (includePatchData) {
        const patchMap = new Map<string, { patch_id: string; patch_name: string; organiserSet: Set<string> }>()

        e.project_ids.forEach((pid) => {
          const assignmentsForProject = projectPatchAssignments[pid]
          if (!assignmentsForProject) return

          assignmentsForProject.forEach((assignment) => {
            if (!patchMap.has(assignment.patch_id)) {
              patchMap.set(assignment.patch_id, {
                patch_id: assignment.patch_id,
                patch_name: assignment.patch_name,
                organiserSet: new Set<string>()
              })
            }
            const patchEntry = patchMap.get(assignment.patch_id)!
            assignment.organiser_names.forEach((name) => {
              if (name) {
                patchEntry.organiserSet.add(name)
              }
            })
          })
        })

        patchAssignments = Array.from(patchMap.values()).map((value) => ({
          patch_id: value.patch_id,
          patch_name: value.patch_name,
          organiser_names: Array.from(value.organiserSet).sort((a, b) => a.localeCompare(b))
        })).sort((a, b) => a.patch_name.localeCompare(b.patch_name))
      }

      return {
        employer_id: e.employer_id,
        employer_name: e.employer_name,
        projects: projectList,
        ...(includePatchData ? { patch_assignments: patchAssignments ?? [] } : {})
      }
    })

    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}


