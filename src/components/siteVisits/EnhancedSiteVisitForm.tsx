/**
 * EnhancedSiteVisitForm - The canonical site visit recording component
 * 
 * This is the recommended and actively maintained site visit form component.
 * 
 * Features:
 * - Patch-based project/site filtering for organisers
 * - Visit reason tracking (predefined and custom)
 * - Follow-up action management with due dates
 * - Site contact integration
 * - iOS-optimized features (directions, calendar events)
 * - Draft and completed visit states
 * - Multi-employer visit support
 * - Proper validation of project-site relationships
 * 
 * Usage:
 * import { EnhancedSiteVisitForm } from "@/components/siteVisits/EnhancedSiteVisitForm"
 * 
 * <EnhancedSiteVisitForm 
 *   open={isOpen} 
 *   onOpenChange={setIsOpen}
 *   initial={{ project_id: projectId }} // Optional pre-fill
 * />
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import DateInput from "@/components/ui/date-input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useSiteVisitReasonDefinitions } from "@/hooks/useSiteVisitReasons"
import { ChevronDown, ExternalLink, Plus, X, MapPin, FileCheck, FileText, Calendar, Navigation, Users, Share2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { ios } from "@/utils/iosIntegrations"
import { ContactCardActions } from "@/components/ui/ContactActions"

type SiteVisit = {
  id?: string
  date: string
  organiser_id: string | null
  project_id: string | null
  job_site_id: string | null
  employer_id: string | null
  notes: string | null
  actions_taken: string | null
  visit_status?: string
}

type FollowUpAction = {
  id?: string
  description: string
  follow_up_type: "checklist_item" | "linked_activity" | "calendar_event"
  due_date?: string
  linked_activity_id?: string
  is_completed?: boolean
}

export function EnhancedSiteVisitForm({ 
  open, 
  onOpenChange, 
  initial 
}: { 
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: Partial<SiteVisit> 
}) {
  const qc = useQueryClient()
  const router = useRouter()
  
  // Basic visit data
  const [visitDate, setVisitDate] = useState<string>(() => initial?.date || new Date().toISOString().slice(0, 10))
  const [organiserId, setOrganiserId] = useState<string | null>(initial?.organiser_id || null)
  const [projectId, setProjectId] = useState<string | null>(initial?.project_id || null)
  const [siteId, setSiteId] = useState<string | null>(initial?.job_site_id || null)
  const [notes, setNotes] = useState<string>(initial?.notes || "")
  const [selectedEmployerIds, setSelectedEmployerIds] = useState<string[]>(
    initial?.employer_id ? [initial.employer_id] : []
  )
  
  // Visit reasons
  const [selectedReasonIds, setSelectedReasonIds] = useState<Set<string>>(new Set())
  const [reasonNotes, setReasonNotes] = useState<Record<string, string>>({})
  const [showMoreReasons, setShowMoreReasons] = useState(false)
  
  // Follow-up actions
  const [followUpActions, setFollowUpActions] = useState<FollowUpAction[]>([])
  const [newFollowUpDescription, setNewFollowUpDescription] = useState("")
  const [newFollowUpDueDate, setNewFollowUpDueDate] = useState("")
  
  // UI state
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  
  const isEditing = Boolean(initial?.id)

  // Fetch user scope
  const { data: userScope } = useQuery({
    queryKey: ["sv-user-scope"],
    queryFn: async () => {
      let userId: string | null = null
      let role: string | null = null
      try {
        const { data: auth } = await supabase.auth.getUser()
        userId = auth?.user?.id || null
        if (userId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single()
          role = prof?.role || null
        }
      } catch (err) {
        console.error('[EnhancedSiteVisitForm] Error fetching user auth:', err)
      }

      if (role === "admin") {
        return { role, userId, patchIds: null as string[] | null }
      }

      const patchIdSet = new Set<string>()
      try {
        if (role === "lead_organiser") {
          const { data: direct, error: directErr } = await supabase
            .from("lead_organiser_patch_assignments")
            .select("patch_id")
            .is("effective_to", null)
            .eq("lead_organiser_id", userId)
          if (directErr) {
            console.error('[EnhancedSiteVisitForm] Error fetching lead organiser patches:', directErr)
          } else {
            direct?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
          }
          
          const today = new Date().toISOString().slice(0, 10)
          const { data: links, error: linksErr } = await supabase
            .from("role_hierarchy")
            .select("child_user_id")
            .eq("parent_user_id", userId)
            .eq("is_active", true)
            .or(`end_date.is.null,end_date.gte.${today}`)
          if (linksErr) {
            console.error('[EnhancedSiteVisitForm] Error fetching role hierarchy:', linksErr)
          } else {
            const childIds = Array.from(new Set(links?.map((r: any) => r.child_user_id).filter(Boolean) || []))
            if (childIds.length > 0) {
              const { data: team, error: teamErr } = await supabase
                .from("organiser_patch_assignments")
                .select("patch_id")
                .is("effective_to", null)
                .in("organiser_id", childIds)
              if (teamErr) {
                console.error('[EnhancedSiteVisitForm] Error fetching team patches:', teamErr)
              } else {
                team?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
              }
            }
          }
        } else if (role === "organiser") {
          const { data, error } = await supabase
            .from("organiser_patch_assignments")
            .select("patch_id")
            .is("effective_to", null)
            .eq("organiser_id", userId)
          if (error) {
            console.error('[EnhancedSiteVisitForm] Error fetching organiser patches:', error)
          } else {
            data?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
            console.log('[EnhancedSiteVisitForm] Organiser patches:', Array.from(patchIdSet))
          }
        }
      } catch (err) {
        console.error('[EnhancedSiteVisitForm] Error in patch assignment logic:', err)
      }

      const patchIds = Array.from(patchIdSet)
      console.log('[EnhancedSiteVisitForm] User scope:', { role, userId, patchIds })
      return { role, userId, patchIds }
    }
  })

  // Fetch organisers
  const { data: organisers = [] } = useQuery({
    queryKey: ["sv-organisers", userScope?.role, userScope?.userId],
    queryFn: async () => {
      if (!userScope?.role || userScope.role === "organiser") return []

      if (userScope.role === "admin") {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "organiser")
          .order("full_name")
        if (error) throw error
        return data || []
      }

      const today = new Date().toISOString().slice(0, 10)
      const { data: links, error: lerr } = await supabase
        .from("role_hierarchy")
        .select("child_user_id")
        .eq("parent_user_id", userScope.userId)
        .eq("is_active", true)
        .or(`end_date.is.null,end_date.gte.${today}`)
      if (lerr) throw lerr
      
      const organiserIds = Array.from(new Set(links?.map((r: any) => r.child_user_id).filter(Boolean) || []))
      if (organiserIds.length === 0) return []
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", organiserIds)
        .order("full_name")
      if (error) throw error
      return data || []
    },
    enabled: !!userScope?.role && userScope.role !== "organiser"
  })

  // Fetch projects
  const { data: projects = [], error: projectsError, isLoading: projectsLoading } = useQuery({
    queryKey: ["sv-projects", userScope?.role, (userScope?.patchIds || []).join(","), organiserId],
    queryFn: async () => {
      const projectsFromPatches = async (patchIdsInput: string[]) => {
        if (!patchIdsInput || patchIdsInput.length === 0) {
          console.warn('[EnhancedSiteVisitForm] No patch IDs provided for project filtering')
          return []
        }
        
        const { data: patchSites, error: psErr } = await supabase
          .from("v_patch_sites_current")
          .select("job_site_id, patch_id")
          .in("patch_id", patchIdsInput)
        if (psErr) {
          console.error('[EnhancedSiteVisitForm] Error fetching patch sites:', psErr)
          throw psErr
        }
        
        const jobSiteIds = Array.from(new Set(patchSites?.map((r: any) => r.job_site_id).filter(Boolean) || []))
        if (jobSiteIds.length === 0) {
          console.warn('[EnhancedSiteVisitForm] No job sites found for patches:', patchIdsInput)
          return []
        }
        
        // Query job sites first, then projects separately to avoid RLS issues
        const { data: siteRows, error: jsErr } = await supabase
          .from("job_sites")
          .select("id, project_id")
          .in("id", jobSiteIds)
          .not("project_id", "is", null)
        if (jsErr) {
          console.error('[EnhancedSiteVisitForm] Error fetching job sites:', jsErr)
          throw jsErr
        }
        
        const projectIds = Array.from(new Set(siteRows?.map((s: any) => s.project_id).filter(Boolean) || []))
        if (projectIds.length === 0) {
          console.warn('[EnhancedSiteVisitForm] No projects found for job sites')
          return []
        }
        
        // Query projects separately
        const { data: projectRows, error: pErr } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds)
          .order("name")
        if (pErr) {
          console.error('[EnhancedSiteVisitForm] Error fetching projects:', pErr)
          throw pErr
        }
        
        return (projectRows || []).map((p: any) => ({ id: p.id, name: p.name || p.id }))
      }

      if (userScope?.role === "admin" || userScope?.patchIds === null) {
        if (organiserId) {
          const { data: orgPatches, error } = await supabase
            .from("organiser_patch_assignments")
            .select("patch_id")
            .is("effective_to", null)
            .eq("organiser_id", organiserId)
          if (error) {
            console.error('[EnhancedSiteVisitForm] Error fetching organiser patches:', error)
            throw error
          }
          const patchIds = Array.from(new Set(orgPatches?.map((r: any) => r.patch_id).filter(Boolean) || []))
          return await projectsFromPatches(patchIds)
        }
        const { data, error } = await supabase.from("projects").select("id,name").order("name")
        if (error) {
          console.error('[EnhancedSiteVisitForm] Error fetching all projects:', error)
          throw error
        }
        return data || []
      }

      if (userScope?.role === "lead_organiser") {
        if (organiserId) {
          const { data: orgPatches, error } = await supabase
            .from("organiser_patch_assignments")
            .select("patch_id")
            .is("effective_to", null)
            .eq("organiser_id", organiserId)
          if (error) {
            console.error('[EnhancedSiteVisitForm] Error fetching organiser patches:', error)
            throw error
          }
          const patchIds = Array.from(new Set(orgPatches?.map((r: any) => r.patch_id).filter(Boolean) || []))
          return await projectsFromPatches(patchIds)
        }
        const patchIds = userScope?.patchIds || []
        return await projectsFromPatches(patchIds)
      }

      // Organiser role
      const patchIds = userScope?.patchIds || []
      if (patchIds.length === 0) {
        console.warn('[EnhancedSiteVisitForm] Organiser has no patch assignments')
        return []
      }
      return await projectsFromPatches(patchIds)
    },
    enabled: !!userScope
  })
  
  // Log project loading errors for debugging
  useEffect(() => {
    if (projectsError) {
      console.error('[EnhancedSiteVisitForm] Projects query error:', projectsError)
    }
  }, [projectsError])

  // Fetch sites for selected project
  const { data: sites = [] } = useQuery({
    queryKey: ["sv-sites", projectId, userScope?.role, (userScope?.patchIds || []).join(",")],
    queryFn: async () => {
      if (!projectId) return []
      
      if (userScope?.role === "admin" || userScope?.patchIds === null) {
        const { data, error } = await supabase
          .from("job_sites")
          .select("id,name,full_address,location,latitude,longitude")
          .eq("project_id", projectId)
          .order("name")
        if (error) throw error
        return data || []
      }
      
      const patchIds = userScope?.patchIds || []
      if (patchIds.length === 0) return []
      
      const { data: patchSites, error: psErr } = await supabase
        .from("v_patch_sites_current")
        .select("job_site_id, patch_id")
        .in("patch_id", patchIds)
      if (psErr) throw psErr
      
      const allowedSiteIds = new Set(patchSites?.map((r: any) => r.job_site_id) || [])
      const { data: projSites, error } = await supabase
        .from("job_sites")
        .select("id,name,full_address,location,latitude,longitude")
        .eq("project_id", projectId)
        .order("name")
      if (error) throw error
      return projSites?.filter((s: any) => allowedSiteIds.has(s.id)) || []
    },
    enabled: !!projectId
  })

  // Fetch employers at selected site
  const { data: siteEmployers = [] } = useQuery({
    queryKey: ["sv-site-employers", siteId],
    queryFn: async () => {
      if (!siteId) return []
      const { data, error } = await supabase
        .from("site_contractor_trades")
        .select("employer_id, employers(id,name)")
        .eq("job_site_id", siteId)
      if (error) throw error
      
      const map: Record<string, { id: string; name: string }> = {}
      data?.forEach((row: any) => {
        const e = row.employers
        if (e?.id) map[e.id] = { id: e.id, name: e.name || e.id }
      })
      return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
    },
    enabled: !!siteId && !isEditing
  })

  // Fetch visit reason definitions
  const { data: reasonDefinitions = [] } = useSiteVisitReasonDefinitions(organiserId || undefined)

  // Fetch site contacts for selected site
  const { data: siteContacts = [] } = useQuery({
    queryKey: ["site-visit-contacts", siteId],
    queryFn: async () => {
      if (!siteId) return []
      const { data, error } = await supabase
        .from("site_contacts")
        .select("id, name, role, phone, email")
        .eq("job_site_id", siteId)
      if (error) throw error
      return data || []
    },
    enabled: !!siteId
  })

  // Auto-select single site if only one available
  useEffect(() => {
    if (!isEditing && projectId && Array.isArray(sites) && sites.length === 1 && !siteId) {
      setSiteId(sites[0].id)
    }
  }, [isEditing, projectId, sites, siteId])

  // Set organiser ID for organiser role automatically
  useEffect(() => {
    if (userScope?.role === "organiser" && userScope?.userId) {
      setOrganiserId(userScope.userId)
    }
  }, [userScope])

  // Split reasons into always visible and others
  const alwaysVisibleReasons = useMemo(
    () => reasonDefinitions.filter(r => r.always_visible),
    [reasonDefinitions]
  )
  const otherReasons = useMemo(
    () => reasonDefinitions.filter(r => !r.always_visible),
    [reasonDefinitions]
  )

  const selectedSite = useMemo(() => sites.find((s: any) => s.id === siteId) || null, [sites, siteId])

  // Validation: Check if selected site belongs to selected project
  const isSiteValidForProject = useMemo(() => {
    if (!projectId || !siteId) return true // No validation needed if both not selected
    const site = sites.find((s: any) => s.id === siteId)
    return site !== undefined // Site should be in the filtered list for this project
  }, [projectId, siteId, sites])

  // Save disabled conditions
  const saveDisabled = useMemo(() => {
    if (!visitDate || !projectId || !siteId) return true
    if (!organiserId && userScope?.role !== "organiser") return true
    if (!isSiteValidForProject) return true
    return false
  }, [visitDate, projectId, siteId, organiserId, userScope?.role, isSiteValidForProject])

  // Toggle visit reason
  const toggleReason = (reasonId: string) => {
    setSelectedReasonIds(prev => {
      const next = new Set(prev)
      if (next.has(reasonId)) {
        next.delete(reasonId)
        setReasonNotes(notes => {
          const { [reasonId]: _, ...rest } = notes
          return rest
        })
      } else {
        next.add(reasonId)
      }
      return next
    })
  }

  // Add follow-up action
  const addFollowUpAction = () => {
    if (!newFollowUpDescription.trim()) return
    
    setFollowUpActions(prev => [
      ...prev,
      {
        description: newFollowUpDescription.trim(),
        follow_up_type: "checklist_item",
        due_date: newFollowUpDueDate || undefined,
      }
    ])
    setNewFollowUpDescription("")
    setNewFollowUpDueDate("")
  }

  // Remove follow-up action
  const removeFollowUpAction = (index: number) => {
    setFollowUpActions(prev => prev.filter((_, i) => i !== index))
  }

  // Generate calendar event (iOS-optimized)
  const generateCalendarEvent = (action: FollowUpAction) => {
    const project = projects.find((p: any) => p.id === projectId)
    
    ios.addToCalendar({
      title: `Follow-up: ${action.description}`,
      startDate: action.due_date || visitDate,
      notes: `Site visit follow-up action\nProject: ${project?.name || 'Unknown'}\nSite: ${selectedSite?.name || 'Unknown'}`,
      location: selectedSite?.full_address || selectedSite?.location || undefined,
      allDay: true,
    })
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (status: "draft" | "completed") => {
      const userId = userScope?.userId
      
      // Base visit payload
      const visitPayload = {
        date: visitDate,
        organiser_id: organiserId,
        project_id: projectId,
        job_site_id: siteId,
        notes: notes || null,
        visit_status: status,
        created_by: userId,
        updated_by: userId,
      }

      let visitId: string

      if (isEditing && initial?.id) {
        // Update existing visit
        const { error } = await supabase
          .from("site_visit")
          .update({ ...visitPayload, updated_by: userId })
          .eq("id", initial.id)
        if (error) throw error
        visitId = initial.id
      } else {
        // Create new visit(s) - one per employer or one without employer
        const employerIds = selectedEmployerIds.filter(Boolean)
        const rows = employerIds.length > 0
          ? employerIds.map(eid => ({ ...visitPayload, employer_id: eid }))
          : [{ ...visitPayload, employer_id: null }]

        const { data, error } = await supabase
          .from("site_visit")
          .insert(rows)
          .select("id")
        if (error) throw error
        visitId = data[0].id
      }

      // Save visit reasons
      if (selectedReasonIds.size > 0) {
        const reasonRows = Array.from(selectedReasonIds).map(reasonId => ({
          visit_id: visitId,
          reason_definition_id: reasonId,
          notes: reasonNotes[reasonId] || null,
        }))

        // Delete existing reasons if editing
        if (isEditing) {
          await supabase
            .from("site_visit_reasons")
            .delete()
            .eq("visit_id", visitId)
        }

        const { error: reasonError } = await supabase
          .from("site_visit_reasons")
          .insert(reasonRows)
        if (reasonError) throw reasonError
      }

      // Save follow-up actions
      if (followUpActions.length > 0) {
        const followUpRows = followUpActions.map(action => ({
          visit_id: visitId,
          description: action.description,
          follow_up_type: action.follow_up_type,
          due_date: action.due_date || null,
          linked_activity_id: action.linked_activity_id || null,
          is_completed: action.is_completed || false,
        }))

        // Delete existing follow-ups if editing
        if (isEditing) {
          await supabase
            .from("site_visit_follow_ups")
            .delete()
            .eq("visit_id", visitId)
        }

        const { error: followUpError } = await supabase
          .from("site_visit_follow_ups")
          .insert(followUpRows)
        if (followUpError) throw followUpError
      }
    },
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ["site-visits"] })
      qc.invalidateQueries({ queryKey: ["project-last-visit"] })
      qc.invalidateQueries({ queryKey: ["v_project_visit_frequency"] })
      toast.success(status === "draft" ? "Draft saved" : "Site visit recorded successfully")
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`)
    }
  })

  const allEmployersSelected = useMemo(() => {
    if (siteEmployers.length === 0) return false
    return selectedEmployerIds.length === siteEmployers.length
  }, [siteEmployers, selectedEmployerIds])

  const toggleSelectAllEmployers = (checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectedEmployerIds(siteEmployers.map((e: any) => e.id))
    } else {
      setSelectedEmployerIds([])
    }
  }

  const toggleEmployer = (employerId: string, checked: boolean | "indeterminate") => {
    setSelectedEmployerIds(prev => {
      const set = new Set(prev)
      if (checked) set.add(employerId)
      else set.delete(employerId)
      return Array.from(set)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Site Visit" : "Record Site Visit"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Basic Info Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Visit Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Date *</Label>
                    <DateInput value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                  </div>
                  {(userScope?.role === "admin" || userScope?.role === "lead_organiser") && (
                    <div>
                      <Label>Organiser</Label>
                      <Select value={organiserId || undefined} onValueChange={(v: string) => setOrganiserId(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organiser" />
                        </SelectTrigger>
                        <SelectContent>
                          {organisers.map((o: any) => (
                            <SelectItem key={o.id} value={o.id}>{o.full_name || o.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Project *</Label>
                    <Select 
                      value={projectId || undefined} 
                      onValueChange={(v: string) => { 
                        setProjectId(v)
                        setSiteId(null)
                        setSelectedEmployerIds([])
                      }}
                      disabled={projectsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={projectsLoading ? "Loading projects..." : projectsError ? "Error loading projects" : "Select project"} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.length === 0 && !projectsLoading && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {userScope?.role === "organiser" && userScope?.patchIds?.length === 0
                              ? "No patches assigned. Contact your lead organiser."
                              : "No projects available"}
                          </div>
                        )}
                        {projects.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {projectsError && (
                      <p className="text-sm text-red-600 mt-1">
                        Failed to load projects. Please refresh the page.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Site *</Label>
                    <Select 
                      value={siteId || undefined} 
                      onValueChange={(v: string) => { 
                        setSiteId(v)
                        setSelectedEmployerIds([])
                      }} 
                      disabled={!projectId}
                    >
                      <SelectTrigger className={!isSiteValidForProject ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isSiteValidForProject && (
                      <p className="text-sm text-red-600 mt-1">
                        Selected site does not belong to this project
                      </p>
                    )}
                  </div>
                </div>

                {selectedSite && (
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <div>
                        <div className="font-medium">{selectedSite.name}</div>
                        <div>{selectedSite.full_address || selectedSite.location || ""}</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employers Section */}
            {!isEditing && siteId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Employers at Site</CardTitle>
                </CardHeader>
                <CardContent>
                  {siteEmployers.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          checked={allEmployersSelected} 
                          onCheckedChange={toggleSelectAllEmployers} 
                          id="select-all-employers" 
                        />
                        <label htmlFor="select-all-employers" className="text-sm font-medium">
                          Select all
                        </label>
                      </div>
                      <div className="max-h-32 overflow-auto border rounded p-2 space-y-2">
                        {siteEmployers.map((e: any) => (
                          <div key={e.id} className="flex items-center gap-2">
                            <Checkbox 
                              checked={selectedEmployerIds.includes(e.id)} 
                              onCheckedChange={(checked) => toggleEmployer(e.id, checked)} 
                              id={`emp-${e.id}`} 
                            />
                            <label htmlFor={`emp-${e.id}`} className="text-sm">{e.name}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No employers linked to this site.</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Visit Reasons Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Visit Reasons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Always visible reasons */}
                <div className="space-y-2">
                  {alwaysVisibleReasons.map(reason => (
                    <div key={reason.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedReasonIds.has(reason.id)}
                          onCheckedChange={() => toggleReason(reason.id)}
                          id={`reason-${reason.id}`}
                        />
                        <label htmlFor={`reason-${reason.id}`} className="text-sm font-medium">
                          {reason.display_name}
                        </label>
                        {!reason.is_global && (
                          <Badge variant="secondary" className="text-xs">Custom</Badge>
                        )}
                      </div>
                      {selectedReasonIds.has(reason.id) && (
                        <Textarea
                          placeholder={`Notes for ${reason.display_name}...`}
                          value={reasonNotes[reason.id] || ""}
                          onChange={(e) => setReasonNotes(prev => ({ ...prev, [reason.id]: e.target.value }))}
                          className="ml-6 min-h-[60px]"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Other reasons (collapsible) */}
                {otherReasons.length > 0 && (
                  <Collapsible open={showMoreReasons} onOpenChange={setShowMoreReasons}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <ChevronDown className={`h-4 w-4 transition-transform ${showMoreReasons ? 'rotate-180' : ''}`} />
                      Show more reasons ({otherReasons.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-2">
                      {otherReasons.map(reason => (
                        <div key={reason.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedReasonIds.has(reason.id)}
                              onCheckedChange={() => toggleReason(reason.id)}
                              id={`reason-${reason.id}`}
                            />
                            <label htmlFor={`reason-${reason.id}`} className="text-sm font-medium">
                              {reason.display_name}
                            </label>
                            {!reason.is_global && (
                              <Badge variant="secondary" className="text-xs">Custom</Badge>
                            )}
                          </div>
                          {selectedReasonIds.has(reason.id) && (
                            <Textarea
                              placeholder={`Notes for ${reason.display_name}...`}
                              value={reasonNotes[reason.id] || ""}
                              onChange={(e) => setReasonNotes(prev => ({ ...prev, [reason.id]: e.target.value }))}
                              className="ml-6 min-h-[60px]"
                            />
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>

            {/* Notes Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">General Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="General notes about the visit..."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>

            {/* Follow-up Actions Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Follow-up Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {followUpActions.map((action, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 border rounded-md">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{action.description}</div>
                      {action.due_date && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Due: {new Date(action.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {action.due_date && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => generateCalendarEvent(action)}
                          title="Add to calendar"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFollowUpAction(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Follow-up action description..."
                      value={newFollowUpDescription}
                      onChange={(e) => setNewFollowUpDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          addFollowUpAction()
                        }
                      }}
                    />
                    <Input
                      type="date"
                      value={newFollowUpDueDate}
                      onChange={(e) => setNewFollowUpDueDate(e.target.value)}
                      className="w-40"
                      placeholder="Due date"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addFollowUpAction}
                      disabled={!newFollowUpDescription.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add follow-up actions with optional due dates. Press Enter to add.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Context-Aware Actions */}
            {projectId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Navigation actions */}
                  <div className="flex flex-wrap gap-2">
                    {selectedSite && (selectedSite.latitude && selectedSite.longitude) && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          ios.getDirections({
                            latitude: selectedSite.latitude,
                            longitude: selectedSite.longitude,
                            address: selectedSite.full_address || selectedSite.location,
                            placeName: selectedSite.name,
                          })
                        }}
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Get Directions
                      </Button>
                    )}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        router.push(`/projects/${projectId}?tab=mappingsheets`)
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Mapping Sheet
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        router.push(`/projects/${projectId}?tab=audit-compliance`)
                      }}
                    >
                      <FileCheck className="h-4 w-4 mr-2" />
                      Compliance
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        router.push(`/projects/${projectId}?tab=eba-search`)
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      EBA Search
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                  </div>

                  {/* Site Contacts */}
                  {siteContacts.length > 0 && (
                    <div className="pt-2 border-t">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Site Contacts ({siteContacts.length})
                      </h4>
                      <div className="space-y-3">
                        {siteContacts.map((contact: any) => (
                          <div key={contact.id} className="p-3 bg-muted rounded-md">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="font-medium text-sm">{contact.name}</div>
                                <div className="text-xs text-muted-foreground capitalize">
                                  {contact.role.replace(/_/g, ' ')}
                                </div>
                              </div>
                            </div>
                            <ContactCardActions
                              contact={{
                                name: contact.name,
                                role: contact.role,
                                organization: projects.find((p: any) => p.id === projectId)?.name || "Project",
                                phone: contact.phone,
                                email: contact.email,
                                address: selectedSite?.full_address || selectedSite?.location || null,
                              }}
                              projectName={projects.find((p: any) => p.id === projectId)?.name}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-between items-center gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsSavingDraft(true)
                saveMutation.mutate("draft")
              }}
              disabled={saveDisabled || saveMutation.isPending}
            >
              {isSavingDraft && saveMutation.isPending ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={() => {
                setIsSavingDraft(false)
                saveMutation.mutate("completed")
              }}
              disabled={saveDisabled || saveMutation.isPending}
            >
              {!isSavingDraft && saveMutation.isPending ? "Saving..." : "Complete Visit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

