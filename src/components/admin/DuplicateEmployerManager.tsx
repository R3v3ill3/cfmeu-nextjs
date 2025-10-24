'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, Info, Building2, Search, Merge, Eye, EyeOff, AlertTriangle, Users } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { normalizeEmployerName as normalizeEmployerNameDetailed, type NormalizedEmployerName } from '@/lib/employers/normalize'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'

interface EmployerRecord {
  id: string;
  name: string;
  address_line_1?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  employer_type: string;
  created_at: string;
  worker_count?: number;
  project_count?: number;
  eba_records_count?: number;
  abn?: string;
  website?: string | null;
  enterprise_agreement_status?: boolean | null;
  eba_status_source?: string | null;
  eba_status_updated_at?: string | null;
  eba_status_notes?: string | null;
  normalizedName: string;
  normalizedVariants: string[];
  aliases: { alias: string; alias_normalized: string }[];
}

interface DuplicateGroup {
  id: string;
  employers: EmployerRecord[];
  similarity: number;
  suggestedPrimary?: EmployerRecord;
  userSelectedPrimary?: string;
  mergeDecision?: 'merge' | 'keep_separate' | 'delete_duplicates';
  confidence: 'high' | 'medium' | 'low';
  isManual?: boolean;
}

interface MergeResult {
  success: boolean;
  primaryEmployerId: string;
  mergedEmployerIds: string[];
  errors: string[];
  relationshipsMoved: number;
  recordsUpdated: number;
}

interface MergeFieldSelection {
  field: string;
  employerId: string | null;
  value: any;
}

interface MergeFieldOption {
  employerId: string | null;
  employerName: string;
  value: any;
  displayValue: string;
}

