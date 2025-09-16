'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Upload, AlertCircle, CheckCircle, Download, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { processEbaData, ProcessedEbaData } from '@/utils/ebaDataProcessor';
import { matchEmployerAdvanced, batchMatchEmployers, getMatchingStatistics, EmployerMatchResult, EmployerMatch } from '@/utils/employerMatching';
import { toast } from '@/hooks/use-toast';
import { EbaImportPreview } from './EbaImportPreview';
import { PostImportFwcLookup } from './PostImportFwcLookup';
import { FwcLookupJobSummary } from '@/types/fwcLookup';
import { conditionalRefreshMaterializedViews } from '@/utils/refreshMaterializedViews';

interface EbaImportProps {
  csvData: any[];
  onImportComplete: (results: ImportResults) => void;
  onBack: () => void;
}

interface ImportResults {
  successful: Array<{ employer_id: string; company_name: string; [key: string]: any }>;
  failed: number;
  duplicates: number;
  updated: number;
  errors: string[];
  unmatchedEmployers: ProcessedEbaDataWithMatch[];
  matchingStats: ReturnType<typeof getMatchingStatistics>;
}

interface ImportProgress {
  status: 'idle' | 'matching' | 'importing' | 'completed' | 'error';
  processed: number;
  total: number;
  currentRecord?: string;
  startTime?: Date;
  endTime?: Date;
  errors: Array<{ row: number; company: string; error: string }>;
  currentPhase?: 'processing' | 'matching' | 'importing';
}

interface ProcessedEbaDataWithMatch extends ProcessedEbaData {
  employerMatch?: EmployerMatchResult;
  userSelectedEmployer?: { id: string; name: string } | null; // Changed to store name for UI
  shouldCreateNew?: boolean;
  rowIndex: number;
}

interface ImportSettings {
  confidenceThreshold: number;
  enableDuplicateMerging: boolean;
  updateExistingRecords: boolean;
  retroactiveStatusUpdate: boolean;
}

