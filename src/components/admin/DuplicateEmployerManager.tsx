'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, Building2, Search, Merge, Eye, EyeOff, AlertTriangle, Users, Trash2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { normalizeEmployerName } from '@/lib/employers/normalize';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

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
}

interface DuplicateGroup {
  id: string;
  employers: EmployerRecord[];
  similarity: number;
  suggestedPrimary?: EmployerRecord;
  userSelectedPrimary?: string;
  mergeDecision?: 'merge' | 'keep_separate' | 'delete_duplicates';
  confidence: 'high' | 'medium' | 'low';
}

interface MergeResult {
  success: boolean;
  primaryEmployerId: string;
  mergedEmployerIds: string[];
  errors: string[];
  relationshipsMoved: number;
  recordsUpdated: number;
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

  useEffect(() => {
    loadEmployers();
  }, []);

  const loadEmployers = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      
      // Load employers with additional stats
      const { data: employerData, error: employerError } = await supabase
        .from('employers')
        .select(`
          id, name, address_line_1, suburb, state, postcode, phone, email, employer_type, created_at
        `)
        .order('name');

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

      // Use database function for efficient relationship counting
      const employerIds = (employerData || []).map((emp: any) => emp.id).filter((id: any) => id);
      
      if (employerIds.length > 0) {
        try {
          const { data: impactData, error: impactError } = await supabase
            .rpc('get_employer_merge_impact', { p_employer_ids: employerIds });
          
          if (impactError) {
            console.warn('get_employer_merge_impact error (non-fatal):', impactError);
            // Fall back to employers without impact data
            setEmployers(employerData.map((emp: any) => ({
              ...emp,
              worker_count: 0,
              project_count: 0,
              eba_records_count: 0
            })));
          } else {
            const impactMap = new Map();
            (impactData || []).forEach((impact: any) => {
              impactMap.set(impact.employer_id, {
                worker_count: impact.worker_placements_count || 0,
                project_count: (impact.project_roles_count || 0) + (impact.project_trades_count || 0) + (impact.builder_projects_count || 0),
                eba_records_count: impact.eba_records_count || 0
              });
            });
            
            const enrichedEmployers: EmployerRecord[] = (employerData || []).map((emp: any) => {
              const impact = impactMap.get(emp.id) || { worker_count: 0, project_count: 0, eba_records_count: 0 };
              return {
                ...emp,
                ...impact
              };
            });
            
            setEmployers(enrichedEmployers);
          }
        } catch (rpcError) {
          console.warn('RPC call failed (non-fatal):', rpcError);
          // Fall back to employers without impact data
          setEmployers(employerData.map((emp: any) => ({
            ...emp,
            worker_count: 0,
            project_count: 0,
            eba_records_count: 0
          })));
        }
      } else {
        setEmployers([]);
      }
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
  const normalizeCompanyName = (name: string): string => normalizeEmployerName(name).normalized;

