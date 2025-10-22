import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { validateCsvFile } from "@/lib/validation/clientFileValidation";
type ParsedCSV = {
  headers: string[];
  rows: Array<Record<string, any>>;
  filename?: string;
}
import Papa from "papaparse";

interface FileUploadProps {
  onFileUploaded: (csv: ParsedCSV) => void;
}

const FileUpload = ({ onFileUploaded }: FileUploadProps) => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; rows: number } | null>(null);

  const processCSV = useCallback((file: File) => {
    setUploadStatus('processing');
    setError(null);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          const errorMessages = results.errors.map(err => err.message).join(', ');
          setError(`CSV parsing errors: ${errorMessages}`);
          setUploadStatus('error');
          return;
        }

        if (results.data.length === 0) {
          setError('CSV file is empty or contains no valid data');
          setUploadStatus('error');
          return;
        }

        const headers = results.meta.fields || [];
        if (headers.length === 0) {
          setError('CSV file has no headers');
          setUploadStatus('error');
          return;
        }

        const parsedCSV: ParsedCSV = {
          headers,
          rows: results.data as Record<string, any>[],
          filename: file.name
        };

        setFileInfo({
          name: file.name,
          size: file.size,
          rows: parsedCSV.rows.length
        });

        setUploadStatus('success');
        onFileUploaded(parsedCSV);
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`);
        setUploadStatus('error');
      }
    });
  }, [onFileUploaded]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      setUploadStatus('error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB');
      setUploadStatus('error');
      return;
    }

    // SECURITY: Validate file signature to prevent malicious uploads
    setUploadStatus('uploading');
    setUploadProgress(10);

    const validation = await validateCsvFile(file);
    if (!validation.valid) {
      setError(`Invalid CSV file: ${validation.error}. File extension can be spoofed - please ensure you are uploading a genuine CSV file.`);
      setUploadStatus('error');
      return;
    }

    setUploadProgress(30);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          processCSV(file);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  }, [processCSV]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
    multiple: false
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setError(null);
    setFileInfo(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload CSV File
          </CardTitle>
          <CardDescription>
            Upload a CSV file to import data. The system will automatically analyze and suggest column mappings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {uploadStatus === 'idle' && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : isDragReject 
                  ? 'border-destructive bg-destructive/5'
                  : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              {isDragActive ? (
                <p className="text-lg font-medium">Drop the CSV file here...</p>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">Drag & drop a CSV file here</p>
                  <p className="text-muted-foreground mb-4">or click to select a file</p>
                  <Button variant="outline">Choose File</Button>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-4">
                Supports CSV files up to 10MB
              </p>
            </div>
          )}

          {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <span className="font-medium">
                  {uploadStatus === 'uploading' ? 'Uploading file...' : 'Processing CSV...'}
                </span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                {uploadStatus === 'uploading' 
                  ? 'Uploading your file to the server' 
                  : 'Analyzing CSV structure and content'
                }
              </p>
            </div>
          )}

          {uploadStatus === 'success' && fileInfo && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  File uploaded successfully! Ready to proceed with column mapping.
                </AlertDescription>
              </Alert>
              
              <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium">File Information</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Filename:</span>
                    <p className="font-medium">{fileInfo.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Size:</span>
                    <p className="font-medium">{formatFileSize(fileInfo.size)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rows:</span>
                    <p className="font-medium">{fileInfo.rows.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <Button onClick={resetUpload} variant="outline" className="w-full">
                Upload Different File
              </Button>
            </div>
          )}

          {uploadStatus === 'error' && error && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button onClick={resetUpload} variant="outline" className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Tips */}
      <Card>
        <CardHeader>
          <CardTitle>CSV Upload Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
            <p>Include column headers in the first row for automatic mapping</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
            <p>Use clear, descriptive column names (e.g., "Worker Name", "Email Address")</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
            <p>Ensure dates are in a consistent format (YYYY-MM-DD recommended)</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
            <p>Remove empty rows and columns to improve data quality</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FileUpload;