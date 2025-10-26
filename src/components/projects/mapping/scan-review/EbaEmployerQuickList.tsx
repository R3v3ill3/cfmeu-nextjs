'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Building2,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Star,
  Filter,
  Zap,
  ArrowRight,
  ExternalLink,
  History
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { getTradeLabel, getTradeStage, getStageLabel } from '@/utils/tradeUtils';
// Native debounce function to avoid external dependency
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

interface EbaEmployer {
  id: string;
  name: string;
  eba_status: 'yes' | 'no' | 'pending' | null;
  project_count: number;
  projects: Array<{
    id: string;
    name: string;
  }>;
  trades: Array<{
    tradeType: string;
    projectName: string;
  }>;
  roles: Array<{
    roleType: 'builder' | 'head_contractor' | 'project_manager';
    projectName: string;
  }>;
  isKeyContractor: boolean;
  aliases?: Array<{
    alias: string;
    confidence: number;
  }>;
  lastUpdated?: string;
}

interface EbaEmployerQuickListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tradeType?: string;
  stage?: string;
  projectId?: string;
  onEmployerSelect: (employer: EbaEmployer) => void;
  onBatchSelect?: (employers: EbaEmployer[]) => void;
  excludeEmployerIds?: string[];
}

const KEY_CONTRACTOR_TRADES = new Set([
  'demolition', 'earthworks', 'piling', 'scaffolding',
  'structural_steel', 'concreting', 'form_work', 'bricklaying'
]);

