'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, Users, Building2, Wrench, MapPin, Search, Plus } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { inferTradeTypeFromCompanyName, inferTradeTypeFromCsvRole, getTradeTypeLabel, TradeType, getTradeTypeCategories } from '@/utils/bciTradeTypeInference';
import { findBestEmployerMatch, normalizeCompanyName } from '@/utils/workerDataProcessor';
import { mapBciStageToStageClass, defaultOrganisingUniverseFor } from '@/utils/stageClassification';

// Enhanced types for BCI CSV data
interface BCICsvRow {
  projectId: string;
  projectType: string;
  projectName: string;
  projectStage: string;
  projectStatus: string;
  localValue: string;
  developmentType: string;
  floorArea: string;
  siteArea: string;
  storeys: string;
  lastUpdate: string;
  constructionStartDate: string;
  constructionEndDate: string;
  projectAddress: string;
  projectTown: string;
  projectState: string;
  postCode: string;
  projectCountry: string;
  roleOnProject: string;
  companyName: string;
  companyStreet: string;
  companyTown: string;
  companyState: string;
  companyPostcode: string;
  companyCountry: string;
  companyPhone: string;
  companyEmail: string;
  contactFirstName: string;
  contactSurname: string;
  contactPosition: string;
  contactLandline: string;
  contactEmail: string;
  contactRemark: string;
  latitude?: string;
  longitude?: string;
}

interface CompanyClassification {
  companyName: string;
  csvRole: string;
  ourRole: 'builder' | 'head_contractor' | 'subcontractor' | 'skip';
  tradeType?: TradeType;
  employerId?: string;
  shouldImport: boolean;
  confidence?: 'exact' | 'fuzzy' | 'none';
  suggestedMatches?: Array<{id: string, name: string, address: string}>;
  userConfirmed: boolean;
  userExcluded: boolean;
}

interface EmployerMatchResult {
  companyName: string;
  csvRole: string;
  matchedEmployerId?: string;
  matchedEmployerName?: string;
  confidence: 'exact' | 'fuzzy' | 'none';
  numericConfidence?: number;
  suggestedMatches: Array<{id: string, name: string, address: string}>;
  action: 'confirm_match' | 'search_manual' | 'create_new' | 'add_to_list' | 'skip';
  userConfirmed: boolean;
  tradeTypeConfirmed: boolean;
  finalTradeType?: TradeType;
}

interface BCIProjectData {
  projectId: string;
  projectName: string;
  localValue: number;
  constructionStartDate: string | null;
  constructionEndDate: string | null;
  projectStage: string;
  projectStatus: string;
  lastUpdateDate: string | null;
  projectAddress: string;
  projectTown: string;
  projectState: string;
  postCode: string;
  latitude?: number;
  longitude?: number;
  companies: CompanyClassification[];
}

type BCIImportMode = 'projects-and-employers' | 'projects-only' | 'employers-to-existing';

interface BCIProjectImportProps {
  csvData: BCICsvRow[];
  onImportComplete: () => void;
  mode?: BCIImportMode;
}

