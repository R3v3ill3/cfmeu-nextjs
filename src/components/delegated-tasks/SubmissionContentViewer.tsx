"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SubmissionContentResponse {
  token: string;
  projectId: string;
  projectName: string;
  resourceType: string;
  createdAt: string;
  expiresAt: string;
  submittedAt: string | null;
  submissionData: any;
  metadata: any;
}

interface SubmissionContentViewerProps {
  token: string;
  onClose: () => void;
}

export function SubmissionContentViewer({ token, onClose }: SubmissionContentViewerProps) {
  const { data, isLoading, error } = useQuery<SubmissionContentResponse>({
    queryKey: ["delegated-tasks-submission", token],
    queryFn: async () => {
      const response = await fetch(`/api/delegated-tasks/submissions/${token}`);
      if (!response.ok) {
        throw new Error("Failed to fetch submission content");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full mx-2 sm:mx-auto">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full mx-2 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Error</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-sm text-destructive">
            Failed to load submission content. Please try again.
          </div>
          <Button onClick={onClose} className="w-full sm:w-auto min-h-[44px]">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto w-[95vw] sm:w-full mx-2 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Submission Content</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Project Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm sm:text-base">
                <div className="break-words">
                  <span className="font-medium">Project:</span> {data.projectName}
                </div>
                <div className="break-words">
                  <span className="font-medium">Resource Type:</span> {data.resourceType}
                </div>
                <div>
                  <span className="font-medium">Created:</span>{" "}
                  {format(new Date(data.createdAt), "PPp")}
                </div>
                {data.submittedAt && (
                  <div>
                    <span className="font-medium">Submitted:</span>{" "}
                    {format(new Date(data.submittedAt), "PPp")}
                  </div>
                )}
                <div>
                  <span className="font-medium">Expires:</span>{" "}
                  {format(new Date(data.expiresAt), "PPp")}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submission Data */}
          {data.submissionData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Submitted Form Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-3 sm:p-4 rounded-md overflow-x-auto text-xs sm:text-sm whitespace-pre-wrap break-words">
                  {JSON.stringify(data.submissionData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          {data.metadata && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-3 sm:p-4 rounded-md overflow-x-auto text-xs sm:text-sm whitespace-pre-wrap break-words">
                  {JSON.stringify(data.metadata, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={onClose} className="w-full sm:w-auto min-h-[44px]">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

