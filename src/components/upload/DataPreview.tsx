import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Eye, AlertTriangle, CheckCircle, XCircle, Upload } from "lucide-react";
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
type ValidationIssue = { row: number; column: string; message: string; value?: any };
type ValidationResult = { isValid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] };
import ContractorImport from "./ContractorImport";
import { EbaImport } from "./EbaImport";
import WorkerImport from "./WorkerImport";

interface DataPreviewProps {
  parsedCSV: ParsedCSV;
  selectedTable: string;
  columnMappings: ColumnMapping[];
  onValidationComplete: (result: ValidationResult) => void;
  onImportStart: () => void;
  onBack: () => void;
}

interface ImportOptions {
  mode: 'insert' | 'upsert' | 'update';
  duplicateKeyField?: string;
  skipDuplicates: boolean;
  batchSize: number;
}

const DataPreview = ({ 
  parsedCSV, 
  selectedTable, 
  columnMappings, 
  onValidationComplete, 
  onImportStart, 
  onBack 
}: DataPreviewProps) => {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationProgress, setValidationProgress] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    mode: 'insert',
    skipDuplicates: true,
    batchSize: 100
  });
  const [previewData, setPreviewData] = useState<Array<Record<string, any>>>([]);

  // Transform CSV data according to mappings
  useEffect(() => {
    const transformedData = parsedCSV.rows.slice(0, 10).map(row => {
      const transformedRow: Record<string, any> = {};
      
      columnMappings.forEach(mapping => {
        if (mapping.action !== 'skip' && mapping.dbColumn) {
          let value = row[mapping.csvColumn];
          
          // Basic data transformation
          if (value !== null && value !== undefined && value !== '') {
            if (mapping.dataType === 'date' || mapping.dbColumn.includes('date')) {
              // Try to parse date
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                value = date.toISOString().split('T')[0];
              }
            } else if (mapping.dataType === 'number') {
              const num = parseFloat(value);
              if (!isNaN(num)) {
                value = num;
              }
            } else if (mapping.dataType === 'boolean') {
              value = ['true', 'yes', '1', 'y'].includes(String(value).toLowerCase());
            }
          }
          
          transformedRow[mapping.dbColumn] = value;
        }
      });
      
      return transformedRow;
    });

    setPreviewData(transformedData);
  }, [parsedCSV, columnMappings]);

  // Validation logic
  const validateData = useCallback(async () => {
    setIsValidating(true);
    setValidationProgress(0);
    
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    
    const totalRows = parsedCSV.rows.length;
    
    for (let i = 0; i < totalRows; i++) {
      const row = parsedCSV.rows[i];
      setValidationProgress((i / totalRows) * 100);
      
      columnMappings.forEach(mapping => {
        if (mapping.action === 'skip') return;
        
        const value = row[mapping.csvColumn];
        const rowNum = i + 2; // +2 because of header row and 0-based index
        
        // Required field validation
        if (mapping.action === 'map') {
          // Check if field is required (this would come from your database schema)
          const requiredFields = ['name']; // Example required fields
          if (requiredFields.includes(mapping.dbColumn) && (!value || value.toString().trim() === '')) {
            errors.push({
              row: rowNum,
              column: mapping.csvColumn,
              message: `Required field '${mapping.dbColumn}' is empty`,
              value
            });
          }
        }
        
        // Data type validation
        if (value && value.toString().trim() !== '') {
          if (mapping.dataType === 'date' || mapping.dbColumn.includes('date')) {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              errors.push({
                row: rowNum,
                column: mapping.csvColumn,
                message: `Invalid date format`,
                value
              });
            }
          } else if (mapping.dataType === 'number') {
            if (isNaN(parseFloat(value))) {
              errors.push({
                row: rowNum,
                column: mapping.csvColumn,
                message: `Invalid number format`,
                value
              });
            }
          } else if (mapping.dbColumn === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              warnings.push({
                row: rowNum,
                column: mapping.csvColumn,
                message: `Invalid email format`,
                value
              });
            }
          }
        }
        
        // Length validation
        if (value && typeof value === 'string' && value.length > 255) {
          warnings.push({
            row: rowNum,
            column: mapping.csvColumn,
            message: `Value is very long (${value.length} characters)`,
            value: value.substring(0, 50) + '...'
          });
        }
      });
      
      // Small delay to show progress
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings
    };
    
    setValidationResult(result);
    setValidationProgress(100);
    setIsValidating(false);
    onValidationComplete(result);
  }, [parsedCSV, columnMappings, onValidationComplete]);

  useEffect(() => {
    validateData();
  }, [validateData]);

  const handleImport = () => {
    onImportStart();
  };

  // Handle contractor imports differently
  if (selectedTable === 'contractors') {
    return (
      <ContractorImport
        csvData={parsedCSV.rows}
        onImportComplete={(results) => {
          onValidationComplete({
            isValid: true,
            errors: [],
            warnings: results.errors.map(error => ({
              row: 0,
              column: '',
              message: error,
              value: ''
            }))
          });
          onImportStart();
        }}
        onBack={onBack}
      />
    );
  }

  // Handle worker imports differently
  if (selectedTable === 'workers') {
    return (
      <WorkerImport
        csvData={parsedCSV.rows}
        onImportComplete={(results) => {
          onValidationComplete({
            isValid: true,
            errors: [],
            warnings: results.errors.map(error => ({
              row: 0,
              column: '',
              message: error,
              value: ''
            }))
          });
          onImportStart();
        }}
        onBack={onBack}
      />
    );
  }

  // Handle EBA tracking imports differently
  console.log('DataPreview: selectedTable =', selectedTable);
  if (selectedTable === 'company_eba_records') {
    return (
      <EbaImport
        csvData={parsedCSV.rows}
        onImportComplete={(results) => {
          onValidationComplete({
            isValid: true,
            errors: [],
            warnings: results.errors.map(error => ({
              row: 0,
              column: '',
              message: error,
              value: ''
            }))
          });
          onImportStart();
        }}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Data Preview & Validation
          </CardTitle>
          <CardDescription>
            Review your data transformation and validation results before importing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Import Summary */}
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold">{parsedCSV.rows.length.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Rows</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">{columnMappings.filter(m => m.action !== 'skip').length}</div>
              <div className="text-sm text-muted-foreground">Columns Mapped</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-red-600">
                {validationResult?.errors.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-yellow-600">
                {validationResult?.warnings.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
          </div>

          {/* Validation Progress */}
          {isValidating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Validating data...</span>
                <span className="text-sm text-muted-foreground">{validationProgress.toFixed(0)}%</span>
              </div>
              <Progress value={validationProgress} />
            </div>
          )}

          {/* Validation Results */}
          {validationResult && !isValidating && (
            <div className="space-y-4">
              {validationResult.isValid ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    All data passed validation! Ready to import {parsedCSV.rows.length} rows.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Found {validationResult.errors.length} validation errors that must be fixed before importing.
                  </AlertDescription>
                </Alert>
              )}

              {validationResult.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Found {validationResult.warnings.length} warnings. These won't prevent import but should be reviewed.
                  </AlertDescription>
                </Alert>
              )}

              {/* Error/Warning Details */}
              {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Validation Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {validationResult.errors.map((error, index) => (
                          <div key={`error-${index}`} className="flex items-start gap-2 p-2 bg-red-50 rounded">
                            <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 text-sm">
                              <div className="font-medium">Row {error.row}, Column "{error.column}"</div>
                              <div className="text-red-700">{error.message}</div>
                              {error.value && <div className="text-xs text-gray-600 mt-1">Value: "{error.value}"</div>}
                            </div>
                          </div>
                        ))}
                        {validationResult.warnings.map((warning, index) => (
                          <div key={`warning-${index}`} className="flex items-start gap-2 p-2 bg-yellow-50 rounded">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 text-sm">
                              <div className="font-medium">Row {warning.row}, Column "{warning.column}"</div>
                              <div className="text-yellow-700">{warning.message}</div>
                              {warning.value && <div className="text-xs text-gray-600 mt-1">Value: "{warning.value}"</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Import Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Import Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Import Mode</label>
                  <Select value={importOptions.mode} onValueChange={(value: 'insert' | 'upsert' | 'update') => 
                    setImportOptions(prev => ({ ...prev, mode: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insert">Insert Only (new records)</SelectItem>
                      <SelectItem value="upsert">Insert or Update</SelectItem>
                      <SelectItem value="update">Update Only (existing records)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Batch Size</label>
                  <Select value={importOptions.batchSize.toString()} onValueChange={(value) => 
                    setImportOptions(prev => ({ ...prev, batchSize: parseInt(value) }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 rows per batch</SelectItem>
                      <SelectItem value="100">100 rows per batch</SelectItem>
                      <SelectItem value="250">250 rows per batch</SelectItem>
                      <SelectItem value="500">500 rows per batch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Preview Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Data Preview (First 10 Rows)</CardTitle>
              <CardDescription>Preview of how your data will be imported</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columnMappings
                        .filter(m => m.action !== 'skip')
                        .map(mapping => (
                          <TableHead key={mapping.dbColumn}>
                            {mapping.dbColumn}
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {mapping.action}
                            </Badge>
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index}>
                        {columnMappings
                          .filter(m => m.action !== 'skip')
                          .map(mapping => (
                            <TableCell key={mapping.dbColumn} className="max-w-32 truncate">
                              {row[mapping.dbColumn] || '—'}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Mapping
        </Button>

        <Button 
          onClick={handleImport}
          disabled={!validationResult?.isValid || isValidating}
          className="min-w-32"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isValidating ? 'Validating...' : 'Start Import'}
        </Button>
      </div>
    </div>
  );
};

export default DataPreview;