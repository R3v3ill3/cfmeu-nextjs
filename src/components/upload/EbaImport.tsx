'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Upload, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { processEbaData, ProcessedEbaData } from '@/utils/ebaDataProcessor';

interface EbaImportProps {
  csvData: any[];
  onImportComplete: (results: ImportResults) => void;
  onBack: () => void;
}

interface ImportResults {
  successful: number;
  failed: number;
  duplicates: number;
  updated: number;
  errors: string[];
}

interface ImportProgress {
  status: 'idle' | 'importing' | 'completed' | 'error';
  processed: number;
  total: number;
  currentRecord?: string;
  startTime?: Date;
  endTime?: Date;
  errors: Array<{ row: number; company: string; error: string }>;
}

export function EbaImport({ csvData, onImportComplete, onBack }: EbaImportProps) {
  const [isProcessed, setIsProcessed] = useState(false);
  const [previewData, setPreviewData] = useState<ProcessedEbaData[]>([]);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({
    status: 'idle',
    processed: 0,
    total: 0,
    errors: []
  });

  const processData = () => {
    const processed = processEbaData(csvData);
    setPreviewData(processed);
    setIsProcessed(true);
  };

  const importEbaRecords = async () => {
    setProgress(prev => ({
      ...prev,
      status: 'importing',
      processed: 0,
      total: previewData.length,
      startTime: new Date(),
      errors: []
    }));

    const results: ImportResults = {
      successful: 0,
      failed: 0,
      duplicates: 0,
      updated: 0,
      errors: []
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
          // First, try to find or create the employer
          let employerId: string | null = null;
          
          // Check if employer exists by name
          const { data: existingEmployer } = await supabase
            .from('employers')
            .select('id')
            .eq('name', record.company_name)
            .maybeSingle();

          if (existingEmployer) {
            employerId = existingEmployer.id;
          } else {
            // Create new employer
            const { data: newEmployer, error: employerError } = await supabase
              .from('employers')
              .insert({
                name: record.company_name,
                employer_type: 'small_contractor',
                primary_contact_name: record.contact_name,
                email: record.contact_email,
                phone: record.contact_phone
              })
              .select('id')
              .single();

            if (employerError) {
              throw new Error(`Failed to create employer: ${employerError.message}`);
            }
            
            employerId = newEmployer.id;
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
            if (updateExisting) {
              // Update existing record, preserving existing non-null values
              const { error: ebaError } = await supabase
                .from('company_eba_records')
                .update(recordData)
                .eq('id', existingRecord.id);

              if (ebaError) {
                throw new Error(`Failed to update EBA record: ${ebaError.message}`);
              }
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
            results.successful++;
          }

        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`${record.company_name}: ${errorMessage}`);
          
          // Add to progress errors
          setProgress(prev => ({
            ...prev,
            errors: [...prev.errors, {
              row: i + 1,
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
      endTime: new Date()
    }));

    onImportComplete(results);
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
              Click below to process the EBA data and prepare it for import
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={processData} className="w-full">
              Process EBA Data
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
              {previewData.length} EBA records ready for import
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="update-existing" 
              checked={updateExisting}
              onCheckedChange={(checked) => setUpdateExisting(checked as boolean)}
            />
            <label 
              htmlFor="update-existing" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Update existing records
            </label>
          </div>
          <Button 
            onClick={importEbaRecords} 
            disabled={progress.status !== 'idle'}
            className="flex items-center gap-2"
          >
            {progress.status !== 'idle' ? (
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

      <div className="grid gap-4">
        {previewData.slice(0, 10).map((record, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{record.company_name}</CardTitle>
                <div className="flex gap-2">
                  {record.sector && <Badge variant="outline">{record.sector}</Badge>}
                  {record.eba_file_number && <Badge variant="secondary">#{record.eba_file_number}</Badge>}
                </div>
              </div>
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
        ))}
        
        {previewData.length > 10 && (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                ... and {previewData.length - 10} more records
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}