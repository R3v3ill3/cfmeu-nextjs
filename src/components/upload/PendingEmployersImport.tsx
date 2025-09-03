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

interface PendingEmployer {
  id: string;
  company_name: string;
  csv_role: string;
  source: string;
  raw: any;
  created_at: string;
  inferred_trade_type?: string;
  our_role?: 'builder' | 'head_contractor' | 'subcontractor';
  project_associations?: Array<{
    project_id: string;
    project_name: string;
    csv_role: string;
  }>;
  user_confirmed_trade_type?: string;
  import_status?: string;
  imported_employer_id?: string;
  import_notes?: string;
}

interface ImportResults {
  success: number;
  errors: string[];
  employersCreated: string[];
  processedEmployers: Array<{id: string, name: string}>; // Track all processed employers for EBA search
      duplicatesResolved: number;
    relationshipsCreated: number;
    ebaSearchesCompleted: number;
    ebaRecordsCreated: number;
  }

interface DuplicateDetection {
  pendingEmployer: PendingEmployer;
  exactMatches: Array<{id: string, name: string, address: string}>;
  similarMatches: Array<{id: string, name: string, address: string, similarity: number}>;
  hasExactMatch: boolean;
  hasSimilarMatches: boolean;
  userDecision?: 'use_existing' | 'create_new';
  selectedEmployerId?: string;
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
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    
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
    
    const { toast } = useToast();

  // Load pending employers on mount and when filter changes
  useEffect(() => {
    loadPendingEmployers();
  }, [showProcessedEmployers]);

  const loadPendingEmployers = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      let query = supabase
        .from('pending_employers')
        .select('*');
      
