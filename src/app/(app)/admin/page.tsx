"use client"
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense, lazy } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import RoleGuard from "@/components/guards/RoleGuard"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { useUserRole } from "@/hooks/useUserRole"
import { useIsMobile } from "@/hooks/use-mobile"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Users, ShieldCheck, Map, Database, Navigation, Activity } from "lucide-react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

// Lazy load heavy components - only loaded when tab is active
const PendingUsersTable = lazy(() => import("@/components/admin/PendingUsersTable").then(m => ({ default: m.PendingUsersTable })))
const InviteUserDialog = lazy(() => import("@/components/admin/InviteUserDialog").then(m => ({ default: m.InviteUserDialog })))
const AddDraftUserDialog = lazy(() => import("@/components/admin/AddDraftUserDialog").then(m => ({ default: m.AddDraftUserDialog })))
const PendingProjectsTable = lazy(() => import("@/components/admin/PendingProjectsTable").then(m => ({ default: m.PendingProjectsTable })))
const PendingEmployersTable = lazy(() => import("@/components/admin/PendingEmployersTable").then(m => ({ default: m.PendingEmployersTable })))
const PendingEmployerDuplicateDetector = lazy(() => import("@/components/admin/PendingEmployerDuplicateDetector").then(m => ({ default: m.PendingEmployerDuplicateDetector })))
const PendingProjectDuplicateDetector = lazy(() => import("@/components/admin/PendingProjectDuplicateDetector").then(m => ({ default: m.PendingProjectDuplicateDetector })))
const UsersTable = lazy(() => import("@/components/admin/UsersTable"))
const RoleHierarchyManager = lazy(() => import("@/components/admin/RoleHierarchyManager").then(m => ({ default: m.RoleHierarchyManager })))
const OrganiserScopeManager = lazy(() => import("@/components/admin/OrganiserScopeManager").then(m => ({ default: m.OrganiserScopeManager })))
const PatchManager = lazy(() => import("@/components/admin/PatchManager"))
const SpatialAssignmentTool = lazy(() => import("@/components/admin/SpatialAssignmentTool"))
const AddressLookupDialog = lazy(() => import("@/components/AddressLookupDialog"))
const DuplicateEmployerManager = lazy(() => import("@/components/admin/DuplicateEmployerManager"))
const DataUploadTab = lazy(() => import("@/components/admin/DataUploadTab"))
const BatchesManagement = lazy(() => import("@/components/admin/BatchesManagement").then(m => ({ default: m.BatchesManagement })))
const NavigationVisibilityManager = lazy(() => import("@/components/admin/NavigationVisibilityManager").then(m => ({ default: m.NavigationVisibilityManager })))
const SystemHealthDashboard = lazy(() => import("@/components/admin/SystemHealthDashboard").then(m => ({ default: m.SystemHealthDashboard })))
const CanonicalPromotionConsole = lazy(() => import("@/components/admin/CanonicalPromotionConsole"))
const AliasAnalyticsDashboard = lazy(() => import("@/components/admin/AliasAnalyticsDashboard"))

