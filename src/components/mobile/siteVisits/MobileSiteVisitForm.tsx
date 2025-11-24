/**
 * MobileSiteVisitForm - Mobile-optimized site visit recording
 * 
 * Step-by-step form flow optimized for field organisers on mobile devices.
 * Uses the MobileForm pattern for better touch interaction and flow.
 */

"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { MobileForm, MobileFormStep } from "@/components/mobile/shared/MobileForm"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { MapPin, Calendar, Building, Users, FileText, CheckCircle } from "lucide-react"
import { useSiteVisitReasonDefinitions } from "@/hooks/useSiteVisitReasons"
import DateInput from "@/components/ui/date-input"
import { ios } from "@/utils/iosIntegrations"

interface MobileSiteVisitFormProps {
  initialData?: {
    project_id?: string
    job_site_id?: string
  }
}

export function MobileSiteVisitForm({ initialData }: MobileSiteVisitFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<Record<string, any>>({})

  // Fetch user scope
  const { data: userScope } = useQuery({
    queryKey: ["mobile-sv-user-scope"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth?.user?.id || null
      if (!userId) return null

      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single()
      const role = prof?.role || null

      if (role === "admin") {
        return { role, userId, patchIds: null as string[] | null }
      }

      const patchIdSet = new Set<string>()
      
      if (role === "lead_organiser") {
        const { data: direct } = await supabase
          .from("lead_organiser_patch_assignments")
          .select("patch_id")
          .is("effective_to", null)
          .eq("lead_organiser_id", userId)
        direct?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
        
        const today = new Date().toISOString().slice(0, 10)
        const { data: links } = await supabase
          .from("role_hierarchy")
          .select("child_user_id")
          .eq("parent_user_id", userId)
          .eq("is_active", true)
          .or(`end_date.is.null,end_date.gte.${today}`)
        
        const childIds = Array.from(new Set(links?.map((r: any) => r.child_user_id).filter(Boolean) || []))
        if (childIds.length > 0) {
          const { data: team } = await supabase
            .from("organiser_patch_assignments")
            .select("patch_id")
            .is("effective_to", null)
            .in("organiser_id", childIds)
          team?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
        }
      } else if (role === "organiser") {
        const { data } = await supabase
          .from("organiser_patch_assignments")
          .select("patch_id")
          .is("effective_to", null)
          .eq("organiser_id", userId)
        data?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
      }

      return { role, userId, patchIds: Array.from(patchIdSet) }
    }
  })

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["mobile-sv-projects", userScope?.role, (userScope?.patchIds || []).join(",")],
    queryFn: async () => {
      if (!userScope) return []
      
      const projectsFromPatches = async (patchIdsInput: string[]) => {
        if (!patchIdsInput || patchIdsInput.length === 0) return []
        const { data: patchSites } = await supabase
          .from("v_patch_sites_current")
          .select("job_site_id, patch_id")
          .in("patch_id", patchIdsInput)
        
        const jobSiteIds = Array.from(new Set(patchSites?.map((r: any) => r.job_site_id).filter(Boolean) || []))
        if (jobSiteIds.length === 0) return []
        
        const { data: siteRows } = await supabase
          .from("job_sites")
          .select("id, project_id, projects(id,name)")
          .in("id", jobSiteIds)
        
        const byProject: Record<string, { id: string; name: string | null }> = {}
        siteRows?.forEach((s: any) => {
          const p = s.projects
          if (p?.id && !byProject[p.id]) byProject[p.id] = { id: p.id, name: p.name || p.id }
        })
        return Object.values(byProject).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      }

      if (userScope?.role === "admin" || userScope?.patchIds === null) {
        const { data } = await supabase.from("projects").select("id,name").order("name")
        return data || []
      }

      const patchIds = userScope?.patchIds || []
      return await projectsFromPatches(patchIds)
    },
    enabled: !!userScope
  })

  // Fetch sites for selected project
  const projectId = formData.basic?.project_id
  const { data: sites = [] } = useQuery({
    queryKey: ["mobile-sv-sites", projectId, userScope?.role, (userScope?.patchIds || []).join(",")],
    queryFn: async () => {
      if (!projectId || !userScope) return []
      
      if (userScope?.role === "admin" || userScope?.patchIds === null) {
        const { data } = await supabase
          .from("job_sites")
          .select("id,name,full_address,location,latitude,longitude")
          .eq("project_id", projectId)
          .order("name")
        return data || []
      }
      
      const patchIds = userScope?.patchIds || []
      if (patchIds.length === 0) return []
      
      const { data: patchSites } = await supabase
        .from("v_patch_sites_current")
        .select("job_site_id, patch_id")
        .in("patch_id", patchIds)
      
      const allowedSiteIds = new Set(patchSites?.map((r: any) => r.job_site_id) || [])
      const { data: projSites } = await supabase
        .from("job_sites")
        .select("id,name,full_address,location,latitude,longitude")
        .eq("project_id", projectId)
        .order("name")
      
      return projSites?.filter((s: any) => allowedSiteIds.has(s.id)) || []
    },
    enabled: !!projectId && !!userScope
  })

  // Fetch employers at selected site
  const siteId = formData.basic?.job_site_id
  const { data: siteEmployers = [] } = useQuery({
    queryKey: ["mobile-sv-site-employers", siteId],
    queryFn: async () => {
      if (!siteId) return []
      const { data } = await supabase
        .from("site_contractor_trades")
        .select("employer_id, employers(id,name)")
        .eq("job_site_id", siteId)
      
      const map: Record<string, { id: string; name: string }> = {}
      data?.forEach((row: any) => {
        const e = row.employers
        if (e?.id) map[e.id] = { id: e.id, name: e.name || e.id }
      })
      return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
    },
    enabled: !!siteId
  })

  // Fetch visit reasons
  const { data: reasonDefinitions = [] } = useSiteVisitReasonDefinitions()

  // Auto-select single site
  useEffect(() => {
    if (projectId && sites.length === 1 && !formData.basic?.job_site_id) {
      setFormData(prev => ({
        ...prev,
        basic: { ...prev.basic, job_site_id: sites[0].id }
      }))
    }
  }, [projectId, sites, formData.basic?.job_site_id])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const userId = userScope?.userId
      
      const visitPayload = {
        date: data.basic.date,
        organiser_id: userId,
        project_id: data.basic.project_id,
        job_site_id: data.basic.job_site_id,
        notes: data.notes?.notes || null,
        visit_status: "completed",
        created_by: userId,
        updated_by: userId,
      }

      const employerIds = data.employers?.selected_employers || []
      const rows = employerIds.length > 0
        ? employerIds.map((eid: string) => ({ ...visitPayload, employer_id: eid }))
        : [{ ...visitPayload, employer_id: null }]

      const { data: visits, error } = await supabase
        .from("site_visit")
        .insert(rows)
        .select("id")
      if (error) throw error

      const visitId = visits[0].id

      // Save visit reasons
      const selectedReasons = data.reasons?.selected_reasons || []
      if (selectedReasons.length > 0) {
        const reasonRows = selectedReasons.map((reasonId: string) => ({
          visit_id: visitId,
          reason_definition_id: reasonId,
          notes: data.reasons?.reason_notes?.[reasonId] || null,
        }))

        const { error: reasonError } = await supabase
          .from("site_visit_reasons")
          .insert(reasonRows)
        if (reasonError) throw reasonError
      }

      return visitId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-visits"] })
      toast.success("Site visit recorded successfully")
      router.push("/site-visits")
    },
    onError: (error) => {
      toast.error(`Failed to record site visit: ${error.message}`)
    }
  })

  const steps: MobileFormStep[] = [
    {
      id: "basic",
      title: "Visit Details",
      description: "When and where",
      icon: Calendar,
      component: ({ data, onChange }) => (
        <div className="space-y-4 p-4">
          <div>
            <Label htmlFor="date">Visit Date *</Label>
            <DateInput
              id="date"
              value={data.date || new Date().toISOString().slice(0, 10)}
              onChange={(e) => onChange({ ...data, date: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="project">Project *</Label>
            <Select
              value={data.project_id || initialData?.project_id || ""}
              onValueChange={(v) => onChange({ ...data, project_id: v, job_site_id: null })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {data.project_id && (
            <div>
              <Label htmlFor="site">Site *</Label>
              <Select
                value={data.job_site_id || initialData?.job_site_id || ""}
                onValueChange={(v) => onChange({ ...data, job_site_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sites.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">No sites found for this project</p>
              )}
            </div>
          )}
        </div>
      ),
      validation: (data) => {
        if (!data.date) return "Visit date is required"
        if (!data.project_id) return "Project is required"
        if (!data.job_site_id) return "Site is required"
        return true
      }
    },
    {
      id: "employers",
      title: "Employers",
      description: "Who's on site",
      icon: Building,
      component: ({ data, onChange }) => {
        const selectedEmployers = data.selected_employers || []
        
        return (
          <div className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Select employers present at the site during this visit
            </p>
            {siteEmployers.length > 0 ? (
              <div className="space-y-2">
                {siteEmployers.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={selectedEmployers.includes(e.id)}
                      onCheckedChange={(checked) => {
                        const newSelected = checked
                          ? [...selectedEmployers, e.id]
                          : selectedEmployers.filter((id: string) => id !== e.id)
                        onChange({ ...data, selected_employers: newSelected })
                      }}
                      id={`emp-${e.id}`}
                    />
                    <label htmlFor={`emp-${e.id}`} className="flex-1 text-sm font-medium">
                      {e.name}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No employers linked to this site</p>
              </div>
            )}
          </div>
        )
      }
    },
    {
      id: "reasons",
      title: "Visit Reasons",
      description: "Why you visited",
      icon: CheckCircle,
      component: ({ data, onChange }) => {
        const selectedReasons = data.selected_reasons || []
        const reasonNotes = data.reason_notes || {}
        
        return (
          <div className="space-y-4 p-4">
            {reasonDefinitions.filter((r: any) => r.always_visible).map((reason: any) => (
              <div key={reason.id} className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedReasons.includes(reason.id)}
                    onCheckedChange={(checked) => {
                      const newSelected = checked
                        ? [...selectedReasons, reason.id]
                        : selectedReasons.filter((id: string) => id !== reason.id)
                      onChange({ ...data, selected_reasons: newSelected })
                    }}
                    id={`reason-${reason.id}`}
                  />
                  <label htmlFor={`reason-${reason.id}`} className="text-sm font-medium">
                    {reason.display_name}
                  </label>
                </div>
                {selectedReasons.includes(reason.id) && (
                  <Textarea
                    placeholder={`Notes for ${reason.display_name}...`}
                    value={reasonNotes[reason.id] || ""}
                    onChange={(e) => onChange({
                      ...data,
                      reason_notes: { ...reasonNotes, [reason.id]: e.target.value }
                    })}
                    className="ml-8 min-h-[80px]"
                  />
                )}
              </div>
            ))}
          </div>
        )
      }
    },
    {
      id: "notes",
      title: "Additional Notes",
      description: "Any other details",
      icon: FileText,
      component: ({ data, onChange }) => (
        <div className="space-y-4 p-4">
          <div>
            <Label htmlFor="notes">Visit Notes</Label>
            <Textarea
              id="notes"
              value={data.notes || ""}
              onChange={(e) => onChange({ ...data, notes: e.target.value })}
              placeholder="Add any additional observations, issues, or outcomes from this visit..."
              className="min-h-[200px]"
            />
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <MobileForm
        steps={steps}
        onSubmit={(data) => saveMutation.mutate(data)}
        showProgress
        allowSkip
      />
    </div>
  )
}



