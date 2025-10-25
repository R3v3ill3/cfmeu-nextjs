'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Info, DollarSign, Calendar, Building, MapPin } from 'lucide-react';
import type { PendingProject } from '@/types/pendingProjectReview';
import { format } from 'date-fns';

interface MetadataSectionProps {
  project: PendingProject;
}

export function MetadataSection({ project }: MetadataSectionProps) {
  const formatCurrency = (value: number | null) => {
    if (!value) return 'Not specified';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not specified';
    try {
      return format(new Date(date), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Project Metadata</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Financial Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Financial
            </div>
            <div className="space-y-3 pl-6">
              <div>
                <Label className="text-xs text-muted-foreground">Project Value</Label>
                <p className="font-medium text-lg">{formatCurrency(project.value)}</p>
              </div>
              {project.funding_type && (
                <div>
                  <Label className="text-xs text-muted-foreground">Funding Type</Label>
                  <p className="font-medium">{project.funding_type}</p>
                </div>
              )}
              {project.owner_type && (
                <div>
                  <Label className="text-xs text-muted-foreground">Owner Type</Label>
                  <p className="font-medium">{project.owner_type}</p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Timeline
            </div>
            <div className="space-y-3 pl-6">
              <div>
                <Label className="text-xs text-muted-foreground">Proposed Start Date</Label>
                <p className="font-medium">{formatDate(project.proposed_start_date)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Proposed End Date</Label>
                <p className="font-medium">{formatDate(project.proposed_end_date)}</p>
              </div>
            </div>
          </div>

          {/* Project Classification */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Building className="h-4 w-4" />
              Classification
            </div>
            <div className="space-y-3 pl-6">
              {project.stage_class && (
                <div>
                  <Label className="text-xs text-muted-foreground">Stage Class</Label>
                  <p className="font-medium">
                    <Badge variant="outline">{project.stage_class}</Badge>
                  </p>
                </div>
              )}
              {project.project_stage && (
                <div>
                  <Label className="text-xs text-muted-foreground">Project Stage</Label>
                  <p className="font-medium">
                    <Badge variant="secondary">{project.project_stage}</Badge>
                  </p>
                </div>
              )}
              {project.project_status && (
                <div>
                  <Label className="text-xs text-muted-foreground">Project Status</Label>
                  <p className="font-medium">
                    <Badge variant="default">{project.project_status}</Badge>
                  </p>
                </div>
              )}
              {project.development_type && (
                <div>
                  <Label className="text-xs text-muted-foreground">Development Type</Label>
                  <p className="font-medium">{project.development_type}</p>
                </div>
              )}
            </div>
          </div>

          {/* Location Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Location
            </div>
            <div className="space-y-3 pl-6">
              {project.main_job_site?.full_address && (
                <div>
                  <Label className="text-xs text-muted-foreground">Main Job Site</Label>
                  <p className="font-medium">{project.main_job_site.full_address}</p>
                </div>
              )}
              {!project.main_job_site && (
                <p className="text-sm text-muted-foreground">No job site specified</p>
              )}
            </div>
          </div>

          {/* External IDs */}
          {(project.bci_project_id || project.external_project_number) && (
            <div className="space-y-4 md:col-span-2">
              <div className="text-sm font-semibold text-muted-foreground">
                External Identifiers
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                {project.bci_project_id && (
                  <div>
                    <Label className="text-xs text-muted-foreground">BCI Project ID</Label>
                    <p className="font-mono text-sm">{project.bci_project_id}</p>
                  </div>
                )}
                {project.external_project_number && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      External Project Number
                    </Label>
                    <p className="font-mono text-sm">{project.external_project_number}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
