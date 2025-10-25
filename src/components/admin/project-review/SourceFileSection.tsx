'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { FileText, User, Calendar, Upload } from 'lucide-react';
import type { MappingSheetScanDetails } from '@/types/pendingProjectReview';
import { format } from 'date-fns';

interface SourceFileSectionProps {
  scans: MappingSheetScanDetails[];
}

export function SourceFileSection({ scans }: SourceFileSectionProps) {
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'MMM d, yyyy h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  if (!scans || scans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Source Files</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No source files associated with this project
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">
            Source Files ({scans.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {scans.map((scan) => (
            <div
              key={scan.id}
              className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
            >
              {/* File Name and Type */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <h4 className="font-medium truncate">{scan.file_name}</h4>
                  </div>
                  {scan.scan_type && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {scan.scan_type}
                    </Badge>
                  )}
                </div>
                {scan.file_size && (
                  <div className="text-sm text-muted-foreground">
                    {formatFileSize(scan.file_size)}
                  </div>
                )}
              </div>

              {/* Upload Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <div>
                    <Label className="text-xs">Uploaded by</Label>
                    <p className="font-medium text-foreground">
                      {scan.uploader?.full_name || scan.uploader?.email || 'Unknown'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <Label className="text-xs">Uploaded at</Label>
                    <p className="font-medium text-foreground">
                      {formatDate(scan.uploaded_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Upload className="h-3 w-3" />
                <span>Scan ID: {scan.id.slice(0, 8)}...</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