// Loading fallback component
function TabLoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [addDraftOpen, setAddDraftOpen] = useState(false)
  const [lookupOpen, setLookupOpen] = useState(false)
  const { user } = useAuth()
  const { role: userRole } = useUserRole()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()

  // Get user role
  useEffect(() => {
    // Invalidate pending items if auth context changes (e.g. sign-out while on page)
    if (!user) {
      setPendingProjects([])
      setPendingEmployers([])
    }
  }, [user])

  // Fetch users for hierarchy manager
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .order("full_name")
      if (error) throw error
      return data || []
    },
    enabled: !!user
  })

  // Determine available tabs based on role
  const isAdmin = userRole === "admin"
  const isLeadOrganiser = userRole === "lead_organiser"
  const defaultParentTab = isAdmin ? "user-management" : "user-management"
  const [parentTab, setParentTab] = useState<string>(defaultParentTab)

  const tabParam = searchParams?.get("tab")

  useEffect(() => {
    if (tabParam) {
      // Map old tab values to new parent structure
      const tabMapping: { [key: string]: string } = {
        'users': 'user-management',
        'invites': 'user-management',
        'hierarchy': 'user-management',
        'pending': 'data-integrity',
        'alias-analytics': 'data-integrity',
        'canonical-names': 'data-integrity',
        'patches': 'patch-management',
        'spatial': 'patch-management',
        'scoping': 'patch-management',
        'data-management': 'data-management',
        'navigation': 'navigation',
        'system-health': 'system-health',
      }

      const mapped = tabMapping[tabParam]
      if (mapped) {
        setParentTab(mapped)
      }
    } else {
      setParentTab(defaultParentTab)
    }
  }, [tabParam, defaultParentTab])

  // Pending approvals state
  const [pendingProjects, setPendingProjects] = useState<any[]>([])
  const [pendingEmployers, setPendingEmployers] = useState<any[]>([])
  const [isLoadingPending, setIsLoadingPending] = useState(false)

  const fetchPendingItems = async () => {
    setIsLoadingPending(true)
    try {
      console.log('[AdminPage] Fetching pending items...')
      
      // Add cache-busting query parameter to prevent stale data
      const timestamp = Date.now()
      const response = await fetch(`/api/admin/pending-items?_=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('[AdminPage] Pending items fetched:', {
          projects: data.projects?.length || 0,
          employers: data.employers?.length || 0,
        })
        setPendingProjects(data.projects || [])
        setPendingEmployers(data.employers || [])
      } else {
        console.error('[AdminPage] Failed to fetch pending items:', response.status)
      }
    } catch (error) {
      console.error('[AdminPage] Error fetching pending items:', error)
    } finally {
      setIsLoadingPending(false)
    }
  }

  useEffect(() => {
    if (user && (isAdmin || isLeadOrganiser)) {
      fetchPendingItems()
    }
  }, [user, isAdmin, isLeadOrganiser])

  const handleApproveProject = async (projectId: string, notes?: string) => {
    try {
      const response = await fetch('/api/admin/approve-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, notes }),
      })
      if (response.ok) {
        toast.success('Project approved')
        await fetchPendingItems()
      } else {
        toast.error('Failed to approve project')
      }
    } catch (error) {
      console.error('Error approving project:', error)
      toast.error('Failed to approve project')
    }
  }

  const handleRejectProject = async (projectId: string, reason: string) => {
    try {
      const response = await fetch('/api/admin/reject-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, reason }),
      })
      if (response.ok) {
        toast.success('Project rejected')
        await fetchPendingItems()
      } else {
        toast.error('Failed to reject project')
      }
    } catch (error) {
      console.error('Error rejecting project:', error)
      toast.error('Failed to reject project')
    }
  }

  const handleApproveEmployer = async (employerId: string, notes?: string) => {
    try {
      const response = await fetch('/api/admin/approve-employer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employerId, notes }),
      })
      if (response.ok) {
        toast.success('Employer approved')
        await fetchPendingItems()
      } else {
        toast.error('Failed to approve employer')
      }
    } catch (error) {
      console.error('Error approving employer:', error)
      toast.error('Failed to approve employer')
    }
  }

  const handleRejectEmployer = async (employerId: string, reason: string) => {
    try {
      const response = await fetch('/api/admin/reject-employer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employerId, reason }),
      })
      if (response.ok) {
        toast.success('Employer rejected')
        await fetchPendingItems()
      } else {
        toast.error('Failed to reject employer')
      }
    } catch (error) {
      console.error('Error rejecting employer:', error)
      toast.error('Failed to reject employer')
    }
  }

  const totalPendingCount = pendingProjects.length + pendingEmployers.length

  return (
    <RoleGuard allow={["admin", "lead_organiser"]}>
      <div className={`space-y-4 ${isMobile ? 'px-safe py-4 pb-safe-bottom' : 'p-6'}`}>
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
          <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-semibold`}>
            {isAdmin ? "Administration" : "Co-ordinator Management"}
          </h1>
          <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center gap-2'}`}>
            {isAdmin && (
              <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => setLookupOpen(true)} className={isMobile ? "w-full" : ""}>
                Address Lookup
              </Button>
            )}
            <Button onClick={() => setOpen(true)} size={isMobile ? "sm" : "default"} className={isMobile ? "w-full" : ""}>
              Invite User
            </Button>
          </div>
        </div>
        
        {isMobile ? (
          /* Mobile-optimized accordion layout with grouped sections */
          <div className="space-y-3">
            {/* User Management Group */}
            <div className="pt-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                User Management
              </h2>
              <div className="space-y-2">
                {isAdmin && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        Users
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3">
                        <UsersTable />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <Collapsible defaultOpen={!isAdmin}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Invites
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 space-y-3">
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setAddDraftOpen(true)}>
                          Add draft organiser
                        </Button>
                      </div>
                      <PendingUsersTable />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {isAdmin && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        Hierarchy
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3">
                        <RoleHierarchyManager users={users} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </div>

            {/* Data Integrity Group */}
            <div className="pt-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Data Integrity
              </h2>
              <div className="space-y-2">
                {isAdmin && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        Alias Analytics
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3">
                        <AliasAnalyticsDashboard />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {isAdmin && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        Canonical Names
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3">
                        <CanonicalPromotionConsole />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Pending Approvals
                      {totalPendingCount > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {totalPendingCount}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-base font-semibold">
                          Pending Projects ({pendingProjects.length})
                        </h3>

                        {/* Duplicate Detection */}
                        <PendingProjectDuplicateDetector
                          pendingCount={pendingProjects.length}
                          onMergeComplete={fetchPendingItems}
                        />

                        {/* Pending Projects Table */}
                        <PendingProjectsTable
                          projects={pendingProjects}
                          onApprove={handleApproveProject}
                          onReject={handleRejectProject}
                          onRefresh={fetchPendingItems}
                        />
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-base font-semibold">
                          Pending Employers ({pendingEmployers.length})
                        </h3>
                        
                        {/* Duplicate Detection */}
                        <PendingEmployerDuplicateDetector
                          pendingCount={pendingEmployers.length}
                          onMergeComplete={fetchPendingItems}
                        />
                        
                        {/* Enhanced Pending Employers Table */}
                        <PendingEmployersTable
                          employers={pendingEmployers}
                          onRefresh={fetchPendingItems}
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>

            {/* Patch Management Group */}
            <div className="pt-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Patch Management
              </h2>
              <div className="space-y-2">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Patches
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3">
                      <PatchManager />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {isAdmin && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        Spatial Assignment
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3">
                        <SpatialAssignmentTool />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Scoping
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3">
                      <OrganiserScopeManager />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>

            {/* Other Sections */}
            <div className="pt-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Other
              </h2>
              <div className="space-y-2">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Data Management
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 space-y-6">
                      <DataUploadTab />
                      <BatchesManagement />
                      <DuplicateEmployerManager />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {isAdmin && (
                  <>
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          Navigation
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3">
                          <NavigationVisibilityManager />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          System Health
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3">
                          <SystemHealthDashboard />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Desktop layout - grouped tabs with lazy loading */
          <Tabs value={parentTab} onValueChange={setParentTab}>
          <TabsList className="h-auto bg-transparent p-0 gap-2 w-full flex-wrap sm:flex-nowrap border-0">
            <TabsTrigger 
              value="user-management"
              className="flex items-center gap-2 px-4 py-2.5 text-base font-medium rounded-lg border transition-all min-h-[44px] data-[state=inactive]:bg-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-border/60 data-[state=inactive]:hover:bg-muted/30 data-[state=inactive]:hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:border-blue-600 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-600/30 data-[state=active]:ring-2 data-[state=active]:ring-blue-500/20"
            >
              <Users className="h-4 w-4" />
              <span className="whitespace-nowrap">User Management</span>
            </TabsTrigger>
            <TabsTrigger 
              value="data-integrity"
              className="flex items-center gap-2 px-4 py-2.5 text-base font-medium rounded-lg border transition-all min-h-[44px] data-[state=inactive]:bg-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-border/60 data-[state=inactive]:hover:bg-muted/30 data-[state=inactive]:hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:border-blue-600 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-600/30 data-[state=active]:ring-2 data-[state=active]:ring-blue-500/20"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="whitespace-nowrap">Data Integrity</span>
              {totalPendingCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {totalPendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="patch-management"
              className="flex items-center gap-2 px-4 py-2.5 text-base font-medium rounded-lg border transition-all min-h-[44px] data-[state=inactive]:bg-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-border/60 data-[state=inactive]:hover:bg-muted/30 data-[state=inactive]:hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:border-blue-600 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-600/30 data-[state=active]:ring-2 data-[state=active]:ring-blue-500/20"
            >
              <Map className="h-4 w-4" />
              <span className="whitespace-nowrap">Patch Management</span>
            </TabsTrigger>
            <TabsTrigger 
              value="data-management"
              className="flex items-center gap-2 px-4 py-2.5 text-base font-medium rounded-lg border transition-all min-h-[44px] data-[state=inactive]:bg-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-border/60 data-[state=inactive]:hover:bg-muted/30 data-[state=inactive]:hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:border-blue-600 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-600/30 data-[state=active]:ring-2 data-[state=active]:ring-blue-500/20"
            >
              <Database className="h-4 w-4" />
              <span className="whitespace-nowrap">Data Management</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger 
                value="navigation"
                className="flex items-center gap-2 px-4 py-2.5 text-base font-medium rounded-lg border transition-all min-h-[44px] data-[state=inactive]:bg-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-border/60 data-[state=inactive]:hover:bg-muted/30 data-[state=inactive]:hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:border-blue-600 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-600/30 data-[state=active]:ring-2 data-[state=active]:ring-blue-500/20"
              >
                <Navigation className="h-4 w-4" />
                <span className="whitespace-nowrap">Navigation</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger 
                value="system-health"
                className="flex items-center gap-2 px-4 py-2.5 text-base font-medium rounded-lg border transition-all min-h-[44px] data-[state=inactive]:bg-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-border/60 data-[state=inactive]:hover:bg-muted/30 data-[state=inactive]:hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:border-blue-600 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-600/30 data-[state=active]:ring-2 data-[state=active]:ring-blue-500/20"
              >
                <Activity className="h-4 w-4" />
                <span className="whitespace-nowrap">System Health</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* User Management Group */}
          <TabsContent value="user-management" className="space-y-8">
            <Suspense fallback={<TabLoadingState />}>
              {isAdmin && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Users</h3>
                  <UsersTable />
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Invites</h3>
                  <Button variant="outline" onClick={() => setAddDraftOpen(true)}>Add draft organiser</Button>
                </div>
                <PendingUsersTable />
              </div>
              {isAdmin && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Hierarchy</h3>
                  <RoleHierarchyManager users={users} />
                </div>
              )}
            </Suspense>
          </TabsContent>

          {/* Data Integrity Group */}
          <TabsContent value="data-integrity" className="space-y-8">
            <Suspense fallback={<TabLoadingState />}>
              {isAdmin && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Alias Analytics</h3>
                  <AliasAnalyticsDashboard />
                </div>
              )}
              {isAdmin && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Canonical Names</h3>
                  <CanonicalPromotionConsole />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold">Pending Approvals</h3>
                  {totalPendingCount > 0 && (
                    <Badge variant="destructive">
                      {totalPendingCount}
                    </Badge>
                  )}
                </div>
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-base font-semibold">
                      Pending Projects ({pendingProjects.length})
                    </h4>

                    {/* Duplicate Detection */}
                    <PendingProjectDuplicateDetector
                      pendingCount={pendingProjects.length}
                      onMergeComplete={fetchPendingItems}
                    />

                    {/* Pending Projects Table */}
                    <PendingProjectsTable
                      projects={pendingProjects}
                      onApprove={handleApproveProject}
                      onReject={handleRejectProject}
                      onRefresh={fetchPendingItems}
                    />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-base font-semibold">
                      Pending Employers ({pendingEmployers.length})
                    </h4>
                    
                    {/* Duplicate Detection */}
                    <PendingEmployerDuplicateDetector
                      pendingCount={pendingEmployers.length}
                      onMergeComplete={fetchPendingItems}
                    />
                    
                    {/* Enhanced Pending Employers Table */}
                    <PendingEmployersTable
                      employers={pendingEmployers}
                      onRefresh={fetchPendingItems}
                    />
                  </div>
                </div>
              </div>
            </Suspense>
          </TabsContent>

          {/* Patch Management Group */}
          <TabsContent value="patch-management" className="space-y-8">
            <Suspense fallback={<TabLoadingState />}>
              <div>
                <h3 className="text-lg font-semibold mb-4">Patches</h3>
                <PatchManager />
              </div>
              {isAdmin && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Spatial Assignment</h3>
                  <SpatialAssignmentTool />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold mb-4">Scoping</h3>
                <OrganiserScopeManager />
              </div>
            </Suspense>
          </TabsContent>

          {/* Standalone Tabs */}
          <TabsContent value="data-management" className="space-y-8">
            <Suspense fallback={<TabLoadingState />}>
              <DataUploadTab />
              <BatchesManagement />
              <DuplicateEmployerManager />
              {isAdmin && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Key Contractor Trades</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage which trades are prioritized across the system.{' '}
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => router.push('/admin/key-trades')}
                    >
                      Open Key Trades Manager →
                    </Button>
                  </p>
                </div>
              )}
            </Suspense>
          </TabsContent>
          {isAdmin && (
            <>
              <TabsContent value="navigation">
                <Suspense fallback={<TabLoadingState />}>
                  <NavigationVisibilityManager />
                </Suspense>
              </TabsContent>
              <TabsContent value="system-health">
                <Suspense fallback={<TabLoadingState />}>
                  <SystemHealthDashboard />
                </Suspense>
              </TabsContent>
            </>
          )}
          </Tabs>
        )}

        <Suspense fallback={null}>
          <InviteUserDialog open={open} onOpenChange={setOpen} onSuccess={() => {}} />
          {isAdmin && <AddressLookupDialog open={lookupOpen} onOpenChange={setLookupOpen} />}
          <AddDraftUserDialog open={addDraftOpen} onOpenChange={setAddDraftOpen} onSuccess={() => {}} />
        </Suspense>
      </div>
    </RoleGuard>
  )
}
