'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, Building2, Trash2, Eye, EyeOff, Wrench, AlertTriangle, Search, FileText, ExternalLink } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getTradeTypeLabel, TradeType, getTradeTypeCategories } from '@/utils/bciTradeTypeInference';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
    
    // EBA search states
    const [showEbaSearch, setShowEbaSearch] = useState(false);
    const [ebaSearchStates, setEbaSearchStates] = useState<Record<string, EbaSearchState>>({});
    const [isEbaSearching, setIsEbaSearching] = useState(false);

  // Load pending employers on mount
  useEffect(() => {
    loadPendingEmployers();
  }, []);

  const loadPendingEmployers = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('pending_employers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingEmployers(data || []);
      // Select all by default
      setSelectedEmployers(new Set(data?.map(emp => emp.id) || []));
    } catch (error) {
      console.error('Error loading pending employers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createEmployer = async (pendingEmployer: PendingEmployer): Promise<string> => {
    const supabase = getSupabaseBrowserClient();
    const raw = pendingEmployer.raw;
    
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
    const results: ImportResults = {
      success: 0,
              errors: [],
        employersCreated: [],
        duplicatesResolved: 0,
        relationshipsCreated: 0,
        ebaSearchesCompleted: 0,
        ebaRecordsCreated: 0
    };

    const employersToImport = pendingEmployers.filter(emp => selectedEmployers.has(emp.id));

    for (const pendingEmployer of employersToImport) {
      try {
        const employerId = await createEmployer(pendingEmployer);
        results.success++;
        results.employersCreated.push(pendingEmployer.company_name);
        
        // Track if this was a duplicate resolution
        const detection = duplicateDetections[pendingEmployer.id];
        if (detection?.userDecision === 'use_existing') {
          results.duplicatesResolved++;
        }

        // Enhanced project linking with duplicate prevention
        if (projectLinkingMode === 'with_projects' && pendingEmployer.project_associations) {
          const supabase = getSupabaseBrowserClient();
          
          for (const projectAssoc of pendingEmployer.project_associations) {
            try {
              // Find the project by BCI ID or regular ID
              const { data: project } = await supabase
                .from('projects')
                .select('id, name, builder_id')
                .or(`id.eq.${projectAssoc.project_id},bci_project_id.eq.${projectAssoc.project_id}`)
                .maybeSingle();

              if (project) {
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
                  }
                }
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
    setShowDuplicateResolution(false);
    
    // Reload the list
    await loadPendingEmployers();
    setSelectedEmployers(new Set());
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
    try {
      const detections = await detectDuplicatesForImport();
      setDuplicateDetections(detections);
      
      if (Object.keys(detections).length > 0) {
        setShowDuplicateResolution(true);
      } else {
        // No duplicates, proceed directly to import
        await performDirectImport();
      }
      
    } catch (error) {
      console.error('Error detecting duplicates:', error);
      // Proceed with import anyway
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

  // EBA Search Functions
  const searchEbaForEmployers = async (employerIds: string[]) => {
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
  };

  const createEbaRecord = async (employerId: string, result: FWCSearchResult) => {
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
        <h2 className="text-xl font-semibold">Detecting Duplicates...</h2>
        <p className="text-gray-600">Checking for existing employers in database</p>
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
              disabled={isEbaSearching || importResults.employersCreated.length === 0}
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
              loadPendingEmployers();
            }}>
              Import More Employers
            </Button>
          </div>
          {importResults.employersCreated.length > 0 && (
            <p className="text-sm text-gray-600">
              Search FWC database for Enterprise Bargaining Agreements for the newly imported employers
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
      </div>

      {pendingEmployers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Pending Employers</h3>
            <p className="text-gray-600">
              No employers are currently queued for import. Use the BCI Projects import 
              and select "Add to Import List" to queue employers for batch import.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {pendingEmployers.length} Pending Employers
              </CardTitle>
              <CardDescription>
                Review and import employers queued from previous data uploads
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
                        />
                        <div>
                          <h4 className="font-medium">{employer.company_name}</h4>
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
            </CardContent>
          </Card>

          <div className="flex justify-center">
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
          </div>
        </>
      )}
      
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
             {!importResults || (importResults as ImportResults).employersCreated.length === 0 ? (
               <Alert>
                 <Info className="h-4 w-4" />
                 <AlertDescription>
                   No new employers were imported. EBA search is only available for newly imported employers.
                 </AlertDescription>
               </Alert>
             ) : (
               <>
                 <Alert>
                   <Info className="h-4 w-4" />
                   <AlertDescription>
                     This will search the Fair Work Commission database for Enterprise Bargaining Agreements 
                     for the {(importResults as ImportResults)?.employersCreated?.length || 0} newly imported employers.
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
                       // Get the employer IDs of newly imported employers
                       const supabase = getSupabaseBrowserClient();
                       const { data: employers } = await supabase
                         .from('employers')
                         .select('id')
                         .in('name', (importResults as ImportResults)?.employersCreated || []);
                       
                       if (employers) {
                         await searchEbaForEmployers(employers.map(e => e.id));
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
                 </div>
                 
                 {/* Display EBA Search Results */}
                 {Object.keys(ebaSearchStates).length > 0 && (
                   <div className="space-y-3 mt-4">
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
                                 <p className="text-sm text-gray-600">
                                   ...and {searchState.results.length - 3} more results
                                 </p>
                               )}
                             </div>
                           )}
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
          
          <div className="space-y-4">
            {Object.entries(duplicateDetections).map(([employerId, detection]) => (
              <Card key={employerId} className="border-amber-200">
                <CardHeader>
                  <CardTitle className="text-lg">{detection.pendingEmployer.company_name}</CardTitle>
                  <CardDescription>
                    Role: {detection.pendingEmployer.csv_role} • 
                    {detection.hasExactMatch ? ' Exact match found' : ` ${detection.similarMatches.length} similar matches`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {detection.hasExactMatch && (
                    <div className="bg-red-50 p-4 rounded border border-red-200">
                      <h4 className="font-medium text-red-800 mb-2">Exact Match Found</h4>
                      <p className="text-sm text-red-700 mb-3">
                        An employer with this exact name already exists. Choose how to proceed:
                      </p>
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
                onClick={() => performDirectImport()}
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
