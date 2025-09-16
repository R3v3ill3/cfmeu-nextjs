import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Target, Plus, Eye, Brain, AlertTriangle } from "lucide-react";
type ParsedCSV = {
  headers: string[];
  rows: Array<Record<string, any>>;
}
type ColumnMapping = {
  csvColumn: string;
  dbTable: string;
  dbColumn: string;
  action: 'map' | 'create' | 'skip';
  confidence?: number;
  dataType?: 'text' | 'date' | 'number' | 'boolean';
}

interface ColumnMapperProps {
  parsedCSV: ParsedCSV;
  onMappingComplete: (table: string, mappings: ColumnMapping[]) => void;
  onBack: () => void;
  defaultTable?: string;
}

// Database schema for mapping
const DATABASE_TABLES = {
  patches: {
    label: "Patches",
    columns: {
      code: { type: "text", required: false, description: "Patch code (text, unique)" },
      name: { type: "text", required: true, description: "Patch name (e.g., Sydney)" },
      description: { type: "text", required: false, description: "Patch description" },
      type: { type: "text", required: false, description: "Patch type: geo, trade, or sub-sector" },
      organiser1: { type: "text", required: false, description: "Organiser 1 (full name or email)" },
      organiser2: { type: "text", required: false, description: "Organiser 2 (full name or email)" },
      sub_sector_1: { type: "text", required: false, description: "Sub-sector 1 (for trade patches)" },
      sub_sector_2: { type: "text", required: false, description: "Sub-sector 2" },
      sub_sector_3: { type: "text", required: false, description: "Sub-sector 3" },
      sub_sector_4: { type: "text", required: false, description: "Sub-sector 4" },
    }
  },
  workers: {
    label: "Workers",
    columns: {
      first_name: { type: "text", required: true, description: "Worker's first name" },
      surname: { type: "text", required: true, description: "Worker's surname/last name" },
      other_name: { type: "text", required: false, description: "Middle name or other names" },
      nickname: { type: "text", required: false, description: "Preferred name or nickname" },
      member_number: { type: "text", required: false, description: "Union member number" },
      email: { type: "text", required: false, description: "Email address" },
      home_phone: { type: "text", required: false, description: "Home phone number" },
      work_phone: { type: "text", required: false, description: "Work phone number" },
      mobile_phone: { type: "text", required: false, description: "Mobile phone number" },
      organiser_id: { type: "uuid", required: false, description: "Assigned organiser ID" },
      home_address_line_1: { type: "text", required: false, description: "Home address line 1" },
      home_address_line_2: { type: "text", required: false, description: "Home address line 2" },
      home_address_suburb: { type: "text", required: false, description: "Home address suburb" },
      home_address_postcode: { type: "text", required: false, description: "Home address postcode" },
      home_address_state: { type: "text", required: false, description: "Home address state" },
      
      date_of_birth: { type: "date", required: false, description: "Date of birth" },
      gender: { type: "text", required: false, description: "Gender" },
      union_membership_status: { type: "enum", required: false, description: "Union membership status", 
        options: ["member", "non_member", "potential_member"] },
      qualifications: { type: "array", required: false, description: "Qualifications (comma-separated)" },
      inductions: { type: "array", required: false, description: "Inductions (comma-separated)" },
      superannuation_fund: { type: "text", required: false, description: "Superannuation fund" },
      redundancy_fund: { type: "text", required: false, description: "Redundancy fund" }
    }
  },
  company_eba_records: {
    label: "EBA Records",
    columns: {
      company_name: { type: "text", required: true, description: "Company name" },
      eba_file_number: { type: "text", required: false, description: "EBA file number" },
      sector: { type: "text", required: false, description: "Industry sector" },
      contact_name: { type: "text", required: false, description: "Primary contact person" },
      contact_phone: { type: "text", required: false, description: "Contact phone number" },
      contact_email: { type: "text", required: false, description: "Contact email address" },
      comments: { type: "text", required: false, description: "Comments and notes" },
      docs_prepared: { type: "date", required: false, description: "Documents prepared date" },
      date_barg_docs_sent: { type: "date", required: false, description: "Bargaining documents sent date" },
      followup_email_sent: { type: "date", required: false, description: "Follow-up email sent date" },
      out_of_office_received: { type: "date", required: false, description: "Out of office email received date" },
      followup_phone_call: { type: "date", required: false, description: "Follow-up phone call date" },
      date_draft_signing_sent: { type: "date", required: false, description: "Draft/signing EBAs sent date" },
      eba_data_form_received: { type: "date", required: false, description: "EBA data form received date" },
      date_eba_signed: { type: "date", required: false, description: "EBA signed date" },
      date_vote_occurred: { type: "date", required: false, description: "Vote occurred date" },
      eba_lodged_fwc: { type: "date", required: false, description: "EBA lodged with FWC date" },
      fwc_lodgement_number: { type: "text", required: false, description: "FWC lodgement number" },
      fwc_matter_number: { type: "text", required: false, description: "FWC matter number" },
      fwc_certified_date: { type: "date", required: false, description: "FWC certified date" },
      fwc_document_url: { type: "text", required: false, description: "FWC document/agreement URL or link" }
    }
  },
  employers: {
    label: "Employers",
    columns: {
      name: { type: "text", required: true, description: "Employer name" },
      abn: { type: "text", required: false, description: "Australian Business Number" },
      employer_type: { type: "enum", required: true, description: "Type of employer",
        options: ["builder", "principal_contractor", "large_contractor", "small_contractor", "individual"] },
      phone: { type: "text", required: false, description: "Contact phone number" },
      email: { type: "email", required: false, description: "Contact email address" },
      address_line_1: { type: "text", required: false, description: "Address line 1" },
      address_line_2: { type: "text", required: false, description: "Address line 2" },
      suburb: { type: "text", required: false, description: "Suburb" },
      state: { type: "text", required: false, description: "State" },
      postcode: { type: "text", required: false, description: "Postcode" },
      website: { type: "text", required: false, description: "Website URL" },
      contact_notes: { type: "text", required: false, description: "Additional contact information" },
      incolink_id: { type: "text", required: false, description: "Incolink ID (unique identifier from Incolink system)" },
      incolink_last_matched: { type: "date", required: false, description: "Date when employer was last matched with Incolink data" }
    }
  },
  contractors: {
    label: "Contractors",
    columns: {
      trade: { type: "enum", required: true, description: "Primary trade type",
        options: ["tower_crane", "mobile_crane", "demolition", "scaffolding", "post_tensioning", "concreting", "form_work", "steel_fixing", "bricklaying", "traffic_control", "labour_hire", "carpentry", "windows", "painting", "waterproofing", "plastering", "edge_protection", "hoist", "kitchens", "tiling", "cleaning", "flooring", "structural_steel", "landscaping"] },
      company: { type: "text", required: true, description: "Company name" },
      contact_details: { type: "text", required: false, description: "Contact details (will be parsed into separate fields)" },
      eba_signatory: { type: "enum", required: false, description: "EBA signatory status",
        options: ["yes", "no", "not_specified"] }
    }
  },
  job_sites: {
    label: "Job Sites",
    columns: {
      name: { type: "text", required: true, description: "Site name" },
      location: { type: "text", required: true, description: "Site location" },
      project_type: { type: "text", required: false, description: "Type of project" },
      shifts: { type: "array", required: false, description: "Available shifts (comma-separated)",
        options: ["day", "night", "afternoon"] }
    }
  },
  worker_placements: {
    label: "Worker Placements",
    columns: {
      start_date: { type: "date", required: true, description: "Placement start date" },
      end_date: { type: "date", required: false, description: "Placement end date" },
      job_title: { type: "text", required: false, description: "Job title" },
      employment_status: { type: "enum", required: true, description: "Employment status",
        options: ["full_time", "part_time", "casual", "contract"] },
      shift: { type: "enum", required: false, description: "Work shift",
        options: ["day", "night", "afternoon"] }
    }
  },
  site_contractor_trades: {
    label: "Site Contractor Trades",
    columns: {
      job_site_id: { type: "uuid", required: true, description: "Job site ID (must match existing site)" },
      employer_id: { type: "uuid", required: true, description: "Employer/contractor ID (must match existing employer)" },
      trade_type: { type: "enum", required: true, description: "Trade type",
        options: ["tower_crane", "mobile_crane", "demolition", "scaffolding", "post_tensioning", "concreting", "form_work", "steel_fixing", "bricklaying", "traffic_control", "labour_hire", "carpentry", "windows", "painting", "waterproofing", "plastering", "edge_protection", "hoist", "kitchens", "tiling", "cleaning", "flooring", "structural_steel", "landscaping"] },
      eba_status: { type: "boolean", required: false, description: "Enterprise Bargaining Agreement status (true/false)" },
      start_date: { type: "date", required: false, description: "Contract start date" },
      end_date: { type: "date", required: false, description: "Contract end date" },
      notes: { type: "text", required: false, description: "Additional notes about the trade contract" }
    }
  },
  
  projects: {
    label: "Projects",
    columns: {
      name: { type: "text", required: true, description: "Project name (e.g., 'Southbank Redevelopment')" },
      value: { type: "number", required: false, description: "Project value in dollars" },
      builder_id: { type: "uuid", required: false, description: "Main builder/contractor ID (must match existing employer)" },
      proposed_start_date: { type: "date", required: false, description: "Proposed project start date" },
      proposed_finish_date: { type: "date", required: false, description: "Proposed project completion date" },
      roe_email: { type: "email", required: false, description: "Right of entry email address" },
      project_type: { type: "enum", required: false, description: "Project type", options: ["government","private","mixed"] },
      state_funding: { type: "number", required: false, description: "State funding amount (AUD)" },
      federal_funding: { type: "number", required: false, description: "Federal funding amount (AUD)" },
      main_job_site_address: { type: "text", required: true, description: "Main job site full address" },
      employer_name: { type: "text", required: false, description: "Builder/Head contractor employer name (auto-match/create)" },
      jv_status: { type: "enum", required: false, description: "JV status", options: ["yes","no","unsure"] },
      jv_label: { type: "text", required: false, description: "JV label (if status yes)" },
      organising_universe: { type: "enum", required: false, description: "Organising universe classification", options: ["active","potential","excluded"] },
      stage_class: { type: "enum", required: false, description: "Project stage classification", options: ["future","pre_construction","construction","archived"] }
    }
  },
  incolink: {
    label: "Incolink Data",
    columns: {
      employer_name: { type: "text", required: true, description: "Employer name for matching (maps to 'company name' in CSV)" },
      incolink_id: { type: "text", required: true, description: "Unique Incolink identifier" },
      contact_name: { type: "text", required: false, description: "Contact person name" },
      contact_phone: { type: "text", required: false, description: "Contact phone number" },
      contact_email: { type: "email", required: false, description: "Contact email address" },
      abn: { type: "text", required: false, description: "Australian Business Number" },
      address: { type: "text", required: false, description: "Business address" },
      notes: { type: "text", required: false, description: "Additional notes or comments" }
    }
  },
  
  organisers: {
    label: "Organisers",
    columns: {
      first_name: { type: "text", required: true, description: "First name" },
      last_name: { type: "text", required: true, description: "Last name" },
      email: { type: "email", required: false, description: "Email address" },
      phone: { type: "text", required: false, description: "Phone number" }
    }
  },
  
  project_eba_details: {
    label: "Project EBA Details",
    columns: {
      project_id: { type: "uuid", required: true, description: "Related project ID (must match existing project)" },
      status: { type: "enum", required: true, description: "EBA status",
        options: ["yes", "no", "pending"] },
      registration_number: { type: "text", required: false, description: "EBA registration number (required if status is 'yes')" },
      eba_title: { type: "text", required: false, description: "EBA title (required if status is 'yes')" },
      bargaining_status: { type: "text", required: false, description: "Bargaining status (required if status is 'pending')" }
    }
  },
  
  site_contacts: {
    label: "Site Contacts",
    columns: {
      job_site_id: { type: "uuid", required: true, description: "Related job site ID (must match existing site)" },
      role: { type: "enum", required: true, description: "Contact role",
        options: ["project_manager", "site_manager"] },
      name: { type: "text", required: true, description: "Contact person full name" },
      email: { type: "email", required: false, description: "Email address" },
      phone: { type: "text", required: false, description: "Phone number" }
    }
  }
};

