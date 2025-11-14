"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

type PurgeOption = "all" | "4weeks" | "2weeks" | "1week";
type ResourceType = "PROJECT_AUDIT_COMPLIANCE" | "PROJECT_MAPPING_SHEET" | "all";

interface PurgeLinksRequest {
  purgeOption: PurgeOption;
  organiserId: string;
  resourceType?: ResourceType;
}

interface PurgeLinksResponse {
  deletedCount: number;
  purgeOption: PurgeOption;
  organiserId: string;
  resourceType?: string;
}

interface PurgeExpiredLinksProps {
  organiserId: string;
  organiserName: string;
  currentResourceType: "PROJECT_AUDIT_COMPLIANCE" | "PROJECT_MAPPING_SHEET";
}

export function PurgeExpiredLinks({ 
  organiserId, 
  organiserName, 
  currentResourceType 
}: PurgeExpiredLinksProps) {
  const [open, setOpen] = useState(false);
  const [purgeOption, setPurgeOption] = useState<PurgeOption>("1week");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<ResourceType>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const purgeMutation = useMutation<PurgeLinksResponse, Error, PurgeLinksRequest>({
    mutationFn: async (request) => {
      const response = await fetch("/api/delegated-tasks/links/purge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          purgeOption: request.purgeOption,
          organiserId: request.organiserId,
          resourceType: request.resourceType === "all" ? undefined : request.resourceType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to purge links");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Links purged successfully",
        description: `Deleted ${data.deletedCount} expired and unviewed link${data.deletedCount === 1 ? "" : "s"}.`,
      });
      setOpen(false);
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["delegated-tasks-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["delegated-tasks-links"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to purge links",
        description: error.message || "An error occurred while purging links.",
        variant: "destructive",
      });
    },
  });

  const handlePurge = () => {
    purgeMutation.mutate({
      purgeOption,
      organiserId,
      resourceType: resourceTypeFilter,
    });
  };

  const getPurgeOptionLabel = (option: PurgeOption): string => {
    switch (option) {
      case "all":
        return "All expired links";
      case "4weeks":
        return "Expired more than 4 weeks ago";
      case "2weeks":
        return "Expired more than 2 weeks ago";
      case "1week":
        return "Expired more than 1 week ago";
      default:
        return option;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-[44px]">
          <Trash2 className="h-4 w-4 mr-2" />
          Purge Links
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] w-[95vw]">
        <DialogHeader>
          <DialogTitle>Purge Expired and Unviewed Links</DialogTitle>
          <DialogDescription>
            Remove expired and unviewed links for <strong>{organiserName}</strong>. Select how old expired links should be before they are purged. Only links that have expired and were never viewed will be deleted.
          </DialogDescription>
        </DialogHeader>

              <div className="space-y-4 py-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This action cannot be undone. Only expired and unviewed links will be deleted.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Purge Links Expired:</label>
                  <Select
                    value={purgeOption}
                    onValueChange={(value) => setPurgeOption(value as PurgeOption)}
                  >
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All expired links</SelectItem>
                      <SelectItem value="4weeks">More than 4 weeks ago</SelectItem>
                      <SelectItem value="2weeks">More than 2 weeks ago</SelectItem>
                      <SelectItem value="1week">More than 1 week ago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Resource Type:</label>
                  <Select
                    value={resourceTypeFilter}
                    onValueChange={(value) => setResourceTypeFilter(value as ResourceType)}
                  >
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="PROJECT_AUDIT_COMPLIANCE">
                        Audit & Compliance
                      </SelectItem>
                      <SelectItem value="PROJECT_MAPPING_SHEET">Mapping Sheets</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-medium mb-1">What will be deleted:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Links for <strong>{organiserName}</strong> only</li>
                    <li>Links expired {getPurgeOptionLabel(purgeOption).toLowerCase()}</li>
                    <li>Links that were never viewed (view_count = 0)</li>
                    {resourceTypeFilter !== "all" && (
                      <li>
                        Only {resourceTypeFilter === "PROJECT_AUDIT_COMPLIANCE" ? "Audit & Compliance" : "Mapping Sheets"} links
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="w-full sm:w-auto min-h-[44px]"
                  disabled={purgeMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handlePurge}
                  disabled={purgeMutation.isPending}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  {purgeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Purging...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Purge Links
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
  );
}

