import { useEffect, useState, useCallback, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

const GEOFENCE_RADIUS_METERS = 100 // 100 meters
const POSITION_CHECK_INTERVAL = 60000 // Check every 60 seconds
const NOTIFICATION_COOLDOWN = 3600000 // 1 hour cooldown per site

interface JobSiteLocation {
  id: string
  name: string
  project_id: string
  project_name: string
  latitude: number
  longitude: number
}

interface GeofenceNotification {
  siteId: string
  siteName: string
  projectId: string
  projectName: string
  timestamp: number
}

export function useGeofencing(enabled: boolean = false) {
  const [isSupported, setIsSupported] = useState(false)
  const [hasLocationPermission, setHasLocationPermission] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [nearbySites, setNearbySites] = useState<JobSiteLocation[]>([])
  const [lastNotification, setLastNotification] = useState<GeofenceNotification | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const notificationCooldownRef = useRef<Map<string, number>>(new Map())
  const mockSites: JobSiteLocation[] | null =
    typeof window !== "undefined" && Array.isArray((window as any).__GEOFENCE_TEST_SITES)
      ? (window as any).__GEOFENCE_TEST_SITES
      : null
  const useMockSites = !!mockSites

  // Check if geolocation and notifications are supported
  useEffect(() => {
    if (typeof window === "undefined") return

    // Check for geolocation support
    const hasGeolocation = "geolocation" in navigator

    // On iOS, check if we're in PWA mode for better permission handling
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isPWA = window.matchMedia?.("(display-mode: standalone)")?.matches ||
                  (window.navigator as any).standalone === true

    // Geofencing requires PWA mode on iOS for reliable operation
    if (isIOS && !isPWA) {
      console.warn('[Geofencing] iOS detected but not in PWA mode - geofencing may not work reliably')
    }

    setIsSupported(hasGeolocation)

    // Debug logging
    if (localStorage.getItem('debug-geofencing') === 'true') {
      console.log('[Geofencing] Platform check:', {
        isIOS,
        isPWA,
        hasGeolocation,
        userAgent: navigator.userAgent
      })
    }
  }, [])

  // Auto-check permissions on mount and restore saved state
  useEffect(() => {
    if (typeof window === "undefined") return

    // Check if we previously had permission
    const hadPermission = localStorage.getItem('geofence-location-granted') === 'true'

    if (hadPermission && isSupported && !permissionChecked) {
      // Silently check if we still have permission
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setHasLocationPermission(true)
          setCurrentPosition(position)
          setPermissionChecked(true)
          setPermissionError(null)

          if (localStorage.getItem('debug-geofencing') === 'true') {
            console.log('[Geofencing] Permission restored from previous session')
          }
        },
        (error) => {
          setHasLocationPermission(false)
          setPermissionChecked(true)

          if (error.code === error.PERMISSION_DENIED) {
            // Permission was revoked, clear the saved state
            localStorage.removeItem('geofence-location-granted')
          }

          if (localStorage.getItem('debug-geofencing') === 'true') {
            console.log('[Geofencing] Permission check failed:', error.message)
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000, // 5 minutes
        }
      )
    }
  }, [isSupported, permissionChecked])

  useEffect(() => {
    if (typeof navigator === "undefined") return
    const permissions = (navigator as any).permissions
    if (!permissions?.query) return

    let cancelled = false

    let permissionStatus: PermissionStatus | null = null
    let handleChange: (() => void) | null = null

    permissions
      .query({ name: "geolocation" })
      .then((status: PermissionStatus) => {
        if (cancelled) return
        permissionStatus = status
        setHasLocationPermission(status.state === "granted")

        handleChange = () => {
          if (status.state === "granted") {
            setHasLocationPermission(true)
            setPermissionError(null)
          } else if (status.state === "denied") {
            setHasLocationPermission(false)
            setPermissionError("Location permission denied. Enable it in Settings > Privacy > Location Services.")
          } else {
            setHasLocationPermission(false)
          }
        }

        if (status.addEventListener) {
          status.addEventListener("change", handleChange)
        } else {
          status.onchange = handleChange
        }
      })
      .catch(() => {
        // Safari (and some embedded browsers) don't expose permissions API—fall back to manual request flow.
      })

    return () => {
      cancelled = true
      if (permissionStatus && handleChange) {
        if (permissionStatus.removeEventListener) {
          permissionStatus.removeEventListener("change", handleChange)
        } else if (permissionStatus.onchange === handleChange) {
          permissionStatus.onchange = null
        }
      }
    }
  }, [])

  // Get user's role and assigned patches for filtering
  const { data: userPatchScope } = useQuery({
    queryKey: ["geofence-user-scope"],
    queryFn: async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth?.user?.id
        if (!userId) return { role: null, patchIds: [] }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single()
        
        const role = profile?.role || null

        // Admins and lead_organisers see all sites (they manage multiple patches)
        if (role === "admin" || role === "lead_organiser") {
          return { role, patchIds: null } // null = all patches
        }

        // Organisers: get their assigned patch IDs
        if (role === "organiser") {
          const { data: assignments } = await supabase
            .from("organiser_patch_assignments")
            .select("patch_id")
            .eq("organiser_id", userId)
            .is("effective_to", null)
          
          const patchIds = assignments?.map(a => a.patch_id) || []
          return { role, patchIds }
        }

        return { role, patchIds: [] }
      } catch (error) {
        console.error("Error fetching user patch scope:", error)
        return { role: null, patchIds: [] }
      }
    },
    enabled: enabled && isSupported && !useMockSites,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch job sites with coordinates (filtered by user's patches for organisers)
  const { data: fetchedJobSites = [] } = useQuery({
    queryKey: ["job-sites-with-coords", userPatchScope?.role, userPatchScope?.patchIds?.join(",")],
    queryFn: async () => {
      // If user has no patches or role, return empty
      if (!userPatchScope) return []
      
      // Admin and lead_organiser: Get all sites with coordinates
      if (userPatchScope.patchIds === null) {
        const { data, error } = await supabase
          .from("job_sites")
          .select(`
            id,
            name,
            latitude,
            longitude,
            project_id,
            projects (
              id,
              name
            )
          `)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
        
        if (error) throw error

        return (data || []).map((site: any) => ({
          id: site.id,
          name: site.name,
          project_id: site.project_id,
          project_name: site.projects?.name || "Unknown Project",
          latitude: site.latitude,
          longitude: site.longitude,
        })) as JobSiteLocation[]
      }

      // Organiser: Only get sites in their assigned patches
      const patchIds = userPatchScope.patchIds || []
      if (patchIds.length === 0) return []

      // Get job site IDs from patches
      const { data: patchSites, error: patchError } = await supabase
        .from("v_patch_sites_current")
        .select("job_site_id")
        .in("patch_id", patchIds)
      
      if (patchError) throw patchError

      const siteIds = Array.from(new Set(patchSites?.map(ps => ps.job_site_id) || []))
      if (siteIds.length === 0) return []

      // Get full job site details for those IDs
      const { data, error } = await supabase
        .from("job_sites")
        .select(`
          id,
          name,
          latitude,
          longitude,
          project_id,
          projects (
            id,
            name
          )
        `)
        .in("id", siteIds)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
      
      if (error) throw error

      return (data || []).map((site: any) => ({
        id: site.id,
        name: site.name,
        project_id: site.project_id,
        project_name: site.projects?.name || "Unknown Project",
        latitude: site.latitude,
        longitude: site.longitude,
      })) as JobSiteLocation[]
    },
    enabled: enabled && isSupported && !!userPatchScope && !useMockSites,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
  const jobSites = useMockSites ? mockSites ?? [] : fetchedJobSites

  // Calculate distance between two lat/lng points (Haversine formula)
  const calculateDistance = useCallback((
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }, [])

  // Check if a site is in cooldown
  const isSiteInCooldown = useCallback((siteId: string): boolean => {
    const lastNotification = notificationCooldownRef.current.get(siteId)
    if (!lastNotification) return false
    return Date.now() - lastNotification < NOTIFICATION_COOLDOWN
  }, [])

  const requestLocationAccess = useCallback((): Promise<boolean> => {
    if (typeof navigator === "undefined" || !isSupported) {
      setPermissionError("Geolocation is not supported in this browser.")
      return Promise.resolve(false)
    }

    setPermissionError(null)

    // Check if we're in PWA mode on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isPWA = window.matchMedia?.("(display-mode: standalone)")?.matches ||
                  (window.navigator as any).standalone === true

    if (isIOS && !isPWA) {
      setPermissionError("On iOS, geofencing requires installing the app to your home screen. Use Safari → Share → Add to Home Screen.")
      return Promise.resolve(false)
    }

    return new Promise((resolve) => {
      // Debug logging
      if (localStorage.getItem('debug-geofencing') === 'true') {
        console.log('[Geofencing] Requesting location access...', { isIOS, isPWA })
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (localStorage.getItem('debug-geofencing') === 'true') {
            console.log('[Geofencing] Location access granted!', position)
          }
          setHasLocationPermission(true)
          setCurrentPosition(position)
          setPermissionError(null)
          setPermissionChecked(true)

          // Save that we have permission for future sessions
          localStorage.setItem('geofence-location-granted', 'true')

          resolve(true)
        },
        (error) => {
          if (localStorage.getItem('debug-geofencing') === 'true') {
            console.error('[Geofencing] Location access denied:', error)
          }

          if (error.code === error.PERMISSION_DENIED) {
            setPermissionError(
              "Location permission denied. To fix: Settings > Privacy & Security > Location Services > CFMEU > While Using the App. " +
              "If CFMEU doesn't appear in the list, remove the app from your home screen and reinstall it from Safari."
            )
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setPermissionError("Unable to determine your location. Check that Location Services are enabled.")
          } else if (error.code === error.TIMEOUT) {
            setPermissionError("Location request timed out. Please try again.")
          } else {
            setPermissionError(`Location error (${error.code}): ${error.message}`)
          }
          setHasLocationPermission(false)
          resolve(false)
        },
        {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 0,
        }
      )
    })
  }, [isSupported])

  // Record nearby site for in-app alerts/toasts
  const recordNearbySite = useCallback((site: JobSiteLocation) => {
    if (isSiteInCooldown(site.id)) return

    const timestamp = Date.now()
    const payload: GeofenceNotification = {
      siteId: site.id,
      siteName: site.name,
      projectId: site.project_id,
      projectName: site.project_name,
      timestamp,
    }

    notificationCooldownRef.current.set(site.id, timestamp)
    setLastNotification(payload)

    try {
      sessionStorage.setItem(
        "pendingSiteVisit",
        JSON.stringify({
          job_site_id: site.id,
          project_id: site.project_id,
        })
      )
    } catch (error) {
      console.warn("Unable to store pending site visit:", error)
    }
  }, [isSiteInCooldown])

  // Check for nearby sites
  const checkNearbySites = useCallback((position: GeolocationPosition) => {
    if (!jobSites.length) return

    const userLat = position.coords.latitude
    const userLon = position.coords.longitude

    const nearby = jobSites.filter((site) => {
      const distance = calculateDistance(
        userLat,
        userLon,
        site.latitude,
        site.longitude
      )
      return distance <= GEOFENCE_RADIUS_METERS
    })

    setNearbySites(nearby)

    // Alert for closest site within radius
    if (nearby.length > 0) {
      const sorted = nearby
        .map((site) => ({
          site,
          distance: calculateDistance(userLat, userLon, site.latitude, site.longitude),
        }))
        .sort((a, b) => a.distance - b.distance)
        .map((entry) => entry.site)

      recordNearbySite(sorted[0])
    }
  }, [jobSites, calculateDistance, recordNearbySite])

  // Store checkNearbySites in a ref to avoid dependency issues
  const checkNearbySitesRef = useRef(checkNearbySites)
  useEffect(() => {
    checkNearbySitesRef.current = checkNearbySites
  }, [checkNearbySites])

  // Start watching position
  const startWatching = useCallback(() => {
    if (!enabled || !isSupported || !hasLocationPermission) return

    if (watchIdRef.current !== null) return // Already watching

    const successCallback = (position: GeolocationPosition) => {
      setCurrentPosition(position)
      checkNearbySitesRef.current(position)
    }

    const errorCallback = (error: GeolocationPositionError) => {
      console.error("Geolocation error:", error)
    }

    // Use watchPosition for continuous updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      successCallback,
      errorCallback,
      {
        enableHighAccuracy: false, // Save battery
        timeout: 30000,
        maximumAge: POSITION_CHECK_INTERVAL,
      }
    )
  }, [enabled, isSupported, hasLocationPermission])

  // Stop watching position
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  // Start/stop watching based on enabled state
  useEffect(() => {
    if (enabled && hasLocationPermission && isSupported) {
      startWatching()
    } else {
      stopWatching()
    }

    return () => {
      stopWatching()
    }
  }, [enabled, hasLocationPermission, isSupported, startWatching, stopWatching])

  return {
    isSupported,
    hasLocationPermission,
    permissionError,
    currentPosition,
    nearbySites,
    lastNotification,
    requestLocationAccess,
    startWatching,
    stopWatching,
    permissionChecked,
  }
}

declare global {
  interface Window {
    __GEOFENCE_TEST_SITES?: JobSiteLocation[]
  }
}

