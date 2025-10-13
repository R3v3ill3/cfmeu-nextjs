"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, ExternalLink, Navigation, Map } from "lucide-react"
import { NearbyProject, formatDistance } from "@/hooks/useAddressSearch"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { CfmeuEbaBadge } from "@/components/ui/CfmeuEbaBadge"
import { OrganizingUniverseBadge } from "@/components/ui/OrganizingUniverseBadge"

interface AddressSearchResultsProps {
  searchAddress: string
  searchLat: number
  searchLng: number
  results: NearbyProject[]
  onProjectClick: (projectId: string) => void
  onShowOnMap?: () => void
  isMobile?: boolean
}

export function AddressSearchResults({
  searchAddress,
  searchLat,
  searchLng,
  results,
  onProjectClick,
  onShowOnMap,
  isMobile = false,
}: AddressSearchResultsProps) {
  const sortedResults = [...results].sort((a, b) => a.distance_km - b.distance_km)

  if (isMobile) {
    return (
      <div className="space-y-3">
        <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-sm">Projects near &quot;{searchAddress}&quot;</h3>
          <p className="text-xs text-muted-foreground">Showing {results.length} projects within 100km.</p>
        </div>
        {sortedResults.map(result => (
          <div key={result.project_id} className="border rounded-lg p-3 bg-white hover:bg-gray-50" onClick={() => onProjectClick(result.project_id)}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm truncate flex-1 pr-2">{result.project_name}</span>
              <Badge variant="outline" className="text-xs">
                {result.distance_km.toFixed(1)} km
              </Badge>
            </div>
          </div>
        ))}
        <Button onClick={onShowOnMap} variant="outline" size="sm" className="w-full">
          <Map className="h-4 w-4 mr-2" />
          Show all on map
        </Button>
      </div>
    )
  }

  const hasExactMatch = results.some(r => r.is_exact_match)

  return (
    <div className="space-y-4">
      {/* Search Location Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Navigation className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Search Location:</div>
                <div className="text-sm font-normal text-muted-foreground mt-1">
                  {searchAddress}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${searchLat},${searchLng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                  <ExternalLink className="h-4 w-4" />
                  View on Google Maps
                </Button>
              </a>
              {onShowOnMap && (
                <Button variant="outline" size="sm" onClick={onShowOnMap} className="gap-2 whitespace-nowrap">
                  <MapPin className="h-4 w-4" />
                  Show on Map
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {hasExactMatch ? 'Project Found' : `${results.length} Nearby Project${results.length !== 1 ? 's' : ''}`}
        </h3>
        {!hasExactMatch && results.length > 0 && (
          <span className="text-sm text-muted-foreground">
            Within 100km radius
          </span>
        )}
      </div>

      {/* No Results Message */}
      {results.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No projects found within 100km of this address.</p>
            <p className="text-sm text-gray-500">Try searching a different location or switch to name search.</p>
          </CardContent>
        </Card>
      )}

      {/* Results List */}
      <div className="space-y-3">
        {results.map((project, index) => (
          <Card
            key={project.project_id}
            className={`transition-colors hover:bg-accent/40 ${
              project.is_exact_match ? 'border-green-500 border-2' : ''
            }`}
          >
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-medium">
                <div className="space-y-2">
                  {/* Project Name and Distance */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="flex-shrink-0 text-lg font-semibold text-muted-foreground">
                        {index + 1}.
                      </span>
                      <span className="truncate">{project.project_name}</span>
                    </div>
                    <Badge
                      variant={project.is_exact_match ? "default" : "secondary"}
                      className={project.is_exact_match ? "bg-green-600 hover:bg-green-700 whitespace-nowrap" : "whitespace-nowrap"}
                    >
                      {project.is_exact_match ? "✓ EXACT MATCH" : formatDistance(project.distance_km)}
                    </Badge>
                  </div>

                  {/* Badges Row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {project.project_tier && (
                      <ProjectTierBadge tier={project.project_tier as any} />
                    )}
                    {project.organising_universe && (
                      <OrganizingUniverseBadge
                        projectId={project.project_id}
                        currentStatus={project.organising_universe as any}
                        size="sm"
                        className="text-[10px]"
                      />
                    )}
                    {project.stage_class && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {project.stage_class.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-2 space-y-3">
              {/* Address */}
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{project.job_site_address}</span>
              </div>

              {/* Builder */}
              {project.builder_name && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Builder: </span>
                  <span className="font-medium">{project.builder_name}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => onProjectClick(project.project_id)}
                >
                  View Project
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
