"use client"

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Building, HardHat, Info } from "lucide-react";
import { ProjectSubsetStats } from "@/hooks/useProjectSubsetStats";

interface SubsetEbaStatsProps {
  stats: ProjectSubsetStats;
  onClick?: () => void;
  variant?: 'compact' | 'detailed' | 'card';
  className?: string;
}

/**
 * Component to display EBA statistics for the subset of key employers/trades:
 * - Builders and Project Managers
 * - Demolition, Piling, Concrete, Scaffolding, Form Work, Tower Crane, Mobile Crane
 */
export function SubsetEbaStats({ 
  stats, 
  onClick, 
  variant = 'compact',
  className = ""
}: SubsetEbaStatsProps) {
  const { known_employer_count, eba_active_count, eba_percentage } = stats;

  if (variant === 'compact') {
    return (
      <CompactSubsetStats 
        stats={stats} 
        onClick={onClick} 
        className={className}
      />
    );
  }

  if (variant === 'card') {
    return (
      <CardSubsetStats 
        stats={stats} 
        onClick={onClick} 
        className={className}
      />
    );
  }

  return (
    <DetailedSubsetStats 
      stats={stats} 
      onClick={onClick} 
      className={className}
    />
  );
}

function CompactSubsetStats({ stats, onClick, className }: SubsetEbaStatsProps) {
  const { known_employer_count, eba_active_count, eba_percentage } = stats;

  if (known_employer_count === 0) {
    return (
      <div className={`text-xs text-muted-foreground ${className}`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                <HardHat className="h-3 w-3" />
                No key contractors
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>No builders, project managers, or key trade contractors found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Key trades: Demolition, Piling, Concrete, Scaffolding, Form Work, Cranes
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-2 py-1 transition-colors ${className}`}
          >
            <HardHat className="h-3 w-3" />
            <span className="font-medium">{known_employer_count}</span>
            <span className="text-muted-foreground">key contractors</span>
            <div className="flex items-center gap-1">
              <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${Math.min(eba_percentage, 100)}%` }}
                />
              </div>
              <span className="font-medium text-green-600">{eba_percentage}%</span>
              <span className="text-muted-foreground">EBA</span>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Key Contractor EBA Status</p>
            <p>{eba_active_count} of {known_employer_count} have active EBAs ({eba_percentage}%)</p>
            <p className="text-xs text-muted-foreground mt-2">
              Includes: Builders, Project Managers, and key trades
            </p>
            <p className="text-xs text-muted-foreground">
              (Demolition, Piling, Concrete, Scaffolding, Form Work, Cranes)
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DetailedSubsetStats({ stats, onClick, className }: SubsetEbaStatsProps) {
  const { known_employer_count, eba_active_count, eba_percentage } = stats;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardHat className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Key Contractor EBA Coverage</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">Covers key project roles and trades:</p>
                  <p className="text-xs">• Builders and Project Managers</p>
                  <p className="text-xs">• Demolition, Piling, Concrete</p>
                  <p className="text-xs">• Scaffolding, Form Work, Cranes</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Badge variant="outline">
          {eba_active_count}/{known_employer_count}
        </Badge>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">EBA Coverage</span>
          <span className="font-medium">{eba_percentage}%</span>
        </div>
        <Progress 
          value={eba_percentage} 
          className="h-2"
        />
      </div>
      
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          className="text-xs text-primary hover:underline"
        >
          View details →
        </button>
      )}
    </div>
  );
}

function CardSubsetStats({ stats, onClick, className }: SubsetEbaStatsProps) {
  const { known_employer_count, eba_active_count, eba_percentage } = stats;

  return (
    <Card className={`${className} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building className="h-4 w-4" />
          Key Contractor EBA Status
        </CardTitle>
        <CardDescription className="text-xs">
          Builders, Project Managers & Core Trades
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total Contractors</span>
          <Badge variant="secondary">{known_employer_count}</Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">With Active EBA</span>
          <Badge variant={eba_active_count > 0 ? "default" : "destructive"}>
            {eba_active_count}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">EBA Coverage</span>
            <span className="font-medium text-green-600">{eba_percentage}%</span>
          </div>
          <Progress value={eba_percentage} className="h-2" />
        </div>
        
        <div className="text-xs text-muted-foreground">
          <p>Includes: Demolition, Piling, Concrete, Scaffolding, Form Work, Cranes</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default SubsetEbaStats;
