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
import { CheckCircle, AlertCircle, Info, Users, Building2, Wrench, MapPin, Search, Plus, ArrowRight, X, AlertTriangle, HelpCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { inferTradeTypeFromCompanyName, inferTradeTypeFromCsvRole, getTradeTypeLabel, TradeType, getTradeTypeCategories } from '@/utils/bciTradeTypeInference';
import { findBestEmployerMatch, normalizeCompanyName } from '@/utils/workerDataProcessor';
import { mapBciStageToStageClass, defaultOrganisingUniverseFor } from '@/utils/stageClassification';
// Removed unused and missing imports
import { useToast } from '@/components/ui/use-toast';
// Removed unused hooks

// Enhanced types for BCI CSV data
interface BCICsvRow {
  projectId: string;
  projectType: string;
  projectName: string;
  projectStage: string;
  projectStatus: string;
  localValue: string;
  fundingTypePrimary?: string;
  ownerTypeLevel1Primary?: string;
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
  companyId?: string;
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


// Removed misplaced early default export; declare at end of file

interface CompanyClassification {
  companyName: string;
  csvRole: string;
  ourRole: 'builder' | 'head_contractor' | 'subcontractor' | 'skip';
  roleCode?: string; // optional contractor role code for assign_contractor_role
  tradeType?: TradeType;
  tradeTypes?: TradeType[]; // Support for multiple trade types
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

interface ConsolidatedEmployerMatch {
  companyName: string;
  normalizedName: string;
  matchedEmployerId?: string;
  matchedEmployerName?: string;
  confidence: 'exact' | 'fuzzy' | 'none';
  action: 'confirm_match' | 'search_manual' | 'create_new' | 'add_to_list' | 'skip';
  userConfirmed: boolean;
  
  // Project assignments for this employer
  projectAssignments: Array<{
    projectId: string;
    projectName: string;
    csvRole: string;
    ourRole: 'builder' | 'head_contractor' | 'subcontractor' | 'skip';
    inferredTradeType?: TradeType;
    finalTradeType?: TradeType;
    tradeTypeConfirmed: boolean;
    matchKey: string;
  }>;
  
  // Bulk assignment capabilities
  bulkRole?: 'builder' | 'head_contractor' | 'subcontractor';
  bulkTradeType?: TradeType;
  hasConsistentRole: boolean;
  hasConsistentTrade: boolean;
  suggestedMatches: Array<{id: string, name: string, address: string}>;
}

interface BCIProjectData {
  projectId: string;
  projectName: string;
  localValue: number;
  fundingTypePrimary?: string;
  ownerTypeLevel1Primary?: string;
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
  mode: BCIImportMode;
  onImportComplete?: () => void;
  initialFile?: File;
  onEmployersStaged?: () => void;
}

const BCIProjectImport: React.FC<BCIProjectImportProps> = ({ csvData, mode, onImportComplete, initialFile, onEmployersStaged }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'preview' | 'employer_matching' | 'trade_type_confirmation' | 'importing' | 'complete'>('preview');
  const [processedData, setProcessedData] = useState<BCIProjectData[]>([]);
  const [employerMatches, setEmployerMatches] = useState<Record<string, EmployerMatchResult>>({});
  const [consolidatedMatches, setConsolidatedMatches] = useState<Map<string, ConsolidatedEmployerMatch>>(new Map());
  const [useConsolidatedView, setUseConsolidatedView] = useState(true);
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
  
  // Help dialog state
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  
  // Import progress state
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, currentItem: '' });
  
  // Auto-confirm progress state
  const [isAutoConfirming, setIsAutoConfirming] = useState(false);
  
  // Project validation state
  const [projectValidation, setProjectValidation] = useState<{
    isValidating: boolean;
    missingProjects: string[];
    validProjects: string[];
    showValidationDialog: boolean;
  }>({
    isValidating: false,
    missingProjects: [],
    validProjects: [],
    showValidationDialog: false
  });
  
  // Import model selection state
  const [showImportModelDialog, setShowImportModelDialog] = useState(false);
  const [selectedImportModel, setSelectedImportModel] = useState<'direct' | 'stage' | 'guided' | null>(null);
  
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
          fundingTypePrimary: row.fundingTypePrimary,
          ownerTypeLevel1Primary: row.ownerTypeLevel1Primary,
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

  // Enhanced trade type detection for companies that may have multiple specialties
  const detectMultipleTradeTypes = (csvRole: string, companyName: string): TradeType[] => {
    const tradeTypes: Set<TradeType> = new Set();
    
    // Primary trade from CSV role
    const primaryFromRole = inferTradeTypeFromCsvRole(csvRole);
    if (primaryFromRole) {
      tradeTypes.add(primaryFromRole);
    }
    
    // Primary trade from company name
    const primaryFromName = inferTradeTypeFromCompanyName(companyName);
    if (primaryFromName && primaryFromName !== 'general_construction') {
      tradeTypes.add(primaryFromName);
    }
    
    // Check for multi-trade indicators in company name
    const name = companyName.toLowerCase();
    
    // Common multi-trade combinations
    if (name.includes('concrete') && (name.includes('form') || name.includes('steel'))) {
      tradeTypes.add('concrete');
      if (name.includes('form')) tradeTypes.add('form_work');
      if (name.includes('steel')) tradeTypes.add('steel_fixing');
    }
    
    if (name.includes('crane') && name.includes('rigging')) {
      if (name.includes('tower')) tradeTypes.add('tower_crane');
      if (name.includes('mobile')) tradeTypes.add('mobile_crane');
      tradeTypes.add('crane_and_rigging');
    }
    
    // Return array, fallback to general_construction if none found
    const result = Array.from(tradeTypes);
    return result.length > 0 ? result : ['general_construction'];
  };

  // Map BCI main-contractor style role labels to our internal role + optional contractor_role_types.code
  const mapBciMainContractorRole = (csvRole: string): {
    ourRole: 'builder' | 'head_contractor' | 'subcontractor' | 'skip';
    roleCode?: string;
    tradeType?: TradeType;
  } | null => {
    const r = (csvRole || '').toLowerCase();

    // Ignored categories
    if (
      r.includes('architectural contractor') ||
      r.includes('epc contractor') ||
      r.includes('epcm contractor') ||
      r.includes('fitout contractor') ||
      r.includes('land development contractor') ||
      r.includes('procurement office') ||
      r.includes('reclamation contractor') ||
      r.includes('show-unit contractor')
    ) {
      return { ourRole: 'skip' };
    }

    // Builder class
    if (r.includes('builder / main contractor') || r.includes('building contractor')) {
      return { ourRole: 'builder' };
    }

    // Project manager family mapped to specific role codes
    if (r.includes('construction manager') || r.includes('project manager')) {
      return { ourRole: 'head_contractor', roleCode: 'construction_manager' };
    }
    if (r.includes('managing contractor')) {
      return { ourRole: 'head_contractor', roleCode: 'managing_contractor' };
    }
    if (r.includes('turnkey contractor')) {
      return { ourRole: 'head_contractor', roleCode: 'turnkey_contractor' };
    }

    // Head contractor style
    if (
      r === 'contractor' ||
      r.includes('maintenance contractor') ||
      r.includes('piling & foundation contractor') ||
      r.includes('road work contractor') ||
      r.includes('site formation contractor') ||
      r.includes('superstructure contractor')
    ) {
      return { ourRole: 'head_contractor', roleCode: 'head_contractor' };
    }

    // Site Office treated as subcontractor in general construction
    if (r.includes('site office')) {
      return { ourRole: 'subcontractor', tradeType: 'general_construction' };
    }

    return null;
  };

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
    
    // First try explicit BCI main-contractor mapping
    const mapped = mapBciMainContractorRole(csvRole);
    if (mapped) {
      if (mapped.ourRole === 'skip') {
        return {
          companyName,
          csvRole,
          ourRole: 'skip',
          shouldImport: false,
          userConfirmed: false,
          userExcluded: false
        };
      }
      if (mapped.ourRole === 'builder') {
        return {
          companyName,
          csvRole,
          ourRole: 'builder',
          shouldImport: true,
          userConfirmed: false,
          userExcluded: false
        };
      }
      if (mapped.ourRole === 'head_contractor') {
        return {
          companyName,
          csvRole,
          ourRole: 'head_contractor',
          roleCode: mapped.roleCode || 'head_contractor',
          shouldImport: true,
          userConfirmed: false,
          userExcluded: false
        };
      }
      if (mapped.ourRole === 'subcontractor') {
        const tt = mapped.tradeType || 'general_construction';
        return {
          companyName,
          csvRole,
          ourRole: 'subcontractor',
          shouldImport: true,
          tradeType: tt,
          tradeTypes: [tt],
          userConfirmed: false,
          userExcluded: false
        };
      }
    }

    // Head contractor mapping from generic CSV role keywords
    if (
      role.includes('project manager') ||
      role.includes('project coordinator') ||
      role.includes('head contractor') ||
      role.includes('principal contractor')
    ) {
      return {
        companyName,
        csvRole,
        ourRole: 'head_contractor',
        roleCode: 'head_contractor',
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
    
    // Subcontractors (prefer CSV Role to infer trade, detect multiple trades)
    if (role.includes('subcontractor') || role.includes('sub-contractor') || role.includes('sub contractor')) {
      const detectedTradeTypes = detectMultipleTradeTypes(csvRole, companyName);
      const primaryTrade = detectedTradeTypes[0] || 'general_construction';

      return { 
        companyName, 
        csvRole, 
        ourRole: 'subcontractor', 
        shouldImport: true,
        tradeType: primaryTrade,
        tradeTypes: detectedTradeTypes,
        userConfirmed: false,
        userExcluded: false
      };
    }
    
    // Fallback rules (contractors) - prioritise CSV role inference for trade type
    if (role.includes('contractor')) {
      const detectedTradeTypes = detectMultipleTradeTypes(csvRole, companyName);
      const primaryTrade = detectedTradeTypes[0] || 'general_construction';
      
      return {
        companyName,
        csvRole,
        ourRole: 'subcontractor',
        shouldImport: true,
        tradeType: primaryTrade,
        tradeTypes: detectedTradeTypes,
        userConfirmed: false,
        userExcluded: false,
      };
    }

    // Default: treat as subcontractor with name-based trade inference
    const detectedTradeTypes = detectMultipleTradeTypes(csvRole, companyName);
    const primaryTrade = detectedTradeTypes[0] || 'general_construction';
    
    return {
      companyName,
      csvRole,
      ourRole: 'subcontractor',
      shouldImport: true,
      tradeType: primaryTrade,
      tradeTypes: detectedTradeTypes,
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
      
      // Helpers for safe PostgREST .or ilike building (which uses * wildcards and CSV-style clauses)
      const sanitizeForOrIlike = (s: string) =>
        String(s).replace(/[,"()]/g, ' ').replace(/\s+/g, ' ').trim();
      const star = (s: string) => sanitizeForOrIlike(s).replace(/\*/g, '');
      
      const firstToken = tokens[0];
      
      // Build safe OR list
      const orParts: string[] = [];
      const cleanedFull = star(companyName);
      if (cleanedFull) {
        // Only include full-name contains if simple enough after sanitization
        orParts.push(`name.ilike.*${cleanedFull}*`);
      }
      
      if (firstToken && firstToken.length >= 3) {
        orParts.push(`name.ilike.${star(firstToken)}*`);   // Starts with first token
        orParts.push(`name.ilike.*${star(firstToken)}*`);  // Contains first token
      }
      
      if (tokens.length === 1 && firstToken && firstToken.length >= 4) {
        orParts.push(`name.ilike.*${star(firstToken.substring(0, 4))}*`);
      }
      
      tokens.slice(1, 7).forEach(token => {
        if (token.length >= 3) {
          orParts.push(`name.ilike.*${star(token)}*`);
        }
      });
      
      const orQuery = orParts.join(',');
      console.log('Fuzzy search query for', companyName, ':', orQuery);
      
      const { data: fuzzyMatches, error: fuzzyError } = await supabase
        .from('employers')
        .select('id, name, address_line_1, suburb, state')
        .or(orQuery);
      
      let candidates = fuzzyMatches || [];
      if (fuzzyError) {
        console.warn('Fuzzy or() failed, falling back to single-token ilike', { companyName, firstToken, error: fuzzyError });
        const fallbackToken = (firstToken && firstToken.length >= 2) ? firstToken : (cleanedFull.split(' ')[0] || '');
        if (fallbackToken) {
          const { data: fb, error: fbErr } = await supabase
            .from('employers')
            .select('id, name, address_line_1, suburb, state')
            .ilike('name', `%${fallbackToken}%`);
          if (fbErr) {
            throw fbErr;
          }
          candidates = fb || [];
        }
      }
      
      if (candidates.length > 0) {
        // Sort by relevance (starts-with first token > exact substring > shorter names)
        const sortedMatches = candidates.sort((a, b) => {
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

  // Create consolidated matches for improved UX
  const createConsolidatedMatches = (
    processed: BCIProjectData[], 
    matches: Record<string, EmployerMatchResult>
  ): Map<string, ConsolidatedEmployerMatch> => {
    const consolidated = new Map<string, ConsolidatedEmployerMatch>();
    
    processed.forEach(project => {
      project.companies.forEach(company => {
        if (!company.shouldImport) return;
        
        const normalizedName = normalizeCompanyName(company.companyName);
        const matchKey = `${project.projectId}-${company.companyName}-${company.csvRole}`;
        const match = matches[matchKey];
        
        if (!consolidated.has(normalizedName)) {
          const roles = processed.flatMap(p => 
            p.companies
              .filter(c => c.shouldImport && normalizeCompanyName(c.companyName) === normalizedName)
              .map(c => c.ourRole)
          );
          const tradeTypes = processed.flatMap(p => 
            p.companies
              .filter(c => c.shouldImport && normalizeCompanyName(c.companyName) === normalizedName)
              .map(c => c.tradeType)
          ).filter(Boolean);
          
          const uniqueRoles = [...new Set(roles)];
          const uniqueTradeTypes = [...new Set(tradeTypes)];
          
          consolidated.set(normalizedName, {
            companyName: company.companyName,
            normalizedName,
            matchedEmployerId: match?.matchedEmployerId,
            matchedEmployerName: match?.matchedEmployerName,
            confidence: match?.confidence || 'none',
            action: match?.action || 'search_manual',
            userConfirmed: match?.userConfirmed || false,
            projectAssignments: [],
            hasConsistentRole: uniqueRoles.length === 1,
            hasConsistentTrade: uniqueTradeTypes.length === 1,
            bulkRole: uniqueRoles.length === 1 ? uniqueRoles[0] as any : undefined,
            bulkTradeType: uniqueTradeTypes.length === 1 ? uniqueTradeTypes[0] as TradeType : undefined,
            suggestedMatches: match?.suggestedMatches || []
          });
        }
        
        const consolidatedMatch = consolidated.get(normalizedName)!;
        
        // Check if this project assignment already exists
        const existingAssignment = consolidatedMatch.projectAssignments.find(
          pa => pa.projectId === project.projectId && pa.csvRole === company.csvRole
        );
        
        if (!existingAssignment) {
          consolidatedMatch.projectAssignments.push({
            projectId: project.projectId,
            projectName: project.projectName,
            csvRole: company.csvRole,
            ourRole: company.ourRole,
            inferredTradeType: company.tradeType,
            finalTradeType: match?.finalTradeType || company.tradeType,
            tradeTypeConfirmed: match?.tradeTypeConfirmed || false,
            matchKey
          });
        }
      });
    });
    
    return consolidated;
  };

  // Bulk: Create all unmatched employers directly (no staging)
  const markAllAsCreateNew = async () => {
    setIsProcessing(true);
    setImportProgress({ current: 0, total: 0, currentItem: 'Preparing employers...' });
    
    try {
      // Get all unmatched employers
      const unmatchedEmployers = Array.from(consolidatedMatches.values())
        .filter(c => c.confidence !== 'exact');
      
      setImportProgress({ current: 0, total: unmatchedEmployers.length, currentItem: 'Creating employers...' });
      
      let created = 0;
      const createdEmployerIds = new Map<string, string>(); // normalized name -> employer ID
      
      for (const consolidated of unmatchedEmployers) {
        setImportProgress(prev => ({ 
          ...prev, 
          current: created + 1, 
          currentItem: `Creating ${consolidated.companyName}...` 
        }));
        
        // Find a CSV row for this company to get full data
        const csvRow = csvData.find(row => 
          normalizeCompanyName(row.companyName) === consolidated.normalizedName
        );
        
        if (csvRow) {
          try {
            const employerId = await createEmployer(csvRow);
            createdEmployerIds.set(consolidated.normalizedName, employerId);
            created++;
          } catch (error) {
            console.error(`Failed to create employer ${consolidated.companyName}:`, error);
          }
        }
      }
      
      // Update the matches to reflect the created employers
      const updated = new Map(consolidatedMatches);
      updated.forEach((c, key) => {
        if (c.confidence !== 'exact' && createdEmployerIds.has(key)) {
          updated.set(key, { 
            ...c, 
            userConfirmed: true,
            matchedEmployerId: createdEmployerIds.get(key),
            confidence: 'exact',
            action: 'confirm_match'
          });
        }
      });
      setConsolidatedMatches(updated);

      // Also update detailed employerMatches
      setEmployerMatches(prev => {
        const copy = { ...prev } as any;
        processedData.forEach(project => {
          project.companies.forEach(company => {
            if (!company.shouldImport) return;
            const mk = `${project.projectId}-${company.companyName}-${company.csvRole}`;
            const norm = normalizeCompanyName(company.companyName);
            const employerId = createdEmployerIds.get(norm);
            if (employerId) {
              copy[mk] = {
                ...(copy[mk] || {}),
                action: 'confirm_match',
                userConfirmed: true,
                matchedEmployerId: employerId,
                confidence: 'exact'
              };
            }
          });
        });
        return copy;
      });
      
      setImportProgress({ current: created, total: created, currentItem: 'Complete!' });
      
      setTimeout(() => {
        setImportProgress({ current: 0, total: 0, currentItem: '' });
        setIsProcessing(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error creating employers:', error);
      setIsProcessing(false);
      setImportProgress({ current: 0, total: 0, currentItem: '' });
    }
  };

  // Batch stage + batch import from within BCI flow (uses pending_employers + existing import path semantics)
  const stageAndImportAll = async () => {
    try {
      // Stage all unmatched first
      await stageAllUnmatchedEmployers();
      // Open Employers tab programmatically by switching UploadPage Tabs via URL
      // Note: we use query param to switch to employers tab and show Pending list
      const url = new URL(window.location.href);
      url.searchParams.set('importType', 'employers');
      window.history.replaceState({}, '', url.toString());
      alert('Staged all unmatched employers. Switching to Employers → Pending Import.');
      // Soft navigate by simulating a click on Employers tab if present
      const tab = Array.from(document.querySelectorAll('[role="tab"]')).find(el => el.textContent?.toLowerCase().includes('employers')) as HTMLElement | undefined;
      if (tab) tab.click();
    } catch (e) {
      console.error('Stage and Import failed:', e);
      alert('Stage and Import failed. Check console for details.');
    }
  };

  // Enhanced employer creation with duplicate prevention
  const createEmployer = async (companyData: any): Promise<string> => {
    const supabase = getSupabaseBrowserClient();
    
    // Step 1: Check for BCI Company ID match first (if available)
    if (companyData.companyId) {
      const { data: bciMatch } = await supabase
        .from('employers')
        .select('id, name, bci_company_id')
        .eq('bci_company_id', companyData.companyId)
        .maybeSingle();
      
      if (bciMatch) {
        console.log(`✓ Using existing BCI employer: ${bciMatch.name} (BCI ID: ${companyData.companyId})`);
        return bciMatch.id;
      }
    }
    
    // Step 2: Check for exact name match
    const { data: exactMatch } = await supabase
      .from('employers')
      .select('id, name, address_line_1, suburb, state')
      .eq('name', companyData.companyName)
      .maybeSingle();
    
    if (exactMatch) {
      console.log(`✓ Using existing employer: ${exactMatch.name} (ID: ${exactMatch.id})`);
      return exactMatch.id;
    }
    
    // Step 3: Create new employer WITH bci_company_id
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
        employer_type: 'large_contractor',
        bci_company_id: companyData.companyId  // ✅ ADD THIS CRITICAL FIELD
      })
      .select('id')
      .single();
    
    if (error) throw error;
    
    console.log(`✅ Created new employer: ${companyData.companyName} (ID: ${data.id}, BCI ID: ${companyData.companyId || 'MISSING'})`);
    
    // Debug: Log what we actually inserted
    if (!companyData.companyId) {
      console.warn(`⚠️ WARNING: Created employer without BCI Company ID! Company: ${companyData.companyName}`);
      console.log('CSV Row data:', companyData);
    }
    
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
      
      // Create consolidated view for better UX
      if (useConsolidatedView) {
        const consolidated = createConsolidatedMatches(processed, matches);
        setConsolidatedMatches(consolidated);
      }
      
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
    setIsProcessing(true);
    setImportProgress({ current: 0, total: processedData.length, currentItem: 'Starting projects-only import...' });
    
    const results = {
      success: 0,
      errors: [] as string[],
      projectsCreated: [] as string[],
      employersCreated: 0,
      employersMatched: 0
    };

    console.log(`🚀 Starting projects-only import of ${processedData.length} projects...`);

    for (let i = 0; i < processedData.length; i++) {
      const project = processedData[i];
      
      setImportProgress(prev => ({ 
        ...prev, 
        current: i + 1, 
        currentItem: `Creating ${project.projectName}...` 
      }));
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
    
    console.log(`✅ Projects-only import complete! Created ${results.success} projects.`);
    
    setImportProgress({ current: processedData.length, total: processedData.length, currentItem: 'Import complete!' });
    
    // Brief delay to show completion, then clear progress
    setTimeout(() => {
      setImportProgress({ current: 0, total: 0, currentItem: '' });
      setIsProcessing(false);
    }, 2000);
    
    setImportResults(results);
    setCurrentStep('complete');
  };

  // Move to trade type confirmation step
  const confirmEmployerMatches = () => {
    console.log('confirmEmployerMatches called, current state:', employerMatches);
    // Always show trade type confirmation step for user review
    setCurrentStep('trade_type_confirmation');
    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Batch stage all unmatched employers to pending_employers table
  const stageAllUnmatchedEmployers = async () => {
    try {
      console.log('🚀 Starting batch staging of all unmatched employers...');
      console.log(`📊 Processing ${processedData.length} projects`);
      
      // Group all companies by BCI Company ID first, then by normalized name
      const employerGroups = new Map<string, {
        companyId?: string;
        companyName: string;
        projectAssociations: Array<{
          project_id: string;
          project_name: string;
          csv_role: string;
        }>;
        csvRows: BCICsvRow[];
        inferredRole: string;
        inferredTradeType?: string;
      }>();

      let totalCompanies = 0;
      let importableCompanies = 0;

      // Process all companies from all projects
      processedData.forEach(project => {
        project.companies.forEach(company => {
          totalCompanies++;
          if (!company.shouldImport) {
            console.log(`⏭️ Skipping ${company.companyName} (shouldImport: false, role: ${company.ourRole})`);
            return;
          }
          importableCompanies++;

          const csvRow = csvData.find(row => 
            row.projectId === project.projectId && 
            row.companyName === company.companyName
          );

          if (!csvRow) return;

          // Use BCI Company ID as primary key, fallback to normalized name
          const primaryKey = csvRow.companyId || normalizeCompanyName(company.companyName);
          
          const existing = employerGroups.get(primaryKey);
          const projectAssociation = {
            project_id: project.projectId,
            project_name: project.projectName,
            csv_role: company.csvRole
          };

          if (existing) {
            // Check if this project association already exists
            const hasAssociation = existing.projectAssociations.some(pa => 
              pa.project_id === projectAssociation.project_id && 
              pa.csv_role === projectAssociation.csv_role
            );
            
            if (!hasAssociation) {
              existing.projectAssociations.push(projectAssociation);
              existing.csvRows.push(csvRow);
            }
          } else {
            employerGroups.set(primaryKey, {
              companyId: csvRow.companyId,
              companyName: company.companyName,
              projectAssociations: [projectAssociation],
              csvRows: [csvRow],
              inferredRole: company.ourRole,
              inferredTradeType: company.tradeType
            });
          }
        });
      });

      // Insert all unique employers to pending_employers table
      const supabase = getSupabaseBrowserClient();
      const pendingEmployersToInsert = Array.from(employerGroups.values()).map(group => ({
        company_name: group.companyName,
        csv_role: group.csvRows.map(r => r.roleOnProject).join(', '), // Combine all roles
        source: 'bci',
        bci_company_id: group.companyId || null,
        inferred_trade_type: group.inferredTradeType,
        our_role: group.inferredRole,
        project_associations: group.projectAssociations,
        raw: group.csvRows[0] // Use first CSV row as representative
      }));

      console.log(`📈 Summary:`);
      console.log(`  - Total companies in CSV: ${totalCompanies}`);
      console.log(`  - Importable companies: ${importableCompanies}`);
      console.log(`  - Unique employers to stage: ${pendingEmployersToInsert.length}`);
      console.log(`  - Total project associations: ${employerGroups.size}`);

      if (pendingEmployersToInsert.length === 0) {
        alert('No employers found to stage. This could mean:\n\n1. All companies are marked as non-construction (consultants, engineers, etc.)\n2. All companies are already staged\n3. No companies meet the import criteria\n\nCheck the browser console for detailed logs.');
        return;
      }

      // Batch insert to pending_employers
      const { data, error } = await supabase
        .from('pending_employers')
        .insert(pendingEmployersToInsert)
        .select('id, company_name');

      if (error) {
        console.error('Batch insert failed:', error);
        alert(`Failed to stage employers: ${error.message}`);
        return;
      }

      console.log(`✅ Successfully staged ${data?.length || 0} employers`);
      alert(`✅ Successfully staged ${data?.length || 0} unique employers for import!\n\nGo to the Pending Employers Import page to review and import them.`);

    } catch (error) {
      console.error('Error staging employers:', error);
      alert(`Error staging employers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    setIsProcessing(true);
    setImportProgress({ current: 0, total: processedData.length, currentItem: 'Starting import...' });
    
    const results = {
      success: 0,
      errors: [] as string[],
      projectsCreated: [] as string[],
      employersCreated: 0,
      employersMatched: 0
    };

    console.log(`🚀 Starting BCI import of ${processedData.length} projects...`);

    for (let i = 0; i < processedData.length; i++) {
      const project = processedData[i];
      
      setImportProgress(prev => ({ 
        ...prev, 
        current: i + 1, 
        currentItem: `Importing ${project.projectName}...` 
      }));
      try {
        const supabase = getSupabaseBrowserClient();
        
        // Check if project already exists by BCI ID
        const { data: existingProject } = await supabase
          .from('projects')
          .select('id')
          .eq('bci_project_id', project.projectId)
          .maybeSingle();

        let projectId: string;
        if (existingProject) {
          // Update existing project with new data (overwrite approach)
          console.log(`✓ Updating existing project: ${project.projectName} (BCI ID: ${project.projectId})`);
          const { error: updateError } = await supabase
            .from('projects')
            .update({
              name: project.projectName,
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
              ),
              funding_type_primary: project.fundingTypePrimary,
              owner_type_level_1: project.ownerTypeLevel1Primary
            })
            .eq('id', existingProject.id)
            .select('id');
          
          if (updateError) throw updateError;
          projectId = existingProject.id;
        } else {
          // Create new project
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
              ),
              funding_type_primary: project.fundingTypePrimary,
              owner_type_level_1: project.ownerTypeLevel1Primary
            })
            .select('id')
            .single();

          if (projectError) throw projectError;
          projectId = newProject.id;
        }

        // Create or update main job site with coordinates
        const { data: existingJobSite } = await supabase
          .from('job_sites')
          .select('id')
          .eq('project_id', projectId)
          .eq('is_main_site', true)
          .maybeSingle();

        let jobSiteId: string;
        if (existingJobSite) {
          // Update existing job site
          const { error: siteUpdateError } = await supabase
            .from('job_sites')
            .update({
              name: project.projectName,
              location: `${project.projectAddress}, ${project.projectTown}, ${project.projectState} ${project.postCode}`,
              full_address: `${project.projectAddress}, ${project.projectTown}, ${project.projectState} ${project.postCode}`,
              latitude: project.latitude,
              longitude: project.longitude
            })
            .eq('id', existingJobSite.id)
            .select('id')
            .single();
          
          if (siteUpdateError) throw siteUpdateError;
          jobSiteId = existingJobSite.id;
        } else {
          // Create new job site
          const { data: jobSite, error: siteError } = await supabase
            .from('job_sites')
            .insert({
              name: project.projectName,
              location: `${project.projectAddress}, ${project.projectTown}, ${project.projectState} ${project.postCode}`,
              full_address: `${project.projectAddress}, ${project.projectTown}, ${project.projectState} ${project.postCode}`,
              project_id: projectId,
              is_main_site: true,
              latitude: project.latitude,
              longitude: project.longitude
            })
            .select('id')
            .single();

          if (siteError) throw siteError;
          jobSiteId = jobSite.id;
        }

        // Update project with main job site if needed
        await supabase
          .from('projects')
          .update({ main_job_site_id: jobSiteId })
          .eq('id', projectId);

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
              // Use the new assign_bci_builder function to handle multiple builders intelligently
              try {
                const { data: builderResult, error: builderError } = await supabase.rpc('assign_bci_builder', {
                  p_project_id: projectId,
                  p_employer_id: employerId,
                  p_company_name: company.companyName
                });
                
                if (builderError) {
                  console.error(`Error assigning builder ${company.companyName}:`, builderError);
                } else {
                  const result = builderResult?.[0];
                  if (result?.success) {
                    console.log(`✓ ${result.message}`);
                  } else {
                    console.warn(`⚠ Failed to assign builder: ${result?.message || 'Unknown error'}`);
                  }
                }
              } catch (error) {
                console.error(`Error in BCI builder assignment:`, error);
                // Fallback to original logic
                const { data: currentProject } = await supabase
                  .from('projects')
                  .select('id, builder_id')
                  .eq('id', projectId)
                  .maybeSingle();
                
                if (!currentProject?.builder_id) {
                  await supabase
                    .from('projects')
                    .update({ builder_id: employerId })
                    .eq('id', projectId);
                  console.log(`✓ Assigned builder to ${project.projectName} (fallback)`);
                }
              }
              
            } else if (company.ourRole === 'head_contractor') {
              // Assign as head contractor via new RPC
              try {
                const { data: hcResult, error: hcError } = await supabase.rpc('assign_contractor_role', {
                  p_project_id: projectId,
                  p_employer_id: employerId,
                  p_role_code: company.roleCode || 'head_contractor',
                  p_company_name: company.companyName,
                  p_is_primary: false
                });
                if (hcError) {
                  console.error(`Error assigning head contractor ${company.companyName}:`, hcError);
                } else {
                  const result = hcResult?.[0];
                  console.log(result?.message || `✓ Assigned ${company.companyName} as head_contractor`);
                }
              } catch (e) {
                console.error('Head contractor assignment failed:', e);
              }
              
            } else if (company.ourRole === 'subcontractor') {
              // Assign multiple trade types if detected, otherwise use single assignment
              const tradeTypesToAssign = company.tradeTypes && company.tradeTypes.length > 1 
                ? company.tradeTypes 
                : [finalTradeType];
              
              // Assign all trade types via RPC (supports multiple per employer)
              for (const tt of tradeTypesToAssign) {
                try {
                  const { data: tRes, error: tErr } = await supabase.rpc('assign_contractor_trade', {
                    p_project_id: projectId,
                    p_employer_id: employerId,
                    p_trade_type: tt,
                    p_company_name: company.companyName
                  });
                  if (tErr) {
                    console.error(`Error assigning ${company.companyName} to ${tt}:`, tErr);
                    results.errors.push(`Failed to assign ${company.companyName} to ${tt}: ${tErr.message}`);
                  } else {
                    const r = tRes?.[0];
                    console.log(r?.message || `✓ Assigned ${company.companyName} to ${tt}`);
                  }
                } catch (e) {
                  console.error(`Trade assignment exception for ${company.companyName}/${tt}:`, e);
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

    console.log(`✅ BCI import complete! Created/updated ${results.success} projects, ${results.employersCreated} employers created, ${results.employersMatched} employers matched.`);
    
    setImportProgress({ current: processedData.length, total: processedData.length, currentItem: 'Import complete!' });
    
    // Brief delay to show completion, then clear progress
    setTimeout(() => {
      setImportProgress({ current: 0, total: 0, currentItem: '' });
      setIsProcessing(false);
    }, 2000);
    
    setImportResults(results);
    setCurrentStep('complete');
  };

  // Employers to existing projects only, matching by BCI Project ID
  const performEmployersToExistingImport = async () => {
    setIsProcessing(true);
    setImportProgress({ current: 0, total: processedData.length, currentItem: 'Starting employers-to-existing import...' });
    
    const results = {
      success: 0,
      errors: [] as string[],
      projectsCreated: [] as string[],
      employersCreated: 0,
      employersMatched: 0
    };

    console.log(`🚀 Starting employers-to-existing import for ${processedData.length} projects...`);

    for (let i = 0; i < processedData.length; i++) {
      const project = processedData[i];
      
      setImportProgress(prev => ({ 
        ...prev, 
        current: i + 1, 
        currentItem: `Processing ${project.projectName}...` 
      }));
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

          // Enhanced relationship creation with multiple builder support
          if (company.ourRole === 'builder') {
            try {
              const { data: builderResult, error: builderError } = await supabase.rpc('assign_bci_builder', {
                p_project_id: existingProject.id,
                p_employer_id: employerId,
                p_company_name: company.companyName
              });
              
              if (builderError) {
                console.error(`Error assigning builder ${company.companyName}:`, builderError);
                results.errors.push(`Failed to assign builder ${company.companyName} to ${project.projectName}: ${builderError.message}`);
              } else {
                const result = builderResult?.[0];
                if (result?.success) {
                  console.log(`✓ ${result.message}`);
                } else {
                  results.errors.push(`Failed to assign builder ${company.companyName}: ${result?.message || 'Unknown error'}`);
                }
              }
            } catch (error) {
              console.error(`Error in BCI builder assignment:`, error);
              results.errors.push(`Error assigning builder ${company.companyName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            
          } else if (company.ourRole === 'head_contractor') {
            try {
              const { data: hcRes, error: hcErr } = await supabase.rpc('assign_contractor_role', {
                p_project_id: existingProject.id,
                p_employer_id: employerId,
                p_role_code: company.roleCode || 'head_contractor',
                p_company_name: company.companyName,
                p_is_primary: false
              });
              if (hcErr) {
                console.error('Head contractor assignment failed:', hcErr);
              } else {
                const r = hcRes?.[0];
                console.log(r?.message || `✓ Assigned head contractor for ${project.projectName}`);
              }
            } catch (e) {
              console.error('Head contractor RPC error:', e);
            }
            
          } else if (company.ourRole === 'subcontractor') {
            const finalTradeType = company.tradeType || 'general_construction';
            
            // Use enhanced trade assignment that handles conflicts
            try {
              const { data: tradeResult, error: tradeError } = await supabase.rpc('assign_contractor_trade', {
                p_project_id: existingProject.id,
                p_employer_id: employerId,
                p_trade_type: finalTradeType,
                p_company_name: company.companyName
              });
              
              if (tradeError) {
                console.error(`Error assigning trade ${finalTradeType} to ${company.companyName}:`, tradeError);
                results.errors.push(`${project.projectName}: Failed to assign trade ${finalTradeType} to ${company.companyName}: ${tradeError.message}`);
              } else {
                const result = tradeResult?.[0];
                if (result?.success) {
                  console.log(`✓ ${result.message} (${project.projectName})`);
                } else {
                  console.warn(`⚠ Trade assignment issue: ${result?.message || 'Unknown error'}`);
                }
              }
            } catch (error) {
              console.error(`Error in trade assignment:`, error);
              results.errors.push(`${project.projectName}: Trade assignment failed for ${company.companyName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    
    console.log(`✅ Employers-to-existing import complete! Processed ${results.success} projects, ${results.employersCreated} employers created, ${results.employersMatched} employers matched.`);
    
    setImportProgress({ current: processedData.length, total: processedData.length, currentItem: 'Import complete!' });
    
    // Brief delay to show completion, then clear progress
    setTimeout(() => {
      setImportProgress({ current: 0, total: 0, currentItem: '' });
      setIsProcessing(false);
    }, 2000);
    
    setImportResults(results);
    setCurrentStep('complete');
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
                bci_company_id: csvRow.companyId || null, // Store BCI Company ID
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

  // Validate that projects exist before import
  const validateProjects = async () => {
    setProjectValidation(prev => ({ ...prev, isValidating: true }));
    
    try {
      const supabase = getSupabaseBrowserClient();
      const uniqueProjectIds = [...new Set(processedData.map(p => p.projectId))];
      
      const { data: existingProjects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', uniqueProjectIds);
      
      const existingIds = new Set(existingProjects?.map(p => p.id) || []);
      const validProjects = uniqueProjectIds.filter(id => existingIds.has(id));
      const missingProjects = uniqueProjectIds.filter(id => !existingIds.has(id));
      
      setProjectValidation({
        isValidating: false,
        validProjects,
        missingProjects,
        showValidationDialog: missingProjects.length > 0
      });
      
      return { validProjects, missingProjects };
    } catch (error) {
      console.error('Error validating projects:', error);
      setProjectValidation(prev => ({ ...prev, isValidating: false }));
      return { validProjects: [], missingProjects: [] };
    }
  };

  // Help Dialog Component
  const HelpDialog = () => (
    <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
          <HelpCircle className="h-4 w-4 text-gray-500" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Employer Import Options</DialogTitle>
          <DialogDescription>
            Choose how to handle unmatched employers from your BCI data
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-green-800">Accept All As New (Recommended)</h4>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Creates new employer records directly in the database with complete BCI data including Company IDs.
            </p>
            <div className="text-xs text-gray-500">
              ✅ Direct creation • ✅ Complete data • ✅ No staging required • ✅ Immediate import
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Plus className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-blue-800">Stage All Unmatched Employers</h4>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Saves unmatched employers to a staging area for later review and manual processing.
            </p>
            <div className="text-xs text-gray-500">
              ⚠️ Requires manual navigation to "Upload Data → Employers" • ⚠️ Additional review step required
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="h-5 w-5 text-purple-600" />
              <h4 className="font-semibold text-purple-800">Stage + Import All</h4>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Stages employers and automatically navigates you to the Employers import page for immediate processing.
            </p>
            <div className="text-xs text-gray-500">
              ⚠️ Auto-navigation • ⚠️ Still requires manual review and import on next page
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800">
              <strong>Recommendation:</strong> Use "Accept All As New" for the cleanest, most direct workflow. 
              The staging options are only needed if you want to review employers before importing them.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Project Validation Dialog Component
  const ProjectValidationDialog = () => (
    <Dialog open={projectValidation.showValidationDialog} onOpenChange={(open) => 
      setProjectValidation(prev => ({ ...prev, showValidationDialog: open }))
    }>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Missing Projects Detected
          </DialogTitle>
          <DialogDescription>
            Some projects from your BCI data don't exist in the database yet.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <h4 className="font-semibold text-red-800 mb-2">
                Missing Projects ({projectValidation.missingProjects.length})
              </h4>
              <div className="max-h-32 overflow-y-auto">
                {projectValidation.missingProjects.map(projectId => (
                  <div key={projectId} className="text-sm text-red-700 py-1">
                    • {projectId}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <h4 className="font-semibold text-green-800 mb-2">
                Valid Projects ({projectValidation.validProjects.length})
              </h4>
              <div className="max-h-32 overflow-y-auto">
                {projectValidation.validProjects.slice(0, 10).map(projectId => (
                  <div key={projectId} className="text-sm text-green-700 py-1">
                    • {projectId}
                  </div>
                ))}
                {projectValidation.validProjects.length > 10 && (
                  <div className="text-sm text-green-600 italic">
                    ... and {projectValidation.validProjects.length - 10} more
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800">
              <strong>What would you like to do?</strong>
            </p>
            <div className="mt-2 space-y-2 text-sm text-blue-700">
              <div>• <strong>Import Projects First:</strong> Cancel this import and upload the missing projects</div>
              <div>• <strong>Import Employers Only:</strong> Create employers without project relationships (can be linked later)</div>
              <div>• <strong>Import Valid Only:</strong> Only import employers for existing projects</div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={() => setProjectValidation(prev => ({ ...prev, showValidationDialog: false }))}
            >
              Cancel Import
            </Button>
            <Button 
              variant="secondary"
              onClick={() => {
                // Filter to only valid projects
                const validProjectIds = new Set(projectValidation.validProjects);
                const filteredData = processedData.filter(p => validProjectIds.has(p.projectId));
                setProcessedData(filteredData);
                setProjectValidation(prev => ({ ...prev, showValidationDialog: false }));
                alert(`✅ Filtered to ${filteredData.length} projects with valid project IDs`);
              }}
            >
              Import Valid Projects Only
            </Button>
            <Button 
              onClick={() => {
                setProjectValidation(prev => ({ ...prev, showValidationDialog: false }));
                // Continue with import but employers won't have project relationships
                alert(`⚠️ Continuing import without project relationships. You can link projects later.`);
              }}
            >
              Import Employers Without Projects
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Import Model Selection Dialog Component
  const ImportModelDialog = () => {
    const consolidatedArray = Array.from(consolidatedMatches.values());
    const totalEmployers = consolidatedMatches.size;
    const exactMatches = consolidatedArray.filter(c => c.confidence === 'exact').length;
    const fuzzyMatches = consolidatedArray.filter(c => c.confidence === 'fuzzy').length;
    const noMatches = consolidatedArray.filter(c => c.confidence === 'none').length;
    const unconfirmedCount = consolidatedArray.filter(c => !c.userConfirmed).length;
    const confirmedCount = consolidatedArray.filter(c => c.userConfirmed).length;
    
    const getRecommendation = () => {
      const highConfidenceRatio = exactMatches / totalEmployers;
      const complexDataThreshold = totalEmployers > 50;
      const manyDuplicatesRatio = fuzzyMatches / totalEmployers > 0.3;
      
      if (highConfidenceRatio > 0.7 && !complexDataThreshold) return 'direct';
      if (manyDuplicatesRatio || complexDataThreshold) return 'stage';
      return 'guided';
    };
    
    const recommendation = getRecommendation();
    
    const selectImportModel = (model: 'direct' | 'stage' | 'guided') => {
      setSelectedImportModel(model);
      setShowImportModelDialog(false);
      
      // Execute the selected workflow
      switch (model) {
        case 'direct':
          markAllAsCreateNew();
          break;
        case 'stage':
          stageAllUnmatchedEmployers();
          break;
        case 'guided':
          stageAndImportAll();
          break;
      }
    };
    
    return (
      <Dialog open={showImportModelDialog} onOpenChange={setShowImportModelDialog}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Choose Your Import Strategy</DialogTitle>
            <DialogDescription>
              {confirmedCount} of {totalEmployers} employers are ready. How would you like to proceed?
            </DialogDescription>
          </DialogHeader>
          
          {/* Data Quality Summary */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{exactMatches}</div>
              <div className="text-xs text-gray-600">Exact Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{fuzzyMatches}</div>
              <div className="text-xs text-gray-600">Fuzzy Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{noMatches}</div>
              <div className="text-xs text-gray-600">No Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{unconfirmedCount}</div>
              <div className="text-xs text-gray-600">Unconfirmed</div>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            {/* Quick Import */}
            <Card 
              className={`cursor-pointer transition-all ${
                recommendation === 'direct' 
                  ? 'ring-2 ring-green-400 bg-green-50 border-green-200' 
                  : 'hover:bg-green-50 border-2 border-transparent hover:border-green-200'
              }`}
              onClick={() => selectImportModel('direct')}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <CardTitle className="text-lg">Quick Import</CardTitle>
                  {recommendation === 'direct' && (
                    <Badge className="bg-green-100 text-green-800 ml-auto">Recommended</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">
                  Create employers immediately with full BCI data. Best for clean, trusted data with high match confidence.
                </p>
                <div className="space-y-1 text-xs">
                  <div className="text-green-700">✅ Fastest workflow (~30 seconds)</div>
                  <div className="text-green-700">✅ Complete BCI data with Company IDs</div>
                  <div className="text-green-700">✅ Immediate project linking</div>
                  <div className="text-green-700">✅ No additional steps required</div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  <strong>Best for:</strong> High-quality data, small-medium imports, single-user workflows
                </div>
              </CardContent>
            </Card>

            {/* Review & Validate */}
            <Card 
              className={`cursor-pointer transition-all ${
                recommendation === 'stage' 
                  ? 'ring-2 ring-blue-400 bg-blue-50 border-blue-200' 
                  : 'hover:bg-blue-50 border-2 border-transparent hover:border-blue-200'
              }`}
              onClick={() => selectImportModel('stage')}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Search className="h-6 w-6 text-blue-600" />
                  <CardTitle className="text-lg">Review & Validate</CardTitle>
                  {recommendation === 'stage' && (
                    <Badge className="bg-blue-100 text-blue-800 ml-auto">Recommended</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">
                  Stage for advanced duplicate detection and manual review. Navigate to dedicated import tools.
                </p>
                <div className="space-y-1 text-xs">
                  <div className="text-blue-700">🔍 Advanced fuzzy duplicate detection</div>
                  <div className="text-blue-700">📝 Manual data validation & editing</div>
                  <div className="text-blue-700">🔄 Bulk merge capabilities</div>
                  <div className="text-blue-700">📊 Detailed import audit trails</div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  <strong>Best for:</strong> Large imports, dirty data, multi-user approval workflows
                </div>
              </CardContent>
            </Card>

            {/* Guided Workflow */}
            <Card 
              className={`cursor-pointer transition-all ${
                recommendation === 'guided' 
                  ? 'ring-2 ring-purple-400 bg-purple-50 border-purple-200' 
                  : 'hover:bg-purple-50 border-2 border-transparent hover:border-purple-200'
              }`}
              onClick={() => selectImportModel('guided')}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-6 w-6 text-purple-600" />
                  <CardTitle className="text-lg">Guided Workflow</CardTitle>
                  {recommendation === 'guided' && (
                    <Badge className="bg-purple-100 text-purple-800 ml-auto">Recommended</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">
                  Stage employers and automatically navigate to advanced import tools with guided steps.
                </p>
                <div className="space-y-1 text-xs">
                  <div className="text-purple-700">🎯 Auto-navigation to import tools</div>
                  <div className="text-purple-700">👥 Step-by-step guided process</div>
                  <div className="text-purple-700">📊 Comprehensive audit trail</div>
                  <div className="text-purple-700">🔄 Rollback capabilities</div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  <strong>Best for:</strong> Mixed data quality, training scenarios, multi-step approval
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recommendation explanation */}
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Our Recommendation:</strong> 
              {recommendation === 'direct' && " Quick Import - Your data has high match confidence and is suitable for direct creation."}
              {recommendation === 'stage' && " Review & Validate - Your data has many potential duplicates or is complex and would benefit from manual review."}
              {recommendation === 'guided' && " Guided Workflow - Your data has mixed quality and would benefit from a step-by-step approach."}
            </AlertDescription>
          </Alert>
          
          <div className="flex justify-between items-center pt-4">
            <Button variant="outline" onClick={() => setShowImportModelDialog(false)}>
              Cancel
            </Button>
            <div className="text-sm text-gray-500">
              Choose the approach that best fits your data quality and workflow needs
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
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

  // Consolidated view functions
  const updateConsolidatedMatch = (normalizedName: string, updates: Partial<ConsolidatedEmployerMatch>) => {
    setConsolidatedMatches(prev => {
      const updated = new Map(prev);
      const existing = updated.get(normalizedName);
      if (existing) {
        updated.set(normalizedName, { ...existing, ...updates });
      }
      return updated;
    });
  };

  const applyBulkRole = (normalizedName: string, role: 'builder' | 'head_contractor' | 'subcontractor') => {
    const consolidated = consolidatedMatches.get(normalizedName);
    if (!consolidated) return;

    // Update consolidated match
    updateConsolidatedMatch(normalizedName, { 
      bulkRole: role,
      hasConsistentRole: true 
    });

    // Update all project assignments
    consolidated.projectAssignments.forEach(pa => {
      pa.ourRole = role;
    });

    // Update processed data
    setProcessedData(prev => prev.map(project => ({
      ...project,
      companies: project.companies.map(company => {
        if (normalizeCompanyName(company.companyName) === normalizedName) {
          return { ...company, ourRole: role };
        }
        return company;
      })
    })));

    // Update individual employer matches
    setEmployerMatches(prev => {
      const updated = { ...prev };
      consolidated.projectAssignments.forEach(pa => {
        if (updated[pa.matchKey]) {
          // Update corresponding individual match (for backward compatibility)
        }
      });
      return updated;
    });
  };

  const applyBulkTradeType = (normalizedName: string, tradeType: TradeType) => {
    const consolidated = consolidatedMatches.get(normalizedName);
    if (!consolidated) return;

    // Update consolidated match
    updateConsolidatedMatch(normalizedName, { 
      bulkTradeType: tradeType,
      hasConsistentTrade: true 
    });

    // Update all subcontractor project assignments
    consolidated.projectAssignments.forEach(pa => {
      if (pa.ourRole === 'subcontractor') {
        pa.finalTradeType = tradeType;
        pa.tradeTypeConfirmed = true;
      }
    });

    // Update employer matches for subcontractor assignments
    setEmployerMatches(prev => {
      const updated = { ...prev };
      consolidated.projectAssignments.forEach(pa => {
        if (pa.ourRole === 'subcontractor' && updated[pa.matchKey]) {
          updated[pa.matchKey] = {
            ...updated[pa.matchKey],
            finalTradeType: tradeType,
            tradeTypeConfirmed: true
          };
        }
      });
      return updated;
    });
  };

  const confirmConsolidatedEmployer = (normalizedName: string) => {
    const consolidated = consolidatedMatches.get(normalizedName);
    if (!consolidated) return;

    // Mark as confirmed
    updateConsolidatedMatch(normalizedName, { userConfirmed: true });

    // Update all individual matches
    setEmployerMatches(prev => {
      const updated = { ...prev };
      consolidated.projectAssignments.forEach(pa => {
        if (updated[pa.matchKey]) {
          updated[pa.matchKey] = {
            ...updated[pa.matchKey],
            userConfirmed: true,
            matchedEmployerId: consolidated.matchedEmployerId,
            matchedEmployerName: consolidated.matchedEmployerName,
            confidence: consolidated.confidence,
            action: consolidated.action
          };
        }
      });
      return updated;
    });
  };

  const autoConfirmExactMatches = async () => {
    setIsAutoConfirming(true);
    const exactMatchesToConfirm = Array.from(consolidatedMatches.values())
      .filter(c => c.confidence === 'exact' && !c.userConfirmed);
    
    let confirmed = 0;
    for (const consolidated of exactMatchesToConfirm) {
      confirmConsolidatedEmployer(consolidated.normalizedName);
      confirmed++;
      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    setIsAutoConfirming(false);
    
    // Show success feedback with better UX
    if (confirmed > 0) {
      // Visual feedback with a brief highlight effect
      const toolbar = document.querySelector('.variant\\:desktop');
      if (toolbar) {
        toolbar.classList.add('ring-2', 'ring-green-400', 'ring-opacity-50');
        setTimeout(() => {
          toolbar.classList.remove('ring-2', 'ring-green-400', 'ring-opacity-50');
        }, 2000);
      }
      
      // Success message
      setTimeout(() => {
        alert(`✅ Auto-confirmed ${confirmed} exact employer matches!\n\nThese assignments are now ready for import. You can see the updated count in the toolbar.`);
      }, 200);
    }
  };

  // Render consolidated employer card
  const renderConsolidatedEmployerCard = (consolidated: ConsolidatedEmployerMatch) => {
    const totalProjects = consolidated.projectAssignments.length;
    const uniqueRoles = [...new Set(consolidated.projectAssignments.map(pa => pa.ourRole))];
    const needsTradeType = consolidated.projectAssignments.some(pa => pa.ourRole === 'subcontractor' && !pa.tradeTypeConfirmed);
    const subcontractorCount = consolidated.projectAssignments.filter(pa => pa.ourRole === 'subcontractor').length;

    return (
      <Card key={consolidated.normalizedName} className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Checkbox
                  checked={consolidated.userConfirmed}
                  onCheckedChange={(checked: boolean) => {
                    if (checked) {
                      confirmConsolidatedEmployer(consolidated.normalizedName);
                    } else {
                      updateConsolidatedMatch(consolidated.normalizedName, { userConfirmed: false });
                    }
                  }}
                />
                {consolidated.companyName}
              </CardTitle>
              <CardDescription>
                Appears on {totalProjects} project{totalProjects !== 1 ? 's' : ''} • 
                Roles: {uniqueRoles.join(', ')}
                {consolidated.hasConsistentRole && (
                  <Badge variant="secondary" className="ml-2 text-xs">Consistent Role</Badge>
                )}
                {consolidated.hasConsistentTrade && subcontractorCount > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">Consistent Trade</Badge>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={consolidated.confidence === 'exact' ? 'default' : consolidated.confidence === 'fuzzy' ? 'secondary' : 'destructive'}>
                {consolidated.confidence === 'exact' ? 'Exact Match' : consolidated.confidence === 'fuzzy' ? 'Fuzzy Match' : 'No Match'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {/* Inline change action opens manual search directly */}
              <Button size="sm" variant="outline" onClick={() => {
                setSearchingForCompany(consolidated.matchedEmployerName || consolidated.companyName);
                setCurrentSearchMatchKey(consolidated.projectAssignments[0]?.matchKey || '');
                setShowManualSearch(true);
              }}>Change</Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Employer matching section */}
          {consolidated.confidence === 'exact' && consolidated.matchedEmployerName && (
            <div className="p-3 bg-green-50 rounded border border-green-200">
              <p className="text-sm font-medium text-green-800">
                ✓ Matched to: {consolidated.matchedEmployerName}
              </p>
            </div>
          )}

          {consolidated.confidence === 'fuzzy' && consolidated.suggestedMatches.length > 0 && (
            <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
              <p className="text-sm font-medium text-yellow-800 mb-2">Similar matches found:</p>
              <div className="space-y-1">
                {consolidated.suggestedMatches.slice(0, 3).map((suggestion) => (
                  <div key={suggestion.id} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                    <div>
                      <p className="font-medium">{suggestion.name}</p>
                      <p className="text-xs text-gray-600">{suggestion.address}</p>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        updateConsolidatedMatch(consolidated.normalizedName, {
                          matchedEmployerId: suggestion.id,
                          matchedEmployerName: suggestion.name,
                          confidence: 'exact',
                          action: 'confirm_match'
                        });
                      }}
                    >
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {consolidated.confidence === 'none' && (
            <div className="p-3 bg-red-50 rounded border border-red-200">
              <p className="text-sm font-medium text-red-800 mb-2">No matches found</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  // Trigger manual search for this employer
                  setSearchingForCompany(consolidated.companyName);
                  setShowManualSearch(true);
                }}>
                  Search Database
                </Button>
                <Button size="sm" onClick={() => {
                  updateConsolidatedMatch(consolidated.normalizedName, {
                    action: 'create_new',
                    userConfirmed: true
                  });
                }}>
                  Create New
                </Button>
              </div>
            </div>
          )}
          
          {/* Bulk role assignment */}
          {!consolidated.hasConsistentRole && uniqueRoles.length > 1 && (
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <label className="text-sm font-medium text-blue-800 mb-2 block">
                Multiple roles detected - set consistent role:
              </label>
              <Select
                value={consolidated.bulkRole || ''}
                onValueChange={(value) => applyBulkRole(consolidated.normalizedName, value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose consistent role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="builder">Builder (all projects)</SelectItem>
                  <SelectItem value="head_contractor">Head Contractor (all projects)</SelectItem>
                  <SelectItem value="subcontractor">Subcontractor (all projects)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Bulk trade type assignment */}
          {needsTradeType && (
            <div className="p-3 bg-purple-50 rounded border border-purple-200">
              <label className="text-sm font-medium text-purple-800 mb-2 block">
                Trade Type for {subcontractorCount} Subcontractor Assignment{subcontractorCount > 1 ? 's' : ''}:
              </label>
              <Select
                value={consolidated.bulkTradeType || ''}
                onValueChange={(value) => applyBulkTradeType(consolidated.normalizedName, value as TradeType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose trade type..." />
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
          
          {/* Project assignments summary */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Project Assignments:</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {consolidated.projectAssignments.map((pa) => (
                <div key={`${pa.projectId}-${pa.csvRole}`} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                  <span className="truncate flex-1">{pa.projectName}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {pa.ourRole}
                    </Badge>
                    {pa.ourRole === 'subcontractor' && (
                      <Badge variant="secondary" className="text-xs">
                        {pa.finalTradeType || pa.inferredTradeType || 'No trade'}
                        {/* Show multiple trade indicator */}
                        {(() => {
                          const project = processedData.find(p => p.projectId === pa.projectId);
                          const company = project?.companies.find(c => 
                            normalizeCompanyName(c.companyName) === consolidated.normalizedName && 
                            c.csvRole === pa.csvRole
                          );
                          return company?.tradeTypes && company.tradeTypes.length > 1 ? ` (+${company.tradeTypes.length - 1})` : '';
                        })()}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Quick actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                updateConsolidatedMatch(consolidated.normalizedName, {
                  action: 'skip',
                  userConfirmed: true
                });
              }}
            >
              Skip All Projects
            </Button>
            <Button 
              size="sm" 
              onClick={() => confirmConsolidatedEmployer(consolidated.normalizedName)}
              disabled={consolidated.confidence === 'none' && consolidated.action !== 'create_new'}
            >
              Confirm All Assignments
            </Button>
          </div>
        </CardContent>
      </Card>
    );
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

    // Render consolidated view if enabled
    if (useConsolidatedView && consolidatedMatches.size > 0) {
      const consolidatedArray = Array.from(consolidatedMatches.values());
      const confirmedCount = consolidatedArray.filter(c => c.userConfirmed).length;
      const exactMatches = consolidatedArray.filter(c => c.confidence === 'exact').length;
      const needsAttention = consolidatedArray.filter(c => !c.userConfirmed && c.confidence !== 'exact').length;

      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Enhanced Employer Matching</h2>
            <p className="text-gray-600">Consolidated view of {consolidatedMatches.size} unique employers across all projects</p>
            <p className="text-sm text-gray-500">
              {confirmedCount} confirmed • {exactMatches} exact matches • {needsAttention} need attention
            </p>
          </div>
          
          {/* Simplified toolbar with import model selection */}
          <Card className="variant:desktop">
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Quick actions row */}
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button 
                      size="sm" 
                      onClick={autoConfirmExactMatches} 
                      disabled={exactMatches === 0 || isAutoConfirming}
                      variant="outline"
                    >
                      {isAutoConfirming ? (
                        <>
                          <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
                          Confirming...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Auto-Confirm {exactMatches} Exact
                        </>
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setUseConsolidatedView(false)}
                    >
                      Detailed View
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={validateProjects}
                      disabled={projectValidation.isValidating}
                    >
                      {projectValidation.isValidating ? (
                        <>
                          <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Check Projects
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      {confirmedCount} / {consolidatedMatches.size} employers confirmed
                    </div>
                    {selectedImportModel && (
                      <Badge variant="outline" className="text-xs">
                        Strategy: {selectedImportModel === 'direct' ? 'Quick Import' : selectedImportModel === 'stage' ? 'Review & Validate' : 'Guided Workflow'}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Main import action */}
                {confirmedCount > 0 ? (
                  <div className="border-t pt-4">
                    <Button 
                      size="lg" 
                      className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold py-3"
                      onClick={() => setShowImportModelDialog(true)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <img src="/spinner.gif" alt="Loading" className="w-5 h-5 mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-5 h-5 mr-2" />
                          Choose Import Strategy ({confirmedCount}/{consolidatedMatches.size} ready)
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="border-t pt-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <span>Confirm employer matches above to enable import options.</span>
                          {exactMatches > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={autoConfirmExactMatches}
                              disabled={isAutoConfirming}
                              className="ml-4"
                            >
                              Quick-start: Confirm {exactMatches} Exact
                            </Button>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
              
              {/* Progress indicator */}
              {isProcessing && importProgress.total > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center gap-3 mb-2">
                    <img src="/spinner.gif" alt="Loading" className="w-5 h-5" />
                    <span className="text-sm font-medium text-blue-800">
                      {importProgress.currentItem}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {importProgress.current} of {importProgress.total} employers processed
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Consolidated employer cards */}
          <div className="space-y-4">
            {consolidatedArray
              .sort((a, b) => {
                // Sort by: unconfirmed first, then by confidence (exact > fuzzy > none)
                if (a.userConfirmed !== b.userConfirmed) {
                  return a.userConfirmed ? 1 : -1;
                }
                const confidenceOrder = { exact: 3, fuzzy: 2, none: 1 };
                return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
              })
              .map(renderConsolidatedEmployerCard)}
          </div>
          
          <div className="flex justify-center">
            <Button 
              onClick={confirmEmployerMatches}
              disabled={confirmedCount < consolidatedMatches.size}
              className="px-8"
            >
              Continue to Final Review ({confirmedCount}/{consolidatedMatches.size} confirmed)
            </Button>
          </div>
          
          {/* Manual Search Dialog - reuse existing */}
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
                      setShowManualSearch(false);
                      setSearchResults([]);
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
                            const normalizedName = normalizeCompanyName(searchingForCompany);
                            updateConsolidatedMatch(normalizedName, {
                              matchedEmployerId: result.id,
                              matchedEmployerName: result.name,
                              confidence: 'exact',
                              action: 'confirm_match'
                            });
                            setShowManualSearch(false);
                            setSearchResults([]);
                            setSearchingForCompany('');
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
                          const normalizedName = normalizeCompanyName(searchingForCompany);
                          updateConsolidatedMatch(normalizedName, {
                            action: 'create_new',
                            userConfirmed: true
                          });
                          setShowManualSearch(false);
                        }}
                      >
                        Create New Employer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // Fallback to original detailed view
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
        <div className="mt-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setUseConsolidatedView(true)}
          >
            Switch to Consolidated View
          </Button>
        </div>
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
                      
                      {/* Show detected multiple trade types if available */}
                      {company.tradeTypes && company.tradeTypes.length > 1 && (
                        <div className="p-3 bg-blue-50 rounded border border-blue-200 mb-2">
                          <p className="text-sm font-medium text-blue-800 mb-1">
                            🔍 Multiple trade types detected:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {company.tradeTypes.map((trade, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {getTradeTypeLabel(trade)}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-blue-700 mt-1">
                            Select primary trade type below. Multiple assignments will be created automatically during import.
                          </p>
                        </div>
                      )}
                      
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
                      
                      {company.tradeTypes && company.tradeTypes.length > 1 && (
                        <p className="text-xs text-gray-600">
                          ℹ️ This employer will be assigned to all {company.tradeTypes.length} detected trade types during import.
                        </p>
                      )}
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
               <Button onClick={() => onImportComplete && onImportComplete()} className="px-8">
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
        
        {/* Progress indicator for importing */}
        {importProgress.total > 0 && (
          <div className="max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-medium text-blue-800">
                {importProgress.currentItem}
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
            <div className="text-sm text-blue-600 mt-2">
              {importProgress.current} of {importProgress.total} projects processed
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {currentStep === 'preview' && renderPreview()}
      {currentStep === 'employer_matching' && renderEmployerMatching()}
      {currentStep === 'trade_type_confirmation' && renderTradeTypeConfirmation()}
      {currentStep === 'complete' && renderImportResults()}
      
      {/* Dialogs */}
      <ProjectValidationDialog />
      <ImportModelDialog />
    </div>
  );
}

export default BCIProjectImport;
