'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, Loader2, MapPin, Upload, FileText } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: {
    fid: number;
    patch_id: string;
    patch_name: string;
    coordinator: string;
  };
}

interface GeoJSONFile {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

interface ParsedPatch {
  fid: number;
  patch_id: string;
  patch_name: string;
  coordinator: string;
  geometry: string; // WKT format for PostGIS
  status: 'new' | 'existing' | 'updated';
  existing_patch_id?: string;
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
  const [uploadStep, setUploadStep] = useState<'upload' | 'review' | 'import'>('upload');
  const { toast } = useToast();

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
        return feature.geometry?.type === 'Polygon' && 
               feature.properties?.patch_id && 
               feature.properties?.patch_name;
      });

      if (validFeatures.length === 0) {
        throw new Error('No valid polygon features found with required properties.');
      }

      setFile(selectedFile);
      setParsedData(data);
      
      // Parse patches and check for existing ones
      const patches = await parsePatches(validFeatures);
      setParsedPatches(patches);
      setUploadStep('review');
      
    } catch (error) {
      toast({
        title: "Error parsing file",
        description: error instanceof Error ? error.message : "Invalid file format",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Parse patches and check for existing ones
  const parsePatches = async (features: GeoJSONFeature[]): Promise<ParsedPatch[]> => {
    const supabase = getSupabaseBrowserClient();
    
    // Get existing patches
    const { data: existingPatches } = await supabase
      .from('patches')
      .select('id, name, type')
      .eq('type', 'geo');

    const patches: ParsedPatch[] = [];
    
    for (const feature of features) {
      const { fid, patch_id, patch_name, coordinator } = feature.properties;
      
      // Convert coordinates to WKT format for PostGIS
      const wkt = convertToWKT(feature.geometry);
      
      // Check if patch already exists by name (since we don't have patch_id field in DB)
      const existing = existingPatches?.find(p => p.name === patch_name);
      
      patches.push({
        fid,
        patch_id,
        patch_name,
        coordinator,
        geometry: wkt,
        status: existing ? 'existing' : 'new',
        existing_patch_id: existing?.id
      });
    }
    
    return patches;
  };

  // Convert GeoJSON coordinates to WKT format
  const convertToWKT = (geometry: any): string => {
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates[0]; // Outer ring
      const points = coords.map((coord: number[]) => `${coord[0]} ${coord[1]}`).join(', ');
      return `POLYGON((${points}))`;
    }
    throw new Error(`Unsupported geometry type: ${geometry.type}`);
  };

  // Import patches to database
  const handleImport = async () => {
    setIsUploading(true);
    const supabase = getSupabaseBrowserClient();
    
    try {
      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const patch of parsedPatches) {
        try {
          if (patch.status === 'new') {
            // Create new patch
            const { error } = await supabase
              .from('patches')
              .insert({
                name: patch.patch_name,
                type: 'geo',
                geom: `SRID=4326;${patch.geometry}`,
                status: 'active'
              });
            
            if (error) throw error;
            created++;
            
          } else if (patch.status === 'existing' && patch.existing_patch_id) {
            // Update existing patch geometry
            const { error } = await supabase
              .from('patches')
              .update({
                geom: `SRID=4326;${patch.geometry}`
              })
              .eq('id', patch.existing_patch_id);
            
            if (error) throw error;
            updated++;
          }
          
        } catch (error) {
          console.error(`Error processing patch ${patch.patch_id}:`, error);
          errors++;
        }
      }

      toast({
        title: "Import completed",
        description: `Created: ${created}, Updated: ${updated}, Errors: ${errors}`,
        variant: errors > 0 ? "destructive" : "default"
      });

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
    const uniquePatchIds = new Set(parsedPatches.map(p => p.patch_id)).size;
    
    return { newPatches, existingPatches, uniquePatchIds, totalFeatures: parsedPatches.length };
  }, [parsedPatches]);

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
              Select a GeoJSON file containing patch boundaries. Expected properties: fid, patch_id, patch_name, coordinator
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{summary.totalFeatures}</div>
                <div className="text-sm text-blue-600">Total Features</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.uniquePatchIds}</div>
                <div className="text-sm text-green-600">Unique Patches</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{summary.newPatches}</div>
                <div className="text-sm text-yellow-600">New Patches</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{summary.existingPatches}</div>
                <div className="text-sm text-purple-600">Existing Patches</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Patch Details:</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {parsedPatches.map((patch, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-3">
                      <Badge variant={patch.status === 'new' ? 'default' : 'secondary'}>
                        {patch.status === 'new' ? 'New' : 'Update'}
                      </Badge>
                      <span className="font-mono text-sm">{patch.patch_id}</span>
                      <span>{patch.patch_name}</span>
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
    </div>
  );
}
