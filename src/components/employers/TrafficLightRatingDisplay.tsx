"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Rating color mapping for 4-point system (1=good, 4=terrible)
const ratingColors = {
  green: { bg: "bg-green-100", text: "text-green-800", border: "border-green-200", dot: "bg-green-500" },
  yellow: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200", dot: "bg-yellow-500" },
  amber: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-500" },
  red: { bg: "bg-red-100", text: "text-red-800", border: "border-red-200", dot: "bg-red-500" },
};

const confidenceColors = {
  high: "text-green-600",
  medium: "text-amber-600",
  low: "text-red-600",
  very_low: "text-red-800"
};

const sourceColors = {
  organiser_expertise: "bg-blue-100 text-blue-800 border-blue-200",
  project_average: "bg-purple-100 text-purple-800 border-purple-200",
  calculated: "bg-gray-100 text-gray-800 border-gray-200"
};

interface TrafficLightRatingDisplayProps {
  rating: 'red' | 'amber' | 'yellow' | 'green';
  confidence?: 'very_high' | 'high' | 'medium' | 'low';
  source?: 'organiser_expertise' | 'project_average' | 'calculated';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showConfidence?: boolean;
  showSource?: boolean;
  className?: string;
}

export function TrafficLightRatingDisplay({
  rating,
  confidence,
  source,
  size = 'md',
  showLabel = false,
  showConfidence = false,
  showSource = false,
  className
}: TrafficLightRatingDisplayProps) {
  const colors = ratingColors[rating];

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2"
  };

  const dotSizes = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4"
  };

  const content = (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Rating indicator dot */}
      <div className={cn("rounded-full", dotSizes[size], colors.dot)} />

      {/* Rating text */}
      <span className={cn("font-medium capitalize", colors.text)}>
        {showLabel ? `${rating} Rating` : rating.charAt(0).toUpperCase() + rating.slice(1)}
      </span>

      {/* Confidence indicator */}
      {showConfidence && confidence && (
        <div className={cn("w-2 h-2 rounded-full", confidenceColors[confidence])} />
      )}

      {/* Source indicator */}
      {showSource && source && (
        <Badge variant="outline" className={cn("text-xs", sourceColors[source])}>
          {source === 'organiser_expertise' ? 'Expertise' :
           source === 'project_average' ? 'Project' : 'Calculated'}
        </Badge>
      )}
    </div>
  );

  // If we need tooltips or additional info
  if (confidence || source) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("inline-flex items-center gap-2 cursor-help")}>
              <Badge
                variant="outline"
                className={cn(colors.bg, colors.text, colors.border, sizeClasses[size], "font-medium")}
              >
                {content}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <div className="font-medium capitalize">{rating} Rating</div>
              {confidence && (
                <div>Confidence: {confidence.replace('_', ' ')}</div>
              )}
              {source && (
                <div>
                  Source: {source === 'organiser_expertise' ? 'Organiser Expertise' :
                          source === 'project_average' ? 'Project Average' : 'Calculated'}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Simple badge without tooltip
  return (
    <Badge
      variant="outline"
      className={cn(colors.bg, colors.text, colors.border, sizeClasses[size], "font-medium")}
    >
      {content}
    </Badge>
  );
}