export default function DuplicateEmployerManager() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [employers, setEmployers] = useState<EmployerRecord[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.8);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [mergeResults, setMergeResults] = useState<MergeResult[]>([]);
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set());
  const [manualSelection, setManualSelection] = useState<Set<string>>(new Set());
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [fieldSelections, setFieldSelections] = useState<Record<string, MergeFieldSelection>>({});
  const [isImpactLoading, setIsImpactLoading] = useState(false);
  const [impactData, setImpactData] = useState<Record<string, any>>({});

  useEffect(() => {
    loadEmployers();
  }, []);

  const loadEmployers = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      // Load employers with pagination to get all records (Supabase default limit is 1000)
      const PAGE_SIZE = 1000;
      let allEmployerData: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        console.log(`[DuplicateEmployerManager] Loading page ${page}, range ${from}-${to}`);

        const { data, error } = await supabase
          .from('employers')
          .select(`
            id, name, address_line_1, suburb, state, postcode, phone, email, employer_type, created_at,
            abn, website, enterprise_agreement_status, eba_status_source, eba_status_updated_at, eba_status_notes,
            employer_aliases ( alias, alias_normalized )
          `)
          .order('name')
          .range(from, to);

        if (error) {
          console.error(`[DuplicateEmployerManager] Error loading page ${page}:`, error);
          if (page === 0) throw error; // Only throw on first page
          console.warn(`Stopping pagination due to error on page ${page}`);
          break; // Stop on error for subsequent pages
        }

        const recordsLoaded = data?.length || 0;
        console.log(`[DuplicateEmployerManager] Page ${page} loaded ${recordsLoaded} records`);

        if (data && data.length > 0) {
          allEmployerData = [...allEmployerData, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;
          console.log(`[DuplicateEmployerManager] Total records so far: ${allEmployerData.length}, hasMore: ${hasMore}`);
        } else {
          hasMore = false;
        }
      }

      console.log(`[DuplicateEmployerManager] Pagination complete. Total employers loaded: ${allEmployerData.length}`);

      const employerData = allEmployerData;
      const employerError = allEmployerData.length === 0 ? new Error('No employers loaded') : null;

      if (employerError) throw employerError;

      // Get worker counts for each employer
      const { data: workerCounts } = await supabase
        .from('worker_placements')
        .select('employer_id')
        .not('employer_id', 'is', null);

      // Get project relationship counts
      const { data: projectRoles } = await supabase
        .from('project_employer_roles')
        .select('employer_id');

      const { data: projectTrades } = await supabase
        .from('project_contractor_trades')
        .select('employer_id');

      // Get EBA record counts
      const { data: ebaRecords } = await supabase
        .from('company_eba_records')
        .select('employer_id');

      // Aggregate counts
      const workerCountMap = new Map<string, number>();
      (workerCounts || []).forEach((w: any) => {
        const count = workerCountMap.get(w.employer_id) || 0;
        workerCountMap.set(w.employer_id, count + 1);
      });

      const projectCountMap = new Map<string, number>();
      [...(projectRoles || []), ...(projectTrades || [])].forEach((p: any) => {
        const count = projectCountMap.get(p.employer_id) || 0;
        projectCountMap.set(p.employer_id, count + 1);
      });

      const ebaCountMap = new Map<string, number>();
      (ebaRecords || []).forEach((e: any) => {
        const count = ebaCountMap.get(e.employer_id) || 0;
        ebaCountMap.set(e.employer_id, count + 1);
      });

      const employerIds = (employerData || []).map((emp: any) => emp.id).filter((id: any) => id);
      let mergeImpactMap: Map<string, any> = new Map();

      if (employerIds.length > 0) {
        try {
          const { data: impactDataResult, error: impactError } = await supabase
            .rpc('get_employer_merge_impact', { p_employer_ids: employerIds });
          
          if (impactError) {
            console.warn('get_employer_merge_impact error (non-fatal):', impactError);
          } else if (impactDataResult) {
            mergeImpactMap = new Map(impactDataResult.map((impact: any) => [impact.employer_id, impact]));
            const impactRecord: Record<string, any> = {};
            impactDataResult.forEach((impact: any) => {
              impactRecord[impact.employer_id] = impact;
            });
            setImpactData(impactRecord);
          }
        } catch (rpcError) {
          console.warn('RPC call failed (non-fatal):', rpcError);
        }
      }

      const enrichedEmployers: EmployerRecord[] = (employerData || []).map((emp: any) => {
        const normalized: NormalizedEmployerName = normalizeEmployerNameDetailed(emp.name ?? '');
        const aliases = (emp.employer_aliases || []).map((alias: any) => ({
          alias: alias.alias,
          alias_normalized: alias.alias_normalized
        }));

        const uniqueVariants = Array.from(new Set([
          ...normalized.normalizedVariants,
          normalized.normalized,
          ...aliases.map(alias => alias.alias_normalized ? alias.alias_normalized.toUpperCase() : alias.alias_normalized)
        ].filter(Boolean)));

        const impact = mergeImpactMap.get(emp.id) || {
          worker_placements_count: workerCountMap.get(emp.id) || 0,
          project_roles_count: projectCountMap.get(emp.id) || 0,
          project_trades_count: 0,
          builder_projects_count: 0,
          site_trades_count: 0,
          site_visits_count: 0,
          aliases_count: aliases.length,
          eba_records_count: ebaCountMap.get(emp.id) || 0
        };

        return {
          id: emp.id,
          name: emp.name,
          address_line_1: emp.address_line_1,
          suburb: emp.suburb,
          state: emp.state,
          postcode: emp.postcode,
          phone: emp.phone,
          email: emp.email,
          employer_type: emp.employer_type,
          created_at: emp.created_at,
          abn: emp.abn,
          website: emp.website,
          enterprise_agreement_status: emp.enterprise_agreement_status,
          eba_status_source: emp.eba_status_source,
          eba_status_updated_at: emp.eba_status_updated_at,
          eba_status_notes: emp.eba_status_notes,
          worker_count: impact.worker_placements_count || 0,
          project_count: (impact.project_roles_count || 0) + (impact.project_trades_count || 0) + (impact.builder_projects_count || 0),
          eba_records_count: impact.eba_records_count || 0,
          normalizedName: normalized.normalized,
          normalizedVariants: uniqueVariants,
          aliases
        };
      });

      setEmployers(enrichedEmployers);
    } catch (error) {
      console.error('Error loading employers:', error);
      toast({
        title: 'Error loading employers',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced similarity calculation
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  // Normalize company names for better matching
  const normalizeCompanyName = (name: string): { normalized: string; variants: string[] } => {
    const normalized = normalizeEmployerNameDetailed(name ?? '');
    return {
      normalized: normalized.normalized,
      variants: normalized.normalizedVariants
    };
  };

  // Scan for duplicates
  const scanForDuplicates = async () => {
    setIsScanning(true);
    try {
      const groups: DuplicateGroup[] = [];
      const processedPairs = new Set<string>();
      const processedEmployers = new Set<string>();

      for (let i = 0; i < employers.length; i++) {
        const employer1 = employers[i];
        if (processedEmployers.has(employer1.id)) continue;

        const similarEmployers = [employer1];

        for (let j = i + 1; j < employers.length; j++) {
          const employer2 = employers[j];
          const pairKey = `${employer1.id}:${employer2.id}`;
          if (processedPairs.has(pairKey)) continue;

          const normalized1 = employer1.normalizedVariants || [employer1.normalizedName];
          const normalized2 = employer2.normalizedVariants || [employer2.normalizedName];

          let maxNameSimilarity = 0;
          let hasAliasMatch = false;

          for (const variant1 of normalized1) {
            for (const variant2 of normalized2) {
              const similarity = calculateSimilarity(variant1, variant2);
              if (similarity > maxNameSimilarity) {
                maxNameSimilarity = similarity;
              }
              if (variant1 && variant1 === variant2 && variant1.length > 0) {
                hasAliasMatch = true;
              }
            }
          }

          const exactNameMatch = employer1.name.toLowerCase() === employer2.name.toLowerCase();
          const aliasNameMatch = hasAliasMatch;
          const addressSimilarity = employer1.address_line_1 && employer2.address_line_1 
            ? calculateSimilarity(employer1.address_line_1.toLowerCase(), employer2.address_line_1.toLowerCase())
            : 0;

          const sharedAlias = employer1.aliases?.some(alias => normalized2.includes(alias.alias_normalized))
            || employer2.aliases?.some(alias => normalized1.includes(alias.alias_normalized));

          const isDuplicate = exactNameMatch
            || aliasNameMatch
            || sharedAlias
            || (maxNameSimilarity >= similarityThreshold)
            || (maxNameSimilarity >= 0.6 && addressSimilarity >= 0.8);

          if (isDuplicate) {
            similarEmployers.push(employer2);
            processedPairs.add(`${employer1.id}:${employer2.id}`);
            processedPairs.add(`${employer2.id}:${employer1.id}`);
          }
        }

        // Only create groups with 2+ employers
        if (similarEmployers.length > 1) {
          // Suggest primary based on data richness
          const suggestedPrimary = similarEmployers.reduce((best, current) => {
            const bestScore = (best.worker_count || 0) + (best.project_count || 0) + (best.eba_records_count || 0);
            const currentScore = (current.worker_count || 0) + (current.project_count || 0) + (current.eba_records_count || 0);
            
            // Prefer employers with more data, or older records as tiebreaker
            if (currentScore > bestScore) return current;
            if (currentScore === bestScore && new Date(current.created_at) < new Date(best.created_at)) return current;
            return best;
          });

          const maxSimilarity = Math.max(
            ...similarEmployers.slice(1).map(emp => 
              calculateSimilarity(normalizeCompanyName(similarEmployers[0].name).normalized, normalizeCompanyName(emp.name).normalized)
            )
          );

          groups.push({
            id: `group-${groups.length}`,
            employers: similarEmployers,
            similarity: maxSimilarity,
            suggestedPrimary,
            confidence: maxSimilarity >= 0.95 ? 'high' : maxSimilarity >= 0.8 ? 'medium' : 'low'
          });

          similarEmployers.forEach(emp => processedEmployers.add(emp.id));
        }
      }

      // Sort by confidence and similarity
      groups.sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        const aScore = confidenceOrder[a.confidence];
        const bScore = confidenceOrder[b.confidence];
        if (aScore !== bScore) return bScore - aScore;
        return b.similarity - a.similarity;
      });

      setDuplicateGroups(groups);
      
      toast({
        title: 'Duplicate scan complete',
        description: `Found ${groups.length} potential duplicate groups`
      });
    } catch (error) {
      console.error('Error scanning for duplicates:', error);
      toast({
        title: 'Scan failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Merge employers
  const mergeEmployers = async (group: DuplicateGroup): Promise<MergeResult> => {
     const supabase = getSupabaseBrowserClient();
     const primaryId = group.userSelectedPrimary || group.suggestedPrimary?.id;
     
     if (!primaryId) {
       throw new Error('No primary employer selected');
     }
 
     const duplicateIds = group.employers.filter(e => e.id !== primaryId).map(e => e.id);
     const result: MergeResult = {
       success: false,
       primaryEmployerId: primaryId,
       mergedEmployerIds: duplicateIds,
       errors: [],
       relationshipsMoved: 0,
       recordsUpdated: 0
     };
 
     try {
       console.log(`Starting merge: Primary ${primaryId}, Duplicates: ${duplicateIds.join(', ')}`);
 
       const overrides: Record<string, any> = {};
       Object.entries(fieldSelections).forEach(([field, selection]) => {
         if (selection && selection.value !== undefined) {
           overrides[field] = selection.value;
         }
       });
 
       if (Object.keys(overrides).length > 0) {
         const { error: primaryUpdateError } = await supabase
           .from('employers')
           .update(overrides)
           .eq('id', primaryId);
 
         if (primaryUpdateError) {
           result.errors.push(`Primary update failed: ${primaryUpdateError.message}`);
           console.error('Primary update error', primaryUpdateError);
         } else {
           result.recordsUpdated++;
         }
       }
 
       if (duplicateIds.length === 0) {
         result.success = true;
         return result;
       }
 
       const { data: rpcData, error: rpcError } = await supabase.rpc('merge_employers', {
         p_primary_employer_id: primaryId,
         p_duplicate_employer_ids: duplicateIds
       });
 
       if (rpcError) {
         console.error('merge_employers RPC error', rpcError);
         result.errors.push(`merge_employers RPC failed: ${rpcError.message}`);
       } else if (rpcData) {
         result.success = rpcData.success ?? true;
         result.relationshipsMoved += rpcData.relationships_moved ?? 0;
         result.recordsUpdated += rpcData.records_updated ?? 0;
         if (Array.isArray(rpcData.errors) && rpcData.errors.length > 0) {
           result.errors.push(...rpcData.errors);
         }
       } else {
         // If no data returned, assume success unless errors exist
         result.success = result.errors.length === 0;
       }
     } catch (error) {
       result.errors.push(`Merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
     }
 
     return result;
   };

  // Perform merge operation
  const performMerge = async (group: DuplicateGroup) => {
    setIsMerging(true);
    try {
      const result = await mergeEmployers(group);
      setMergeResults(prev => [...prev, result]);
      
      if (result.success) {
        // Remove the merged group from the list
        setDuplicateGroups(prev => prev.filter(g => g.id !== group.id));
        // Reload employers to reflect changes
        await loadEmployers();
        
        toast({
          title: 'Merge successful',
          description: `Merged ${result.mergedEmployerIds.length} employers into primary record`
        });
      } else {
        toast({
          title: 'Merge failed',
          description: `Merge completed with ${result.errors.length} errors`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error performing merge:', error);
      toast({
        title: 'Merge error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsMerging(false);
      setShowMergeDialog(false);
      setSelectedGroup(null);
    }
  };

  // Filter employers based on search
  const filteredEmployers = useMemo(() => {
    if (!searchTerm) return employers;
    const term = searchTerm.toLowerCase();
    return employers.filter(emp => 
      emp.name.toLowerCase().includes(term) ||
      emp.address_line_1?.toLowerCase().includes(term) ||
      emp.suburb?.toLowerCase().includes(term)
    );
  }, [employers, searchTerm]);

  // Filter duplicate groups based on search
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return duplicateGroups;
    const term = searchTerm.toLowerCase();
    return duplicateGroups.filter(group =>
      group.employers.some(emp => 
        emp.name.toLowerCase().includes(term) ||
        emp.address_line_1?.toLowerCase().includes(term)
      )
    );
  }, [duplicateGroups, searchTerm]);

  const updateGroupDecision = (groupId: string, decision: 'merge' | 'keep_separate', primaryId?: string) => {
    setDuplicateGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, mergeDecision: decision, userSelectedPrimary: primaryId }
        : group
    ));
  };

  const toggleDetails = (groupId: string) => {
    setShowDetails(prev => {
      const updated = new Set(prev);
      if (updated.has(groupId)) {
        updated.delete(groupId);
      } else {
        updated.add(groupId);
      }
      return updated;
    });
  };

  const toggleManualSelection = (employerId: string) => {
    setManualSelection(prev => {
      const next = new Set(prev);
      if (next.has(employerId)) {
        next.delete(employerId);
      } else {
        next.add(employerId);
      }
      return next;
    });
  };

  const resetManualSelection = () => {
    setManualSelection(new Set());
    setFieldSelections({});
    setImpactData({});
  };

  const buildManualGroup = () => {
    if (manualSelection.size < 2) return null;
    const selectedEmployers = employers.filter(emp => manualSelection.has(emp.id));
    if (selectedEmployers.length < 2) return null;

    const normalizedPrimary = selectedEmployers.reduce((best, current) => {
      const bestScore = (best.worker_count || 0) + (best.project_count || 0) + (best.eba_records_count || 0);
      const currentScore = (current.worker_count || 0) + (current.project_count || 0) + (current.eba_records_count || 0);
      if (currentScore > bestScore) return current;
      if (currentScore === bestScore && new Date(current.created_at) < new Date(best.created_at)) return current;
      return best;
    });

    const similarity = selectedEmployers.length > 1 ? 0.95 : 1;

    return {
      id: `manual-${Array.from(manualSelection).sort().join('-')}`,
      employers: selectedEmployers,
      similarity,
      suggestedPrimary: normalizedPrimary,
      confidence: 'high' as const,
      isManual: true
    } satisfies DuplicateGroup;
  };

  const fetchImpactData = async (employerIds: string[]) => {
    if (!employerIds || employerIds.length === 0) return;
    setIsImpactLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc('get_employer_merge_impact', { p_employer_ids: employerIds });
      if (error) throw error;

      const impactMap: Record<string, any> = {};
      (data || []).forEach((impact: any) => {
        impactMap[impact.employer_id] = impact;
      });

      setImpactData(prev => ({ ...prev, ...impactMap }));
    } catch (error) {
      console.error('Error fetching merge impact:', error);
      toast({
        title: 'Impact load failed',
        description: error instanceof Error ? error.message : 'Unable to load merge impact details',
        variant: 'destructive'
      });
    } finally {
      setIsImpactLoading(false);
    }
  };

  const buildFieldOptions = (group: DuplicateGroup): Array<{ key: string; label: string; options: MergeFieldOption[] }> => {
    const fields: Array<{ key: string; label: string; formatter?: (value: any) => string } > = [
      { key: 'name', label: 'Name' },
      { key: 'address_line_1', label: 'Address Line 1' },
      { key: 'suburb', label: 'Suburb' },
      { key: 'state', label: 'State' },
      { key: 'postcode', label: 'Postcode' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'employer_type', label: 'Employer Type' },
      { key: 'abn', label: 'ABN' },
      { key: 'website', label: 'Website' },
      { key: 'enterprise_agreement_status', label: 'Has EBA?', formatter: (value) => value === true ? 'Yes' : value === false ? 'No' : 'Unknown' },
      { key: 'eba_status_source', label: 'EBA Status Source' },
      { key: 'eba_status_notes', label: 'EBA Status Notes' },
    ];

    return fields.map(field => {
      const fieldOptions: MergeFieldOption[] = group.employers.map(emp => ({
        employerId: emp.id,
        employerName: emp.name,
        value: (emp as any)[field.key],
        displayValue: field.formatter ? field.formatter((emp as any)[field.key]) : ((emp as any)[field.key] ?? '—')
      }));

      if (group.suggestedPrimary) {
        const currentValue = (group.suggestedPrimary as any)[field.key];
        fieldOptions.unshift({
          employerId: group.suggestedPrimary.id,
          employerName: `${group.suggestedPrimary.name} (current)`,
          value: currentValue,
          displayValue: field.formatter ? field.formatter(currentValue) : (currentValue ?? '—')
        });
      }

      return {
        key: field.key,
        label: field.label,
        options: fieldOptions
      };
    });
  };

  const updateFieldSelection = (field: string, option: MergeFieldOption) => {
    setFieldSelections(prev => ({
      ...prev,
      [field]: {
        field,
        employerId: option.employerId,
        value: option.value
      }
    }));
  };

  const filteredEmployersForManual = useMemo(() => {
    if (!manualSearchTerm.trim()) {
      return employers.slice(0, 500);
    }
    const term = manualSearchTerm.toLowerCase();
    return employers.filter(emp => {
      const matchesName = emp.name.toLowerCase().includes(term);
      const matchesAddress = emp.address_line_1?.toLowerCase().includes(term) || emp.suburb?.toLowerCase().includes(term);
      const matchesAbn = emp.abn?.toLowerCase().includes(term);
      const matchesAlias = emp.aliases?.some(alias => alias.alias.toLowerCase().includes(term) || alias.alias_normalized.includes(term));
      const matchesVariant = emp.normalizedVariants?.some(variant => variant.toLowerCase().includes(term));
      return matchesName || matchesAddress || matchesAbn || matchesAlias || matchesVariant;
    }).slice(0, 1000);
  }, [employers, manualSearchTerm]);

  if (isLoading) {
    return (
      <div className="text-center space-y-4">
        <img src="/spinner.gif" alt="Loading" className="w-8 h-8 mx-auto" />
        <h2 className="text-xl font-semibold">Loading Employer Database...</h2>
        <p className="text-gray-600">Analyzing employers for potential duplicates</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Duplicate Employer Manager</h1>
          <p className="text-gray-600">Find and merge duplicate employer records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={scanForDuplicates}
            disabled={isScanning}
            variant="outline"
          >
            {isScanning ? (
              <>
                <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Scan for Duplicates
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Refine auto-detected groups or start a manual merge.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-2">
              <Label htmlFor="search">Search Employers</Label>
              <Input
                id="search"
                placeholder="Search by company name, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">This filters the auto-detected duplicate groups below.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Similarity Threshold</Label>
              <Select value={similarityThreshold.toString()} onValueChange={(v) => setSimilarityThreshold(parseFloat(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.95">95% - Very High</SelectItem>
                  <SelectItem value="0.8">80% - High</SelectItem>
                  <SelectItem value="0.7">70% - Medium</SelectItem>
                  <SelectItem value="0.6">60% - Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Merge Section */}
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Manual Merge Workspace</CardTitle>
            <CardDescription>
              Search for any employers (including trading-as names), select at least two, and review merge details.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetManualSelection} disabled={manualSelection.size === 0}>
              Clear Selection
            </Button>
            <Button
              onClick={() => {
                const group = buildManualGroup();
                if (!group) {
                  toast({
                    title: 'Select at least two employers',
                    description: 'Choose two or more employers to review merge impact.',
                    variant: 'destructive'
                  });
                  return;
                }
                setFieldSelections({});
                setSelectedGroup(group);
                setShowMergeDialog(true);
                fetchImpactData(group.employers.map(emp => emp.id));
              }}
              disabled={manualSelection.size < 2}
            >
              Review Merge ({manualSelection.size})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="manual-search">Search employers to add</Label>
              <Input
                id="manual-search"
                placeholder="Search all employers by name, alias, address, ABN..."
                value={manualSearchTerm}
                onChange={(e) => setManualSearchTerm(e.target.value)}
              />
            </div>

            <div className="max-h-80 overflow-y-auto border rounded-md p-3 bg-muted/30">
              {filteredEmployersForManual.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employers match that search. Try another keyword.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    Showing {filteredEmployersForManual.length} of {employers.length} total employers
                    {manualSearchTerm && ` matching "${manualSearchTerm}"`}
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredEmployersForManual.map((employer) => {
                    const isSelected = manualSelection.has(employer.id);
                    return (
                      <div
                        key={employer.id}
                        className={`p-3 rounded border transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-white shadow-sm'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-medium text-sm">{employer.name}</h4>
                            <p className="text-xs text-muted-foreground">
            {[employer.address_line_1, employer.suburb, employer.state].filter(Boolean).join(', ') || 'No address on file'}
                            </p>
                            {employer.abn && (
                              <p className="text-xs text-muted-foreground mt-1">ABN: {employer.abn}</p>
                            )}
                          </div>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleManualSelection(employer.id)}
                          />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-2 space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {employer.normalizedVariants.slice(0, 3).map((variant) => (
                              <Badge key={variant} variant="outline" className="text-[10px]">
                                {variant}
                              </Badge>
                            ))}
                          </div>
                          {(employer.aliases || []).slice(0, 2).map(alias => (
                            <div key={`${employer.id}-${alias.alias}`} className="italic">Alias: {alias.alias}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </div>

            {manualSelection.size >= 2 && (
              <Alert>
                <AlertDescription>
                  {manualSelection.size} employer{manualSelection.size === 1 ? '' : 's'} selected. Click “Review Merge” to configure the merge.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">{employers.length}</div>
            <p className="text-sm text-gray-600">Total Employers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-amber-600">{duplicateGroups.length}</div>
            <p className="text-sm text-gray-600">Duplicate Groups</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-red-600">
              {duplicateGroups.reduce((sum, group) => sum + group.employers.length - 1, 0)}
            </div>
            <p className="text-sm text-gray-600">Potential Duplicates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-600">{mergeResults.length}</div>
            <p className="text-sm text-gray-600">Groups Merged</p>
          </CardContent>
        </Card>
      </div>

      {/* Duplicate Groups */}
      {duplicateGroups.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Potential Duplicate Groups
            </CardTitle>
            <CardDescription>
              {filteredGroups.length} groups found • Review and merge duplicates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredGroups.map((group) => (
                <div key={group.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={group.confidence === 'high' ? 'destructive' : group.confidence === 'medium' ? 'secondary' : 'outline'}>
                        {group.confidence} confidence
                      </Badge>
                      <Badge variant="outline">
                        {Math.round(group.similarity * 100)}% similar
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {group.employers.length} employers
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleDetails(group.id)}
                      >
                        {showDetails.has(group.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedGroup(group);
                          setShowMergeDialog(true);
                        }}
                        disabled={isMerging}
                      >
                        <Merge className="w-4 h-4 mr-2" />
                        Merge Group
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.employers.map((employer) => (
                      <div 
                        key={employer.id} 
                        className={`p-3 rounded border ${
                          group.suggestedPrimary?.id === employer.id 
                            ? 'border-green-300 bg-green-50' 
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{employer.name}</h4>
                          {group.suggestedPrimary?.id === employer.id && (
                            <Badge variant="default" className="text-xs">Suggested Primary</Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>{employer.address_line_1} {employer.suburb} {employer.state}</p>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              {employer.worker_count} workers
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {employer.project_count} projects
                            </Badge>
                          </div>
                          <p>Created: {new Date(employer.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {showDetails.has(group.id) && (
                    <div className="mt-4 p-4 bg-gray-50 rounded border">
                      <h5 className="font-medium mb-2">Detailed Comparison</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Name</th>
                              <th className="text-left p-2">Address</th>
                              <th className="text-left p-2">Phone</th>
                              <th className="text-left p-2">Email</th>
                              <th className="text-left p-2">Workers</th>
                              <th className="text-left p-2">Projects</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.employers.map((emp) => (
                              <tr key={emp.id} className={group.suggestedPrimary?.id === emp.id ? 'bg-green-100' : ''}>
                                <td className="p-2">{emp.name}</td>
                                <td className="p-2">{emp.address_line_1} {emp.suburb}</td>
                                <td className="p-2">{emp.phone || '—'}</td>
                                <td className="p-2">{emp.email || '—'}</td>
                                <td className="p-2">{emp.worker_count}</td>
                                <td className="p-2">{emp.project_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Duplicates Found</h3>
            <p className="text-gray-600">
              {duplicateGroups.length === 0 && !isScanning 
                ? 'Click "Scan for Duplicates" to analyze the employer database'
                : 'No duplicate employers detected with the current similarity threshold'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Merge Results */}
      {mergeResults.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800">Merge Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mergeResults.map((result, index) => (
                <div key={index} className="p-3 bg-green-50 rounded border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={result.success ? 'default' : 'destructive'}>
                      {result.success ? 'Success' : 'Failed'}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {result.mergedEmployerIds.length} employers merged
                    </span>
                  </div>
                  <div className="text-sm">
                    <p><strong>Primary:</strong> {result.primaryEmployerId}</p>
                    <p><strong>Relationships moved:</strong> {result.relationshipsMoved}</p>
                    <p><strong>Records updated:</strong> {result.recordsUpdated}</p>
                    {result.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-red-600"><strong>Errors:</strong></p>
                        <ul className="list-disc list-inside text-red-600">
                          {result.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Merge Confirmation Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5" />
              Confirm Employer Merge
            </DialogTitle>
            <DialogDescription>
              This will merge {selectedGroup?.employers.length} employers into one record
            </DialogDescription>
          </DialogHeader>
          
          {selectedGroup && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>This action cannot be undone.</strong> All relationships, workers, and data 
                  will be moved to the primary employer. The duplicate records will be deleted.
                </AlertDescription>
              </Alert>

              {selectedGroup.isManual && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    You initiated this merge manually. Ensure the selected employers represent the same company.
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label>Select Primary Employer (data will be merged into this record):</Label>
                <div className="mt-2 space-y-2">
                  {selectedGroup.employers.map((employer) => (
                    <label key={employer.id} className="flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="primary"
                        value={employer.id}
                        checked={selectedGroup.userSelectedPrimary === employer.id || 
                                (!selectedGroup.userSelectedPrimary && selectedGroup.suggestedPrimary?.id === employer.id)}
                        onChange={() => updateGroupDecision(selectedGroup.id, 'merge', employer.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{employer.name}</span>
                          {selectedGroup.suggestedPrimary?.id === employer.id && (
                            <Badge variant="default" className="text-xs">Recommended</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {employer.address_line_1} {employer.suburb} • 
                          {employer.worker_count} workers • {employer.project_count} projects
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {selectedGroup && (
                <div className="border rounded-md">
                  <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                    <div>
                      <h5 className="font-medium">Field Conflict Resolution</h5>
                      <p className="text-xs text-muted-foreground">Choose which source to use if data differs.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFieldSelections({})}
                    >
                      Reset choices
                    </Button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {buildFieldOptions(selectedGroup).map(field => (
                      <div key={field.key} className="px-3 py-2 border-b last:border-b-0">
                        <p className="text-sm font-medium mb-1">{field.label}</p>
                        <div className="grid gap-2">
                          {field.options.map(option => {
                            const selection = fieldSelections[field.key];
                            const isSelected = selection?.employerId === option.employerId && selection?.value === option.value;
                            return (
                              <button
                                key={`${field.key}-${option.employerId ?? 'null'}-${option.displayValue}`}
                                onClick={() => updateFieldSelection(field.key, option)}
                                className={`text-left text-sm p-2 rounded border transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-muted'}`}
                                type="button"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{option.displayValue}</span>
                                  <span className="text-xs text-muted-foreground">{option.employerName}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedGroup && (
                <div className="border rounded-md">
                  <div className="p-3 border-b bg-muted/50">
                    <h5 className="font-medium">Relationship Impact</h5>
                    <p className="text-xs text-muted-foreground">Review total records that will move to the primary employer.</p>
                  </div>
                  <div className="p-3 text-sm">
                    {isImpactLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <img src="/spinner.gif" alt="Loading" className="w-4 h-4" />
                        Loading impact details...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {selectedGroup.employers.map(emp => (
                          <div key={`impact-${emp.id}`} className="border rounded p-2 bg-muted/30">
                            <p className="font-medium mb-1">{emp.name}</p>
                            <ul className="space-y-1">
                              {(() => {
                                const impact = impactData[emp.id];
                                if (!impact) {
                                  return <li className="text-muted-foreground">No impact data available</li>;
                                }
                                return (
                                  <>
                                    <li>Workers: {impact.worker_placements_count ?? 0}</li>
                                    <li>Projects: {(impact.project_roles_count ?? 0) + (impact.project_trades_count ?? 0) + (impact.builder_projects_count ?? 0)}</li>
                                    <li>Trades: {(impact.site_trades_count ?? 0) + (impact.project_trades_count ?? 0)}</li>
                                    <li>EBA Records: {impact.eba_records_count ?? 0}</li>
                                    <li>Site Visits: {impact.site_visits_count ?? 0}</li>
                                    <li>Aliases: {impact.aliases_count ?? 0}</li>
                                  </>
                                );
                              })()}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => performMerge(selectedGroup)}
                  disabled={isMerging || (!selectedGroup.userSelectedPrimary && !selectedGroup.suggestedPrimary)}
                >
                  {isMerging ? (
                    <>
                      <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <Merge className="w-4 h-4 mr-2" />
                      Confirm Merge
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
