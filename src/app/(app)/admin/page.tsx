"use client"
export const dynamic = 'force-dynamic'

import { PendingUsersTable } from "@/components/admin/PendingUsersTable"
import { InviteUserDialog } from "@/components/admin/InviteUserDialog"
import { AddDraftUserDialog } from "@/components/admin/AddDraftUserDialog"
import { PendingProjectsTable } from "@/components/admin/PendingProjectsTable"
import { PendingEmployersTable } from "@/components/admin/PendingEmployersTable"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import UsersTable from "@/components/admin/UsersTable"
import RoleGuard from "@/components/guards/RoleGuard"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { RoleHierarchyManager } from "@/components/admin/RoleHierarchyManager"
import { OrganiserScopeManager } from "@/components/admin/OrganiserScopeManager"
import PatchManager from "@/components/admin/PatchManager"
import SpatialAssignmentTool from "@/components/admin/SpatialAssignmentTool"
import AddressLookupDialog from "@/components/AddressLookupDialog"
import DuplicateEmployerManager from "@/components/admin/DuplicateEmployerManager"
import DataUploadTab from "@/components/admin/DataUploadTab"
import { NavigationVisibilityManager } from "@/components/admin/NavigationVisibilityManager"
import { SystemHealthDashboard } from "@/components/admin/SystemHealthDashboard"
import { useAuth } from "@/hooks/useAuth"
import { useSearchParams } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"

export default function AdminPage() {
  const [open, setOpen] = useState(false)
  const [addDraftOpen, setAddDraftOpen] = useState(false)
  const [lookupOpen, setLookupOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()

  // Get user role
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      setUserRole((profile as { role?: string } | null)?.role || null)
    }
    checkUserRole()
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
  const defaultTab = isAdmin ? "users" : "invites" // Lead organisers start with invites tab
  const [tabValue, setTabValue] = useState<string>(defaultTab)

  const tabParam = searchParams?.get("tab")

  useEffect(() => {
    if (tabParam) {
      setTabValue(tabParam)
    } else {
      setTabValue(defaultTab)
    }
  }, [tabParam, defaultTab])

  // Pending approvals state
  const [pendingProjects, setPendingProjects] = useState<any[]>([])
  const [pendingEmployers, setPendingEmployers] = useState<any[]>([])
  const [isLoadingPending, setIsLoadingPending] = useState(false)

  const fetchPendingItems = async () => {
    setIsLoadingPending(true)
    try {
      const response = await fetch('/api/admin/pending-items')
      if (response.ok) {
        const data = await response.json()
        setPendingProjects(data.projects || [])
        setPendingEmployers(data.employers || [])
      }
    } catch (error) {
      console.error('Error fetching pending items:', error)
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
          /* Mobile-optimized accordion layout */
          <div className="space-y-3">
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
                  <div>
                    <h3 className="text-base font-semibold mb-3">
                      Pending Projects ({pendingProjects.length})
                    </h3>
                    <PendingProjectsTable
                      projects={pendingProjects}
                      onApprove={handleApproveProject}
                      onReject={handleRejectProject}
                      onRefresh={fetchPendingItems}
                    />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-3">
                      Pending Employers ({pendingEmployers.length})
                    </h3>
                    <PendingEmployersTable
                      employers={pendingEmployers}
                      onApprove={handleApproveEmployer}
                      onReject={handleRejectEmployer}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

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
            
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  Data Management
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3">
                  <DataUploadTab />
                  <div className="mt-4">
                    <DuplicateEmployerManager />
                  </div>
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
        ) : (
          /* Desktop layout - original tabs */
          <Tabs value={tabValue} onValueChange={setTabValue}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending Approvals
              {totalPendingCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {totalPendingCount}
                </Badge>
              )}
            </TabsTrigger>
            {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
            <TabsTrigger value="invites">Invites</TabsTrigger>
            {isAdmin && <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>}
            <TabsTrigger value="patches">Patches</TabsTrigger>
            {isAdmin && <TabsTrigger value="spatial">Spatial Assignment</TabsTrigger>}
            <TabsTrigger value="scoping">Scoping</TabsTrigger>
            <TabsTrigger value="data-management">Data Management</TabsTrigger>
            {isAdmin && <TabsTrigger value="navigation">Navigation</TabsTrigger>}
            {isAdmin && <TabsTrigger value="system-health">System Health</TabsTrigger>}
          </TabsList>
          <TabsContent value="pending">
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Pending Projects ({pendingProjects.length})
                </h3>
                <PendingProjectsTable
                  projects={pendingProjects}
                  onApprove={handleApproveProject}
                  onReject={handleRejectProject}
                  onRefresh={fetchPendingItems}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Pending Employers ({pendingEmployers.length})
                </h3>
                <PendingEmployersTable
                  employers={pendingEmployers}
                  onApprove={handleApproveEmployer}
                  onReject={handleRejectEmployer}
                />
              </div>
            </div>
          </TabsContent>
          {isAdmin && (
            <TabsContent value="users">
              <UsersTable />
            </TabsContent>
          )}
          <TabsContent value="invites">
            <div className="flex items-center justify-between mb-2">
              <div />
              <Button variant="outline" onClick={() => setAddDraftOpen(true)}>Add draft organiser</Button>
            </div>
            <PendingUsersTable />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="hierarchy">
              <RoleHierarchyManager users={users} />
            </TabsContent>
          )}
          <TabsContent value="patches">
            <PatchManager />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="spatial">
              <SpatialAssignmentTool />
            </TabsContent>
          )}
          <TabsContent value="scoping">
            <OrganiserScopeManager />
          </TabsContent>
          <TabsContent value="data-management">
            <DataUploadTab />
            <div className="mt-4">
              <DuplicateEmployerManager />
            </div>
          </TabsContent>
          {isAdmin && (
            <>
              <TabsContent value="navigation">
                <NavigationVisibilityManager />
              </TabsContent>
              <TabsContent value="system-health">
                <SystemHealthDashboard />
              </TabsContent>
            </>
          )}
          </Tabs>
        )}

        <InviteUserDialog open={open} onOpenChange={setOpen} onSuccess={() => {}} />
        {isAdmin && <AddressLookupDialog open={lookupOpen} onOpenChange={setLookupOpen} />}
        <AddDraftUserDialog open={addDraftOpen} onOpenChange={setAddDraftOpen} onSuccess={() => {}} />
      </div>
    </RoleGuard>
  )
}
