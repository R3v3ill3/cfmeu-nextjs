'use client';

import React, { useState, useCallback } from 'react';
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
  'Project Country',
  'Role on Project',
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
}

interface BCICsvParserProps {
  onDataParsed: (data: BCICsvRow[]) => void;
  onError: (error: string) => void;
}

export default function BCICsvParser({ onDataParsed, onError }: BCICsvParserProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<BCICsvRow[]>([]);

  // Parse CSV file
  const parseCSV = useCallback((file: File) => {
    setIsProcessing(true);
    setValidationErrors([]);
    setSampleData([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedData = validateAndTransformData(results.data as any[]);
          
          if (validationErrors.length === 0) {
            setSampleData(parsedData.slice(0, 5)); // Show first 5 rows as sample
            onDataParsed(parsedData);
          }
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
    const missingHeaders = BCI_CSV_HEADERS.filter(header => !(header in firstRow));

    if (missingHeaders.length > 0) {
      errors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    // Transform each row
    rawData.forEach((row, index) => {
      try {
        const transformedRow: BCICsvRow = {
          projectId: String(row['Project ID'] || '').trim(),
          projectType: String(row['Project Type'] || '').trim(),
          projectName: String(row['Project Name'] || '').trim(),
          projectStage: String(row['Project Stage'] || '').trim(),
          projectStatus: String(row['Project Status'] || '').trim(),
          localValue: String(row['Local Value'] || '').trim(),
          developmentType: String(row['Development Type'] || '').trim(),
          floorArea: String(row['Floor Area (square meters)'] || '').trim(),
          siteArea: String(row['Site Area (hectares)'] || '').trim(),
          storeys: String(row['Storeys'] || '').trim(),
          lastUpdate: String(row['Last Update'] || '').trim(),
          constructionStartDate: String(row['Construction Start Date (Original format)'] || '').trim(),
          constructionEndDate: String(row['Construction End Date (Original format)'] || '').trim(),
          projectAddress: String(row['Project Address'] || '').trim(),
          projectTown: String(row['Project Town / Suburb'] || '').trim(),
          projectState: String(row['Project Province / State'] || '').trim(),
          postCode: String(row['Post Code'] || '').trim(),
          projectCountry: String(row['Project Country'] || '').trim(),
          roleOnProject: String(row['Role on Project'] || '').trim(),
          companyName: String(row['Company Name'] || '').trim(),
          companyStreet: String(row['Company Street Name'] || '').trim(),
          companyTown: String(row['Company Town / Suburb'] || '').trim(),
          companyState: String(row['Company State / Province'] || '').trim(),
          companyPostcode: String(row['Company Post Code'] || '').trim(),
          companyCountry: String(row['Company Country'] || '').trim(),
          companyPhone: String(row['Company Phone'] || '').trim(),
          companyEmail: String(row['Company Email'] || '').trim(),
          contactFirstName: String(row['Contact First Name'] || '').trim(),
          contactSurname: String(row['Contact Surname'] || '').trim(),
          contactPosition: String(row['Contact Position'] || '').trim(),
          contactLandline: String(row['Contact Landline'] || '').trim(),
          contactEmail: String(row['Contact Email'] || '').trim(),
          contactRemark: String(row['Contact Remark'] || '').trim()
        };

        // Validate required fields
        if (!transformedRow.projectId) {
          errors.push(`Row ${index + 1}: Missing Project ID`);
        }
        if (!transformedRow.projectName) {
          errors.push(`Row ${index + 1}: Missing Project Name`);
        }
        if (!transformedRow.companyName) {
          errors.push(`Row ${index + 1}: Missing Company Name`);
        }
        if (!transformedRow.roleOnProject) {
          errors.push(`Row ${index + 1}: Missing Role on Project`);
        }

        transformedData.push(transformedRow);
      } catch (error) {
        errors.push(`Row ${index + 1}: Failed to parse row data`);
      }
    });

    setValidationErrors(errors);
    
    if (errors.length > 0) {
      throw new Error(`Validation failed with ${errors.length} errors`);
    }

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
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="font-medium mb-2">CSV validation failed:</div>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {validationErrors.slice(0, 10).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
              {validationErrors.length > 10 && (
                <li>... and {validationErrors.length - 10} more errors</li>
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
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
