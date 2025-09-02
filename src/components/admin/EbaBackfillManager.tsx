'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Loader2, 
  Building2, 
  Search, 
  ExternalLink, 
  FileText,
  AlertTriangle,
  RefreshCw,
  Eye,
  Download
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmployerWithoutEba {
  id: string;
  name: string;
  employer_type: string;
  address_line_1?: string;
  suburb?: string;
  state?: string;
  created_at: string;
}

interface FWCSearchResult {
  title: string;
  agreementType: string;
  status: string;
  approvedDate?: string;
  expiryDate?: string;
  lodgementNumber?: string;
  documentUrl?: string;
  summaryUrl?: string;
}

interface EbaSearchState {
  employerId: string;
  employerName: string;
  isSearching: boolean;
  results: FWCSearchResult[];
  error?: string;
  selectedResult?: FWCSearchResult;
  manualSearchUrl?: string;
}

interface BackfillResults {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export function EbaBackfillManager() {
  const { toast } = useToast();
  const [employers, setEmployers] = useState<EmployerWithoutEba[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set());
  const [searchStates, setSearchStates] = useState<Record<string, EbaSearchState>>({});
  const [showEbaDialog, setShowEbaDialog] = useState(false);
  const [currentEbaData, setCurrentEbaData] = useState<{
    employerId: string;
    result: FWCSearchResult;
  } | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [backfillResults, setBackfillResults] = useState<BackfillResults | null>(null);

  // Load employers without EBA records
  useEffect(() => {
    loadEmployersWithoutEba();
  }, []);

