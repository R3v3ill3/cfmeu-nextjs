'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Upload, Users, AlertTriangle, Download } from 'lucide-react';
import { getMatchingStatistics, EmployerMatchResult } from '@/utils/employerMatching';

interface ProcessedEbaDataWithMatch {
  company_name: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  sector?: string;
  eba_file_number?: string;
  comments?: string;
  docs_prepared?: string;
  date_eba_signed?: string;
  eba_lodged_fwc?: string;
  fwc_certified_date?: string;
  fwc_document_url?: string;
  employerMatch?: EmployerMatchResult;
  userSelectedEmployerId?: string | null;
  shouldCreateNew?: boolean;
  rowIndex: number;
}

interface ImportSettings {
  confidenceThreshold: number;
  enableDuplicateMerging: boolean;
  updateExistingRecords: boolean;
  retroactiveStatusUpdate: boolean;
}

interface EbaImportPreviewProps {
  previewData: ProcessedEbaDataWithMatch[];
  importSettings: ImportSettings;
  matchingResults: Record<string, EmployerMatchResult>;
  onBack: () => void;
  onImport: () => void;
  onEmployerSelection: (recordIndex: number, employerId: string | null, createNew?: boolean) => void;
  onDownloadUnmatched: (unmatchedEmployers: ProcessedEbaDataWithMatch[]) => void;
  isImporting: boolean;
}

export function EbaImportPreview({
  previewData,
  importSettings,
  matchingResults,
  onBack,
  onImport,
  onEmployerSelection,
  onDownloadUnmatched,
  isImporting
}: EbaImportPreviewProps) {
  const [showMatchingDetails, setShowMatchingDetails] = useState(false);

  // Component to show import results summary
  const ImportResultsSummary = () => {
    const matchingStats = getMatchingStatistics(matchingResults);
    const unmatchedCount = previewData.filter(r => 
      !r.employerMatch?.match || r.employerMatch.match.score < importSettings.confidenceThreshold
    ).length;
    
    return (
      <div className="space-y-4">
        {/* Matching Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">
              {matchingStats.exactMatches}
            </div>
            <div className="text-xs text-muted-foreground">Exact Matches</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600">
              {matchingStats.highConfidence}
            </div>
            <div className="text-xs text-muted-foreground">High Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-yellow-600">
              {matchingStats.mediumConfidence + matchingStats.lowConfidence}
            </div>
            <div className="text-xs text-muted-foreground">Low Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600">
              {unmatchedCount}
            </div>
            <div className="text-xs text-muted-foreground">Unmatched</div>
          </div>
        </div>
        
        {/* Unmatched employers download */}
        {unmatchedCount > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{unmatchedCount} employers could not be matched with sufficient confidence.</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onDownloadUnmatched(
                  previewData.filter(r => !r.employerMatch?.match || r.employerMatch.match.score < importSettings.confidenceThreshold)
                )}
                className="ml-4"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Unmatched CSV
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">EBA Data Preview</h2>
            <p className="text-muted-foreground">
              {previewData.length} EBA records with employer matching
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline"
            onClick={() => setShowMatchingDetails(!showMatchingDetails)}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            {showMatchingDetails ? 'Hide' : 'Show'} Matching Details
          </Button>
          <Button 
            onClick={onImport} 
            disabled={isImporting}
            className="flex items-center gap-2"
          >
            {isImporting ? (
              <>Importing...</>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import EBA Records
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Import Results Summary */}
      <ImportResultsSummary />

      <div className="grid gap-4">
        {previewData.slice(0, 10).map((record, index) => {
          const match = record.employerMatch?.match;
          const hasMatch = match && match.score >= importSettings.confidenceThreshold;
          const confidence = match ? Math.round(match.score * 100) : 0;
          
          return (
            <Card key={index} className={!hasMatch ? 'border-yellow-200 bg-yellow-50/50' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{record.company_name}</CardTitle>
                    {hasMatch ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        {confidence}% match
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        {match ? `${confidence}% - Below threshold` : 'No match'}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {record.sector && <Badge variant="outline">{record.sector}</Badge>}
                    {record.eba_file_number && <Badge variant="secondary">#{record.eba_file_number}</Badge>}
                  </div>
                </div>
                
                {/* Employer matching info */}
                {showMatchingDetails && (
                  <div className="space-y-2">
                    {hasMatch ? (
                      <div className="text-sm text-green-700">
                        ✓ Matched to: <strong>{match.name}</strong> ({confidence}% confidence)
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm text-yellow-700">
                          ⚠️ No confident match found. Suggestions:
                        </div>
                        {record.employerMatch?.candidates.slice(0, 3).map((candidate, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span>{candidate.name} ({Math.round(candidate.score * 100)}%)</span>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => onEmployerSelection(index, candidate.id)}
                            >
                              Select
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onEmployerSelection(index, null, true)}
                          >
                            Create New Employer
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {record.contact_name && (
                  <CardDescription>
                    Contact: {record.contact_name}
                    {record.contact_phone && ` • ${record.contact_phone}`}
                    {record.contact_email && ` • ${record.contact_email}`}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {record.docs_prepared && (
                    <div>
                      <span className="font-medium">Docs Prepared:</span> {record.docs_prepared}
                    </div>
                  )}
                  {record.date_eba_signed && (
                    <div>
                      <span className="font-medium">EBA Signed:</span> {record.date_eba_signed}
                    </div>
                  )}
                  {record.eba_lodged_fwc && (
                    <div>
                      <span className="font-medium">Lodged FWC:</span> {record.eba_lodged_fwc}
                    </div>
                  )}
                  {record.fwc_certified_date && (
                    <div>
                      <span className="font-medium">FWC Certified:</span> {record.fwc_certified_date}
                    </div>
                  )}
                  {record.fwc_document_url && (
                    <div className="col-span-2 md:col-span-3">
                      <span className="font-medium">FWC Document:</span> 
                      <a href={record.fwc_document_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-primary hover:underline">
                        View Document
                      </a>
                    </div>
                  )}
                </div>
                {record.comments && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium">Comments:</span> {record.comments}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        
        {previewData.length > 10 && (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  ... and {previewData.length - 10} more records
                </p>
                <div className="text-sm text-muted-foreground">
                  {getMatchingStatistics(matchingResults).matchedTotal} of {previewData.length} employers matched
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
