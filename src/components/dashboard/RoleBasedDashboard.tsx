"use client"
import { useAuth } from "@/hooks/useAuth"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Users, 
  Crown, 
  Map, 
  AlertTriangle,
  FolderOpen,
  BarChart3,
  RefreshCw
} from "lucide-react"
import { DashboardFiltersBar, DashboardFilters } from "./DashboardFiltersBar"
import { PatchSummaryCard, PatchSummaryCardSkeleton } from "./PatchSummaryCard"
import { LeadOrganizerSummaryCard, LeadOrganizerSummaryCardSkeleton } from "./LeadOrganizerSummaryCard"
import { OrganizingUniverseMetricsComponent } from "./OrganizingUniverseMetrics"
import { FilterIndicatorBadge } from "./FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { usePatchSummaryData } from "@/hooks/usePatchSummaryData"
import { useLeadOrganizerSummary, useAllLeadOrganizerSummaries } from "@/hooks/useLeadOrganizerSummary"
import { useOrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import { useOrganizingUniverseMetricsServerSideCompatible } from "@/hooks/useOrganizingUniverseMetricsServerSide"
import { usePatchSummariesServerSide } from "@/hooks/usePatchSummaryDataServerSide"

interface RoleBasedDashboardProps {
  className?: string
}

/**
 * Role-based dashboard component that shows different views based on user role:
 * - Organiser: Shows patch summary cards for their assigned patches
 * - Co-ordinator: Shows expandable summary for their lead patches
 * - Admin: Shows overview of all co-ordinators with expandable patch details
 */
export function RoleBasedDashboard({ className }: RoleBasedDashboardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [filters, setFilters] = useState<DashboardFilters>({})
  const { hasActiveFilters, activeFilters } = useActiveFilters()

  // Feature flag for server-side processing
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_DASHBOARD === 'true'

  // Get user role and assignments
  const { data: userProfile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ["user-profile", user?.id],
    enabled: !!user?.id,
    staleTime: 60000,
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, role, full_name, email")
        .eq("id", user!.id)
        .single()

      if (error) throw error
      return profile
    }
  })

  // Memoized filter object for organizing universe metrics
  const metricsFilters = useMemo(() => ({
    tier: filters.tier !== "all" ? filters.tier : undefined,
    stage: filters.stage !== "all" ? filters.stage : undefined,
    universe: filters.universe !== "all" ? filters.universe : undefined,
    eba: filters.eba !== "all" ? filters.eba : undefined,
    userId: user?.id,
    userRole: userProfile?.role
  }), [filters, user?.id, userProfile?.role])

  // Navigation handlers
  const handleOpenPatch = (patchId: string) => {
    router.push(`/patch?patch=${patchId}`)
  }

  const handleOpenProjects = (leadId?: string, patchId?: string) => {
    const params = new URLSearchParams()
    if (patchId) params.set('patch', patchId)
    if (leadId) params.set('lead', leadId)
    
    // Preserve current filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") {
        params.set(key, value)
      }
    })
    
    router.push(`/projects?${params.toString()}`)
  }

  if (profileLoading) {
    return (
      <div className={className}>
        <div className="space-y-6">
          <div className="h-16 bg-gray-100 rounded animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <PatchSummaryCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (profileError || !userProfile) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load user profile. Please refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  

  // Render appropriate dashboard based on user role
  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Filters */}
        <DashboardFiltersBar
          onFiltersChange={setFilters}
          showSearch={false}
          compact={true}
        />

        {/* Role-specific dashboard content */}
        {userProfile.role === "organiser" && (
          <OrganiserDashboard 
            userId={userProfile.id} 
            filters={metricsFilters}
            onOpenPatch={handleOpenPatch}
            onOpenProjects={handleOpenProjects}
          />
        )}

        {userProfile.role === "lead_organiser" && (
          <LeadOrganiserDashboard 
            leadId={userProfile.id}
            filters={metricsFilters}
            onOpenPatch={handleOpenPatch}
            onOpenProjects={handleOpenProjects}
          />
        )}

        {userProfile.role === "admin" && (
          <AdminDashboard 
            filters={metricsFilters}
            onOpenPatch={handleOpenPatch}
            onOpenProjects={handleOpenProjects}
          />
        )}

        {!["organiser", "lead_organiser", "admin"].includes(userProfile.role ?? "") && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your role ({userProfile.role}) does not have access to advanced dashboard features.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

/**
 * Dashboard view for organisers - shows their assigned patch summary cards
 */
function OrganiserDashboard({ 
  userId, 
  filters, 
  onOpenPatch, 
  onOpenProjects 
}: {
  userId: string
  filters: any
  onOpenPatch: (patchId: string) => void
  onOpenProjects: (leadId?: string, patchId?: string) => void
}) {
  // Get patches assigned to this organiser
  const { data: patches, isLoading: patchesLoading } = useQuery({
    queryKey: ["organiser-patches", userId],
    enabled: !!userId,
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organiser_patch_assignments")
        .select(`
          patch_id,
          patches:patch_id(id, name)
        `)
        .eq("organiser_id", userId)
        .is("effective_to", null)

      if (error) throw error
      return data || []
    }
  })

  if (patchesLoading || !patches) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Your Patches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <PatchSummaryCardSkeleton key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (patches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Your Patches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Map className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No patches assigned to you yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Contact your lead organiser to get patch assignments.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Your Patches
            </CardTitle>
            <Badge variant="outline" className="text-sm">
              {patches.length} patch{patches.length !== 1 ? 'es' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patches.map((patch: any) => (
              <OrganiserPatchCard
                key={patch.patch_id}
                patchId={patch.patch_id}
                filters={filters}
                onOpenPatch={onOpenPatch}
                onOpenProjects={onOpenProjects}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Individual patch card for organisers with real-time metrics
 */
function OrganiserPatchCard({ 
  patchId, 
  filters, 
  onOpenPatch, 
  onOpenProjects 
}: {
  patchId: string
  filters: any
  onOpenPatch: (patchId: string) => void
  onOpenProjects: (leadId?: string, patchId?: string) => void
}) {
  // Feature flag for server-side processing
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_DASHBOARD === 'true'
  
  // CLIENT-SIDE (Original)
  const { data: patchSummary, isLoading: clientLoading } = usePatchSummaryData(patchId)
  const { data: clientMetrics } = useOrganizingUniverseMetrics({
    ...filters,
    patchIds: [patchId]
  })
  
  // SERVER-SIDE (Optimized)
  const { data: serverData, isLoading: serverLoading } = usePatchSummariesServerSide(filters)
  const serverPatchSummary = (serverData as any)?.summaries?.find((s: any) => s.patchId === patchId)
  
  // Use appropriate data based on feature flag
  const isLoading = USE_SERVER_SIDE ? serverLoading : clientLoading
  const metrics = USE_SERVER_SIDE ? (serverPatchSummary ? {
    ebaProjectsPercentage: serverPatchSummary.ebaProjectsPercentage,
    ebaProjectsCount: serverPatchSummary.ebaProjectsCount,
    totalActiveProjects: serverPatchSummary.projectCount,
    knownBuilderPercentage: serverPatchSummary.knownBuilderPercentage,
    knownBuilderCount: serverPatchSummary.knownBuilderCount,
    keyContractorCoveragePercentage: serverPatchSummary.keyContractorCoverage,
    mappedKeyContractors: 0,
    totalKeyContractorSlots: 0,
    keyContractorEbaBuilderPercentage: 0,
    keyContractorsOnEbaBuilderProjects: 0,
    totalKeyContractorsOnEbaBuilderProjects: 0,
    keyContractorEbaPercentage: serverPatchSummary.keyContractorEbaPercentage,
    keyContractorsWithEba: 0,
    totalMappedKeyContractors: 0
  } : null) : clientMetrics
  
  const finalPatchSummary = USE_SERVER_SIDE ? (serverPatchSummary ? {
    patchId: serverPatchSummary.patchId,
    patchName: serverPatchSummary.patchName,
    organiserNames: serverPatchSummary.organiserNames,
    projectCount: serverPatchSummary.projectCount,
    organizingMetrics: metrics || {
      ebaProjectsPercentage: 0,
      ebaProjectsCount: 0,
      totalActiveProjects: 0,
      knownBuilderPercentage: 0,
      knownBuilderCount: 0,
      keyContractorCoveragePercentage: 0,
      mappedKeyContractors: 0,
      totalKeyContractorSlots: 0,
      keyContractorEbaBuilderPercentage: 0,
      keyContractorsOnEbaBuilderProjects: 0,
      totalKeyContractorsOnEbaBuilderProjects: 0,
      keyContractorEbaPercentage: 0,
      keyContractorsWithEba: 0,
      totalMappedKeyContractors: 0
    },
    lastUpdated: serverPatchSummary.lastUpdated
  } : null) : patchSummary

  if (isLoading || !finalPatchSummary) {
    return <PatchSummaryCardSkeleton />
  }

  return (
    <PatchSummaryCard
      patchSummary={finalPatchSummary}
      onOpenPatch={onOpenPatch}
      onOpenProjects={(patchId) => onOpenProjects(undefined, patchId)}
    />
  )
}

/**
 * Dashboard view for lead organisers - shows their own expandable summary
 */
function LeadOrganiserDashboard({ 
  leadId, 
  filters, 
  onOpenPatch, 
  onOpenProjects 
}: {
  leadId: string
  filters: any
  onOpenPatch: (patchId: string) => void
  onOpenProjects: (leadId?: string, patchId?: string) => void
}) {
  const { data: leadSummary, isLoading } = useLeadOrganizerSummary(leadId)

  if (isLoading || !leadSummary) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Crown className="h-5 w-5 mr-2" />
              Your Co-ordinator Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LeadOrganizerSummaryCardSkeleton />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Crown className="h-5 w-5 mr-2" />
            Your Co-ordinator Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LeadOrganizerSummaryCard
            leadSummary={leadSummary}
            onOpenPatch={onOpenPatch}
            onOpenProjects={onOpenProjects}
            defaultExpanded={true}
          />
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Dashboard view for admins - shows all lead organizer summaries
 */
function AdminDashboard({ 
  filters, 
  onOpenPatch, 
  onOpenProjects 
}: {
  filters: any
  onOpenPatch: (patchId: string) => void
  onOpenProjects: (leadId?: string, patchId?: string) => void
}) {
  const { data: leadSummaries, isLoading } = useAllLeadOrganizerSummaries()

  if (isLoading || !leadSummaries) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              All Co-ordinators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <LeadOrganizerSummaryCardSkeleton key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (leadSummaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            All Co-ordinators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
              <Crown className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No co-ordinators found.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              All Co-ordinators
            </CardTitle>
            <Badge variant="outline" className="text-sm">
              {leadSummaries.length} co-ordinator{leadSummaries.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {leadSummaries.map((leadSummary) => (
              <LeadOrganizerSummaryCard
                key={leadSummary.leadOrganizerId}
                leadSummary={leadSummary}
                onOpenPatch={onOpenPatch}
                onOpenProjects={onOpenProjects}
                defaultExpanded={false}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
