"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useNavigationVisibility, NavigationVisibility } from "@/hooks/useNavigationVisibility"
import { Loader2 } from "lucide-react"

interface PageConfig {
  key: keyof NavigationVisibility
  label: string
  description: string
}

const HIDEABLE_PAGES: PageConfig[] = [
  { key: "patch", label: "Patch", description: "Patch management and organization" },
  { key: "employers", label: "Employers", description: "Employer information and mapping" },
  { key: "workers", label: "Workers", description: "Worker database and membership" },
  { key: "map", label: "Map", description: "Interactive patch and job site maps" },
  { key: "site_visits", label: "Site Visits", description: "Site visit records and reports" },
  { key: "campaigns", label: "Campaigns", description: "Campaign activities and tracking" },
]

export function NavigationVisibilityManager() {
  const { visibility, isLoading, updateVisibility, isUpdating } = useNavigationVisibility()

  const handleToggle = (page: keyof NavigationVisibility) => {
    const newVisibility = {
      ...visibility,
      [page]: !visibility[page],
    }
    updateVisibility(newVisibility)
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
    <Card>
      <CardHeader>
        <CardTitle>Navigation Settings</CardTitle>
        <CardDescription>
          Configure which pages appear in the navigation menu for all users. 
          Dashboard, Projects, and Administration pages are always visible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {HIDEABLE_PAGES.map((page) => (
          <div key={page.key} className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-0.5">
              <Label 
                htmlFor={`nav-${page.key}`} 
                className="text-base font-medium cursor-pointer"
              >
                {page.label}
              </Label>
              <p className="text-sm text-muted-foreground">
                {page.description}
              </p>
            </div>
            <Switch
              id={`nav-${page.key}`}
              checked={visibility[page.key]}
              onCheckedChange={() => handleToggle(page.key)}
              disabled={isUpdating}
              aria-label={`Toggle ${page.label} visibility`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
