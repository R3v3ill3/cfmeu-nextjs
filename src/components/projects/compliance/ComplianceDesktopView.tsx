"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Settings } from "lucide-react";
import { ProjectComplianceGrid } from "./ProjectComplianceGrid";
import { EmployerComplianceTable } from "./EmployerComplianceTable";
import { ComplianceReportingSettings } from "./ComplianceReportingSettings";
import { BulkActionsMenu } from "./BulkActionsMenu";
import { useProjectCompliance } from "./hooks/useProjectCompliance";
import { useEmployerCompliance } from "./hooks/useEmployerCompliance";
import { useState } from "react";

interface ComplianceDesktopViewProps {
  projectId: string;
}

export function ComplianceDesktopView({ projectId }: ComplianceDesktopViewProps) {
  const [showReportingSettings, setShowReportingSettings] = useState(false);
  const { data: projectCompliance } = useProjectCompliance(projectId);
  const { data: employerCompliance } = useEmployerCompliance(projectId);

  const handleExport = () => {
    // TODO: Implement export functionality
    // Export compliance data functionality placeholder
  };

  return (
    <div className="space-y-6">
      {/* Project Compliance Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Project Compliance Status</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReportingSettings(!showReportingSettings)}
              >
                <Settings className="h-4 w-4 mr-1" />
                Reporting
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showReportingSettings && projectCompliance && (
            <div className="mb-4 pb-4 border-b">
              <ComplianceReportingSettings
                projectId={projectId}
                currentFrequency={projectCompliance.reporting_frequency}
                nextReportDate={projectCompliance.next_report_date}
              />
            </div>
          )}
          <ProjectComplianceGrid projectId={projectId} />
        </CardContent>
      </Card>

      {/* Employer Compliance Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>
              Employer Compliance Checks
              {employerCompliance && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({employerCompliance.length} employers)
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <BulkActionsMenu 
                projectId={projectId} 
                selectedEmployerIds={[]} 
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
              >
                <FileDown className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <EmployerComplianceTable projectId={projectId} />
        </CardContent>
      </Card>
    </div>
  );
}
