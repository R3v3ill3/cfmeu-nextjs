"use client"

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GeofencingSetup } from "@/components/siteVisits/GeofencingSetup"
import { Badge } from "@/components/ui/badge"
import { User, Bell, Shield } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  // Get current user info
  const { data: currentUser } = useQuery({
    queryKey: ["settings-current-user"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth?.user) return null
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("id", auth.user.id)
        .single()
      
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

          {/* Geofencing Info for Organisers */}
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
        <p>CFMEU Organizer App</p>
        <p className="mt-1">
          Version 1.0 · October 2025
        </p>
      </div>
    </div>
  )
}


