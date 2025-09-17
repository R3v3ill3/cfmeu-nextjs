'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Building2, 
  Search, 
  ExternalLink, 
  FileText,
  AlertTriangle,
  RefreshCw,
  Eye,
  Download,
  Filter,
  Users,
  HardHat,
  X,
  Plus
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Define key contractor roles and trades based on existing EbaProjectSearch definitions
const KEY_CONTRACTOR_TRADES = new Set([
  'demolition',
  'piling', 
  'concrete',
  'scaffolding',
  'form_work',
  'tower_crane',
  'mobile_crane',
  'labour_hire',
  'earthworks',
  'traffic_control'
]);

const KEY_CONTRACTOR_ROLES = new Set(['builder', 'project_manager']);

interface EmployerWithoutEba {
  id: string;
  name: string;
  employer_type: string;
  address_line_1?: string;
  suburb?: string;
  state?: string;
  created_at: string;
  project_assignments?: Array<{
    assignment_type: string;
    contractor_role_types?: { code: string }[];
    trade_types?: { code: string }[];
    projects?: { id: string; name: string }[];
  }>;
  project_count?: number;
  is_builder?: boolean;
  is_key_contractor?: boolean;
}

type FilterType = 'all' | 'builders' | 'key_contractors';

interface FilterState {
  type: FilterType;
  showAdvanced: boolean;
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
  reviewed?: boolean;
}

interface BackfillResults {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: string[];
}

interface PendingMatch {
  employerId: string;
  employerName: string;
  result: FWCSearchResult;
}

interface ManualSearchState {
  employerId: string;
  employerName: string;
  isSearching: boolean;
  customSearchTerm: string;
}

