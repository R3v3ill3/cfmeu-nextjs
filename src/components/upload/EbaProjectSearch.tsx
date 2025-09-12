'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Building2, ExternalLink, FileText, AlertTriangle, Info, XCircle, Users, HardHat, Filter } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from '@/components/ui/checkbox';
import { getTradeOptionsByStage, getAllStages, getStageLabel } from "@/utils/tradeUtils";

interface ProjectEmployer {
  id: string;
  name: string;
  project_count: number;
  eba_status: 'yes' | 'no' | 'pending' | null;
  projects: Array<{
    id: string;
    name: string;
  }>;
  roles: Array<{
    roleType: 'builder' | 'head_contractor' | 'project_manager';
    projectName: string;
  }>;
  trades: Array<{
    tradeType: string;
    projectName: string;
  }>;
  isKeyContractor: boolean;
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

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Employers' },
  { value: 'missing_only', label: 'Missing EBA Only' },
  { value: 'builder', label: 'Builders' },
  { value: 'head_contractor', label: 'Head Contractors' }, 
  { value: 'project_manager', label: 'Project Managers' },
  { value: 'key_contractors', label: 'Key Contractors' },
  { value: 'advanced', label: 'Advanced Filters...' },
];

interface EbaCoverageSummary {
  builders: { needsSearch: number; total: number };
  headContractors: { needsSearch: number; total: number };
  projectManagers: { needsSearch: number; total: number };
  keyContractors: { needsSearch: number; total: number };
}

