'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { processContractorData, ProcessedContractorData } from "@/utils/contractorDataProcessor";

interface ContractorImportProps {
  csvData: any[];
  onImportComplete: (results: ImportResults) => void;
  onBack: () => void;
}

interface ImportResults {
  successful: number;
  failed: number;
  errors: string[];
  duplicates: number;
}

export default function ContractorImport({ csvData, onImportComplete, onBack }: ContractorImportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<ProcessedContractorData[]>([]);
  const [isProcessed, setIsProcessed] = useState(false);
  const { toast } = useToast();

  const processData = () => {
    try {
      const processed = processContractorData(csvData);
      setPreviewData(processed);
      setIsProcessed(true);
      
      toast({
        title: "Data processed",
        description: `Successfully processed ${processed.length} contractor records`,
      });
    } catch (error) {
      toast({
        title: "Processing failed",
        description: "Error processing contractor data",
        variant: "destructive",
      });
    }
  };

  const importContractors = async () => {
    setIsImporting(true);
    const results: ImportResults = {
      successful: 0,
      failed: 0,
      errors: [],
      duplicates: 0
    };

    try {
      for (const contractor of previewData) {
        try {
          // Check if contractor already exists
          const { data: existing } = await supabase
            .from('employers')
            .select('id')
            .eq('name', contractor.name)
            .single();

          if (existing) {
            results.duplicates++;
            continue;
          }

          // Insert employer record
          const { data: employerData, error: employerError } = await supabase
            .from('employers')
            .insert({
              name: contractor.name,
              employer_type: contractor.employer_type,
              phone: contractor.phone,
              email: contractor.email,
              address_line_1: contractor.address_line_1,
              address_line_2: contractor.address_line_2,
              suburb: contractor.suburb,
              state: contractor.state,
              postcode: contractor.postcode,
              website: contractor.website,
              contact_notes: contractor.contact_notes
            })
            .select('id')
            .single();

          if (employerError) throw employerError;

          // Insert trade capability record
          const { error: tradeError } = await supabase
            .from('contractor_trade_capabilities')
            .insert({
              employer_id: employerData.id,
              trade_type: contractor.trade_type as any,
              is_primary: true,
              notes: `EBA Signatory: ${contractor.eba_signatory}`
            });

          if (tradeError) throw tradeError;

          results.successful++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${contractor.name}: ${error.message}`);
        }
      }

      toast({
        title: "Import completed",
        description: `Successfully imported ${results.successful} contractors`,
      });

      onImportComplete(results);
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isProcessed) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Process Contractor Data</h3>
          <p className="text-muted-foreground mb-6">
            Click below to process and preview your contractor data before import.
          </p>
          <Button onClick={processData} size="lg">
            <CheckCircle className="mr-2 h-5 w-5" />
            Process Data
          </Button>
        </div>
        
        <div className="flex gap-4">
          <Button variant="outline" onClick={onBack}>
            Back to Mapping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Contractor Import Preview</h3>
          <p className="text-muted-foreground">
            Review the processed data before importing to the database
          </p>
        </div>
        <Badge variant="secondary">
          {previewData.length} contractors ready
        </Badge>
      </div>

      {previewData.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No valid contractor data found. Please check your CSV format and try again.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="max-h-96 overflow-y-auto space-y-4">
            {previewData.slice(0, 10).map((contractor, index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{contractor.name}</CardTitle>
                    <Badge variant="outline">{contractor.trade_type.replace('_', ' ')}</Badge>
                  </div>
                  <CardDescription>
                    EBA Status: {contractor.eba_signatory}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {contractor.phone && (
                      <div>
                        <span className="font-medium">Phone:</span> {contractor.phone}
                      </div>
                    )}
                    {contractor.email && (
                      <div>
                        <span className="font-medium">Email:</span> {contractor.email}
                      </div>
                    )}
                    {contractor.address_line_1 && (
                      <div className="col-span-2">
                        <span className="font-medium">Address:</span> {contractor.address_line_1}
                        {contractor.suburb && `, ${contractor.suburb}`}
                        {contractor.state && ` ${contractor.state}`}
                        {contractor.postcode && ` ${contractor.postcode}`}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {previewData.length > 10 && (
            <p className="text-sm text-muted-foreground text-center">
              Showing first 10 of {previewData.length} contractors
            </p>
          )}

          <div className="flex gap-4">
            <Button variant="outline" onClick={onBack}>
              Back to Mapping
            </Button>
            <Button 
              onClick={importContractors} 
              disabled={isImporting}
              className="ml-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? "Importing..." : `Import ${previewData.length} Contractors`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}