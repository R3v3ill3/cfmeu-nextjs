"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganiserSummaryView } from "./OrganiserSummaryView";
import { LeadOrganiserSummaryView } from "./LeadOrganiserSummaryView";
import { AdminSummaryView } from "./AdminSummaryView";
import { PurgeExpiredLinks } from "./PurgeExpiredLinks";
import { useUserRole } from "@/hooks/useUserRole";

type Period = "week" | "month" | "3months";
type ResourceType = "PROJECT_AUDIT_COMPLIANCE" | "PROJECT_MAPPING_SHEET";

interface DelegatedTasksAnalyticsResponse {
  role: "organiser" | "lead_organiser" | "admin";
  period: string;
  resourceType: string;
  universe?: {
    generated: number;
    submitted: number;
    submissionRate: number;
    uniqueOrganisers: number;
    uniqueTeams: number;
  };
  teams?: Array<{
    leadOrganiserId: string;
    leadOrganiserName: string;
    generated: number;
    submitted: number;
    submissionRate: number;
    organiserCount: number;
  }>;
  organisers?: Array<{
    organiserId: string;
    organiserName: string;
    generated: number;
    submitted: number;
    submissionRate: number;
    teamLeadId?: string;
    teamLeadName?: string;
  }>;
  personal?: {
    generated: number;
    submitted: number;
    submissionRate: number;
    pending: number;
  };
}

export function DelegatedTasksDashboard() {
  const { role: userRole, isLoading: roleLoading } = useUserRole();
  const [period, setPeriod] = useState<Period>("month");
  const [resourceType, setResourceType] = useState<ResourceType>("PROJECT_AUDIT_COMPLIANCE");

  const { data, isLoading, error } = useQuery<DelegatedTasksAnalyticsResponse>({
    queryKey: ["delegated-tasks-analytics", period, resourceType],
    queryFn: async () => {
      const params = new URLSearchParams({
        period,
        resourceType,
      });
      const response = await fetch(`/api/delegated-tasks/analytics?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || "Failed to fetch analytics") as Error & { details?: string };
        error.details = errorData.details;
        throw error;
      }
      return response.json();
    },
    enabled: !!userRole && !roleLoading,
  });

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = (error as Error & { details?: string })?.details || errorMessage;
    
    return (
      <Card>
        <CardContent className="p-6 space-y-2">
          <p className="text-sm font-medium text-destructive">
            Failed to load delegated tasks analytics
          </p>
          <p className="text-xs text-muted-foreground">
            {errorDetails}
          </p>
          {(errorDetails?.includes('does not exist') || errorDetails?.includes('function')) && (
            <p className="text-xs text-muted-foreground mt-2">
              Note: Database migrations may need to be run. Please contact your administrator.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Delegated Tasks Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Time Period</label>
              <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Past Week</SelectItem>
                  <SelectItem value="month">Past Month</SelectItem>
                  <SelectItem value="3months">Past 3 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Task Type</label>
              <Select
                value={resourceType}
                onValueChange={(value) => setResourceType(value as ResourceType)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROJECT_AUDIT_COMPLIANCE">Audit & Compliance</SelectItem>
                  <SelectItem value="PROJECT_MAPPING_SHEET">Mapping Sheets</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purge Links (Admin Only) */}
      {data?.role === "admin" && (
        <PurgeExpiredLinks currentResourceType={resourceType} />
      )}

      {/* Role-specific views */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data?.role === "organiser" ? (
        <OrganiserSummaryView data={data} period={period} resourceType={resourceType} />
      ) : data?.role === "lead_organiser" ? (
        <LeadOrganiserSummaryView data={data} period={period} resourceType={resourceType} />
      ) : data?.role === "admin" ? (
        <AdminSummaryView data={data} period={period} resourceType={resourceType} />
      ) : null}
    </div>
  );
}

