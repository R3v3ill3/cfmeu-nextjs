'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, FileText, Download } from 'lucide-react';
import Papa from 'papaparse';

// BCI CSV column headers (as they appear in the CSV)
const BCI_CSV_HEADERS = [
  'Project ID',
  'Project Type',
  'Project Name',
  'Project Stage',
  'Project Status',
  'Local Value',
  'Funding Type Primary',
  'Owner Type Level 1 Primary',
  'Development Type',
  'Floor Area (square meters)',
  'Site Area (hectares)',
  'Storeys',
  'Last Update',
  'Construction Start Date (Original format)',
  'Construction End Date (Original format)',
  'Project Address',
  'Project Town / Suburb',
  'Project Province / State',
  'Post Code',
  // Optional but supported for geolocation
  'Latitude',
  'Longitude',
  'Project Country',
  'Role on Project',
  'Company ID',
  'Company Name',
  'Company Street Name',
  'Company Town / Suburb',
  'Company State / Province',
  'Company Post Code',
  'Company Country',
  'Company Phone',
  'Company Email',
  'Contact First Name',
  'Contact Surname',
  'Contact Position',
  'Contact Landline',
  'Contact Email',
  'Contact Remark'
];

// Expected data structure after parsing
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
  latitude?: string;
  longitude?: string;
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
}

type BCIImportMode = 'projects-and-employers' | 'projects-only' | 'employers-to-existing' | 'employers-to-existing-quick-match';

interface BCICsvParserProps {
  onDataParsed: (data: BCICsvRow[]) => void;
  onError: (error: string) => void;
  onModeChange?: (mode: BCIImportMode) => void;
}