export default function EbaProjectSearch() {
  const [projectEmployers, setProjectEmployers] = useState<ProjectEmployer[]>([]);
  const [filteredEmployers, setFilteredEmployers] = useState<ProjectEmployer[]>([]);
  const [ebaCoverageSummary, setEbaCoverageSummary] = useState<EbaCoverageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Record<string, EbaSearchState>>({});
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set());
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [employersToDismiss, setEmployersToDismiss] = useState<Set<string>>(new Set());
  const [processedEmployers, setProcessedEmployers] = useState<Set<string>>(new Set());
  const [filterBy, setFilterBy] = useState('missing_only');
  
  // Advanced filters state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    stages: new Set<string>(),
    trades: new Set<string>(),
    projects: new Set<string>()
  });
  
  // Manual search state
  const [manualSearchOpen, setManualSearchOpen] = useState<string | null>(null);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [isManualSearching, setIsManualSearching] = useState(false);

  const supabase = getSupabaseBrowserClient();
  const { toast } = useToast();

  // Load EBA coverage summary for all project employers
  const loadEbaCoverageSummary = useCallback(async () => {
    try {
      // Get ALL project employers (not just those without EBA records)
      const { data: allEmployers } = await supabase
        .from('employers')
        .select(`
          id,
          name,
          enterprise_agreement_status,
          company_eba_records!left(id),
          project_assignments!inner(
            assignment_type,
            contractor_role_types(code),
            trade_types(code)
          )
        `);

      if (!allEmployers) return;

      // Categorize employers
      const builders = new Set<string>();
      const headContractors = new Set<string>();
      const projectManagers = new Set<string>();
      const keyContractors = new Set<string>();

      allEmployers.forEach((emp: any) => {
        const hasEbaRecord = emp.company_eba_records?.length > 0;
        const hasKnownStatus = emp.enterprise_agreement_status !== null;
        const hasEbaInfo = hasEbaRecord || hasKnownStatus;

        emp.project_assignments?.forEach((pa: any) => {
          if (pa.assignment_type === 'contractor_role' && pa.contractor_role_types) {
            const roleCode = pa.contractor_role_types.code;
            if (roleCode === 'builder') builders.add(emp.id);
            if (roleCode === 'head_contractor') headContractors.add(emp.id);
            if (roleCode === 'project_manager') projectManagers.add(emp.id);
          }
          
          if (pa.assignment_type === 'trade_work' && pa.trade_types) {
            const tradeCode = pa.trade_types.code;
            if (KEY_CONTRACTOR_TRADES.has(tradeCode)) keyContractors.add(emp.id);
          }
        });

        // Also check roles for key contractor status
        const hasKeyRole = emp.project_assignments?.some((pa: any) => 
          pa.assignment_type === 'contractor_role' && 
          pa.contractor_role_types && 
          KEY_CONTRACTOR_ROLES.has(pa.contractor_role_types.code)
        );
        if (hasKeyRole) keyContractors.add(emp.id);
      });

      // Count those needing EBA search (no EBA record and unknown status)
      const employersNeedingSearch = allEmployers.filter((emp: any) => {
        const hasEbaRecord = emp.company_eba_records?.length > 0;
        const hasKnownStatus = emp.enterprise_agreement_status !== null;
        return !hasEbaRecord && !hasKnownStatus;
      });

      const needsSearchIds = new Set(employersNeedingSearch.map((e: any) => e.id));

      const summary: EbaCoverageSummary = {
        builders: {
          needsSearch: Array.from(builders).filter(id => needsSearchIds.has(id)).length,
          total: builders.size
        },
        headContractors: {
          needsSearch: Array.from(headContractors).filter(id => needsSearchIds.has(id)).length,
          total: headContractors.size
        },
        projectManagers: {
          needsSearch: Array.from(projectManagers).filter(id => needsSearchIds.has(id)).length,
          total: projectManagers.size
        },
        keyContractors: {
          needsSearch: Array.from(keyContractors).filter(id => needsSearchIds.has(id)).length,
          total: keyContractors.size
        }
      };

      setEbaCoverageSummary(summary);
    } catch (error) {
      console.error('Error loading EBA coverage summary:', error);
    }
  }, [supabase]);

  // Trade options for filtering
  const tradeOptionsByStage = useMemo(() => getTradeOptionsByStage(), []);
  const allStages = useMemo(() => getAllStages(), []);

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

  const loadProjectEmployers = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Query employers with project assignments from the new table structure
      const { data: employers, error } = await supabase
        .from('employers')
        .select(`
          id,
          name,
          enterprise_agreement_status,
          company_eba_records!left(id, employer_id),
          project_assignments!inner(
            project_id,
            assignment_type,
            projects!inner(id, name),
            contractor_role_types(code, name),
            trade_types(code, name)
          )
        `)
        .is('company_eba_records.id', null); // No EBA records = unknown status

      if (error) throw error;

      // Transform the data and enhance with role/trade information
      const baseEmployers: ProjectEmployer[] = (employers || []).map((emp: any) => {
        // Get unique projects from assignments
        const uniqueProjects = Array.from(
          new Map(
            emp.project_assignments
              ?.map((pa: any) => [pa.projects.id, pa.projects])
              .filter(([id, project]: any) => id && project)
          ).values()
        );

        const projects = uniqueProjects.map((project: any) => ({
          id: project.id,
          name: project.name
        })) || [];

        // Extract roles and trades from the already-fetched project_assignments data
        const roleAssignments = emp.project_assignments?.filter((pa: any) => 
          pa.assignment_type === 'contractor_role' && pa.contractor_role_types
        ) || [];
        
        const tradeAssignments = emp.project_assignments?.filter((pa: any) => 
          pa.assignment_type === 'trade_work' && pa.trade_types
        ) || [];

        const roles = roleAssignments.map((ra: any) => ({
          roleType: ra.contractor_role_types.code as 'builder' | 'head_contractor' | 'project_manager',
          projectName: ra.projects.name
        }));

        const tradesFromAssignments = tradeAssignments.map((ta: any) => ({
          tradeType: ta.trade_types.code,
          projectName: ta.projects.name
        }));

        // Determine if key contractor
        const hasKeyRole = roles.some((r: any) => KEY_CONTRACTOR_ROLES.has(r.roleType));
        const hasKeyTrade = tradesFromAssignments.some((t: any) => KEY_CONTRACTOR_TRADES.has(t.tradeType));

        return {
          id: emp.id,
          name: emp.name,
          project_count: projects.length,
          eba_status: emp.enterprise_agreement_status ? 'yes' : (emp.enterprise_agreement_status === false ? 'no' : null),
          projects: projects,
          roles: roles,
          trades: tradesFromAssignments, // Start with just the new assignments data
          isKeyContractor: hasKeyRole || hasKeyTrade
        };
      });

      // Optionally enhance with legacy trade data for more comprehensive coverage
      if (baseEmployers.length > 0) {
        const employerIds = baseEmployers.map(e => e.id);
        
        try {
          // Get additional trade data from legacy tables for completeness
          const { data: projectTrades } = await supabase
            .from('project_contractor_trades')
            .select(`
              employer_id,
              trade_type,
              projects!inner(name)
            `)
            .in('employer_id', employerIds);

          const { data: siteTrades } = await supabase
            .from('site_contractor_trades')
            .select(`
              employer_id,
              trade_type,
              job_sites!inner(projects!inner(name))
            `)
            .in('employer_id', employerIds);

          // Add legacy trades to the existing trades from project_assignments
          baseEmployers.forEach(employer => {
            const legacyProjectTrades = (projectTrades || [])
              .filter((t: any) => t.employer_id === employer.id)
              .map((t: any) => ({
                tradeType: t.trade_type,
                projectName: t.projects?.name || 'Unknown Project'
              }));

            const legacySiteTrades = (siteTrades || [])
              .filter((t: any) => t.employer_id === employer.id)
              .map((t: any) => ({
                tradeType: t.trade_type,
                projectName: t.job_sites?.projects?.name || 'Unknown Project'
              }));

            // Merge with existing trades, avoiding duplicates
            const allTrades = [...employer.trades, ...legacyProjectTrades, ...legacySiteTrades];
            const uniqueTrades = Array.from(
              new Map(allTrades.map(t => [`${t.tradeType}-${t.projectName}`, t])).values()
            );
            employer.trades = uniqueTrades;

            // Re-evaluate key contractor status with all trade data
            const hasKeyRole = employer.roles.some(role => KEY_CONTRACTOR_ROLES.has(role.roleType));
            const hasKeyTrade = employer.trades.some(trade => KEY_CONTRACTOR_TRADES.has(trade.tradeType));
            employer.isKeyContractor = hasKeyRole || hasKeyTrade;
          });
          
          console.log(`Enhanced ${baseEmployers.length} employers with comprehensive role and trade information (${baseEmployers.filter(e => e.isKeyContractor).length} key contractors)`);
        } catch (enhanceError) {
          console.warn('Failed to enhance employer data with legacy trades:', enhanceError);
          // Continue with data from project_assignments if legacy enhancement fails
        }
      }

      setProjectEmployers(baseEmployers);
      console.log(`Loaded ${baseEmployers.length} project employers with unknown EBA status`);
      
    } catch (error) {
      console.error('Error loading project employers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project employers',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);


  // Apply filters
  useEffect(() => {
    let filtered = projectEmployers;

    // Apply basic filter
    switch (filterBy) {
      case 'missing_only':
        filtered = filtered.filter(emp => emp.eba_status === 'no' || emp.eba_status === null);
        break;
      case 'builder':
        filtered = filtered.filter(emp => emp.roles.some(role => role.roleType === 'builder'));
        break;
      case 'head_contractor':
        filtered = filtered.filter(emp => emp.roles.some(role => role.roleType === 'head_contractor'));
        break;
      case 'project_manager':
        filtered = filtered.filter(emp => emp.roles.some(role => role.roleType === 'project_manager'));
        break;
      case 'key_contractors':
        filtered = filtered.filter(emp => emp.isKeyContractor);
        break;
      case 'advanced':
        // Advanced filtering uses separate filter state
        if (advancedFilters.stages.size > 0 || advancedFilters.trades.size > 0 || advancedFilters.projects.size > 0) {
          if (advancedFilters.stages.size > 0) {
            // For now, filter by available stages (could be enhanced)
            filtered = filtered.filter(emp => emp.trades.length > 0); // Has trades
          }
          if (advancedFilters.trades.size > 0) {
            filtered = filtered.filter(emp => 
              emp.trades.some(trade => advancedFilters.trades.has(trade.tradeType))
            );
          }
          if (advancedFilters.projects.size > 0) {
            filtered = filtered.filter(emp => 
              emp.projects.some(project => advancedFilters.projects.has(project.id))
            );
          }
        }
        break;
      case 'all':
      default:
        // Show all employers, no filtering
        break;
    }

    setFilteredEmployers(filtered);
  }, [projectEmployers, filterBy, advancedFilters]);

  // Load employers connected to projects
  useEffect(() => {
    loadProjectEmployers();
    loadEbaCoverageSummary();
  }, [loadProjectEmployers, loadEbaCoverageSummary]);

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
    }
  };

  const searchSelectedEmployers = async () => {
    if (selectedEmployers.size === 0) return;
    
    setIsSearching(true);
    
    try {
      const employersToSearch = filteredEmployers.filter(emp => selectedEmployers.has(emp.id));
      
      for (const employer of employersToSearch) {
        await searchEbaForEmployer(employer);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const createEbaRecord = useCallback(async (employerId: string, result: FWCSearchResult) => {
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

      // Mark employer as processed
      setProcessedEmployers(prev => new Set(prev).add(employerId));

      // Refresh the list to update EBA status
      await loadProjectEmployers();
      
      toast({
        title: 'EBA Record Created',
        description: `Successfully created EBA record for ${result.title}`,
      });
      
      return true;
    } catch (error) {
      console.error('Error creating EBA record:', error);
      toast({
        title: 'Error',
        description: 'Failed to create EBA record',
        variant: 'destructive',
      });
      return false;
    }
  }, [loadProjectEmployers, supabase, toast]);

  // Manual search for specific employer
  const performManualSearch = useCallback(async (employerId: string, searchTerm: string) => {
    setIsManualSearching(true);
    try {
      const response = await fetch('/api/fwc-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: searchTerm })
      });

      const data = await response.json();
      
      if (response.ok && data.results?.length > 0) {
        setSearchResults(prev => ({
          ...prev,
          [employerId]: {
            employerId,
            employerName: filteredEmployers.find(e => e.id === employerId)?.name || '',
            isSearching: false,
            results: data.results
          }
        }));
        
        toast({
          title: 'Manual Search Complete',
          description: `Found ${data.results.length} potential EBA matches for "${searchTerm}"`
        });
      } else {
        setSearchResults(prev => ({
          ...prev,
          [employerId]: {
            employerId,
            employerName: filteredEmployers.find(e => e.id === employerId)?.name || '',
            isSearching: false,
            results: [],
            error: data.error || 'No EBA results found'
          }
        }));
        
        toast({
          title: 'No Results',
          description: `No EBA matches found for "${searchTerm}"`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Manual search error:', error);
      setSearchResults(prev => ({
        ...prev,
        [employerId]: {
          employerId,
          employerName: filteredEmployers.find(e => e.id === employerId)?.name || '',
          isSearching: false,
          results: [],
          error: error instanceof Error ? error.message : 'Search failed'
        }
      }));
      
      toast({
        title: 'Search Failed',
        description: 'Manual EBA search encountered an error',
        variant: 'destructive'
      });
    } finally {
      setIsManualSearching(false);
      setManualSearchOpen(null);
      setManualSearchTerm('');
    }
  }, [toast, filteredEmployers]);

  // Skip employer (mark as processed without creating EBA record)
  const skipEmployer = useCallback((employerId: string) => {
    setProcessedEmployers(prev => new Set(prev).add(employerId));
    toast({
      title: 'Employer Skipped',
      description: 'Employer marked as skipped for EBA search'
    });
  }, [toast]);

  const finalizeDismissals = useCallback(async () => {
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
  }, [employersToDismiss, supabase, toast, loadProjectEmployers]);

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
    setSelectedEmployers(new Set(filteredEmployers.map(emp => emp.id)));
  };

  const selectNone = () => {
    setSelectedEmployers(new Set());
  };

  if (isLoading) {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <h2 className="text-xl font-semibold">Loading Project Employers...</h2>
        <p className="text-gray-600">Finding employers connected to projects with enhanced filtering</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Enhanced EBA Search for Project Employers</h2>
        <p className="text-gray-600">
          Search for Enterprise Bargaining Agreements with role and trade filtering
        </p>
      </div>

      {/* EBA Coverage Summary */}
      {ebaCoverageSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              EBA Coverage Summary
            </CardTitle>
            <CardDescription>
              Shows employers needing EBA search vs. total employers by role type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {ebaCoverageSummary.builders.needsSearch}/{ebaCoverageSummary.builders.total}
                </div>
                <div className="text-sm text-muted-foreground">Builders</div>
                <div className="text-xs text-muted-foreground mt-1">
                  need EBA search
                </div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {ebaCoverageSummary.headContractors.needsSearch}/{ebaCoverageSummary.headContractors.total}
                </div>
                <div className="text-sm text-muted-foreground">Head Contractors</div>
                <div className="text-xs text-muted-foreground mt-1">
                  need EBA search
                </div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {ebaCoverageSummary.projectManagers.needsSearch}/{ebaCoverageSummary.projectManagers.total}
                </div>
                <div className="text-sm text-muted-foreground">Project Managers</div>
                <div className="text-xs text-muted-foreground mt-1">
                  need EBA search
                </div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {ebaCoverageSummary.keyContractors.needsSearch}/{ebaCoverageSummary.keyContractors.total}
                </div>
                <div className="text-sm text-muted-foreground">Key Contractors</div>
                <div className="text-xs text-muted-foreground mt-1">
                  need EBA search
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Show:</Label>
              <Select value={filterBy} onValueChange={(value) => {
                setFilterBy(value);
                setShowAdvancedFilters(value === 'advanced');
              }}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <div className="text-sm font-medium">Advanced Filter Options</div>
                
                {/* Project Stages */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Project Stages</Label>
                  <div className="flex flex-wrap gap-2">
                    {allStages.map(stage => (
                      <label key={stage} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={advancedFilters.stages.has(stage)}
                          onCheckedChange={(checked) => {
                            setAdvancedFilters(prev => {
                              const newStages = new Set(prev.stages);
                              if (checked) {
                                newStages.add(stage);
                              } else {
                                newStages.delete(stage);
                              }
                              return { ...prev, stages: newStages };
                            });
                          }}
                        />
                        <span className="text-sm">{getStageLabel(stage)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Trade Types */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Trade Types</Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {Object.entries(tradeOptionsByStage).map(([stage, trades]) => (
                      <div key={stage}>
                        <div className="text-xs text-gray-600 font-medium capitalize">
                          {getStageLabel(stage as 'early_works' | 'structure' | 'finishing' | 'other')}
                        </div>
                        <div className="flex flex-wrap gap-1 ml-2">
                          {trades.slice(0, 5).map(trade => (
                            <label key={trade.value} className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                checked={advancedFilters.trades.has(trade.value)}
                                onCheckedChange={(checked) => {
                                  setAdvancedFilters(prev => {
                                    const newTrades = new Set(prev.trades);
                                    if (checked) {
                                      newTrades.add(trade.value);
                                    } else {
                                      newTrades.delete(trade.value);
                                    }
                                    return { ...prev, trades: newTrades };
                                  });
                                }}
                              />
                              <span className="text-xs">{trade.label}</span>
                            </label>
                          ))}
                          {trades.length > 5 && (
                            <span className="text-xs text-gray-500">+{trades.length - 5} more</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {filteredEmployers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Employers Found</h3>
            <p className="text-gray-600">
              No employers match the selected criteria. Try adjusting the filter options.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {filteredEmployers.length} Employers Match Criteria
              {filterBy !== 'all' && filterBy !== 'missing_only' && (
                <Badge variant="outline">
                  {FILTER_OPTIONS.find(f => f.value === filterBy)?.label || 'Filtered'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Select employers to search for EBAs. Current selection: {selectedEmployers.size} employers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All ({filteredEmployers.length})
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
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
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
                {filteredEmployers.map((employer) => {
                  const isSelected = selectedEmployers.has(employer.id);
                  const isProcessed = processedEmployers.has(employer.id);
                  const hasSearchResults = searchResults[employer.id];
                  
                  return (
                    <div key={employer.id} className={`border rounded-lg p-4 transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : ''} ${isProcessed ? 'opacity-75' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleEmployerSelection(employer.id)}
                            disabled={isProcessed}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{employer.name}</h4>
                              <Badge variant={employer.eba_status === 'yes' ? 'default' : 'destructive'} className="text-xs">
                                {employer.eba_status === 'yes' ? 'Has EBA' : 'No EBA'}
                              </Badge>
                              {employer.isKeyContractor && (
                                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                  Key Contractor
                                </Badge>
                              )}
                              {isProcessed && (
                                <Badge variant="default" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  ✓ Complete
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              Connected to {employer.project_count} project{employer.project_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Enhanced info display */}
                      {employer.roles.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs text-gray-600 mb-1">Roles:</div>
                          <div className="flex flex-wrap gap-1">
                            {employer.roles.slice(0, 3).map((role, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {role.roleType.replace('_', ' ')} @ {role.projectName}
                              </Badge>
                            ))}
                            {employer.roles.length > 3 && (
                              <span className="text-xs text-gray-500">+{employer.roles.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {employer.trades.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs text-gray-600 mb-1">Trades:</div>
                          <div className="space-y-1">
                            {employer.trades.slice(0, 3).map((trade, idx) => (
                              <div key={idx} className="text-xs text-blue-600">
                                {trade.tradeType} @ {trade.projectName}
                              </div>
                            ))}
                            {employer.trades.length > 3 && (
                              <div className="text-xs text-gray-500">+{employer.trades.length - 3} more trades</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Project list */}
                      <div className="text-xs text-blue-600 mb-2">
                        Projects: {employer.projects.map(p => p.name).join(', ')}
                      </div>

                      {/* Search results */}
                      {hasSearchResults && (
                        <div className="mt-3 p-3 bg-gray-50 rounded border">
                          {hasSearchResults.isSearching && (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                              <span className="text-sm">Searching FWC database...</span>
                            </div>
                          )}
                          
                          {!hasSearchResults.isSearching && (
                            <div>
                              {hasSearchResults.error && (
                                <Alert variant="destructive" className="mb-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertDescription>{hasSearchResults.error}</AlertDescription>
                                </Alert>
                              )}
                              
                              {hasSearchResults.results.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-green-700">
                                    Found {hasSearchResults.results.length} potential EBA matches:
                                  </p>
                                  {(expandedResults.has(employer.id)
                                    ? hasSearchResults.results
                                    : hasSearchResults.results.slice(0, 3)
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
                                          {!isProcessed && (
                                            <Button
                                              size="sm"
                                              onClick={() => createEbaRecord(employer.id, result)}
                                            >
                                              <FileText className="h-4 w-4 mr-1" />
                                              Create EBA Record
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {hasSearchResults.results.length > 3 && (
                                    <div className="text-center mt-2">
                                      <Button
                                        variant="link"
                                        onClick={() => toggleResultsExpansion(employer.id)}
                                      >
                                        {expandedResults.has(employer.id)
                                          ? 'Show Less'
                                          : `Show ${hasSearchResults.results.length - 3} More Results`}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Enhanced options for failed searches */}
                              {(hasSearchResults.error || hasSearchResults.results.length === 0) && !isProcessed && (
                                <div className="mt-3 pt-3 border-t flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => skipEmployer(employer.id)}
                                  >
                                    Skip Employer
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setManualSearchOpen(employer.id);
                                      setManualSearchTerm(employer.name);
                                    }}
                                  >
                                    Manual Search
                                  </Button>
                                </div>
                              )}

                              {!isProcessed && (
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
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Search Dialog */}
      {manualSearchOpen && (
        <Dialog open={!!manualSearchOpen} onOpenChange={(open) => {
          if (!open) {
            setManualSearchOpen(null);
            setManualSearchTerm('');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manual EBA Search</DialogTitle>
              <DialogDescription>
                Enter a different company name to search for EBAs
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Company Name</Label>
                <Input
                  value={manualSearchTerm}
                  onChange={(e) => setManualSearchTerm(e.target.value)}
                  placeholder="Enter company name for FWC search..."
                  disabled={isManualSearching}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setManualSearchOpen(null);
                    setManualSearchTerm('');
                  }}
                  disabled={isManualSearching}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (manualSearchTerm.trim() && manualSearchOpen) {
                      performManualSearch(manualSearchOpen, manualSearchTerm.trim());
                    }
                  }}
                  disabled={!manualSearchTerm.trim() || isManualSearching}
                >
                  {isManualSearching && (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  )}
                  {isManualSearching ? 'Searching...' : 'Search EBAs'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
