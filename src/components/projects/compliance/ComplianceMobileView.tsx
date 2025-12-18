"use client"

import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, FileDown, AlertCircle, CheckCircle } from "lucide-react";
import { ProjectComplianceMobileCard } from "./ProjectComplianceMobileCard";
import { EmployerComplianceMobile } from "./EmployerComplianceMobile";
import { ComplianceReportingSettings } from "./ComplianceReportingSettings";
import { ShareAuditFormGenerator } from "./ShareAuditFormGenerator";
import { useProjectCompliance } from "./hooks/useProjectCompliance";
import { useEmployerCompliance } from "./hooks/useEmployerCompliance";
import { useProjectComplianceRating } from "./hooks/useProjectComplianceRating";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ComplianceMobileViewProps {
  projectId: string;
}

export function ComplianceMobileView({ projectId }: ComplianceMobileViewProps) {
  const [showReportingSettings, setShowReportingSettings] = useState(false);
  const { data: projectCompliance } = useProjectCompliance(projectId);
  const { data: employerCompliance = [] } = useEmployerCompliance(projectId);
  const { data: projectRating } = useProjectComplianceRating(projectId);

  // Get project name for share link
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const getComplianceScore = () => {
    if (!projectRating) return { percentage: 0, status: 'critical', label: 'Unknown' };

    const percentage = Math.round((projectRating.overallRating / 4) * 100);
    const label = projectRating.overallRating === 4 ? 'Good' :
                 projectRating.overallRating === 3 ? 'Moderate' :
                 projectRating.overallRating === 2 ? 'Poor' : 'Critical';

    return {
      percentage,
      status: projectRating.overallRating >= 3 ? 'good' : 'critical',
      label
    };
  };

  const getEmployerStats = () => {
    const total = employerCompliance.length;
    const checked = employerCompliance.filter(e => e.cbus_check_conducted || e.incolink_check_conducted).length;
    const issues = employerCompliance.filter(e => e.cbus_enforcement_flag || e.incolink_enforcement_flag).length;
    
    return { total, checked, issues };
  };

  const score = getComplianceScore();
  const employerStats = getEmployerStats();

  return (
    <div className="space-y-4 p-4">
      {/* Share Button - Mobile optimized */}
      {project && (
        <div className="flex justify-end">
          <ShareAuditFormGenerator 
            projectId={projectId} 
            projectName={project.name}
          />
        </div>
      )}

      {/* Overall Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Compliance Overview</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-11"
              onClick={() => setShowReportingSettings(!showReportingSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
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
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{score.label}</div>
              <div className="text-lg text-muted-foreground">{score.percentage}%</div>
              <Badge
                variant={score.status === 'good' ? 'default' : 'destructive'}
                className="mt-1"
              >
                Project Rating
              </Badge>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold">{employerStats.checked}/{employerStats.total}</div>
              <Badge variant="outline" className="mt-1">
                Employers Checked
              </Badge>
              {employerStats.issues > 0 && (
                <div className="mt-1 text-xs text-red-600 flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {employerStats.issues} issue{employerStats.issues > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accordion for sections */}
      <Accordion type="single" collapsible defaultValue="project">
        <AccordionItem value="project">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center justify-between w-full pr-2">
              <span className="font-medium">Project Rating Details</span>
              <div className="flex items-center gap-2">
                {score.status === 'good' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <Badge variant="outline" className="text-xs">
                  {score.label}
                </Badge>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ProjectComplianceMobileCard projectId={projectId} showFullDetails={true} />
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="employers" className="border-0">
          <AccordionTrigger className="hover:no-underline bg-blue-600 text-white rounded-lg px-4 py-3 data-[state=open]:rounded-b-none">
            <div className="flex items-center justify-between w-full pr-2">
              <span className="font-semibold text-base">Employer Checks</span>
              <div className="flex items-center gap-2">
                {employerStats.issues > 0 && (
                  <AlertCircle className="h-4 w-4 text-red-200" />
                )}
                <Badge variant="secondary" className="text-xs bg-blue-500 text-white border-blue-400">
                  {employerStats.checked}/{employerStats.total}
                </Badge>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="border-2 border-t-0 border-blue-600 rounded-b-lg bg-blue-50/30 pt-4">
            <EmployerComplianceMobile projectId={projectId} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Export Button */}
      <Button variant="outline" className="w-full">
        <FileDown className="h-4 w-4 mr-2" />
        Export Compliance Report
      </Button>
    </div>
  );
}
