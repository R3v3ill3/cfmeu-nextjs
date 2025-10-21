"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar, User, MapPin, FileText, ChevronRight } from "lucide-react"
import { EnhancedSiteVisitForm } from "./EnhancedSiteVisitForm"
import { format } from "date-fns"

interface ProjectSiteVisitsProps {
  projectId: string
  projectName?: string
  autoCreate?: boolean // If true and no visits exist, auto-open create form
}

export function ProjectSiteVisits({ 
  projectId, 
  projectName,
  autoCreate = false 
}: ProjectSiteVisitsProps) {
  const [createFormOpen, setCreateFormOpen] = useState(false)
  const [editingVisit, setEditingVisit] = useState<any | null>(null)

  // Fetch site visits for this project
  const { data: visits = [], isLoading, refetch } = useQuery({
    queryKey: ["project-site-visits", projectId],
    queryFn: async () => {
      const { data: sites, error: sitesError } = await supabase
        .from("job_sites")
        .select("id")
        .eq("project_id", projectId)
      
      if (sitesError) throw sitesError
      
      const siteIds = sites?.map(s => s.id) || []
      if (siteIds.length === 0) return []

      const { data, error } = await supabase
        .from("site_visit")
        .select(`
          id,
          date,
          notes,
          visit_status,
          job_site_id,
          organiser_id,
          job_sites (
            id,
            name,
            full_address,
            location
          ),
          profiles (
            id,
            full_name
          ),
          site_visit_reasons (
            id,
            site_visit_reason_definitions (
              display_name
            )
          )
        `)
        .in("job_site_id", siteIds)
        .order("date", { ascending: false })
      
      if (error) throw error
      return data || []
    },
    staleTime: 30000, // 30 seconds
  })

  // Auto-open create form if no visits and autoCreate is true
  useEffect(() => {
    if (autoCreate && !isLoading && visits.length === 0) {
      setCreateFormOpen(true)
    }
  }, [autoCreate, isLoading, visits.length])

  const handleCreateNew = () => {
    setEditingVisit(null)
    setCreateFormOpen(true)
  }

  const handleViewVisit = (visit: any) => {
    setEditingVisit({
      id: visit.id,
      date: visit.date,
      organiser_id: visit.organiser_id,
      project_id: projectId,
      job_site_id: visit.job_site_id,
      notes: visit.notes,
      visit_status: visit.visit_status,
    })
    setCreateFormOpen(true)
  }

  const handleCloseForm = () => {
    setCreateFormOpen(false)
    setEditingVisit(null)
    refetch()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading site visits...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Site Visits</h3>
          {projectName && (
            <p className="text-sm text-muted-foreground">{projectName}</p>
          )}
        </div>
        <Button onClick={handleCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Record Site Visit
        </Button>
      </div>

      {/* Visit Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Create New Card - Always first */}
        <Card 
          className="border-dashed border-2 hover:border-primary hover:bg-accent cursor-pointer transition-colors"
          onClick={handleCreateNew}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-medium">Record New Visit</h4>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Document a site visit
            </p>
          </CardContent>
        </Card>

        {/* Existing Visit Cards */}
        {visits.map((visit: any) => {
          const reasons = visit.site_visit_reasons || []
          const reasonNames = reasons
            .map((r: any) => r.site_visit_reason_definitions?.display_name)
            .filter(Boolean)
            .slice(0, 2)

          return (
            <Card 
              key={visit.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleViewVisit(visit)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {format(new Date(visit.date), "dd MMM yyyy")}
                    </span>
                  </div>
                  {visit.visit_status === "draft" && (
                    <Badge variant="secondary">Draft</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Organiser */}
                {visit.profiles && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {visit.profiles.full_name}
                    </span>
                  </div>
                )}

                {/* Site */}
                {visit.job_sites && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {visit.job_sites.name}
                      </div>
                      {(visit.job_sites.full_address || visit.job_sites.location) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {visit.job_sites.full_address || visit.job_sites.location}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reasons */}
                {reasonNames.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {reasonNames.map((name: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                    {reasons.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{reasons.length - 2} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Notes Preview */}
                {visit.notes && (
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="h-3 w-3 text-muted-foreground mt-0.5" />
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {visit.notes}
                    </p>
                  </div>
                )}

                {/* View Details Link */}
                <div className="flex items-center gap-1 text-xs text-primary pt-2">
                  View details
                  <ChevronRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty State */}
      {visits.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">No site visits recorded yet</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Start recording site visits to track your organizing activities
            </p>
            <Button onClick={handleCreateNew}>
              Record First Visit
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Site Visit Form */}
      <EnhancedSiteVisitForm
        open={createFormOpen}
        onOpenChange={handleCloseForm}
        initial={editingVisit || { project_id: projectId }}
      />
    </div>
  )
}


