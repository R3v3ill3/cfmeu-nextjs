import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { mergeOrganiserNameLists, PENDING_USER_DASHBOARD_STATUSES } from '@/utils/organiserDisplay'

type CategoryType = 'contractor_role' | 'trade'

export type PatchAssignment = {
  patch_id: string
  patch_name: string
  organiser_names: string[]
}

export type EmployerRow = {
  employer_id: string
  employer_name: string
  projects: Array<{
    id: string
    name: string
    tier?: string | null
    full_address?: string | null
    builder_name?: string | null
  }>
  patch_assignments?: PatchAssignment[]
}

export type EbaEmployersQueryParams = {
  typeParam: CategoryType | null
  code?: string
  currentOnly: boolean
  includeDerived: boolean
  includeManual: boolean
  keyOnly: boolean
  includeExtendedData: boolean
  includePatchData: boolean
}

type EmployerCategoryView = 'v_eba_active_employer_categories' | 'v_employer_contractor_categories'

type FetchMode = 'eba' | 'non-eba'

function applyCategoryFilters(
  query: any,
  params: EbaEmployersQueryParams,
  keyTradeCodes: string[] | null
) {
  const { typeParam, code, currentOnly, includeDerived, includeManual } = params

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

  if (keyTradeCodes) {
    query = query.eq('category_type', 'trade').in('category_code', keyTradeCodes)
  }

  return query
}

async function getKeyTradeCodes(
  supabase: SupabaseClient<Database>,
  params: EbaEmployersQueryParams
): Promise<string[] | null> {
  if (!params.keyOnly) return null
  if (params.typeParam && params.typeParam !== 'trade') {
    throw new Error('keyOnly is only supported when type=trade')
  }

  const { data: keyTradesData, error } = await (supabase as any)
    .from('key_contractor_trades')
    .select('trade_type')
    .eq('is_active', true)

  if (error) {
    throw new Error(error.message)
  }

  return (keyTradesData || []).map((t: any) => t.trade_type)
}

async function fetchEbaEmployerIds(
  supabase: SupabaseClient<Database>,
  params: EbaEmployersQueryParams,
  keyTradeCodes: string[] | null
): Promise<string[]> {
  let query = supabase
    .from('v_eba_active_employer_categories')
    .select('employer_id')

  query = applyCategoryFilters(query, params, keyTradeCodes)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map((row: any) => String(row.employer_id))
}

