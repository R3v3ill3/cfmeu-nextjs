import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Upload, Users, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  processWorkerData, 
  ProcessedWorkerData, 
  findBestEmployerMatch, 
  findBestOrganiserMatch,
  EmployerMatch,
  OrganiserMatch
} from "@/utils/workerDataProcessor";

interface WorkerImportProps {
  csvData: any[];
  selectedEmployer?: {id: string, name: string};
  onImportComplete: (results: ImportResults) => void;
  onBack: () => void;
}

interface ImportResults {
  successful: number;
  failed: number;
  errors: string[];
  duplicates: number;
  newEmployers: number;
  newOrganisers?: number;
}

interface WorkerWithEmployer extends ProcessedWorkerData {
  employerMatch?: EmployerMatch;
  needsNewEmployer?: boolean;
  organiserMatch?: OrganiserMatch;
  needsNewOrganiser?: boolean;
}

export default function WorkerImport({ csvData, selectedEmployer, onImportComplete, onBack }: WorkerImportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<WorkerWithEmployer[]>([]);
  const [isProcessed, setIsProcessed] = useState(false);
  const [existingEmployers, setExistingEmployers] = useState<Array<{id: string, name: string}>>([]);
  const [existingOrganisers, setExistingOrganisers] = useState<Array<{id: string, first_name: string, last_name: string}>>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!selectedEmployer) {
      loadExistingEmployers();
    }
    loadExistingOrganisers();
  }, [selectedEmployer]);

  const loadExistingOrganisers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name');
      
      if (error) throw error;
      const mapped = (data || []).map((p: any) => {
        const parts = String(p.full_name || '').trim().split(/\s+/);
        const first_name = parts.slice(0, -1).join(' ') || parts[0] || '';
        const last_name = parts.length > 1 ? parts[parts.length - 1] : '';
        return { id: p.id, first_name, last_name };
      });
      setExistingOrganisers(mapped);
    } catch (error) {
      console.error('Error loading organisers:', error);
    }
  };

  const loadExistingEmployers = async () => {
    try {
      const { data, error } = await supabase
        .from('employers')
        .select('id, name');
      
      if (error) throw error;
      setExistingEmployers(data || []);
    } catch (error) {
      console.error('Error loading employers:', error);
    }
  };

  const processData = async () => {
    setIsProcessing(true);
    try {
      const preparedData = csvData.map((row: any) => {
        const r: Record<string, any> = { ...row };
        // Inject company when employer is pre-selected
        if (selectedEmployer && !r['CompanyName'] && !r['Company Name'] && !r['company_name']) {
          r['company_name'] = selectedEmployer.name;
        }
        // Map common header aliases for names
        if (!r['MemberFirstName'] && !r['Member First Name'] && !r['first_name']) {
          r['first_name'] = r['FirstName'] || r['First Name'] || r['GivenName'] || r['Given Name'] || r['given_name'] || r['given'];
        }
        if (!r['MemberSurname'] && !r['Member Surname'] && !r['surname']) {
          r['surname'] = r['LastName'] || r['Last Name'] || r['FamilyName'] || r['Family Name'] || r['last_name'];
        }
        // Phones
        if (!r['Mobile'] && !r['mobile'] && !r['mobile_phone']) {
          r['mobile_phone'] = r['Mobile Phone'] || r['Phone'] || r['PhoneNumber'] || r['Phone Number'] || r['Contact Phone'];
        }
        // Membership status alias
        if (r['MembershipStatus'] && !r['membership_status']) {
          r['membership_status'] = r['MembershipStatus'];
        }
        // Comments alias
        if (r['Comments'] && !r['comments']) {
          r['comments'] = r['Comments'];
        }
        return r;
      });
      const processed = processWorkerData(preparedData);
      
      // If employer is pre-selected, assign all workers to it
      if (selectedEmployer) {
        const workersWithEmployers: WorkerWithEmployer[] = processed.map(worker => ({
          ...worker,
          employerMatch: {
            id: selectedEmployer.id,
            name: selectedEmployer.name,
            confidence: 'exact' as const,
            distance: 0
          },
          needsNewEmployer: false
        }));
        
        setPreviewData(workersWithEmployers);
        setIsProcessed(true);
        
        toast({
          title: "Data processed",
          description: `${processed.length} workers processed and will be assigned to ${selectedEmployer.name}.`,
        });
      } else {
        // Match workers to existing employers and organisers
        const workersWithEmployers: WorkerWithEmployer[] = processed.map(worker => {
          const employerMatch = findBestEmployerMatch(worker.company_name, existingEmployers);
          
          // Find organiser match if organiser info is available
          let organiserMatch: OrganiserMatch | undefined;
          let needsNewOrganiser = false;
          
          if (worker.organizer_full_name) {
            organiserMatch = findBestOrganiserMatch(worker.organizer_full_name, existingOrganisers);
            needsNewOrganiser = !organiserMatch;
          }
          
          return {
            ...worker,
            employerMatch,
            needsNewEmployer: !employerMatch,
            organiserMatch,
            needsNewOrganiser
          };
        });
        
        setPreviewData(workersWithEmployers);
        setIsProcessed(true);
        
        const matchedCount = workersWithEmployers.filter(w => w.employerMatch).length;
        const newEmployerCount = workersWithEmployers.filter(w => w.needsNewEmployer).length;
        
        toast({
          title: "Data processed",
          description: `${processed.length} workers processed. ${matchedCount} matched to existing employers, ${newEmployerCount} need new employers.`,
        });
      }
    } catch (error) {
      toast({
        title: "Processing failed",
        description: "Error processing worker data",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const importWorkers = async () => {
    setIsImporting(true);
    const results: ImportResults = {
      successful: 0,
      failed: 0,
      errors: [],
      duplicates: 0,
      newEmployers: 0
    };

    let placementsCreated = 0;

    try {
      for (const worker of previewData) {
        try {
          let employerId: string;

          // Handle employer creation or matching
          if (worker.needsNewEmployer) {
            // Create new employer
            const { data: employerData, error: employerError } = await supabase
              .from('employers')
              .insert({
                name: worker.company_name,
                employer_type: 'large_contractor' // Default for companies with workers
              })
              .select('id')
              .single();

            if (employerError) throw employerError;
            employerId = employerData.id;
            results.newEmployers++;
          } else if (worker.employerMatch) {
            employerId = worker.employerMatch.id;
          } else {
            throw new Error('No employer match found');
          }

          // Check if worker already exists
          const { data: existingWorker } = await supabase
            .from('workers')
            .select('id')
            .eq('first_name', worker.first_name)
            .eq('surname', worker.surname)
            .maybeSingle();

          let workerId: string;

          if (existingWorker) {
            // Update existing worker
            const { data: updatedWorker, error: updateError } = await supabase
              .from('workers')
              .update({
                mobile_phone: worker.mobile_phone,
                email: worker.email ?? null,
                union_membership_status: worker.union_membership_status as any,
                member_number: worker.member_number
              })
              .eq('id', existingWorker.id)
              .select('id')
              .single();

            if (updateError) throw updateError;
            workerId = updatedWorker.id;
            results.duplicates++;
          } else {
            // Create new worker  
            const { data: workerData, error: workerError } = await supabase
              .from('workers')
              .insert({
                first_name: worker.first_name,
                surname: worker.surname,
                mobile_phone: worker.mobile_phone,
                email: worker.email ?? null,
                union_membership_status: worker.union_membership_status as any,
                member_number: worker.member_number
              })
              .select('id')
              .single();

            if (workerError) throw workerError;
            workerId = workerData.id;
          }

          // Create worker placement (always create new placement)
          const { error: placementError } = await supabase
            .from('worker_placements')
            .insert({
              worker_id: workerId,
              employer_id: employerId,
              start_date: new Date().toISOString().split('T')[0], // Today's date
              employment_status: 'casual' // Default to casual employment
            });

          if (placementError) throw placementError;
          placementsCreated++;

          results.successful++;
        } catch (error: any) {
          results.failed++;
          const msg = error?.message || 'Unknown error';
          results.errors.push(`${worker.first_name} ${worker.surname}: ${msg}`);
        }
      }

      // Surface partial failures clearly
      if (results.failed > 0) {
        toast({
          title: `Import completed with errors`,
          description: `Imported ${results.successful} workers, ${results.duplicates} updated, ${placementsCreated} placements created. ${results.failed} failed.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Import completed',
          description: `Imported ${results.successful} workers${selectedEmployer ? ` to ${selectedEmployer.name}` : ''}. ${results.duplicates} updated. ${placementsCreated} placements created.`,
        });
      }

      onImportComplete(results);
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isProcessed) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Process Worker Data</h3>
          <p className="text-muted-foreground mb-6">
            {selectedEmployer 
              ? `Click below to process your worker data. All workers will be assigned to ${selectedEmployer.name}.`
              : "Click below to process and preview your worker data. We'll automatically match workers to existing employers."
            }
          </p>
          {selectedEmployer && (
            <div className="mb-4">
              <Badge variant="secondary" className="text-sm">
                <Building className="h-3 w-3 mr-1" />
                Assigning to: {selectedEmployer.name}
              </Badge>
            </div>
          )}
          <Button onClick={processData} size="lg" disabled={isProcessing}>
            <CheckCircle className="mr-2 h-5 w-5" />
            {isProcessing ? "Processing..." : "Process Data"}
          </Button>
        </div>
        
        <div className="flex gap-4">
          <Button variant="outline" onClick={onBack}>
            Back to Mapping
          </Button>
        </div>
      </div>
    );
  }

  const exactMatches = previewData.filter(w => w.employerMatch?.confidence === 'exact').length;
  const highMatches = previewData.filter(w => w.employerMatch?.confidence === 'high').length;
  const mediumMatches = previewData.filter(w => w.employerMatch?.confidence === 'medium').length;
  const newEmployers = previewData.filter(w => w.needsNewEmployer).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Worker Import Preview</h3>
          <p className="text-muted-foreground">
            {selectedEmployer 
              ? `Review workers before importing to ${selectedEmployer.name}`
              : "Review worker-employer matches before importing to the database"
            }
          </p>
        </div>
        <Badge variant="secondary">
          {previewData.length} workers ready
        </Badge>
      </div>

      {selectedEmployer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Selected Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="text-sm">
              {selectedEmployer.name}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              All {previewData.length} workers will be assigned to this company
            </p>
          </CardContent>
        </Card>
      )}

      {/* Matching Summary - only show if no pre-selected employer */}
      {!selectedEmployer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Employer Matching Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{exactMatches}</div>
                <div className="text-muted-foreground">Exact Matches</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{highMatches}</div>
                <div className="text-muted-foreground">High Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{mediumMatches}</div>
                <div className="text-muted-foreground">Medium Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{newEmployers}</div>
                <div className="text-muted-foreground">New Employers</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {previewData.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No valid worker data found. Please check your CSV format and try again.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="max-h-96 overflow-y-auto space-y-4">
            {previewData.slice(0, 10).map((worker, index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {worker.first_name} {worker.surname}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {worker.union_membership_status.replace('_', ' ')}
                      </Badge>
                      {selectedEmployer ? (
                        <Badge variant="default">
                          Assigned to {selectedEmployer.name}
                        </Badge>
                      ) : (
                        <>
                          {worker.employerMatch && (
                            <Badge 
                              variant={
                                worker.employerMatch.confidence === 'exact' ? 'default' :
                                worker.employerMatch.confidence === 'high' ? 'secondary' :
                                'outline'
                              }
                            >
                              {worker.employerMatch.confidence} match
                            </Badge>
                          )}
                          {worker.needsNewEmployer && (
                            <Badge variant="destructive">New Employer</Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {!selectedEmployer && (
                      <div>
                        <span className="font-medium">Company:</span> {worker.company_name}
                      </div>
                    )}
                    {worker.employerMatch && !selectedEmployer && (
                      <div>
                        <span className="font-medium">Matched to:</span> {worker.employerMatch.name}
                      </div>
                    )}
                    {worker.mobile_phone && (
                      <div>
                        <span className="font-medium">Mobile:</span> {worker.mobile_phone}
                      </div>
                    )}
                    {worker.member_number && (
                      <div>
                        <span className="font-medium">Member #:</span> {worker.member_number}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {previewData.length > 10 && (
            <p className="text-sm text-muted-foreground text-center">
              Showing first 10 of {previewData.length} workers
            </p>
          )}

          <div className="flex gap-4">
            <Button variant="outline" onClick={onBack}>
              Back to Mapping
            </Button>
            <Button 
              onClick={importWorkers} 
              disabled={isImporting}
              className="ml-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? "Importing..." : `Import ${previewData.length} Workers`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}