export function EbaEmployerQuickList({
  open,
  onOpenChange,
  tradeType,
  stage,
  projectId,
  onEmployerSelect,
  onBatchSelect,
  excludeEmployerIds = []
}: EbaEmployerQuickListProps) {
  const [employers, setEmployers] = useState<EbaEmployer[]>([]);
  const [filteredEmployers, setFilteredEmployers] = useState<EbaEmployer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'projects' | 'eba_status'>('name');
  const [ebaStatusFilter, setEbaStatusFilter] = useState<'all' | 'yes' | 'pending' | 'no'>('all');
  const [showOnlyKeyContractors, setShowOnlyKeyContractors] = useState(false);

  const supabase = getSupabaseBrowserClient();
  const { toast } = useToast();

  // Debounce search term
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearchTerm(value);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
    return debouncedSearch.cancel;
  }, [searchTerm, debouncedSearch]);

  // Load EBA employers filtered by trade
  const loadEbaEmployers = useCallback(async () => {
    if (!open) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('employers_search_optimized')
        .select(`
          id,
          name,
          enterprise_agreement_status,
          company_eba_records!left(id, employer_id),
          project_assignments!inner(
            assignment_type,
            projects!inner(id, name),
            contractor_role_types(code, name)
          ),
          employer_aliases!left(alias, confidence_score)
        `);

      // If trade type is specified, filter by employers who have worked on that trade
      if (tradeType) {
        // Get employers who have worked on this specific trade
        const { data: tradeEmployers } = await supabase
          .from('project_contractor_trades')
          .select('employer_id')
          .eq('trade_type', tradeType);

        const { data: siteTradeEmployers } = await supabase
          .from('site_contractor_trades')
          .select('employer_id')
          .eq('trade_type', tradeType);

        const tradeEmployerIds = [
          ...(tradeEmployers || []).map(t => t.employer_id),
          ...(siteTradeEmployers || []).map(t => t.employer_id)
        ];

        if (tradeEmployerIds.length > 0) {
          query = query.in('id', tradeEmployerIds);
        }
      }

      // If project is specified, filter by employers who have worked on this project
      if (projectId) {
        const { data: projectEmployers } = await supabase
          .from('project_assignments')
          .select('employer_id')
          .eq('project_id', projectId);

        if (projectEmployers && projectEmployers.length > 0) {
          const projectEmployerIds = projectEmployers.map(pe => pe.employer_id);
          query = query.in('id', projectEmployerIds);
        }
      }

      // Exclude specified employer IDs
      if (excludeEmployerIds.length > 0) {
        query = query.not('id', 'in', `(${excludeEmployerIds.join(',')})`);
      }

      const { data: employersData, error } = await query;

      if (error) throw error;

      // Transform data
      const transformedEmployers: EbaEmployer[] = await Promise.all(
        (employersData || []).map(async (emp: any) => {
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
          }));

          const roleAssignments = emp.project_assignments?.filter((pa: any) =>
            pa.assignment_type === 'contractor_role' && pa.contractor_role_types
          ) || [];

          const roles = roleAssignments.map((ra: any) => ({
            roleType: ra.contractor_role_types.code as 'builder' | 'head_contractor' | 'project_manager',
            projectName: ra.projects.name
          }));

          // Get trade assignments
          const { data: tradeAssignments } = await supabase
            .from('project_contractor_trades')
            .select('trade_type, projects!inner(name)')
            .eq('employer_id', emp.id);

          const { data: siteTradeAssignments } = await supabase
            .from('site_contractor_trades')
            .select('trade_type, job_sites!inner(projects!inner(name))')
            .eq('employer_id', emp.id);

          const allTradeAssignments = [
            ...(tradeAssignments || []).map((t: any) => ({
              tradeType: t.trade_type,
              projectName: t.projects.name
            })),
            ...(siteTradeAssignments || []).map((t: any) => ({
              tradeType: t.trade_type,
              projectName: t.job_sites.projects.name
            }))
          ];

          const hasEbaRecord = emp.company_eba_records?.length > 0;
          let ebaStatus: 'yes' | 'no' | 'pending' | null = null;

          if (hasEbaRecord) {
            ebaStatus = 'yes';
          } else if (emp.enterprise_agreement_status === true || emp.enterprise_agreement_status === 'active') {
            ebaStatus = 'yes';
          } else if (emp.enterprise_agreement_status === false || emp.enterprise_agreement_status === 'no') {
            ebaStatus = 'no';
          } else {
            ebaStatus = null;
          }

          const hasKeyRole = roles.some(r => ['builder', 'project_manager'].includes(r.roleType));
          const hasKeyTrade = allTradeAssignments.some(t => KEY_CONTRACTOR_TRADES.has(t.tradeType));

          return {
            id: emp.id,
            name: emp.name,
            eba_status: ebaStatus,
            project_count: projects.length,
            projects: projects,
            trades: allTradeAssignments,
            roles: roles,
            isKeyContractor: hasKeyRole || hasKeyTrade,
            aliases: emp.employer_aliases?.map((alias: any) => ({
              alias: alias.alias,
              confidence: alias.confidence_score
            })) || [],
            lastUpdated: new Date().toISOString()
          };
        })
      );

      setEmployers(transformedEmployers);
    } catch (error) {
      console.error('Error loading EBA employers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load EBA employers',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [open, tradeType, stage, projectId, excludeEmployerIds, supabase, toast]);

  // Filter and sort employers
  useEffect(() => {
    let filtered = employers;

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.name.toLowerCase().includes(searchLower) ||
        emp.aliases?.some(alias => alias.alias.toLowerCase().includes(searchLower)) ||
        emp.projects.some(p => p.name.toLowerCase().includes(searchLower))
      );
    }

    // Apply EBA status filter
    if (ebaStatusFilter !== 'all') {
      filtered = filtered.filter(emp => emp.eba_status === ebaStatusFilter);
    }

    // Apply key contractor filter
    if (showOnlyKeyContractors) {
      filtered = filtered.filter(emp => emp.isKeyContractor);
    }

    // Sort employers
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'projects':
          return b.project_count - a.project_count;
        case 'eba_status':
          // Prioritize employers with EBA
          const statusOrder = { 'yes': 0, 'pending': 1, null: 2, 'no': 3 };
          return (statusOrder[a.eba_status || 'no'] ?? 4) - (statusOrder[b.eba_status || 'no'] ?? 4);
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredEmployers(filtered);
  }, [employers, debouncedSearchTerm, ebaStatusFilter, showOnlyKeyContractors, sortBy]);

  // Load employers when dialog opens
  useEffect(() => {
    if (open) {
      loadEbaEmployers();
      setSelectedEmployers(new Set());
      setSearchTerm('');
    }
  }, [open, loadEbaEmployers]);

  const handleEmployerSelect = (employer: EbaEmployer) => {
    onEmployerSelect(employer);
    onOpenChange(false);
  };

  const handleBatchSelect = () => {
    if (selectedEmployers.size === 0) return;

    const selectedEmployerList = filteredEmployers.filter(emp =>
      selectedEmployers.has(emp.id)
    );

    if (onBatchSelect) {
      onBatchSelect(selectedEmployerList);
    }
    onOpenChange(false);
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

  const getEbaStatusIcon = (status: EbaEmployer['eba_status']) => {
    switch (status) {
      case 'yes':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'no':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getEbaStatusBadge = (status: EbaEmployer['eba_status']) => {
    const variants = {
      'yes': 'default' as const,
      'pending': 'secondary' as const,
      'no': 'destructive' as const,
      null: 'outline' as const
    };

    const labels = {
      'yes': 'Has EBA',
      'pending': 'Pending',
      'no': 'No EBA',
      null: 'Unknown'
    };

    return (
      <Badge variant={variants[status]} className="text-xs">
        {labels[status]}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            EBA Employer Quick List
            {tradeType && (
              <Badge variant="outline" className="ml-2">
                {getTradeLabel(tradeType)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {tradeType
              ? `Quickly select EBA employers who have worked on ${getTradeLabel(tradeType)} projects`
              : 'Select EBA employers from across all projects'
            }
            {selectedEmployers.size > 0 && (
              <span className="ml-2 text-blue-600">
                ({selectedEmployers.size} selected)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="space-y-4 border-b pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search employers, aliases, or projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnlyKeyContractors(!showOnlyKeyContractors)}
              className={showOnlyKeyContractors ? 'bg-orange-50 border-orange-200' : ''}
            >
              <Star className="h-4 w-4 mr-1" />
              Key Only
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <select
              value={ebaStatusFilter}
              onChange={(e) => setEbaStatusFilter(e.target.value as any)}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="all">All EBA Status</option>
              <option value="yes">Has EBA</option>
              <option value="pending">Pending</option>
              <option value="no">No EBA</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="name">Sort by Name</option>
              <option value="projects">Sort by Projects</option>
              <option value="eba_status">Sort by EBA Status</option>
            </select>

            {onBatchSelect && (
              <div className="ml-auto flex gap-1">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Select None
                </Button>
                <Button
                  size="sm"
                  onClick={handleBatchSelect}
                  disabled={selectedEmployers.size === 0}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  Use {selectedEmployers.size} Selected
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
              <span className="ml-2">Loading EBA employers...</span>
            </div>
          ) : filteredEmployers.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No EBA Employers Found</h3>
              <p className="text-gray-600">
                {debouncedSearchTerm
                  ? 'No employers match your search criteria'
                  : 'No EBA employers available for this trade'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {filteredEmployers.map((employer) => {
                const isSelected = selectedEmployers.has(employer.id);

                return (
                  <Card
                    key={employer.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {onBatchSelect && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleEmployerSelection(employer.id)}
                              className="mt-1"
                            />
                          )}

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-lg">{employer.name}</h4>
                              {employer.isKeyContractor && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                  <Star className="h-3 w-3 mr-1" />
                                  Key Contractor
                                </Badge>
                              )}
                              {getEbaStatusBadge(employer.eba_status)}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {employer.project_count} projects
                              </div>
                              {employer.eba_status && (
                                <div className="flex items-center gap-1">
                                  {getEbaStatusIcon(employer.eba_status)}
                                  {employer.eba_status === 'yes' && 'EBA Verified'}
                                </div>
                              )}
                            </div>

                            {/* Aliases */}
                            {employer.aliases && employer.aliases.length > 0 && (
                              <div className="mb-2">
                                <div className="text-xs text-gray-500 mb-1">Also known as:</div>
                                <div className="flex flex-wrap gap-1">
                                  {employer.aliases.slice(0, 3).map((alias, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {alias.alias}
                                      <span className="ml-1 text-gray-400">
                                        ({Math.round(alias.confidence * 100)}%)
                                      </span>
                                    </Badge>
                                  ))}
                                  {employer.aliases.length > 3 && (
                                    <span className="text-xs text-gray-500">
                                      +{employer.aliases.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Recent Projects */}
                            {employer.projects.length > 0 && (
                              <div className="mb-2">
                                <div className="text-xs text-gray-500 mb-1">Recent projects:</div>
                                <div className="flex flex-wrap gap-1">
                                  {employer.projects.slice(0, 3).map((project, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {project.name}
                                    </Badge>
                                  ))}
                                  {employer.projects.length > 3 && (
                                    <span className="text-xs text-gray-500">
                                      +{employer.projects.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Trade Specialization */}
                            {employer.trades.length > 0 && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Trade specializations:</div>
                                <div className="flex flex-wrap gap-1">
                                  {Array.from(new Set(employer.trades.map(t => t.tradeType)))
                                    .slice(0, 4)
                                    .map((trade, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">
                                        {getTradeLabel(trade)}
                                      </Badge>
                                    ))}
                                  {employer.trades.length > 4 && (
                                    <span className="text-xs text-gray-500">
                                      +{employer.trades.length - 4} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          {!onBatchSelect && (
                            <Button
                              size="sm"
                              onClick={() => handleEmployerSelect(employer)}
                              className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                              Select
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="text-sm text-gray-500 pt-2 border-t">
          Showing {filteredEmployers.length} of {employers.length} EBA employers
        </div>
      </DialogContent>
    </Dialog>
  );
}