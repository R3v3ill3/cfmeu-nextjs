"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { MapPin, Layers, Eye, EyeOff, Printer, Download } from "lucide-react"
import dynamic from "next/dynamic"

// Dynamically import the map component to avoid SSR issues
const InteractiveMap = dynamic(
  () => import("@/components/map/InteractiveMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }
)

// Client-side only wrapper to prevent hydration issues
function ClientOnlyMapWrapper(props: any) {
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }
  
  return <InteractiveMap {...props} />
}

export default function MapPage() {
  const [showJobSites, setShowJobSites] = useState(true)
  const [showPatches, setShowPatches] = useState(true)
  const [mapMode, setMapMode] = useState<"standard" | "satellite">("standard")
  const [showPatchNames, setShowPatchNames] = useState(false)
  const [showOrganisers, setShowOrganisers] = useState(false)

  // Only show geographic patches
  const selectedPatchTypes = ["geo"]

  const handlePrintMap = () => {
    // Add print-specific class to body for styling
    document.body.classList.add('printing-map')
    
    // Trigger print
    window.print()
    
    // Remove print class after printing
    setTimeout(() => {
      document.body.classList.remove('printing-map')
    }, 1000)
  }

  const handleExportMap = async () => {
    try {
      // Create a canvas from the map
      const mapDiv = document.querySelector('.print-show') as HTMLElement
      if (!mapDiv) return
      
      // Use html2canvas to capture the map
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(mapDiv, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        width: 1200,
        height: 800
      })
      
      // Create download link
      const link = document.createElement('a')
      link.download = `cfmeu-map-${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try using the print function instead.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interactive Map</h1>
          <p className="text-gray-600 mt-1">
            View patch boundaries and job sites across your territories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMap}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintMap}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Controls */}
        <div className="lg:col-span-1 space-y-4 no-print">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5" />
                Map Layers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Job Sites Toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="job-sites" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Job Sites
                </Label>
                <Switch
                  id="job-sites"
                  checked={showJobSites}
                  onCheckedChange={setShowJobSites}
                />
              </div>

              <Separator />

              {/* Patches Toggle */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="patches" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Geographic Patches
                  </Label>
                  <Switch
                    id="patches"
                    checked={showPatches}
                    onCheckedChange={setShowPatches}
                  />
                </div>

                {showPatches && (
                  <div className="space-y-2 pl-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-red-500" />
                      <span className="text-sm text-gray-600">Geographic patch boundaries</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="patch-names" className="text-sm">Show patch names</Label>
                      <Switch id="patch-names" checked={showPatchNames} onCheckedChange={setShowPatchNames} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="patch-organisers" className="text-sm">Show organiser names</Label>
                      <Switch id="patch-organisers" checked={showOrganisers} onCheckedChange={setShowOrganisers} />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Map Style */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Map Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={mapMode === "standard" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMapMode("standard")}
                  >
                    Standard
                  </Button>
                  <Button
                    variant={mapMode === "satellite" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMapMode("satellite")}
                  >
                    Satellite
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {showJobSites && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Job Sites</span>
                </div>
              )}
              
              {showPatches && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Patch Boundaries:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-red-500 border border-black" />
                    <span className="text-sm">Geographic Patches</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Map Display */}
        <div className="lg:col-span-3">
          <Card className="h-[800px]">
            <CardContent className="p-0 h-full print-show">
              {/* Print-only elements */}
              <div className="print-only print-title">
                CFMEU Interactive Map - {new Date().toLocaleDateString()}
              </div>
              
              <ClientOnlyMapWrapper
                showJobSites={showJobSites}
                showPatches={showPatches}
                selectedPatchTypes={selectedPatchTypes}
                mapMode={mapMode}
                showPatchNames={showPatchNames}
                showOrganisers={showOrganisers}
              />
              
              {/* Print-only legend */}
              <div className="print-only print-legend">
                <div className="font-bold mb-2">Legend</div>
                {showJobSites && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-blue-600 border border-black"></div>
                    <span className="text-xs">Job Sites</span>
                  </div>
                )}
                {showPatches && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-1 bg-red-500 border border-black"></div>
                    <span className="text-xs">Geographic Patches</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