  // Scan for duplicates
  const scanForDuplicates = async () => {
    setIsScanning(true);
    try {
      const groups: DuplicateGroup[] = [];
      const processed = new Set<string>();

      for (let i = 0; i < employers.length; i++) {
        const employer1 = employers[i];
        if (processed.has(employer1.id)) continue;

        const similarEmployers = [employer1];
        processed.add(employer1.id);

        for (let j = i + 1; j < employers.length; j++) {
          const employer2 = employers[j];
          if (processed.has(employer2.id)) continue;

          // Calculate multiple similarity metrics
          const nameSimilarity = calculateSimilarity(
            normalizeCompanyName(employer1.name),
            normalizeCompanyName(employer2.name)
          );

          const exactNameMatch = employer1.name.toLowerCase() === employer2.name.toLowerCase();
          const addressSimilarity = employer1.address_line_1 && employer2.address_line_1 
            ? calculateSimilarity(employer1.address_line_1, employer2.address_line_1)
            : 0;

          // Determine if these are likely duplicates
          const isDuplicate = exactNameMatch || 
            (nameSimilarity >= similarityThreshold) ||
            (nameSimilarity >= 0.6 && addressSimilarity >= 0.8);

          if (isDuplicate) {
            similarEmployers.push(employer2);
            processed.add(employer2.id);
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
              calculateSimilarity(normalizeCompanyName(similarEmployers[0].name), normalizeCompanyName(emp.name))
            )
          );

          groups.push({
            id: `group-${groups.length}`,
            employers: similarEmployers,
            similarity: maxSimilarity,
            suggestedPrimary,
            confidence: maxSimilarity >= 0.95 ? 'high' : maxSimilarity >= 0.8 ? 'medium' : 'low'
          });
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
      
      // Move all relationships to the primary employer
      
      // 1. Update worker placements
      const { error: workerError } = await supabase
        .from('worker_placements')
        .update({ employer_id: primaryId })
        .in('employer_id', duplicateIds);
      
      if (workerError) result.errors.push(`Worker placements: ${workerError.message}`);
      else result.relationshipsMoved++;

      // 2. Update project employer roles
      const { error: roleError } = await supabase
        .from('project_employer_roles')
        .update({ employer_id: primaryId })
        .in('employer_id', duplicateIds);
      
      if (roleError) result.errors.push(`Project roles: ${roleError.message}`);
      else result.relationshipsMoved++;

      // 3. Update project contractor trades
      const { error: tradeError } = await supabase
        .from('project_contractor_trades')
        .update({ employer_id: primaryId })
        .in('employer_id', duplicateIds);
      
      if (tradeError) result.errors.push(`Project trades: ${tradeError.message}`);
      else result.relationshipsMoved++;

      // 4. Update site contractor trades
      const { error: siteTradeError } = await supabase
        .from('site_contractor_trades')
        .update({ employer_id: primaryId })
        .in('employer_id', duplicateIds);
      
      if (siteTradeError) result.errors.push(`Site trades: ${siteTradeError.message}`);
      else result.relationshipsMoved++;

      // 5. Update company EBA records
      const { error: ebaError } = await supabase
        .from('company_eba_records')
        .update({ employer_id: primaryId })
        .in('employer_id', duplicateIds);
      
      if (ebaError) result.errors.push(`EBA records: ${ebaError.message}`);
      else result.relationshipsMoved++;

      // 6. Update site visits
      const { error: visitError } = await supabase
        .from('site_visit')
        .update({ employer_id: primaryId })
        .in('employer_id', duplicateIds);
      
      if (visitError) result.errors.push(`Site visits: ${visitError.message}`);
      else result.relationshipsMoved++;

      // 7. Handle contractor trade capabilities (merge unique trades)
      const { data: existingCapabilities } = await supabase
        .from('contractor_trade_capabilities')
        .select('trade_type, is_primary, notes')
        .eq('employer_id', primaryId);

      const existingTradeTypes = new Set((existingCapabilities || []).map((c: any) => c.trade_type));

      const { data: duplicateCapabilities } = await supabase
        .from('contractor_trade_capabilities')
        .select('trade_type, is_primary, notes')
        .in('employer_id', duplicateIds);

      // Add unique trade capabilities from duplicates
      const newCapabilities = (duplicateCapabilities || []).filter((cap: any) => 
        !existingTradeTypes.has(cap.trade_type)
      );

      if (newCapabilities.length > 0) {
        const { error: capError } = await supabase
          .from('contractor_trade_capabilities')
          .insert(newCapabilities.map((cap: any) => ({
            employer_id: primaryId,
            trade_type: cap.trade_type,
            is_primary: cap.is_primary,
            notes: `${cap.notes || ''} (merged from duplicate employer)`.trim()
          })));
        
        if (capError) result.errors.push(`Trade capabilities: ${capError.message}`);
        else result.recordsUpdated += newCapabilities.length;
      }

      // 8. Delete duplicate trade capabilities
      const { error: deleteCapError } = await supabase
        .from('contractor_trade_capabilities')
        .delete()
        .in('employer_id', duplicateIds);
      
      if (deleteCapError) result.errors.push(`Delete capabilities: ${deleteCapError.message}`);

      // 9. Update employer aliases to point to primary
      const { error: aliasError } = await supabase
        .from('employer_aliases')
        .update({ employer_id: primaryId })
        .in('employer_id', duplicateIds);
      
      if (aliasError) result.errors.push(`Aliases: ${aliasError.message}`);

      // 10. Create aliases for the merged employer names
      const aliasInserts = group.employers
        .filter(e => e.id !== primaryId)
        .map(e => ({
          alias: e.name,
          alias_normalized: normalizeCompanyName(e.name),
          employer_id: primaryId
        }));

      if (aliasInserts.length > 0) {
        const { error: newAliasError } = await supabase
          .from('employer_aliases')
          .upsert(aliasInserts, { onConflict: 'alias_normalized' });
        
        if (newAliasError) result.errors.push(`New aliases: ${newAliasError.message}`);
        else result.recordsUpdated += aliasInserts.length;
      }

      // 11. Update projects.builder_id references
      const { error: builderError } = await supabase
        .from('projects')
        .update({ builder_id: primaryId })
        .in('builder_id', duplicateIds);
      
      if (builderError) result.errors.push(`Project builders: ${builderError.message}`);
      else result.relationshipsMoved++;

      // 12. Finally, delete the duplicate employer records
      const { error: deleteError } = await supabase
        .from('employers')
        .delete()
        .in('id', duplicateIds);
      
      if (deleteError) {
        result.errors.push(`Delete duplicates: ${deleteError.message}`);
      } else {
        result.success = true;
        result.recordsUpdated += duplicateIds.length;
        console.log(`✓ Successfully merged ${duplicateIds.length} employers into ${primaryId}`);
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
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Search Employers</Label>
              <Input
                id="search"
                placeholder="Search by company name, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-48">
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
        <DialogContent className="max-w-2xl">
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
