'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, Building2, Trash2, Eye, EyeOff, Wrench, AlertTriangle, Search, FileText, ExternalLink, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getTradeTypeLabel, TradeType, getTradeTypeCategories } from '@/utils/bciTradeTypeInference';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { normalizeEmployerName } from '@/lib/employers/normalize';
import { useAliasTelemetry } from '@/hooks/useAliasTelemetry';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { EbaEmployerMatchDialog } from './EbaEmployerMatchDialog';

// Type aliases inferred from Supabase client
type Employer = {
  id: string;
  name: string;
  [key: string]: any;
};

type PendingEmployer = {
  id: string;
  company_name: string;
  csv_role: string;
  import_status?: string | null;
  imported_employer_id?: string | null;
  import_notes?: string | null;
  created_by?: string | null;
  our_role?: 'builder' | 'head_contractor' | 'subcontractor' | null;
  project_associations?: Array<{
    project_id: string;
    project_name: string;
    csv_role: string;
  }>;
  raw: any;
  [key: string]: any;
};

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

interface ImportResults {
  success: number;
  errors: string[];
  employersCreated: Array<{ id: string; name: string }>;
  processedEmployers: Array<{ id: string; name: string }>;
  duplicatesResolved: number;
  relationshipsCreated: number;
  ebaSearchesCompleted: number;
  ebaRecordsCreated: number;
  aliasDecisions: AliasPersistOutcome[];
}

type AliasDecision = 'keep_alias' | 'promote_canonical' | 'merge_alias'

interface EmployerAlias {
  id: string
  employerId: string
  employerName?: string | null
  alias: string
  alias_normalized: string
  source_system: string | null
  source_identifier: string | null
  collected_at: string | null
  collected_by: string | null
  is_authoritative: boolean | null
  notes: string | null
}

interface AliasPersistOutcome {
  pendingEmployerId: string
  employerId: string
  employerName: string
  alias: string
  decision: AliasDecision
  notes?: string | null
  status: 'inserted' | 'skipped' | 'failed' | 'promoted' | 'merged'
  error?: string
}

interface DuplicateDetection {
  pendingEmployer: PendingEmployer
  exactMatches: Array<{ id: string; name: string; address: string }>
  similarMatches: Array<{ id: string; name: string; address: string; similarity: number }>
  pendingAliasNormalized: string
  existingAliases: Record<string, EmployerAlias[]>
  conflictingAliases: EmployerAlias[]
  hasExactMatch: boolean
  hasSimilarMatches: boolean
  aliasDecision?: AliasDecision
  aliasNotes?: string
  mergeTargetAliasId?: string
  userDecision?: 'use_existing' | 'create_new'
  selectedEmployerId?: string
}