export default function BCICsvParser({ onDataParsed, onError, onModeChange }: BCICsvParserProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<BCICsvRow[]>([]);
  const [mode, setMode] = useState<BCIImportMode>('projects-and-employers');

  useEffect(() => {
    if (onModeChange) onModeChange(mode);
  }, [mode, onModeChange]);

  // Parse CSV file
  const parseCSV = useCallback((file: File) => {
    setIsProcessing(true);
    setValidationErrors([]);
    setSampleData([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => (h || '').replace(/\uFEFF/g, '').trim(),
      complete: (results) => {
        try {
          const parsedData = validateAndTransformData(results.data as any[]);
          // Always preview and pass parsed data through; warnings are shown in the UI
          setSampleData(parsedData.slice(0, 5)); // Show first 5 rows as sample
          onDataParsed(parsedData);
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Failed to parse CSV');
        } finally {
          setIsProcessing(false);
        }
      },
      error: (error) => {
        onError(`CSV parsing error: ${error.message}`);
        setIsProcessing(false);
      }
    });
  }, [onDataParsed, onError]);

  // Validate and transform CSV data
  const validateAndTransformData = (rawData: any[]): BCICsvRow[] => {
    const errors: string[] = [];
    const transformedData: BCICsvRow[] = [];

    // Check if we have the expected headers
    if (rawData.length === 0) {
      throw new Error('CSV file is empty');
    }

    const firstRow = rawData[0];

    // Helper to resolve duplicate/variant headers (e.g., "Project ID", "Project ID_1", "Project ID (2)")
    const resolveKey = (row: Record<string, any>, base: string, extraAliases: string[] = []): string | null => {
      const candidates = [base, ...extraAliases];
      const keys = Object.keys(row || {});
      for (const cand of candidates) {
        // Exact match first
        const exact = keys.find(k => k.trim().toLowerCase() === cand.trim().toLowerCase());
        if (exact) return exact;
        // Variant match: cand, cand_1, cand-1, cand (1)
        const escaped = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`^${escaped}(?:[ _-]?\\d+| \\((?:\\d+)\\))?$`, 'i');
        const variant = keys.find(k => re.test(k.trim()));
        if (variant) return variant;
      }
      return null;
    };

    // Transform each row
    rawData.forEach((row, index) => {
      try {
        const get = (r: any, base: string, aliases: string[] = []): string => {
          const key = resolveKey(r, base, aliases);
          return String(key ? r[key] : '').trim();
        };

        const transformedRow: BCICsvRow = {
          projectId: get(row, 'Project ID', ['PID', 'ProjectID']),
          projectType: get(row, 'Project Type'),
          projectName: get(row, 'Project Name'),
          projectStage: get(row, 'Project Stage'),
          projectStatus: get(row, 'Project Status'),
          localValue: get(row, 'Local Value', ['Value', 'LocalValue']),
          fundingTypePrimary: get(row, 'Funding Type Primary', ['Funding Type']),
          ownerTypeLevel1Primary: get(row, 'Owner Type Level 1 Primary', ['Owner Type']),
          developmentType: get(row, 'Development Type'),
          floorArea: get(row, 'Floor Area (square meters)', ['Floor Area']),
          siteArea: get(row, 'Site Area (hectares)', ['Site Area']),
          storeys: get(row, 'Storeys', ['Stories']),
          lastUpdate: get(row, 'Last Update', ['Updated', 'LastUpdated']),
          constructionStartDate: get(row, 'Construction Start Date (Original format)', ['Construction Start Date']),
          constructionEndDate: get(row, 'Construction End Date (Original format)', ['Construction End Date']),
          projectAddress: get(row, 'Project Address', ['Address']),
          projectTown: get(row, 'Project Town / Suburb', ['Town', 'Suburb', 'Project Town']),
          projectState: get(row, 'Project Province / State', ['State', 'Province']),
          postCode: get(row, 'Post Code', ['Postcode', 'Postal Code']),
          latitude: get(row, 'Latitude', ['Lat']),
          longitude: get(row, 'Longitude', ['Long', 'Lng']),
          projectCountry: get(row, 'Project Country', ['Country']),
          roleOnProject: get(row, 'Role on Project', ['Role']),
          companyId: get(row, 'Company ID', ['CompanyID', 'Company_ID', 'CID']),
          companyName: get(row, 'Company Name', ['Company']),
          companyStreet: get(row, 'Company Street Name', ['Company Street']),
          companyTown: get(row, 'Company Town / Suburb', ['Company Town', 'Company Suburb']),
          companyState: get(row, 'Company State / Province', ['Company State', 'Company Province']),
          companyPostcode: get(row, 'Company Post Code', ['Company Postcode']),
          companyCountry: get(row, 'Company Country'),
          companyPhone: get(row, 'Company Phone', ['Phone']),
          companyEmail: get(row, 'Company Email', ['Email']),
          contactFirstName: get(row, 'Contact First Name', ['First Name']),
          contactSurname: get(row, 'Contact Surname', ['Last Name', 'Surname']),
          contactPosition: get(row, 'Contact Position', ['Position', 'Role']),
          contactLandline: get(row, 'Contact Landline', ['Landline']),
          contactEmail: get(row, 'Contact Email'),
          contactRemark: get(row, 'Contact Remark', ['Remark', 'Notes'])
        };

        // Validate required fields
        if (!transformedRow.projectId) {
          errors.push(`Row ${index + 1}: Missing Project ID`);
          // Skip rows without a project ID since we cannot group/import them
          return;
        }
        // In projects-only files, many company fields will be empty – that's fine
        if (!transformedRow.projectName) {
          errors.push(`Row ${index + 1}: Missing Project Name`);
        }

        transformedData.push(transformedRow);
      } catch (error) {
        errors.push(`Row ${index + 1}: Failed to parse row data`);
      }
    });

    setValidationErrors(errors);
    // Do not throw; return what we could parse and show warnings in UI
    return transformedData;
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        onError('Please select a valid CSV file');
        return;
      }
      parseCSV(file);
    }
  };

  // Download sample CSV template
  const downloadSampleTemplate = () => {
    const csvContent = BCI_CSV_HEADERS.join(',') + '\n' +
      '177115017,RAIL LINE - redevelopment,SYDNEY METRO CITY - T3 BANKSTOWN LINE,Construction,Construction Commenced,12500000000.00,Refurbishment,17/12/2024,August 2019,Quarter 1 2026,Sydenham,New South Wales,2044,Australia,Contractor,Downer EDI Works Pty Ltd,Delhi Rd,North Ryde,New South Wales,2113,Australia,02 9468 9700,info@downergroup.com,John,Smith,Project Manager,02 9468 9700,john.smith@downergroup.com,Sample data';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bci_project_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">BCI Project CSV Parser</h2>
        <p className="text-gray-600 mt-2">
          Upload a BCI project CSV file to import construction projects
        </p>
      </div>

      {/* Mode selector */}
      <Card className="variant:desktop">
        <CardHeader className="variant:desktop-compact">
          <CardTitle className="variant:desktop">Import Mode</CardTitle>
          <CardDescription className="variant:desktop">
            Choose what to import from the CSV
          </CardDescription>
        </CardHeader>
        <CardContent className="variant:desktop-compact">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={mode === 'projects-and-employers' ? 'default' : 'outline'} onClick={() => setMode('projects-and-employers')}>Projects + Employers</Button>
            <Button size="sm" variant={mode === 'projects-only' ? 'default' : 'outline'} onClick={() => setMode('projects-only')}>Projects only</Button>
            <Button size="sm" variant={mode === 'employers-to-existing' ? 'default' : 'outline'} onClick={() => setMode('employers-to-existing')}>Employers → existing projects</Button>
            <Button size="sm" variant={mode === 'employers-to-existing-quick-match' ? 'default' : 'outline'} onClick={() => setMode('employers-to-existing-quick-match')}>Quick Match (BCI ID only)</Button>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            {mode === 'projects-only' && (
              <div>Required fields: <strong>Project ID</strong>, <strong>Project Name</strong> (you can fill in later), <strong>Address</strong>, and optionally <strong>Latitude</strong>/<strong>Longitude</strong>.</div>
            )}
            {mode === 'employers-to-existing' && (
              <div>Requires a <strong>Project ID</strong> column to match employers to existing projects in the database.</div>
            )}
            {mode === 'employers-to-existing-quick-match' && (
              <div>Fast matching using <strong>BCI Company ID</strong> only. Rows without BCI Company ID will be skipped and available for download. No fuzzy matching or manual review required.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card className="variant:desktop">
        <CardHeader className="variant:desktop-compact">
          <CardTitle className="variant:desktop">Upload CSV File</CardTitle>
          <CardDescription className="variant:desktop">
            Select a BCI project CSV file to begin the import process
          </CardDescription>
        </CardHeader>
        <CardContent className="variant:desktop-compact">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <Button
                onClick={downloadSampleTemplate}
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
            
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Processing CSV file...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="font-medium mb-2">CSV validation warnings:</div>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {validationErrors.slice(0, 10).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
              {validationErrors.length > 10 && (
                <li>... and {validationErrors.length - 10} more warnings</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Sample Data Preview */}
      {sampleData.length > 0 && (
        <Card className="variant:desktop">
          <CardHeader className="variant:desktop-compact">
            <CardTitle className="variant:desktop">Data Preview</CardTitle>
            <CardDescription className="variant:desktop">
              First 5 rows of parsed data
            </CardDescription>
          </CardHeader>
          <CardContent className="variant:desktop-compact">
            <div className="space-y-4">
              {sampleData.map((row, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Row {index + 1}
                    </Badge>
                    <span className="font-medium text-sm">{row.projectName}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-medium">Project ID:</span> {row.projectId}
                    </div>
                    <div>
                      <span className="font-medium">Value:</span> {row.localValue}
                    </div>
                    <div>
                      <span className="font-medium">Company:</span> {row.companyName}
                    </div>
                    <div>
                      <span className="font-medium">Role:</span> {row.roleOnProject}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expected Format Info */}
      <Card className="variant:desktop">
        <CardHeader className="variant:desktop-compact">
          <CardTitle className="variant:desktop">Expected CSV Format</CardTitle>
          <CardDescription className="variant:desktop">
            Your CSV should contain these columns in the exact order shown
          </CardDescription>
        </CardHeader>
        <CardContent className="variant:desktop-compact">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {BCI_CSV_HEADERS.map((header, index) => (
              <div key={index} className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {index + 1}
                </Badge>
                <span className="font-mono text-xs">{header}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <div className="font-medium">Important Notes:</div>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Each project can have multiple rows (one per company)</li>
                  <li>Project ID must be unique across all rows</li>
                  <li>Company names and roles are required for each row</li>
                  <li>Dates can be in various formats (will be automatically parsed)</li>
                  <li>Non-construction companies (consultants, engineers) will be automatically filtered out</li>
                  <li>Latitude/Longitude are optional but recommended for precise project location</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
