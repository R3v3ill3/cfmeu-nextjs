'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Upload, Users, AlertTriangle, Download, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { getMatchingStatistics, EmployerMatchResult, EmployerMatch } from '@/utils/employerMatching';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

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
  userSelectedEmployer?: { id: string; name: string } | null;
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
  onEmployerSelection: (recordIndex: number, employer: { id: string; name: string } | null, createNew?: boolean) => void;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [manualSearch, setManualSearch] = useState<Record<number, { term: string; results: Array<{id: string, name: string}>; isLoading: boolean }>>({});
  const itemsPerPage = 10;

  const paginatedData = previewData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(previewData.length / itemsPerPage);

  const handleManualSearch = async (rowIndex: number, searchTerm: string) => {
    setManualSearch(prev => ({
      ...prev,
      [rowIndex]: { ...(prev[rowIndex] || { results: [] }), term: searchTerm, isLoading: true }
    }));

    if (searchTerm.length < 3) {
      setManualSearch(prev => ({
        ...prev,
        [rowIndex]: { ...prev[rowIndex], results: [], isLoading: false }
      }));
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('search_employers_by_name_fuzzy', { search_term: searchTerm });
      
      if (error) throw error;

      setManualSearch(prev => ({
        ...prev,
        [rowIndex]: { ...prev[rowIndex], results: data || [], isLoading: false }
      }));
    } catch (error) {
      console.error("Manual employer search failed:", error);
      toast({
        title: "Search Failed",
        description: "Could not fetch employer search results.",
        variant: "destructive",
      });
      setManualSearch(prev => ({
        ...prev,
        [rowIndex]: { ...prev[rowIndex], isLoading: false }
      }));
    }
  };

  const selectManualSearchResult = (rowIndex: number, employer: { id: string; name: string }) => {
    onEmployerSelection(rowIndex, employer);
    setManualSearch(prev => ({
      ...prev,
      [rowIndex]: { term: '', results: [], isLoading: false }
    }));
  };

  // Component to show import results summary
  const ImportResultsSummary = () => {
    const matchingStats = getMatchingStatistics(matchingResults);
    const unmatchedCount = previewData.filter(r => 
      (!r.employerMatch?.match || r.employerMatch.match.score < importSettings.confidenceThreshold) &&
      !r.userSelectedEmployer && 
      !r.shouldCreateNew
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
              <span>{unmatchedCount} employers have no confident match.</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onDownloadUnmatched(
                  previewData.filter(r => !r.employerMatch?.match || r.employerMatch.match.score < importSettings.confidenceThreshold)
                )}
                className="ml-4"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Unmatched
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };
  
  const recordsToImportCount = previewData.filter(r => 
    (r.employerMatch?.match && r.employerMatch.match.score >= importSettings.confidenceThreshold) || 
    r.userSelectedEmployer || 
    r.shouldCreateNew
  ).length;
  const recordsToSkipCount = previewData.length - recordsToImportCount;

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
              Review {previewData.length} records and their matches before importing.
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
                Import {recordsToImportCount} Records
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Import Results Summary */}
      <ImportResultsSummary />

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Based on current selections, <strong>{recordsToImportCount}</strong> records will be imported or updated. <strong>{recordsToSkipCount}</strong> records will be skipped. Skipped records can be downloaded in a report after the import is complete.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {paginatedData.map((record, index) => {
          const originalIndex = (currentPage - 1) * itemsPerPage + index;
          const match = record.employerMatch?.match;
          const hasMatch = match && match.score >= importSettings.confidenceThreshold;
          const confidence = match ? Math.round(match.score * 100) : 0;
          
          return (
            <Card key={originalIndex} className={!hasMatch && !record.userSelectedEmployer && !record.shouldCreateNew ? 'border-yellow-200 bg-yellow-50/50' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{record.company_name}</CardTitle>
                    {record.userSelectedEmployer ? (
                      <Badge variant="default" className="bg-blue-100 text-blue-800">Selected</Badge>
                    ) : record.shouldCreateNew ? (
                      <Badge variant="default" className="bg-blue-100 text-blue-800">New</Badge>
                    ) : hasMatch ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        {confidence}% match
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        {match ? `${confidence}% - Needs Review` : 'No match'}
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
                  <div className="text-sm mt-2 p-2 bg-slate-50 rounded space-y-2">
                    {record.userSelectedEmployer ? (
                      <div className="flex items-center justify-between font-semibold text-blue-600">
                        <span>Selected: {record.userSelectedEmployer.name}</span>
                        <Button variant="link" size="sm" onClick={() => onEmployerSelection(originalIndex, null)}>Change</Button>
                      </div>
                    ) : record.shouldCreateNew ? (
                      <div className="flex items-center justify-between font-semibold text-blue-600">
                        <span>Action: Create New Employer</span>
                        <Button variant="link" size="sm" onClick={() => onEmployerSelection(originalIndex, null, false)}>Change</Button>
                      </div>
                    ) : hasMatch ? (
                      <div className="flex items-center justify-between text-green-700">
                        <span>✓ Matched to: <strong>{match.name}</strong> ({confidence}% confidence)</span>
                        <Button variant="link" size="sm" onClick={() => onEmployerSelection(originalIndex, null)}>Change</Button>
                      </div>
                    ) : (
                      <div>
                        <div className="text-yellow-700 font-medium">⚠️ No match found. Please search or create a new employer:</div>
                        
                        {/* Manual Search Input */}
                        <div className="relative mt-2">
                          <Input
                            placeholder="Search for an employer..."
                            value={manualSearch[originalIndex]?.term || ''}
                            onChange={(e) => handleManualSearch(originalIndex, e.target.value)}
                          />
                          {manualSearch[originalIndex]?.term && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                              onClick={() => handleManualSearch(originalIndex, '')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* Search Results */}
                        {manualSearch[originalIndex]?.isLoading && <div className="text-sm text-muted-foreground p-2">Searching...</div>}
                        {manualSearch[originalIndex]?.results.length > 0 && (
                          <div className="border rounded-md mt-1 max-h-32 overflow-y-auto">
                            {manualSearch[originalIndex].results.map(result => (
                              <div 
                                key={result.id}
                                className="p-2 hover:bg-slate-100 cursor-pointer text-sm"
                                onClick={() => selectManualSearchResult(originalIndex, result)}
                              >
                                {result.name}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" onClick={() => onEmployerSelection(originalIndex, null, true)}>
                            Create New Employer
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {record.contact_name && (
                  <CardDescription className="pt-2">
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
        
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
