"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { SubmissionContentViewer } from "./SubmissionContentViewer";

interface DelegatedTaskLink {
  id: string;
  token: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  expiresAt: string;
  submittedAt: string | null;
  viewedAt: string | null;
  viewCount: number;
  status: "pending" | "submitted" | "expired";
  createdBy: string;
  createdByName: string;
}

interface LinksListResponse {
  links: DelegatedTaskLink[];
  total: number;
  page: number;
  limit: number;
}

interface LinksListProps {
  period: string;
  resourceType: string;
  organiserId?: string;
  teamLeadId?: string;
  status?: "all" | "pending" | "submitted" | "expired";
}

export function LinksList({
  period,
  resourceType,
  organiserId,
  teamLeadId,
  status = "all",
}: LinksListProps) {
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useQuery<LinksListResponse>({
    queryKey: [
      "delegated-tasks-links",
      period,
      resourceType,
      organiserId,
      teamLeadId,
      status,
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        period,
        resourceType,
        page: page.toString(),
        limit: limit.toString(),
        status,
      });
      if (organiserId) params.set("organiserId", organiserId);
      if (teamLeadId) params.set("teamLeadId", teamLeadId);

      const response = await fetch(`/api/delegated-tasks/links?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch links");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load links. Please try again.
      </div>
    );
  }

  if (!data || data.links.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        No links found for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {data.links.map((link) => (
          <Card key={link.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{link.projectName}</h4>
                    <Badge
                      variant={
                        link.status === "submitted"
                          ? "default"
                          : link.status === "expired"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {link.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Created: {format(new Date(link.createdAt), "PPp")}</div>
                    {link.submittedAt && (
                      <div>Submitted: {format(new Date(link.submittedAt), "PPp")}</div>
                    )}
                    {link.viewedAt && (
                      <div>
                        Viewed: {format(new Date(link.viewedAt), "PPp")} ({link.viewCount}{" "}
                        times)
                      </div>
                    )}
                    <div>Expires: {format(new Date(link.expiresAt), "PPp")}</div>
                    <div>Created by: {link.createdByName}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {link.status === "submitted" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedToken(link.token)}
                    >
                      View Submission
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {data.total > limit && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.total)} of{" "}
            {data.total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * limit >= data.total}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Submission Content Viewer */}
      {selectedToken && (
        <SubmissionContentViewer
          token={selectedToken}
          onClose={() => setSelectedToken(null)}
        />
      )}
    </div>
  );
}

