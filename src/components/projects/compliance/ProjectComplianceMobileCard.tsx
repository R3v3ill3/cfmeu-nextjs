"use client"

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Shield,
  Building,
  TrendingUp,
  Check,
  X,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useState } from "react";
import { useProjectComplianceBreakdown } from "./hooks/useProjectComplianceRating";
import { TRAFFIC_LIGHT_LABELS } from "./utils/trafficLightIntegration";

interface ProjectComplianceMobileCardProps {
  projectId: string;
  showFullDetails?: boolean;
}

export function ProjectComplianceMobileCard({
  projectId,
  showFullDetails = false
}: ProjectComplianceMobileCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { data: breakdown, isLoading } = useProjectComplianceBreakdown(projectId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-6">
            <div className="text-sm text-muted-foreground">Loading compliance rating...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!breakdown) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-6">
            <div className="text-sm text-muted-foreground">No compliance data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { rating, coreCompliance, builder, keyContractors, summary } = breakdown;
  const trafficLightInfo = TRAFFIC_LIGHT_LABELS[rating.overallRating];

  return (
    <div className="space-y-4">
      {/* Overall Rating - Mobile Optimized */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Main Score Display */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold">{trafficLightInfo.label}</div>
              <div className="text-xs text-muted-foreground">
                {summary.totalKeyContractors} contractors
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: `var(--${trafficLightInfo.color}-600)` }}>
                {rating.overallRating}/4
              </div>
              <Progress
                value={(rating.overallRating / 4) * 100}
                className="w-20 h-2 mt-1"
              />
            </div>
          </div>

          {/* Quick Status Indicators */}
          <div className="grid grid-cols-2 gap-3">
            {/* Core Compliance */}
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-1 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Core (10%)</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Delegate</span>
                  {coreCompliance.delegateIdentified ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <X className="h-3 w-3 text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">HSR</span>
                  {coreCompliance.hsrChairExists ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <X className="h-3 w-3 text-red-600" />
                  )}
                </div>
              </div>
            </div>

            {/* Traffic Light Rating */}
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-1 mb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Traffic Light (90%)</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Builder</span>
                  {builder?.trafficLightRating ? (
                    <Badge
                      variant={builder.trafficLightRating.rating >= 3 ? "default" : "destructive"}
                      className="text-xs px-1 py-0"
                    >
                      {builder.trafficLightRating.rating}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs px-1 py-0">—</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Contractors</span>
                  {rating.contractorAverageRating ? (
                    <Badge
                      variant={rating.contractorAverageRating.rating >= 3 ? "default" : "destructive"}
                      className="text-xs px-1 py-0"
                    >
                      {rating.contractorAverageRating.rating}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs px-1 py-0">—</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Toggle Details */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full text-xs h-8"
          >
            {showDetails ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show Details
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Detailed Breakdown - Mobile Optimized */}
      {showDetails && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h4 className="font-medium text-sm">Compliance Details</h4>

            {/* Builder Details */}
            {builder && (
              <div>
                <h5 className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">
                  Builder/Head Contractor
                </h5>
                <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{builder.employerName}</span>
                    <div className="flex items-center gap-1">
                      {builder.hasEba && (
                        <Badge variant="default" className="text-xs px-1 py-0">EBA</Badge>
                      )}
                      {builder.trafficLightRating && (
                        <Badge
                          variant={builder.trafficLightRating.rating >= 3 ? "default" : "destructive"}
                          className="text-xs px-1 py-0"
                        >
                          {builder.trafficLightRating.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {builder.roleLabel}
                  </div>
                </div>
              </div>
            )}

            {/* Key Contractors */}
            {keyContractors.length > 0 && (
              <div>
                <h5 className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">
                  Key Contractors ({summary.contractorsWithRatings}/{summary.totalKeyContractors} rated)
                </h5>
                <div className="space-y-2">
                  {keyContractors.slice(0, 3).map((contractor) => (
                    <div key={contractor.employerId} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate flex-1 mr-2">
                          {contractor.employerName}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {contractor.hasEba && (
                            <Badge variant="default" className="text-xs px-1 py-0">EBA</Badge>
                          )}
                          {contractor.trafficLightRating ? (
                            <Badge
                              variant={contractor.trafficLightRating.rating >= 3 ? "default" : "destructive"}
                              className="text-xs px-1 py-0"
                            >
                              {contractor.trafficLightRating.rating}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs px-1 py-0">—</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {contractor.tradeLabel}
                      </div>
                    </div>
                  ))}

                  {keyContractors.length > 3 && (
                    <div className="text-center text-xs text-muted-foreground py-2">
                      +{keyContractors.length - 3} more contractors
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Warning for missing ratings */}
            {summary.contractorsWithRatings < summary.totalKeyContractors && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800">
                  <div className="font-medium">Missing Ratings</div>
                  <div className="text-amber-700">
                    {summary.totalKeyContractors - summary.contractorsWithRatings} contractors need traffic light ratings.
                  </div>
                </div>
              </div>
            )}

            {/* Info message */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <div className="font-medium">About This Rating</div>
                <div className="text-blue-700">
                  Combines core compliance (10%) with traffic light ratings from builder and key contractors (90%).
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}