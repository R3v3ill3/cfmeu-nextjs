"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Eye, CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { generateShareUrl, formatTimeRemaining } from "@/lib/share-links";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const getStatusDetails = (link: DelegatedTaskLink) => {
    const now = new Date();
    const expiresAt = new Date(link.expiresAt);
    const submittedAt = link.submittedAt ? new Date(link.submittedAt) : null;

    if (submittedAt) {
      return {
        text: `Submitted ${formatDistanceToNow(submittedAt, { addSuffix: true })}`,
        icon: CheckCircle2,
        color: "text-green-600",
      };
    }

    if (isPast(expiresAt)) {
      return {
        text: `Expired ${formatDistanceToNow(expiresAt, { addSuffix: true })}`,
        icon: XCircle,
        color: "text-red-600",
      };
    }

    const timeRemaining = formatTimeRemaining(expiresAt);
    return {
      text: timeRemaining.text,
      icon: Clock,
      color: timeRemaining.isExpiringSoon ? "text-amber-600" : "text-muted-foreground",
    };
  };

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
      <div className="space-y-3">
        {data.links.map((link) => {
          const shareUrl = generateShareUrl(link.token);
          const statusDetails = getStatusDetails(link);
          const StatusIcon = statusDetails.icon;

          return (
            <Card key={link.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-2">
                        <h4 className="font-medium text-base">{link.projectName}</h4>
                        <Badge
                          variant={
                            link.status === "submitted"
                              ? "default"
                              : link.status === "expired"
                              ? "destructive"
                              : "secondary"
                          }
                          className="shrink-0"
                        >
                          {link.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <StatusIcon className={`h-4 w-4 ${statusDetails.color}`} />
                        <span className={statusDetails.color}>{statusDetails.text}</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                      {link.status === "submitted" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedToken(link.token)}
                          className="w-full sm:w-auto min-h-[44px]"
                        >
                          View Submission
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(shareUrl, "Share link")}
                        className="w-full sm:w-auto min-h-[44px]"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(shareUrl, "_blank")}
                        className="w-full sm:w-auto min-h-[44px]"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open
                      </Button>
                    </div>
                  </div>

                  {/* Share Link Display */}
                  <div className="bg-muted/50 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Share Link:</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <code className="text-xs sm:text-sm flex-1 break-all font-mono bg-background px-2 py-2 sm:py-1 rounded border overflow-x-auto">
                        {shareUrl}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(shareUrl, "Share link")}
                        className="shrink-0 h-10 sm:h-8 w-full sm:w-10 p-0 min-h-[44px] sm:min-h-0"
                      >
                        <Copy className="h-4 w-4 sm:mr-0" />
                        <span className="sm:hidden ml-2">Copy Link</span>
                      </Button>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created:</span>{" "}
                      <span className="font-medium">
                        {format(new Date(link.createdAt), "PPp")}
                      </span>
                    </div>
                    {link.submittedAt && (
                      <div>
                        <span className="text-muted-foreground">Submitted:</span>{" "}
                        <span className="font-medium text-green-600">
                          {format(new Date(link.submittedAt), "PPp")}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Expires:</span>{" "}
                      <span className="font-medium">
                        {format(new Date(link.expiresAt), "PPp")}
                      </span>
                    </div>
                    {link.viewedAt && (
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Viewed:</span>{" "}
                        <span className="font-medium">
                          {format(new Date(link.viewedAt), "PPp")} ({link.viewCount}{" "}
                          {link.viewCount === 1 ? "time" : "times"})
                        </span>
                      </div>
                    )}
                    {!link.viewedAt && link.viewCount === 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="h-4 w-4" />
                        <span>Not viewed yet</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Created by:</span>{" "}
                      <span className="font-medium">{link.createdByName}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {data.total > limit && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.total)} of{" "}
            {data.total}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex-1 sm:flex-initial min-h-[44px]"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * limit >= data.total}
              className="flex-1 sm:flex-initial min-h-[44px]"
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

