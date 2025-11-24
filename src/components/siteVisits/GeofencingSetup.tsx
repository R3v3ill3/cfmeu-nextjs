"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useGeofencing } from "@/hooks/useGeofencing"
import { IosInstallPrompt, useIosInstallPrompt } from "@/components/pwa/IosInstallPrompt"
import { MapPin, CheckCircle2, AlertCircle, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useGeofencingPermission } from "@/lib/geofencing/GeofencingPermissionManager"

export function GeofencingSetup() {
  const [enabled, setEnabled] = useState(false)
  const [testMode, setTestMode] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Clear test sites when unmounting or when test mode is disabled
  useEffect(() => {
    return () => {
      if (!testMode) {
        delete (window as any).__GEOFENCE_TEST_SITES;
      }
    };
  }, [testMode])
  const {
    isSupported,
    hasLocationPermission,
    permissionError,
    currentPosition,
    nearbySites,
    lastNotification,
    requestLocationAccess,
    permissionChecked,
  } = useGeofencing(enabled)
  const {
    visible: iosInstallVisible,
    dismiss: dismissIosInstallPrompt,
    evaluate: evaluateIosInstallPrompt,
  } = useIosInstallPrompt()

  const { requestPermissionsNow } = useGeofencingPermission()

  // Load enabled state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("geofencing-enabled")
    if (stored === "true" && isSupported) {
      setEnabled(true)
    }
  }, [isSupported])

  useEffect(() => {
    if (enabled) {
      evaluateIosInstallPrompt()
    }
  }, [enabled, evaluateIosInstallPrompt])

  useEffect(() => {
    if (!enabled || !lastNotification) return

    toast(
      `You're near ${lastNotification.siteName}`,
      {
        description: lastNotification.projectName,
        action: {
          label: "Record visit",
          onClick: () => {
            window.location.href = "/site-visits?openForm=true"
          },
        },
        duration: 5000,
      }
    )
  }, [enabled, lastNotification])

  // Save enabled state to localStorage
  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const granted = await requestLocationAccess()
      if (!granted) {
        toast.error("Location permission is required for geofencing reminders.")
        return
      }
    }

    setEnabled(checked)
    localStorage.setItem("geofencing-enabled", checked.toString())
    
    if (checked) {
      toast.success("Geofencing enabled. Keep the app open to see nearby site reminders.")
      evaluateIosInstallPrompt()
    } else {
      toast.info("Geofencing disabled. We'll stop checking your location.")
    }
  }
  const showInstallPrompt = enabled && iosInstallVisible

  // Debug logging
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('debug-geofencing') === 'true') {
      console.log('[GeofencingSetup] Debug Info:', {
        isSupported,
        hasLocationPermission,
        permissionError,
        enabled,
        isStandalone: window.matchMedia?.("(display-mode: standalone)")?.matches,
        navigatorStandalone: (window.navigator as any).standalone,
        userAgent: navigator.userAgent,
      })
    }
  }, [isSupported, hasLocationPermission, permissionError, enabled])

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
              <p>Your browser doesn't support geolocation or you're not in a PWA.</p>
              <p className="mt-2">
                Install the CFMEU app via Safari → Share → <span className="font-medium">Add to Home Screen</span>.
              </p>
              <p className="mt-1 text-xs">
                If already installed, ensure you're launching from the home screen icon, not Safari.
              </p>
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
          Keep the CFMEU mobile app or installed PWA open and we’ll surface nearby sites so you can start a visit in a
          single tap.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-md">
          <div className="space-y-0.5">
            <Label className="text-base">Enable Geofencing</Label>
            <p className="text-sm text-muted-foreground">
              See in-app reminders when you are within 100m of a job site (app must stay open)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              aria-label="Enable geofencing reminders"
              data-testid="geofencing-toggle"
              checked={enabled}
              onCheckedChange={handleToggle}
              style={{ pointerEvents: 'auto' }}
            />
            {/* Fallback checkbox for testing */}
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleToggle(e.target.checked)}
              className="w-5 h-5"
              title="Fallback toggle (testing)"
            />
          </div>
        </div>

        {/* Request Permission Button - iOS needs explicit user action */}
        {!hasLocationPermission && !permissionError && isSupported && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {!permissionChecked ? "Checking Location Permission..." : "Location Permission Required"}
              </span>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              {!permissionChecked
                ? "Checking if you previously granted location permission..."
                : "iOS requires explicit permission to access your location for geofencing."
              }
            </p>
            {permissionChecked && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const granted = await requestPermissionsNow()
                  if (granted) {
                    toast.success("Location permission granted! You can now enable geofencing.")
                  }
                }}
                className="text-xs"
              >
                Request Location Permission
              </Button>
            )}
          </div>
        )}

        {showInstallPrompt && (
          <IosInstallPrompt
            visible={showInstallPrompt}
            onDismiss={dismissIosInstallPrompt}
          />
        )}

        {/* Permission Status */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Status</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">Location Permission</span>
              </div>
              {hasLocationPermission ? (
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
                <Badge variant="secondary">Waiting...</Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
            </div>
          </div>
        </div>

        {permissionError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <div className="font-medium">Location Access Required</div>
            <div className="mt-1">{permissionError}</div>
            <div className="mt-2 text-xs">
              To fix: Settings &gt; Privacy & Location Services &gt; CFMEU &gt; While Using the App
            </div>
          </div>
        )}

        {/* Nearby Sites */}
        {enabled && nearbySites.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Nearby Sites</h4>
              <Badge variant="outline">{nearbySites.length}</Badge>
            </div>
            <div className="space-y-2">
              {nearbySites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between gap-4 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950"
                >
                  <div>
                    <div className="text-sm font-medium">{site.name}</div>
                    <div className="text-xs text-muted-foreground">{site.project_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Within range</Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        try {
                          sessionStorage.setItem(
                            "pendingSiteVisit",
                            JSON.stringify({
                              job_site_id: site.id,
                              project_id: site.project_id,
                            })
                          )
                        } catch (error) {
                          console.warn("Unable to store pending site visit", error)
                        }
                        window.location.href = "/site-visits?openForm=true"
                      }}
                    >
                      Start visit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Reminder */}
        {enabled && lastNotification && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Last Reminder</h4>
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

        {/* Advanced Options & Test Mode */}
        <div className="border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-muted-foreground"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </Button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* Debug Info */}
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md text-xs font-mono space-y-2">
                <div>Enabled: {enabled ? 'YES' : 'NO'}</div>
                <div>Permission: {hasLocationPermission ? 'GRANTED' : 'NOT GRANTED'}</div>
                <div>Position: {currentPosition ? 'ACTIVE' : 'NONE'}</div>
                <div>Nearby Sites: {nearbySites.length}</div>
                <div>PWA Mode: {typeof window !== 'undefined' &&
                  (window.matchMedia?.("(display-mode: standalone)")?.matches ||
                   (window.navigator as any).standalone === true) ? 'YES' : 'NO'}</div>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      console.log('Manual toggle - enabled:', enabled)
                      setEnabled(!enabled)
                      localStorage.setItem("geofencing-enabled", (!enabled).toString())
                    }}
                    className="text-xs"
                  >
                    Toggle Geofencing
                  </Button>
                </div>
              </div>

              {/* Test Mode */}
              <div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-purple-600" />
                    Test Mode
                  </h4>
                  <Switch
                    checked={testMode}
                    onCheckedChange={setTestMode}
                    aria-label="Enable test mode"
                    style={{ pointerEvents: 'auto' }}
                  />
                </div>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                  Simulate nearby job sites for testing without physical proximity.
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Test sites are stored locally and won't affect your data or authentication.
                </p>
                {testMode && (
                  <div className="space-y-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Add test sites at current location
                        if (currentPosition) {
                          // Clear any existing test sites first
                          delete (window as any).__GEOFENCE_TEST_SITES;

                          const testSites = [
                            {
                              id: 'test-site-1',
                              name: 'Test Site A',
                              project_id: 'test-project-1',
                              project_name: 'Test Project Alpha',
                              latitude: currentPosition.coords.latitude + 0.0001,
                              longitude: currentPosition.coords.longitude + 0.0001
                            },
                            {
                              id: 'test-site-2',
                              name: 'Test Site B',
                              project_id: 'test-project-2',
                              project_name: 'Test Project Beta',
                              latitude: currentPosition.coords.latitude - 0.0001,
                              longitude: currentPosition.coords.longitude - 0.0001
                            }
                          ];
                          (window as any).__GEOFENCE_TEST_SITES = testSites;
                          toast.success('Test sites added! Geofencing will check in ~60 seconds.');
                          // Don't reload - it breaks authentication
                          // Instead, trigger a manual location update
                          if (enabled && currentPosition) {
                            // Simulate being near the test sites immediately
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('geofence-test-trigger', {
                                detail: { position: currentPosition }
                              }));
                            }, 1000);
                          }
                        } else {
                          toast.error('Need location permission first. Tap "Request Location Permission".');
                        }
                      }}
                      className="text-xs"
                    >
                      Add Test Sites Nearby
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        delete (window as any).__GEOFENCE_TEST_SITES;
                        toast.info('Test sites cleared');
                      }}
                      className="text-xs"
                    >
                      Clear Test Sites
                    </Button>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      Sites will be added ~10 meters from your current location
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-md">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            How It Works
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
            <li>The CFMEU app (or installed PWA) checks your position every ~60s while it is in the foreground.</li>
            <li>In-app toasts highlight the closest job site when you are within 100m.</li>
            <li>Each site has a 1-hour cooldown to avoid repeated reminders.</li>
            <li>Use "Start visit" or tap the toast to pre-fill the site visit form instantly.</li>
            <li>Location data never leaves your device until you submit a visit.</li>
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

