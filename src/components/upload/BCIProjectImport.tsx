'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, Loader2, Users, Building2, Wrench, MapPin, Search, Plus } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { inferTradeTypeFromCompanyName, getTradeTypeLabel, TradeType, getTradeTypeCategories } from '@/utils/bciTradeTypeInference';

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

interface BCIProjectImportProps {
  csvData: BCICsvRow[];
  onImportComplete: () => void;
}

export default function BCIProjectImport({ csvData, onImportComplete }: BCIProjectImportProps) {
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
          projectName: row.projectName,
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

  // Enhanced company classification
  const classifyCompany = (csvRole: string, companyName: string): CompanyClassification => {
    const role = csvRole.toLowerCase();
    const name = companyName.toLowerCase();
    
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
    
    // Classify construction companies
    if (role === 'contractor' || role === 'builder' || role === 'principal contractor') {
      return { 
        companyName, 
        csvRole, 
        ourRole: 'builder', 
        shouldImport: true,
        userConfirmed: false,
        userExcluded: false
      };
    }
    
    if (role === 'head contractor' || role === 'main contractor') {
      return { 
        companyName, 
        csvRole, 
        ourRole: 'head_contractor', 
        shouldImport: true,
        userConfirmed: false,
        userExcluded: false
      };
    }
    
    // Everything else is a subcontractor
    return { 
      companyName, 
      csvRole, 
      ourRole: 'subcontractor', 
      shouldImport: true,
      tradeType: inferTradeTypeFromCompanyName(companyName),
      userConfirmed: false,
      userExcluded: false
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
  const matchEmployer = async (companyName: string, csvRole: string): Promise<EmployerMatchResult> => {
    try {
      const supabase = getSupabaseBrowserClient();
      
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
      
      // 2. Try fuzzy matching with better logic
      const { data: fuzzyMatches, error: fuzzyError } = await supabase
        .from('employers')
        .select('id, name, address_line_1, suburb, state')
        .or(`name.ilike.%${companyName}%,name.ilike.${companyName}%`);
      
      if (fuzzyError) throw fuzzyError;
      
      if (fuzzyMatches && fuzzyMatches.length > 0) {
        // Sort by relevance (exact substring matches first)
        const sortedMatches = fuzzyMatches.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const companyNameLower = companyName.toLowerCase();
          
          const aExact = aName.includes(companyNameLower) || companyNameLower.includes(aName);
          const bExact = bName.includes(companyNameLower) || companyNameLower.includes(bName);
          
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          
          return aName.length - bName.length; // Shorter names first
        });
        
        return {
          companyName,
          csvRole,
          suggestedMatches: sortedMatches.slice(0, 5).map((m: any) => ({
            id: m.id,
            name: m.name,
            address: `${m.address_line_1 || ''} ${m.suburb || ''} ${m.state || ''}`.trim()
          })),
          confidence: 'fuzzy',
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
        suggestedMatches: [],
        action: 'create_new',
        userConfirmed: false,
        tradeTypeConfirmed: false
      };
    }
  };

  // Enhanced employer creation
  const createEmployer = async (companyData: any): Promise<string> => {
    const supabase = getSupabaseBrowserClient();
    
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
    return data.id;
  };

  // Start the enhanced import process
  const startImport = async () => {
    setIsProcessing(true);
    setCurrentStep('employer_matching');
    
    try {
      // Process CSV data
      const processed = processCSVData();
      setProcessedData(processed);
      
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
      
              for (const project of processed) {
          for (const company of project.companies) {
            if (company.shouldImport) {
              const matchResult = await matchEmployer(company.companyName, company.csvRole);
              const matchKey = `${project.projectId}-${company.companyName}-${company.csvRole}`;
              matches[matchKey] = matchResult;
              
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

  // Move to trade type confirmation step
  const confirmEmployerMatches = () => {
    console.log('confirmEmployerMatches called, current state:', employerMatches);
    setCurrentStep('trade_type_confirmation');
    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Move to import step
  const confirmTradeTypes = () => {
    setCurrentStep('importing');
    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    performImport();
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
            last_update_date: project.lastUpdateDate
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
              // Update project.builder_id
              await supabase
                .from('projects')
                .update({ builder_id: employerId })
                .eq('id', newProject.id);
            } else if (company.ourRole === 'head_contractor') {
              // Add to project_employer_roles
              await supabase
                .from('project_employer_roles')
                .insert({
                  project_id: newProject.id,
                  employer_id: employerId,
                  role: 'head_contractor'
                });
            } else if (company.ourRole === 'subcontractor') {
              // Add to project_contractor_trades
              await supabase
                .from('project_contractor_trades')
                .insert({
                  project_id: newProject.id,
                  employer_id: employerId,
                  trade_type: finalTradeType
                });
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

  // Update employer match action
  const updateEmployerMatch = (matchKey: string, action: 'confirm_match' | 'search_manual' | 'create_new' | 'add_to_list' | 'skip', employerId?: string) => {
    setEmployerMatches(prev => {
      const updated = {
        ...prev,
        [matchKey]: {
          ...prev[matchKey],
          action,
          matchedEmployerId: employerId,
          userConfirmed: true
        }
      };
      return updated;
    });
  };

  // Add employer to import list for later
  const addEmployerToList = (matchKey: string, company: CompanyClassification, projectId: string) => {
    const csvRow = csvData.find(row => 
      row.projectId === projectId && 
      row.companyName === company.companyName
    );
    
    if (csvRow) {
      setEmployersToAdd(prev => [...prev, {
        companyName: company.companyName,
        csvRole: company.csvRole,
        companyData: csvRow,
        matchKey
      }]);
      updateEmployerMatch(matchKey, 'add_to_list');
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
    try {
      const supabase = getSupabaseBrowserClient();
      
      const { data, error } = await supabase
        .from('employers')
        .select('id, name, address_line_1, suburb, state')
        .or(`name.ilike.%${searchTerm}%,name.ilike.${searchTerm}%`)
        .limit(10);
      
      if (error) throw error;
      
      const results = data?.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        address: `${emp.address_line_1 || ''} ${emp.suburb || ''} ${emp.state || ''}`.trim()
      })) || [];
      
      setSearchResults(results);
    } catch (error) {
      console.error('Manual search error:', error);
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
    
    return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Employer Matching</h2>
        <p className="text-gray-600">Review and confirm employer matches for each company</p>
        <p className="text-sm text-gray-500">
          {Object.keys(employerMatches).length} matches loaded • 
          {processedData.flatMap(p => p.companies).filter(c => c.shouldImport && c.ourRole === 'subcontractor').length} need trade type confirmation
        </p>
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
            {project.companies.filter(c => c.shouldImport).map((company, index) => {
              const matchKey = `${project.projectId}-${company.companyName}-${company.csvRole}`;
              const match = employerMatches[matchKey];
              
              if (!match) return null;
              
              return (
                <div key={`${matchKey}-${index}`} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{company.companyName}</h4>
                      <p className="text-sm text-gray-600">
                        Role: {company.csvRole} → {company.ourRole}
                      </p>
                    </div>
                    <Badge variant={match.confidence === 'exact' ? 'default' : match.confidence === 'fuzzy' ? 'secondary' : 'destructive'}>
                      {match.confidence === 'exact' ? 'Exact Match' : match.confidence === 'fuzzy' ? 'Fuzzy Match' : 'No Match'}
                    </Badge>
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
                          updateEmployerMatch(matchKey, 'confirm_match', match.matchedEmployerId);
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
                                updateEmployerMatch(matchKey, 'confirm_match', suggestion.id);
                              }}
                            >
                              {match.userConfirmed && match.matchedEmployerId === suggestion.id ? '✓ Selected' : 'Select This'}
                            </button>
                          </div>
                        ))}
                      </div>
                      
                                              {/* Action buttons for fuzzy matches */}
                      <div className="flex gap-2 mt-3 pt-3 border-t border-yellow-200">
                        <button 
                          className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                            match.userConfirmed && match.action === 'search_manual'
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
                          {match.userConfirmed && match.action === 'search_manual' ? '✓ Manual Search Selected' : 'Search Manually'}
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
                      <div className="flex gap-2 mt-2">
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
          disabled={Object.values(employerMatches).length === 0}
          className="px-8"
        >
          Continue to Trade Type Assignment ({Object.values(employerMatches).filter(m => m.userConfirmed).length}/{Object.values(employerMatches).length} confirmed)
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
                  'Search'
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setShowManualSearch(false);
                  setSearchResults([]);
                  setSearchingForCompany('');
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
                              updateEmployerMatch(currentSearchMatchKey, 'confirm_match', result.id);
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
              <div className="text-center py-4 text-gray-500">
                <p>No employers found matching "{searchingForCompany}"</p>
                <p className="text-sm mt-2">
                  You can close this dialog and choose "Add to Import List" or "Skip" from the main interface.
                </p>
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
          disabled={isProcessing}
          className="px-8"
        >
          {isProcessing ? (
            <>
              <img src="/spinner.gif" alt="Loading" className="w-4 h-4 mr-2" />
              Processing...
            </>
          ) : (
            'Start Employer Matching'
          )}
        </Button>
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
                     Go to <strong>Data Upload → Employers</strong> to import these companies.
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
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
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