  const loadEmployersWithoutEba = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('employers')
        .select(`
          id, 
          name, 
          employer_type, 
          address_line_1, 
          suburb, 
          state, 
          created_at,
          company_eba_records!left(id)
        `)
        .is('company_eba_records.id', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const employersWithoutEba = (data || []).map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        employer_type: emp.employer_type,
        address_line_1: emp.address_line_1,
        suburb: emp.suburb,
        state: emp.state,
        created_at: emp.created_at
      }));

      setEmployers(employersWithoutEba);
      setSelectedEmployers(new Set(employersWithoutEba.map(emp => emp.id)));
    } catch (error) {
      console.error('Error loading employers:', error);
      toast({
        title: "Error loading employers",
        description: "Failed to load employers without EBA records",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const searchEbaForEmployer = async (employer: EmployerWithoutEba) => {
    setSearchStates(prev => ({
      ...prev,
      [employer.id]: {
        employerId: employer.id,
        employerName: employer.name,
        isSearching: true,
        results: []
      }
    }));

    try {
      const response = await fetch('/api/fwc-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: employer.name })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchStates(prev => ({
        ...prev,
        [employer.id]: {
          ...prev[employer.id],
          isSearching: false,
          results: data.results || [],
          error: data.results?.length === 0 ? 'No EBA results found' : undefined
        }
      }));

      if (data.results?.length > 0) {
        toast({
          title: "EBA search completed",
          description: `Found ${data.results.length} potential EBA matches for ${employer.name}`,
        });
      }

    } catch (error) {
      console.error('EBA search error:', error);
      setSearchStates(prev => ({
        ...prev,
        [employer.id]: {
          ...prev[employer.id],
          isSearching: false,
          results: [],
          error: error instanceof Error ? error.message : 'Search failed'
        }
      }));

      toast({
        title: "EBA search failed",
        description: `Could not search for EBAs for ${employer.name}`,
        variant: "destructive",
      });
    }
  };

  const openManualSearch = async (employer: EmployerWithoutEba) => {
    try {
      const response = await fetch(`/api/fwc-search?company=${encodeURIComponent(employer.name)}`);
      const data = await response.json();
      
      if (data.manualSearchUrl) {
        window.open(data.manualSearchUrl, '_blank');
        toast({
          title: "Manual search opened",
          description: `Opened FWC search for ${employer.name} in new tab`,
        });
      }
    } catch (error) {
      console.error('Error opening manual search:', error);
    }
  };

  const selectEbaResult = (employerId: string, result: FWCSearchResult) => {
    setCurrentEbaData({ employerId, result });
    setShowEbaDialog(true);
  };

  const saveEbaRecord = async (ebaData: {
    eba_file_number?: string;
    fwc_lodgement_number?: string;
    fwc_matter_number?: string;
    fwc_document_url?: string;
    summary_url?: string;
    nominal_expiry_date?: string;
    fwc_certified_date?: string;
    comments?: string;
  }) => {
    if (!currentEbaData) return;

    try {
      const supabase = getSupabaseBrowserClient();
      
      const { error } = await supabase
        .from('company_eba_records')
        .insert({
          employer_id: currentEbaData.employerId,
          eba_file_number: ebaData.eba_file_number,
          fwc_lodgement_number: ebaData.fwc_lodgement_number,
          fwc_matter_number: ebaData.fwc_matter_number,
          fwc_document_url: ebaData.fwc_document_url,
          summary_url: ebaData.summary_url,
          nominal_expiry_date: ebaData.nominal_expiry_date,
          fwc_certified_date: ebaData.fwc_certified_date,
          comments: ebaData.comments
        });

      if (error) throw error;

      toast({
        title: "EBA record saved",
        description: "Successfully created EBA record",
      });

      setShowEbaDialog(false);
      setCurrentEbaData(null);
      
      // Remove employer from list
      setEmployers(prev => prev.filter(emp => emp.id !== currentEbaData.employerId));
      setSelectedEmployers(prev => {
        const updated = new Set(prev);
        updated.delete(currentEbaData.employerId);
        return updated;
      });

    } catch (error) {
      console.error('Error saving EBA record:', error);
      toast({
        title: "Error saving EBA record",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };

  const batchSearchEbas = async () => {
    setIsProcessingBatch(true);
    const results: BackfillResults = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    const selectedEmployersList = employers.filter(emp => selectedEmployers.has(emp.id));

    for (const employer of selectedEmployersList) {
      results.processed++;
      
      try {
        await searchEbaForEmployer(employer);
        results.successful++;
        
        // Add delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        results.failed++;
        results.errors.push(`${employer.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    setBackfillResults(results);
    setIsProcessingBatch(false);

    toast({
      title: "Batch EBA search completed",
      description: `Processed ${results.processed} employers. ${results.successful} successful, ${results.failed} failed.`,
    });
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
    setSelectedEmployers(new Set(employers.map(emp => emp.id)));
  };

  const selectNone = () => {
    setSelectedEmployers(new Set());
  };

  if (isLoading) {
    return (
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 mx-auto animate-spin" />
        <h2 className="text-xl font-semibold">Loading Employers...</h2>
        <p className="text-gray-600">Finding employers without EBA records</p>
      </div>
    );
  }

  if (backfillResults) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">EBA Search Complete!</h2>
          <p className="text-gray-600">
            Processed {backfillResults.processed} employers
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-blue-600">{backfillResults.processed}</div>
              <p className="text-sm text-gray-600">Processed</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-green-600">{backfillResults.successful}</div>
              <p className="text-sm text-gray-600">Successful</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-red-600">{backfillResults.failed}</div>
              <p className="text-sm text-gray-600">Failed</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-yellow-600">{backfillResults.skipped}</div>
              <p className="text-sm text-gray-600">Skipped</p>
            </CardContent>
          </Card>
        </div>
        
        {backfillResults.errors.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-800">Search Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {backfillResults.errors.map((error, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="text-center">
          <Button onClick={() => {
            setBackfillResults(null);
            loadEmployersWithoutEba();
          }}>
            Search More Employers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">EBA Backfill Manager</h2>
        <p className="text-gray-600">
          Search for Enterprise Bargaining Agreements for employers without EBA records
        </p>
      </div>

      {employers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">All Employers Have EBA Records</h3>
            <p className="text-gray-600">
              All employers in the database have associated EBA records.
            </p>
            <Button onClick={loadEmployersWithoutEba} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {employers.length} Employers Without EBA Records
              </CardTitle>
              <CardDescription>
                Search FWC database for Enterprise Bargaining Agreements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Select None
                </Button>
                <div className="text-sm text-gray-600 flex items-center ml-auto">
                  {selectedEmployers.size} of {employers.length} selected
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {employers.map((employer) => {
                  const searchState = searchStates[employer.id];
                  return (
                    <div key={employer.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedEmployers.has(employer.id)}
                            onChange={() => toggleEmployerSelection(employer.id)}
                            className="w-4 h-4"
                          />
                          <div>
                            <h4 className="font-medium">{employer.name}</h4>
                            <p className="text-sm text-gray-600">
                              {employer.employer_type} • {employer.suburb}, {employer.state}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => searchEbaForEmployer(employer)}
                            disabled={searchState?.isSearching}
                          >
                            {searchState?.isSearching ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openManualSearch(employer)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Search Results */}
                      {searchState && (
                        <div className="mt-3">
                          {searchState.error && (
                            <Alert variant="destructive" className="mb-2">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>{searchState.error}</AlertDescription>
                            </Alert>
                          )}
                          
                          {searchState.results.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-green-700">
                                Found {searchState.results.length} potential EBA matches:
                              </p>
                              {searchState.results.slice(0, 3).map((result, index) => (
                                <div key={index} className="bg-green-50 p-3 rounded border">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{result.title}</p>
                                      <div className="flex gap-2 mt-1">
                                        <Badge variant="outline" className="text-xs">
                                          {result.status}
                                        </Badge>
                                        {result.approvedDate && (
                                          <Badge variant="outline" className="text-xs">
                                            Approved: {result.approvedDate}
                                          </Badge>
                                        )}
                                        {result.expiryDate && (
                                          <Badge variant="outline" className="text-xs">
                                            Expires: {result.expiryDate}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => selectEbaResult(employer.id, result)}
                                    >
                                      <FileText className="h-4 w-4 mr-1" />
                                      Select
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              {searchState.results.length > 3 && (
                                <p className="text-sm text-gray-600">
                                  ...and {searchState.results.length - 3} more results
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button 
              onClick={batchSearchEbas}
              disabled={isProcessingBatch || selectedEmployers.size === 0}
              className="px-8"
            >
              {isProcessingBatch ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching EBAs...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search EBAs for {selectedEmployers.size} Selected Employers
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* EBA Selection Dialog */}
      <EbaSelectionDialog
        open={showEbaDialog}
        onOpenChange={setShowEbaDialog}
        ebaData={currentEbaData}
        onSave={saveEbaRecord}
      />
    </div>
  );
}

// EBA Selection Dialog Component
interface EbaSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ebaData: { employerId: string; result: FWCSearchResult } | null;
  onSave: (data: any) => void;
}

function EbaSelectionDialog({ open, onOpenChange, ebaData, onSave }: EbaSelectionDialogProps) {
  const [formData, setFormData] = useState({
    eba_file_number: '',
    fwc_lodgement_number: '',
    fwc_matter_number: '',
    fwc_document_url: '',
    summary_url: '',
    nominal_expiry_date: '',
    fwc_certified_date: '',
    comments: ''
  });

  useEffect(() => {
    if (ebaData?.result) {
      const result = ebaData.result;
      setFormData({
        eba_file_number: result.title.substring(0, 100),
        fwc_lodgement_number: result.lodgementNumber || '',
        fwc_matter_number: '',
        fwc_document_url: result.documentUrl || '',
        summary_url: result.summaryUrl || '',
        nominal_expiry_date: result.expiryDate || '',
        fwc_certified_date: result.approvedDate || '',
        comments: `Imported from FWC search. Agreement Type: ${result.agreementType}. Status: ${result.status}.`
      });
    }
  }, [ebaData]);

  const handleSave = () => {
    onSave(formData);
  };

  if (!ebaData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create EBA Record</DialogTitle>
          <DialogDescription>
            Create an EBA record based on the selected FWC search result
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected EBA Preview */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg">Selected EBA</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{ebaData.result.title}</p>
              <div className="flex gap-2 mt-2">
                <Badge>{ebaData.result.status}</Badge>
                <Badge variant="outline">{ebaData.result.agreementType}</Badge>
              </div>
              {ebaData.result.documentUrl && (
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <a href={ebaData.result.documentUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-4 w-4 mr-1" />
                    View Document
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eba_file_number">EBA File Number</Label>
              <Input
                id="eba_file_number"
                value={formData.eba_file_number}
                onChange={(e) => setFormData(prev => ({ ...prev, eba_file_number: e.target.value }))}
                placeholder="EBA file number or title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fwc_lodgement_number">FWC Lodgement Number</Label>
              <Input
                id="fwc_lodgement_number"
                value={formData.fwc_lodgement_number}
                onChange={(e) => setFormData(prev => ({ ...prev, fwc_lodgement_number: e.target.value }))}
                placeholder="e.g. AG2023/123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fwc_certified_date">FWC Certified Date</Label>
              <Input
                id="fwc_certified_date"
                type="date"
                value={formData.fwc_certified_date}
                onChange={(e) => setFormData(prev => ({ ...prev, fwc_certified_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nominal_expiry_date">Nominal Expiry Date</Label>
              <Input
                id="nominal_expiry_date"
                type="date"
                value={formData.nominal_expiry_date}
                onChange={(e) => setFormData(prev => ({ ...prev, nominal_expiry_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fwc_document_url">FWC Document URL</Label>
            <Input
              id="fwc_document_url"
              value={formData.fwc_document_url}
              onChange={(e) => setFormData(prev => ({ ...prev, fwc_document_url: e.target.value }))}
              placeholder="https://www.fwc.gov.au/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              value={formData.comments}
              onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
              placeholder="Additional notes about this EBA"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <FileText className="h-4 w-4 mr-2" />
              Save EBA Record
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
