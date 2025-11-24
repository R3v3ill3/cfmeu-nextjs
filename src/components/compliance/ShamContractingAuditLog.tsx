"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, RefreshCcw, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ShamContractingAuditLog as AuditLogType } from "@/types/compliance"

interface ShamContractingAuditLogProps {
  employerId: string
  className?: string
}

export function ShamContractingAuditLog({ employerId, className }: ShamContractingAuditLogProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sham-contracting-audit", employerId],
    queryFn: async () => {
      const response = await fetch(`/api/employers/${employerId}/sham-contracting`)
      if (!response.ok) {
        throw new Error("Failed to fetch audit log")
      }
      return response.json()
    },
  })

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Sham Contracting Audit Trail</CardTitle>
          <CardDescription>Loading audit history...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Sham Contracting Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load audit log. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const auditLog = data?.auditLog || []
  const status = data?.status

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "flagged":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "cleared":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "reflagged":
        return <RefreshCcw className="h-4 w-4 text-amber-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case "flagged":
        return <Badge variant="destructive">Flagged</Badge>
      case "cleared":
        return <Badge variant="default" className="bg-green-600">Cleared</Badge>
      case "reflagged":
        return <Badge variant="secondary">Re-flagged</Badge>
      default:
        return <Badge variant="outline">{actionType}</Badge>
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sham Contracting Audit Trail</CardTitle>
            <CardDescription>
              Complete history of all flagging and clearing actions
            </CardDescription>
          </div>
          {status?.has_active_flags && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Active Flags: {status.active_flags}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {auditLog.length === 0 ? (
          <Alert>
            <AlertDescription>
              No sham contracting flags or clearances recorded for this employer.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {auditLog.map((entry: AuditLogType & { action_by_profile?: any; project?: any }) => (
              <div
                key={entry.id}
                className="flex gap-3 border-l-2 border-gray-200 pl-4 py-2 hover:bg-muted/50 transition-colors"
              >
                <div className="mt-1">{getActionIcon(entry.action_type)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getActionBadge(entry.action_type)}
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.action_timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                    {entry.project && (
                      <Badge variant="outline" className="text-xs">
                        {entry.project.name}
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm">
                    <span className="text-muted-foreground">By: </span>
                    <span className="font-medium">
                      {entry.action_by_profile
                        ? `${entry.action_by_profile.first_name} ${entry.action_by_profile.last_name}`
                        : "Unknown"}
                    </span>
                  </div>

                  <div className="text-sm text-gray-700">
                    {entry.action_type === "cleared" && entry.clearing_reason ? (
                      <div>
                        <span className="font-medium">Reason for clearing: </span>
                        {entry.clearing_reason}
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium">Notes: </span>
                        {entry.notes || "No notes provided"}
                      </div>
                    )}
                  </div>

                  {entry.source_table && (
                    <div className="text-xs text-muted-foreground">
                      Source: {entry.source_table.replace(/_/g, " ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}





