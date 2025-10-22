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
  const [hasPermission, setHasPermission] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null)
  const [nearbySites, setNearbySites] = useState<JobSiteLocation[]>([])
  const watchIdRef = useRef<number | null>(null)
  const notificationCooldownRef = useRef<Map<string, number>>(new Map())
  const lastNotificationRef = useRef<GeofenceNotification | null>(null)

  // Check if geolocation and notifications are supported
  useEffect(() => {
    const supported = 
      "geolocation" in navigator && 
      "Notification" in window
    
    setIsSupported(supported)
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
    enabled: enabled && isSupported,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch job sites with coordinates (filtered by user's patches for organisers)
  const { data: jobSites = [] } = useQuery({
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
    enabled: enabled && isSupported && !!userPatchScope,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

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

  // Send notification for nearby site
  const sendNotification = useCallback(async (site: JobSiteLocation) => {
    if (!hasPermission || isSiteInCooldown(site.id)) return

    try {
      // Check if browser supports notifications
      if (Notification.permission === "granted") {
        const notification = new Notification("Site Visit Reminder", {
          body: `You're near ${site.name}. Tap to record a site visit.`,
          icon: "/icon-192x192.png", // Assumes PWA icon exists
          tag: `site-visit-${site.id}`, // Prevents duplicate notifications
          requireInteraction: false,
          data: {
            siteId: site.id,
            siteName: site.name,
            projectId: site.project_id,
            projectName: site.project_name,
          },
        })

        // Handle notification click
        notification.onclick = () => {
          window.focus()
          // Store notification data for form to pick up
          sessionStorage.setItem("pendingSiteVisit", JSON.stringify({
            job_site_id: site.id,
            project_id: site.project_id,
          }))
          // Navigate to site visits page or open form
          window.location.href = "/site-visits?openForm=true"
          notification.close()
        }

        // Set cooldown for this site
        notificationCooldownRef.current.set(site.id, Date.now())
        
        lastNotificationRef.current = {
          siteId: site.id,
          siteName: site.name,
          projectId: site.project_id,
          projectName: site.project_name,
          timestamp: Date.now(),
        }
      }
    } catch (error) {
      console.error("Error sending notification:", error)
    }
  }, [hasPermission, isSiteInCooldown])

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

    // Send notification for first nearby site
    if (nearby.length > 0 && hasPermission) {
      // Sort by distance and notify about closest site only
      const sorted = nearby.sort((a, b) => {
        const distA = calculateDistance(userLat, userLon, a.latitude, a.longitude)
        const distB = calculateDistance(userLat, userLon, b.latitude, b.longitude)
        return distA - distB
      })
      
      sendNotification(sorted[0])
    }
  }, [jobSites, calculateDistance, hasPermission, sendNotification])

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) return false

    try {
      const permission = await Notification.requestPermission()
      setHasPermission(permission === "granted")
      return permission === "granted"
    } catch (error) {
      console.error("Error requesting notification permission:", error)
      return false
    }
  }, [isSupported])

  // Store checkNearbySites in a ref to avoid dependency issues
  const checkNearbySitesRef = useRef(checkNearbySites)
  useEffect(() => {
    checkNearbySitesRef.current = checkNearbySites
  }, [checkNearbySites])

  // Start watching position
  const startWatching = useCallback(() => {
    if (!enabled || !isSupported || !hasPermission) return

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
  }, [enabled, isSupported, hasPermission])

  // Stop watching position
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  // Start/stop watching based on enabled state
  useEffect(() => {
    if (enabled && hasPermission && isSupported) {
      startWatching()
    } else {
      stopWatching()
    }

    return () => {
      stopWatching()
    }
  }, [enabled, hasPermission, isSupported])

  return {
    isSupported,
    hasPermission,
    currentPosition,
    nearbySites,
    lastNotification: lastNotificationRef.current,
    requestPermission,
    startWatching,
    stopWatching,
  }
}

