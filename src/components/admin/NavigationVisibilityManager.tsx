"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useNavigationVisibility, NavigationVisibility } from "@/hooks/useNavigationVisibility"
import { useAdminDashboardSettings } from "@/hooks/useDashboardPreference"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PageConfig {
  key: keyof NavigationVisibility
  label: string
  description: string
}

const HIDEABLE_PAGES: PageConfig[] = [
  { key: "patch", label: "Patch", description: "Patch management and organization" },
  { key: "employers", label: "Employers", description: "Employer information and mapping" },
  { key: "eba_employers", label: "EBA Employers", description: "Lists EBA-active employers by contractor role/trade" },
  { key: "workers", label: "Workers", description: "Worker database and membership" },
  { key: "map", label: "Map", description: "Interactive patch and job site maps" },
  { key: "site_visits", label: "Site Visits", description: "Site visit records and reports" },
  { key: "lead_console", label: "Co-ordinator Console", description: "Lead organiser operations console" },
  { key: "campaigns", label: "Campaigns", description: "Campaign activities and tracking" },
]

export function NavigationVisibilityManager() {
  const { visibility, isLoading, updateVisibility, isUpdating } = useNavigationVisibility()
  const { settings: dashboardSettings, updateDefaultDashboard, isUpdating: dashboardUpdating } = useAdminDashboardSettings()

  const handleToggle = (page: keyof NavigationVisibility) => {
    const newVisibility = {
      ...visibility,
      [page]: !visibility[page],
    }
    updateVisibility(newVisibility)
  }

  const handleDashboardChange = (value: string) => {
    updateDefaultDashboard(value as 'legacy' | 'new')
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Selection</CardTitle>
          <CardDescription>
            Set the default dashboard for all users. Users can override this preference in their profile settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Default Dashboard</label>
              <Select
                value={dashboardSettings.default_dashboard}
                onValueChange={handleDashboardChange}
                disabled={dashboardUpdating}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="legacy">Legacy Dashboard (Current)</SelectItem>
                  <SelectItem value="new">New Dashboard (Improved UX)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Users with "auto" preference will see the selected dashboard. Users can change this in their profile settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation Settings</CardTitle>
          <CardDescription>
            Configure which pages appear in the navigation menu for all users. 
            Dashboard, Projects, and Administration pages are always visible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
        {HIDEABLE_PAGES.map((page) => {
          const value = visibility[page.key]
          const labelId = `nav-${page.key}-label`
          const descriptionId = `nav-${page.key}-description`
          return (
            <button
              key={page.key}
              type="button"
              onClick={() => handleToggle(page.key)}
              disabled={isUpdating}
              aria-pressed={value}
              aria-label={`Toggle ${page.label} visibility`}
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              className={cn(
                "group w-full rounded-xl border bg-card p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "hover:border-primary/60 hover:shadow-sm",
                isUpdating && "pointer-events-none opacity-60",
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div id={labelId} className="text-base font-medium">
                    {page.label}
                  </div>
                  <p id={descriptionId} className="text-sm text-muted-foreground">
                    {page.description}
                  </p>
                </div>
                <div className="relative h-10 w-16 shrink-0">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full border transition-all duration-200",
                      value
                        ? "border-primary bg-primary/10"
                        : "border-muted-foreground/30 bg-muted",
                    )}
                  />
                  <div
                    className={cn(
                      "absolute top-1 left-1 h-8 w-8 rounded-full bg-white shadow transition-all duration-200",
                      value ? "translate-x-6" : "translate-x-0",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 flex items-center justify-center text-xs font-semibold",
                        value ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {value ? "On" : "Off"}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
    </div>
  )
}