const ColumnMapper = ({ parsedCSV, onMappingComplete, onBack, defaultTable }: ColumnMapperProps) => {
  const [selectedTable, setSelectedTable] = useState<string>(defaultTable || '');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [newFields, setNewFields] = useState<Array<{
    name: string;
    type: string;
    csvColumn: string;
  }>>([]);

  useEffect(() => {
    if (defaultTable && !selectedTable) {
      setSelectedTable(defaultTable);
    }
  }, [defaultTable, selectedTable]);

  // Generate smart mapping suggestions
  const generateSuggestions = useMemo(() => {
    if (!selectedTable || !DATABASE_TABLES[selectedTable as keyof typeof DATABASE_TABLES]) return [];

    const tableSchema = DATABASE_TABLES[selectedTable as keyof typeof DATABASE_TABLES];
    const suggestions: ColumnMapping[] = [];

    parsedCSV.headers.forEach(csvHeader => {
      const normalizedHeader = csvHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
      let bestMatch: { column: string; confidence: number } | null = null as any;

      // Exact match
      Object.keys(tableSchema.columns).forEach(dbColumn => {
        const normalizedDbColumn = dbColumn.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (normalizedHeader === normalizedDbColumn) {
          bestMatch = { column: dbColumn, confidence: 100 };
        } else if (normalizedHeader.includes(normalizedDbColumn) || normalizedDbColumn.includes(normalizedHeader)) {
          const confidence = Math.max(
            (normalizedHeader.length / normalizedDbColumn.length) * 70,
            (normalizedDbColumn.length / normalizedHeader.length) * 70
          );
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { column: dbColumn, confidence };
          }
        }
      });

      // Content-based matching
      if (!bestMatch && parsedCSV.rows.length > 0) {
        const sampleValues = parsedCSV.rows.slice(0, 5).map(row => row[csvHeader]).filter(Boolean);
        
        Object.entries(tableSchema.columns).forEach(([dbColumn, columnInfo]) => {
          let confidence = 0;
          
          if (columnInfo.type === 'date' && sampleValues.some(val => {
            const dateStr = String(val);
            return /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/.test(dateStr);
          })) {
            confidence = 80;
          } else if (columnInfo.type === 'text' && csvHeader.toLowerCase().includes('name')) {
            // Enhanced name field matching
            const headerLower = csvHeader.toLowerCase();
            if (dbColumn === 'first_name' && (headerLower.includes('first') || headerLower.includes('given') || headerLower.includes('forename'))) {
              confidence = 95;
            } else if (dbColumn === 'surname' && (headerLower.includes('last') || headerLower.includes('family') || headerLower.includes('surname'))) {
              confidence = 95;
            } else if (dbColumn === 'other_name' && (headerLower.includes('middle') || headerLower.includes('other'))) {
              confidence = 90;
            } else if (dbColumn === 'nickname' && (headerLower.includes('nick') || headerLower.includes('preferred') || headerLower.includes('known'))) {
              confidence = 90;
            } else if (headerLower === 'name' || headerLower === 'full name' || headerLower === 'fullname') {
              // For generic "name" fields, suggest first_name as most likely
              if (dbColumn === 'first_name') confidence = 70;
            }
          } else if (columnInfo.type === 'text' && csvHeader.toLowerCase().includes('email')) {
            if (dbColumn === 'email') confidence = 95;
          } else if (columnInfo.type === 'text' && csvHeader.toLowerCase().includes('phone')) {
            // Enhanced phone field matching
            const headerLower = csvHeader.toLowerCase();
            if (dbColumn === 'home_phone' && (headerLower.includes('home') || headerLower === 'phone')) {
              confidence = headerLower.includes('home') ? 95 : 70;
            } else if (dbColumn === 'work_phone' && headerLower.includes('work')) {
              confidence = 95;
            } else if (dbColumn === 'mobile_phone' && (headerLower.includes('mobile') || headerLower.includes('cell'))) {
              confidence = 95;
            } else if (headerLower === 'phone' && dbColumn === 'mobile_phone') {
              confidence = 65; // Default to mobile for generic phone
            }
          } else if (columnInfo.type === 'text' && csvHeader.toLowerCase().includes('address')) {
            // Enhanced address field matching
            const headerLower = csvHeader.toLowerCase();
            if (dbColumn === 'home_address_line_1' && (headerLower.includes('address') && headerLower.includes('1'))) {
              confidence = 95;
            } else if (dbColumn === 'home_address_line_2' && (headerLower.includes('address') && headerLower.includes('2'))) {
              confidence = 95;
            } else if (dbColumn === 'home_address_suburb' && (headerLower.includes('suburb') || headerLower.includes('city'))) {
              confidence = 95;
            } else if (dbColumn === 'home_address_postcode' && (headerLower.includes('postcode') || headerLower.includes('postal') || headerLower.includes('zip'))) {
              confidence = 95;
            } else if (dbColumn === 'home_address_state' && headerLower.includes('state')) {
              confidence = 95;
            } else if (headerLower === 'address' && dbColumn === 'home_address_line_1') {
              confidence = 70; // Default to line 1 for generic address
            }
          }

          if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
            bestMatch = { column: dbColumn, confidence };
          }
        });
      }

      suggestions.push({
        csvColumn: csvHeader,
        dbTable: selectedTable,
        dbColumn: bestMatch?.column || '',
        action: bestMatch ? 'map' : 'skip',
        confidence: bestMatch?.confidence || 0
      });
    });

    return suggestions;
  }, [selectedTable, parsedCSV]);

  useEffect(() => {
    if (selectedTable) {
      setMappings(generateSuggestions);
    }
  }, [selectedTable, generateSuggestions]);

  const updateMapping = (index: number, updates: Partial<ColumnMapping>) => {
    setMappings(prev => prev.map((mapping, i) => 
      i === index ? { ...mapping, ...updates } : mapping
    ));
  };

  const addNewField = (csvColumn: string) => {
    const fieldName = csvColumn.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Add to new fields for future database operations
    setNewFields(prev => [...prev, {
      name: fieldName,
      type: 'text',
      csvColumn
    }]);
    
    // Update the mapping to use the new field
    const mappingIndex = mappings.findIndex(m => m.csvColumn === csvColumn);
    if (mappingIndex >= 0) {
      updateMapping(mappingIndex, {
        action: 'create',
        dbColumn: fieldName,
        dataType: 'text'
      });
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-500';
    if (confidence >= 70) return 'bg-yellow-500';
    if (confidence >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 90) return 'Excellent';
    if (confidence >= 70) return 'Good';
    if (confidence >= 50) return 'Fair';
    return 'Poor';
  };

  const canProceed = selectedTable && mappings.some(m => m.action !== 'skip');

  const handleContinue = () => {
    if (canProceed) {
      onMappingComplete(selectedTable, mappings.filter(m => m.action !== 'skip'));
    }
  };

  const getSampleData = (csvColumn: string) => {
    return parsedCSV.rows.slice(0, 3)
      .map(row => row[csvColumn])
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Column Mapping
          </CardTitle>
          <CardDescription>
            Map your CSV columns to database fields. Smart suggestions are provided based on column names and content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Table Selection */}
          <div className="space-y-2">
            <Label htmlFor="table-select">Select Target Table</Label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger>
                <SelectValue placeholder="Choose which table to import data into" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DATABASE_TABLES).map(([key, table]) => (
                  <SelectItem key={key} value={key}>
                    {table.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTable && (
            <>
              <Separator />
              
              {/* Mapping Summary */}
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-green-600">
                    {mappings.filter(m => m.action === 'map').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Mapped</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-blue-600">
                    {mappings.filter(m => m.action === 'create').length}
                  </div>
                  <div className="text-sm text-muted-foreground">New Fields</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-gray-600">
                    {mappings.filter(m => m.action === 'skip').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Skipped</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {parsedCSV.headers.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Columns</div>
                </div>
              </div>

              <Separator />

              {/* Column Mappings */}
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {mappings.map((mapping, index) => (
                    <Card key={mapping.csvColumn} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{mapping.csvColumn}</h4>
                            {mapping.confidence && mapping.confidence > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <div className={`w-2 h-2 rounded-full mr-1 ${getConfidenceColor(mapping.confidence)}`} />
                                {getConfidenceLabel(mapping.confidence)} ({mapping.confidence.toFixed(0)}%)
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Sample: {getSampleData(mapping.csvColumn)}
                          </p>
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <Select 
                              value={mapping.action} 
                              onValueChange={(value: 'map' | 'create' | 'skip') => 
                                updateMapping(index, { action: value })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="map">Map</SelectItem>
                                <SelectItem value="create">Create New</SelectItem>
                                <SelectItem value="skip">Skip</SelectItem>
                              </SelectContent>
                            </Select>

                            {mapping.action === 'map' && (
                              <Select 
                                value={mapping.dbColumn} 
                                onValueChange={(value) => updateMapping(index, { dbColumn: value })}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Select database column" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(DATABASE_TABLES[selectedTable as keyof typeof DATABASE_TABLES].columns).map(([key, col]) => (
                                    <SelectItem key={key} value={key}>
                                      <div className="flex items-center justify-between w-full">
                                        <span>{key}</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                          {col.type} {col.required && '*'}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {mapping.action === 'create' && (
                              <div className="flex gap-2 flex-1">
                                <Input 
                                  placeholder="New field name"
                                  value={mapping.dbColumn}
                                  onChange={(e) => updateMapping(index, { dbColumn: e.target.value })}
                                />
                                <Select 
                                  value={mapping.dataType || 'text'} 
                                  onValueChange={(value: 'text' | 'date' | 'number' | 'boolean') => updateMapping(index, { dataType: value })}
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="date">Date</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="boolean">Boolean</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>

                          {mapping.action === 'map' && mapping.dbColumn && (
                            <p className="text-xs text-muted-foreground">
                              {(
                                DATABASE_TABLES[selectedTable as keyof typeof DATABASE_TABLES]
                                  .columns as Record<string, { description?: string }>
                              )[mapping.dbColumn]?.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Upload
        </Button>

        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => {
              // Auto-map all high confidence matches
              const autoMapped = mappings.map(mapping => 
                mapping.confidence && mapping.confidence >= 70 
                  ? { ...mapping, action: 'map' as const }
                  : mapping
              );
              setMappings(autoMapped);
            }}
          >
            <Brain className="h-4 w-4 mr-2" />
            Auto-Map High Confidence
          </Button>
          
          <Button 
            onClick={handleContinue}
            disabled={!canProceed}
          >
            Continue to Preview
          </Button>
        </div>
      </div>

      {!canProceed && selectedTable && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please map or create at least one column before proceeding.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ColumnMapper;