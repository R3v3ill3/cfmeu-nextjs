"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Building2, Target, ExternalLink, Loader2 } from "lucide-react"
import { TrafficLightRatingDisplay } from "@/components/employers/TrafficLightRatingDisplay"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { useLocalStorage } from "react-use"

type CorrelationType = 'working_together' | 'builder_networks' | 'compliance_patterns'

interface CorrelationAnalyticsProps {
  categoryType: 'contractor_role' | 'trade'
  categoryCode: string
  currentOnly: boolean
  includeDerived: boolean
  includeManual: boolean
}

export function CorrelationAnalytics({
  categoryType,
  categoryCode,
  currentOnly,
  includeDerived,
  includeManual
}: CorrelationAnalyticsProps) {
  const { startNavigation } = useNavigationLoading()
  
  const [activeMode, setActiveMode] = useLocalStorage<CorrelationType>(
    'eba-employers-analytics-mode',
    'working_together'
  )

  const { data, isLoading, error } = useQuery({
    queryKey: ['employer-correlations', activeMode, categoryType, categoryCode, currentOnly, includeDerived, includeManual],
    enabled: !!categoryCode,
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('type', activeMode || 'working_together')
      params.set('categoryType', categoryType)
      params.set('categoryCode', categoryCode)
      if (currentOnly) params.set('currentOnly', 'true')
      if (!includeDerived) params.set('includeDerived', 'false')
      if (!includeManual) params.set('includeManual', 'false')
      
      const res = await fetch(`/api/eba/employer-correlations?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch correlation data')
      const json = await res.json()
      return json.data || []
    },
  })

  if (!categoryCode) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Select a category to view analytics
      </div>
    )
  }

  return (
    <Tabs value={activeMode || 'working_together'} onValueChange={(v) => setActiveMode(v as CorrelationType)}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="working_together" className="gap-2">
          <Users className="h-4 w-4" />
          Working Together
        </TabsTrigger>
        <TabsTrigger value="builder_networks" className="gap-2">
          <Building2 className="h-4 w-4" />
          Builder Networks
        </TabsTrigger>
        <TabsTrigger value="compliance_patterns" className="gap-2">
          <Target className="h-4 w-4" />
          Compliance Patterns
        </TabsTrigger>
      </TabsList>

      <div className="mt-4">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading analytics...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-sm text-destructive">
            Failed to load analytics data
          </div>
        )}

        {!isLoading && !error && (
          <>
            <TabsContent value="working_together" className="mt-0">
              <WorkingTogetherView data={data} startNavigation={startNavigation} />
            </TabsContent>

            <TabsContent value="builder_networks" className="mt-0">
              <BuilderNetworksView data={data} startNavigation={startNavigation} />
            </TabsContent>

            <TabsContent value="compliance_patterns" className="mt-0">
              <CompliancePatternsView data={data} />
            </TabsContent>
          </>
        )}
      </div>
    </Tabs>
  )
}

function WorkingTogetherView({ data, startNavigation }: any) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No employer pairs found working on multiple shared projects
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((pair: any, idx: number) => (
        <Card key={idx}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{pair.employer1.name}</span>
                  <Badge variant="outline" className="text-xs">+</Badge>
                  <span className="font-medium">{pair.employer2.name}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">
                    {pair.count} shared project{pair.count !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pair.shared_projects.slice(0, 5).map((project: any) => (
                    <Button
                      key={project.id}
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 text-xs"
                      onClick={() => {
                        startNavigation(`/projects/${project.id}`)
                        setTimeout(() => window.location.href = `/projects/${project.id}`, 50)
                      }}
                    >
                      {project.name}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  ))}
                  {pair.shared_projects.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{pair.shared_projects.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function BuilderNetworksView({ data, startNavigation }: any) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No builder networks found with multiple EBA employers
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((network: any, idx: number) => {
        const isExpanded = expanded[network.builder.id] || false
        const displayEmployers = isExpanded ? network.employers : network.employers.slice(0, 3)
        
        return (
          <Card key={idx}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">{network.builder.name}</span>
                  </div>
                  <Badge variant="secondary">
                    {network.employers.length} employer{network.employers.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="space-y-1.5 pl-7">
                  {displayEmployers.map((employer: any) => (
                    <div key={employer.id} className="text-sm text-muted-foreground">
                      • {employer.name}
                    </div>
                  ))}
                </div>

                {network.employers.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs ml-7"
                    onClick={() => setExpanded({ ...expanded, [network.builder.id]: !isExpanded })}
                  >
                    {isExpanded ? 'Show less' : `Show ${network.employers.length - 3} more`}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function CompliancePatternsView({ data }: any) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No rating patterns found for employers in this category
      </div>
    )
  }

  const ratingOrder = ['green', 'amber', 'yellow', 'red', 'no_rating']
  const sortedData = [...data].sort((a, b) => {
    const aIndex = ratingOrder.indexOf(a.rating)
    const bIndex = ratingOrder.indexOf(b.rating)
    return aIndex - bIndex
  })

  return (
    <div className="space-y-3">
      {sortedData.map((pattern: any, idx: number) => (
        <Card key={idx}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {pattern.rating !== 'no_rating' ? (
                    <TrafficLightRatingDisplay
                      rating={pattern.rating}
                      size="sm"
                      showLabel
                    />
                  ) : (
                    <Badge variant="outline" className="text-xs">No Rating</Badge>
                  )}
                  <Badge variant="secondary" className="capitalize text-xs">
                    {pattern.confidence.replace('_', ' ')} confidence
                  </Badge>
                </div>
                <Badge variant="outline">
                  {pattern.count} employer{pattern.count !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {pattern.employers.slice(0, 6).map((employer: any) => (
                  <div key={employer.id} className="text-sm text-muted-foreground truncate">
                    • {employer.name}
                  </div>
                ))}
              </div>

              {pattern.employers.length > 6 && (
                <div className="text-xs text-muted-foreground">
                  +{pattern.employers.length - 6} more employer{pattern.employers.length - 6 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}