export default function PendingEmployersImport() {
  const [pendingEmployers, setPendingEmployers] = useState<PendingEmployer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set());
  const [showRawData, setShowRawData] = useState<Set<string>>(new Set());
  const [tradeTypeOverrides, setTradeTypeOverrides] = useState<Record<string, string>>({});
  const [projectLinkingMode, setProjectLinkingMode] = useState<'employer_only' | 'with_projects'>('employer_only');
  
      // Enhanced duplicate detection states
    const [duplicateDetections, setDuplicateDetections] = useState<Record<string, DuplicateDetection>>({});
    const [showDuplicateResolution, setShowDuplicateResolution] = useState(false);
    const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false);
    const [isMergingExact, setIsMergingExact] = useState<Record<string, boolean>>({});
    const [selectedExactMatches, setSelectedExactMatches] = useState<Set<string>>(new Set());
    const [isMergingAllExact, setIsMergingAllExact] = useState(false);
    const [mergeProgress, setMergeProgress] = useState({ current: 0, total: 0, currentEmployer: '' });
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [isCancelling, setIsCancelling] = useState(false);
    
    // Workflow state management
    const [workflowStep, setWorkflowStep] = useState<'review' | 'merge' | 'import' | 'complete'>('review');
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0, currentEmployer: '' });
    const [showProcessedEmployers, setShowProcessedEmployers] = useState(false);
    
  // EBA search states
  const [showEbaSearch, setShowEbaSearch] = useState(false);
  const [ebaSearchStates, setEbaSearchStates] = useState<Record<string, EbaSearchState>>({});
  const [isEbaSearching, setIsEbaSearching] = useState(false);
  const [expandedEbaResults, setExpandedEbaResults] = useState<Set<string>>(new Set());
  const [employersToDismiss, setEmployersToDismiss] = useState<Set<string>>(new Set());
  
  // Manual match dialog state
  const [manualMatchDialog, setManualMatchDialog] = useState<{
    open: boolean;
    pendingEmployerId: string | null;
    pendingEmployerName: string;
  }>({
    open: false,
    pendingEmployerId: null,
    pendingEmployerName: '',
  });

  // Delete confirmation dialog
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    employerId: string | null;
    employerName: string;
  }>({
    open: false,
    employerId: null,
    employerName: '',
  });

  // Filter for skipped employers
  const [showSkipped, setShowSkipped] = useState(false);
  
  const { toast } = useToast();
  const aliasTelemetry = useAliasTelemetry({ scope: 'pending_employers_import' });

  const handleAliasMergeTargetChange = (employerId: string, aliasId: string) => {
    const detection = duplicateDetections[employerId];
    if (!detection?.conflictingAliases?.length) {
      return;
    }

    if (detection.mergeTargetAliasId === aliasId) {
      return;
    }

    const selected = detection.conflictingAliases.find((alias) => alias.id === aliasId);
    if (selected) {
      aliasTelemetry.logInsert({
        employerId: selected.employerId,
        alias: detection.pendingEmployer.company_name,
        normalized: detection.pendingAliasNormalized,
        sourceSystem: 'pending_employers_import',
        sourceIdentifier: detection.pendingEmployer.id,
        collectedBy: detection.pendingEmployer.created_by ?? null,
        notes: detection.aliasNotes ?? null,
      });
    }

    setDuplicateDetections((prev) => ({
      ...prev,
      [employerId]: {
        ...prev[employerId],
        mergeTargetAliasId: aliasId,
      },
    }));
  };

  const persistAliasDecision = async ({
      employerId,
      employerName,
      pendingEmployer,
      detection,
      results,
    }: {
      employerId: string;
      employerName: string;
      pendingEmployer: PendingEmployer;
      detection?: DuplicateDetection;
      results: ImportResults;
    },
  ): Promise<void> => {
    const supabase = getSupabaseBrowserClient();
    const aliasDecision: AliasDecision = detection?.aliasDecision ?? 'keep_alias';
    const aliasNotes = detection?.aliasNotes ?? null;
    const normalizedAlias = detection?.pendingAliasNormalized ?? normalizeEmployerName(pendingEmployer.company_name).normalized;
    const outcome: AliasPersistOutcome = {
      pendingEmployerId: pendingEmployer.id,
      employerId,
      employerName,
      alias: pendingEmployer.company_name,
      decision: aliasDecision,
      notes: aliasNotes,
      status: 'failed',
    };

    const payload = {
      employer_id: employerId,
      alias: pendingEmployer.company_name,
      alias_normalized: normalizedAlias,
      source_system: 'pending_import',
      source_identifier: pendingEmployer.id,
      collected_at: new Date().toISOString(),
      collected_by: pendingEmployer.created_by ?? null,
      is_authoritative: aliasDecision === 'promote_canonical',
      notes: aliasNotes,
    };

    try {
      if (aliasDecision === 'promote_canonical') {
        const { data: employerRow, error: fetchError } = await supabase
          .from('employers')
          .select('name')
          .eq('id', employerId)
          .maybeSingle();
        if (fetchError) throw fetchError;
        const previousName = employerRow?.name ?? null;
        const { error: updateError } = await supabase
          .from('employers')
          .update({ name: pendingEmployer.company_name })
          .eq('id', employerId);
        if (updateError) throw updateError;
        const { error: aliasError } = await supabase
          .from('employer_aliases')
          .upsert(payload, { onConflict: 'employer_id,alias_normalized' });
        if (aliasError) throw aliasError;
        if (previousName && previousName !== pendingEmployer.company_name) {
          await supabase
            .from('employer_aliases')
            .upsert(
              {
                employer_id: employerId,
                alias: previousName,
                alias_normalized: normalizeEmployerName(previousName).normalized,
                source_system: 'pending_import',
                source_identifier: pendingEmployer.id,
                collected_at: new Date().toISOString(),
                collected_by: pendingEmployer.created_by ?? null,
                is_authoritative: false,
                notes: `Previous canonical name prior to promotion on ${new Date().toISOString()}`,
              },
              { onConflict: 'employer_id,alias_normalized' },
            );
        }
        aliasTelemetry.logInsert({
          employerId,
          alias: pendingEmployer.company_name,
          normalized: normalizedAlias,
          sourceSystem: 'pending_employers_import',
          sourceIdentifier: pendingEmployer.id,
          collectedBy: pendingEmployer.created_by ?? null,
          notes: aliasNotes ?? null,
        });
        outcome.status = 'promoted';
      } else if (aliasDecision === 'merge_alias') {
        const mergeTargetId = detection?.mergeTargetAliasId ?? detection?.conflictingAliases?.[0]?.id;
        if (!mergeTargetId) {
          outcome.status = 'skipped';
          outcome.error = 'No existing alias selected to merge into.';
        } else {
          const target = detection?.conflictingAliases.find((alias) => alias.id === mergeTargetId);
          const mergedNotes = [
            target?.notes,
            `Merged with pending import alias "${pendingEmployer.company_name}" on ${new Date().toLocaleDateString()}.`,
            aliasNotes ?? undefined,
          ]
            .filter(Boolean)
            .join('\n');
          const { error: mergeError } = await supabase
            .from('employer_aliases')
            .update({
              notes: mergedNotes,
              collected_at: new Date().toISOString(),
              collected_by: pendingEmployer.created_by ?? null,
            })
            .eq('id', mergeTargetId);
          if (mergeError) throw mergeError;
          aliasTelemetry.logInsert({
            employerId,
            alias: pendingEmployer.company_name,
            normalized: normalizedAlias,
            sourceSystem: 'pending_employers_import',
            sourceIdentifier: pendingEmployer.id,
            collectedBy: pendingEmployer.created_by ?? null,
            notes: aliasNotes ?? null,
          });
          outcome.status = 'merged';
        }
      } else {
        const { error: aliasError } = await supabase
          .from('employer_aliases')
          .upsert(payload, { onConflict: 'employer_id,alias_normalized' });
        if (aliasError) throw aliasError;
        aliasTelemetry.logInsert({
          employerId,
          alias: pendingEmployer.company_name,
          normalized: normalizedAlias,
          sourceSystem: 'pending_employers_import',
          sourceIdentifier: pendingEmployer.id,
          collectedBy: pendingEmployer.created_by ?? null,
          notes: aliasNotes ?? null,
        });
        outcome.status = 'inserted';
      }
    } catch (error) {
      outcome.error = error instanceof Error ? error.message : 'Alias persistence failed';
      aliasTelemetry.logFailure({
        employerId,
        alias: pendingEmployer.company_name,
        normalized: normalizedAlias,
        sourceSystem: 'pending_employers_import',
        sourceIdentifier: pendingEmployer.id,
        collectedBy: pendingEmployer.created_by ?? null,
        notes: aliasNotes ?? null,
        error: error instanceof Error ? error : new Error('Alias persistence failed'),
      });
    }

    results.aliasDecisions.push(outcome);
  };

  const loadPendingEmployers = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      let query = supabase
        .from('pending_employers')
        .select('*');

      console.log(`🔍 [FILTER] Loading pending employers - showProcessedEmployers: ${showProcessedEmployers}, workflowStep: ${workflowStep}`);

      if (!showProcessedEmployers) {
        // Build filter: show all unimported employers
        // These are employers that haven't been successfully imported yet
        const statuses = [
          'import_status.is.null',
          'import_status.eq.pending',
          'import_status.eq.matched',      // Ready to import (user selected existing)
          'import_status.eq.create_new'    // Ready to import (user confirmed new)
        ];

        if (showSkipped) {
          statuses.push('import_status.eq.skipped');
        }

        // DO NOT show 'imported' - those are done
        console.log(`🔍 [FILTER] Applying filter with statuses: ${statuses.join(', ')}`);
        query = query.or(statuses.join(','));
      } else {
        console.log(`🔍 [FILTER] Showing ALL employers (showProcessedEmployers = true)`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const statusText = showProcessedEmployers ? 'all' : 'unprocessed';
      console.log(`✅ [FILTER] Loaded ${(data || []).length} ${statusText} pending employers`);
      if (data && data.length > 0) {
        const statusCounts = data.reduce((acc: any, emp: any) => {
          const status = emp.import_status || 'null';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        console.log(`📊 [FILTER] Status breakdown:`, statusCounts);
      }

      setPendingEmployers(data || []);
      // If any pending employers carry project associations, default to link-to-projects
      try {
        const hasAssociations = (data || []).some((e: any) => Array.isArray(e.project_associations) && e.project_associations.length > 0);
        if (hasAssociations && projectLinkingMode === 'employer_only') {
          setProjectLinkingMode('with_projects');
        }
      } catch {}
      // Select all unprocessed employers by default, but don't auto-select processed ones
      if (showProcessedEmployers) {
        const unprocessed = (data || []).filter(emp => !emp.import_status || emp.import_status === 'pending');
        setSelectedEmployers(new Set(unprocessed.map(emp => emp.id)));
      } else {
        setSelectedEmployers(new Set(data?.map(emp => emp.id) || []));
      }
    } catch (error) {
      console.error('Error loading pending employers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectLinkingMode, showProcessedEmployers, showSkipped, workflowStep]);

  // Load pending employers on mount and when filter changes
  useEffect(() => {
    loadPendingEmployers();
  }, [loadPendingEmployers]);

  // ============================================================================
  // MANUAL MATCH, SKIP, DELETE HANDLERS
  // ============================================================================

  // Manual Match Handlers
  const openManualMatch = (employerId: string, employerName: string) => {
    setManualMatchDialog({
      open: true,
      pendingEmployerId: employerId,
      pendingEmployerName: employerName,
    });
  };

  const handleManualMatchSelect = async (matchedEmployerId: string) => {
    if (!manualMatchDialog.pendingEmployerId) return;
    
    const supabase = getSupabaseBrowserClient();
    
    console.log(`[Manual Match] Saving match for ${manualMatchDialog.pendingEmployerName}`);
    console.log(`  Pending ID: ${manualMatchDialog.pendingEmployerId}`);
    console.log(`  Matched Employer ID: ${matchedEmployerId}`);
    
    // Bypass duplicate detection - persist directly to database
    const { error } = await supabase
      .from('pending_employers')
      .update({
        import_status: 'matched',
        matched_employer_id: matchedEmployerId,
      })
      .eq('id', manualMatchDialog.pendingEmployerId);
    
    if (!error) {
      console.log(`  → ✅ Match saved to database`);
      toast({
        title: 'Match Saved',
        description: 'Employer matched successfully. Will update existing employer on import.',
      });
      
      // Refresh list to show updated status and reload the matched_employer_id
      await loadPendingEmployers();
    } else {
      console.error(`  → ❌ Match save failed:`, error);
      toast({
        title: 'Match Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
    
    setManualMatchDialog({ open: false, pendingEmployerId: null, pendingEmployerName: '' });
  };

  const handleManualMatchCreateNew = async () => {
    if (!manualMatchDialog.pendingEmployerId) return;
    
    const supabase = getSupabaseBrowserClient();
    
    // Mark as create new in database
    const { error } = await supabase
      .from('pending_employers')
      .update({
        import_status: 'create_new',
        matched_employer_id: null, // Clear any previous match
      })
      .eq('id', manualMatchDialog.pendingEmployerId);
    
    if (!error) {
      toast({
        title: 'Marked as New',
        description: 'Will create new employer on import',
      });
      
      loadPendingEmployers();
    } else {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
    
    setManualMatchDialog({ open: false, pendingEmployerId: null, pendingEmployerName: '' });
  };

  const handleManualMatchSkip = async () => {
    if (!manualMatchDialog.pendingEmployerId) return;
    
    const supabase = getSupabaseBrowserClient();
    
    // Update status to skipped (will be hidden from list)
    const { error } = await supabase
      .from('pending_employers')
      .update({ import_status: 'skipped' })
      .eq('id', manualMatchDialog.pendingEmployerId);
    
    if (!error) {
      toast({
        title: 'Skipped',
        description: 'Employer hidden from import list',
      });
      
      // Refresh list (employer will disappear if showSkipped is false)
      loadPendingEmployers();
    } else {
      toast({
        title: 'Skip Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
    
    setManualMatchDialog({ open: false, pendingEmployerId: null, pendingEmployerName: '' });
  };

  // Quick Skip (without opening dialog)
  const skipPendingEmployer = async (employerId: string, employerName: string) => {
    const supabase = getSupabaseBrowserClient();
    
    const { error } = await supabase
      .from('pending_employers')
      .update({ import_status: 'skipped' })
      .eq('id', employerId);
    
    if (!error) {
      toast({
        title: 'Skipped',
        description: `"${employerName}" hidden from import list`,
      });
      loadPendingEmployers();
    } else {
      toast({
        title: 'Skip Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Delete Handler (opens confirmation dialog)
  const openDeleteConfirm = (employerId: string, employerName: string) => {
    setDeleteConfirmDialog({
      open: true,
      employerId: employerId,
      employerName: employerName,
    });
  };

  const confirmDeletePendingEmployer = async () => {
    if (!deleteConfirmDialog.employerId) return;
    
    const supabase = getSupabaseBrowserClient();
    const employerName = deleteConfirmDialog.employerName;
    
    const { error } = await supabase
      .from('pending_employers')
      .delete()
      .eq('id', deleteConfirmDialog.employerId);
    
    if (!error) {
      toast({
        title: 'Deleted',
        description: `Removed "${employerName}" from pending list`,
      });
      
      // Remove from selected employers if it was selected
      setSelectedEmployers(prev => {
        const updated = new Set(prev);
        updated.delete(deleteConfirmDialog.employerId!);
        return updated;
      });
      
      // Refresh list
      loadPendingEmployers();
    } else {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
    
    setDeleteConfirmDialog({ open: false, employerId: null, employerName: '' });
  };

  // Switch from automatic match to manual search
  const switchToManualMatch = (employerId: string, employerName: string) => {
    // Remove from duplicate detections to allow manual override
    setDuplicateDetections(prev => {
      const updated = { ...prev };
      delete updated[employerId];
      return updated;
    });
    
    // Open manual match dialog
    openManualMatch(employerId, employerName);
    
    toast({
      title: 'Switched to Manual',
      description: 'Search for the correct employer match',
    });
  };

  // ============================================================================
  // END MANUAL MATCH, SKIP, DELETE HANDLERS
  // ============================================================================

  const createEmployer = async (pendingEmployer: PendingEmployer): Promise<string> => {
    const supabase = getSupabaseBrowserClient();
    const raw = pendingEmployer.raw;

    console.log(`Processing employer: ${pendingEmployer.company_name}`);

    // Check if user manually matched this employer (takes priority over automatic detection)
    if (pendingEmployer.import_status === 'matched' && pendingEmployer.matched_employer_id) {
      console.log(`✓ Using manually matched employer for ${pendingEmployer.company_name}: ${pendingEmployer.matched_employer_id}`);
      
      // SIMPLE: Set EBA status if source contains eba_trade_pdf
      const isEbaImport = pendingEmployer.source?.includes('eba_trade_pdf');
      
    if (isEbaImport) {
      const { error: ebaErr } = await (supabase as any).rpc('set_employer_eba_status', {
        p_employer_id: pendingEmployer.matched_employer_id,
        p_status: true,
        p_source: 'import',
        p_notes: `Matched via pending employers import (${pendingEmployer.source || 'unknown source'})`
      });
      if (ebaErr) {
        console.error('Failed to set EBA status via RPC:', ebaErr);
      }
      console.log(`  → ✅ EBA status set for matched employer`);
    }
      
      const updateData: any = {};
      
      // Add trade capabilities if needed
      if (pendingEmployer.our_role === 'subcontractor') {
        const finalTradeType = tradeTypeOverrides[pendingEmployer.id] || 
                              pendingEmployer.user_confirmed_trade_type || 
                              pendingEmployer.inferred_trade_type || 
                              'general_construction';
        
        // Check if trade capability already exists
        const { data: existingCapability } = await supabase
          .from('contractor_trade_capabilities')
          .select('id')
          .eq('employer_id', pendingEmployer.matched_employer_id)
          .eq('trade_type', finalTradeType)
          .maybeSingle();
        
        if (!existingCapability) {
          await supabase
            .from('contractor_trade_capabilities')
            .insert({
              employer_id: pendingEmployer.matched_employer_id,
              trade_type: finalTradeType,
              is_primary: true,
              notes: `Added via manual match. Original CSV role: ${pendingEmployer.csv_role}`
            });
          console.log(`  → Added trade capability: ${finalTradeType}`);
        }
      }
      
      // Update employer record if we have new data
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('employers')
          .update(updateData)
          .eq('id', pendingEmployer.matched_employer_id);
        
        if (updateError) {
          console.error('Error updating matched employer:', updateError);
        }
      }
      
      // Mark as imported
      console.log(`🔄 [STATUS UPDATE] Updating pending employer ${pendingEmployer.id} (${pendingEmployer.company_name}) to 'imported' status...`);
      const { data: updateData1, error: statusError1, count: updateCount1 } = await supabase
        .from('pending_employers')
        .update({
          import_status: 'imported',
          imported_employer_id: pendingEmployer.matched_employer_id
        })
        .eq('id', pendingEmployer.id)
        .select();

      if (statusError1) {
        console.error('❌ [STATUS UPDATE] Failed to update import_status (location 1):', statusError1);
      } else {
        console.log(`✅ [STATUS UPDATE] Query succeeded. Rows affected: ${updateData1?.length || 0}`, updateData1);
        if (!updateData1 || updateData1.length === 0) {
          console.error('⚠️ [STATUS UPDATE] UPDATE succeeded but 0 rows affected! Possible RLS policy blocking update.');
        }
      }
      
      return pendingEmployer.matched_employer_id;
    }

    // Check if user confirmed create new (bypass duplicate detection)
    if (pendingEmployer.import_status === 'create_new') {
      console.log(`✓ Creating new employer as confirmed by user: ${pendingEmployer.company_name}`);
      // Continue with normal employer creation logic below
    }

    // Check if user made a decision about duplicates (automatic detection)
    const detection = duplicateDetections[pendingEmployer.id];
    if (detection?.userDecision === 'use_existing' && detection.selectedEmployerId) {
      console.log(`✓ Using selected existing employer for ${pendingEmployer.company_name}: ${detection.selectedEmployerId}`);
      
      // SIMPLE: Set EBA status if source contains eba_trade_pdf
      const isEbaImport = pendingEmployer.source?.includes('eba_trade_pdf');
      
      if (isEbaImport) {
        const { error: ebaErr } = await (supabase as any).rpc('set_employer_eba_status', {
          p_employer_id: detection.selectedEmployerId,
          p_status: true,
          p_source: 'import',
          p_notes: `Matched via pending employers duplicate resolution (${pendingEmployer.source || 'unknown'})`
        });
        if (ebaErr) {
          console.error('Failed to set EBA status via RPC:', ebaErr);
        }
        console.log(`  → ✅ EBA status set for automatic match`);
      }
      
      // Still create trade capabilities if needed
      if (pendingEmployer.our_role === 'subcontractor') {
        const finalTradeType = tradeTypeOverrides[pendingEmployer.id] || 
                              pendingEmployer.user_confirmed_trade_type || 
                              pendingEmployer.inferred_trade_type || 
                              'general_construction';
        
        const { data: existingCapability } = await supabase
          .from('contractor_trade_capabilities')
          .select('id')
          .eq('employer_id', detection.selectedEmployerId)
          .eq('trade_type', finalTradeType)
          .maybeSingle();
        
        if (!existingCapability) {
          await supabase
            .from('contractor_trade_capabilities')
            .insert({
              employer_id: detection.selectedEmployerId,
              trade_type: finalTradeType,
              is_primary: true,
              notes: `Imported from BCI data. Original CSV role: ${pendingEmployer.csv_role}`
            });
        }
      }
      
      console.log(`🔄 [STATUS UPDATE] Updating pending employer ${pendingEmployer.id} (${pendingEmployer.company_name}) to 'imported' status (user selected duplicate)...`);
      const { data: updateData2, error: statusError2 } = await supabase
        .from('pending_employers')
        .update({
          import_status: 'imported',
          imported_employer_id: detection.selectedEmployerId,
          import_notes: `Used existing employer (user selected from duplicates)`
        })
        .eq('id', pendingEmployer.id)
        .select();

      if (statusError2) {
        console.error('❌ [STATUS UPDATE] Failed to update import_status (location 2):', statusError2);
      } else {
        console.log(`✅ [STATUS UPDATE] Query succeeded. Rows affected: ${updateData2?.length || 0}`, updateData2);
        if (!updateData2 || updateData2.length === 0) {
          console.error('⚠️ [STATUS UPDATE] UPDATE succeeded but 0 rows affected! Possible RLS policy blocking update.');
        }
      }
      
      return detection.selectedEmployerId;
    }
    
    // Step 1: Check for BCI Company ID match first (if available)
    let exactMatch = null;
    if (pendingEmployer.raw?.companyId) {
      const { data: bciMatch } = await supabase
        .from('employers')
        .select('id, name, address_line_1, suburb, state, bci_company_id')
        .eq('bci_company_id', pendingEmployer.raw.companyId)
        .maybeSingle();
      
      if (bciMatch) {
        console.log(`✓ Found BCI Company ID match: ${bciMatch.name} (BCI ID: ${pendingEmployer.raw.companyId})`);
        exactMatch = bciMatch;
      }
    }
    
    // Step 2: Fall back to exact name match if no BCI ID match
    if (!exactMatch) {
    const { data: nameMatch } = await supabase
      .from('employers')
      .select('id, name, address_line_1, suburb, state')
      .eq('name', pendingEmployer.company_name)
      .maybeSingle();
    exactMatch = nameMatch;
    }
    
    if (exactMatch) {
      console.log(`✓ Using existing employer: ${exactMatch.name} (ID: ${exactMatch.id})`);
      
      // Still create trade capabilities if needed
      if (pendingEmployer.our_role === 'subcontractor') {
        const finalTradeType = tradeTypeOverrides[pendingEmployer.id] || 
                              pendingEmployer.user_confirmed_trade_type || 
                              pendingEmployer.inferred_trade_type || 
                              'general_construction';
        
        // Check for existing trade capability
        const { data: existingCapability } = await supabase
          .from('contractor_trade_capabilities')
          .select('id')
          .eq('employer_id', exactMatch.id)
          .eq('trade_type', finalTradeType)
          .maybeSingle();
        
        if (!existingCapability) {
          await supabase
            .from('contractor_trade_capabilities')
            .insert({
              employer_id: exactMatch.id,
              trade_type: finalTradeType,
              is_primary: true,
              notes: `Imported from BCI data. Original CSV role: ${pendingEmployer.csv_role}`
            });
          console.log(`✓ Added trade capability: ${finalTradeType}`);
        }
      }
      
      // Update pending employer record
      console.log(`🔄 [STATUS UPDATE] Updating pending employer ${pendingEmployer.id} (${pendingEmployer.company_name}) to 'imported' status (duplicate prevention)...`);
      const { data: updateData3, error: statusError3 } = await supabase
        .from('pending_employers')
        .update({
          import_status: 'imported',
          imported_employer_id: exactMatch.id,
          import_notes: `Used existing employer (duplicate prevention)`
        })
        .eq('id', pendingEmployer.id)
        .select();

      if (statusError3) {
        console.error('❌ [STATUS UPDATE] Failed to update import_status (location 3):', statusError3);
      } else {
        console.log(`✅ [STATUS UPDATE] Query succeeded. Rows affected: ${updateData3?.length || 0}`, updateData3);
        if (!updateData3 || updateData3.length === 0) {
          console.error('⚠️ [STATUS UPDATE] UPDATE succeeded but 0 rows affected! Possible RLS policy blocking update.');
        }
      }
      
      return exactMatch.id;
    }
    
    // Step 2: Check for similar names and warn
      const { data: similarEmployers } = await supabase
      .from('employers')
      .select('id, name, address_line_1, suburb, state')
      .ilike('name', `%${pendingEmployer.company_name}%`)
      .limit(5);
    
    if (similarEmployers && similarEmployers.length > 0) {
      console.warn(`⚠ Found ${similarEmployers.length} similar employers for "${pendingEmployer.company_name}":`, 
        similarEmployers.map(e => e.name));
    }
    
    // Step 3: Create new employer
    // Create employer first, then update EBA status separately
    const { data: employerData, error: employerError} = await supabase
      .from('employers')
      .insert({
        name: pendingEmployer.company_name,
        bci_company_id: raw.companyId || null,
        address_line_1: raw.companyStreet || raw.address_line_1,
        suburb: raw.companyTown || raw.suburb,
        state: raw.companyState || raw.state,
        postcode: raw.companyPostcode || raw.postcode,
        phone: raw.companyPhone || raw.phone,
        email: raw.companyEmail,
        primary_contact_name: `${raw.contactFirstName || ''} ${raw.contactSurname || ''}`.trim(),
        employer_type: 'large_contractor'
      })
      .select('id')
      .single();
    
    if (employerError) throw employerError;
    
    const employerId = employerData.id;
    console.log(`✓ Created new employer: ${pendingEmployer.company_name} (${employerId})`);
    
    // SIMPLE FIX: Set EBA status with direct UPDATE (not during INSERT)
    const isEbaImport = pendingEmployer.source?.includes('eba_trade_pdf');
    
    if (isEbaImport) {
      const { error: ebaError } = await (supabase as any).rpc('set_employer_eba_status', {
        p_employer_id: employerId,
        p_status: true,
        p_source: 'import',
        p_notes: `Created via pending employers import (${pendingEmployer.source || 'unknown source'})`
      });

      if (ebaError) {
        console.error(`Failed to set EBA status via RPC:`, ebaError);
      } else {
        console.log(`  → ✅ EBA status set to TRUE`);
        await (supabase as any).rpc('refresh_employer_eba_status', { p_employer_id: employerId });
      }
    }
    
    // Store extracted trading names/aliases from EBA import
    if (raw.aliases && Array.isArray(raw.aliases) && raw.aliases.length > 0) {
      console.log(`📝 Storing ${raw.aliases.length} alias(es) for ${pendingEmployer.company_name}`);
      
      for (const aliasName of raw.aliases) {
        if (!aliasName || aliasName.trim().length === 0) continue;
        
        try {
          const normalized = normalizeEmployerName(aliasName);
          await supabase
            .from('employer_aliases')
            .upsert({
              employer_id: employerId,
              alias: aliasName,
              alias_normalized: normalized.normalized,
              source_system: 'eba_trade_pdf',
              source_identifier: `${pendingEmployer.id}:${aliasName}`,
              collected_at: new Date().toISOString(),
              collected_by: pendingEmployer.created_by ?? null,
              is_authoritative: false,
              notes: `Trading name extracted from EBA trade PDF: ${raw.sourceFile || 'unknown'}`,
            }, { onConflict: 'employer_id,alias_normalized' });
          
          console.log(`  ✓ Stored alias: "${aliasName}" → normalized: "${normalized.normalized}"`);
        } catch (aliasError) {
          console.warn(`  ⚠ Failed to store alias "${aliasName}":`, aliasError);
        }
      }
    }
    
    // Create trade capabilities record if it's a subcontractor with a trade type
    if (pendingEmployer.our_role === 'subcontractor') {
      const finalTradeType = tradeTypeOverrides[pendingEmployer.id] || 
                            pendingEmployer.user_confirmed_trade_type || 
                            pendingEmployer.inferred_trade_type || 
                            'general_construction';
      
      // Check for existing trade capability to prevent duplicates
      const { data: existingCapability } = await supabase
        .from('contractor_trade_capabilities')
        .select('id, trade_type')
        .eq('employer_id', employerId)
        .eq('trade_type', finalTradeType)
        .maybeSingle();
      
      if (!existingCapability) {
        const { error: tradeError } = await supabase
          .from('contractor_trade_capabilities')
          .insert({
            employer_id: employerId,
            trade_type: finalTradeType,
            is_primary: true,
            notes: `Imported from BCI data. Original CSV role: ${pendingEmployer.csv_role}`
          });
        
        if (tradeError) {
          console.warn('Failed to create trade capability:', tradeError);
        }
      } else {
        console.log(`✓ Trade capability already exists for ${pendingEmployer.company_name}: ${finalTradeType}`);
      }
    }
    
    // Update the pending employer record to mark as imported
    console.log(`🔄 [STATUS UPDATE] Updating pending employer ${pendingEmployer.id} (${pendingEmployer.company_name}) to 'imported' status (new employer)...`);
    const { data: updateData4, error: statusError4 } = await supabase
      .from('pending_employers')
      .update({
        import_status: 'imported',
        imported_employer_id: employerId,
        import_notes: `Successfully imported as ${pendingEmployer.our_role || 'employer'}`
      })
      .eq('id', pendingEmployer.id)
      .select();

    if (statusError4) {
      console.error('❌ [STATUS UPDATE] Failed to update import_status (location 4):', statusError4);
    } else {
      console.log(`✅ [STATUS UPDATE] Query succeeded. Rows affected: ${updateData4?.length || 0}`, updateData4);
      if (!updateData4 || updateData4.length === 0) {
        console.error('⚠️ [STATUS UPDATE] UPDATE succeeded but 0 rows affected! Possible RLS policy blocking update.');
      }
    }
    
    return employerId;
  };

  // Enhanced import function that checks for duplicates first
  const importSelectedEmployers = async () => {
    if (selectedEmployers.size === 0) return;
    
    // Run duplicate detection first
    await runDuplicateDetection();
  };

  const performDirectImport = async () => {
    setIsImporting(true);
    setWorkflowStep('import');
    const supabase = getSupabaseBrowserClient();
    const results: ImportResults = {
      success: 0,
              errors: [],
        employersCreated: [],
        processedEmployers: [],
        duplicatesResolved: 0,
        relationshipsCreated: 0,
        ebaSearchesCompleted: 0,
        ebaRecordsCreated: 0,
    aliasDecisions: []
    };

    const employersToImport = pendingEmployers.filter(emp => selectedEmployers.has(emp.id));
    setImportProgress({ current: 0, total: employersToImport.length, currentEmployer: '' });

    for (let i = 0; i < employersToImport.length; i++) {
      const pendingEmployer = employersToImport[i];
      setImportProgress(prev => ({ ...prev, current: i + 1, currentEmployer: pendingEmployer.company_name }));
      try {
        const employerId = await createEmployer(pendingEmployer);
        results.success++;
        results.employersCreated.push({ id: employerId, name: pendingEmployer.company_name });
        
        // Track all processed employers for EBA search (both new and existing)
        results.processedEmployers.push({
          id: employerId,
          name: pendingEmployer.company_name
        });

        // Track if this was a duplicate resolution (manual match, wizard decision, or automatic exact match)
        const detection = duplicateDetections[pendingEmployer.id];
        if (detection?.userDecision === 'use_existing' ||
            pendingEmployer.import_status === 'matched' ||
            (employerId !== pendingEmployer.id && pendingEmployer.import_status !== 'create_new')) {
          results.duplicatesResolved++;
        }

        // Enhanced project linking with duplicate prevention
        if (projectLinkingMode === 'with_projects' && pendingEmployer.project_associations) {
          console.log(`🔗 Linking ${pendingEmployer.company_name} to ${pendingEmployer.project_associations.length} projects`);
          const supabase = getSupabaseBrowserClient();
          
          for (const projectAssoc of pendingEmployer.project_associations) {
            console.log(`🔍 Looking for project: ${projectAssoc.project_name} (ID: ${projectAssoc.project_id})`);
            try {
              // Find the project by BCI ID first, then try regular UUID if needed
              let project = null;
              let projectQuery = null;
              
              // First try to match by BCI project ID (most likely case for imported data)
              const { data: bciProject, error: bciError } = await supabase
                .from('projects')
                .select('id, name, builder_id')
                .eq('bci_project_id', String(projectAssoc.project_id))
                .maybeSingle();
              
              if (bciError) {
                console.warn(`Error querying by BCI project ID ${projectAssoc.project_id}:`, bciError);
              }
              
              if (bciProject) {
                project = bciProject;
                console.log(`✓ Found project by BCI ID: ${project.name} (${projectAssoc.project_id})`);
              } else {
                // If no BCI match and the ID looks like a UUID, try UUID match
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(projectAssoc.project_id));
                
                if (isUUID) {
                  const { data: uuidProject, error: uuidError } = await supabase
                    .from('projects')
                    .select('id, name, builder_id')
                    .eq('id', projectAssoc.project_id)
                    .maybeSingle();
                  
                  if (uuidError) {
                    console.warn(`Error querying by UUID ${projectAssoc.project_id}:`, uuidError);
                  }
                  
                  if (uuidProject) {
                    project = uuidProject;
                    console.log(`✓ Found project by UUID: ${project.name} (${projectAssoc.project_id})`);
                  }
                } else {
                  // Final fallback: try to find by project name if we have it
                  if (projectAssoc.project_name) {
                    console.log(`🔍 Trying fallback search by project name: ${projectAssoc.project_name}`);
                    const { data: nameProject, error: nameError } = await supabase
                      .from('projects')
                      .select('id, name, builder_id')
                      .ilike('name', `%${projectAssoc.project_name}%`)
                      .maybeSingle();
                    
                    if (nameError) {
                      console.warn(`Error querying by project name ${projectAssoc.project_name}:`, nameError);
                    }
                    
                    if (nameProject) {
                      project = nameProject;
                      console.log(`✓ Found project by name: ${project.name} (fallback for ID: ${projectAssoc.project_id})`);
                    }
                  }
                }
              }

              if (project) {
                let relationshipCreated = false;
                
                if (pendingEmployer.our_role === 'builder') {
                  // Use enhanced builder assignment that handles multiple builders
                  try {
                    const { data: builderResult, error: builderError } = await supabase.rpc('assign_bci_builder', {
                      p_project_id: project.id,
                      p_employer_id: employerId,
                      p_company_name: pendingEmployer.company_name
                    });
                    
                    if (builderError) {
                      console.error(`Error assigning builder ${pendingEmployer.company_name}:`, builderError);
                    } else {
                      const result = builderResult?.[0];
                      if (result?.success) {
                        console.log(`✓ ${result.message}`);
                        relationshipCreated = true;
                      } else {
                        console.warn(`⚠ Failed to assign builder: ${result?.message || 'Unknown error'}`);
                      }
                    }
                  } catch (error) {
                    console.error(`Error in builder assignment:`, error);
                    // Fallback to original logic
                    if (!project.builder_id) {
                      await supabase
                        .from('projects')
                        .update({ builder_id: employerId })
                        .eq('id', project.id);
                      console.log(`✓ Assigned builder to ${project.name} (fallback)`);
                      relationshipCreated = true;
                    }
                  }
                  
                } else if (pendingEmployer.our_role === 'head_contractor') {
                  // Assign head contractor via RPC
                  try {
                    const { data: hcRes, error: hcErr } = await supabase.rpc('assign_contractor_role', {
                      p_project_id: project.id,
                      p_employer_id: employerId,
                      p_role_code: 'head_contractor',
                      p_company_name: pendingEmployer.company_name,
                      p_is_primary: false
                    });
                    if (hcErr) {
                      console.error('Head contractor assignment failed:', hcErr);
                    } else {
                      const r = hcRes?.[0];
                      console.log(r?.message || `✓ Assigned head contractor for ${project.name}`);
                      relationshipCreated = true;
                    }
                  } catch (e) {
                    console.error('Head contractor RPC error:', e);
                  }
                  
                } else if (pendingEmployer.our_role === 'subcontractor') {
                  const finalTradeType = getEffectiveTradeType(pendingEmployer);
                  
                  // Use enhanced trade assignment that handles conflicts
                  try {
                    const { data: tradeResult, error: tradeError } = await supabase.rpc('assign_contractor_trade', {
                      p_project_id: project.id,
                      p_employer_id: employerId,
                      p_trade_type: finalTradeType,
                      p_company_name: pendingEmployer.company_name
                    });
                    
                    if (tradeError) {
                      console.error(`Error assigning trade ${finalTradeType} to ${pendingEmployer.company_name}:`, tradeError);
                    } else {
                      const result = tradeResult?.[0];
                      if (result?.success) {
                        console.log(`✓ ${result.message}`);
                        relationshipCreated = true;
                      } else {
                        console.warn(`⚠ Failed to assign trade: ${result?.message || 'Unknown error'}`);
                      }
                    }
                  } catch (error) {
                    console.error(`Error in trade assignment:`, error);
                  }
                }
                
                if (relationshipCreated) {
                  results.relationshipsCreated++;
                }
              } else {
                console.warn(`⚠ Project not found: ${projectAssoc.project_name} (ID: ${projectAssoc.project_id})`);
              }
            } catch (linkError) {
              console.warn(`Failed to link ${pendingEmployer.company_name} to project ${projectAssoc.project_name}:`, linkError);
              // Don't fail the entire import for linking errors
            }
          }
        }

        try {
          await persistAliasDecision({
            employerId,
            employerName: pendingEmployer.company_name,
            pendingEmployer,
            detection,
            results,
          });
        } catch (aliasErr) {
          console.error('Failed to persist alias decision', aliasErr);
          results.errors.push(`Alias persistence failed for ${pendingEmployer.company_name}: ${aliasErr instanceof Error ? aliasErr.message : 'Unknown error'}`);
        }

      } catch (error) {
        console.error(`Error importing ${pendingEmployer.company_name}:`, error);
        results.errors.push(`Failed to import ${pendingEmployer.company_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Mark as error in database
        const supabase = getSupabaseBrowserClient();
        await supabase
          .from('pending_employers')
          .update({
            import_status: 'error',
            import_notes: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', pendingEmployer.id);
      }
    }

    setImportResults(results);
    setIsImporting(false);
    
    // Refresh materialized view so new employers appear in search immediately
    if (results.success > 0) {
      try {
        console.log('✓ Triggering materialized view refresh for employer search...');
        await fetch('/api/admin/refresh-views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'employers' })
        });
        console.log(`✓ Materialized view refreshed - ${results.success} new employers now searchable`);
      } catch (err) {
        console.warn('View refresh failed (non-fatal):', err);
        // Non-fatal - employers are still created, just won't appear in search immediately
      }
    }
    
    setWorkflowStep('complete');
    setShowDuplicateResolution(false);
    
    // Refresh pending employers list to remove imported employers
    await loadPendingEmployers();
    setSelectedEmployers(new Set());
    setImportProgress({ current: 0, total: 0, currentEmployer: '' });
    
    // SIMPLE FIX: Check if ANY employer source contains 'eba_trade_pdf'
    const hasEbaImports = employersToImport.some(emp => emp.source?.includes('eba_trade_pdf'));
    
    if (hasEbaImports && results.success > 0) {
      console.log(`📋 EBA import detected - opening FWC search dialog`);
      setTimeout(() => {
        setShowEbaSearch(true);
      }, 500);
    }
  };

  const deletePendingEmployer = async (id: string) => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from('pending_employers')
        .delete()
        .eq('id', id);
      
      await loadPendingEmployers();
      setSelectedEmployers(prev => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
    } catch (error) {
      console.error('Error deleting pending employer:', error);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedEmployers(prev => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  };

  const toggleRawData = (id: string) => {
    setShowRawData(prev => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  };

  const selectAll = () => {
    setSelectedEmployers(new Set(pendingEmployers.map(emp => emp.id)));
  };

  const selectNone = () => {
    setSelectedEmployers(new Set());
  };

  const updateTradeType = (employerId: string, tradeType: string) => {
    setTradeTypeOverrides(prev => ({
      ...prev,
      [employerId]: tradeType
    }));
  };

  const getEffectiveTradeType = (employer: PendingEmployer): string => {
    return tradeTypeOverrides[employer.id] || 
           employer.user_confirmed_trade_type || 
           employer.inferred_trade_type || 
           'general_construction';
  };

  // Enhanced duplicate detection
  const detectDuplicatesForImport = async (): Promise<Record<string, DuplicateDetection>> => {
    const supabase = getSupabaseBrowserClient();
    const detections: Record<string, DuplicateDetection> = {};

    const employersToImport = pendingEmployers.filter(emp => selectedEmployers.has(emp.id));

    for (const pendingEmployer of employersToImport) {
      // Skip employers that already have manual matches or are marked as "create new"
      // These decisions have already been made by the user
      if (pendingEmployer.import_status === 'matched' || pendingEmployer.import_status === 'create_new') {
        console.log(`⏭️  Skipping duplicate detection for "${pendingEmployer.company_name}" (already ${pendingEmployer.import_status})`);
        continue;
      }

      let exactMatches: any[] = [];
      
      // Check for BCI Company ID matches first (if available)
      if (pendingEmployer.raw?.companyId) {
        const { data: bciMatches } = await supabase
          .from('employers')
          .select('id, name, address_line_1, suburb, state, bci_company_id')
          .eq('bci_company_id', pendingEmployer.raw.companyId);
        
        if (bciMatches && bciMatches.length > 0) {
          exactMatches = bciMatches;
          console.log(`Found ${bciMatches.length} BCI Company ID matches for ${pendingEmployer.company_name}`);
        }
      }
      
      // Fall back to intelligent search using search_employers_with_aliases RPC
      // This handles normalization, aliases, and fuzzy matching much better than .eq()
      if (exactMatches.length === 0) {
        const { data: searchResults, error: searchError } = await supabase
          .rpc('search_employers_with_aliases', {
            p_query: pendingEmployer.company_name,
            p_limit: 20,
            p_offset: 0,
            p_include_aliases: true,
            p_alias_match_mode: 'any'
          });

        if (!searchError && searchResults && searchResults.length > 0) {
          // Split into exact and similar matches based on search score
          const highScoreMatches = searchResults.filter((r: any) => r.search_score >= 80);
          const mediumScoreMatches = searchResults.filter((r: any) => r.search_score >= 60 && r.search_score < 80);

          // Map to expected format
          exactMatches = highScoreMatches.map((r: any) => ({
            id: r.id,
            name: r.name,
            address_line_1: r.address_line_1,
            suburb: r.suburb,
            state: r.state,
            search_score: r.search_score,
            match_type: r.match_type
          }));

          console.log(`🔍 Found ${exactMatches.length} high-confidence matches for "${pendingEmployer.company_name}"`);
          exactMatches.forEach((m: any) => {
            console.log(`  ✓ ${m.name} (score: ${m.search_score}, type: ${m.match_type})`);
          });

          // Store medium score matches for similar matches section
          if (exactMatches.length === 0 && mediumScoreMatches.length > 0) {
            exactMatches = mediumScoreMatches.map((r: any) => ({
              id: r.id,
              name: r.name,
              address_line_1: r.address_line_1,
              suburb: r.suburb,
              state: r.state,
              search_score: r.search_score,
              match_type: r.match_type
            }));
            console.log(`🔍 Found ${exactMatches.length} medium-confidence matches for "${pendingEmployer.company_name}"`);
          }
        }
      }

      // Also check extracted aliases (T/A names from EBA imports) if still no matches
      if (exactMatches.length === 0 && pendingEmployer.raw?.aliases && Array.isArray(pendingEmployer.raw.aliases)) {
        console.log(`🔍 Checking ${pendingEmployer.raw.aliases.length} extracted alias(es) for matches...`);

        for (const aliasName of pendingEmployer.raw.aliases) {
          if (!aliasName || aliasName.trim().length === 0) continue;

          // Use the RPC search for aliases too
          const { data: aliasSearchResults, error: aliasSearchError } = await supabase
            .rpc('search_employers_with_aliases', {
              p_query: aliasName,
              p_limit: 10,
              p_offset: 0,
              p_include_aliases: true,
              p_alias_match_mode: 'any'
            });

          if (!aliasSearchError && aliasSearchResults && aliasSearchResults.length > 0) {
            const highScoreAliasMatches = aliasSearchResults.filter((r: any) => r.search_score >= 70);
            highScoreAliasMatches.forEach((r: any) => {
              if (!exactMatches.some((m: any) => m.id === r.id)) {
                exactMatches.push({
                  id: r.id,
                  name: r.name,
                  address_line_1: r.address_line_1,
                  suburb: r.suburb,
                  state: r.state,
                  search_score: r.search_score,
                  match_type: r.match_type
                });
                console.log(`  ✓ Found match via alias "${aliasName}": ${r.name} (score: ${r.search_score})`);
              }
            });
          }
        }
      }

      // Check for similar matches (only if no exact match)
      let similarMatches: any[] = [];
      if (!exactMatches || exactMatches.length === 0) {
        // Use the RPC search again with lower threshold for similar matches
        const { data: similarSearchResults, error: similarSearchError } = await supabase
          .rpc('search_employers_with_aliases', {
            p_query: pendingEmployer.company_name,
            p_limit: 10,
            p_offset: 0,
            p_include_aliases: true,
            p_alias_match_mode: 'any'
          });

        if (!similarSearchError && similarSearchResults && similarSearchResults.length > 0) {
          similarMatches = similarSearchResults
            .filter((r: any) => r.search_score >= 50 && r.search_score < 80)
            .map((r: any) => ({
              id: r.id,
              name: r.name,
              address_line_1: r.address_line_1,
              suburb: r.suburb,
              state: r.state,
              similarity: r.search_score
            }));
        }
      }
      
      const hasExactMatch = Boolean(exactMatches && exactMatches.length > 0);
      const hasSimilarMatches = Boolean(similarMatches.length > 0);
      
      if (hasExactMatch || hasSimilarMatches) {
        const normalizedAlias = normalizeEmployerName(pendingEmployer.company_name).normalized

        const aliasEmployerIds = new Set<string>();
        exactMatches.forEach((match) => aliasEmployerIds.add(match.id));
        similarMatches.forEach((match) => aliasEmployerIds.add(match.id));

        const existingAliases: Record<string, EmployerAlias[]> = {};
        const conflictingAliases: EmployerAlias[] = [];

        const { data: aliasRows } = await supabase
          .from('employer_aliases')
          .select('id, alias, alias_normalized, source_system, source_identifier, collected_at, collected_by, is_authoritative, notes, employer_id, employer:employers(id, name)')
          .eq('alias_normalized', normalizedAlias);

        (aliasRows || []).forEach((row: any) => {
          aliasEmployerIds.add(row.employer_id);
          const alias: EmployerAlias = {
            id: row.id,
            employerId: row.employer_id,
            employerName: row.employer?.name ?? null,
            alias: row.alias,
            alias_normalized: row.alias_normalized,
            source_system: row.source_system,
            source_identifier: row.source_identifier,
            collected_at: row.collected_at,
            collected_by: row.collected_by,
            is_authoritative: row.is_authoritative,
            notes: row.notes,
          };

          conflictingAliases.push(alias);

          if (!existingAliases[row.employer_id]) {
            existingAliases[row.employer_id] = [];
          }
          existingAliases[row.employer_id].push(alias);
        });

        if (aliasEmployerIds.size > 0) {
          const { data: allAliases } = await supabase
            .from('employer_aliases')
            .select('id, alias, alias_normalized, source_system, source_identifier, collected_at, collected_by, is_authoritative, notes, employer_id, employer:employers(id, name)')
            .in('employer_id', Array.from(aliasEmployerIds));

          (allAliases || []).forEach((row: any) => {
            const alias: EmployerAlias = {
              id: row.id,
              employerId: row.employer_id,
              employerName: row.employer?.name ?? null,
              alias: row.alias,
              alias_normalized: row.alias_normalized,
              source_system: row.source_system,
              source_identifier: row.source_identifier,
              collected_at: row.collected_at,
              collected_by: row.collected_by,
              is_authoritative: row.is_authoritative,
              notes: row.notes,
            };

            if (!existingAliases[row.employer_id]) {
              existingAliases[row.employer_id] = [];
            }

            if (!existingAliases[row.employer_id].some((existing) => existing.id === row.id)) {
              existingAliases[row.employer_id].push(alias);
            }
          });
        }

        const defaultMergeTargetAliasId = conflictingAliases[0]?.id;

        if (conflictingAliases.length > 0) {
          aliasTelemetry.logConflict({
            employerId: `pending:${pendingEmployer.id}`,
            alias: pendingEmployer.company_name,
            normalized: normalizedAlias,
            sourceSystem: 'pending_employers_import',
            sourceIdentifier: pendingEmployer.id,
            csvRole: pendingEmployer.csv_role ?? null,
            conflictingEmployers: conflictingAliases.map((alias) => ({
              employerId: alias.employerId,
              employerName: alias.employerName ?? null,
            })),
            conflictReason: 'duplicate_alias_normalized',
          });
        }

        detections[pendingEmployer.id] = {
          pendingEmployer,
          exactMatches: (exactMatches || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            address: `${m.address_line_1 || ''} ${m.suburb || ''} ${m.state || ''}`.trim(),
          })),
          similarMatches: similarMatches
            .map((m: any) => ({
              id: m.id,
              name: m.name,
              address: `${m.address_line_1 || ''} ${m.suburb || ''} ${m.state || ''}`.trim(),
              similarity: calculateSimilarity(pendingEmployer.company_name, m.name),
            }))
            .sort((a, b) => b.similarity - a.similarity),
          pendingAliasNormalized: normalizedAlias,
          existingAliases,
          conflictingAliases,
          aliasDecision: conflictingAliases.length > 0 ? 'merge_alias' : 'keep_alias',
          mergeTargetAliasId: conflictingAliases.length > 0 ? defaultMergeTargetAliasId : undefined,
          aliasNotes: undefined,
          hasExactMatch,
          hasSimilarMatches,
        };
      }
    }
    
    return detections;
  };

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

  // Pre-import duplicate detection
  const runDuplicateDetection = async () => {
    setIsDetectingDuplicates(true);
    setWorkflowStep('merge');
    try {
      const detections = await detectDuplicatesForImport();
      setDuplicateDetections(detections);

      // Count how many employers were skipped due to manual matches
      const employersToImport = pendingEmployers.filter(emp => selectedEmployers.has(emp.id));
      const manuallyMatchedCount = employersToImport.filter(emp =>
        emp.import_status === 'matched' || emp.import_status === 'create_new'
      ).length;

      if (manuallyMatchedCount > 0) {
        console.log(`✅ Skipped duplicate detection for ${manuallyMatchedCount} employer(s) with manual decisions`);
      }

      if (Object.keys(detections).length > 0) {
        setShowDuplicateResolution(true);
      } else {
        // No duplicates, proceed directly to import
        setWorkflowStep('import');
        await performDirectImport();
      }
      
    } catch (error) {
      console.error('Error detecting duplicates:', error);
      // Proceed with import anyway
      setWorkflowStep('import');
      await performDirectImport();
    } finally {
      setIsDetectingDuplicates(false);
    }
  };

  const updateDuplicateDecision = (employerId: string, decision: 'use_existing' | 'create_new', selectedEmployerId?: string) => {
    setDuplicateDetections(prev => ({
      ...prev,
      [employerId]: {
        ...prev[employerId],
        userDecision: decision,
        selectedEmployerId
      }
    }));
  };

  // Merge all exact matches for a pending employer into a single canonical employer
  const mergeExactMatchesFor = async (employerId: string) => {
    const detection = duplicateDetections[employerId];
    if (!detection || !detection.hasExactMatch || (detection.exactMatches || []).length === 0) {
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const exactIds = (detection.exactMatches || []).map((m) => m.id);
    if (exactIds.length === 1) {
      // Only one existing employer; resolve to use it
      updateDuplicateDecision(employerId, 'use_existing', exactIds[0]);
      return;
    }

    try {
      setIsMergingExact((prev) => ({ ...prev, [employerId]: true }));
      // Fetch created_at to pick the oldest as primary
      const { data: details } = await supabase
        .from('employers')
        .select('id, created_at')
        .in('id', exactIds);
      const sorted = (details || []).slice().sort((a: any, b: any) => {
        const ta = a?.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
      const primaryId: string = sorted.length > 0 ? sorted[0].id : exactIds[0];
      const duplicates = exactIds.filter((id) => id !== primaryId);

      if (duplicates.length > 0) {
        const { error } = await supabase.rpc('merge_employers', {
          p_primary_employer_id: primaryId,
          p_duplicate_employer_ids: duplicates,
        });
        if (error) {
          console.warn('Merge exact matches failed:', error);
          toast({
            title: 'Merge Failed',
            description: `Could not merge duplicates for ${detection.pendingEmployer.company_name}. You may need to resolve this manually.`,
            variant: 'destructive',
          });
          // Fall back: still resolve to primary so user can proceed
        } else {
          toast({
            title: 'Merge Successful',
            description: `Successfully merged ${duplicates.length + 1} records into one.`,
          });
        }
      }

      // Mark this detection as resolved to the primary employer
      updateDuplicateDecision(employerId, 'use_existing', primaryId);
    } finally {
      setIsMergingExact((prev) => ({ ...prev, [employerId]: false }));
    }
  };

  // Merge all selected exact matches across all pending employers
  const mergeAllSelectedExactMatches = async () => {
    if (selectedExactMatches.size === 0) return;
    
    setIsMergingAllExact(true);
    const employerIds = Array.from(selectedExactMatches);
    setMergeProgress({ current: 0, total: employerIds.length, currentEmployer: '' });
    const supabase = getSupabaseBrowserClient();
    let mergedCount = 0;
    
    try {
      for (let i = 0; i < employerIds.length; i++) {
        const employerId = employerIds[i];
      const detection = duplicateDetections[employerId];
      if (!detection?.hasExactMatch || !detection.exactMatches?.length) {
          setMergeProgress(prev => ({ ...prev, current: i + 1 }));
          continue;
        }
        
        setMergeProgress(prev => ({ 
          ...prev, 
          current: i + 1, 
          currentEmployer: detection.pendingEmployer.company_name 
        }));
        
        const exactIds = detection.exactMatches.map(m => m.id);
        if (exactIds.length === 1) {
          updateDuplicateDecision(employerId, 'use_existing', exactIds[0]);
          continue;
        }

        // Fetch created_at to pick the oldest as primary
        const { data: details } = await supabase
          .from('employers')
          .select('id, created_at')
          .in('id', exactIds);
        
        const sorted = (details || []).slice().sort((a: any, b: any) => {
          const ta = a?.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
          const tb = b?.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
          return ta - tb;
        });
        
        const primaryId: string = sorted.length > 0 ? sorted[0].id : exactIds[0];
        const duplicates = exactIds.filter(id => id !== primaryId);

        if (duplicates.length > 0) {
          console.log(`Merging ${duplicates.length} duplicates for ${detection.pendingEmployer.company_name}`);
        const { data, error } = await supabase.rpc('merge_employers', {
          p_primary_employer_id: primaryId,
          p_duplicate_employer_ids: duplicates,
        });
          
          if (error) {
            console.error(`Merge failed for ${detection.pendingEmployer.company_name}:`, error);
            throw error;
          } else {
            console.log(`Merge result:`, data);
            mergedCount++;
          }
        }

        updateDuplicateDecision(employerId, 'use_existing', primaryId);
      }
      
      // Clear selection after successful merge
      setSelectedExactMatches(new Set());
      
      // Show toast notification for successful merge
      toast({
        title: 'Merge Successful',
        description: `Successfully merged ${mergedCount} employer groups.`,
      });
      
      // Re-run duplicate detection to update the UI state
      setTimeout(async () => {
        const refreshedDetections = await detectDuplicatesForImport();
        
        // IMPORTANT: Preserve existing user decisions when refreshing
        setDuplicateDetections(prev => {
          const merged = { ...refreshedDetections };
          
          // Restore user decisions from previous state
          Object.keys(prev).forEach(employerId => {
            if (merged[employerId]) {
              // Preserve user decision and selected employer
              if (prev[employerId].userDecision) {
                merged[employerId].userDecision = prev[employerId].userDecision;
              }
              if (prev[employerId].selectedEmployerId) {
                merged[employerId].selectedEmployerId = prev[employerId].selectedEmployerId;
              }
              // Preserve alias decisions too
              if (prev[employerId].aliasDecision) {
                merged[employerId].aliasDecision = prev[employerId].aliasDecision;
              }
              if (prev[employerId].aliasNotes) {
                merged[employerId].aliasNotes = prev[employerId].aliasNotes;
              }
              if (prev[employerId].mergeTargetAliasId) {
                merged[employerId].mergeTargetAliasId = prev[employerId].mergeTargetAliasId;
              }
            }
          });
          
          return merged;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error during bulk merge:', error);
      toast({
        title: 'Bulk Merge Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
      // Don't clear selection on error so user can retry
    } finally {
      setIsMergingAllExact(false);
      setMergeProgress({ current: 0, total: 0, currentEmployer: '' });
    }
  };

  // Bulk accept: for all detections with no exact matches but with a strong inferred match list,
  // proceed with 'create_new' automatically. This reduces per-employer clicks when staging from BCI.
  const autoAcceptCreateNewForUnmatched = () => {
    const updated: Record<string, DuplicateDetection> = { ...duplicateDetections } as any;
    Object.entries(updated).forEach(([id, det]) => {
      if (!det.hasExactMatch) {
        updated[id] = { ...det, userDecision: 'create_new' } as any;
      }
    });
    setDuplicateDetections(updated);
  };

  // Toggle selection of exact match
  const toggleExactMatchSelection = (employerId: string) => {
    setSelectedExactMatches(prev => {
      const updated = new Set(prev);
      if (updated.has(employerId)) {
        updated.delete(employerId);
      } else {
        updated.add(employerId);
      }
      return updated;
    });
  };

  // Select all exact matches
  const selectAllExactMatches = () => {
    const exactMatchIds = Object.entries(duplicateDetections)
      .filter(([_, detection]) => detection.hasExactMatch)
      .map(([employerId, _]) => employerId);
    setSelectedExactMatches(new Set(exactMatchIds));
  };

  // Clear all exact match selections
  const clearExactMatchSelection = () => {
    setSelectedExactMatches(new Set());
  };

  // Toggle card expansion
  const toggleCardExpansion = (employerId: string) => {
    setExpandedCards(prev => {
      const updated = new Set(prev);
      if (updated.has(employerId)) {
        updated.delete(employerId);
      } else {
        updated.add(employerId);
      }
      return updated;
    });
  };

  // EBA Search Functions
  const searchEbaForEmployers = useCallback(async (employerIds: string[]) => {
    setIsEbaSearching(true);
    const supabase = getSupabaseBrowserClient();
    let searchesCompleted = 0;
    let recordsCreated = 0;

    try {
      // Get employer details
      const { data: employers } = await supabase
        .from('employers')
        .select('id, name')
        .in('id', employerIds);

      if (!employers) return;

      for (const employer of employers) {
        setEbaSearchStates(prev => ({
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
          searchesCompleted++;

          if (response.ok && data.results?.length > 0) {
            setEbaSearchStates(prev => ({
              ...prev,
              [employer.id]: {
                ...prev[employer.id],
                isSearching: false,
                results: data.results,
              }
            }));
          } else {
            setEbaSearchStates(prev => ({
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
          setEbaSearchStates(prev => ({
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
      }

      // Update import results
      if (importResults) {
        setImportResults(prev => prev ? {
          ...prev,
          ebaSearchesCompleted: searchesCompleted,
          ebaRecordsCreated: recordsCreated
        } : null);
      }

    } finally {
      setIsEbaSearching(false);
    }
  }, [importResults]);

  const createEbaRecord = useCallback(async (employerId: string, result: FWCSearchResult) => {
    try {
      const supabase = getSupabaseBrowserClient();
      
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

      // Update import results
      if (importResults) {
        setImportResults(prev => prev ? {
          ...prev,
          ebaRecordsCreated: prev.ebaRecordsCreated + 1
        } : null);
      }

      return true;
    } catch (error) {
      console.error('Error creating EBA record:', error);
      return false;
    }
  }, [importResults]);

  const toggleEbaResultsExpansion = (employerId: string) => {
    setExpandedEbaResults(prev => {
      const updated = new Set(prev);
      if (updated.has(employerId)) {
        updated.delete(employerId);
      } else {
        updated.add(employerId);
      }
      return updated;
    });
  };

  const finalizeEbaDismissals = async () => {
    if (employersToDismiss.size === 0) return;

    const employersToUpdate = Array.from(employersToDismiss);
    const recordsToInsert = employersToUpdate.map(id => ({
      employer_id: id,
      comments: 'Batch marked as "No EBA Found" during import process.',
      eba_file_number: 'N/A - No EBA Found'
    }));

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from('company_eba_records')
        .insert(recordsToInsert);

      if (error) throw error;

      for (const employerId of employersToUpdate) {
        const { error: rpcError } = await (supabase as any).rpc('set_employer_eba_status', {
          p_employer_id: employerId,
          p_status: false,
          p_source: 'manual',
          p_notes: 'Marked as no EBA found during pending employers import'
        });
        if (rpcError) {
          console.error('Failed to clear EBA status via RPC:', rpcError);
        }
      }

      toast({
        title: `${employersToUpdate.length} Employers Updated`,
        description: `Successfully marked employers as having no EBA.`,
      });

      // Remove the dismissed employers from the search results view
      setEbaSearchStates(prev => {
        const updated = { ...prev };
        employersToUpdate.forEach(id => {
          delete updated[id];
        });
        return updated;
      });
      setEmployersToDismiss(new Set());

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

  const cancelImport = () => {
    setIsCancelling(true);
    // Potentially add any cleanup logic here
    console.log('Import cancelled.');
    // For now, just reset the state
    setWorkflowStep('review');
    setShowDuplicateResolution(false);
    setDuplicateDetections({});
    setSelectedEmployers(new Set());
    loadPendingEmployers();
    setTimeout(() => setIsCancelling(false), 500);
  };

  if (isLoading) {
    return (
      <div className="text-center space-y-4">
        <img src="/spinner.gif" alt="Loading" className="w-8 h-8 mx-auto" />
        <h2 className="text-xl font-semibold">Loading Pending Employers...</h2>
        <p className="text-gray-600">Fetching employers queued for import</p>
      </div>
    );
  }

  if (isDetectingDuplicates) {
    return (
      <div className="text-center space-y-4">
        <img src="/spinner.gif" alt="Loading" className="w-8 h-8 mx-auto" />
        <h2 className="text-xl font-semibold">Step 2: Detecting Duplicates...</h2>
        <p className="text-gray-600">Checking for existing employers in database</p>
      </div>
    );
  }

  if (isCancelling) {
    return (
      <div className="text-center space-y-4">
        <img src="/spinner.gif" alt="Loading" className="w-8 h-8 mx-auto" />
        <h2 className="text-xl font-semibold">Cancelling Import...</h2>
        <p className="text-gray-600">Returning to the employer list.</p>
      </div>
    );
  }

  const renderWorkflowSteps = () => (
    <div className="flex items-center justify-center space-x-4 mt-4 mb-6">
      <div className={`flex items-center space-x-2 ${workflowStep === 'review' ? 'text-blue-600' : ['merge', 'import', 'complete'].includes(workflowStep) ? 'text-green-600' : 'text-gray-400'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${workflowStep === 'review' ? 'bg-blue-100 text-blue-600' : ['merge', 'import', 'complete'].includes(workflowStep) ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          1
        </div>
        <span className="text-sm font-medium">Review & Select</span>
      </div>
      <div className={`w-8 h-0.5 ${['merge', 'import', 'complete'].includes(workflowStep) ? 'bg-green-600' : 'bg-gray-300'}`}></div>
      <div className={`flex items-center space-x-2 ${workflowStep === 'merge' ? 'text-blue-600' : ['import', 'complete'].includes(workflowStep) ? 'text-green-600' : 'text-gray-400'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${workflowStep === 'merge' ? 'bg-blue-100 text-blue-600' : ['import', 'complete'].includes(workflowStep) ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          2
        </div>
        <span className="text-sm font-medium">Merge Duplicates</span>
      </div>
      <div className={`w-8 h-0.5 ${['import', 'complete'].includes(workflowStep) ? 'bg-green-600' : 'bg-gray-300'}`}></div>
      <div className={`flex items-center space-x-2 ${workflowStep === 'import' ? 'text-blue-600' : workflowStep === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${workflowStep === 'import' ? 'bg-blue-100 text-blue-600' : workflowStep === 'complete' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          3
        </div>
        <span className="text-sm font-medium">Import</span>
      </div>
    </div>
  );

  if (isImporting) {
    return (
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center space-x-2">
          <img src="/spinner.gif" alt="Loading" className="w-8 h-8" />
          <h2 className="text-xl font-semibold">Step 3: Importing Employers...</h2>
        </div>
        
        {/* Progress Bar */}
        <div className="max-w-md mx-auto">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{importProgress.current} of {importProgress.total} employers</span>
            <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            ></div>
          </div>
          {importProgress.currentEmployer && (
            <p className="text-sm text-gray-600 mt-2">
              Currently processing: {importProgress.currentEmployer}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (importResults) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Import Complete!</h2>
          <p className="text-gray-600">
            Successfully imported {importResults.success} employers
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-green-600">{importResults.success}</div>
              <p className="text-sm text-gray-600">Employers Created</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-blue-600">{importResults.duplicatesResolved}</div>
              <p className="text-sm text-gray-600">Employers Merged</p>
              <p className="text-xs text-muted-foreground mt-1">
                (Manual + Automatic)
              </p>
            </CardContent>
          </Card>
          
                     <Card>
             <CardContent className="p-6 text-center">
               <div className="text-2xl font-bold text-purple-600">{importResults.relationshipsCreated}</div>
               <p className="text-sm text-gray-600">Project Links Created</p>
             </CardContent>
           </Card>
           
           <Card>
             <CardContent className="p-6 text-center">
               <div className="text-2xl font-bold text-orange-600">{importResults.ebaSearchesCompleted}</div>
               <p className="text-sm text-gray-600">EBA Searches</p>
             </CardContent>
           </Card>
           
           <Card>
             <CardContent className="p-6 text-center">
               <div className="text-2xl font-bold text-teal-600">{importResults.ebaRecordsCreated}</div>
               <p className="text-sm text-gray-600">EBA Records Created</p>
             </CardContent>
           </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-red-600">{importResults.errors.length}</div>
              <p className="text-sm text-gray-600">Import Errors</p>
            </CardContent>
          </Card>
        </div>
        
        {importResults.errors.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-800">Import Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {importResults.errors.map((error, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="text-center space-y-2">
          <div className="flex gap-2 justify-center">
            <Button 
              onClick={() => setShowEbaSearch(true)}
              disabled={isEbaSearching || !(importResults as ImportResults)?.processedEmployers || (importResults as ImportResults).processedEmployers.length === 0}
              variant="outline"
            >
              {isEbaSearching ? (
                <>
                  <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
                  Searching EBAs...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search for EBAs
                </>
              )}
            </Button>
            <Button onClick={() => {
              setImportResults(null);
              setWorkflowStep('review');
              setDuplicateDetections({});
              setSelectedExactMatches(new Set());
              setExpandedCards(new Set());
              setEbaSearchStates({});
              loadPendingEmployers();
            }}>
              Import More Employers
            </Button>
          </div>
          {(importResults as ImportResults)?.processedEmployers && (importResults as ImportResults).processedEmployers.length > 0 && (
            <p className="text-sm text-gray-600">
              Search FWC database for Enterprise Bargaining Agreements for the processed employers
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Enhanced Pending Employers Import</h2>
        <p className="text-gray-600">
          Import employers with comprehensive duplicate detection and prevention
        </p>
        
        {/* Workflow Steps Indicator */}
        {renderWorkflowSteps()}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Review the list of pending employers below. Use the checkboxes to select which employers you want to import.
          For subcontractors, please ensure you review and confirm the assigned <strong>Trade Type</strong>.
          You can also adjust the assigned <strong>Role</strong> for any employer.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {/* Always show the toggle and controls */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {pendingEmployers.length} {showProcessedEmployers ? 'Total' : 'Pending'} Employers
                </CardTitle>
                <CardDescription>
                  {showProcessedEmployers 
                    ? 'All employers (including processed ones)' 
                    : 'Unprocessed employers queued for import'
                  }
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showSkipped}
                    onChange={(e) => setShowSkipped(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Show skipped
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showProcessedEmployers}
                    onChange={(e) => setShowProcessedEmployers(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Show processed
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pendingEmployers.length === 0 ? (
              <div className="p-8 text-center">
                <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {showProcessedEmployers ? 'No Employers Found' : 'No Pending Employers'}
                </h3>
                <p className="text-gray-600">
                  {showProcessedEmployers 
                    ? 'No employers found in the system. Import some data to get started.'
                    : 'No employers are currently queued for import. Use the BCI Projects import and select "Add to Import List" to queue employers for batch import.'
                  }
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                <div className="flex gap-2 mb-4">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All ({pendingEmployers.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>
                    Select None
                  </Button>
                  <div className="text-sm text-gray-600 flex items-center ml-auto">
                    {selectedEmployers.size} of {pendingEmployers.length} selected
                  </div>
                </div>

                <div className="sticky top-0 z-10 bg-white py-4 border-b">
                  <div className="flex gap-4 p-3 bg-blue-50 rounded border border-blue-200 items-center">
                    <Label className="text-sm font-medium">Import Mode:</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="employer_only"
                          checked={projectLinkingMode === 'employer_only'}
                          onChange={(e) => setProjectLinkingMode(e.target.value as any)}
                        />
                        <span className="text-sm">Employers Only</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="with_projects"
                          checked={projectLinkingMode === 'with_projects'}
                          onChange={(e) => setProjectLinkingMode(e.target.value as any)}
                        />
                        <span className="text-sm">Link to Projects</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-[calc(100vh-450px)] overflow-y-auto">
                {pendingEmployers.map((employer) => (
                  <div key={employer.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedEmployers.has(employer.id)}
                          onChange={() => toggleSelection(employer.id)}
                          className="w-4 h-4"
                          disabled={!!(employer.import_status && employer.import_status !== 'pending')} // Disable selection for processed employers
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{employer.company_name}</h4>
                            {employer.import_status && (
                              <Badge 
                                variant={employer.import_status === 'imported' ? 'default' : 'destructive'}
                                className="text-xs"
                              >
                                {employer.import_status === 'imported' ? '✓ Imported' : 
                                 employer.import_status === 'error' ? '✗ Failed' : employer.import_status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={employer.our_role === 'builder' ? 'default' : employer.our_role === 'head_contractor' ? 'secondary' : 'outline'}>
                              {employer.our_role === 'builder' ? 'Builder' : 
                               employer.our_role === 'head_contractor' ? 'Head Contractor' : 
                               'Subcontractor'}
                            </Badge>
                            {employer.inferred_trade_type && (
                              <Badge variant="outline" className="text-xs">
                                <Wrench className="h-3 w-3 mr-1" />
                                {getTradeTypeLabel(employer.inferred_trade_type as TradeType)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            CSV Role: {employer.csv_role} • Source: {employer.source}
                          </p>
                          {employer.project_associations && employer.project_associations.length > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              Projects: {employer.project_associations.map(p => p.project_name).join(', ')}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            Added: {new Date(employer.created_at).toLocaleDateString()}
                          </p>
                          {employer.import_status && employer.import_notes && (
                            <p className="text-xs text-gray-600 mt-1">
                              {employer.import_notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRawData(employer.id)}
                        >
                          {showRawData.has(employer.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {/* Allow overriding the inferred role */}
                        <Select
                          value={employer.our_role || 'subcontractor'}
                          onValueChange={async (value) => {
                            const supabase = getSupabaseBrowserClient();
                            const newRole = value as 'builder' | 'head_contractor' | 'subcontractor';
                            // Update local state first
                            setPendingEmployers(prev => prev.map(e => e.id === employer.id ? { ...e, our_role: newRole } : e));
                            // Persist change so import uses it
                            try {
                              await supabase
                                .from('pending_employers')
                                .update({ our_role: newRole })
                                .eq('id', employer.id);
                            } catch (e) {
                              // non-fatal
                            }
                          }}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="builder">Builder</SelectItem>
                            <SelectItem value="head_contractor">Head Contractor</SelectItem>
                            <SelectItem value="subcontractor">Subcontractor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Action Buttons - Different per scenario */}
                    <div className="flex gap-2 flex-wrap border-t pt-3">
                      {/* SCENARIO 1: Has automatic duplicate detection */}
                      {duplicateDetections[employer.id] ? (
                        <>
                          {/* Confirm automatic match */}
                          {duplicateDetections[employer.id].hasExactMatch && (
                            <Button
                              size="sm"
                              variant={duplicateDetections[employer.id].userDecision === 'use_existing' ? 'default' : 'outline'}
                              onClick={() => {
                                const match = duplicateDetections[employer.id].exactMatches?.[0];
                                if (match) {
                                  updateDuplicateDecision(employer.id, 'use_existing', match.id);
                                }
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {duplicateDetections[employer.id].userDecision === 'use_existing' ? 'Match Confirmed' : 'Confirm Match'}
                            </Button>
                          )}
                          
                          {/* Switch to manual search */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => switchToManualMatch(employer.id, employer.company_name)}
                          >
                            <Search className="h-4 w-4 mr-1" />
                            Different Match
                          </Button>
                          
                          {/* Create New option */}
                          <Button
                            size="sm"
                            variant={duplicateDetections[employer.id].userDecision === 'create_new' ? 'default' : 'outline'}
                            onClick={() => updateDuplicateDecision(employer.id, 'create_new')}
                          >
                            Create New
                          </Button>
                        </>
                      ) : (
                        /* SCENARIO 2: No automatic match - show manual match button */
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openManualMatch(employer.id, employer.company_name)}
                          >
                            <Search className="h-4 w-4 mr-1" />
                            Manual Match
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => skipPendingEmployer(employer.id, employer.company_name)}
                            disabled={employer.import_status === 'skipped'}
                          >
                            {employer.import_status === 'skipped' ? 'Skipped' : 'Skip'}
                          </Button>
                        </>
                      )}
                      
                      {/* Delete always available */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDeleteConfirm(employer.id, employer.company_name)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Trade Type Selection for Subcontractors */}
                    {employer.our_role === 'subcontractor' && (
                      <div className="space-y-2 p-3 bg-yellow-50 rounded border border-yellow-200">
                        <Label htmlFor={`trade-${employer.id}`} className="text-sm font-medium">
                          Trade Type (Review & Confirm):
                        </Label>
                        <Select 
                          value={getEffectiveTradeType(employer)} 
                          onValueChange={(value) => updateTradeType(employer.id, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(getTradeTypeCategories()).map(([category, types]) => (
                              <div key={category}>
                                <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 uppercase">
                                  {category}
                                </div>
                                {types.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {getTradeTypeLabel(type)}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                        {employer.inferred_trade_type && employer.inferred_trade_type !== getEffectiveTradeType(employer) && (
                          <p className="text-xs text-amber-600">
                            Original inference: {getTradeTypeLabel(employer.inferred_trade_type as TradeType)}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {showRawData.has(employer.id) && (
                      <div className="mt-3 p-3 bg-gray-50 rounded text-xs">
                        <pre>{JSON.stringify(employer.raw, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="sticky bottom-0 z-10 bg-white py-4 border-t">
                <div className="flex justify-center gap-4 mt-6">
                  {/* Show EBA search for processed employers */}
                  {showProcessedEmployers && pendingEmployers.some(emp => emp.import_status === 'imported') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const importedEmployers = pendingEmployers.filter(emp => emp.import_status === 'imported');
                        const processedEmployers = importedEmployers.map(emp => ({
                          id: emp.imported_employer_id || emp.id,
                          name: emp.company_name
                        }));
                        
                        // Set up mock import results for EBA search
                        setImportResults({
                          success: importedEmployers.length,
                          errors: [],
                          employersCreated: importedEmployers.map(emp => ({ id: emp.id, name: emp.company_name })),
                          processedEmployers: processedEmployers,
                          duplicatesResolved: 0,
                          relationshipsCreated: 0,
                          ebaSearchesCompleted: 0,
                          ebaRecordsCreated: 0,
                          aliasDecisions: []
                        });
                        setShowEbaSearch(true);
                      }}
                      disabled={isEbaSearching}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Search EBAs for Imported Employers
                    </Button>
                  )}
                  
                  {/* Regular import button - show for all unimported employers */}
                  {selectedEmployers.size > 0 && pendingEmployers.some(emp =>
                    selectedEmployers.has(emp.id) &&
                    (!emp.import_status || ['pending', 'matched', 'create_new'].includes(emp.import_status))
                  ) && (
                    <Button 
                      onClick={importSelectedEmployers}
                      disabled={isImporting || selectedEmployers.size === 0}
                      className="px-8"
                    >
                      {isImporting ? (
                        <>
                          <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
                          Importing...
                        </>
                      ) : (
                        `Import ${selectedEmployers.size} Selected Employers${projectLinkingMode === 'with_projects' ? ' + Link to Projects' : ''} (with Duplicate Detection)`
                      )}
                    </Button>
                  )}
                  </div>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
             {/* EBA Search Dialog */}
       <Dialog open={showEbaSearch} onOpenChange={setShowEbaSearch}>
         <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Search className="h-5 w-5 text-blue-500" />
               Search for Enterprise Bargaining Agreements
             </DialogTitle>
             <DialogDescription>
               Search FWC database for EBAs for newly imported employers
             </DialogDescription>
           </DialogHeader>
           
           <div className="space-y-4 break-words">
             {!importResults || !(importResults as ImportResults).processedEmployers || (importResults as ImportResults).processedEmployers.length === 0 ? (
               <Alert>
                 <Info className="h-4 w-4" />
                 <AlertDescription>
                   No employers were processed. EBA search is only available after importing employers.
                 </AlertDescription>
               </Alert>
             ) : (
               <>
                 <Alert>
                   <Info className="h-4 w-4" />
                   <AlertDescription>
                     This will search the Fair Work Commission database for Enterprise Bargaining Agreements 
                     for the {(importResults as ImportResults)?.processedEmployers?.length || 0} processed employers.
                   </AlertDescription>
                 </Alert>
                 {isEbaSearching && (
                   <div className="bg-blue-50 border border-blue-200 rounded p-3">
                     <div className="flex items-center gap-2 mb-2">
                       <img src="/spinner.gif" alt="Loading" className="h-4 w-4" />
                       <span className="text-sm font-medium text-blue-800">Searching FWC database...</span>
                     </div>
                     <div className="text-xs text-blue-800 mb-1">
                       Progress updates appear below as each employer finishes.
                     </div>
                     <div className="w-full bg-blue-100 rounded-full h-2">
                       <div
                         className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                         style={{ width: `${Math.min(100, Math.round((Object.values(ebaSearchStates).filter(s => !s.isSearching).length / ((importResults as ImportResults)?.processedEmployers?.length || 1)) * 100))}%` }}
                       ></div>
                     </div>
                   </div>
                 )}
                 
                 <div className="flex justify-end gap-2">
                   <Button
                     variant="outline"
                     onClick={() => setShowEbaSearch(false)}
                   >
                     Cancel
                   </Button>
                   <Button
                     onClick={async () => {
                       // Use the processed employers directly (they already have IDs)
                       const processedEmployers = (importResults as ImportResults)?.processedEmployers || [];
                       console.log('Searching EBAs for processed employers:', processedEmployers);
                       
                       if (processedEmployers.length > 0) {
                         await searchEbaForEmployers(processedEmployers.map(e => e.id));
                       } else {
                         console.warn('No processed employers found for EBA search');
                       }
                       setShowEbaSearch(false);
                     }}
                     disabled={isEbaSearching}
                   >
                     {isEbaSearching ? (
                       <>
                         <img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" />
                         Searching...
                       </>
                     ) : (
                       <>
                         <Search className="h-4 w-4 mr-2" />
                         Start EBA Search
                       </>
                     )}
                   </Button>
                   <Button
                    onClick={finalizeEbaDismissals}
                    disabled={employersToDismiss.size === 0}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Finalize {employersToDismiss.size} Dismissals
                  </Button>
                 </div>
                 
                 {/* Display EBA Search Results */}
                 {Object.keys(ebaSearchStates).length > 0 && (
                   <div className="space-y-3 mt-4 max-h-[55vh] overflow-y-auto">
                     <h4 className="font-medium">EBA Search Results</h4>
                     {Object.entries(ebaSearchStates).map(([employerId, searchState]) => (
                       <Card key={employerId} className="border-blue-200">
                         <CardHeader>
                           <CardTitle className="text-lg">{searchState.employerName}</CardTitle>
                         </CardHeader>
                         <CardContent className="break-words">
                           {searchState.isSearching && (
                             <div className="space-y-2">
                               <div className="flex items-center gap-2">
                                 <img src="/spinner.gif" alt="Loading" className="h-4 w-4" />
                                 <span className="text-sm">Searching FWC database...</span>
                               </div>
                               <div className="flex items-center">
                                 {[1, 2, 3].map((step, idx) => (
                                   <React.Fragment key={idx}>
                                     <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${
                                       step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                     }`}>
                                       {step}
                                     </div>
                                     {idx < 2 && <div className="flex-1 h-0.5 mx-2 bg-gray-200" />}
                                   </React.Fragment>
                                 ))}
                               </div>
                             </div>
                           )}
                           
                           {searchState.error && (
                             <Alert variant="destructive">
                               <AlertTriangle className="h-4 w-4" />
                               <AlertDescription>{searchState.error}</AlertDescription>
                             </Alert>
                           )}
                           
                           {searchState.results.length > 0 && (
                             <div className="space-y-2">
                               <p className="text-sm font-medium text-green-700">
                                 Found {searchState.results.length} potential EBA matches:
                               </p>
                               {(expandedEbaResults.has(employerId)
                                 ? searchState.results
                                 : searchState.results.slice(0, 3)
                               ).map((result, index) => (
                                 <div key={index} className="bg-green-50 p-3 rounded border">
                                   <div className="flex justify-between items-start">
                                     <div className="flex-1">
                                       <p className="font-medium text-sm break-words">{result.title}</p>
                                       <div className="flex flex-wrap gap-2 mt-1">
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
                                         onClick={() => createEbaRecord(employerId, result)}
                                       >
                                         <FileText className="h-4 w-4 mr-1" />
                                         Create EBA Record
                                       </Button>
                                     </div>
                                   </div>
                                 </div>
                               ))}
                               {searchState.results.length > 3 && (
                                <div className="text-center mt-2">
                                  <Button
                                    variant="link"
                                    onClick={() => toggleEbaResultsExpansion(employerId)}
                                  >
                                    {expandedEbaResults.has(employerId)
                                      ? 'Show Less'
                                      : `Show ${searchState.results.length - 3} More Results`}
                                  </Button>
                                </div>
                               )}
                             </div>
                           )}

                            <div className="mt-3 pt-3 border-t flex justify-end">
                              <label htmlFor={`dismiss-import-${employerId}`} className="text-sm text-red-600 flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-red-50">
                                <Checkbox
                                  id={`dismiss-import-${employerId}`}
                                  checked={employersToDismiss.has(employerId)}
                                  onCheckedChange={() => toggleDismissal(employerId)}
                                />
                                Mark for Dismissal (No EBA Found)
                              </label>
                            </div>

                         </CardContent>
                       </Card>
                     ))}
                   </div>
                 )}
               </>
             )}
           </div>
         </DialogContent>
       </Dialog>

       {/* Duplicate Resolution Dialog */}
       <Dialog open={showDuplicateResolution} onOpenChange={setShowDuplicateResolution}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Resolve Duplicate Employers
            </DialogTitle>
            <DialogDescription>
              {Object.keys(duplicateDetections).length} employers have potential duplicates in the database
            </DialogDescription>
          </DialogHeader>
          
          {/* Merge Progress Indicator */}
          {isMergingAllExact && (
            <div className="border-b pb-4 mb-4 bg-blue-50 p-4 rounded">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <img src="/spinner.gif" alt="Loading" className="w-6 h-6" />
                <h3 className="text-lg font-semibold text-blue-800">Merging Duplicate Employers...</h3>
              </div>
              
              {mergeProgress.total > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-gray-700">
                    <span>Processing {mergeProgress.current} of {mergeProgress.total} employers</span>
                    <span>{Math.round((mergeProgress.current / mergeProgress.total) * 100)}%</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                      style={{ width: `${(mergeProgress.current / mergeProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  
                  {mergeProgress.currentEmployer && (
                    <p className="text-sm text-gray-600 text-center">
                      Currently processing: <span className="font-medium">{mergeProgress.currentEmployer}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Bulk Resolution Controls */}
          {Object.values(duplicateDetections).some(d => d.hasExactMatch) && (
            <div className="border-b pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900">
                  Exact Matches ({Object.values(duplicateDetections).filter(d => d.hasExactMatch).length} found)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllExactMatches}
                    disabled={isMergingAllExact}
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearExactMatchSelection}
                    disabled={isMergingAllExact}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    size="sm"
                    onClick={mergeAllSelectedExactMatches}
                    disabled={selectedExactMatches.size === 0 || isMergingAllExact}
                  >
                    {isMergingAllExact ? (
                      <>
                        <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
                        Merging {selectedExactMatches.size}...
                      </>
                    ) : (
                      `Merge ${selectedExactMatches.size} Selected`
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Select exact matches to merge duplicates automatically and use the oldest record as the canonical employer.
              </p>
            </div>
          )}
          {/* Auto-accept create_new for all non-exact matches to reduce per-employer clicks */}
          {Object.values(duplicateDetections).some(d => !d.hasExactMatch) && (
            <div className="border-b pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900">
                  Fast-Track Unmatched Employers
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={autoAcceptCreateNewForUnmatched}>
                    Accept All As New Employers
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                For employers without exact matches, mark them as "Create New" in bulk. You can still review individual items before proceeding.
              </p>
            </div>
          )}
          
          <div className="space-y-4">
            {Object.entries(duplicateDetections).map(([employerId, detection]) => (
              <Card key={employerId} className={`border-amber-200 ${selectedExactMatches.has(employerId) ? 'ring-2 ring-blue-500' : ''}`}>
                <CardHeader className="cursor-pointer" onClick={() => toggleCardExpansion(employerId)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {detection.hasExactMatch && (
                        <input
                          type="checkbox"
                          checked={selectedExactMatches.has(employerId)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleExactMatchSelection(employerId);
                          }}
                          className="w-4 h-4 mt-1"
                          disabled={isMergingAllExact}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        {expandedCards.has(employerId) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{detection.pendingEmployer.company_name}</CardTitle>
                          <CardDescription>
                            Role: {detection.pendingEmployer.csv_role} • 
                            {detection.hasExactMatch ? ' Exact match found' : ` ${detection.similarMatches.length} similar matches`}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {detection.userDecision && (
                        <Badge variant="outline" className="text-xs">
                          {detection.userDecision === 'use_existing' ? '✓ Using Existing' : '✓ Creating New'}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCardExpansion(employerId);
                        }}
                      >
                        {expandedCards.has(employerId) ? 'Collapse' : 'Review Matches'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {expandedCards.has(employerId) && (
                  <CardContent className="space-y-4">
                    
                    {detection.hasExactMatch && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-500" />
                        <h4 className="font-medium text-blue-900">Existing Employer Aliases</h4>
                      </div>
                      {detection.exactMatches.map((match) => {
                        const aliasesForMatch = detection.existingAliases[match.id] ?? [];
                        return (
                          <div key={match.id} className="bg-white rounded border border-blue-100 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-semibold text-blue-900">{match.name}</div>
                                {match.address && (
                                  <div className="text-xs text-blue-700">{match.address}</div>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs">Canonical</Badge>
                            </div>
                            {aliasesForMatch.length > 0 ? (
                              <ul className="space-y-1 text-sm text-blue-900">
                                {aliasesForMatch.map((alias) => (
                                  <li
                                    key={alias.id}
                                    className="flex items-center justify-between gap-3 border border-blue-100 rounded px-2 py-1 bg-blue-50/60"
                                  >
                                    <div className="flex-1">
                                      <span className="font-medium">{alias.alias}</span>
                                      {alias.is_authoritative && (
                                        <span className="ml-2 text-xs uppercase tracking-wide text-blue-600">Authoritative</span>
                                      )}
                                    </div>
                                    <span className="text-[11px] uppercase text-blue-700">
                                      {alias.source_system ?? 'unknown'}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-blue-800">No stored aliases for this employer yet.</p>
                            )}
                          </div>
                        );
                      })}

                      {detection.conflictingAliases.length > 0 && (
                        <div className="border border-amber-300 bg-amber-50 rounded p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <h5 className="font-medium text-amber-800">Conflicting alias claims</h5>
                          </div>
                          <p className="text-xs text-amber-700">
                            The intake name already exists as an alias for other employers. Review before promoting or merging.
                          </p>
                          <ul className="space-y-1 text-sm text-amber-900">
                            {detection.conflictingAliases.map((alias) => (
                              <li key={alias.id} className="border border-amber-200 rounded px-2 py-1 bg-white flex justify-between">
                                <span>
                                  <span className="font-medium">{alias.alias}</span>
                                  <span className="ml-2 text-xs text-amber-700">
                                    {alias.employerName ?? 'Unknown employer'}
                                  </span>
                                </span>
                                <span className="text-[11px] uppercase text-amber-600">
                                  {alias.source_system ?? 'unknown source'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    )}

                    {detection.hasExactMatch && (
                    <div className="bg-red-50 p-4 rounded border border-red-200 space-y-3">
                      <div>
                        <h4 className="font-medium text-red-800 mb-2">Alias & Canonical Decision</h4>
                        <p className="text-sm text-red-700 mb-3">
                          Review how the intake name <span className="font-semibold">"{detection.pendingEmployer.company_name}"</span> should be treated for the selected employer.
                        </p>
                        <RadioGroup
                          value={detection.aliasDecision ?? 'keep_alias'}
                          onValueChange={(value) =>
                            setDuplicateDetections((prev) => ({
                              ...prev,
                              [employerId]: {
                                ...prev[employerId],
                                aliasDecision: value as AliasDecision,
                              },
                            }))
                          }
                          className="space-y-2"
                        >
                          <label className="flex items-start gap-3 rounded border p-3 cursor-pointer hover:bg-white">
                            <RadioGroupItem value="keep_alias" className="mt-1" />
                            <div>
                              <div className="font-medium">Keep Intake Name as Alias</div>
                              <p className="text-sm text-muted-foreground">
                                Store the intake name as an alias on the matched employer without changing the canonical name.
                              </p>
                            </div>
                          </label>
                          <label className="flex items-start gap-3 rounded border p-3 cursor-pointer hover:bg-white">
                            <RadioGroupItem value="promote_canonical" className="mt-1" />
                            <div>
                              <div className="font-medium">Promote to Canonical Name</div>
                              <p className="text-sm text-muted-foreground">
                                Update the employer's canonical name to match the intake name once review is complete.
                              </p>
                            </div>
                          </label>
                          <label className="flex items-start gap-3 rounded border p-3 cursor-pointer hover:bg-white">
                            <RadioGroupItem value="merge_alias" className="mt-1" />
                            <div>
                              <div className="font-medium">Merge with Existing Alias</div>
                              <p className="text-sm text-muted-foreground">
                                Link this intake name with an existing alias and review duplicates before finalising import.
                              </p>
                            </div>
                          </label>
                        </RadioGroup>
                        {detection.aliasDecision === 'merge_alias' && detection.conflictingAliases.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <Label className="text-xs font-medium text-red-800 uppercase">Choose existing alias to merge into</Label>
                            <Select
                              value={detection.mergeTargetAliasId}
                              onValueChange={(value) => handleAliasMergeTargetChange(employerId, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select alias" />
                              </SelectTrigger>
                              <SelectContent>
                                {detection.conflictingAliases.map((alias) => (
                                  <SelectItem key={alias.id} value={alias.id}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{alias.alias}</span>
                                      {alias.employerName && (
                                        <span className="text-xs text-muted-foreground">{alias.employerName}</span>
                                      )}
                                      <span className="text-xs text-muted-foreground uppercase">
                                        {alias.source_system ?? 'unknown source'}{alias.is_authoritative ? ' • authoritative' : ''}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <Textarea
                          placeholder="Notes, context, or follow-up actions"
                          value={detection.aliasNotes ?? ''}
                          onChange={(event) =>
                            setDuplicateDetections((prev) => ({
                              ...prev,
                              [employerId]: {
                                ...prev[employerId],
                                aliasNotes: event.target.value,
                              },
                            }))
                          }
                          className="min-h-[80px] mt-3"
                        />
                      </div>
                      {/* Placeholder for future alias metrics or telemetry summaries */}
                      <div className="rounded border border-dashed border-red-200 bg-red-50/60 p-3 text-xs text-red-600">
                        Alias telemetry notes placeholder
                      </div>
                    </div>
                    )}
                    
                    {detection.hasSimilarMatches && !detection.hasExactMatch && (
                      <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                        <h4 className="font-medium text-yellow-800 mb-2">Similar Employers Found</h4>
                        <p className="text-sm text-yellow-700 mb-3">
                          Consider using an existing employer to avoid duplicates:
                        </p>
                        {detection.similarMatches.slice(0, 5).map((match) => (
                          <div key={match.id} className="flex items-center justify-between bg-white p-3 rounded border mb-2">
                            <div>
                              <p className="font-medium">{match.name}</p>
                              <p className="text-sm text-gray-600">{match.address}</p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {Math.round(match.similarity * 100)}% similar
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant={detection.userDecision === 'use_existing' && detection.selectedEmployerId === match.id ? 'default' : 'outline'}
                              onClick={() => updateDuplicateDecision(employerId, 'use_existing', match.id)}
                            >
                              {detection.userDecision === 'use_existing' && detection.selectedEmployerId === match.id 
                                ? '✓ Selected' : 'Use This'}
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          onClick={() => updateDuplicateDecision(employerId, 'create_new')}
                          className={detection.userDecision === 'create_new' ? 'bg-yellow-100' : ''}
                        >
                          {detection.userDecision === 'create_new' ? '✓ Create New' : 'Create New Employer'}
                        </Button>
                      </div>
                      )}
                      
                    </CardContent>
                )}
              </Card>
            ))}
            
            <div className="sticky bottom-0 z-10 bg-white py-4 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={cancelImport}
                disabled={isImporting || isMergingAllExact}
              >
                Cancel Import
              </Button>
              <Button
                onClick={async () => {
                  try {
                    console.log('Starting import with resolved duplicates...');
                    console.log('Duplicate decisions:', Object.fromEntries(
                      Object.entries(duplicateDetections).map(([k, v]) => [k, {
                        decision: v.userDecision,
                        selectedEmployerId: v.selectedEmployerId,
                        pendingEmployer: v.pendingEmployer.company_name
                      }])
                    ));
                    await performDirectImport();
                  } catch (error) {
                    console.error('Import failed:', error);
                  }
                }}
                disabled={Object.values(duplicateDetections).some(d => !d.userDecision)}
              >
                Proceed with Import ({Object.values(duplicateDetections).filter(d => d.userDecision).length}/{Object.keys(duplicateDetections).length} resolved)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      <EbaEmployerMatchDialog
        open={manualMatchDialog.open}
        onOpenChange={(open) => setManualMatchDialog({ ...manualMatchDialog, open })}
        pendingEmployerName={manualMatchDialog.pendingEmployerName}
        pendingEmployerId={manualMatchDialog.pendingEmployerId || ''}
        onSelectMatch={handleManualMatchSelect}
        onCreateNew={handleManualMatchCreateNew}
        onSkip={handleManualMatchSkip}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmDialog.open} onOpenChange={(open) => setDeleteConfirmDialog({ ...deleteConfirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pending Employer</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>"{deleteConfirmDialog.employerName}"</strong> from the pending import list?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmDialog({ open: false, employerId: null, employerName: '' })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletePendingEmployer}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

