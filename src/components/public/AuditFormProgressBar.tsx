/**
 * Progress bar component for audit forms
 * Shows completion progress across multiple employers
 */

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditFormProgressBarProps {
  completedCount: number;
  totalCount: number;
  draftCount?: number;
  className?: string;
  showDetails?: boolean;
}

export function AuditFormProgressBar({
  completedCount,
  totalCount,
  draftCount = 0,
  className,
  showDetails = true,
}: AuditFormProgressBarProps) {
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const inProgressCount = totalCount - completedCount;
  const allComplete = completedCount === totalCount && totalCount > 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {completedCount} of {totalCount} employers completed
          </span>
          {allComplete && (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {percentage}%
        </span>
      </div>

      <Progress value={percentage} className="h-2" />

      {showDetails && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-600" />
            <span>{completedCount} submitted</span>
          </div>
          
          {inProgressCount > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-blue-600" />
              <span>{inProgressCount} pending</span>
            </div>
          )}
          
          {draftCount > 0 && (
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-gray-600" />
              <span>{draftCount} draft{draftCount > 1 ? 's' : ''} saved</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


