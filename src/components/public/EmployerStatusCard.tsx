/**
 * Employer card component for audit form dashboard
 * Shows employer info, status, and action button
 */

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, ChevronRight, FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmployerSubmissionStatus } from "@/hooks/useAuditFormProgress";

interface EmployerStatusCardProps {
  employer: {
    id: string;
    name: string;
    roleOrTrade?: string;
  };
  status: EmployerSubmissionStatus;
  hasDraft: boolean;
  onClick: () => void;
  className?: string;
}

export function EmployerStatusCard({
  employer,
  status,
  hasDraft,
  onClick,
  className,
}: EmployerStatusCardProps) {
  const statusConfig = {
    not_started: {
      bgColor: 'bg-white',
      borderColor: 'border-gray-200',
      badgeVariant: 'outline' as const,
      badgeColor: 'text-gray-600',
      icon: Clock,
      iconColor: 'text-gray-400',
      label: 'Not Started',
      buttonText: 'Start Assessment',
      buttonVariant: 'default' as const,
    },
    in_progress: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-300',
      badgeVariant: 'secondary' as const,
      badgeColor: 'text-blue-700',
      icon: FileEdit,
      iconColor: 'text-blue-600',
      label: 'In Progress',
      buttonText: 'Continue',
      buttonVariant: 'outline' as const,
    },
    completed: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-300',
      badgeVariant: 'default' as const,
      badgeColor: 'text-green-700',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      label: 'Completed',
      buttonText: 'Review',
      buttonVariant: 'ghost' as const,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card 
      className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        config.bgColor,
        config.borderColor,
        "border-2",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate mb-1">
                {employer.name}
              </h3>
              {employer.roleOrTrade && (
                <p className="text-xs text-muted-foreground truncate">
                  {employer.roleOrTrade}
                </p>
              )}
            </div>
            <StatusIcon className={cn("h-5 w-5 flex-shrink-0", config.iconColor)} />
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge 
              variant={config.badgeVariant} 
              className={cn("text-xs", config.badgeColor)}
            >
              {config.label}
            </Badge>
            
            {hasDraft && status !== 'completed' && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FileEdit className="h-3 w-3" />
                Draft saved
              </span>
            )}
          </div>

          {/* Action Button */}
          <Button 
            variant={config.buttonVariant}
            size="sm" 
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            {config.buttonText}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}






