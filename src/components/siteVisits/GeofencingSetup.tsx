"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useGeofencing } from "@/hooks/useGeofencing"
import { MapPin, Bell, BellOff, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"

export function GeofencingSetup() {
  const [enabled, setEnabled] = useState(false)
  const {
    isSupported,
    hasPermission,
    currentPosition,
    nearbySites,
    lastNotification,
    requestPermission,
  } = useGeofencing(enabled)

  // Load enabled state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("geofencing-enabled")
    if (stored === "true" && isSupported) {
      setEnabled(true)
    }
  }, [isSupported])

  // Save enabled state to localStorage
  const handleToggle = async (checked: boolean) => {
    if (checked && !hasPermission) {
      const granted = await requestPermission()
      if (!granted) {
        toast.error("Notification permission denied. Geofencing requires notifications.")
        return
      }
    }

    setEnabled(checked)
    localStorage.setItem("geofencing-enabled", checked.toString())
    
    if (checked) {
      toast.success("Geofencing enabled. You'll be notified when near job sites.")
    } else {
      toast.info("Geofencing disabled.")
    }
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Geofencing Not Available
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-muted rounded-md">
            <AlertCircle className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <p>Your browser doesn't support geolocation or notifications.</p>
              <p className="mt-2">Geofencing features require a modern browser with location services enabled.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Site Visit Geofencing
        </CardTitle>
        <CardDescription>
          Get notified when you're near a job site to record visits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-md">
          <div className="space-y-0.5">
            <Label className="text-base">Enable Geofencing</Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications when within 100m of a job site
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
          />
        </div>

        {/* Permission Status */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Status</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="text-sm">Notification Permission</span>
              </div>
              {hasPermission ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Granted
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Not Granted
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">Location Services</span>
              </div>
              {currentPosition ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </Badge>
              ) : enabled ? (
                <Badge variant="secondary">
                  Waiting...
                </Badge>
              ) : (
                <Badge variant="outline">
                  Disabled
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Nearby Sites */}
        {enabled && nearbySites.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Nearby Sites</h4>
            <div className="space-y-2">
              {nearbySites.map((site) => (
                <div key={site.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                  <div>
                    <div className="text-sm font-medium">{site.name}</div>
                    <div className="text-xs text-muted-foreground">{site.project_name}</div>
                  </div>
                  <Badge variant="default">
                    Within range
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Notification */}
        {enabled && lastNotification && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Last Notification</h4>
            <div className="p-3 bg-muted rounded-md text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{lastNotification.siteName}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(lastNotification.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {lastNotification.projectName}
              </div>
            </div>
          </div>
        )}

        {/* How It Works */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-md">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            How It Works
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Your location is checked periodically when the app is open</li>
            <li>Notifications appear when you're within 100 meters of a job site</li>
            <li>Each site has a 1-hour cooldown to prevent notification spam</li>
            <li>Tap a notification to quickly record a site visit</li>
            <li>Location data is not stored or transmitted</li>
          </ul>
        </div>

        {/* Privacy Note */}
        <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
          <strong>Privacy:</strong> Your location is only used locally on your device to determine proximity to job sites. 
          Location data is never sent to our servers unless you explicitly record a site visit.
        </div>
      </CardContent>
    </Card>
  )
}