      if (!showProcessedEmployers) {
        // Only load employers that haven't been processed
        query = query.is('import_status', null);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      const statusText = showProcessedEmployers ? 'all' : 'unprocessed';
      console.log(`Loaded ${(data || []).length} ${statusText} pending employers`);
      
      setPendingEmployers(data || []);
      // Select all unprocessed employers by default, but don't auto-select processed ones
      if (showProcessedEmployers) {
        const unprocessed = (data || []).filter(emp => !emp.import_status);
        setSelectedEmployers(new Set(unprocessed.map(emp => emp.id)));
      } else {
        setSelectedEmployers(new Set(data?.map(emp => emp.id) || []));
      }
    } catch (error) {
      console.error('Error loading pending employers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createEmployer = async (pendingEmployer: PendingEmployer): Promise<string> => {
    const supabase = getSupabaseBrowserClient();
    const raw = pendingEmployer.raw;
    
    console.log(`Processing employer: ${pendingEmployer.company_name}`);
    
    // Check if user made a decision about duplicates
    const detection = duplicateDetections[pendingEmployer.id];
    if (detection?.userDecision === 'use_existing' && detection.selectedEmployerId) {
      console.log(`✓ Using selected existing employer for ${pendingEmployer.company_name}: ${detection.selectedEmployerId}`);
      
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
      
      await supabase
        .from('pending_employers')
        .update({
          import_status: 'imported',
          imported_employer_id: detection.selectedEmployerId,
          import_notes: `Used existing employer (user selected from duplicates)`
        })
        .eq('id', pendingEmployer.id);
      
      return detection.selectedEmployerId;
    }
    
    // Step 1: Check for exact name match
    const { data: exactMatch } = await supabase
      .from('employers')
      .select('id, name, address_line_1, suburb, state')
      .eq('name', pendingEmployer.company_name)
      .maybeSingle();
    
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
      await supabase
        .from('pending_employers')
        .update({
          import_status: 'imported',
          imported_employer_id: exactMatch.id,
          import_notes: `Used existing employer (duplicate prevention)`
        })
        .eq('id', pendingEmployer.id);
      
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
    const { data: employerData, error: employerError } = await supabase
      .from('employers')
      .insert({
        name: pendingEmployer.company_name,
        address_line_1: raw.companyStreet,
        suburb: raw.companyTown,
        state: raw.companyState,
        postcode: raw.companyPostcode,
        phone: raw.companyPhone,
        email: raw.companyEmail,
        primary_contact_name: `${raw.contactFirstName || ''} ${raw.contactSurname || ''}`.trim(),
        employer_type: 'large_contractor'
      })
      .select('id')
      .single();
    
    if (employerError) throw employerError;
    
    const employerId = employerData.id;
    console.log(`✓ Created new employer: ${pendingEmployer.company_name} (${employerId})`);
    
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
    await supabase
      .from('pending_employers')
      .update({
        import_status: 'imported',
        imported_employer_id: employerId,
        import_notes: `Successfully imported as ${pendingEmployer.our_role || 'employer'}`
      })
      .eq('id', pendingEmployer.id);
    
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
    const results: ImportResults = {
      success: 0,
              errors: [],
        employersCreated: [],
        processedEmployers: [],
        duplicatesResolved: 0,
        relationshipsCreated: 0,
        ebaSearchesCompleted: 0,
        ebaRecordsCreated: 0
    };

    const employersToImport = pendingEmployers.filter(emp => selectedEmployers.has(emp.id));
    setImportProgress({ current: 0, total: employersToImport.length, currentEmployer: '' });

    for (let i = 0; i < employersToImport.length; i++) {
      const pendingEmployer = employersToImport[i];
      setImportProgress(prev => ({ ...prev, current: i + 1, currentEmployer: pendingEmployer.company_name }));
      try {
        const employerId = await createEmployer(pendingEmployer);
        results.success++;
        results.employersCreated.push(pendingEmployer.company_name);
        
        // Track all processed employers for EBA search (both new and existing)
        results.processedEmployers.push({
          id: employerId,
          name: pendingEmployer.company_name
        });
        
        // Track if this was a duplicate resolution
        const detection = duplicateDetections[pendingEmployer.id];
        if (detection?.userDecision === 'use_existing') {
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
                  if (project.builder_id) {
                    if (project.builder_id === employerId) {
                      console.log(`✓ Builder already assigned to ${project.name}`);
                    } else {
                      console.warn(`⚠ Project ${project.name} already has a different builder assigned`);
                    }
                  } else {
                    await supabase
                      .from('projects')
                      .update({ builder_id: employerId })
                      .eq('id', project.id);
                    console.log(`✓ Assigned builder to ${project.name}`);
                    relationshipCreated = true;
                  }
                  
                } else if (pendingEmployer.our_role === 'head_contractor') {
                  // Check for existing head contractor role
                  const { data: existingRole } = await supabase
                    .from('project_employer_roles')
                    .select('id')
                    .eq('project_id', project.id)
                    .eq('employer_id', employerId)
                    .eq('role', 'head_contractor')
                    .maybeSingle();
                  
                  if (existingRole) {
                    console.log(`✓ Head contractor relationship already exists for ${project.name}`);
                  } else {
                    await supabase
                      .from('project_employer_roles')
                      .insert({
                        project_id: project.id,
                        employer_id: employerId,
                        role: 'head_contractor'
                      });
                    console.log(`✓ Created head contractor role for ${project.name}`);
                    relationshipCreated = true;
                  }
                  
                } else if (pendingEmployer.our_role === 'subcontractor') {
                  const finalTradeType = getEffectiveTradeType(pendingEmployer);
                  
                  // Check for existing trade relationship
                  const { data: existingTrade } = await supabase
                    .from('project_contractor_trades')
                    .select('id, trade_type')
                    .eq('project_id', project.id)
                    .eq('employer_id', employerId)
                    .maybeSingle();
                  
                  if (existingTrade) {
                    if (existingTrade.trade_type === finalTradeType) {
                      console.log(`✓ Trade relationship already exists for ${project.name}: ${finalTradeType}`);
                    } else {
                      console.warn(`⚠ Trade type mismatch for ${project.name}. Existing: ${existingTrade.trade_type}, New: ${finalTradeType}`);
                    }
                  } else {
                    await supabase
                      .from('project_contractor_trades')
                      .insert({
                        project_id: project.id,
                        employer_id: employerId,
                        trade_type: finalTradeType
                      });
                    console.log(`✓ Created trade relationship for ${project.name}: ${finalTradeType}`);
                    relationshipCreated = true;
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
    setWorkflowStep('complete');
    setShowDuplicateResolution(false);
    
    // Reload the list
    await loadPendingEmployers();
    setSelectedEmployers(new Set());
    setImportProgress({ current: 0, total: 0, currentEmployer: '' });
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
      // Check for exact matches
      const { data: exactMatches } = await supabase
        .from('employers')
        .select('id, name, address_line_1, suburb, state')
        .eq('name', pendingEmployer.company_name);
      
      // Check for similar matches (only if no exact match)
      let similarMatches: any[] = [];
      if (!exactMatches || exactMatches.length === 0) {
        const { data } = await supabase
          .from('employers')
          .select('id, name, address_line_1, suburb, state')
          .ilike('name', `%${pendingEmployer.company_name}%`)
          .neq('name', pendingEmployer.company_name)
          .limit(10);
        similarMatches = data || [];
      }
      
      const hasExactMatch = Boolean(exactMatches && exactMatches.length > 0);
      const hasSimilarMatches = Boolean(similarMatches.length > 0);
      
      if (hasExactMatch || hasSimilarMatches) {
        detections[pendingEmployer.id] = {
          pendingEmployer,
          exactMatches: (exactMatches || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            address: `${m.address_line_1 || ''} ${m.suburb || ''} ${m.state || ''}`.trim()
          })),
          similarMatches: similarMatches.map((m: any) => ({
            id: m.id,
            name: m.name,
            address: `${m.address_line_1 || ''} ${m.suburb || ''} ${m.state || ''}`.trim(),
            similarity: calculateSimilarity(pendingEmployer.company_name, m.name)
          })).sort((a, b) => b.similarity - a.similarity),
          hasExactMatch,
          hasSimilarMatches
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
          // Fall back: still resolve to primary so user can proceed
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
    const supabase = getSupabaseBrowserClient();
    let mergedCount = 0;
    
    try {
      for (const employerId of selectedExactMatches) {
        const detection = duplicateDetections[employerId];
        if (!detection?.hasExactMatch || !detection.exactMatches?.length) continue;
        
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
      
      // Refresh duplicate detections to show updated state
      console.log(`Successfully merged ${mergedCount} employer groups`);
      
      // Re-run duplicate detection to update the UI state
      setTimeout(async () => {
        const refreshedDetections = await detectDuplicatesForImport();
        setDuplicateDetections(refreshedDetections);
      }, 1000);
      
    } catch (error) {
      console.error('Error during bulk merge:', error);
      // Don't clear selection on error so user can retry
    } finally {
      setIsMergingAllExact(false);
    }
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
              <p className="text-sm text-gray-600">Duplicates Resolved</p>
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
        <div className="flex items-center justify-center space-x-4 mt-4 mb-6">
          <div className={`flex items-center space-x-2 ${workflowStep === 'review' ? 'text-blue-600' : workflowStep === 'merge' || workflowStep === 'import' || workflowStep === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${workflowStep === 'review' ? 'bg-blue-100 text-blue-600' : workflowStep === 'merge' || workflowStep === 'import' || workflowStep === 'complete' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
              1
            </div>
            <span className="text-sm font-medium">Review & Select</span>
          </div>
          
          <div className={`w-8 h-0.5 ${workflowStep === 'merge' || workflowStep === 'import' || workflowStep === 'complete' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
          
          <div className={`flex items-center space-x-2 ${workflowStep === 'merge' ? 'text-blue-600' : workflowStep === 'import' || workflowStep === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${workflowStep === 'merge' ? 'bg-blue-100 text-blue-600' : workflowStep === 'import' || workflowStep === 'complete' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
              2
            </div>
            <span className="text-sm font-medium">Merge Duplicates</span>
          </div>
          
          <div className={`w-8 h-0.5 ${workflowStep === 'import' || workflowStep === 'complete' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
          
          <div className={`flex items-center space-x-2 ${workflowStep === 'import' ? 'text-blue-600' : workflowStep === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${workflowStep === 'import' ? 'bg-blue-100 text-blue-600' : workflowStep === 'complete' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
              3
            </div>
            <span className="text-sm font-medium">Import</span>
          </div>
        </div>
      </div>

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
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>
                    Select None
                  </Button>
                  <div className="text-sm text-gray-600 flex items-center ml-auto">
                    {selectedEmployers.size} of {pendingEmployers.length} selected
                  </div>
                </div>

                <div className="flex gap-4 p-3 bg-blue-50 rounded border border-blue-200">
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

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pendingEmployers.map((employer) => (
                  <div key={employer.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedEmployers.has(employer.id)}
                          onChange={() => toggleSelection(employer.id)}
                          className="w-4 h-4"
                          disabled={!!employer.import_status} // Disable selection for processed employers
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
                      <div className="flex items-center gap-2">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePendingEmployer(employer.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                        employersCreated: importedEmployers.map(emp => emp.company_name),
                        processedEmployers: processedEmployers,
                        duplicatesResolved: 0,
                        relationshipsCreated: 0,
                        ebaSearchesCompleted: 0,
                        ebaRecordsCreated: 0
                      });
                      setShowEbaSearch(true);
                    }}
                    disabled={isEbaSearching}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Search EBAs for Imported Employers
                  </Button>
                )}
                
                {/* Regular import button - only show for unprocessed employers */}
                {selectedEmployers.size > 0 && pendingEmployers.some(emp => selectedEmployers.has(emp.id) && !emp.import_status) && (
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
             {/* EBA Search Dialog */}
       <Dialog open={showEbaSearch} onOpenChange={setShowEbaSearch}>
         <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Search className="h-5 w-5 text-blue-500" />
               Search for Enterprise Bargaining Agreements
             </DialogTitle>
             <DialogDescription>
               Search FWC database for EBAs for newly imported employers
             </DialogDescription>
           </DialogHeader>
           
           <div className="space-y-4">
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
                   <div className="space-y-3 mt-4 max-h-[50vh] overflow-y-auto">
                     <h4 className="font-medium">EBA Search Results</h4>
                     {Object.entries(ebaSearchStates).map(([employerId, searchState]) => (
                       <Card key={employerId} className="border-blue-200">
                         <CardHeader>
                           <CardTitle className="text-lg">{searchState.employerName}</CardTitle>
                         </CardHeader>
                         <CardContent>
                           {searchState.isSearching && (
                             <div className="flex items-center gap-2">
                               <img src="/spinner.gif" alt="Loading" className="h-4 w-4" />
                               <span className="text-sm">Searching FWC database...</span>
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
          
          {/* Select All Controls for Exact Matches */}
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
                    <div className="bg-red-50 p-4 rounded border border-red-200">
                      <h4 className="font-medium text-red-800 mb-2">Exact Match Found</h4>
                      <p className="text-sm text-red-700 mb-3">
                        An employer with this exact name already exists. Choose how to proceed:
                      </p>
                      {/* Merge all exact matches into a single employer (oldest record as primary) */}
                      {detection.exactMatches.length > 1 && (
                        <div className="flex items-center justify-between p-3 mb-2 rounded border bg-white">
                          <div className="text-sm text-gray-700">
                            Merge {detection.exactMatches.length} exact matches into one employer
                          </div>
                          <Button
                            size="sm"
                            onClick={() => mergeExactMatchesFor(employerId)}
                            disabled={Boolean(isMergingExact[employerId])}
                          >
                            {isMergingExact[employerId] ? 'Merging...' : 'Merge Exact Matches'}
                          </Button>
                        </div>
                      )}
                      {detection.exactMatches.map((match) => (
                        <div key={match.id} className="flex items-center justify-between bg-white p-3 rounded border mb-2">
                          <div>
                            <p className="font-medium">{match.name}</p>
                            <p className="text-sm text-gray-600">{match.address}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={detection.userDecision === 'use_existing' && detection.selectedEmployerId === match.id ? 'default' : 'outline'}
                            onClick={() => updateDuplicateDecision(employerId, 'use_existing', match.id)}
                          >
                            {detection.userDecision === 'use_existing' && detection.selectedEmployerId === match.id 
                              ? '✓ Selected' : 'Use This Employer'}
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateDuplicateDecision(employerId, 'create_new')}
                        className={detection.userDecision === 'create_new' ? 'bg-amber-100' : ''}
                      >
                        {detection.userDecision === 'create_new' ? '✓ Create New Anyway' : 'Create New Anyway'}
                      </Button>
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
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowDuplicateResolution(false)}
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
    </div>
  );
}