export function EbaImport({ csvData, onImportComplete, onBack }: EbaImportProps) {
  const [isProcessed, setIsProcessed] = useState(false);
  const [previewData, setPreviewData] = useState<ProcessedEbaDataWithMatch[]>([]);
  const [importSettings, setImportSettings] = useState<ImportSettings>({
    confidenceThreshold: 0.75,
    enableDuplicateMerging: false,
    updateExistingRecords: false,
    retroactiveStatusUpdate: true
  });
  const [progress, setProgress] = useState<ImportProgress>({
    status: 'idle',
    processed: 0,
    total: 0,
    errors: []
  });
  const [matchingResults, setMatchingResults] = useState<Record<string, EmployerMatchResult>>({});
  const [showMatchingDetails, setShowMatchingDetails] = useState(false);
  const [showFwcLookup, setShowFwcLookup] = useState(false);
  const [completedImportResults, setCompletedImportResults] = useState<ImportResults | null>(null);

  // Helper function to create a new employer
  const createNewEmployer = async (record: ProcessedEbaDataWithMatch): Promise<string> => {
    const { data: newEmployer, error: employerError } = await supabase
      .from('employers')
      .insert({
        name: record.company_name,
        employer_type: 'small_contractor',
        primary_contact_name: record.contact_name,
        email: record.contact_email,
        phone: record.contact_phone,
        enterprise_agreement_status: true // Set to true since we're importing EBA data
      })
      .select('id')
      .single();

    if (employerError) {
      throw new Error(`Failed to create employer: ${employerError.message}`);
    }
    
    return newEmployer.id;
  };

  // Helper function to handle duplicate merging
  const handleDuplicateMerging = async (primaryId: string, duplicateIds: string[]) => {
    if (duplicateIds.length === 0) return;
    
    try {
      const { data, error } = await supabase.rpc('merge_employers', {
        p_primary_employer_id: primaryId,
        p_duplicate_employer_ids: duplicateIds,
      });
      
      if (error) {
        console.error('Merge failed:', error);
        throw error;
      }
      
      console.log('Merge successful:', data);
    } catch (error) {
      console.warn('Duplicate merging failed:', error);
      // Don't throw - continue with import even if merge fails
    }
  };

  // Helper function to update employer EBA status
  const updateEmployerEbaStatus = async (employerId: string, hasEba: boolean) => {
    try {
      const { error } = await supabase
        .from('employers')
        .update({ enterprise_agreement_status: hasEba })
        .eq('id', employerId);
      
      if (error) {
        console.warn('Failed to update employer EBA status:', error);
        // Don't throw - this is a secondary operation
      }
    } catch (error) {
      console.warn('Error updating employer EBA status:', error);
    }
  };

  // Function to generate unmatched employers CSV
  const generateUnmatchedEmployersCsv = (unmatchedEmployers: ProcessedEbaDataWithMatch[]): string => {
    if (unmatchedEmployers.length === 0) return '';
    
    const headers = [
      'Row',
      'Company Name',
      'Contact Name', 
      'Contact Phone',
      'Contact Email',
      'Sector',
      'EBA File Number',
      'Comments',
      'Match Confidence',
      'Suggested Matches'
    ];
    
    const csvRows = unmatchedEmployers.map(record => [
      record.rowIndex.toString(),
      `"${record.company_name}"`,
      `"${record.contact_name || ''}"`,
      `"${record.contact_phone || ''}"`,
      `"${record.contact_email || ''}"`,
      `"${record.sector || ''}"`,
      `"${record.eba_file_number || ''}"`,
      `"${record.comments || ''}"`,
      record.employerMatch?.match ? `${(record.employerMatch.match.score * 100).toFixed(1)}%` : 'No match',
      record.employerMatch?.candidates.slice(0, 3).map(c => c.name).join('; ') || 'None'
    ]);
    
    return [headers, ...csvRows].map(row => row.join(',')).join('\n');
  };

  // Function to download unmatched employers CSV
  const downloadUnmatchedEmployersCsv = (unmatchedEmployers: ProcessedEbaDataWithMatch[]) => {
    const csvContent = generateUnmatchedEmployersCsv(unmatchedEmployers);
    if (!csvContent) return;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `eba-import-unmatched-employers-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Function to handle user selection of employer match
  const handleEmployerSelection = (recordIndex: number, employer: { id: string; name: string } | null, createNew: boolean = false) => {
    setPreviewData(prev => prev.map((record, index) => {
      if (index === recordIndex) {
        return {
          ...record,
          userSelectedEmployer: employer,
          shouldCreateNew: createNew
        };
      }
      return record;
    }));
  };

  const processData = async () => {
    setProgress(prev => ({
      ...prev,
      status: 'matching',
      currentPhase: 'processing',
      processed: 0,
      total: csvData.length,
      startTime: new Date()
    }));

    try {
      // Step 1: Process CSV data
      const processed = processEbaData(csvData);
      const processedWithIndex = processed.map((record, index) => ({
        ...record,
        rowIndex: index + 1
      }));

      setProgress(prev => ({
        ...prev,
        currentPhase: 'matching',
        processed: 0,
        total: processedWithIndex.length
      }));

      // Step 2: Batch match employers
      const companyNames = processedWithIndex.map(record => record.company_name);
      const matchResults = await batchMatchEmployers(companyNames, {
        confidenceThreshold: importSettings.confidenceThreshold,
        allowFuzzyMatching: true,
        requireUserConfirmation: false
      });

      setMatchingResults(matchResults);

      // Step 3: Combine processed data with matching results
      const dataWithMatches: ProcessedEbaDataWithMatch[] = processedWithIndex.map(record => ({
        ...record,
        employerMatch: matchResults[record.company_name]
      }));

      setPreviewData(dataWithMatches);
      setProgress(prev => ({
        ...prev,
        status: 'idle',
        processed: dataWithMatches.length,
        currentPhase: undefined
      }));
      setIsProcessed(true);

      // Show matching statistics
      const stats = getMatchingStatistics(matchResults);
      toast({
        title: "Employer Matching Complete",
        description: `Matched ${stats.matchedTotal}/${stats.total} employers (${stats.matchRate.toFixed(1)}% success rate)`,
      });

    } catch (error) {
      console.error('Error processing EBA data:', error);
      setProgress(prev => ({
        ...prev,
        status: 'error'
      }));
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const importEbaRecords = async () => {
    setProgress(prev => ({
      ...prev,
      status: 'importing',
      processed: 0,
      total: previewData.length,
      startTime: new Date(),
      errors: [],
      currentPhase: 'importing'
    }));

    const results: ImportResults = {
      successful: [],
      failed: 0,
      duplicates: 0,
      updated: 0,
      errors: [],
      unmatchedEmployers: [],
      matchingStats: getMatchingStatistics(matchingResults)
    };

    try {
      for (let i = 0; i < previewData.length; i++) {
        const record = previewData[i];
        
        // Update progress with current record
        setProgress(prev => ({
          ...prev,
          processed: i,
          currentRecord: record.company_name
        }));
        
        try {
          let employerId: string | null = null;
          
          // Handle employer matching/creation based on match results
          if (record.userSelectedEmployer) {
            // User manually selected an employer
            employerId = record.userSelectedEmployer.id;
          } else if (record.shouldCreateNew) {
            // User chose to create new employer
            employerId = await createNewEmployer(record);
          } else if (record.employerMatch?.match) {
            const match = record.employerMatch.match;
            
            // Use matched employer if confidence is high enough
            if (match.score >= importSettings.confidenceThreshold) {
              employerId = match.id;
              
              // Handle duplicate merging if enabled
              if (importSettings.enableDuplicateMerging && record.employerMatch.candidates.length > 0) {
                const exactMatches = record.employerMatch.candidates.filter(c => c.confidence === 'exact');
                if (exactMatches.length > 0) {
                  await handleDuplicateMerging(match.id, exactMatches.map(c => c.id));
                }
              }
            } else {
              // No confident match found - add to unmatched list
              results.unmatchedEmployers.push(record);
              continue;
            }
          } else {
            // No match found - add to unmatched list
            results.unmatchedEmployers.push(record);
            continue;
          }

          if (!employerId) {
            throw new Error('Failed to determine employer ID');
          }

          // Check if EBA record already exists for this employer
          const { data: existingRecord } = await supabase
            .from('company_eba_records')
            .select('id')
            .eq('employer_id', employerId)
            .maybeSingle();

          const recordData = {
            employer_id: employerId,
            eba_file_number: record.eba_file_number,
            sector: record.sector,
            contact_name: record.contact_name,
            contact_phone: record.contact_phone,
            contact_email: record.contact_email,
            comments: record.comments,
            fwc_lodgement_number: record.fwc_lodgement_number,
            fwc_matter_number: record.fwc_matter_number,
            fwc_document_url: record.fwc_document_url,
            docs_prepared: record.docs_prepared,
            date_barg_docs_sent: record.date_barg_docs_sent,
            followup_email_sent: record.followup_email_sent,
            out_of_office_received: record.out_of_office_received,
            followup_phone_call: record.followup_phone_call,
            date_draft_signing_sent: record.date_draft_signing_sent,
            eba_data_form_received: record.eba_data_form_received,
            date_eba_signed: record.date_eba_signed,
            date_vote_occurred: record.date_vote_occurred,
            eba_lodged_fwc: record.eba_lodged_fwc,
            fwc_certified_date: record.fwc_certified_date
          };

          if (existingRecord) {
            if (importSettings.updateExistingRecords) {
              // Update existing record - CSV data is considered more up-to-date
              const { error: ebaError } = await supabase
                .from('company_eba_records')
                .update(recordData)
                .eq('id', existingRecord.id);

              if (ebaError) {
                throw new Error(`Failed to update EBA record: ${ebaError.message}`);
              }
              results.successful.push({
                employer_id: employerId,
                company_name: record.company_name,
                eba_record_id: existingRecord.id,
                row_index: record.rowIndex,
                updated: true
              });
              results.updated++;
            } else {
              results.duplicates++;
              continue;
            }
          } else {
            // Insert new EBA record
            const { error: ebaError } = await supabase
              .from('company_eba_records')
              .insert(recordData);

            if (ebaError) {
              throw new Error(`Failed to insert EBA record: ${ebaError.message}`);
            }
            results.successful.push({
              employer_id: employerId,
              company_name: record.company_name,
              eba_record_id: 'new', // This would be the actual record ID
              row_index: record.rowIndex
            });
          }

          // Update employer EBA status if retroactive updates are enabled
          if (importSettings.retroactiveStatusUpdate) {
            await updateEmployerEbaStatus(employerId, true);
          }

        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`${record.company_name}: ${errorMessage}`);
          
          // Add to progress errors
          setProgress(prev => ({
            ...prev,
            errors: [...prev.errors, {
              row: record.rowIndex,
              company: record.company_name,
              error: errorMessage
            }]
          }));
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(`Import process failed: ${errorMessage}`);
      
      setProgress(prev => ({
        ...prev,
        status: 'error',
        endTime: new Date()
      }));
    }

    // Update final progress
    setProgress(prev => ({
      ...prev,
      status: 'completed',
      processed: previewData.length,
      currentRecord: undefined,
      endTime: new Date(),
      currentPhase: undefined
    }));

    setCompletedImportResults(results);
    
    // Show FWC lookup option if there are successful imports
    if (results.successful.length > 0) {
      setShowFwcLookup(true);
    } else {
      // Refresh materialized views before completing (when no FWC lookup needed)
      await conditionalRefreshMaterializedViews('employers', toast);
      onImportComplete(results);
    }
  };

  const getProgressPercentage = () => {
    if (progress.total === 0) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  };

  const getDuration = () => {
    if (!progress.startTime) return '';
    const endTime = progress.endTime || new Date();
    const duration = Math.round((endTime.getTime() - progress.startTime.getTime()) / 1000);
    return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  };

  const downloadErrorReport = () => {
    if (progress.errors.length === 0) return;
    
    const csvContent = [
      'Row,Company,Error',
      ...progress.errors.map(err => `${err.row},"${err.company}","${err.error}"`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `eba-import-errors-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Show progress during import
  if (progress.status === 'importing' || progress.status === 'completed' || progress.status === 'error') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={onBack}
            disabled={progress.status === 'importing'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">
              {progress.status === 'importing' ? 'Importing EBA Records' : 'Import Complete'}
            </h2>
            <p className="text-muted-foreground">
              {progress.status === 'importing' 
                ? `Processing ${progress.processed + 1} of ${progress.total} records`
                : `Imported ${progress.processed} of ${progress.total} records in ${getDuration()}`
              }
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {progress.status === 'importing' ? (
                <img src="/spinner.gif" alt="Loading" className="h-5 w-5" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              Import Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progress: {progress.processed}/{progress.total}</span>
                <span>{getProgressPercentage()}%</span>
              </div>
              <Progress value={getProgressPercentage()} className="w-full" />
            </div>

            {progress.currentRecord && (
              <div className="text-sm text-muted-foreground">
                Currently processing: <span className="font-medium">{progress.currentRecord}</span>
              </div>
            )}

            {progress.status === 'completed' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(progress.total - progress.errors.length)}
                  </div>
                  <div className="text-sm text-muted-foreground">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {progress.errors.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {progress.total}
                  </div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {getDuration()}
                  </div>
                  <div className="text-sm text-muted-foreground">Duration</div>
                </div>
              </div>
            )}

            {progress.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-red-600">Import Errors ({progress.errors.length})</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={downloadErrorReport}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Error Report
                  </Button>
                </div>
                <ScrollArea className="h-48 w-full rounded border">
                  <div className="p-4 space-y-2">
                    {progress.errors.map((error, index) => (
                      <div key={index} className="text-sm border-l-2 border-red-500 pl-3">
                        <div className="font-medium">Row {error.row}: {error.company}</div>
                        <div className="text-muted-foreground">{error.error}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isProcessed) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Process EBA Data</h2>
            <p className="text-muted-foreground">
              Ready to process {csvData.length} rows of EBA tracking data
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Data Processing</CardTitle>
            <CardDescription>
              Configure import settings and process the EBA data with employer matching
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Import Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
              <div className="space-y-3">
                <h4 className="font-medium">Matching Settings</h4>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confidence Threshold: {Math.round(importSettings.confidenceThreshold * 100)}%</label>
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.05"
                    value={importSettings.confidenceThreshold}
                    onChange={(e) => setImportSettings(prev => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">Higher values require more exact matches</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium">Import Options</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="enable-duplicate-merging" 
                      checked={importSettings.enableDuplicateMerging}
                      onCheckedChange={(checked) => setImportSettings(prev => ({ ...prev, enableDuplicateMerging: checked as boolean }))}
                    />
                    <label htmlFor="enable-duplicate-merging" className="text-sm font-medium">
                      Merge duplicate employers
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="update-existing" 
                      checked={importSettings.updateExistingRecords}
                      onCheckedChange={(checked) => setImportSettings(prev => ({ ...prev, updateExistingRecords: checked as boolean }))}
                    />
                    <label htmlFor="update-existing" className="text-sm font-medium">
                      Update existing EBA records
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="retroactive-status" 
                      checked={importSettings.retroactiveStatusUpdate}
                      onCheckedChange={(checked) => setImportSettings(prev => ({ ...prev, retroactiveStatusUpdate: checked as boolean }))}
                    />
                    <label htmlFor="retroactive-status" className="text-sm font-medium">
                      Update employer EBA status
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <Button onClick={processData} className="w-full" disabled={progress.status === 'matching'}>
              {progress.status === 'matching' ? 'Processing...' : 'Process EBA Data & Match Employers'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (previewData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No valid EBA data found. Please check your CSV file format and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle FWC lookup completion
  const handleFwcLookupComplete = (jobSummary: FwcLookupJobSummary) => {
    toast({
      title: "FWC Lookup Complete",
      description: `Successfully enhanced ${jobSummary.successfulLookups} employers with FWC data.`,
    });
  };

  const handleFwcLookupClose = async () => {
    setShowFwcLookup(false);
    if (completedImportResults) {
      // Refresh materialized views after FWC lookup is complete
      await conditionalRefreshMaterializedViews('employers', toast);
      onImportComplete(completedImportResults);
    }
  };

  // Show FWC lookup UI if enabled
  if (showFwcLookup && completedImportResults) {
    return (
      <PostImportFwcLookup
        importResults={completedImportResults}
        onComplete={handleFwcLookupComplete}
        onClose={handleFwcLookupClose}
      />
    );
  }

  return (
    <EbaImportPreview
      previewData={previewData}
      importSettings={importSettings}
      matchingResults={matchingResults}
      onBack={onBack}
      onImport={importEbaRecords}
      onEmployerSelection={handleEmployerSelection}
      onDownloadUnmatched={downloadUnmatchedEmployersCsv}
      isImporting={progress.status !== 'idle'}
    />
  );
}