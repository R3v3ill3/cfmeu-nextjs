'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search,
  Building2,
  ExternalLink,
  FileText,
  AlertTriangle,
  Info,
  Users,
  HardHat,
  Filter,
  CheckCircle,
  Clock,
  Play,
  Pause,
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { getTradeOptionsByStage, getAllStages, getStageLabel, type TradeStage } from '@/utils/tradeUtils'
import { FWCSearchResult, FwcLookupJobOptions } from '@/types/fwcLookup'

// Types for contractor roles and assignments
interface ContractorRole {
  id: string;
  employerId: string;
  employerName: string;
  roleType: 'builder' | 'head_contractor' | 'project_manager';
  projectName: string;
}

interface TradeAssignment {
  id: string;
  employerId: string;
  employerName: string;
  tradeType: string;
  stage: TradeStage;
  estimatedWorkforce?: number | null;
  siteName?: string;
}

interface SelectableEmployer {
  id: string;
  name: string;
  roles: ContractorRole[];
  trades: TradeAssignment[];
  hasEba: boolean;
  ebaStatus: 'active' | 'pending' | 'none' | 'unknown';
  isKeyContractor: boolean;
  searchComplete?: boolean; // Track if EBA search was completed for this employer
}

interface FilterCriteria {
  roles: Set<'builder' | 'head_contractor' | 'project_manager'>;
  trades: Set<string>;
  stages: Set<TradeStage>;
  ebaStatus: 'all' | 'missing_only' | 'has_eba';
  includeUnassigned: boolean;
  keyContractorsOnly: boolean;
}

const CONTRACTOR_ROLES = [
  { key: 'builder', label: 'Builder', icon: Building2 },
  { key: 'head_contractor', label: 'Head Contractor', icon: HardHat },
  { key: 'project_manager', label: 'Project Manager', icon: Users },
] as const;

const EBA_STATUS_OPTIONS = [
  { value: 'all', label: 'All Employers' },
  { value: 'missing_only', label: 'Missing EBA Only' },
  { value: 'has_eba', label: 'Has EBA Only' },
] as const;

// Key contractor trade types (from SubsetEbaStats.tsx comments)
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

// Key contractor roles
const KEY_CONTRACTOR_ROLES = new Set(['builder', 'project_manager']);

export interface SelectiveEbaSearchManagerProps {
  projectId: string;
  onClose?: () => void;
}

type ScraperJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

