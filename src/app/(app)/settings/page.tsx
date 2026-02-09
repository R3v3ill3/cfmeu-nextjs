"use client"

import React, { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GeofencingSetup } from "@/components/siteVisits/GeofencingSetup"
import { Badge } from "@/components/ui/badge"
import { User, Bell, Shield, LayoutDashboard } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useDashboardPreference } from "@/hooks/useDashboardPreference"
import { useProjectAuditTarget } from "@/hooks/useProjectAuditTarget"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const AGENT_DEBUG_INGEST_URL =
  "http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2"
const AGENT_DEBUG_RUN_ID = "pre-fix"

function agentDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    const url = new URL(window.location.href)
    const enabledByParam = url.searchParams.get("__agent_debug") === "1"
    if (enabledByParam) {
      try {
        sessionStorage.setItem("__agent_debug", "1")
      } catch {}
      return true
    }
    try {
      return sessionStorage.getItem("__agent_debug") === "1"
    } catch {
      return false
    }
  } catch {
    return false
  }
}

function userIdSuffix(userId: string | null | undefined): string | null {
  if (!userId) return null
  return userId.slice(-6)
}

export default function SettingsPage() {
  const { session, user, loading: authLoading } = useAuth()

  // Get current user info
  const { data: currentUser } = useQuery({
    queryKey: ["settings-current-user"],
    queryFn: async () => {
      if (agentDebugEnabled()) {
        // #region agent log - settings current user query start
        fetch(AGENT_DEBUG_INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,location:"src/app/(app)/settings/page.tsx:settings-current-user:start",message:"settings_current_user_query_start",data:{pathname:typeof window!=="undefined"?window.location?.pathname:null,authContext:{authLoading:authLoading,ctxHasSession:!!session,ctxUserIdSuffix:userIdSuffix(session?.user?.id??user?.id),ctxExpiresAt:session?.expires_at??null}},runId:AGENT_DEBUG_RUN_ID,hypothesisId:"H6",timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }

      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (agentDebugEnabled()) {
        // #region agent log - settings auth.getUser result
        fetch(AGENT_DEBUG_INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,location:"src/app/(app)/settings/page.tsx:settings-current-user:auth",message:"settings_current_user_auth_result",data:{pathname:typeof window!=="undefined"?window.location?.pathname:null,hasAuthUser:!!auth?.user,authUserIdSuffix:userIdSuffix(auth?.user?.id),authErrorMessage:authError?authError.message:null,ctxHasSession:!!session,ctxUserIdSuffix:userIdSuffix(session?.user?.id??user?.id),sbCookieCount:(()=>{try{return (document.cookie||'').split(';').filter(c=>c.trim().startsWith('sb-')).length}catch{return null}})()},runId:AGENT_DEBUG_RUN_ID,hypothesisId:"H6",timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }

      if (!auth?.user) return null
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, apple_email, role")
        .eq("id", auth.user.id)
        .single()

      if (agentDebugEnabled()) {
        let browserSessionSnapshot: Record<string, unknown> | null = null
        try {
          const { data: browserSessionData, error: browserSessionError } =
            await getSupabaseBrowserClient().auth.getSession()
          browserSessionSnapshot = {
            hasSession: !!browserSessionData?.session,
            userIdSuffix: userIdSuffix(browserSessionData?.session?.user?.id),
            expiresAt: browserSessionData?.session?.expires_at ?? null,
            errorMessage: browserSessionError ? browserSessionError.message : null,
          }
        } catch (error) {
          browserSessionSnapshot = {
            exception: error instanceof Error ? error.message : String(error),
          }
        }

        // #region agent log - settings profile query result
        fetch(AGENT_DEBUG_INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,location:"src/app/(app)/settings/page.tsx:settings-current-user:profile",message:"settings_current_user_profile_result",data:{pathname:typeof window!=="undefined"?window.location?.pathname:null,profileHasData:!!profile,profileErrorMessage:profileError?profileError.message:null,profileErrorCode:(profileError as any)?.code??null,profileUserIdSuffix:userIdSuffix((profile as any)?.id),profileRole:(profile as any)?.role??null,ctxHasSession:!!session,ctxUserIdSuffix:userIdSuffix(session?.user?.id??user?.id),browserSession:browserSessionSnapshot},runId:AGENT_DEBUG_RUN_ID,hypothesisId:"H6",timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
      
      return {
        ...profile,
        auth_email: auth.user.email,
      }
    }
  })

  // Get user's patch assignments
  const { data: patchAssignments = [] } = useQuery({
    queryKey: ["settings-patch-assignments", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return []

      if (currentUser.role === "organiser") {
        const { data } = await supabase
          .from("organiser_patch_assignments")
          .select("patches:patch_id(id, name)")
          .eq("organiser_id", currentUser.id)
          .is("effective_to", null)
        
        return data?.map(a => a.patches).filter(Boolean) || []
      }

      if (currentUser.role === "lead_organiser") {
        const { data } = await supabase
          .from("lead_organiser_patch_assignments")
          .select("patches:patch_id(id, name)")
          .eq("lead_organiser_id", currentUser.id)
          .is("effective_to", null)
        
        return data?.map(a => a.patches).filter(Boolean) || []
      }

      return []
    },
    enabled: !!currentUser?.id && (currentUser?.role === "organiser" || currentUser?.role === "lead_organiser")
  })

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account preferences and notification settings
        </p>
      </div>

      {/* User Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Your account details and role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Name</div>
              <div className="text-base mt-1">{currentUser?.full_name || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Email</div>
              <div className="text-base mt-1">{currentUser?.auth_email || currentUser?.email || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Role</div>
              <div className="mt-1">
                <Badge variant="outline" className="capitalize">
                  {currentUser?.role ? currentUser.role.replace('_', ' ') : "—"}
                </Badge>
              </div>
            </div>
            {patchAssignments.length > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Assigned Patches ({patchAssignments.length})
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {patchAssignments.map((patch: any) => (
                    <Badge key={patch.id} variant="secondary" className="text-xs">
                      {patch.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Apple Email Section */}
          <Separator />
          <AppleEmailManager userId={currentUser?.id} currentAppleEmail={currentUser?.apple_email} />
        </CardContent>
      </Card>

      <Separator />

      {/* Dashboard Preference Section */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" />
          Dashboard Preferences
        </h2>
        <p className="text-muted-foreground mt-1">
          Choose which dashboard version to use
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard Selection</CardTitle>
          <CardDescription>
            Select your preferred dashboard view. You can override the admin default or use automatic selection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardPreferenceSelector />
        </CardContent>
      </Card>

      <Separator />

      {/* Project Audit Target Section */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" />
          Project Metrics Preferences
        </h2>
        <p className="text-muted-foreground mt-1">
          Configure target percentages for project metrics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Target Percentage</CardTitle>
          <CardDescription>
            Set your target percentage for key contractors with audits. This target will be displayed on project cards.
            Default: 75%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditTargetSelector />
        </CardContent>
      </Card>

      <Separator />

      {/* Geofencing Section - Only for organisers, lead_organisers, and admins */}
      {currentUser?.role && ['organiser', 'lead_organiser', 'admin'].includes(currentUser.role) && (
        <>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Notifications
            </h2>
            <p className="text-muted-foreground mt-1">
              Configure location-based reminders for site visits
            </p>
          </div>

          <GeofencingSetup />

          {/* Geofencing Info - role-specific context */}
          {currentUser.role === "admin" && (
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-base">All Sites Visible</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  As an administrator you'll receive reminders for any job site in the system when you're within range.
                </p>
              </CardContent>
            </Card>
          )}
          {currentUser.role === "lead_organiser" && (
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-base">All Sites Visible</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  As a lead organiser you'll receive reminders for any job site in the system when you're within range.
                </p>
                {patchAssignments.length > 0 && (
                  <>
                    <p className="text-sm text-muted-foreground mt-2">
                      Your assigned patches:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {patchAssignments.map((patch: any) => (
                        <Badge key={patch.id} variant="default">
                          {patch.name}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
          {currentUser.role === "organiser" && patchAssignments.length > 0 && (
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-base">Patch-Specific Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  You'll only receive notifications for job sites in your assigned patches:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {patchAssignments.map((patch: any) => (
                    <Badge key={patch.id} variant="default">
                      {patch.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  This ensures you only get relevant notifications and won't be disturbed when passing sites outside your patches.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Privacy & Security Section */}
      <Separator />

      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Privacy & Security
        </h2>
        <p className="text-muted-foreground mt-1">
          How we protect your data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Location Data</h4>
            <p className="text-sm text-muted-foreground">
              Your location is only used locally on your device to determine proximity to job sites. 
              Location data is never sent to our servers unless you explicitly record a site visit. 
              When you do record a visit, only the job site name is saved, not your GPS coordinates.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Visit Records</h4>
            <p className="text-sm text-muted-foreground">
              Site visit records you create are visible to other organisers and administrators within 
              the organization for coordination and reporting purposes. Your visit records include your 
              name, the date, site visited, and notes you provide.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Notifications</h4>
            <p className="text-sm text-muted-foreground">
              Browser notifications are sent directly from your device's operating system when geofencing 
              is enabled. We don't track or store which notifications you receive. You can disable 
              notifications at any time in your browser settings or by turning off geofencing above.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card>
        <CardHeader>
          <CardTitle>Help & Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <p className="font-medium mb-2">Need help with the app?</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
              <li>Check the User Guide from the main navigation</li>
              <li>Contact your lead organiser for feature questions</li>
              <li>Contact your administrator for access or permission issues</li>
            </ul>
          </div>

          {currentUser?.role === "lead_organiser" && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="font-medium mb-2">Lead Organiser Resources</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                  <li>Manage custom visit reasons from the Lead Console</li>
                  <li>View team performance metrics on your dashboard</li>
                  <li>Assign organisers to patches in the Co-ordinator Console</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* App Version Info */}
      <div className="text-center text-xs text-muted-foreground pt-4">
        <p>CFMEU uConstuct</p>
        <p className="mt-1">
          Version 1.0 · October 2025
        </p>
      </div>
    </div>
  )
}

function DashboardPreferenceSelector() {
  const { 
    resolvedPreference, 
    userPreference, 
    adminDefault, 
    isLoading, 
    updatePreference, 
    isUpdating 
  } = useDashboardPreference()

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-base font-medium">Your Dashboard Preference</Label>
        <RadioGroup
          value={userPreference || 'auto'}
          onValueChange={(value) => {
            updatePreference(value as 'legacy' | 'new' | 'auto')
          }}
          disabled={isLoading || isUpdating}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="auto" id="auto" />
            <Label htmlFor="auto" className="font-normal cursor-pointer">
              <div>
                <div className="font-medium">Use Admin Default</div>
                <div className="text-sm text-muted-foreground">
                  Currently: {adminDefault === 'new' ? 'New Dashboard' : 'Legacy Dashboard'}
                </div>
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="legacy" id="legacy" />
            <Label htmlFor="legacy" className="font-normal cursor-pointer">
              <div>
                <div className="font-medium">Legacy Dashboard</div>
                <div className="text-sm text-muted-foreground">
                  Use the original dashboard view
                </div>
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="new" id="new" />
            <Label htmlFor="new" className="font-normal cursor-pointer">
              <div>
                <div className="font-medium">New Dashboard</div>
                <div className="text-sm text-muted-foreground">
                  Use the enhanced dashboard with improved visualizations
                </div>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="pt-2 border-t">
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-1">Current Selection:</p>
          <p>
            {resolvedPreference === 'new' ? 'New Dashboard' : 'Legacy Dashboard'}
            {userPreference === 'auto' && ` (using admin default: ${adminDefault})`}
          </p>
        </div>
      </div>
    </div>
  )
}

function AuditTargetSelector() {
  const { 
    auditTarget, 
    isLoading, 
    updateAuditTarget, 
    isUpdating 
  } = useProjectAuditTarget()

  const [localValue, setLocalValue] = React.useState(auditTarget)

  React.useEffect(() => {
    setLocalValue(auditTarget)
  }, [auditTarget])

  const handleSliderChange = (value: number[]) => {
    const newValue = value[0]
    setLocalValue(newValue)
    updateAuditTarget(newValue)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 0 && value <= 100) {
      setLocalValue(value)
      updateAuditTarget(value)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-base font-medium">Target Percentage</Label>
        <div className="space-y-4">
          <div className="px-2">
            <Slider
              value={[localValue]}
              onValueChange={handleSliderChange}
              min={0}
              max={100}
              step={5}
              disabled={isLoading || isUpdating}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="audit-target-input" className="text-sm">
              Target:
            </Label>
            <Input
              id="audit-target-input"
              type="number"
              min={0}
              max={100}
              value={localValue}
              onChange={handleInputChange}
              disabled={isLoading || isUpdating}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t">
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-1">Current Setting:</p>
          <p>{auditTarget}% of key contractors should have audits</p>
        </div>
      </div>
    </div>
  )
}

function AppleEmailManager({ userId, currentAppleEmail }: { userId?: string; currentAppleEmail?: string | null }) {
  const [appleEmail, setAppleEmail] = useState(currentAppleEmail || "")
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  React.useEffect(() => {
    setAppleEmail(currentAppleEmail || "")
  }, [currentAppleEmail])

  const handleSave = async () => {
    if (!userId) return

    const trimmedEmail = appleEmail.trim().toLowerCase()
    
    // Basic email validation
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ apple_email: trimmedEmail || null })
        .eq("id", userId)

      if (error) throw error

      toast({
        title: "Apple email saved",
        description: trimmedEmail 
          ? "Your Apple email has been updated. You can now use Apple Sign In with this email."
          : "Apple email removed.",
      })

      setIsEditing(false)
      // Invalidate the query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["settings-current-user"] })
    } catch (error: any) {
      console.error("Error saving Apple email:", error)
      toast({
        title: "Failed to save",
        description: error.message || "An error occurred while saving your Apple email",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setAppleEmail(currentAppleEmail || "")
    setIsEditing(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Apple ID Email</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Add your Apple ID email to enable Apple Sign In. This is useful if your Apple ID email differs from your work email.
          </p>
        </div>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            {currentAppleEmail ? "Edit" : "Add"}
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Input
            type="email"
            placeholder="your.apple.id@example.com"
            value={appleEmail}
            onChange={(e) => setAppleEmail(e.target.value)}
            disabled={isSaving}
            className="max-w-md"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-base">
          {currentAppleEmail ? (
            <div className="flex items-center gap-2">
              <span>{currentAppleEmail}</span>
              <Badge variant="secondary" className="text-xs">Configured</Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
        </div>
      )}
    </div>
  )
}

