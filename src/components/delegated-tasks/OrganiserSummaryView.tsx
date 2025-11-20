"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinksList } from "./LinksList";
import { PurgeExpiredLinks } from "./PurgeExpiredLinks";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { DelegatedTasksAnalyticsResponse } from "./DelegatedTasksDashboard";

interface OrganiserSummaryViewProps {
  data: DelegatedTasksAnalyticsResponse;
  period: string;
  resourceType: string;
}

export function OrganiserSummaryView({ data, period, resourceType }: OrganiserSummaryViewProps) {
  const [showLinks, setShowLinks] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "submitted" | "expired">("all");
  const { user } = useAuth();
  const { profile } = useUserProfile();

  if (!data.personal) {
    return null;
  }

  const { generated, submitted, submissionRate, pending } = data.personal;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{generated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Submitted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{submitted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Submission Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissionRate.toFixed(1)}%
            </div>
            <Badge
              variant={
                submissionRate >= 80
                  ? "default"
                  : submissionRate >= 50
                  ? "secondary"
                  : "destructive"
              }
              className="mt-2"
            >
              {submissionRate >= 80
                ? "Excellent"
                : submissionRate >= 50
                ? "Good"
                : "Needs Improvement"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Links List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <CardTitle>My Links</CardTitle>
              {generated > 0 && (
                <Badge variant="secondary" className="text-sm">
                  {generated} total
                </Badge>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {showLinks && (
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger className="w-full sm:w-[140px] min-h-[44px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLinks(!showLinks)}
                  className="gap-2 w-full sm:w-auto min-h-[44px]"
                >
                  {showLinks ? (
                    <>
                      Hide <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      View Links <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </Button>
                {user?.id && profile?.full_name && (
                  <PurgeExpiredLinks
                    organiserId={user.id}
                    organiserName={profile.full_name}
                    currentResourceType={resourceType}
                  />
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        {showLinks && (
          <CardContent>
            <LinksList
              period={period}
              resourceType={resourceType}
              organiserId={undefined}
              status={statusFilter}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

