'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Download,
  Play,
  Pause,
  Square,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FwcLookupService } from '@/services/fwcLookupService';
import { 
  FwcLookupJob, 
  FwcLookupJobOptions, 
  FwcLookupJobSummary,
  ImportResults 
} from '@/types/fwcLookup';
import { toast } from '@/hooks/use-toast';

interface PostImportFwcLookupProps {
  importResults: ImportResults;
  onComplete?: (jobSummary: FwcLookupJobSummary) => void;
  onClose?: () => void;
}

interface EligibleEmployer {
  id: string;
  name: string;
  hasFwcData: boolean;
  reason?: string;
}

export function PostImportFwcLookup({ 
  importResults, 
  onComplete, 
  onClose 
}: PostImportFwcLookupProps) {
  const [eligibleEmployers, setEligibleEmployers] = useState<EligibleEmployer[]>([]);
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [currentJob, setCurrentJob] = useState<FwcLookupJob | null>(null);
  const [jobSummary, setJobSummary] = useState<FwcLookupJobSummary | null>(null);
  const [isJobRunning, setIsJobRunning] = useState(false);
  const [jobOptions, setJobOptions] = useState<FwcLookupJobOptions>({
    priority: 'normal',
    batchSize: 3,
    skipExisting: true,
    autoSelectBest: true
  });

  const fwcService = FwcLookupService.getInstance();

  // Analyze eligible employers on mount
  useEffect(() => {
    analyzeEligibleEmployers();
  }, [importResults, analyzeEligibleEmployers]);

  // Poll job status if running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentJob && isJobRunning) {
      interval = setInterval(() => {
        const updatedJob = fwcService.getJob(currentJob.id);
        if (updatedJob) {
          setCurrentJob(updatedJob);
          
          if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
            setIsJobRunning(false);
            const summary = fwcService.getJobSummary(updatedJob.id);
            if (summary) {
              setJobSummary(summary);
              onComplete?.(summary);
            }
            
            toast({
              title: updatedJob.status === 'completed' ? 'FWC Lookup Complete' : 'FWC Lookup Failed',
              description: summary ? 
                `Processed ${summary.processedEmployers}/${summary.totalEmployers} employers. ${summary.successfulLookups} successful lookups.` :
                'Check the job details for more information.',
              variant: updatedJob.status === 'completed' ? 'default' : 'destructive'
            });
          }
        }
      }, 2000); // Poll every 2 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentJob, isJobRunning, onComplete, fwcService]);

  const analyzeEligibleEmployers = async () => {
    setIsAnalyzing(true);
    
    try {
      // Get all successful import results and extract employer IDs
      const employerIds = importResults.successful
        .map(result => result.employer_id)
        .filter(Boolean);
      
      if (employerIds.length === 0) {
        setEligibleEmployers([]);
        return;
      }
      
      // Check which employers already have FWC data
      const { data: employersWithFwc } = await supabase
        .from('company_eba_records')
        .select('employer_id, fwc_document_url, employers(name)')
        .in('employer_id', employerIds);
      
      const employers: EligibleEmployer[] = (employersWithFwc || []).map(record => ({
        id: record.employer_id,
        name: (record.employers as any)?.name || 'Unknown',
        hasFwcData: !!record.fwc_document_url,
        reason: record.fwc_document_url ? 'Already has FWC document URL' : 'Missing FWC data'
      }));
      
      setEligibleEmployers(employers);
      
      // Auto-select employers without FWC data
      const employersWithoutFwc = employers
        .filter(emp => !emp.hasFwcData)
        .map(emp => emp.id);
      setSelectedEmployers(new Set(employersWithoutFwc));
      
    } catch (error) {
      console.error('Failed to analyze eligible employers:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Could not analyze employers for FWC lookup.',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startFwcLookup = async () => {
    if (selectedEmployers.size === 0) {
      toast({
        title: 'No Employers Selected',
        description: 'Please select at least one employer for FWC lookup.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const job = await fwcService.createFwcLookupJob(
        Array.from(selectedEmployers),
        jobOptions
      );
      
      setCurrentJob(job);
      setIsJobRunning(true);
      
      toast({
        title: 'FWC Lookup Started',
        description: `Processing ${job.employerIds.length} employers. Estimated time: ${Math.ceil(job.estimatedDuration! / 60)} minutes.`,
      });
      
    } catch (error) {
      console.error('Failed to start FWC lookup:', error);
      toast({
        title: 'Failed to Start FWC Lookup',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive'
      });
    }
  };

  const cancelFwcLookup = async () => {
    if (!currentJob) return;
    
    try {
      await fwcService.cancelJob(currentJob.id);
      setIsJobRunning(false);
      setCurrentJob(null);
      
      toast({
        title: 'FWC Lookup Cancelled',
        description: 'The FWC lookup job has been cancelled.',
      });
      
    } catch (error) {
      console.error('Failed to cancel FWC lookup:', error);
      toast({
        title: 'Cancellation Failed',
        description: 'Could not cancel the FWC lookup job.',
        variant: 'destructive'
      });
    }
  };

  const toggleEmployerSelection = (employerId: string) => {
    setSelectedEmployers(prev => {
      const updated = new Set(prev);
      if (updated.has(employerId)) {
        updated.delete(employerId);
      } else {
        updated.add(employerId);
      }
      return updated;
    });
  };

  const selectAll = () => {
    setSelectedEmployers(new Set(eligibleEmployers.map(emp => emp.id)));
  };

  const selectNone = () => {
    setSelectedEmployers(new Set());
  };

  const selectWithoutFwc = () => {
    const employersWithoutFwc = eligibleEmployers
      .filter(emp => !emp.hasFwcData)
      .map(emp => emp.id);
    setSelectedEmployers(new Set(employersWithoutFwc));
  };

  const getProgressPercentage = () => {
    if (!currentJob || currentJob.progress.total === 0) return 0;
    return Math.round((currentJob.progress.completed / currentJob.progress.total) * 100);
  };

  const downloadJobReport = () => {
    if (!currentJob || !jobSummary) return;
    
    const reportData = {
      jobId: currentJob.id,
      summary: jobSummary,
      results: currentJob.results,
      errors: currentJob.errors
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fwc-lookup-report-${currentJob.id}.json`;
    link.click();
  };

  if (isAnalyzing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Analyzing Employers for FWC Lookup
          </CardTitle>
          <CardDescription>
            Checking which employers could benefit from FWC document lookup...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (eligibleEmployers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Employers Available</CardTitle>
          <CardDescription>
            No employers from the import are available for FWC lookup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show job progress if running
  if (currentJob && isJobRunning) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              FWC Lookup in Progress
            </CardTitle>
            <CardDescription>
              Processing {currentJob.progress.completed}/{currentJob.progress.total} employers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progress: {currentJob.progress.completed}/{currentJob.progress.total}</span>
                <span>{getProgressPercentage()}%</span>
              </div>
              <Progress value={getProgressPercentage()} className="w-full" />
            </div>

            {currentJob.progress.currentEmployer && (
              <div className="text-sm text-muted-foreground">
                Currently processing: <span className="font-medium">{currentJob.progress.currentEmployer}</span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {currentJob.results.filter(r => r.success).length}
                </div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">
                  {currentJob.results.filter(r => !r.success).length}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {currentJob.progress.completed}
                </div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-600">
                  {Math.ceil((currentJob.estimatedDuration || 0) / 60)}m
                </div>
                <div className="text-xs text-muted-foreground">Est. Time</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={cancelFwcLookup}
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                Cancel Lookup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show job results if completed
  if (jobSummary) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              FWC Lookup Complete
            </CardTitle>
            <CardDescription>
              Processed {jobSummary.processedEmployers}/{jobSummary.totalEmployers} employers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {jobSummary.successfulLookups}
                </div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {jobSummary.failedLookups}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {jobSummary.processedEmployers}
                </div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {Math.round(jobSummary.totalDuration / 1000 / 60)}m
                </div>
                <div className="text-sm text-muted-foreground">Duration</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={downloadJobReport}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Report
              </Button>
              <Button onClick={onClose}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show employer selection UI
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Enhance with FWC Data
          </CardTitle>
          <CardDescription>
            {eligibleEmployers.filter(emp => !emp.hasFwcData).length} employers could benefit from FWC lookup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Job Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
            <div className="space-y-3">
              <h4 className="font-medium">Processing Options</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="skip-existing" 
                    checked={jobOptions.skipExisting}
                    onCheckedChange={(checked) => setJobOptions(prev => ({ ...prev, skipExisting: checked as boolean }))}
                  />
                  <label htmlFor="skip-existing" className="text-sm font-medium">
                    Skip employers with existing FWC data
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="auto-select-best" 
                    checked={jobOptions.autoSelectBest}
                    onCheckedChange={(checked) => setJobOptions(prev => ({ ...prev, autoSelectBest: checked as boolean }))}
                  />
                  <label htmlFor="auto-select-best" className="text-sm font-medium">
                    Automatically select best matching results
                  </label>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Performance Settings</h4>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Batch Size: {jobOptions.batchSize}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={jobOptions.batchSize}
                  onChange={(e) => setJobOptions(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Estimated time: ~{Math.ceil(selectedEmployers.size * 45 / 60)} minutes
                </p>
              </div>
            </div>
          </div>

          {/* Employer Selection */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Select Employers ({selectedEmployers.size} selected)</h4>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectWithoutFwc}>
                  Select Missing FWC
                </Button>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Select None
                </Button>
              </div>
            </div>

            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-4 space-y-2">
                {eligibleEmployers.map(employer => (
                  <div 
                    key={employer.id} 
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedEmployers.has(employer.id)}
                        onCheckedChange={() => toggleEmployerSelection(employer.id)}
                      />
                      <div>
                        <div className="font-medium">{employer.name}</div>
                        <div className="text-sm text-muted-foreground">{employer.reason}</div>
                      </div>
                    </div>
                    <Badge variant={employer.hasFwcData ? "default" : "secondary"}>
                      {employer.hasFwcData ? 'Has FWC Data' : 'Missing FWC Data'}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={startFwcLookup}
              disabled={selectedEmployers.size === 0}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Start FWC Lookup
            </Button>
            <Button variant="outline" onClick={onClose}>
              Skip
            </Button>
          </div>

          {selectedEmployers.size > 0 && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                This will process {selectedEmployers.size} employers and take approximately{' '}
                {Math.ceil(selectedEmployers.size * 45 / 60)} minutes to complete.
                The process runs in the background and you can continue using the application.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
