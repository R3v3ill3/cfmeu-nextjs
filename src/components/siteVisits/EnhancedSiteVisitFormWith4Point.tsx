/**
 * @deprecated This experimental component integrates 4-point assessments with site visits
 * 
 * This was an experimental implementation that combined site visit recording
 * with immediate 4-point compliance assessments. It has been superseded by:
 * - EnhancedSiteVisitForm for site visit recording
 * - Separate assessment flows for compliance tracking
 * 
 * This file is kept for reference only and should not be used in new code.
 * The functionality has been split into:
 * 1. Site visit recording (EnhancedSiteVisitForm)
 * 2. Compliance assessments (separate assessment forms)
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSiteVisitReasonDefinitions } from "@/hooks/useSiteVisitReasons"
import {
  ChevronDown,
  ExternalLink,
  Plus,
  X,
  MapPin,
  FileCheck,
  FileText,
  Calendar,
  Navigation,
  Users,
  Share2,
  Star,
  Shield
} from "lucide-react"
import { useRouter } from "next/navigation"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { ios } from "@/utils/iosIntegrations"
import { ContactCardActions } from "@/components/ui/ContactActions"
import { SiteVisitAssessmentIntegration4Point } from "./SiteVisitAssessmentIntegration4Point"

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

export function EnhancedSiteVisitFormWith4Point({
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

  // Form state
  const [visitDate, setVisitDate] = useState<string>(() => (initial as any)?.date || new Date().toISOString().slice(0, 10))
  const [organiserId, setOrganiserId] = useState<string | null>(initial?.organiser_id || null)
  const [projectId, setProjectId] = useState<string | null>(initial?.project_id || null)
  const [siteId, setSiteId] = useState<string | null>(initial?.job_site_id || null)
  const [employerId, setEmployerId] = useState<string | null>(initial?.employer_id || null)
  const [notes, setNotes] = useState<string>(initial?.notes || "")
  const [actions, setActions] = useState<string>(initial?.actions_taken || "")
  const [selectedEmployerIds, setSelectedEmployerIds] = useState<string[]>(initial?.employer_id ? [initial.employer_id] : [])
  const [visitStatus, setVisitStatus] = useState<string>(initial?.visit_status || "scheduled")

  // 4-Point Assessment state
  const [showAssessments, setShowAssessments] = useState(false)
  const [assessmentData, setAssessmentData] = useState<any[]>([])

  const isEditing = Boolean(initial?.id)

  // Queries
  const { data: organisers } = useQuery({
    queryKey: ["organisers"],
    queryFn: async () => {
      const res = await supabase.from("profiles").select("*").eq("role", "organiser")
      return res.data
    },
  })

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await supabase.from("projects").select("*").order("name")
      return res.data
    },
  })

  const { data: jobSites } = useQuery({
    queryKey: ["job_sites", projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await supabase.from("job_sites").select("*").eq("project_id", projectId)
      return res.data
    },
    enabled: !!projectId,
  })

  const { data: employers } = useQuery({
    queryKey: ["employers"],
    queryFn: async () => {
      const res = await supabase.from("employers").select("*").order("name")
      return res.data
    },
  })

  const { data: reasons } = useSiteVisitReasonDefinitions()

  // Mutations
  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<SiteVisit>) => {
      if (data.id) {
        const { data: result, error } = await supabase
          .from("site_visits")
          .update(data)
          .eq("id", data.id)
          .select()
          .single()
        if (error) throw error
        return result
      } else {
        const { data: result, error } = await supabase
          .from("site_visits")
          .insert(data)
          .select()
          .single()
        if (error) throw error
        return result
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["site_visits"] })
      toast.success(isEditing ? "Site visit updated successfully" : "Site visit created successfully")
      onOpenChange(false)

      // If assessments were created, navigate to view the rating
      if (assessmentData.length > 0 && employerId) {
        router.push(`/employers/${employerId}?tab=ratings&highlight=4point`)
      }
    },
    onError: (error) => {
      toast.error(`Failed to ${isEditing ? "update" : "create"} site visit: ${error.message}`)
    },
  })

  // Form handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const visitData: Partial<SiteVisit> = {
      id: initial?.id,
      date: visitDate,
      organiser_id: organiserId,
      project_id: projectId,
      job_site_id: siteId,
      employer_id: employerId,
      notes: notes || null,
      actions_taken: actions || null,
      visit_status: visitStatus,
    }

    upsertMutation.mutate(visitData)
  }

  const handleAssessmentComplete = (assessmentType: string, data: any) => {
    setAssessmentData(prev => [...prev, { type: assessmentType, data }])
  }

  const getEmployerName = () => {
    if (!employerId || !employers) return ""
    const employer = employers.find(e => e.id === employerId)
    return employer?.name || ""
  }

  const canShowAssessments = () => {
    return employerId && projectId && getEmployerName()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {isEditing ? "Edit Site Visit" : "New Site Visit"}
            {assessmentData.length > 0 && (
              <Badge className="bg-blue-500 ml-2">
                <Star className="h-3 w-3 mr-1" />
                {assessmentData.length} Assessment{assessmentData.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <div className="p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Visit Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Visit Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Visit Date</Label>
                      <DateInput
                        value={visitDate}
                        onChange={setVisitDate}
                        placeholder="Select date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Visit Status</Label>
                      <Select value={visitStatus} onValueChange={setVisitStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="rescheduled">Rescheduled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="organiser">Organiser</Label>
                      <Select value={organiserId || ""} onValueChange={setOrganiserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organiser" />
                        </SelectTrigger>
                        <SelectContent>
                          {organisers?.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project">Project</Label>
                      <Select value={projectId || ""} onValueChange={(value) => {
                        setProjectId(value)
                        setSiteId(null) // Reset site when project changes
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects?.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {projectId && (
                    <div className="space-y-2">
                      <Label htmlFor="site">Job Site</Label>
                      <Select value={siteId || ""} onValueChange={setSiteId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job site" />
                        </SelectTrigger>
                        <SelectContent>
                          {jobSites?.map((site) => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="employer">Employer</Label>
                    <Select value={employerId || ""} onValueChange={setEmployerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employer" />
                      </SelectTrigger>
                      <SelectContent>
                        {employers?.map((employer) => (
                          <SelectItem key={employer.id} value={employer.id}>
                            {employer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* 4-Point Assessment Integration */}
              {canShowAssessments() && (
                <Collapsible open={showAssessments} onOpenChange={setShowAssessments}>
                  <CollapsibleTrigger asChild>
                    <Card className="cursor-pointer">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            4-Point Assessments
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {assessmentData.length > 0 && (
                              <Badge className="bg-blue-500" variant="secondary">
                                {assessmentData.length} Complete
                              </Badge>
                            )}
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Complete Union Respect, Safety, and Subcontractor assessments during your visit
                        </p>
                      </CardHeader>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SiteVisitAssessmentIntegration4Point
                      employerId={employerId!}
                      employerName={getEmployerName()}
                      projectId={projectId!}
                      siteVisitId={initial?.id}
                      visitDate={visitDate}
                      onAssessmentComplete={handleAssessmentComplete}
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Notes and Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Visit Notes & Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Visit Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Describe observations, conversations, and key findings from the visit..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actions">Actions Taken</Label>
                    <Textarea
                      id="actions"
                      value={actions}
                      onChange={(e) => setActions(e.target.value)}
                      placeholder="List any immediate actions taken or follow-up items identified..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Form Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={upsertMutation.isPending}
                >
                  {upsertMutation.isPending ? "Saving..." : isEditing ? "Update Visit" : "Create Visit"}
                </Button>
              </div>
            </form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}