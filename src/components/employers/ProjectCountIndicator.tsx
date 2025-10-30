"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  PieChart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectCountData } from "@/types/rating";

interface ProjectCountIndicatorProps {
  data: ProjectCountData;
  className?: string;
  compact?: boolean;
}

export function ProjectCountIndicator({
  data,
  className,
  compact = false
}: ProjectCountIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  const completionPercentage = (data.assessed_projects / data.total_projects) * 100;

  const getDataQualityColor = (quality: string) => {
    switch (quality) {
      case 'high':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'medium':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'low':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-2 text-sm", className)}>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {data.assessed_projects}/{data.total_projects}
              </span>
              <div className="w-12">
                <Progress
                  value={completionPercentage}
                  className="h-2"
                  indicatorClassName={getProgressColor(completionPercentage)}
                />
              </div>
              <Badge
                variant="outline"
                className={cn("text-xs", getDataQualityColor(data.data_quality))}
              >
                {data.data_quality}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2">
              <p className="font-medium">Project Data Coverage</p>
              <p className="text-xs text-muted-foreground">
                {completionPercentage.toFixed(1)}% of projects assessed
              </p>
              <div className="text-xs space-y-1">
                <p>Project Data: {data.weight_distribution.project_data}%</p>
                <p>Organiser Expertise: {data.weight_distribution.organiser_expertise}%</p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className={cn("border-l-4 border-l-blue-200", className)}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Project Data Coverage</h3>
            </div>
            <Badge
              variant="outline"
              className={cn("text-xs", getDataQualityColor(data.data_quality))}
            >
              {data.data_quality === 'high' ? 'High' : data.data_quality === 'medium' ? 'Medium' : 'Low'} Quality
            </Badge>
          </div>

          {/* Project Count with Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Assessed Projects</span>
              <span className="font-medium">
                {data.assessed_projects} / {data.total_projects}
              </span>
            </div>
            <div className="space-y-1">
              <Progress
                value={completionPercentage}
                className="h-3"
                indicatorClassName={getProgressColor(completionPercentage)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{completionPercentage.toFixed(1)}% complete</span>
                <span>{data.total_projects - data.assessed_projects} remaining</span>
              </div>
            </div>
          </div>

          {/* Weight Distribution */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Rating Weight Distribution</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-200">
                      The relative importance of project data vs organiser expertise in the final rating.
                      This changes based on data quality and quantity.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-2">
              {/* Project Data Weight */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-3 w-3 text-blue-600" />
                    <span>Project Data</span>
                  </div>
                  <span className="font-medium">{data.weight_distribution.project_data}%</span>
                </div>
                <Progress
                  value={data.weight_distribution.project_data}
                  className="h-2"
                  indicatorClassName="bg-blue-500"
                />
              </div>

              {/* Organiser Expertise Weight */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-green-600" />
                    <span>Organiser Expertise</span>
                  </div>
                  <span className="font-medium">{data.weight_distribution.organiser_expertise}%</span>
                </div>
                <Progress
                  value={data.weight_distribution.organiser_expertise}
                  className="h-2"
                  indicatorClassName="bg-green-500"
                />
              </div>
            </div>
          </div>

          {/* Status Messages */}
          <div className="space-y-2">
            {completionPercentage >= 80 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Strong project data coverage</span>
              </div>
            )}

            {completionPercentage >= 50 && completionPercentage < 80 && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <TrendingUp className="h-4 w-4" />
                <span>Good coverage, more assessments would improve accuracy</span>
              </div>
            )}

            {completionPercentage < 50 && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Limited project data - organiser expertise weighted more heavily</span>
              </div>
            )}
          </div>

          {/* Detailed Weight Explanation */}
          {data.weight_distribution.organiser_expertise > 60 && (
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Expertise-Weighted Rating</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Due to limited project data, this rating relies more heavily on organiser expertise assessments.
                    Adding more project assessments will improve rating accuracy.
                  </p>
                </div>
              </div>
            </div>
          )}

          {data.weight_distribution.project_data > 60 && (
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Data-Driven Rating</p>
                  <p className="text-xs text-green-700 mt-1">
                    This rating is primarily based on comprehensive project compliance data.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}