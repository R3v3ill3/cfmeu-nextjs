'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Building2, ExternalLink, FileText, AlertTriangle, Info, XCircle } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from '@/components/ui/checkbox';

interface ProjectEmployer {
  id: string;
  name: string;
  project_count: number;
  eba_status: 'yes' | 'no' | 'pending' | null;
  projects: Array<{
    id: string;
    name: string;
  }>;
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
}

export default function EbaProjectSearch() {
  const [projectEmployers, setProjectEmployers] = useState<ProjectEmployer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Record<string, EbaSearchState>>({});
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set());
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [employersToDismiss, setEmployersToDismiss] = useState<Set<string>>(new Set());

  const supabase = getSupabaseBrowserClient();
  const { toast } = useToast();

  // Prevent accidental navigation when there are pending dismissals
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (employersToDismiss.size > 0) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [employersToDismiss.size]);

  // Load employers connected to projects with unknown EBA status
  useEffect(() => {
    loadProjectEmployers();
  }, []);

  const loadProjectEmployers = async () => {
    try {
      setIsLoading(true);
      
      // Get employers that are connected to projects and have unknown EBA status
      const { data, error } = await supabase.rpc('get_project_employers_unknown_eba');
      
      if (error) {
        console.error('Error loading project employers:', error);
        // Fallback query if RPC doesn't exist
        await loadProjectEmployersFallback();
        return;
      }
      
      setProjectEmployers(data || []);
      console.log(`Loaded ${(data || []).length} project employers with unknown EBA status`);
    } catch (error) {
      console.error('Error loading project employers:', error);
      await loadProjectEmployersFallback();
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjectEmployersFallback = async () => {
    try {
      // Fallback query using standard SQL
      const { data: employers, error } = await supabase
        .from('employers')
        .select(`
          id,
          name,
          company_eba_records!left(id, employer_id),
          project_employer_roles!inner(
            project_id,
            project:projects!inner(id, name)
          )
        `)
        .is('company_eba_records.id', null); // No EBA records = unknown status

      if (error) throw error;

      // Transform the data
      const projectEmployers: ProjectEmployer[] = (employers || []).map((emp: any) => {
        const projects = emp.project_employer_roles?.map((per: any) => ({
          id: per.project.id,
          name: per.project.name
        })) || [];

        return {
          id: emp.id,
          name: emp.name,
          project_count: projects.length,
          eba_status: null, // Unknown
          projects: projects
        };
      });

      setProjectEmployers(projectEmployers);
      console.log(`Loaded ${projectEmployers.length} project employers with unknown EBA status (fallback)`);
    } catch (error) {
      console.error('Fallback query failed:', error);
    }
  };

  const searchEbaForEmployer = async (employer: ProjectEmployer) => {
    setSearchResults(prev => ({
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

      if (response.ok && data.results?.length > 0) {
        setSearchResults(prev => ({
          ...prev,
          [employer.id]: {
            ...prev[employer.id],
            isSearching: false,
            results: data.results,
          }
        }));
      } else {
        setSearchResults(prev => ({
          ...prev,
          [employer.id]: {
            ...prev[employer.id],
            isSearching: false,
            results: [],
            error: 'No EBA results found'
          }
        }));
        // Automatically mark for dismissal
        setEmployersToDismiss(prev => new Set(prev).add(employer.id));
      }

      // Add delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      setSearchResults(prev => ({
        ...prev,
        [employer.id]: {
          ...prev[employer.id],
          isSearching: false,
          results: [],
          error: error instanceof Error ? error.message : 'Search failed'
        }
      }));
      // Automatically mark for dismissal on error
      setEmployersToDismiss(prev => new Set(prev).add(employer.id));
    }
  };

  const searchSelectedEmployers = async () => {
    if (selectedEmployers.size === 0) return;
    
    setIsSearching(true);
    
    try {
      const employersToSearch = projectEmployers.filter(emp => selectedEmployers.has(emp.id));
      
      for (const employer of employersToSearch) {
        await searchEbaForEmployer(employer);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const createEbaRecord = async (employerId: string, result: FWCSearchResult) => {
    try {
      const { error } = await supabase
        .from('company_eba_records')
        .insert({
          employer_id: employerId,
          eba_file_number: result.title.substring(0, 100),
          fwc_lodgement_number: result.lodgementNumber,
          fwc_document_url: result.documentUrl,
          summary_url: result.summaryUrl,
          nominal_expiry_date: result.expiryDate,
          fwc_certified_date: result.approvedDate,
          comments: `Auto-imported from FWC search. Agreement Type: ${result.agreementType}. Status: ${result.status}.`
        });

      if (error) throw error;

      // Refresh the list to update EBA status
      await loadProjectEmployers();
      
      return true;
    } catch (error) {
      console.error('Error creating EBA record:', error);
      return false;
    }
  };

  const finalizeDismissals = async () => {
    if (employersToDismiss.size === 0) return;

    const employersToUpdate = Array.from(employersToDismiss);
    const recordsToInsert = employersToUpdate.map(id => ({
      employer_id: id,
      comments: 'Batch marked as "No EBA Found" after FWC search.',
      eba_file_number: 'N/A - No EBA Found'
    }));

    try {
      const { error } = await supabase
        .from('company_eba_records')
        .insert(recordsToInsert);

      if (error) throw error;

      toast({
        title: `${employersToUpdate.length} Employers Updated`,
        description: `Successfully marked employers as having no EBA.`,
      });

      setEmployersToDismiss(new Set());
      await loadProjectEmployers();

    } catch (error) {
      console.error('Error batch marking as No EBA:', error);
      toast({
        title: 'Error',
        description: 'Failed to update employer statuses.',
        variant: 'destructive',
      });
    }
  };

  const toggleDismissal = (employerId: string) => {
    setEmployersToDismiss(prev => {
      const updated = new Set(prev);
      if (updated.has(employerId)) {
        updated.delete(employerId);
      } else {
        updated.add(employerId);
      }
      return updated;
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

  const toggleResultsExpansion = (employerId: string) => {
    setExpandedResults(prev => {
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
    setSelectedEmployers(new Set(projectEmployers.map(emp => emp.id)));
  };

  const selectNone = () => {
    setSelectedEmployers(new Set());
  };

  if (isLoading) {
    return (
      <div className="text-center space-y-4">
        <img src="/spinner.gif" alt="Loading" className="w-8 h-8 mx-auto" />
        <h2 className="text-xl font-semibold">Loading Project Employers...</h2>
        <p className="text-gray-600">Finding employers connected to projects with unknown EBA status</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">EBA Search for Project Employers</h2>
        <p className="text-gray-600">
          Search for Enterprise Bargaining Agreements for employers connected to projects
        </p>
      </div>

      {projectEmployers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Employers Found</h3>
            <p className="text-gray-600">
              No employers connected to projects with unknown EBA status were found.
              All project employers may already have EBA records.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {projectEmployers.length} Project Employers with Unknown EBA Status
            </CardTitle>
            <CardDescription>
              These employers are connected to projects but don't have EBA records in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Select None
                </Button>
                <Button 
                  onClick={searchSelectedEmployers}
                  disabled={selectedEmployers.size === 0 || isSearching}
                  className="ml-auto"
                >
                  {isSearching ? (
                    <>
                      <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
                      Searching EBAs...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search EBAs for {selectedEmployers.size} Selected
                    </>
                  )}
                </Button>
                <Button
                  onClick={finalizeDismissals}
                  disabled={employersToDismiss.size === 0}
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Finalize {employersToDismiss.size} Dismissals
                </Button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {projectEmployers.map((employer) => (
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
                            Connected to {employer.project_count} project{employer.project_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        EBA Status: Unknown
                      </Badge>
                    </div>

                    {/* Project list */}
                    <div className="text-xs text-blue-600 mb-2">
                      Projects: {employer.projects.map(p => p.name).join(', ')}
                    </div>

                    {/* Search results */}
                    {searchResults[employer.id] && (
                      <div className="mt-3 p-3 bg-gray-50 rounded border">
                        {searchResults[employer.id].isSearching && (
                          <div className="flex items-center gap-2">
                            <img src="/spinner.gif" alt="Loading" className="h-4 w-4" />
                            <span className="text-sm">Searching FWC database...</span>
                          </div>
                        )}
                        
                        {!searchResults[employer.id].isSearching && (
                          <div>
                            {searchResults[employer.id].error && (
                              <Alert variant="destructive" className="mb-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{searchResults[employer.id].error}</AlertDescription>
                              </Alert>
                            )}
                            
                            {searchResults[employer.id].results.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-green-700">
                                  Found {searchResults[employer.id].results.length} potential EBA matches:
                                </p>
                                {(expandedResults.has(employer.id)
                                  ? searchResults[employer.id].results
                                  : searchResults[employer.id].results.slice(0, 3)
                                ).map((result, index) => (
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
                                      <div className="flex gap-1">
                                        {result.documentUrl && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            asChild
                                          >
                                            <a href={result.documentUrl} target="_blank" rel="noopener noreferrer">
                                              <ExternalLink className="h-4 w-4" />
                                            </a>
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          onClick={() => createEbaRecord(employer.id, result)}
                                        >
                                          <FileText className="h-4 w-4 mr-1" />
                                          Create EBA Record
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {searchResults[employer.id].results.length > 3 && (
                                  <div className="text-center mt-2">
                                    <Button
                                      variant="link"
                                      onClick={() => toggleResultsExpansion(employer.id)}
                                    >
                                      {expandedResults.has(employer.id)
                                        ? 'Show Less'
                                        : `Show ${searchResults[employer.id].results.length - 3} More Results`}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="mt-3 pt-3 border-t flex justify-end">
                              <label htmlFor={`dismiss-${employer.id}`} className="text-sm text-red-600 flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-red-50">
                                <Checkbox
                                  id={`dismiss-${employer.id}`}
                                  checked={employersToDismiss.has(employer.id)}
                                  onCheckedChange={() => toggleDismissal(employer.id)}
                                />
                                Mark for Dismissal (No EBA Found)
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
