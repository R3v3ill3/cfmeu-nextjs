import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { fetchMappingSheetData } from "@/lib/mappingSheetData"
import { TRADE_OPTIONS, TRADE_STAGE_MAPPING } from "@/constants/trades"

export const dynamic = "force-dynamic"

const ALLOWED_ROLES = new Set(["organiser", "lead_organiser", "admin"])

interface MappingSheetSubmission {
  projectUpdates?: {
    name?: string | null
    value?: number | null
    proposed_start_date?: string | null
    proposed_finish_date?: string | null
    project_type?: string | null
    state_funding?: number | null
    federal_funding?: number | null
    roe_email?: string | null
  }
  addressUpdate?: string | null
  siteContactUpdates?: Array<{
    id?: string
    role: string
    name: string
    email?: string
    phone?: string
  }>
  contractorRoleUpdates?: Array<{
    id?: string
    action: "create" | "update" | "confirm_match" | "mark_wrong" | "delete"
    employerId?: string
    roleCode?: string
  }>
  tradeContractorUpdates?: Array<{
    id?: string
    action: "create" | "update" | "confirm_match" | "mark_wrong" | "delete"
    employerId?: string
    tradeType?: string
    estimatedWorkforce?: number | null
    estimatedFullTimeWorkers?: number | null
    estimatedCasualWorkers?: number | null
    estimatedAbnWorkers?: number | null
    membershipChecked?: boolean | null
    estimatedMembers?: number | null
  }>
}

async function ensureUserAccess(projectId: string) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("Failed to load profile", profileError)
    return { error: NextResponse.json({ error: "Unable to load user profile" }, { status: 500 }) }
  }

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, name, value, tier, proposed_start_date, proposed_finish_date, roe_email, project_type, state_funding, federal_funding, main_job_site_id"
    )
    .eq("id", projectId)
    .maybeSingle()

  if (projectError || !project) {
    return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) }
  }

  let address: string | null = null
  if (project.main_job_site_id) {
    const { data: site } = await supabase
      .from("job_sites")
      .select("full_address, location")
      .eq("id", project.main_job_site_id)
      .maybeSingle()
    address = site?.full_address || site?.location || null
  }

  return { supabase, project, address }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const projectId = params.projectId
  const access = await ensureUserAccess(projectId)
  if ("error" in access) return access.error

  const { supabase, project, address } = access

  try {
    const mappingSheetData = await fetchMappingSheetData(supabase, projectId)

    const { data: siteContacts = [] } = await supabase
      .from("site_contacts")
      .select("id, role, name, email, phone")
      .eq("job_site_id", project.main_job_site_id || "")

    const { data: employers = [] } = await supabase
      .from("employers")
      .select("id, name, enterprise_agreement_status")
      .order("name")
      .limit(1000)

    const { data: contractorRoleTypes = [] } = await supabase
      .from("contractor_role_types")
      .select("id, code, name")
      .order("name")

    const { data: keyTradesData = [] } = await supabase
      .from("key_contractor_trades")
      .select("trade_type, display_order")
      .eq("is_active", true)
      .order("display_order")

    const keyTrades = (keyTradesData || []).map((kt) => {
      const tradeOption = TRADE_OPTIONS.find((opt) => opt.value === kt.trade_type)
      return {
        trade_type: kt.trade_type,
        label:
          tradeOption?.label ||
          kt.trade_type?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        stage: TRADE_STAGE_MAPPING[kt.trade_type] || "other",
      }
    })

    const tradeOptions = TRADE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      stage: TRADE_STAGE_MAPPING[option.value] || "other",
    }))

    return NextResponse.json({
      token: null,
      resourceType: "PROJECT_MAPPING_SHEET",
      resourceId: projectId,
      project: {
        ...project,
        address,
      },
      siteContacts,
      mappingSheetData,
      employers,
      contractorRoleTypes,
      tradeOptions,
      keyTrades,
      expiresAt: null,
      allowedActions: ["view", "update"],
    })
  } catch (error) {
    console.error("Failed to load internal mapping sheet data:", error)
    return NextResponse.json({ error: "Failed to load mapping sheet data" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const projectId = params.projectId
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-entry',message:'POST request received',data:{projectId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,D'})}).catch(()=>{});
  // #endregion
  
  const access = await ensureUserAccess(projectId)
  if ("error" in access) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-access-error',message:'Access denied',data:{hasError:true},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return access.error
  }

  const { supabase, project } = access
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-access-ok',message:'Access granted',data:{projectId,mainJobSiteId:project.main_job_site_id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  try {
    const submission: MappingSheetSubmission = await request.json()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-parsed',message:'Submission parsed',data:{hasProjectUpdates:!!submission.projectUpdates,hasSiteContacts:!!(submission.siteContactUpdates?.length),hasContractorRoles:!!(submission.contractorRoleUpdates?.length),hasTradeContractors:!!(submission.tradeContractorUpdates?.length)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,D'})}).catch(()=>{});
    // #endregion

    await handleProjectUpdates(supabase, projectId, submission.projectUpdates)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-project-ok',message:'handleProjectUpdates completed',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    await handleAddressUpdate(supabase, project.main_job_site_id, submission.addressUpdate)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-address-ok',message:'handleAddressUpdate completed',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    await handleSiteContacts(
      supabase,
      project.main_job_site_id,
      submission.siteContactUpdates || []
    )
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-contacts-ok',message:'handleSiteContacts completed',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    await handleContractorRoles(supabase, projectId, submission.contractorRoleUpdates || [])
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-roles-ok',message:'handleContractorRoles completed',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    await handleTradeContractors(supabase, projectId, submission.tradeContractorUpdates || [])
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-trades-ok',message:'handleTradeContractors completed',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-success',message:'All handlers completed successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,D'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ success: true })
  } catch (error) {
    // #region agent log
    const errorInfo = {errorType:typeof error,isError:error instanceof Error,message:(error as any)?.message,code:(error as any)?.code,details:(error as any)?.details,hint:(error as any)?.hint,name:(error as any)?.name,stringified:String(error)};
    fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mapping-sheet/route.ts:POST-catch',message:'Handler threw error',data:errorInfo,timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,D'})}).catch(()=>{});
    // #endregion
    console.error("Failed to submit mapping sheet form:", error)
    return NextResponse.json(
      { error: "Failed to submit mapping sheet form" },
      { status: 500 }
    )
  }
}

