"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, AlertTriangle, Info, X, ChevronRight } from "lucide-react";
import { useComplianceAlerts, useAcknowledgeAlert } from "@/components/projects/compliance/hooks/useComplianceAlerts";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

export function ComplianceAlertsCard() {
  const router = useRouter();
  const { data: alerts = [], isLoading } = useComplianceAlerts(undefined, 5);
  const acknowledgeAlert = useAcknowledgeAlert();

  if (isLoading) {
    return null;
  }

  if (alerts.length === 0) {
    return null;
  }

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case 'warning':
        return <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-700">Warning</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Info</Badge>;
    }
  };

  const handleAlertClick = (alert: any) => {
    if (alert.entity_type === 'project') {
      router.push(`/projects/${alert.project_id}?tab=audit-compliance`);
    } else if (alert.entity_type === 'employer') {
      router.push(`/projects/${alert.project_id}?tab=audit-compliance&employer=${alert.entity_id}`);
    }
  };

  const handleAcknowledge = (e: React.MouseEvent, alertId: string) => {
    e.stopPropagation();
    acknowledgeAlert.mutate(alertId);
  };

  return (
    <Card className="border-yellow-200 bg-yellow-50/50 lg:bg-yellow-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Compliance Alerts
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/compliance-alerts')}
            className="text-xs"
          >
            View All
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] pr-4">
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleAlertClick(alert)}
              >
                <div className="flex items-start gap-3 flex-1">
                  {getAlertIcon(alert.severity)}
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <div className="flex items-center gap-2">
                      {getSeverityBadge(alert.severity)}
                      {alert.due_date && (
                        <span className="text-xs text-muted-foreground">
                          Due: {format(new Date(alert.due_date), 'dd/MM/yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => handleAcknowledge(e, alert.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
