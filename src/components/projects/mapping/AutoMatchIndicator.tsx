"use client"

import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, UserCheck, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AutoMatchIndicatorProps {
  matchStatus?: 'auto_matched' | 'confirmed' | 'needs_review' | 'delegate_confirmed' | 'incorrect_via_delegate';
  dataSource?: 'manual' | 'bci_import' | 'other_import' | 'public_form';
  matchConfidence?: number;
  matchNotes?: string;
  className?: string;
}

export function AutoMatchIndicator({ 
  matchStatus = 'confirmed',
  dataSource = 'manual', 
  matchConfidence,
  matchNotes,
  className = ""
}: AutoMatchIndicatorProps) {
  // Don't show indicator for manual entries
  if (dataSource === 'manual') {
    return null;
  }

  const getIndicatorConfig = () => {
    switch (matchStatus) {
      case 'auto_matched':
        return {
          icon: AlertTriangle,
          variant: 'destructive' as const,
          text: 'BCI Match - needs review',
          description: 'Auto-matched from BCI import - requires confirmation'
        };
      case 'needs_review':
        return {
          icon: Clock,
          variant: 'secondary' as const,
          text: 'Under Review',
          description: 'Assignment flagged for manual review'
        };
      case 'confirmed':
        return {
          icon: CheckCircle,
          variant: 'default' as const,
          text: 'Confirmed',
          description: 'Assignment confirmed by user'
        };
      case 'delegate_confirmed':
        return {
          icon: UserCheck,
          variant: 'default' as const,
          text: 'Confirmed by Delegate',
          description: 'Assignment confirmed by external delegate via shared form'
        };
      case 'incorrect_via_delegate':
        return {
          icon: X,
          variant: 'destructive' as const,
          text: 'Marked Incorrect',
          description: 'Assignment marked as incorrect by external delegate'
        };
      default:
        return null;
    }
  };

  const config = getIndicatorConfig();
  if (!config) return null;

  const { icon: Icon, variant, text, description } = config;

  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">{description}</div>
      {dataSource === 'bci_import' && (
        <div className="text-sm text-muted-foreground">Source: BCI Project Data</div>
      )}
      {matchConfidence !== undefined && matchConfidence < 1 && (
        <div className="text-sm text-muted-foreground">
          Confidence: {Math.round(matchConfidence * 100)}%
        </div>
      )}
      {matchNotes && (
        <div className="text-sm text-muted-foreground border-t pt-1 mt-1">
          {matchNotes}
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={`inline-flex items-center gap-1 ${className}`}>
            <Icon className="w-3 h-3" />
            {text}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