export function EbaBackfillManager() {
  const { toast } = useToast();
  const [employers, setEmployers] = useState<EmployerWithoutEba[]>([]);
  const [filteredEmployers, setFilteredEmployers] = useState<EmployerWithoutEba[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterState, setFilterState] = useState<FilterState>({ type: 'builders', showAdvanced: false });
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set());
  const [searchStates, setSearchStates] = useState<Record<string, EbaSearchState>>({});
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [showMatchReview, setShowMatchReview] = useState(false);
  const [showEbaDialog, setShowEbaDialog] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [manualSearchState, setManualSearchState] = useState<ManualSearchState | null>(null);
  const [currentEbaData, setCurrentEbaData] = useState<{
    employerId: string;
    result: FWCSearchResult;
  } | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [backfillResults, setBackfillResults] = useState<BackfillResults | null>(null);

  const loadEmployersWithoutEba = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();
      
      // Get all employers without EBA records first
      const { data: baseEmployers, error } = await supabase
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
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!baseEmployers || baseEmployers.length === 0) {
        setEmployers([]);
        setFilteredEmployers([]);
        setSelectedEmployers(new Set());
        return;
      }

      const employerIds = baseEmployers.map(emp => emp.id);

      // Get project assignments to determine roles and trades
      const { data: assignments, error: assignmentError } = await supabase
        .from('project_assignments')
        .select(`
          employer_id,
          assignment_type,
          contractor_role_types(code),
          trade_types(code),
          projects(id, name)
        `)
        .in('employer_id', employerIds);

      if (assignmentError) throw assignmentError;

      // Build employer data with role/trade information
      const employersWithoutEba: EmployerWithoutEba[] = baseEmployers.map((emp: any) => {
        const empAssignments = (assignments || []).filter((a: any) => a.employer_id === emp.id);
        
        // Determine if builder (has builder role or builder contractor role)
        const isBuilder = empAssignments.some((a: any) => 
          a.assignment_type === 'contractor_role' &&
          (Array.isArray(a.contractor_role_types) ? a.contractor_role_types : [])
            .some((rt: any) => 
              rt?.code === 'builder' ||
              rt?.code === 'building_contractor' ||
              rt?.code === 'construction_manager' ||
              rt?.code === 'managing_contractor'
            )
        );

        // Determine if key contractor (has key roles or key trades)
        const hasKeyRole = empAssignments.some((a: any) => 
          a.assignment_type === 'contractor_role' &&
          (Array.isArray(a.contractor_role_types) ? a.contractor_role_types : [])
            .some((rt: any) => rt?.code && KEY_CONTRACTOR_ROLES.has(rt.code))
        );
        const hasKeyTrade = empAssignments.some((a: any) => 
          a.assignment_type === 'trade_work' &&
          (Array.isArray(a.trade_types) ? a.trade_types : [])
            .some((tt: any) => tt?.code && KEY_CONTRACTOR_TRADES.has(tt.code))
        );
        const isKeyContractor = hasKeyRole || hasKeyTrade;

        // Get unique project count
        const uniqueProjects = new Set(
          empAssignments
            .flatMap((a: any) => (Array.isArray(a.projects) ? a.projects : []))
            .map((p: any) => p?.id)
            .filter(Boolean)
        );

        return {
          id: emp.id,
          name: emp.name,
          employer_type: emp.employer_type,
          address_line_1: emp.address_line_1,
          suburb: emp.suburb,
          state: emp.state,
          created_at: emp.created_at,
          project_assignments: empAssignments,
          project_count: uniqueProjects.size,
          is_builder: isBuilder,
          is_key_contractor: isKeyContractor
        };
      });

      setEmployers(employersWithoutEba);
      applyFilters(employersWithoutEba, filterState.type);
      
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
  }, [toast, filterState.type]);

  // Apply filters to employer list
  const applyFilters = useCallback((employerList: EmployerWithoutEba[], filterType: FilterType) => {
    let filtered = employerList;
    
    switch (filterType) {
      case 'builders':
        filtered = employerList.filter(emp => emp.is_builder);
        break;
      case 'key_contractors':
        filtered = employerList.filter(emp => emp.is_key_contractor);
        break;
      case 'all':
      default:
        filtered = employerList;
        break;
    }
    
    setFilteredEmployers(filtered);
    setSelectedEmployers(new Set(filtered.map(emp => emp.id)));
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilterType: FilterType) => {
    setFilterState(prev => ({ ...prev, type: newFilterType }));
    applyFilters(employers, newFilterType);
  }, [employers, applyFilters]);

  // Load employers without EBA records
  useEffect(() => {
    loadEmployersWithoutEba();
  }, []);


  const searchEbaForEmployer = async (employer: EmployerWithoutEba, customSearchTerm?: string) => {
    setSearchStates(prev => ({
      ...prev,
      [employer.id]: {
        employerId: employer.id,
        employerName: employer.name,
        isSearching: true,
        results: [],
        reviewed: false
      }
    }));

    try {
      const searchTerm = customSearchTerm || employer.name;
      const response = await fetch('/api/fwc-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: searchTerm })
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
          error: data.results?.length === 0 ? 'No EBA results found' : undefined,
          reviewed: false
        }
      }));

      if (data.results?.length > 0) {
        toast({
          title: "EBA search completed",
          description: `Found ${data.results.length} potential EBA matches for ${employer.name}`,
        });
        
        // Auto-add high-confidence matches to pending review
        const highConfidenceMatches = data.results.slice(0, 1); // Take the top result
        if (highConfidenceMatches.length > 0) {
          setPendingMatches(prev => [
            ...prev.filter(m => m.employerId !== employer.id), // Remove any existing match for this employer
            ...highConfidenceMatches.map((result: FWCSearchResult) => ({
              employerId: employer.id,
              employerName: employer.name,
              result
            }))
          ]);
        }
      }

    } catch (error) {
      console.error('EBA search error:', error);
      setSearchStates(prev => ({
        ...prev,
        [employer.id]: {
          ...prev[employer.id],
          isSearching: false,
          results: [],
          error: error instanceof Error ? error.message : 'Search failed',
          reviewed: false
        }
      }));

      toast({
        title: "EBA search failed",
        description: `Could not search for EBAs for ${employer.name}`,
        variant: "destructive",
      });
    }
  };

  const openManualSearch = (employer: EmployerWithoutEba) => {
    setManualSearchState({
      employerId: employer.id,
      employerName: employer.name,
      isSearching: false,
      customSearchTerm: employer.name
    });
    setShowManualSearch(true);
  };

  const performManualSearch = async () => {
    if (!manualSearchState) return;
    
    const employer = filteredEmployers.find(e => e.id === manualSearchState.employerId);
    if (!employer) return;

    setManualSearchState(prev => prev ? { ...prev, isSearching: true } : null);
    
    try {
      await searchEbaForEmployer(employer, manualSearchState.customSearchTerm);
      setShowManualSearch(false);
      setManualSearchState(null);
    } catch (error) {
      console.error('Manual search failed:', error);
    } finally {
      setManualSearchState(prev => prev ? { ...prev, isSearching: false } : null);
    }
  };

  const selectEbaResult = (employerId: string, result: FWCSearchResult) => {
    setCurrentEbaData({ employerId, result });
    setShowEbaDialog(true);
  };

  const addToPendingMatches = (employerId: string, result: FWCSearchResult) => {
    const employer = filteredEmployers.find(e => e.id === employerId);
    if (!employer) return;
    
    setPendingMatches(prev => [
      ...prev.filter(m => m.employerId !== employerId),
      { employerId, employerName: employer.name, result }
    ]);
    
    toast({
      title: "Added to review queue",
      description: `Added EBA match for ${employer.name} to review queue`,
    });
  };

  const removePendingMatch = (employerId: string) => {
    setPendingMatches(prev => prev.filter(m => m.employerId !== employerId));
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
      
      // Remove from pending matches if it was there
      setPendingMatches(prev => prev.filter(m => m.employerId !== currentEbaData.employerId));
      
      // Remove employer from lists
      setEmployers(prev => prev.filter(emp => emp.id !== currentEbaData.employerId));
      setFilteredEmployers(prev => prev.filter(emp => emp.id !== currentEbaData.employerId));
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
    setPendingMatches([]); // Clear existing pending matches
    
    const results: BackfillResults = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    const selectedEmployersList = filteredEmployers.filter(emp => selectedEmployers.has(emp.id));

    for (const employer of selectedEmployersList) {
      results.processed++;
      
      try {
        await searchEbaForEmployer(employer);
        results.successful++;
        
        // Add delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (error) {
        results.failed++;
        results.errors.push(`${employer.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    setIsProcessingBatch(false);

    toast({
      title: "Batch EBA search completed",
      description: `Processed ${results.processed} employers. ${results.successful} successful, ${results.failed} failed.`,
    });

    // Show match review if we have pending matches
    if (pendingMatches.length > 0) {
      setShowMatchReview(true);
    } else {
      setBackfillResults(results);
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
    setSelectedEmployers(new Set(filteredEmployers.map(emp => emp.id)));
  };

  const selectNone = () => {
    setSelectedEmployers(new Set());
  };

  if (isLoading) {
    return (
      <div className="text-center space-y-4">
        <img src="/spinner.gif" alt="Loading" className="w-8 h-8 mx-auto" />
        <h2 className="text-xl font-semibold">Loading Employers...</h2>
        <p className="text-gray-600">Finding employers without EBA records</p>
      </div>
    );
  }

  if (showMatchReview) {
    return (
      <MatchReviewInterface
        pendingMatches={pendingMatches}
        onApproveMatch={(match) => selectEbaResult(match.employerId, match.result)}
        onRejectMatch={removePendingMatch}
        onComplete={() => {
          setShowMatchReview(false);
          setBackfillResults({
            processed: pendingMatches.length,
            successful: 0,
            failed: 0,
            skipped: 0,
            errors: []
          });
        }}
      />
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

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Employers
          </CardTitle>
          <CardDescription>
            Choose which types of employers to search for EBAs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Label htmlFor="filter-select">Filter by role:</Label>
            <Select value={filterState.type} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employers ({employers.length})</SelectItem>
                <SelectItem value="builders">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Builders/Major Contractors ({employers.filter(e => e.is_builder).length})
                  </div>
                </SelectItem>
                <SelectItem value="key_contractors">
                  <div className="flex items-center gap-2">
                    <HardHat className="h-4 w-4" />
                    Key Contractors ({employers.filter(e => e.is_key_contractor).length})
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {pendingMatches.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => setShowMatchReview(true)}
                className="ml-auto"
              >
                <Eye className="h-4 w-4 mr-2" />
                Review {pendingMatches.length} Pending Matches
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {filteredEmployers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {filterState.type === 'all' 
                ? 'All Employers Have EBA Records' 
                : `No ${filterState.type.replace('_', ' ')} Found Without EBA Records`}
            </h3>
            <p className="text-gray-600">
              {filterState.type === 'all' 
                ? 'All employers in the database have associated EBA records.'
                : `All ${filterState.type.replace('_', ' ')} already have EBA records or are not assigned to projects.`}
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
                {filteredEmployers.length} {filterState.type === 'builders' ? 'Builders/Major Contractors' : 
                                          filterState.type === 'key_contractors' ? 'Key Contractors' : 'Employers'} Without EBA Records
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
                  {selectedEmployers.size} of {filteredEmployers.length} selected
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredEmployers.map((employer) => {
                  const searchState = searchStates[employer.id];
                  const hasPendingMatch = pendingMatches.some(m => m.employerId === employer.id);
                  
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
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{employer.name}</h4>
                              {employer.is_builder && <Badge variant="secondary" className="text-xs">Builder</Badge>}
                              {employer.is_key_contractor && <Badge variant="outline" className="text-xs">Key Contractor</Badge>}
                              {hasPendingMatch && <Badge className="text-xs bg-orange-100 text-orange-800">Pending Review</Badge>}
                            </div>
                            <p className="text-sm text-gray-600">
                              {employer.employer_type} • {employer.suburb}, {employer.state}
                              {employer.project_count && employer.project_count > 0 && ` • ${employer.project_count} projects`}
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
                              <img src="/spinner.gif" alt="Loading" className="h-4 w-4" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openManualSearch(employer)}
                          >
                            <Plus className="h-4 w-4" />
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
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => addToPendingMatches(employer.id, result)}
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add to Review
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => selectEbaResult(employer.id, result)}
                                      >
                                        <FileText className="h-4 w-4 mr-1" />
                                        Save Now
                                      </Button>
                                    </div>
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
                  <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
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

      {/* Dialogs */}
      <EbaSelectionDialog
        open={showEbaDialog}
        onOpenChange={setShowEbaDialog}
        ebaData={currentEbaData}
        onSave={saveEbaRecord}
      />
      
      <ManualSearchDialog
        open={showManualSearch}
        onOpenChange={setShowManualSearch}
        searchState={manualSearchState}
        onSearchTermChange={(term) => 
          setManualSearchState(prev => prev ? { ...prev, customSearchTerm: term } : null)
        }
        onSearch={performManualSearch}
      />
    </div>
  );
}

// Match Review Interface Component
interface MatchReviewInterfaceProps {
  pendingMatches: PendingMatch[];
  onApproveMatch: (match: PendingMatch) => void;
  onRejectMatch: (employerId: string) => void;
  onComplete: () => void;
}

function MatchReviewInterface({ pendingMatches, onApproveMatch, onRejectMatch, onComplete }: MatchReviewInterfaceProps) {
  const [reviewedMatches, setReviewedMatches] = useState<Set<string>>(new Set());

  const handleApprove = (match: PendingMatch) => {
    onApproveMatch(match);
    setReviewedMatches(prev => new Set([...prev, match.employerId]));
  };

  const handleReject = (employerId: string) => {
    onRejectMatch(employerId);
    setReviewedMatches(prev => new Set([...prev, employerId]));
  };

  const remainingMatches = pendingMatches.filter(m => !reviewedMatches.has(m.employerId));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Review EBA Matches</h2>
        <p className="text-gray-600">
          Review and approve the following potential EBA matches before saving
        </p>
        <div className="mt-2">
          <Badge variant="outline" className="text-sm">
            {remainingMatches.length} pending • {reviewedMatches.size} reviewed
          </Badge>
        </div>
      </div>

      {remainingMatches.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">All Matches Reviewed</h3>
            <p className="text-gray-600">
              You have reviewed all pending EBA matches.
            </p>
            <Button onClick={onComplete} className="mt-4">
              Complete Review
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {remainingMatches.map((match) => (
              <Card key={match.employerId} className="border-orange-200">
                <CardHeader>
                  <CardTitle className="text-lg">{match.employerName}</CardTitle>
                  <CardDescription>
                    Review this potential EBA match
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded border">
                    <h4 className="font-medium mb-2">Proposed EBA Match:</h4>
                    <p className="font-medium">{match.result.title}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{match.result.status}</Badge>
                      <Badge variant="outline">{match.result.agreementType}</Badge>
                      {match.result.approvedDate && (
                        <Badge variant="outline">Approved: {match.result.approvedDate}</Badge>
                      )}
                      {match.result.expiryDate && (
                        <Badge variant="outline">Expires: {match.result.expiryDate}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(match.employerId)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject Match
                    </Button>
                    <Button
                      onClick={() => handleApprove(match)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve & Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={onComplete}>
              Skip Review & Complete
            </Button>
            <Button 
              disabled={remainingMatches.length > 0}
              onClick={onComplete}
            >
              Complete Review ({reviewedMatches.size} processed)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// Manual Search Dialog Component
interface ManualSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchState: ManualSearchState | null;
  onSearchTermChange: (term: string) => void;
  onSearch: () => void;
}

function ManualSearchDialog({ open, onOpenChange, searchState, onSearchTermChange, onSearch }: ManualSearchDialogProps) {
  if (!searchState) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manual EBA Search</DialogTitle>
          <DialogDescription>
            Search for EBAs using a custom company name for {searchState.employerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-term">Company Name to Search</Label>
            <Input
              id="search-term"
              value={searchState.customSearchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Enter alternative company name to search"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={onSearch}
              disabled={searchState.isSearching || !searchState.customSearchTerm.trim()}
            >
              {searchState.isSearching ? (
                <>
                  <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search EBAs
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
