"use client"

import { useSearchParams } from "next/navigation"
import { useAddressSearch } from "@/hooks/useAddressSearch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AddressSearchDebug() {
  const sp = useSearchParams()
  
  const searchMode = sp.get("searchMode") || "name"
  const addressLat = sp.get("addressLat") ? parseFloat(sp.get("addressLat")!) : null
  const addressLng = sp.get("addressLng") ? parseFloat(sp.get("addressLng")!) : null
  const addressQuery = sp.get("addressQuery") || ""
  
  const addressSearchQuery = useAddressSearch({
    lat: addressLat,
    lng: addressLng,
    address: addressQuery,
    enabled: searchMode === "address" && addressLat !== null && addressLng !== null
  })
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }
  
  return (
    <Card className="border-2 border-purple-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">🔍 Address Search Debug</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div><strong>Search Mode:</strong> {searchMode}</div>
        <div><strong>Address Query:</strong> {addressQuery || '(empty)'}</div>
        <div><strong>Latitude:</strong> {addressLat ?? '(null)'}</div>
        <div><strong>Longitude:</strong> {addressLng ?? '(null)'}</div>
        <div><strong>Hook Enabled:</strong> {addressSearchQuery.isLoading !== undefined ? 'Yes' : 'No'}</div>
        <div><strong>Is Loading:</strong> {String(addressSearchQuery.isLoading)}</div>
        <div><strong>Has Data:</strong> {String(!!addressSearchQuery.data)}</div>
        <div><strong>Results Count:</strong> {addressSearchQuery.data?.length || 0}</div>
        <div><strong>Has Error:</strong> {String(!!addressSearchQuery.error)}</div>
        {addressSearchQuery.error && (
          <div className="text-red-600">
            <strong>Error:</strong> {String(addressSearchQuery.error)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