type ScraperJob = {
  id: string
  job_type: 'fwc_lookup' | 'incolink_sync'
  payload: Record<string, unknown>
  progress_total: number
  progress_completed: number
  status: ScraperJobStatus
  priority: number
  attempts: number
  max_attempts: number
  lock_token: string | null
  locked_at: string | null
  run_at: string
  last_error: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

type ScraperJobEvent = {
  id: number
  job_id: string
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

export default function SelectiveEbaSearchManager({ projectId, onClose }: SelectiveEbaSearchManagerProps) {
  // State management
  const [employers, setEmployers] = useState<SelectableEmployer[]>([]);
  const [filteredEmployers, setFilteredEmployers] = useState<SelectableEmployer[]>([]);
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterCriteria>({
    roles: new Set(),
    trades: new Set(),
    stages: new Set(),
    ebaStatus: 'all',
    includeUnassigned: false,
    keyContractorsOnly: false
  });
  
  // Loading and search states
  const [isLoading, setIsLoading] = useState(true);
  const [currentJob, setCurrentJob] = useState<ScraperJob | null>(null)
  const [jobEvents, setJobEvents] = useState<ScraperJobEvent[]>([])
  const [searchResults, setSearchResults] = useState<Record<string, { isSearching: boolean; results: FWCSearchResult[]; error?: string }>>({});

  // UI state
  const [activeTab, setActiveTab] = useState('selection');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Manual search state
  const [manualSearchOpen, setManualSearchOpen] = useState<string | null>(null); // employerId being manually searched
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [isManualSearching, setIsManualSearching] = useState(false);
  const [processedEmployers, setProcessedEmployers] = useState<Set<string>>(new Set()); // Track completed searches

  const { toast } = useToast()

  // Trade options for filtering
  const tradeOptionsByStage = useMemo(() => getTradeOptionsByStage(), []);
  const allStages = useMemo(() => getAllStages(), []);

  const progressCompleted = currentJob?.progress_completed ?? 0
  const progressTotal = currentJob?.progress_total ?? 0
  const progressPercent = progressTotal > 0 ? Math.round((progressCompleted / progressTotal) * 100) : 0

  const statusLabels: Record<ScraperJobStatus, string> = {
    queued: 'Queued',
    running: 'Running',
    succeeded: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }

  // Simplified job step display for user-facing progress feedback (UI-only)
  const jobSteps = ['Queued', 'Searching FWC', 'Processing Results', 'Finalizing'] as const

  const deriveStepIndexForJob = (status: ScraperJobStatus, percent: number) => {
    if (status === 'queued') return 0
    if (status === 'running') {
      if (percent < 10) return 0
      if (percent < 90) return 1
      return 2
    }
    // succeeded, failed, cancelled
    return 3
  }

  const currentStepIndex = deriveStepIndexForJob(currentJob?.status ?? 'queued', progressPercent)

  const formatTimestamp = useCallback((value: string | null | undefined) => {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
    }
  }, [])

  // Load project employers with their roles and trade assignments
  const loadProjectEmployers = useCallback(async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    try {
      // Get contractor role assignments (using project_assignments table)
      const { data: roleAssignments } = await supabase
        .from('project_assignments')
        .select(`
          id,
          employer_id,
          employers!inner(id, name, enterprise_agreement_status),
          contractor_role_types!inner(code, label)
        `)
        .eq('project_id', projectId)
        .eq('assignment_type', 'contractor_role');

      // Get trade assignments from both project and site levels
      const { data: projectTrades } = await supabase
        .from('project_contractor_trades')
        .select(`
          id,
          employer_id,
          trade_type,
          stage,
          estimated_project_workforce,
          employers!inner(id, name, enterprise_agreement_status)
        `)
        .eq('project_id', projectId);

      const { data: siteTrades } = await supabase
        .from('site_contractor_trades')
        .select(`
          id,
          employer_id,
          trade_type,
          employers!inner(id, name, enterprise_agreement_status),
          job_sites!inner(id, name, project_id)
        `)
        .eq('job_sites.project_id', projectId);

      // Get EBA status for all employers
      const allEmployerIds = new Set<string>();
      (roleAssignments || []).forEach((r: any) => allEmployerIds.add(r.employer_id));
      (projectTrades || []).forEach((t: any) => allEmployerIds.add(t.employer_id));
      (siteTrades || []).forEach((t: any) => allEmployerIds.add(t.employer_id));

      const { data: ebaRecords } = await supabase
        .from('company_eba_records')
        .select('employer_id, fwc_document_url, nominal_expiry_date')
        .in('employer_id', Array.from(allEmployerIds));

      // Build employer map with EBA status
      const ebaMap = new Map<string, { hasEba: boolean; status: 'active' | 'pending' | 'none' }>();
      (ebaRecords || []).forEach((record: any) => {
        const hasDoc = !!record.fwc_document_url;
        const isActive = hasDoc && (!record.nominal_expiry_date || new Date(record.nominal_expiry_date) > new Date());
        ebaMap.set(record.employer_id, {
          hasEba: hasDoc,
          status: isActive ? 'active' : 'pending'
        });
      });

      // Build unified employer data
      const employerMap = new Map<string, SelectableEmployer>();

      // Process role assignments
      (roleAssignments || []).forEach((assignment: any) => {
        const employer = assignment.employers;
        const roleCode = assignment.contractor_role_types?.code;
        if (!employer || !roleCode) return;

        if (!employerMap.has(employer.id)) {
          const ebaInfo = ebaMap.get(employer.id);
          employerMap.set(employer.id, {
            id: employer.id,
            name: employer.name,
            roles: [],
            trades: [],
            hasEba: ebaInfo?.hasEba || false,
            ebaStatus: ebaInfo?.status || (employer.enterprise_agreement_status === 'active' ? 'active' : 'none'),
            isKeyContractor: false // Will be updated based on roles and trades
          });
        }

        employerMap.get(employer.id)!.roles.push({
          id: assignment.id,
          employerId: employer.id,
          employerName: employer.name,
          roleType: roleCode as 'builder' | 'head_contractor' | 'project_manager',
          projectName: 'Current Project' // Could be enhanced to include actual project name
        });
      });

      // Process project trade assignments
      (projectTrades || []).forEach((trade: any) => {
        const employer = trade.employers;
        if (!employer) return;

        if (!employerMap.has(employer.id)) {
          const ebaInfo = ebaMap.get(employer.id);
          employerMap.set(employer.id, {
            id: employer.id,
            name: employer.name,
            roles: [],
            trades: [],
            hasEba: ebaInfo?.hasEba || false,
            ebaStatus: ebaInfo?.status || (employer.enterprise_agreement_status === 'active' ? 'active' : 'none'),
            isKeyContractor: false // Will be updated based on roles and trades
          });
        }

        employerMap.get(employer.id)!.trades.push({
          id: trade.id,
          employerId: employer.id,
          employerName: employer.name,
          tradeType: trade.trade_type,
          stage: trade.stage as TradeStage,
          estimatedWorkforce: trade.estimated_project_workforce
        });
      });

      // Process site trade assignments
      (siteTrades || []).forEach((trade: any) => {
        const employer = trade.employers;
        const site = trade.job_sites;
        if (!employer || !site) return;

        if (!employerMap.has(employer.id)) {
          const ebaInfo = ebaMap.get(employer.id);
          employerMap.set(employer.id, {
            id: employer.id,
            name: employer.name,
            roles: [],
            trades: [],
            hasEba: ebaInfo?.hasEba || false,
            ebaStatus: ebaInfo?.status || (employer.enterprise_agreement_status === 'active' ? 'active' : 'none'),
            isKeyContractor: false // Will be updated based on roles and trades
          });
        }

        employerMap.get(employer.id)!.trades.push({
          id: trade.id,
          employerId: employer.id,
          employerName: employer.name,
          tradeType: trade.trade_type,
          stage: 'other' as TradeStage, // Site trades don't have stages
          siteName: site.name
        });
      });

      // Determine key contractor status for each employer
      employerMap.forEach((employer, employerId) => {
        // Check if employer has key contractor roles
        const hasKeyRole = employer.roles.some(role => KEY_CONTRACTOR_ROLES.has(role.roleType));
        
        // Check if employer has key contractor trades
        const hasKeyTrade = employer.trades.some(trade => KEY_CONTRACTOR_TRADES.has(trade.tradeType));
        
        // Update key contractor status
        employer.isKeyContractor = hasKeyRole || hasKeyTrade;
      });

      const employerList = Array.from(employerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      setEmployers(employerList);
      console.log(`Loaded ${employerList.length} employers with roles and trades (${employerList.filter(e => e.isKeyContractor).length} key contractors)`);

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
  }, [projectId, toast]);

  // Apply filters to employer list
  useEffect(() => {
    let filtered = employers;

    // Filter by key contractors only
    if (filters.keyContractorsOnly) {
      filtered = filtered.filter(emp => emp.isKeyContractor);
    }

    // Filter by EBA status
    if (filters.ebaStatus === 'missing_only') {
      filtered = filtered.filter(emp => !emp.hasEba || emp.ebaStatus === 'none');
    } else if (filters.ebaStatus === 'has_eba') {
      filtered = filtered.filter(emp => emp.hasEba);
    }

    // Filter by roles
    if (filters.roles.size > 0) {
      filtered = filtered.filter(emp => 
        emp.roles.some(role => filters.roles.has(role.roleType)) ||
        (filters.includeUnassigned && emp.roles.length === 0)
      );
    }

    // Filter by trades
    if (filters.trades.size > 0) {
      filtered = filtered.filter(emp => 
        emp.trades.some(trade => filters.trades.has(trade.tradeType)) ||
        (filters.includeUnassigned && emp.trades.length === 0)
      );
    }

    // Filter by stages
    if (filters.stages.size > 0) {
      filtered = filtered.filter(emp => 
        emp.trades.some(trade => filters.stages.has(trade.stage)) ||
        (filters.includeUnassigned && emp.trades.length === 0)
      );
    }

    setFilteredEmployers(filtered);
  }, [employers, filters]);

  // Initialize data loading
  useEffect(() => {
    loadProjectEmployers();
  }, [loadProjectEmployers]);

  // Handle filter changes
  const handleRoleFilterChange = (role: typeof CONTRACTOR_ROLES[number]['key'], checked: boolean) => {
    setFilters(prev => {
      const newRoles = new Set(prev.roles);
      if (checked) {
        newRoles.add(role);
      } else {
        newRoles.delete(role);
      }
      return { ...prev, roles: newRoles };
    });
  };

  const handleTradeFilterChange = (trade: string, checked: boolean) => {
    setFilters(prev => {
      const newTrades = new Set(prev.trades);
      if (checked) {
        newTrades.add(trade);
      } else {
        newTrades.delete(trade);
      }
      return { ...prev, trades: newTrades };
    });
  };

  const handleStageFilterChange = (stage: TradeStage, checked: boolean) => {
    setFilters(prev => {
      const newStages = new Set(prev.stages);
      if (checked) {
        newStages.add(stage);
      } else {
        newStages.delete(stage);
      }
      return { ...prev, stages: newStages };
    });
  };

  // Employer selection handlers
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

  const selectAllFiltered = () => {
    setSelectedEmployers(new Set(filteredEmployers.map(emp => emp.id)));
  };

  const selectNone = () => {
    setSelectedEmployers(new Set());
  };

  // Start EBA search for selected employers
  const startEbaSearch = async () => {
    if (selectedEmployers.size === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select at least one employer to search for EBAs.',
        variant: 'destructive',
      });
      return;
    }

    const employerIds = Array.from(selectedEmployers);
    
    try {
      const jobOptions: FwcLookupJobOptions = {
        priority: 'normal',
        skipExisting: filters.ebaStatus === 'missing_only',
        batchSize: 3,
        autoSelectBest: true,
      }

      const response = await fetch('/api/scraper-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobType: 'fwc_lookup',
          payload: {
            employerIds,
            options: jobOptions,
            projectId,
          },
          priority: jobOptions.priority === 'high' ? 2 : jobOptions.priority === 'low' ? 8 : 5,
          progressTotal: employerIds.length,
          maxAttempts: 5,
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const { job } = (await response.json()) as { job: ScraperJob }

      setCurrentJob(job)
      setJobEvents([])
      setActiveTab('results')

      toast({
        title: 'EBA Search Queued',
        description: `Queued ${employerIds.length} employers for background lookup. You can close this panel and return later.`,
      })

    } catch (error) {
      console.error('Failed to start EBA search:', error);
      toast({
        title: 'Search Failed',
        description: 'Failed to start EBA search. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const fetchJobDetails = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/scraper-jobs?id=${jobId}&includeEvents=1`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { job: ScraperJob; events?: ScraperJobEvent[] };
    setCurrentJob(data.job);
    setJobEvents(data.events ?? []);
    return data.job;
  }, []);

  useEffect(() => {
    if (!currentJob) return;
    const terminalStatuses: ScraperJobStatus[] = ['succeeded', 'failed', 'cancelled'];
    if (terminalStatuses.includes(currentJob.status)) return;

    let cancelled = false;

    const poll = async () => {
      try {
        await fetchJobDetails(currentJob.id);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to poll scraper job:', error);
        }
      }
    };

    const interval = setInterval(poll, 4000);
    void poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentJob?.id, currentJob?.status, fetchJobDetails]);

  const lastNotifiedJobRef = useRef<{ id: string; status: ScraperJobStatus } | null>(null);

  useEffect(() => {
    if (!currentJob) {
      lastNotifiedJobRef.current = null;
      return;
    }

    const terminalStatuses: ScraperJobStatus[] = ['succeeded', 'failed', 'cancelled'];
    if (!terminalStatuses.includes(currentJob.status)) return;

    const previous = lastNotifiedJobRef.current;
    if (previous && previous.id === currentJob.id && previous.status === currentJob.status) {
      return;
    }

    lastNotifiedJobRef.current = { id: currentJob.id, status: currentJob.status };

    loadProjectEmployers();

    const title =
      currentJob.status === 'succeeded'
        ? 'EBA Search Complete'
        : currentJob.status === 'failed'
        ? 'EBA Search Failed'
        : 'EBA Search Cancelled';

    const description =
      currentJob.status === 'succeeded'
        ? 'Background lookup finished. Employer data will refresh with the latest EBA information.'
        : currentJob.last_error || 'The background lookup finished with issues. Review the timeline for details.';

    toast({
      title,
      description,
      variant: currentJob.status === 'succeeded' ? 'default' : 'destructive',
    });
  }, [currentJob?.id, currentJob?.status, currentJob?.last_error, loadProjectEmployers, toast]);

  // Create EBA record from search result
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

      // Update employer enterprise agreement status
      await supabase
        .from('employers')
        .update({ enterprise_agreement_status: 'active' })
        .eq('id', employerId);

      // Mark employer as processed
      setProcessedEmployers(prev => new Set(prev).add(employerId));

      // Refresh the employer list to reflect changes
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
  }, [loadProjectEmployers, toast]);

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
  }, [toast]);

  // Skip employer (mark as processed without creating EBA record)
  const skipEmployer = useCallback((employerId: string) => {
    setProcessedEmployers(prev => new Set(prev).add(employerId));
    toast({
      title: 'Employer Skipped',
      description: 'Employer marked as skipped for EBA search'
    });
  }, [toast]);

  // Render employer selection card
  const renderEmployerCard = (employer: SelectableEmployer) => {
    const isSelected = selectedEmployers.has(employer.id);
    const statusVariant = employer.ebaStatus === 'active' ? 'default' : 
                         employer.ebaStatus === 'pending' ? 'secondary' : 'destructive';
    const isProcessed = processedEmployers.has(employer.id);
    const hasSearchResults = searchResults[employer.id];
    
    return (
      <Card key={employer.id} className={`border transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : ''} ${isProcessed ? 'opacity-75' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleEmployerSelection(employer.id)}
                className="mt-1"
                disabled={isProcessed}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium">{employer.name}</h4>
                  <Badge variant={statusVariant} className="text-xs">
                    {employer.ebaStatus === 'active' ? 'Active EBA' :
                     employer.ebaStatus === 'pending' ? 'EBA Pending' : 'No EBA'}
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
                
                {/* Role assignments */}
                {employer.roles.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-600 mb-1">Contractor Roles:</div>
                    <div className="flex flex-wrap gap-1">
                      {employer.roles.map((role, idx) => {
                        const roleConfig = CONTRACTOR_ROLES.find(r => r.key === role.roleType);
                        const Icon = roleConfig?.icon || Building2;
                        return (
                          <Badge key={idx} variant="outline" className="text-xs flex items-center gap-1">
                            <Icon className="w-3 h-3" />
                            {roleConfig?.label || role.roleType}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Trade assignments */}
                {employer.trades.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Trade Assignments:</div>
                    <div className="space-y-1">
                      {employer.trades.slice(0, 3).map((trade, idx) => (
                        <div key={idx} className="text-xs text-blue-600">
                          {trade.tradeType} ({getStageLabel(trade.stage)})
                          {trade.siteName && ` @ ${trade.siteName}`}
                          {trade.estimatedWorkforce && ` - ${trade.estimatedWorkforce} workers`}
                        </div>
                      ))}
                      {employer.trades.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{employer.trades.length - 3} more trades...
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {employer.roles.length === 0 && employer.trades.length === 0 && (
                  <div className="text-xs text-gray-500">No specific role or trade assignments</div>
                )}
                
                {/* Search Results */}
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
                            {hasSearchResults.results.slice(0, 2).map((result, index) => (
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
                          </div>
                        )}

                        {/* Manual search and skip options for failed searches */}
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
                                setManualSearchTerm(employer.name); // Pre-fill with employer name
                              }}
                            >
                              Manual Search
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="text-center space-y-4 p-8">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <h2 className="text-xl font-semibold">Loading Project Contractors...</h2>
        <p className="text-gray-600">Analyzing contractor roles and trade assignments</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Selective EBA FWC Search</h2>
        <p className="text-gray-600">
          Search for Enterprise Bargaining Agreements for specific contractor roles and trade assignments
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="selection">Employer Selection</TabsTrigger>
          <TabsTrigger value="results">Search Results</TabsTrigger>
        </TabsList>

        <TabsContent value="selection" className="space-y-6">
          {/* Filter Controls */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filter Criteria
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  {showAdvancedFilters ? 'Hide' : 'Show'} Advanced
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* EBA Status Filter */}
              <div>
                <Label className="text-sm font-medium">EBA Status</Label>
                <Select value={filters.ebaStatus} onValueChange={(value: any) => setFilters(prev => ({ ...prev, ebaStatus: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EBA_STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Key Contractors Filter */}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={filters.keyContractorsOnly}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, keyContractorsOnly: !!checked }))}
                />
                <Label className="text-sm font-medium">Key Contractors Only</Label>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </div>

              {/* Role Filters */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Contractor Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {CONTRACTOR_ROLES.map(role => {
                    const Icon = role.icon;
                    return (
                      <label key={role.key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={filters.roles.has(role.key)}
                          onCheckedChange={(checked) => handleRoleFilterChange(role.key, !!checked)}
                        />
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{role.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {showAdvancedFilters && (
                <>
                  {/* Stage Filters */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Project Stages</Label>
                    <div className="flex flex-wrap gap-2">
                      {allStages.map(stage => (
                        <label key={stage} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={filters.stages.has(stage)}
                            onCheckedChange={(checked) => handleStageFilterChange(stage, !!checked)}
                          />
                          <span className="text-sm">{getStageLabel(stage)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Trade Type Filters */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Trade Types</Label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {Object.entries(tradeOptionsByStage).map(([stage, trades]) => (
                        <div key={stage}>
                          <div className="text-xs text-gray-600 font-medium capitalize">
                            {getStageLabel(stage as TradeStage)}
                          </div>
                          <div className="flex flex-wrap gap-1 ml-2">
                            {trades.map(trade => (
                              <label key={trade.value} className="flex items-center gap-1 cursor-pointer">
                                <Checkbox
                                  checked={filters.trades.has(trade.value)}
                                  onCheckedChange={(checked) => handleTradeFilterChange(trade.value, !!checked)}
                                />
                                <span className="text-xs">{trade.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Include unassigned */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={filters.includeUnassigned}
                      onCheckedChange={(checked) => setFilters(prev => ({ ...prev, includeUnassigned: !!checked }))}
                    />
                    <Label className="text-sm">Include employers with no specific assignments</Label>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Employer Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {filteredEmployers.length} Employers Match Criteria
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                    Select All ({filteredEmployers.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>
                    Select None
                  </Button>
                </div>
              </div>
              <CardDescription>
                Select employers to search for EBAs. Current selection: {selectedEmployers.size} employers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredEmployers.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Employers Match Criteria</h3>
                  <p className="text-gray-600">
                    Adjust your filters to find employers to search for EBAs.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredEmployers.map(renderEmployerCard)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search Actions */}
          {selectedEmployers.size > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Ready to Search</div>
                    <div className="text-sm text-gray-600">
                      {selectedEmployers.size} employer{selectedEmployers.size !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                  <Button onClick={startEbaSearch} className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Start EBA FWC Search
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {currentJob ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {currentJob.status === 'running' && <Clock className="h-5 w-5 animate-spin" />}
                  {currentJob.status === 'queued' && <Clock className="h-5 w-5" />}
                  {currentJob.status === 'succeeded' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  {currentJob.status === 'failed' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                  {currentJob.status === 'cancelled' && <AlertTriangle className="h-5 w-5 text-amber-600" />}
                  EBA Search Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 break-words">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Status</span>
                    <span>{statusLabels[currentJob.status]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>
                      {progressCompleted} of {progressTotal}
                    </span>
                  </div>
                  {['queued', 'running'].includes(currentJob.status) && (
                    <div className="flex items-center gap-2">
                      <img src="/spinner.gif" alt="Loading" className="w-4 h-4" />
                      <span className="text-sm text-muted-foreground">Searching FWC database...</span>
                    </div>
                  )}
                  <Progress value={progressPercent} className="w-full" />
                </div>

                {/* User-friendly stepper (replaces debug details) */}
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    {jobSteps.map((label, idx) => {
                      const isCompleted = idx < currentStepIndex
                      const isCurrent = idx === currentStepIndex
                      return (
                        <div key={label} className="flex items-center flex-1 min-w-0">
                          <div
                            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                              isCompleted
                                ? 'bg-green-600 text-white'
                                : isCurrent
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div className="ml-2 text-xs truncate">{label}</div>
                          {idx < jobSteps.length - 1 && (
                            <div className={`mx-2 h-0.5 flex-1 ${idx < currentStepIndex ? 'bg-green-600' : 'bg-gray-200'}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {currentJob.last_error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{currentJob.last_error}</AlertDescription>
                  </Alert>
                )}
                {/* Debug timeline hidden in user-facing mode */}
                {false && jobEvents.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Job Timeline</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto rounded border bg-muted/30 p-3">
                      {jobEvents.map((event) => (
                        <div key={event.id} className="rounded bg-background p-3 text-sm shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold uppercase tracking-wide text-xs text-muted-foreground">
                                {event.event_type}
                              </div>
                              {event.payload && Object.keys(event.payload).length > 0 && (
                                <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                                  {JSON.stringify(event.payload, null, 2)}
                                </pre>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(event.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Search in Progress</h3>
                <p className="text-gray-600">
                  Return to the Selection tab to start a new EBA search.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('selection')}
                  className="mt-4"
                >
                  Back to Selection
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