async function handleProjectUpdates(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  projectId: string,
  updates?: MappingSheetSubmission["projectUpdates"]
) {
  if (!updates) return
  const patch: Record<string, any> = {}
  if (updates.name !== undefined) patch.name = updates.name
  if (updates.value !== undefined) patch.value = updates.value
  if (updates.proposed_start_date !== undefined)
    patch.proposed_start_date = updates.proposed_start_date
  if (updates.proposed_finish_date !== undefined)
    patch.proposed_finish_date = updates.proposed_finish_date
  if (updates.project_type !== undefined) patch.project_type = updates.project_type
  if (updates.state_funding !== undefined) patch.state_funding = updates.state_funding
  if (updates.federal_funding !== undefined) patch.federal_funding = updates.federal_funding
  if (updates.roe_email !== undefined) patch.roe_email = updates.roe_email

  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from("projects").update(patch).eq("id", projectId)
  if (error) throw error
}

async function handleAddressUpdate(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  jobSiteId: string | null,
  address?: string | null
) {
  if (!jobSiteId || address === undefined) return
  const value = address?.trim() || null
  const { error } = await supabase
    .from("job_sites")
    .update({ full_address: value, location: value })
    .eq("id", jobSiteId)
  if (error) throw error
}

async function handleSiteContacts(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  jobSiteId: string | null,
  contacts: NonNullable<MappingSheetSubmission["siteContactUpdates"]>
) {
  if (!jobSiteId || contacts.length === 0) return

  for (const contact of contacts) {
    const payload = {
      role: contact.role,
      name: contact.name?.trim() || "",
      email: contact.email?.trim() || null,
      phone: contact.phone?.trim() || null,
    }

    if (contact.id) {
      const { error } = await supabase
        .from("site_contacts")
        .update(payload)
        .eq("id", contact.id)
      if (error) throw error
    } else if (payload.name) {
      const { error } = await supabase
        .from("site_contacts")
        .insert({
          job_site_id: jobSiteId,
          ...payload,
        })
      if (error) throw error
    }
  }
}