export default function BCIProjectImport({ csvData, onImportComplete, mode = 'projects-and-employers' }: BCIProjectImportProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'preview' | 'employer_matching' | 'trade_type_confirmation' | 'importing' | 'complete'>('preview');
  const [processedData, setProcessedData] = useState<BCIProjectData[]>([]);
  const [employerMatches, setEmployerMatches] = useState<Record<string, EmployerMatchResult>>({});
  const [importResults, setImportResults] = useState<{
    success: number;
    errors: string[];
    projectsCreated: string[];
    employersCreated: number;
    employersMatched: number;
  }>({ success: 0, errors: [], projectsCreated: [], employersCreated: 0, employersMatched: 0 });
  const [allEmployers, setAllEmployers] = useState<Array<{ id: string; name: string }>>([]);
  
  // Loading states for employer matching
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [matchingProgress, setMatchingProgress] = useState(0);
  const [totalCompanies, setTotalCompanies] = useState(0);
  
  // Manual search states
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [searchingForCompany, setSearchingForCompany] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{id: string, name: string, address: string}>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSearchMatchKey, setCurrentSearchMatchKey] = useState<string>('');
  
  // Employers to be added later
  const [employersToAdd, setEmployersToAdd] = useState<Array<{
    companyName: string;
    csvRole: string;
    companyData: any;
    matchKey: string;
  }>>([]);

  // Enhanced CSV processing with latitude/longitude
  const processCSVData = useCallback(() => {
    const projectMap = new Map<string, BCIProjectData>();

    csvData.forEach(row => {
      if (!projectMap.has(row.projectId)) {
        projectMap.set(row.projectId, {
          projectId: row.projectId,
          projectName: row.projectName && String(row.projectName).trim() !== '' ? row.projectName : `Project ${row.projectId}`,
          localValue: parseFloat(row.localValue.replace(/[^0-9.-]+/g, '')) || 0,
          constructionStartDate: parseDate(row.constructionStartDate),
          constructionEndDate: parseDate(row.constructionEndDate),
          projectStage: row.projectStage,
          projectStatus: row.projectStatus,
          lastUpdateDate: parseDate(row.lastUpdate),
          projectAddress: row.projectAddress,
          projectTown: row.projectTown,
          projectState: row.projectState,
          postCode: row.postCode,
          latitude: row.latitude ? parseFloat(row.latitude) : undefined,
          longitude: row.longitude ? parseFloat(row.longitude) : undefined,
          companies: []
        });
      }

      const project = projectMap.get(row.projectId)!;
      const classification = classifyCompany(row.roleOnProject, row.companyName);
      
      if (classification.shouldImport) {
        project.companies.push(classification);
      }
    });

    return Array.from(projectMap.values());
  }, [csvData]);

  // Initialize processed projects for preview/editing
  useEffect(() => {
    try {
      const processed = processCSVData();
      setProcessedData(processed);
    } catch (e) {
      // noop
    }
  }, [processCSVData]);

  // Auto-run for projects-only mode once data is ready
  useEffect(() => {
    if (mode === 'projects-only' && processedData && processedData.length > 0 && currentStep === 'preview' && !isProcessing) {
      // Kick off import automatically for smoother UX
      startImport();
    }
  }, [mode, processedData, currentStep, isProcessing]);

  // Enhanced company classification - prefer CSV Role, then fallback to name
  const classifyCompany = (csvRole: string, companyName: string): CompanyClassification => {
    const role = (csvRole || '').toLowerCase().trim();
    const name = (companyName || '').toLowerCase().trim();
    // Skip if company name is missing
    if (!companyName || companyName.trim() === '') {
      return {
        companyName,
        csvRole,
        ourRole: 'skip',
        shouldImport: false,
        userConfirmed: false,
        userExcluded: false
      };
    }
    
    // Skip non-construction companies
    if (role.includes('design') || role.includes('engineer') || 
        role.includes('consultant') || role.includes('assessment') ||
        role.includes('acoustic') || role.includes('fire') ||
        role.includes('environmental') || role.includes('planning')) {
      return {
        companyName,
        csvRole,
        ourRole: 'skip',
        shouldImport: false,
        userConfirmed: false,
        userExcluded: false
      };
    }
    
    // Head contractor mapping from CSV role (e.g., Project Manager, Project Coordinator, Head Contractor)
    if (role.includes('project manager') || role.includes('project coordinator') || role.includes('head contractor') || role.includes('principal contractor')) {
      return { 
        companyName, 
        csvRole, 
        ourRole: 'head_contractor', 
        shouldImport: true,
        userConfirmed: false,
        userExcluded: false
      };
    }

    // Builder - include Owner/Developer synonyms as Builder
    if (
      role.includes('builder') ||
      role.includes('owner') ||
      role.includes('developer') ||
      role.includes('principal') && role.includes('client')
    ) {
      return { 
        companyName, 
        csvRole, 
        ourRole: 'builder', 
        shouldImport: true,
        userConfirmed: false,
        userExcluded: false
      };
    }
    
    // Subcontractors (prefer CSV Role to infer trade)
    if (role.includes('subcontractor') || role.includes('sub-contractor') || role.includes('sub contractor')) {
      const prefillTrade = inferTradeTypeFromCsvRole(csvRole) ?? undefined;

      return { 
        companyName, 
        csvRole, 
        ourRole: 'subcontractor', 
        shouldImport: true,
        tradeType: prefillTrade ?? inferTradeTypeFromCompanyName(companyName),
        userConfirmed: false,
        userExcluded: false
      };
    }
    
    // Fallback rules (contractors) - prioritise CSV role inference for trade type
    if (role.includes('contractor')) {
      const csvTrade = inferTradeTypeFromCsvRole(csvRole);
      return {
        companyName,
        csvRole,
        ourRole: 'subcontractor',
        shouldImport: true,
        tradeType: csvTrade ?? inferTradeTypeFromCompanyName(companyName),
        userConfirmed: false,
        userExcluded: false,
      };
    }

    // Default: treat as subcontractor with name-based trade inference
    return {
      companyName,
      csvRole,
      ourRole: 'subcontractor',
      shouldImport: true,
      tradeType: inferTradeTypeFromCompanyName(companyName),
      userConfirmed: false,
      userExcluded: false,
    };
  };

  // Enhanced date parsing
  const parseDate = (dateStr: string): string | null => {
    if (!dateStr || dateStr.trim() === '') return null;
    
    // Handle "Quarter 1, 2026" format
    if (dateStr.includes('Quarter')) {
      const match = dateStr.match(/Quarter (\d+), (\d{4})/);
      if (match) {
        const quarter = parseInt(match[1]);
        const year = parseInt(match[2]);
        const month = (quarter - 1) * 3 + 1;
        return `${year}-${month.toString().padStart(2, '0')}-01`;
      }
    }
    
    // Handle "August 2019" format
    if (/^[A-Za-z]+ \d{4}$/.test(dateStr)) {
      const months: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
      };
      
      const parts = dateStr.toLowerCase().split(' ');
      const month = months[parts[0]];
      const year = parseInt(parts[1]);
      
      if (month && year) {
        return `${year}-${month.toString().padStart(2, '0')}-01`;
      }
    }
    
    // Handle DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month}-${day}`;
    }
    
    // Handle YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    return null;
  };

  // Enhanced employer matching with better logic
  const matchEmployer = async (
    companyName: string,
    csvRole: string,
    preloadedEmployers?: Array<{ id: string; name: string }>
  ): Promise<EmployerMatchResult> => {
    try {
      const supabase = getSupabaseBrowserClient();
      // 0a. Alias lookup by normalized alias first
      try {
        const normalized = normalizeCompanyName(companyName);
        const { data: aliasHit } = await supabase
          .from('employer_aliases')
          .select('employer_id, employer:employer_id ( id, name )')
          .eq('alias_normalized', normalized)
          .maybeSingle();
        if (aliasHit && aliasHit.employer) {
          return {
            companyName,
            csvRole,
            matchedEmployerId: (aliasHit as any).employer.id,
            matchedEmployerName: (aliasHit as any).employer.name,
            confidence: 'exact',
            numericConfidence: 1.0,
            suggestedMatches: [],
            action: 'confirm_match',
            userConfirmed: true,
            tradeTypeConfirmed: false
          };
        }
      } catch (e) {
        // no-op; continue to normal matching
      }
      // 0. Try in-memory fuzzy match first if we have employers loaded
      const employersList = preloadedEmployers && preloadedEmployers.length > 0 ? preloadedEmployers : allEmployers;
      if (employersList && employersList.length > 0) {
        const best = findBestEmployerMatch(companyName, employersList as any);
        if (best) {
          const distance = (best as any).distance;
          const similarity = typeof distance === 'number' ? Math.max(0, Math.min(1, 1 - distance)) : undefined;
          const level = (best as any).confidence;
          const approxScore = level === 'exact' ? 1 : level === 'high' ? 0.9 : level === 'medium' ? 0.8 : 0.7;
          return {
            companyName,
            csvRole,
            matchedEmployerId: (best as any).id,
            matchedEmployerName: (best as any).name,
            confidence: (best as any).confidence === 'exact' ? 'exact' : 'fuzzy',
            numericConfidence: (best as any).confidence === 'exact' ? 1.0 : (similarity ?? approxScore),
            suggestedMatches: [],
            action: 'confirm_match',
            userConfirmed: false,
            tradeTypeConfirmed: false
          };
        }
      }
      
      // 1. Try exact case-insensitive match
      const { data: exactMatches, error: exactError } = await supabase
        .from('employers')
        .select('id, name, address_line_1, suburb, state')
        .ilike('name', companyName);
      
      if (exactError) throw exactError;
      
      if (exactMatches && exactMatches.length === 1) {
        return {
          companyName,
          csvRole,
          matchedEmployerId: exactMatches[0].id,
          matchedEmployerName: exactMatches[0].name,
          confidence: 'exact',
          numericConfidence: 1.0,
          suggestedMatches: exactMatches.map((m: any) => ({
            id: m.id,
            name: m.name,
            address: `${m.address_line_1 || ''} ${m.suburb || ''} ${m.state || ''}`.trim()
          })),
          action: 'confirm_match',
          userConfirmed: false,
          tradeTypeConfirmed: false
        };
      }
      
      // 2. Try fuzzy matching with improved logic for simple company names
      const stopwords = new Set(['pty','ltd','ptyltd','proprietary','limited','pl','co','group','construction','builders','building','contractor','contracting']);
      const tokens = String(companyName)
        .split(/[^A-Za-z0-9]+/)
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length >= 2 && !stopwords.has(t)) // Lowered from 3 to 2 to catch short names
        .slice(0, 10); // Increased from 8 to 10
      
      const firstToken = tokens[0];
      const orParts = [
        `name.ilike.%${companyName}%`, // Full company name match
      ];
      
      // Add individual token searches with better logic
      if (firstToken && firstToken.length >= 3) {
        orParts.push(`name.ilike.${firstToken}%`); // Starts with first token
        orParts.push(`name.ilike.%${firstToken}%`); // Contains first token anywhere
      }
      
      // For short company names (like "Multiplex", "Keller"), add more aggressive matching
      if (tokens.length === 1 && firstToken && firstToken.length >= 4) {
        orParts.push(`name.ilike.%${firstToken.substring(0, 4)}%`); // First 4 characters
      }
      
      // Add other significant tokens
      tokens.slice(1).forEach(token => {
        if (token.length >= 3) {
          orParts.push(`name.ilike.%${token}%`);
        }
      });
      
      const orQuery = orParts.join(',');
      console.log('Fuzzy search query for', companyName, ':', orQuery);
      
      const { data: fuzzyMatches, error: fuzzyError } = await supabase
        .from('employers')
        .select('id, name, address_line_1, suburb, state')
        .or(orQuery);
      
      if (fuzzyError) throw fuzzyError;
      
      if (fuzzyMatches && fuzzyMatches.length > 0) {
        // Sort by relevance (starts-with first token > exact substring > shorter names)
        const sortedMatches = fuzzyMatches.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const companyNameLower = companyName.toLowerCase();
          const ft = firstToken || '';
          const aStarts = ft ? aName.startsWith(ft) : false;
          const bStarts = ft ? bName.startsWith(ft) : false;
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          
          const aExact = aName.includes(companyNameLower) || companyNameLower.includes(aName);
          const bExact = bName.includes(companyNameLower) || companyNameLower.includes(bName);
          
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          
          return aName.length - bName.length; // Shorter names first
        });
        
        return {
          companyName,
          csvRole,
          suggestedMatches: sortedMatches.slice(0, 10).map((m: any) => ({
            id: m.id,
            name: m.name,
            address: `${m.address_line_1 || ''} ${m.suburb || ''} ${m.state || ''}`.trim()
          })),
          confidence: 'fuzzy',
          numericConfidence: 0.6,
          action: 'search_manual',
          userConfirmed: false,
          tradeTypeConfirmed: false
        };
      }
      
      // 3. No matches found
      return {
        companyName,
        csvRole,
        confidence: 'none',
        numericConfidence: 0,
        suggestedMatches: [],
        action: 'create_new',
        userConfirmed: false,
        tradeTypeConfirmed: false
      };
    } catch (error) {
      console.error('Error matching employer:', error);
      return {
        companyName,
        csvRole,
        confidence: 'none',
        numericConfidence: 0,
        suggestedMatches: [],
        action: 'create_new',
        userConfirmed: false,
        tradeTypeConfirmed: false
      };
    }
  };

  // Enhanced employer creation with duplicate prevention
  const createEmployer = async (companyData: any): Promise<string> => {
    const supabase = getSupabaseBrowserClient();
    
    // Step 1: Check for exact name match
    const { data: exactMatch } = await supabase
      .from('employers')
      .select('id, name, address_line_1, suburb, state')
      .eq('name', companyData.companyName)
      .maybeSingle();
    
    if (exactMatch) {
      console.log(`✓ Using existing employer: ${exactMatch.name} (ID: ${exactMatch.id})`);
      return exactMatch.id;
    }
    
    // Step 2: Check for similar names (fuzzy matching)
    const { data: similarEmployers } = await supabase
      .from('employers')
      .select('id, name, address_line_1, suburb, state')
      .ilike('name', `%${companyData.companyName}%`)
      .limit(5);
    
    const hasSimilar = similarEmployers && similarEmployers.length > 0;
    if (hasSimilar) {
      console.warn(`⚠ Found ${similarEmployers.length} similar employers for "${companyData.companyName}":`, 
        similarEmployers.map(e => e.name));
    }
    
    // Step 3: Create new employer
    const { data, error } = await supabase
      .from('employers')
      .insert({
        name: companyData.companyName,
        address_line_1: companyData.companyStreet,
        suburb: companyData.companyTown,
        state: companyData.companyState,
        postcode: companyData.companyPostcode,
        phone: companyData.companyPhone,
        email: companyData.companyEmail,
        primary_contact_name: `${companyData.contactFirstName} ${companyData.contactSurname}`.trim(),
        employer_type: 'large_contractor'
      })
      .select('id')
      .single();
    
    if (error) throw error;
    
    console.log(`✓ Created new employer: ${companyData.companyName} (ID: ${data.id})`);
    return data.id;
  };

  // Start the enhanced import process
  const startImport = async () => {
    setIsProcessing(true);
    // For projects-only, skip employer matching flow
    if (mode === 'projects-only') {
      setCurrentStep('importing');
      await importProjectsOnly();
      return;
    }
    setCurrentStep('employer_matching');
    
    try {
      // Process CSV data
      const processed = processCSVData();
      setProcessedData(processed);
      // Load all employers once for in-memory fuzzy matching
      let preloaded: Array<{ id: string; name: string }> = [];
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.from('employers').select('id, name');
        preloaded = (data || []).map((e: any) => ({ id: e.id, name: e.name }));
        setAllEmployers(preloaded);
      } catch (e) {
        // Non-fatal; we'll fall back to ilike search
        console.warn('Failed to preload employers for fuzzy match');
      }
      
      // Calculate total companies to process
      const total = processed.reduce((sum, project) => 
        sum + project.companies.filter(c => c.shouldImport).length, 0
      );
      setTotalCompanies(total);
      setIsLoadingMatches(true);
      setMatchingProgress(0);
      
      // Match employers for each company with progress tracking
      const matches: Record<string, EmployerMatchResult> = {};
      let processedCount = 0;
      // Use the preloaded list captured above to avoid state race
      const employerListLocal: Array<{ id: string; name: string }> = preloaded.length > 0 ? preloaded : (allEmployers || []);
      
              for (const project of processed) {
          for (const company of project.companies) {
            if (company.shouldImport) {
              const matchResult = await matchEmployer(company.companyName, company.csvRole, employerListLocal);
              const matchKey = `${project.projectId}-${company.companyName}-${company.csvRole}`;
              // Auto-confirm exact matches so they count as finalized and appear in confirmed list
              matches[matchKey] = {
                ...matchResult,
                userConfirmed: matchResult.confidence === 'exact' ? true : matchResult.userConfirmed,
              } as EmployerMatchResult;
              
              if (matchResult.confidence === 'exact') {
                company.employerId = matchResult.matchedEmployerId;
              }
              
              // Update progress
              processedCount++;
              setMatchingProgress(Math.round((processedCount / total) * 100));
              
              // Small delay to make progress visible and prevent overwhelming the database
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
      
      setEmployerMatches(matches);
      setIsLoadingMatches(false);
      setIsProcessing(false); // Reset processing state after matching is complete
      
    } catch (error) {
      console.error('Import error:', error);
      setImportResults(prev => ({
        ...prev,
        errors: [...prev.errors, error instanceof Error ? error.message : 'Unknown error']
      }));
      setIsProcessing(false);
      setIsLoadingMatches(false);
    }
  };

  // Import only projects (no employers)
  const importProjectsOnly = async () => {
    const results = {
      success: 0,
      errors: [] as string[],
      projectsCreated: [] as string[],
      employersCreated: 0,
      employersMatched: 0
    };

    for (const project of processedData) {
      try {
        const supabase = getSupabaseBrowserClient();
        // Check if project exists
        const { data: existing } = await supabase
          .from('projects')
          .select('id')
          .eq('bci_project_id', project.projectId)
          .maybeSingle();
        if (existing) {
          continue;
        }
        const { data: newProject, error: projectError } = await supabase
          .from('projects')
          .insert({
            name: project.projectName || `Project ${project.projectId}`,
            bci_project_id: project.projectId,
            value: project.localValue,
            proposed_start_date: project.constructionStartDate,
            proposed_finish_date: project.constructionEndDate,
            project_stage: project.projectStage,
            project_status: project.projectStatus,
            last_update_date: project.lastUpdateDate,
            stage_class: mapBciStageToStageClass(project.projectStage, project.projectStatus),
            organising_universe: defaultOrganisingUniverseFor(
              mapBciStageToStageClass(project.projectStage, project.projectStatus),
              project.localValue
            )
          })
          .select('id')
          .single();
        if (projectError) throw projectError;

        const { data: site, error: siteError } = await supabase
          .from('job_sites')
          .insert({
            name: project.projectName,
            location: `${project.projectAddress}, ${project.projectTown}, ${project.projectState} ${project.postCode}`,
            full_address: `${project.projectAddress}, ${project.projectTown}, ${project.projectState} ${project.postCode}`,
            project_id: newProject.id,
            is_main_site: true,
            latitude: project.latitude,
            longitude: project.longitude
          })
          .select('id')
          .single();
        if (siteError) throw siteError;
        await supabase.from('projects').update({ main_job_site_id: site.id }).eq('id', newProject.id);
        results.success++;
        results.projectsCreated.push(project.projectName);
      } catch (e) {
        console.error('Import (projects-only) error', e);
        results.errors.push(e instanceof Error ? e.message : 'Unknown error');
      }
    }
    setImportResults(results);
    setCurrentStep('complete');
    setIsProcessing(false);
  };

  // Move to trade type confirmation step
  const confirmEmployerMatches = () => {
    console.log('confirmEmployerMatches called, current state:', employerMatches);
    // Always show trade type confirmation step for user review
    setCurrentStep('trade_type_confirmation');
    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Move to import step
  const confirmTradeTypes = () => {
    setCurrentStep('importing');
    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Choose the appropriate import function based on mode
    if (mode === 'employers-to-existing') {
      performEmployersToExistingImport();
    } else {
      performImport();
    }
  };

  // Enhanced import with user confirmations
  const performImport = async () => {
    const results = {
      success: 0,
      errors: [] as string[],
      projectsCreated: [] as string[],
      employersCreated: 0,
      employersMatched: 0
    };

    for (const project of processedData) {
      try {
        const supabase = getSupabaseBrowserClient();
        
        // Check if project already exists by BCI ID
        const { data: existingProject } = await supabase
          .from('projects')
          .select('id')
          .eq('bci_project_id', project.projectId)
          .single();

        if (existingProject) {
          results.errors.push(`Project ${project.projectName} already exists with BCI ID ${project.projectId}`);
          continue;
        }

        // Create project with enhanced data
        const { data: newProject, error: projectError } = await supabase
          .from('projects')
          .insert({
            name: project.projectName,
            bci_project_id: project.projectId,
            value: project.localValue,
            proposed_start_date: project.constructionStartDate,
            proposed_finish_date: project.constructionEndDate,
            project_stage: project.projectStage,
            project_status: project.projectStatus,
            last_update_date: project.lastUpdateDate,
            stage_class: mapBciStageToStageClass(project.projectStage, project.projectStatus),
            organising_universe: defaultOrganisingUniverseFor(
              mapBciStageToStageClass(project.projectStage, project.projectStatus),
              project.localValue
            )
          })
          .select('id')
          .single();

        if (projectError) throw projectError;

        // Create main job site with coordinates
        const { data: jobSite, error: siteError } = await supabase
          .from('job_sites')
          .insert({
            name: project.projectName,
            location: `${project.projectAddress}, ${project.projectTown}, ${project.projectState} ${project.postCode}`,
            full_address: `${project.projectAddress}, ${project.projectTown}, ${project.projectState} ${project.postCode}`,
            project_id: newProject.id,
            is_main_site: true,
            latitude: project.latitude,
            longitude: project.longitude
          })
          .select('id')
          .single();

        if (siteError) throw siteError;

        // Update project with main job site
        await supabase
          .from('projects')
          .update({ main_job_site_id: jobSite.id })
          .eq('id', newProject.id);

        // Process companies with user confirmations
        for (const company of project.companies) {
          if (!company.shouldImport || company.userExcluded) continue;

          let employerId = company.employerId;
          const matchKey = `${project.projectId}-${company.companyName}-${company.csvRole}`;
          const matchResult = employerMatches[matchKey];
          
          // Resolve employer ID
          if (!employerId) {
            if (matchResult?.action === 'create_new') {
              // Find the original CSV row for this company
              const csvRow = csvData.find(row => 
                row.projectId === project.projectId && 
                row.companyName === company.companyName
              );
              
              if (csvRow) {
                employerId = await createEmployer(csvRow);
                results.employersCreated++;
              }
            } else if (matchResult?.matchedEmployerId) {
              employerId = matchResult.matchedEmployerId;
              results.employersMatched++;
            }
          }

          if (employerId) {
            // Get final trade type from user confirmation
            const finalTradeType = matchResult?.finalTradeType || company.tradeType || 'general_construction';
            
            if (company.ourRole === 'builder') {
              // Check if project already has a builder
              const { data: currentProject } = await supabase
                .from('projects')
                .select('id, builder_id, employers:builder_id(name)')
                .eq('id', newProject.id)
                .maybeSingle();
              
              if (currentProject?.builder_id) {
                if (currentProject.builder_id === employerId) {
                  console.log(`✓ Builder already assigned to ${project.projectName}`);
                } else {
                  const existingBuilderName = (currentProject as any).employers?.name || 'Unknown';
                  console.warn(`⚠ Project ${project.projectName} already has builder: ${existingBuilderName}. Skipping duplicate.`);
                }
              } else {
                await supabase
                  .from('projects')
                  .update({ builder_id: employerId })
                  .eq('id', newProject.id);
                console.log(`✓ Assigned builder to ${project.projectName}`);
              }
              
            } else if (company.ourRole === 'head_contractor') {
              // Check for existing head contractor role
              const { data: existingRole } = await supabase
                .from('project_employer_roles')
                .select('id')
                .eq('project_id', newProject.id)
                .eq('employer_id', employerId)
                .eq('role', 'head_contractor')
                .maybeSingle();
              
              if (existingRole) {
                console.log(`✓ Head contractor relationship already exists for ${project.projectName}`);
              } else {
                await supabase
                  .from('project_employer_roles')
                  .insert({
                    project_id: newProject.id,
                    employer_id: employerId,
                    role: 'head_contractor'
                  });
                console.log(`✓ Created head contractor role for ${project.projectName}`);
              }
              
            } else if (company.ourRole === 'subcontractor') {
              // Use unified assignment function for subcontractors
              try {
                const { data: assignmentResult, error: assignmentError } = await supabase.rpc('assign_contractor_unified', {
                  p_project_id: newProject.id,
                  p_job_site_id: jobSite.id,
                  p_employer_id: employerId,
                  p_trade_type: finalTradeType,
                  p_estimated_workforce: null, // BCI doesn't provide workforce estimates
                  p_eba_signatory: 'not_specified',
                  p_stage: 'structure' // Default stage for BCI imports
                });
                
                if (assignmentError) {
                  console.error(`Error assigning contractor ${company.companyName}:`, assignmentError);
                } else {
                  const result = assignmentResult?.[0];
                  if (result?.success) {
                    console.log(`✓ Assigned contractor to project and site: ${company.companyName} (${finalTradeType})`);
                  } else {
                    console.warn(`⚠ Failed to assign contractor: ${result?.message || 'Unknown error'}`);
                  }
                }
              } catch (error) {
                console.error(`Error in unified contractor assignment:`, error);
                // Fallback to old method if unified function fails
                const { data: existingTrade } = await supabase
                  .from('project_contractor_trades')
                  .select('id, trade_type')
                  .eq('project_id', newProject.id)
                  .eq('employer_id', employerId)
                  .maybeSingle();
                
                if (!existingTrade) {
                  await supabase
                    .from('project_contractor_trades')
                    .insert({
                      project_id: newProject.id,
                      employer_id: employerId,
                      trade_type: finalTradeType
                    });
                  console.log(`✓ Created trade relationship (fallback) for ${project.projectName}: ${finalTradeType}`);
                }
              }
            }
          }
        }

        results.success++;
        results.projectsCreated.push(project.projectName);

      } catch (error) {
        console.error(`Error importing project ${project.projectName}:`, error);
        results.errors.push(`Failed to import ${project.projectName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    setImportResults(results);
    setCurrentStep('complete');
    setIsProcessing(false);
  };

  // Employers to existing projects only, matching by BCI Project ID
  const performEmployersToExistingImport = async () => {
    const results = {
      success: 0,
      errors: [] as string[],
      projectsCreated: [] as string[],
      employersCreated: 0,
      employersMatched: 0
    };

    for (const project of processedData) {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: existingProject } = await supabase
          .from('projects')
          .select('id')
          .eq('bci_project_id', project.projectId)
          .maybeSingle();
        if (!existingProject) {
          results.errors.push(`No existing project found for BCI ID ${project.projectId}`);
          continue;
        }

        for (const company of project.companies) {
          if (!company.shouldImport || company.userExcluded) continue;
          const matchKey = `${project.projectId}-${company.companyName}-${company.csvRole}`;
          const matchResult = employerMatches[matchKey];
          let employerId = company.employerId || matchResult?.matchedEmployerId;
          if (!employerId && matchResult?.action === 'create_new') {
            const csvRow = csvData.find(r => r.projectId === project.projectId && r.companyName === company.companyName);
            if (csvRow) {
              employerId = await createEmployer(csvRow);
              results.employersCreated++;
            }
          }
          if (!employerId) continue;

          // Enhanced relationship creation with duplicate prevention
          if (company.ourRole === 'builder') {
            const { data: currentProject } = await supabase
              .from('projects')
              .select('id, builder_id, employers:builder_id(name)')
              .eq('id', existingProject.id)
              .maybeSingle();
            
            if (currentProject?.builder_id && currentProject.builder_id !== employerId) {
              const existingBuilderName = (currentProject as any).employers?.name || 'Unknown';
              results.errors.push(`Project ${project.projectName} already has builder: ${existingBuilderName}`);
            } else if (!currentProject?.builder_id) {
              await supabase.from('projects').update({ builder_id: employerId }).eq('id', existingProject.id);
              console.log(`✓ Assigned builder to ${project.projectName}`);
            }
            
          } else if (company.ourRole === 'head_contractor') {
            const { data: existingRole } = await supabase
              .from('project_employer_roles')
              .select('id')
              .eq('project_id', existingProject.id)
              .eq('employer_id', employerId)
              .eq('role', 'head_contractor')
              .maybeSingle();
            
            if (!existingRole) {
              await supabase.from('project_employer_roles').insert({ 
                project_id: existingProject.id, 
                employer_id: employerId, 
                role: 'head_contractor' 
              });
              console.log(`✓ Created head contractor role for ${project.projectName}`);
            } else {
              console.log(`✓ Head contractor relationship already exists for ${project.projectName}`);
            }
            
          } else if (company.ourRole === 'subcontractor') {
            const { data: existingTrade } = await supabase
              .from('project_contractor_trades')
              .select('id, trade_type')
              .eq('project_id', existingProject.id)
              .eq('employer_id', employerId)
              .maybeSingle();
            
            const finalTradeType = company.tradeType || 'general_construction';
            
            if (existingTrade) {
              if (existingTrade.trade_type !== finalTradeType) {
                results.errors.push(`${project.projectName}: Employer already linked with different trade type (${existingTrade.trade_type} vs ${finalTradeType})`);
              } else {
                console.log(`✓ Trade relationship already exists for ${project.projectName}: ${finalTradeType}`);
              }
            } else {
              await supabase.from('project_contractor_trades').insert({ 
                project_id: existingProject.id, 
                employer_id: employerId, 
                trade_type: finalTradeType 
              });
              console.log(`✓ Created trade relationship for ${project.projectName}: ${finalTradeType}`);
            }
          }
          results.employersMatched++;
        }
        results.success++;
      } catch (e) {
        console.error('Employers-to-existing import error', e);
        results.errors.push(e instanceof Error ? e.message : 'Unknown error');
      }
    }
    setImportResults(results);
    setCurrentStep('complete');
    setIsProcessing(false);
  };

  // Update employer match action
  const updateEmployerMatch = (
    matchKey: string,
    action: 'confirm_match' | 'search_manual' | 'create_new' | 'add_to_list' | 'skip',
    employerId?: string,
    employerName?: string
  ) => {
    const isProcessedAction = (a: 'confirm_match' | 'search_manual' | 'create_new' | 'add_to_list' | 'skip') => (
      a === 'confirm_match' || a === 'create_new' || a === 'add_to_list' || a === 'skip'
    );
    setEmployerMatches(prev => {
      const updated = {
        ...prev,
        [matchKey]: {
          ...prev[matchKey],
          action,
          matchedEmployerId: employerId,
          matchedEmployerName: employerName || prev[matchKey]?.matchedEmployerName,
          // If a user confirms a match, reflect that as an exact confidence for clarity in UI
          confidence: action === 'confirm_match' ? 'exact' : prev[matchKey]?.confidence,
          // Only mark as confirmed for processed actions; manual search selection shouldn't hide the card
          userConfirmed: isProcessedAction(action)
        }
      };
      return updated;
    });
    // If a match is confirmed from manual selection, persist to processedData and propagate to same-named companies across projects
    if (action === 'confirm_match' && employerId) {
      // Find the selected company name from the matchKey
      let selectedCompanyName: string | null = null;
      for (const project of processedData) {
        for (const company of project.companies) {
          const mk = `${project.projectId}-${company.companyName}-${company.csvRole}`;
          if (mk === matchKey) {
            selectedCompanyName = company.companyName;
            break;
          }
        }
        if (selectedCompanyName) break;
      }
      // Normalize helper
      const norm = (s: string) => normalizeCompanyName(s);
      const selectedNorm = selectedCompanyName ? norm(selectedCompanyName) : null;

      if (selectedNorm) {
        // Update companies across all projects
        setProcessedData(prev => prev.map(project => {
          const companies = project.companies.map(company => {
            if (norm(company.companyName) === selectedNorm) {
              return { ...company, employerId } as any;
            }
            return company;
          });
          return { ...project, companies };
        }));

        // Update employerMatches for all corresponding keys
        setEmployerMatches(prev => {
          const updated = { ...prev } as Record<string, EmployerMatchResult>;
          for (const project of processedData) {
            for (const company of project.companies) {
              if (!company.shouldImport) continue;
              if (norm(company.companyName) !== selectedNorm) continue;
              const k = `${project.projectId}-${company.companyName}-${company.csvRole}`;
              const existing = updated[k] || {
                companyName: company.companyName,
                csvRole: company.csvRole,
                suggestedMatches: [],
                confidence: 'exact',
                action: 'confirm_match',
                userConfirmed: true,
                tradeTypeConfirmed: false,
              } as EmployerMatchResult;
              updated[k] = {
                ...existing,
                matchedEmployerId: employerId,
                matchedEmployerName: employerName || existing.matchedEmployerName,
                confidence: 'exact',
                action: 'confirm_match',
                userConfirmed: true,
              };
            }
          }
          return updated;
        });
      } else {
        // Fallback: only set for the current key
        setProcessedData(prev => prev.map(project => {
          const companies = project.companies.map(company => {
            const mk = `${project.projectId}-${company.companyName}-${company.csvRole}`;
            if (mk === matchKey) {
              return { ...company, employerId } as any;
            }
            return company;
          });
          return { ...project, companies };
        }));
      }
    }
    // Persist alias mapping when a manual selection confirms a match
    if (action === 'confirm_match' && employerId) {
      const [projectId, companyName, csvRole] = matchKey.split('-');
      const normalized = normalizeCompanyName(companyName);
      (async () => {
        try {
          const supabase = getSupabaseBrowserClient();
          // Upsert alias by normalized value
          await supabase
            .from('employer_aliases')
            .upsert({
              alias: companyName,
              alias_normalized: normalized,
              employer_id: employerId
            }, { onConflict: 'alias_normalized' });
        } catch (e) {
          // silent failure; alias persistence is best-effort
          console.warn('Failed to save employer alias');
        }
      })();
    }
  };

  // Add employer to import list for later
  const addEmployerToList = (matchKey: string, company: CompanyClassification, projectId: string) => {
    const csvRow = csvData.find(row => 
      row.projectId === projectId && 
      row.companyName === company.companyName
    );
    
    if (csvRow) {
      // Check if this company (by normalized name) is already in the list
      const normalizedName = normalizeCompanyName(company.companyName);
      const alreadyAdded = employersToAdd.some(emp => 
        normalizeCompanyName(emp.companyName) === normalizedName
      );

      if (!alreadyAdded) {
        // Persist to pending_employers table (only once per unique company)
        (async () => {
          try {
            const supabase = getSupabaseBrowserClient();
            await supabase
              .from('pending_employers')
              .insert({
                company_name: company.companyName,
                csv_role: company.csvRole,
                source: 'bci',
                inferred_trade_type: company.tradeType,
                our_role: company.ourRole,
                project_associations: [{
                  project_id: projectId,
                  project_name: processedData.find(p => p.projectId === projectId)?.projectName || `Project ${projectId}`,
                  csv_role: company.csvRole
                }],
                raw: csvRow
              });
          } catch (e) {
            // Non-fatal; fall back to in-memory list only
            console.warn('Failed to persist pending employer; keeping in-memory only');
          }
        })();

        setEmployersToAdd(prev => [...prev, {
          companyName: company.companyName,
          csvRole: company.csvRole,
          companyData: csvRow,
          matchKey
        }]);
      }

      // Update the current match key regardless
      updateEmployerMatch(matchKey, 'add_to_list');
      
      // Also update all other instances of this company across projects
      const norm = (s: string) => normalizeCompanyName(s);
      const companyNorm = norm(company.companyName);
      
      setEmployerMatches(prev => {
        const updated = { ...prev };
        
        // Find all match keys for this company across all projects
        for (const project of processedData) {
          for (const comp of project.companies) {
            if (!comp.shouldImport) continue;
            if (norm(comp.companyName) !== companyNorm) continue;
            
            const k = `${project.projectId}-${comp.companyName}-${comp.csvRole}`;
            const existing = updated[k];
            if (existing) {
              updated[k] = {
                ...existing,
                action: 'add_to_list',
                userConfirmed: true
              };
            }
          }
        }
        
        return updated;
      });
    }
  };

  // Skip this company
  const skipCompany = (matchKey: string) => {
    updateEmployerMatch(matchKey, 'skip');
  };

  // Manual search function
  const performManualSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]); // Clear previous results
    
    try {
      const supabase = getSupabaseBrowserClient();
      
      console.log('Performing manual search for:', searchTerm);
      console.log('Supabase client:', supabase);
      
      // Test basic connectivity first
      const { data: testData, error: testError } = await supabase
        .from('employers')
        .select('count', { count: 'exact', head: true });
      
      console.log('Test query result:', { testData, testError });
      
      if (testError) {
        console.error('Basic connectivity test failed:', testError);
        throw new Error(`Database connection failed: ${testError.message}`);
      }
      
      const { data, error } = await supabase
        .from('employers')
        .select('id, name, address_line_1, suburb, state')
        .ilike('name', `%${searchTerm.trim()}%`)
        .limit(10);
      
      console.log('Search query result:', { data, error, searchTerm: searchTerm.trim() });
      
      if (error) {
        console.error('Search query failed:', error);
        throw new Error(`Search failed: ${error.message}`);
      }
      
      const results = data?.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        address: `${emp.address_line_1 || ''} ${emp.suburb || ''} ${emp.state || ''}`.trim()
      })) || [];
      
      console.log('Processed results:', results);
      setSearchResults(results);
      
    } catch (error) {
      console.error('Manual search error:', error);
      // Show error to user
      alert(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Update trade type confirmation
  const updateTradeType = (matchKey: string, tradeType: TradeType) => {
    setEmployerMatches(prev => ({
      ...prev,
      [matchKey]: {
        ...prev[matchKey],
        finalTradeType: tradeType,
        tradeTypeConfirmed: true
      }
    }));
  };

  // Render employer matching step
  const renderEmployerMatching = () => {
    console.log('Rendering employer matching, current state:', { employerMatches, processedData });
    
    // Show loading state while matches are being processed
    if (isLoadingMatches) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Matching Employers...</h2>
            <p className="text-gray-600">Analyzing company names and finding matches in our database</p>
          </div>
          
          <Card className="variant:desktop">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <img src="/spinner.gif" alt="Loading" className="w-16 h-16 mx-auto" />
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Processing {totalCompanies} companies...
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${matchingProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">{matchingProgress}% complete</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    // Compute totals/resolution with robust checks (includes Add-to-List and persisted employerId)
    const addToListKeys = new Set<string>((employersToAdd || []).map(e => e.matchKey));
    const totals = (() => {
      let total = 0;
      let resolved = 0;
      for (const project of processedData) {
        for (const company of project.companies) {
          if (!company.shouldImport) continue;
          total++;
          const matchKey = `${project.projectId}-${company.companyName}-${company.csvRole}`;
          const match = employerMatches[matchKey];
          const finalAction = match && match.userConfirmed && (
            match.action === 'confirm_match' ||
            match.action === 'create_new' ||
            match.action === 'add_to_list' ||
            match.action === 'skip'
          );
          const isResolved = addToListKeys.has(matchKey) || finalAction || !!(match && match.matchedEmployerId) || !!(company as any).employerId;
          if (isResolved) resolved++;
        }
      }
      return { total, resolved };
    })();

    return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Employer Matching</h2>
        <p className="text-gray-600">Review and confirm employer matches for each company</p>
        <p className="text-sm text-gray-500">
          {Object.keys(employerMatches).length} matches loaded • 
          {processedData.flatMap(p => p.companies).filter(c => c.shouldImport && c.ourRole === 'subcontractor').length} need trade type confirmation
        </p>
        {totals.total - totals.resolved > 0 && (
          <p className="text-xs text-amber-700 mt-1">{totals.total - totals.resolved} company(ies) remaining to review</p>
        )}
      </div>
      
      {/* Summary of matching results */}
      <Card className="variant:desktop">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {Object.values(employerMatches).filter(m => m.confidence === 'exact').length}
              </div>
              <p className="text-sm text-gray-600">Exact Matches</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {Object.values(employerMatches).filter(m => m.confidence === 'fuzzy').length}
              </div>
              <p className="text-sm text-gray-600">Fuzzy Matches</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {Object.values(employerMatches).filter(m => m.confidence === 'none').length}
              </div>
              <p className="text-sm text-gray-600">No Matches</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {employersToAdd.length}
              </div>
              <p className="text-sm text-gray-600">Queued for Import</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">
                {Object.values(employerMatches).filter(m => m.action === 'skip').length}
              </div>
              <p className="text-sm text-gray-600">Skipped</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Confirmed Matches */}
      {Object.values(employerMatches).some(m => m.action === 'confirm_match' && m.userConfirmed) && (
        <Card className="variant:desktop border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800">Confirmed Matches</CardTitle>
            <CardDescription>
              {Object.values(employerMatches).filter(m => m.action === 'confirm_match' && m.matchedEmployerId).length} confirmed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(employerMatches)
                .filter(([_, m]) => m.action === 'confirm_match' && m.matchedEmployerId)
                .slice(0, 10)
                .map(([key, m]) => (
                  <div key={key} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                    <div className="text-sm text-green-900">
                      <strong>{m.companyName}</strong>
                    </div>
                    <Badge variant="default">{m.matchedEmployerName || 'Confirmed'}</Badge>
                  </div>
                ))}
              {Object.values(employerMatches).filter(m => m.action === 'confirm_match' && m.matchedEmployerId).length > 10 && (
                <div className="text-xs text-green-700">… and more</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employers to be added later */}
      {employersToAdd.length > 0 && (
        <Card className="variant:desktop border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Plus className="h-5 w-5" />
              Employers for Later Import
            </CardTitle>
            <CardDescription>
              {employersToAdd.length} companies have been added to your import list
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {employersToAdd.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200">
                  <div>
                    <p className="font-medium">{item.companyName}</p>
                    <p className="text-sm text-gray-600">Role: {item.csvRole}</p>
                  </div>
                  <Badge variant="secondary">Queued for Import</Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-300">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> These employers will be available in the main Data Upload section 
                under "Employers" for batch import. You can review and modify the data before importing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {processedData.map((project) => (
        <Card key={project.projectId} className="variant:desktop">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {project.projectName}
            </CardTitle>
            <CardDescription>
              {project.companies.filter(c => c.shouldImport).length} companies to process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.companies
              .filter(c => c.shouldImport)
              .map(company => ({
                company,
                matchKey: `${project.projectId}-${company.companyName}-${company.csvRole}`,
                match: employerMatches[`${project.projectId}-${company.companyName}-${company.csvRole}`]
              }))
              .sort((a, b) => {
                const aScore = a.match?.numericConfidence ?? (a.match?.confidence === 'exact' ? 1 : a.match?.confidence === 'fuzzy' ? 0.6 : 0);
                const bScore = b.match?.numericConfidence ?? (b.match?.confidence === 'exact' ? 1 : b.match?.confidence === 'fuzzy' ? 0.6 : 0);
                return aScore - bScore; // ascending: lowest confidence first
              })
              .map(({ company, matchKey }, index) => {
                const match = employerMatches[matchKey];
                if (!match) return null;
                // Hide card when a final decision is made or a match is assigned
                const finalized = (
                  !!match.matchedEmployerId ||
                  !!(company as any).employerId ||
                  (match.userConfirmed && (
                    match.action === 'confirm_match' ||
                    match.action === 'create_new' ||
                    match.action === 'add_to_list' ||
                    match.action === 'skip'
                  ))
                );
                if (finalized) return null;
                return (
                  <div key={`${matchKey}-${index}`} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{company.companyName}</h4>
                        <p className="text-sm text-gray-600">
                          Role: {company.csvRole} → {company.ourRole}
                        </p>
                        {match.matchedEmployerId && (
                          <p className="text-xs text-green-700 mt-1">Selected: {match.matchedEmployerName || match.matchedEmployerId}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={match.confidence === 'exact' ? 'default' : match.confidence === 'fuzzy' ? 'secondary' : 'destructive'}>
                          {match.confidence === 'exact' ? 'Exact Match' : match.confidence === 'fuzzy' ? 'Fuzzy Match' : 'No Match'}
                        </Badge>
                        <span className="text-xs text-gray-500">{Math.round(((match.numericConfidence ?? (match.confidence === 'exact' ? 1 : match.confidence === 'fuzzy' ? 0.6 : 0)) * 100))}%</span>
                      </div>
                    </div>
                  
                  {match.confidence === 'exact' && (
                    <div className="bg-green-50 p-3 rounded border border-green-200">
                      <p className="text-sm text-green-800">
                        <strong>Exact match found:</strong> {match.matchedEmployerName}
                      </p>
                      <button 
                        className={`mt-2 px-3 py-1.5 text-sm rounded transition-colors ${
                          match.userConfirmed 
                            ? 'bg-green-700 text-white' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                        onClick={() => {
                          updateEmployerMatch(matchKey, 'confirm_match', match.matchedEmployerId, match.matchedEmployerName);
                        }}
                      >
                        {match.userConfirmed ? '✓ Confirmed' : 'Confirm Match'}
                      </button>
                    </div>
                  )}
                  
                  {match.confidence === 'fuzzy' && (
                    <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        <strong>Possible matches found:</strong>
                      </p>
                      <div className="mt-2 space-y-2">
                        {match.suggestedMatches.map((suggestion) => (
                          <div key={suggestion.id} className="flex items-center justify-between bg-white p-2 rounded border">
                            <div>
                              <p className="font-medium">{suggestion.name}</p>
                              <p className="text-xs text-gray-600">{suggestion.address}</p>
                            </div>
                            <button 
                              className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                                match.userConfirmed && match.matchedEmployerId === suggestion.id
                                  ? 'border-green-500 bg-green-50 text-green-700' 
                                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                              onClick={() => {
                                updateEmployerMatch(matchKey, 'confirm_match', suggestion.id, suggestion.name);
                              }}
                            >
                              {match.userConfirmed && match.matchedEmployerId === suggestion.id ? '✓ Selected' : 'Select This'}
                            </button>
                          </div>
                        ))}
                        {match.suggestedMatches.length === 0 && (
                          <div className="text-xs text-gray-600">No suggestions available. Try manual search.</div>
                        )}
                      </div>
                      
                      {/* Action buttons for fuzzy matches */}
                      <div className="flex gap-2 mt-3 pt-3 border-t border-yellow-200">
                        <button 
                          className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                            match.action === 'search_manual'
                              ? 'border-blue-500 bg-blue-50 text-blue-700' 
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            setSearchingForCompany(company.companyName);
                            setCurrentSearchMatchKey(matchKey);
                            setShowManualSearch(true);
                            updateEmployerMatch(matchKey, 'search_manual');
                          }}
                        >
                          {match.action === 'search_manual' ? '✓ Manual Search Selected' : 'Search Manually'}
                        </button>
                        
                        <button 
                          className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                            match.userConfirmed && match.action === 'add_to_list'
                              ? 'border-blue-500 bg-blue-50 text-blue-700' 
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            addEmployerToList(matchKey, company, project.projectId);
                          }}
                        >
                          {match.userConfirmed && match.action === 'add_to_list' ? '✓ Added to Import List' : 'Add to Import List'}
                        </button>
                        
                        <button 
                          className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                            match.userConfirmed && match.action === 'skip'
                              ? 'border-gray-500 bg-gray-50 text-gray-700' 
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            skipCompany(matchKey);
                          }}
                        >
                          {match.userConfirmed && match.action === 'skip' ? '✓ Skipped' : 'Skip'}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {match.confidence === 'none' && (
                    <div className="bg-red-50 p-3 rounded border border-red-200">
                      <p className="text-sm text-red-800">
                        <strong>No matches found.</strong> Choose an action for this company.
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button 
                          className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                            match.action === 'search_manual'
                              ? 'border-blue-500 bg-blue-50 text-blue-700' 
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            setSearchingForCompany(company.companyName);
                            setCurrentSearchMatchKey(matchKey);
                            setShowManualSearch(true);
                            updateEmployerMatch(matchKey, 'search_manual');
                          }}
                        >
                          {match.action === 'search_manual' ? '✓ Manual Search Selected' : 'Search For Employer Match'}
                        </button>
                        <button 
                          className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                            match.userConfirmed && match.action === 'create_new'
                              ? 'border-purple-500 bg-purple-50 text-purple-700' 
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            updateEmployerMatch(matchKey, 'create_new');
                          }}
                        >
                          {match.userConfirmed && match.action === 'create_new' ? '✓ Will Create New' : 'Create New Employer'}
                        </button>
                        
                        <button 
                          className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                            match.userConfirmed && match.action === 'add_to_list'
                              ? 'border-blue-500 bg-blue-50 text-blue-700' 
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            addEmployerToList(matchKey, company, project.projectId);
                          }}
                        >
                          {match.userConfirmed && match.action === 'add_to_list' ? '✓ Added to Import List' : 'Add to Import List'}
                        </button>
                        
                        <button 
                          className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                            match.userConfirmed && match.action === 'skip'
                              ? 'border-gray-500 bg-gray-50 text-gray-700' 
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            skipCompany(matchKey);
                          }}
                        >
                          {match.userConfirmed && match.action === 'skip' ? '✓ Skipped' : 'Skip'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
      
      <div className="flex justify-center">
        <Button 
          onClick={confirmEmployerMatches}
          disabled={totals.resolved < totals.total}
          className="px-8"
        >
          Continue to Trade Type Assignment ({totals.resolved}/{totals.total} resolved)
        </Button>
      </div>
      
      {/* Manual Search Dialog */}
      <Dialog open={showManualSearch} onOpenChange={setShowManualSearch}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manual Employer Search</DialogTitle>
            <DialogDescription>
              Searching for: <strong>{searchingForCompany}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter company name to search..."
                value={searchingForCompany}
                onChange={(e) => setSearchingForCompany(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && performManualSearch(searchingForCompany)}
              />
              <Button 
                onClick={() => performManualSearch(searchingForCompany)}
                disabled={isSearching || !searchingForCompany.trim()}
              >
                {isSearching ? (
                  <>
                    <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  // Close dialog and restore the parent card to show manual search as selected
                  setShowManualSearch(false);
                  setSearchResults([]);
                  // Do not clear searchingForCompany so the parent chip still shows selection context
                  setCurrentSearchMatchKey('');
                }}
              >
                Cancel
              </Button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Search Results:</p>
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                    <div>
                      <p className="font-medium">{result.name}</p>
                      <p className="text-sm text-gray-600">{result.address}</p>
                    </div>
                                            <Button
                          size="sm"
                          onClick={() => {
                            if (currentSearchMatchKey) {
                              updateEmployerMatch(currentSearchMatchKey, 'confirm_match', result.id, result.name);
                              setShowManualSearch(false);
                              setSearchResults([]);
                              setSearchingForCompany('');
                              setCurrentSearchMatchKey('');
                            }
                          }}
                        >
                          Select This Employer
                        </Button>
                  </div>
                ))}
              </div>
            )}
            
            {searchResults.length === 0 && !isSearching && searchingForCompany && (
              <div className="space-y-3 py-4 text-center">
                <p className="text-gray-700">No employers found matching "{searchingForCompany}"</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    onClick={() => {
                      if (!currentSearchMatchKey) return;
                      // Mark as create new
                      updateEmployerMatch(currentSearchMatchKey, 'create_new');
                      setShowManualSearch(false);
                    }}
                  >
                    Create New Employer
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!currentSearchMatchKey) return;
                      // Re-run search (user might adjust query)
                      performManualSearch(searchingForCompany);
                    }}
                  >
                    Search Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!currentSearchMatchKey) return;
                      // Add to list for later import
                      const [projId, ...rest] = currentSearchMatchKey.split('-');
                      // Handle company names that might contain dashes
                      const lastDashIndex = currentSearchMatchKey.lastIndexOf('-');
                      const csvRole = currentSearchMatchKey.substring(lastDashIndex + 1);
                      const compName = currentSearchMatchKey.substring(projId.length + 1, lastDashIndex);
                      
                      const project = processedData.find(p => p.projectId === projId);
                      const company = project?.companies.find(c => c.companyName === compName && c.csvRole === csvRole);
                      if (project && company) {
                        addEmployerToList(currentSearchMatchKey, company as any, project.projectId);
                      }
                      setShowManualSearch(false);
                      setSearchResults([]);
                      setSearchingForCompany('');
                      setCurrentSearchMatchKey('');
                    }}
                  >
                    Add to Import List
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (!currentSearchMatchKey) return;
                      skipCompany(currentSearchMatchKey);
                      setShowManualSearch(false);
                    }}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    );
  };

  // Render trade type confirmation step
  const renderTradeTypeConfirmation = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Role & Trade Type Assignment</h2>
        <p className="text-gray-600">Confirm roles and trade types for all companies</p>
      </div>
      
      {processedData.map((project) => (
        <Card key={project.projectId} className="variant:desktop">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {project.projectName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.companies.filter(c => c.shouldImport).map((company) => {
              const matchKey = `${project.projectId}-${company.companyName}-${company.csvRole}`;
              const match = employerMatches[matchKey];
              
              if (!match) return null;
              
              return (
                <div key={company.companyName} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{company.companyName}</h4>
                      <p className="text-sm text-gray-600">
                        CSV Role: {company.csvRole} → Our Role: {company.ourRole}
                      </p>
                    </div>
                    <Badge variant={company.ourRole === 'builder' ? 'default' : company.ourRole === 'head_contractor' ? 'secondary' : 'outline'}>
                      {company.ourRole === 'builder' ? 'Builder' : company.ourRole === 'head_contractor' ? 'Head Contractor' : 'Subcontractor'}
                    </Badge>
                  </div>
                  
                  {/* Allow role override here */}
                  <div className="space-y-2">
                    <Label htmlFor={`role-${matchKey}`}>Role:</Label>
                    <Select
                      value={company.ourRole}
                      onValueChange={(value) => {
                        const newRole = value as 'builder' | 'head_contractor' | 'subcontractor' | 'skip';
                        setProcessedData(prev => prev.map(p => p.projectId === project.projectId ? {
                          ...p,
                          companies: p.companies.map(c => c.companyName === company.companyName && c.csvRole === company.csvRole ? { ...c, ourRole: newRole } : c)
                        } : p));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="builder">Builder</SelectItem>
                        <SelectItem value="head_contractor">Head Contractor</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                        <SelectItem value="skip">Skip</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {company.ourRole === 'subcontractor' && (
                    <div className="space-y-2">
                      <Label htmlFor={`trade-${matchKey}`}>Trade Type:</Label>
                      <Select 
                        value={match.finalTradeType || company.tradeType || 'general_construction'} 
                        onValueChange={(value) => updateTradeType(matchKey, value as TradeType)}
                      >
                        <SelectTrigger>
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
                    </div>
                  )}
                  
                  {(company.ourRole === 'builder' || company.ourRole === 'head_contractor') && (
                    <div className="space-y-2">
                      <Label htmlFor={`role-${matchKey}`}>Project Role:</Label>
                      <div className="p-3 bg-gray-50 rounded border">
                        <p className="text-sm text-gray-700">
                          <strong>{company.ourRole === 'builder' ? 'Builder' : 'Head Contractor'}</strong>
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {company.ourRole === 'builder' 
                            ? 'This company will be set as the project builder (projects.builder_id)'
                            : 'This company will be added to project_employer_roles as head_contractor'
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
      
      <div className="flex justify-center">
                         <Button 
          onClick={confirmTradeTypes}
          disabled={false}
          className="px-8"
        >
          Start Import
        </Button>
      </div>
    </div>
  );

  // Render preview of processed data
  const renderPreview = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Info className="h-4 w-4" />
        <span>Preview of {csvData.length} CSV rows processed into {processedData.length} unique projects</span>
      </div>
      {processedData.length === 0 && (
        <div className="p-3 border border-red-200 bg-red-50 text-sm text-red-800 rounded">
          No projects detected from the CSV. Ensure a "Project ID" column exists. If your file has duplicate header names, they may be auto-renamed by your spreadsheet/exporter; the parser now handles common variants.
        </div>
      )}
      {/* Missing project names editor */}
      {processedData.filter(p => !p.projectName || String(p.projectName).trim() === '').length > 0 && (
        <div className="space-y-3 p-3 border border-yellow-200 rounded bg-yellow-50">
          <div className="text-sm text-yellow-800">
            Some projects are missing a name. Please enter names before continuing.
          </div>
          {processedData.filter(p => !p.projectName || String(p.projectName).trim() === '').map((project) => (
            <div key={project.projectId} className="flex items-center gap-3">
              <div className="text-sm text-gray-700 min-w-[160px]">Project ID: {project.projectId}</div>
              <Input
                placeholder="Enter project name"
                value={project.projectName || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setProcessedData(prev => prev.map(p => p.projectId === project.projectId ? { ...p, projectName: value } : p));
                }}
              />
            </div>
          ))}
        </div>
      )}
      
      {processedData.slice(0, 3).map((project, index) => (
        <Card key={index} className="variant:desktop">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {project.projectName}
            </CardTitle>
            <CardDescription>
              {project.localValue.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })} • {project.projectStage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Location:</strong> {project.projectAddress}, {project.projectTown}, {project.projectState} {project.postCode}
              </p>
              {project.latitude && project.longitude && (
                <p className="text-sm">
                  <strong>Coordinates:</strong> {project.latitude}, {project.longitude}
                </p>
              )}
              <p className="text-sm">
                <strong>Companies:</strong> {project.companies.filter(c => c.shouldImport).length} construction companies
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <div className="text-center">
        <Button 
          onClick={startImport} 
          disabled={isProcessing || (mode !== 'projects-only' && processedData.filter(p => !p.projectName || String(p.projectName).trim() === '').length > 0)}
          className="px-8"
        >
          {isProcessing ? (
            <>
              <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
              Processing...
            </>
          ) : (
            mode === 'projects-only' ? 'Create Projects' : (mode === 'employers-to-existing' ? 'Start Employer Matching' : 'Start Employer Matching')
          )}
        </Button>
        {processedData.filter(p => !p.projectName || String(p.projectName).trim() === '').length > 0 && (
          <div className="mt-2 text-xs text-yellow-700">
            {processedData.filter(p => !p.projectName || String(p.projectName).trim() === '').length} project(s) need a name
          </div>
        )}
      </div>
    </div>
  );

  // Render import results
  const renderImportResults = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Import Complete!</h2>
        <p className="text-gray-600">
          Successfully imported {importResults.success} projects
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="variant:desktop">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-600">{importResults.success}</div>
            <p className="text-sm text-gray-600">Projects Created</p>
          </CardContent>
        </Card>
        
        <Card className="variant:desktop">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">{importResults.employersMatched}</div>
            <p className="text-sm text-gray-600">Employers Matched</p>
          </CardContent>
        </Card>
        
        <Card className="variant:desktop">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">{importResults.employersCreated}</div>
            <p className="text-sm text-gray-600">New Employers Created</p>
          </CardContent>
        </Card>
      </div>
      
      {importResults.errors.length > 0 && (
        <Card className="variant:desktop border-red-200">
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
      
                   {employersToAdd.length > 0 && (
               <Card className="variant:desktop border-blue-200">
                 <CardHeader>
                   <CardTitle className="text-blue-800">Employers Queued for Import</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <p className="text-sm text-blue-800 mb-3">
                     <strong>{employersToAdd.length} employers</strong> have been added to your import list and are ready for batch import.
                   </p>
                   <div className="space-y-2">
                     {employersToAdd.slice(0, 5).map((item, index) => (
                       <div key={index} className="text-sm text-gray-700">
                         • {item.companyName} ({item.csvRole})
                       </div>
                     ))}
                     {employersToAdd.length > 5 && (
                       <p className="text-sm text-gray-500">... and {employersToAdd.length - 5} more</p>
                     )}
                   </div>
                   <p className="text-sm text-blue-700 mt-3">
                     Go to <strong>Data Upload → Employers tab</strong> to import these companies.
                   </p>
                 </CardContent>
               </Card>
             )}
             
             <div className="text-center">
               <Button onClick={onImportComplete} className="px-8">
                 Done
               </Button>
             </div>
    </div>
  );

  // Main render
  if (isProcessing && currentStep === 'importing') {
    return (
      <div className="text-center space-y-4">
        <img src="/spinner.gif" alt="Loading" className="w-8 h-8 mx-auto" />
        <h2 className="text-xl font-semibold">Importing Projects...</h2>
        <p className="text-gray-600">Please wait while we create projects and link employers</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {currentStep === 'preview' && renderPreview()}
      {currentStep === 'employer_matching' && renderEmployerMatching()}
      {currentStep === 'trade_type_confirmation' && renderTradeTypeConfirmation()}
      {currentStep === 'complete' && renderImportResults()}
    </div>
  );
}
