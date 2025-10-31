"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { format } from "date-fns";

interface ProjectComplianceCardProps {
  projectId: string;
}

export function ProjectComplianceCard({ projectId }: ProjectComplianceCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { data: breakdown, isLoading } = useProjectComplianceBreakdown(projectId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading compliance rating...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!breakdown) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">No compliance data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { rating, coreCompliance, builder, keyContractors, summary } = breakdown;
  const trafficLightInfo = TRAFFIC_LIGHT_LABELS[rating.overallRating];

  return (
    <div className="space-y-4">
      {/* Overall Rating Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Project Compliance Rating</CardTitle>
            <Badge
              variant={rating.overallRating >= 3 ? "default" : rating.overallRating >= 2 ? "secondary" : "destructive"}
              className="text-sm"
            >
              {trafficLightInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Score Visualization */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="text-2xl font-bold">{trafficLightInfo.label}</div>
              <div className="text-sm text-muted-foreground">
                Based on {summary.totalKeyContractors} key contractors
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: `var(--${trafficLightInfo.color}-600)` }}>
                {rating.overallRating}/4
              </div>
              <Progress
                value={(rating.overallRating / 4) * 100}
                className="w-24 h-2 mt-1"
              />
            </div>
          </div>

          {/* Component Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Core Compliance */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">Core Compliance</h4>
                <Badge variant="outline" className="text-xs">10%</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Site Delegate</span>
                  {coreCompliance.delegateIdentified ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>HSR Chair</span>
                  {coreCompliance.hsrChairExists ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>
                {coreCompliance.delegateInfo && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Delegate: {coreCompliance.delegateInfo.name}
                  </div>
                )}
                {coreCompliance.hsrInfo && (
                  <div className="text-xs text-muted-foreground">
                    HSR: {coreCompliance.hsrInfo.name}
                  </div>
                )}
              </div>
            </div>

            {/* Traffic Light Component */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">Traffic Light Rating</h4>
                <Badge variant="outline" className="text-xs">90%</Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Builder</span>
                  {builder?.trafficLightRating ? (
                    <Badge
                      variant={builder.trafficLightRating.rating >= 3 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {builder.trafficLightRating.label}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Not Rated</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Contractors (Avg)</span>
                  {rating.contractorAverageRating ? (
                    <Badge
                      variant={rating.contractorAverageRating.rating >= 3 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {rating.contractorAverageRating.label}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Not Rated</Badge>
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
            className="w-full"
          >
            {showDetails ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show Details
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      {showDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Builder Details */}
            {builder && (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Builder/Head Contractor
                </h4>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{builder.employerName}</span>
                    <div className="flex items-center gap-2">
                      {builder.hasEba && (
                        <Badge variant="default" className="text-xs">EBA</Badge>
                      )}
                      {builder.trafficLightRating && (
                        <Badge
                          variant={builder.trafficLightRating.rating >= 3 ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {builder.trafficLightRating.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Role: {builder.roleLabel}
                  </div>
                </div>
              </div>
            )}

            {builder && keyContractors.length > 0 && <Separator />}

            {/* Key Contractors Details */}
            {keyContractors.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Key Contractors ({summary.contractorsWithRatings}/{summary.totalKeyContractors} rated)
                </h4>
                <div className="space-y-2">
                  {keyContractors.map((contractor) => (
                    <div key={contractor.employerId} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{contractor.employerName}</span>
                        <div className="flex items-center gap-2">
                          {contractor.hasEba && (
                            <Badge variant="default" className="text-xs">EBA</Badge>
                          )}
                          {contractor.trafficLightRating ? (
                            <Badge
                              variant={contractor.trafficLightRating.rating >= 3 ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {contractor.trafficLightRating.label}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Not Rated</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Trade: {contractor.tradeLabel}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unrated Contractors Warning */}
            {summary.contractorsWithRatings < summary.totalKeyContractors && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <div className="font-medium">Missing Traffic Light Ratings</div>
                  <div className="text-amber-700">
                    {summary.totalKeyContractors - summary.contractorsWithRatings} contractors don't have traffic light ratings yet.
                    These are being calculated as "Critical" in the overall project rating.
                  </div>
                </div>
              </div>
            )}

            {/* Info Message */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <div className="font-medium">About This Rating</div>
                <div className="text-blue-700">
                  This rating combines core compliance (10%) with traffic light ratings from the builder and key contractors (90%).
                  Delegate and HSR information is automatically retrieved from mapping sheet data.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}