export async function fetchEbaEmployersData(
  supabase: SupabaseClient<Database>,
  params: EbaEmployersQueryParams,
  mode: FetchMode = 'eba'
): Promise<EmployerRow[]> {
  if (!params.includeDerived && !params.includeManual) {
    return []
  }

  const keyTradeCodes = await getKeyTradeCodes(supabase, params)
  const viewName: EmployerCategoryView =
    mode === 'non-eba' ? 'v_employer_contractor_categories' : 'v_eba_active_employer_categories'

  let query = supabase
    .from(viewName)
    .select('employer_id, employer_name, category_type, category_code, project_id, is_current, source')

  query = applyCategoryFilters(query, params, keyTradeCodes)

  if (mode === 'non-eba') {
    const ebaEmployerIds = await fetchEbaEmployerIds(supabase, params, keyTradeCodes)
    if (ebaEmployerIds.length > 0) {
      const quotedIds = ebaEmployerIds.map((id) => `"${id}"`).join(',')
      query = query.not('employer_id', 'in', `(${quotedIds})`)
    }
  }

  const { data: rows, error } = await query
  if (error) {
    throw new Error(error.message)
  }

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
    if (params.includeExtendedData) {
      const { data: projects, error: pErr } = await supabase
        .from('projects')
        .select('id, name, tier, full_address, builder_id')
        .in('id', projectIdList)

      if (pErr) throw new Error(pErr.message)

      const buildersByProject: Record<string, string> = {}
      const builderIdsFromProjects = new Set<string>()

      ;(projects || []).forEach((p: any) => {
        if (p.builder_id) {
          builderIdsFromProjects.add(p.builder_id)
        }
      })

      if (builderIdsFromProjects.size > 0) {
        try {
          const { data: builderEmployers } = await supabase
            .from('employers')
            .select('id, name')
            .in('id', Array.from(builderIdsFromProjects))

          const builderNamesById: Record<string, string> = {}
          ;(builderEmployers || []).forEach((e: any) => {
            if (e.id && e.name) {
              builderNamesById[e.id] = e.name
            }
          })

          ;(projects || []).forEach((p: any) => {
            if (p.builder_id && builderNamesById[p.builder_id] && !buildersByProject[p.id]) {
              buildersByProject[p.id] = builderNamesById[p.builder_id]
            }
          })
        } catch {}
      }

      try {
        const { data: roleTypes, error: rtErr } = await supabase
          .from('contractor_role_types')
          .select('id, code')
          .in('code', ['builder', 'head_contractor'])

        if (!rtErr) {
          const builderRoleIds = (roleTypes || []).map((rt: any) => rt.id)
          if (builderRoleIds.length > 0) {
            const { data: builderAssignments, error: bErr } = await supabase
              .from('project_assignments')
              .select('project_id, employer_id, contractor_role_type_id')
              .in('project_id', projectIdList)
              .eq('assignment_type', 'contractor_role')
              .eq('is_primary_for_role', true)
              .in('contractor_role_type_id', builderRoleIds)

            if (!bErr) {
              const assignmentEmployerIds = new Set<string>()
              ;(builderAssignments || []).forEach((ba: any) => {
                if (ba.employer_id) {
                  assignmentEmployerIds.add(ba.employer_id)
                }
              })

              if (assignmentEmployerIds.size > 0) {
                const { data: assignmentEmployers } = await supabase
                  .from('employers')
                  .select('id, name')
                  .in('id', Array.from(assignmentEmployerIds))

                const assignmentBuilderNamesById: Record<string, string> = {}
                ;(assignmentEmployers || []).forEach((e: any) => {
                  if (e.id && e.name) {
                    assignmentBuilderNamesById[e.id] = e.name
                  }
                })

                ;(builderAssignments || []).forEach((ba: any) => {
                  if (ba.project_id && ba.employer_id && assignmentBuilderNamesById[ba.employer_id] && !buildersByProject[ba.project_id]) {
                    buildersByProject[ba.project_id] = assignmentBuilderNamesById[ba.employer_id]
                  }
                })
              }
            }
          }
        }
      } catch {}

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
      const { data: projects, error: pErr } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIdList)

      if (pErr) throw new Error(pErr.message)
      projectsById = Object.fromEntries((projects || []).map((p: any) => [p.id as string, { id: p.id as string, name: p.name as string }]))
    }
  }

  const organisersByPatch: Record<string, Set<string>> = {}
  const pendingOrganisersByPatch: Record<string, Array<{ full_name?: string | null; email?: string | null; role?: string | null; status?: string | null }>> = {}
  const projectPatchAssignments: Record<string, { patch_id: string; patch_name: string; organiser_names: string[] }[]> = {}

  if (params.includePatchData && projectIdList.length > 0) {
    try {
      const { data: patchMappings, error: patchMappingErr } = await supabase
        .from('patch_project_mapping_view')
        .select('project_id, patch_id, patch_name')
        .in('project_id', projectIdList)

      if (!patchMappingErr) {
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

          if (!organiserErr) {
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

            if (!pendingErr) {
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
          } catch {}
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
    } catch {}
  }

  const result = Array.from(employersMap.values()).map((e) => {
    const projectList = Array.from(e.project_ids).map((pid) => projectsById[pid]).filter(Boolean)

    let patchAssignments: { patch_id: string; patch_name: string; organiser_names: string[] }[] | undefined
    if (params.includePatchData) {
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
      ...(params.includePatchData ? { patch_assignments: patchAssignments ?? [] } : {})
    }
  })

  return result
}