async function handleContractorRoles(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  projectId: string,
  updates: NonNullable<MappingSheetSubmission["contractorRoleUpdates"]>
) {
  if (updates.length === 0) return

  const { data: roleTypes = [] } = await supabase
    .from("contractor_role_types")
    .select("id, code")

  const roleTypeMap = new Map(roleTypes.map((rt: any) => [rt.code, rt.id]))

  for (const update of updates) {
    switch (update.action) {
      case "create": {
        if (!update.employerId || !update.roleCode) break
        const roleTypeId = roleTypeMap.get(update.roleCode)
        if (!roleTypeId) break
        const { error } = await supabase.from("project_assignments").insert({
          project_id: projectId,
          employer_id: update.employerId,
          assignment_type: "contractor_role",
          contractor_role_type_id: roleTypeId,
          source: "site_visit_internal",
          match_status: "manual",
        })
        if (error) throw error
        break
      }

      case "update": {
        if (!update.id || !update.employerId) break
        const { error } = await supabase
          .from("project_assignments")
          .update({
            employer_id: update.employerId,
            match_status: "delegate_confirmed",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", update.id)
          .eq("project_id", projectId)
        if (error) throw error
        break
      }

      case "confirm_match": {
        if (!update.id) break
        const { error } = await supabase
          .from("project_assignments")
          .update({
            match_status: "delegate_confirmed",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", update.id)
          .eq("project_id", projectId)
        if (error) throw error
        break
      }

      case "mark_wrong": {
        if (!update.id) break
        const { error } = await supabase
          .from("project_assignments")
          .update({
            match_status: "incorrect_via_delegate",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", update.id)
          .eq("project_id", projectId)
        if (error) throw error
        break
      }

      case "delete": {
        if (!update.id) break
        const { error } = await supabase
          .from("project_assignments")
          .delete()
          .eq("id", update.id)
          .eq("project_id", projectId)
        if (error) throw error
        break
      }
    }
  }
}

async function handleTradeContractors(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  projectId: string,
  updates: NonNullable<MappingSheetSubmission["tradeContractorUpdates"]>
) {
  if (updates.length === 0) return

  // Look up trade_type_id from trade_types table
  const { data: tradeTypes = [] } = await supabase
    .from("trade_types")
    .select("id, code")
  const tradeTypeMap = new Map(tradeTypes.map((tt: { id: string; code: string }) => [tt.code, tt.id]))

  for (const update of updates) {
    const basePatch: Record<string, any> = {}
    if (update.employerId) basePatch.employer_id = update.employerId
    if (update.estimatedWorkforce !== undefined)
      basePatch.estimated_workers = update.estimatedWorkforce

    switch (update.action) {
      case "create": {
        if (!update.employerId || !update.tradeType) break
        const tradeTypeId = tradeTypeMap.get(update.tradeType)
        if (!tradeTypeId) {
          console.warn(`Trade type not found: ${update.tradeType}`)
          break
        }
        const { error } = await supabase.from("project_assignments").insert({
          project_id: projectId,
          employer_id: update.employerId,
          assignment_type: "trade_work",
          trade_type_id: tradeTypeId,
          estimated_workers: update.estimatedWorkforce ?? null,
          source: "site_visit_internal",
          match_status: "manual",
        })
        if (error) throw error
        break
      }

      case "update": {
        if (!update.id) break
        const { error } = await supabase
          .from("project_assignments")
          .update({
            ...basePatch,
            match_status: "delegate_confirmed",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", update.id)
          .eq("project_id", projectId)
        if (error) throw error
        break
      }

      case "confirm_match": {
        if (!update.id) break
        const { error } = await supabase
          .from("project_assignments")
          .update({
            match_status: "delegate_confirmed",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", update.id)
          .eq("project_id", projectId)
        if (error) throw error
        break
      }

      case "mark_wrong": {
        if (!update.id) break
        const { error } = await supabase
          .from("project_assignments")
          .update({
            match_status: "incorrect_via_delegate",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", update.id)
          .eq("project_id", projectId)
        if (error) throw error
        break
      }

      case "delete": {
        if (!update.id) break
        const { error } = await supabase
          .from("project_assignments")
          .delete()
          .eq("id", update.id)
          .eq("project_id", projectId)
        if (error) throw error
        break
      }
    }
  }
}










