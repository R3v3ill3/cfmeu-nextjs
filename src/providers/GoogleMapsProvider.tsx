"use client"

import { createContext, useContext, ReactNode } from "react"
import { useLoadScript } from "@react-google-maps/api"

const libraries: ("geometry" | "places")[] = ["geometry", "places"]

interface GoogleMapsContextValue {
  isLoaded: boolean
  loadError: Error | undefined
}

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: undefined
})

export function useGoogleMaps() {
  const context = useContext(GoogleMapsContext)
  if (!context) {
    throw new Error("useGoogleMaps must be used within GoogleMapsProvider")
  }
  return context
}

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const { isLoaded, loadError } = useLoadScript({
    id: "google-maps-script-global",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
    preventGoogleFontsLoading: true, // Prevent additional font loading
  })

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  )
}

