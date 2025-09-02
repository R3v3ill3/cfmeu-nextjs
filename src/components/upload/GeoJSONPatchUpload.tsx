'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, MapPin, Upload, FileText } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import {
  parsePatchesWithFuzzyMatching,
  ParsedPatch,
  GeoJSONFeature,
  convertToWKT,
} from '@/utils/patchMatchingUtils';
import PatchMatchingDialog from './PatchMatchingDialog';

interface GeoJSONFile {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

interface GeoJSONPatchUploadProps {
  onUploadComplete: () => void;
  onBack: () => void;
}

export default function GeoJSONPatchUpload({ onUploadComplete, onBack }: GeoJSONPatchUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<GeoJSONFile | null>(null);
  const [parsedPatches, setParsedPatches] = useState<ParsedPatch[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'upload' | 'review' | 'matching' | 'import' | 'complete'>('upload');
  const [importResults, setImportResults] = useState<{created: number, updated: number, errors: number} | null>(null);
  const { toast } = useToast();

  // Get existing patches for matching
  const { data: existingPatches = [] } = useQuery({
    queryKey: ['existing-patches'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('patches')
        .select('id, name, code, type')
        .eq('type', 'geo')
        .eq('status', 'active');

      if (error) throw error;
      return data || [];
    }
  });

  // Parse GeoJSON file
  const handleFileUpload = useCallback(async (selectedFile: File) => {
    try {
      const text = await selectedFile.text();
      const data: GeoJSONFile = JSON.parse(text);
      
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        throw new Error('Invalid GeoJSON file. Expected FeatureCollection.');
      }

      // Validate features
      const validFeatures = data.features.filter(feature => {
        return (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') &&
               feature.properties?.patch_name;
      });

      if (validFeatures.length === 0) {
        throw new Error('No valid polygon features found with required properties.');
      }

      setFile(selectedFile);
      setParsedData(data);
      
      // Parse patches with fuzzy matching
      const patches = parsePatchesWithFuzzyMatching(validFeatures, existingPatches);
      
      setParsedPatches(patches);
      
      // Check if we need manual matching
      const needsManualMatching = patches.some(p => p.status === 'manual_match');
      
      if (needsManualMatching) {
        setUploadStep('matching');
      } else {
        setUploadStep('review');
      }
      
    } catch (error) {
      toast({
        title: "Error parsing file",
        description: error instanceof Error ? error.message : "Invalid file format",
        variant: "destructive"
      });
    }
  }, [toast, existingPatches]);

  // Handle manual matching confirmation
  const handleMatchingConfirm = (confirmedPatches: ParsedPatch[]) => {
    setParsedPatches(confirmedPatches);
    setUploadStep('review');
  };

  const handleMatchingCancel = () => {
    setUploadStep('upload');
    setFile(null);
    setParsedData(null);
    setParsedPatches([]);
  };

  const handleReset = () => {
    setUploadStep('upload');
    setFile(null);
    setParsedData(null);
    setParsedPatches([]);
    setImportResults(null);
  };

  // Import patches to database
  const handleImport = async () => {
    setIsUploading(true);
    const supabase = getSupabaseBrowserClient();
    
    try {
      let created = 0;
      let updated = 0;
      let errors = 0;

      // Group features for existing patches
      const existingPatchGeometryMap = new Map<string, any[]>();
      // Group features for new patches by name
      const newPatchGeometryMap = new Map<string, any[]>();

      for (const parsedPatch of parsedPatches) {
        if (parsedPatch.status === 'new') {
          const patchName = parsedPatch.patch_name;
          if (!newPatchGeometryMap.has(patchName)) {
            newPatchGeometryMap.set(patchName, []);
          }
          newPatchGeometryMap.get(patchName)!.push(parsedPatch.original_geometry);
        } else if (parsedPatch.existing_patch_ids && parsedPatch.existing_patch_ids.length > 0) {
          for (const patchId of parsedPatch.existing_patch_ids) {
            if (!existingPatchGeometryMap.has(patchId)) {
              existingPatchGeometryMap.set(patchId, []);
            }
            existingPatchGeometryMap.get(patchId)!.push(parsedPatch.original_geometry);
          }
        }
      }

      // 1. Create new patches with aggregated geometries
      for (const [patchName, geometries] of newPatchGeometryMap.entries()) {
        try {
          const { data: newPatch, error: insertError } = await supabase
            .from('patches')
            .insert({ name: patchName, type: 'geo', status: 'active' })
            .select('id')
            .single();

          if (insertError) throw insertError;
          
          const newPatchId = newPatch.id;
          const wktGeometries = geometries.map(g => convertToWKT(g));

          const { error: rpcError } = await supabase.rpc(
            'set_patch_geometries_from_wkt',
            {
              p_patch_id: newPatchId,
              p_geometries_wkt: wktGeometries,
            }
          );

          if (rpcError) throw rpcError;

          created++;
        } catch (error) {
          console.error(`Error creating new patch ${patchName}:`, error);
          errors++;
        }
      }
      
      // 2. Update existing patches with aggregated geometries
      for (const [patchId, geometries] of existingPatchGeometryMap.entries()) {
        try {
          const wktGeometries = geometries.map(g => convertToWKT(g));
          const { error } = await supabase.rpc(
            'set_patch_geometries_from_wkt',
            {
              p_patch_id: patchId,
              p_geometries_wkt: wktGeometries,
            }
          );

          if (error) throw error;
          updated++;
        } catch (error) {
          console.error(`Error updating patch ${patchId}:`, error);
          errors++;
        }
      }


      setImportResults({ created, updated, errors });
      setUploadStep('complete');
      
      // Show toast notification
      toast({
        title: "Import completed",
        description: `Created: ${created}, Updated: ${updated}, Errors: ${errors}`,
        variant: errors > 0 ? "destructive" : "default"
      });
      
      // Call onUploadComplete if no errors
      if (errors === 0) {
        onUploadComplete();
      }
      
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Summary statistics
  const summary = useMemo(() => {
    if (!parsedPatches.length) return null;
    
    const newPatches = parsedPatches.filter(p => p.status === 'new').length;
    const existingPatches = parsedPatches.filter(p => p.status === 'existing').length;
    const manualMatches = parsedPatches.filter(p => p.status === 'manual_match').length;
    const uniquePatchIds = new Set(parsedPatches.map(p => p.patch_id)).size;
    
    return { 
      newPatches, 
      existingPatches, 
      manualMatches,
      uniquePatchIds, 
      totalFeatures: parsedPatches.length 
    };
  }, [parsedPatches]);

  if (uploadStep === 'matching') {
    return (
      <PatchMatchingDialog
        patches={parsedPatches}
        existingPatches={existingPatches}
        onConfirm={handleMatchingConfirm}
        onCancel={handleMatchingCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Upload GeoJSON Patches</h2>
          <p className="text-gray-600 mt-1">
            Upload GeoJSON file with patch boundaries and automatically assign projects
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
      </div>

      {uploadStep === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload GeoJSON File</CardTitle>
            <CardDescription>
              Select a GeoJSON file containing patch boundaries. Expected properties: fid, patch_name, coordinator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".geojson,.json"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
                id="geojson-upload"
              />
              <label htmlFor="geojson-upload" className="cursor-pointer">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Click to upload GeoJSON file
                </p>
                <p className="text-xs text-gray-500">
                  Supports .geojson and .json files
                </p>
              </label>
            </div>
            
            {file && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                <span>{file.name}</span>
                <Badge variant="secondary">{file.size} bytes</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {uploadStep === 'review' && summary && (
        <Card>
          <CardHeader>
            <CardTitle>Review Patch Data</CardTitle>
            <CardDescription>
              Review the parsed patches before importing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{summary.totalFeatures}</div>
                <div className="text-sm text-blue-600">Total Features</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.uniquePatchIds}</div>
                <div className="text-sm text-green-600">Unique Patches</div>
              </div>
              <div className="text-center p-3 bg-green-100 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{summary.existingPatches}</div>
                <div className="text-sm text-green-700">Exact Matches</div>
              </div>
              <div className="text-center p-3 bg-blue-100 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{summary.manualMatches}</div>
                <div className="text-sm text-blue-700">Manual Matches</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{summary.newPatches}</div>
                <div className="text-sm text-yellow-600">New Patches</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Patch Details:</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {parsedPatches.map((patch, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-3">
                      <Badge variant={
                        patch.status === 'new' ? 'default' : 
                        patch.status === 'existing' ? 'secondary' :
                        'outline'
                      }>
                        {patch.status === 'new' ? 'New' : 
                         patch.status === 'existing' ? 'Update' : 'Manual'}
                      </Badge>
                      <span className="font-mono text-sm">{patch.patch_id}</span>
                      <span>{patch.patch_name}</span>
                      {patch.match_confidence && (
                        <span className="text-xs text-gray-500">
                          ({Math.round((patch.match_similarity || 0) * 100)}% match)
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">FID: {patch.fid}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-2">
              <Button onClick={() => setUploadStep('upload')} variant="outline">
                ← Back
              </Button>
              <Button onClick={handleImport} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <img src="/spinner.gif" alt="Loading" className="mr-2 h-4 w-4" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Import Patches
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadStep === 'complete' && importResults && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
            <CardDescription>
              Summary of patches imported or updated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importResults.created}</div>
                <div className="text-sm text-green-600">New Patches Created</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{importResults.updated}</div>
                <div className="text-sm text-blue-600">Patches Updated</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{importResults.errors}</div>
                <div className="text-sm text-red-600">Import Errors</div>
              </div>
            </div>
            {importResults.errors > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Some patches failed to import. Please check the console for details and try again.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={handleReset}>
                Upload Another File
              </Button>
              <Button onClick={onUploadComplete}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
