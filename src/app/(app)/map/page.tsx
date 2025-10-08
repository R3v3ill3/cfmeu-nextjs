'use client';
import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Users, Building, Settings, Palette, Printer, FileText } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getColorSchemeLegend, getProjectColor } from '@/utils/projectColors';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePatchOrganiserLabels } from '@/hooks/usePatchOrganiserLabels';
import { Badge } from '@/components/ui/badge';

const MobileMap = dynamic(() => import('@/components/map/MobileMap'), { ssr: false });
const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false });

export default function MapPage() {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  
  // State for map display options
  const [showPatchNames, setShowPatchNames] = useState(true);
  const [showOrganisers, setShowOrganisers] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [projectColorBy, setProjectColorBy] = useState<'tier' | 'organising_universe' | 'stage' | 'builder_eba' | 'default'>('builder_eba');
  const [labelMode, setLabelMode] = useState<'always' | 'hover' | 'key' | 'off'>('always');
  const [batchPrintMode, setBatchPrintMode] = useState(false);

  // Get selected patch IDs from URL parameters (from FiltersBar)
  const selectedPatchIds = useMemo(() => {
    const patchParam = searchParams.get("patch") || "";
    return patchParam.split(",").map(s => s.trim()).filter(Boolean);
  }, [searchParams]);

  // Fetch patch data for key table (only when key mode is active)
  const { data: patchesForKey = [] } = useQuery({
    queryKey: ["patches-for-key", selectedPatchIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patches_with_geojson")
        .select("id, name, code, geom_geojson")
        .not("geom_geojson", "is", null);
      
      if (error) throw error;
      
      // Filter by selected patches if any
      const allPatches = data || [];
      return selectedPatchIds.length > 0 
        ? allPatches.filter(p => selectedPatchIds.includes(p.id))
        : allPatches;
    },
    enabled: (showPatchNames || showOrganisers),
    retry: 1,
    staleTime: 30000
  });

  // Get organiser labels for key table
  const patchIdsForKey = (showPatchNames || showOrganisers) ? patchesForKey.map(p => p.id) : [];
  const { byPatchId: organiserNamesByPatchForKey } = usePatchOrganiserLabels(patchIdsForKey);

  // Print functionality
  const handlePrint = async () => {
    // Store original label mode outside try block for proper scoping
    const originalLabelMode = labelMode;
    
    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default;
      
      // Find the map container
      const mapElement = document.querySelector('.map-container') || document.querySelector('[class*="map"]');
      if (!mapElement) {
        alert('Map not found. Please wait for the map to load and try again.');
        return;
      }

      // For key mode, we want to capture with code labels only (don't change to 'always')
      // The print will show codes and the HTML will have the full key table

      // Add print styling temporarily
      document.body.classList.add('printing-map');
      
      // Wait for map to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Capture the map as canvas
      const canvas = await html2canvas(mapElement as HTMLElement, {
        useCORS: true,
        allowTaint: true,
        scale: 2, // Higher quality
        width: mapElement.clientWidth,
        height: mapElement.clientHeight,
        backgroundColor: '#ffffff'
      });

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups for printing functionality.');
        return;
      }

      // Build the print HTML
      const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CFMEU Patches Map</title>
          <style>
            @page { 
              size: A4 landscape; 
              margin: 1cm; 
            }
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body { 
              margin: 0; 
              padding: 15px; 
              font-family: Arial, sans-serif; 
              background: white;
            }
            .print-header { 
              text-align: center; 
              font-size: 20px; 
              font-weight: bold; 
              margin-bottom: 15px; 
              color: black;
            }
            .map-image { 
              width: 100%; 
              height: 55vh; 
              object-fit: contain; 
              border: 2px solid #000; 
              display: block;
            }
            .legend-container { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 15px; 
              margin-top: 10px; 
              height: 30vh;
              overflow: hidden;
            }
            .legend-section { 
              border: 2px solid #000; 
              padding: 8px; 
              background: white;
              overflow: hidden;
            }
            .legend-title { 
              font-weight: bold; 
              margin-bottom: 8px; 
              font-size: 12px; 
              color: black;
              border-bottom: 1px solid #ccc;
              padding-bottom: 4px;
            }
            .legend-items {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 2px;
              font-size: 9px;
              overflow: hidden;
            }
            .legend-item { 
              display: flex; 
              align-items: center; 
              gap: 4px; 
              margin-bottom: 2px; 
              break-inside: avoid;
            }
            .legend-color { 
              width: 10px; 
              height: 10px; 
              border: 2px solid #000 !important; 
              flex-shrink: 0;
              display: inline-block;
            }
            .legend-label { 
              font-size: 8px; 
              color: black !important;
              line-height: 1.1;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            CFMEU Patches Map
            ${selectedPatchIds.length > 0 ? ` - Selected Patches: ${selectedPatchIds.length}` : ''}
            ${projectColorBy !== 'default' ? ` - Colored by ${projectColorBy.replace('_', ' ')}` : ''}
          </div>
          
          <img src="${canvas.toDataURL()}" class="map-image" alt="Map" />
          
          <div class="legend-container">
            ${(showPatchNames || showOrganisers) && patchesForKey.length > 0 ? `
              <div class="legend-section">
                <div class="legend-title">Patch Labels</div>
                <div class="legend-items">
                  ${patchesForKey.slice(0, 40).map(patch => {
                    let hash = 0;
                    for (let i = 0; i < patch.id.length; i++) hash = (hash * 31 + patch.id.charCodeAt(i)) >>> 0;
                    const hue = hash % 360;
                    // Use simpler RGB calculation for better print compatibility
                    const saturation = 0.7;
                    const lightness = 0.5;
                    const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
                    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
                    const m = lightness - c / 2;
                    let r, g, b;
                    if (hue < 60) { r = c; g = x; b = 0; }
                    else if (hue < 120) { r = x; g = c; b = 0; }
                    else if (hue < 180) { r = 0; g = c; b = x; }
                    else if (hue < 240) { r = 0; g = x; b = c; }
                    else if (hue < 300) { r = x; g = 0; b = c; }
                    else { r = c; g = 0; b = x; }
                    const red = Math.round((r + m) * 255);
                    const green = Math.round((g + m) * 255);
                    const blue = Math.round((b + m) * 255);
                    
                    const organiserNames = organiserNamesByPatchForKey[patch.id];
                    const namePart = showPatchNames ? patch.name : undefined;
                    const orgPart = showOrganisers && organiserNames && organiserNames.length > 0 ? organiserNames.join(", ") : undefined;
                    
                    let label: string;
                    if (namePart && orgPart) {
                      label = `${namePart} — ${orgPart}`;
                    } else {
                      label = namePart || orgPart || patch.name;
                    }
                    
                    return `
                      <div class="legend-item">
                        <div class="legend-color" style="background: rgb(${red}, ${green}, ${blue}) !important;"></div>
                        <span class="legend-label">${patch.code}: ${label}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
            
            ${showProjects && projectColorBy !== 'default' ? `
              <div class="legend-section">
                <div class="legend-title">Project Colours (${projectColorBy.replace('_', ' ')})</div>
                <div class="legend-items">
                  ${getColorSchemeLegend(projectColorBy).map(({ label, color }) => {
                    // Convert hex color to RGB for better print compatibility
                    const hex = color.replace('#', '');
                    const r = parseInt(hex.substr(0, 2), 16);
                    const g = parseInt(hex.substr(2, 2), 16);
                    const b = parseInt(hex.substr(4, 2), 16);
                    
                    return `
                      <div class="legend-item">
                        <div class="legend-color" style="background: rgb(${r}, ${g}, ${b}) !important;"></div>
                        <span class="legend-label">${label}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(printHTML);
      printWindow.document.close();
      
      // Wait for content to load, then print
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      };

      // Clean up
      document.body.classList.remove('printing-map');
      
    } catch (error) {
      console.error('Print failed:', error);
      alert('Print failed. Please try again or use your browser\'s print function.');
      document.body.classList.remove('printing-map');
    }
  };

  // Batch print functionality for individual patch maps
  const handleBatchPrint = async () => {
    if (selectedPatchIds.length === 0) {
      alert('Please select patches using the Patch filter above to enable batch printing.');
      return;
    }

    // Store original URL state to restore later
    const originalUrl = window.location.href;

    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default;
      
      // Group patches by their geometry (handle multiple patches per location)
      const patchGroups = new Map<string, typeof patchesForKey>();
      
      for (const patch of patchesForKey) {
        if (!patch.geom_geojson) continue;
        
        // Create a location key based on geometry centroid
        const polygons = JSON.parse(JSON.stringify(patch.geom_geojson));
        let locationKey = patch.id; // fallback to individual patch
        
        try {
          if (polygons.type === 'Polygon' || polygons.type === 'MultiPolygon') {
            const coords = polygons.type === 'Polygon' ? polygons.coordinates[0] : polygons.coordinates[0][0];
            if (coords && coords.length > 0) {
              // Calculate rough centroid for grouping
              const avgLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
              const avgLng = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;
              locationKey = `${Math.round(avgLat * 1000)},${Math.round(avgLng * 1000)}`;
            }
          }
        } catch (e) {
          console.warn('Could not calculate centroid for patch:', patch.name);
        }
        
        if (!patchGroups.has(locationKey)) {
          patchGroups.set(locationKey, []);
        }
        patchGroups.get(locationKey)!.push(patch);
      }

      
      // Create individual print windows for each patch group
      let printIndex = 0;
      for (const [locationKey, patches] of patchGroups.entries()) {
        if (printIndex > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500)); // Delay between prints
        }
        
        // Get patch IDs for this group
        const patchIds = patches.map(p => p.id);
        
        // Temporarily update URL to focus on this patch group
        const url = new URL(window.location.href);
        url.searchParams.set('patch', patchIds.join(','));
        window.history.replaceState({}, '', url.toString());
        
        // Enable batch print mode to trigger auto-focus
        setBatchPrintMode(true);
        
        // Wait for map to update with new filter and auto-focus
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Find the map container
        const mapElement = document.querySelector('.map-container') || document.querySelector('[class*="map"]');
        if (!mapElement) {
          alert('Map not found. Please wait for the map to load and try again.');
          return;
        }

        // Capture the focused map
        const canvas = await html2canvas(mapElement as HTMLElement, {
          useCORS: true,
          allowTaint: true,
          scale: 2,
          width: mapElement.clientWidth,
          height: mapElement.clientHeight,
          backgroundColor: '#ffffff'
        });

        // Generate patch information for this group
        const patchInfo = patches.map(patch => {
          const organiserNames = organiserNamesByPatchForKey[patch.id];
          const orgPart = showOrganisers && organiserNames && organiserNames.length > 0 ? organiserNames.join(", ") : undefined;
          
          return {
            code: patch.code,
            name: patch.name,
            organisers: orgPart,
            // Generate color for this patch
            color: (() => {
              let hash = 0;
              for (let i = 0; i < patch.id.length; i++) hash = (hash * 31 + patch.id.charCodeAt(i)) >>> 0;
              const hue = hash % 360;
              const saturation = 0.7;
              const lightness = 0.5;
              const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
              const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
              const m = lightness - c / 2;
              let r, g, b;
              if (hue < 60) { r = c; g = x; b = 0; }
              else if (hue < 120) { r = x; g = c; b = 0; }
              else if (hue < 180) { r = 0; g = c; b = x; }
              else if (hue < 240) { r = 0; g = x; b = c; }
              else if (hue < 300) { r = x; g = 0; b = c; }
              else { r = c; g = 0; b = x; }
              const red = Math.round((r + m) * 255);
              const green = Math.round((g + m) * 255);
              const blue = Math.round((b + m) * 255);
              return `rgb(${red}, ${green}, ${blue})`;
            })()
          };
        });

        // Create print window for this patch group
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          alert('Please allow popups for batch printing functionality.');
          return;
        }

        const printHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>CFMEU Patch Map - ${patches.map(p => p.name).join(', ')}</title>
            <style>
              @page { 
                size: A4 portrait; 
                margin: 1.5cm; 
              }
              * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body { 
                margin: 0; 
                padding: 0; 
                font-family: Arial, sans-serif; 
                background: white;
              }
              .patch-header { 
                text-align: center; 
                font-size: 20px; 
                font-weight: bold; 
                margin-bottom: 15px; 
                color: black;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
              }
              .patch-codes {
                text-align: center;
                font-size: 24px;
                font-weight: bold;
                color: #0066cc;
                margin-bottom: 15px;
              }
              .map-image { 
                width: 100%; 
                height: 60vh; 
                object-fit: contain; 
                border: 2px solid #000; 
                display: block;
                margin-bottom: 15px;
              }
              .patch-details {
                border: 2px solid #000;
                padding: 15px;
                background: #f9f9f9;
              }
              .patch-details-title {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
                color: black;
              }
              .patch-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                margin-bottom: 8px;
                padding: 8px;
                border: 1px solid #ccc;
                background: white;
              }
              .patch-color {
                width: 16px;
                height: 16px;
                border: 2px solid #000;
                flex-shrink: 0;
                margin-top: 2px;
              }
              .patch-info {
                flex: 1;
              }
              .patch-name {
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 4px;
              }
              .patch-code {
                font-size: 12px;
                color: #666;
                margin-bottom: 4px;
              }
              .patch-organisers {
                font-size: 11px;
                color: #333;
                font-style: italic;
              }
            </style>
          </head>
          <body>
            <div class="patch-header">
              CFMEU Patch Map${patches.length > 1 ? 's' : ''}
            </div>
            
            <div class="patch-codes">
              ${patches.map(p => p.code || p.name).join(' • ')}
            </div>
            
            <img src="${canvas.toDataURL()}" class="map-image" alt="Patch Map" />
            
            <div class="patch-details">
              <div class="patch-details-title">Patch Information</div>
              ${patchInfo.map(info => `
                <div class="patch-item">
                  <div class="patch-color" style="background: ${info.color};"></div>
                  <div class="patch-info">
                    <div class="patch-name">${info.name}</div>
                    <div class="patch-code">Code: ${info.code}</div>
                    ${info.organisers ? `<div class="patch-organisers">Organiser${info.organisers.includes(',') ? 's' : ''}: ${info.organisers}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </body>
          </html>
        `;

        printWindow.document.write(printHTML);
        printWindow.document.close();
        
        // Print this window
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
          // Don't auto-close - let user manage multiple windows
        };

        printIndex++;
      }

      // Restore original URL state and disable batch print mode
      setBatchPrintMode(false);
      window.history.replaceState({}, '', originalUrl);

      alert(`Generated ${patchGroups.size} individual patch map${patchGroups.size > 1 ? 's' : ''} for printing.`);
      
    } catch (error) {
      console.error('Batch print failed:', error);
      alert('Batch print failed. Please try again.');
      // Restore original state even on error
      setBatchPrintMode(false);
      try {
        window.history.replaceState({}, '', originalUrl);
      } catch (e) {
        console.warn('Could not restore original URL');
      }
    }
  };

  // Fetch project data for project color key
  const { data: projectsForKey = [] } = useQuery({
    queryKey: ["projects-for-key", projectColorBy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select(`
          project_id,
          projects:projects!fk_job_sites_project(
            id, 
            name, 
            tier, 
            organising_universe, 
            stage_class,
            builder_id,
            project_assignments:project_assignments(
              assignment_type,
              contractor_role_types(code),
              employers(name, enterprise_agreement_status)
            )
          )
        `)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      
      if (error) throw error;
      
      // Extract unique projects
      const projectsMap = new Map();
      (data || []).forEach((site: any) => {
        const project = site.projects;
        if (project && project.id) {
          projectsMap.set(project.id, project);
        }
      });
      
      return Array.from(projectsMap.values());
    },
    enabled: showProjects && projectColorBy !== 'default',
    retry: 1,
    staleTime: 30000
  });

  const MapControls = () => (
    <div className={`flex items-center gap-6 ${isMobile ? 'flex-col items-stretch gap-4' : ''}`}>
      <div className="flex items-center space-x-2">
        <Switch
          id="show-projects"
          checked={showProjects}
          onCheckedChange={setShowProjects}
        />
        <Label htmlFor="show-projects" className="flex items-center gap-2 text-sm font-medium">
          <Building className="h-4 w-4" />
          Show Projects
        </Label>
      </div>
      
      {showProjects && (
        <div className="flex items-center space-x-2">
          <Palette className="h-4 w-4 text-gray-500" />
          <Select value={projectColorBy} onValueChange={(value) => setProjectColorBy(value as typeof projectColorBy)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Color projects by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (Blue)</SelectItem>
              <SelectItem value="tier">Tier</SelectItem>
              <SelectItem value="organising_universe">Organising Universe</SelectItem>
              <SelectItem value="stage">Stage</SelectItem>
              <SelectItem value="builder_eba">Builder EBA Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div className="flex items-center space-x-2">
        <Switch
          id="show-patch-names"
          checked={showPatchNames}
          onCheckedChange={setShowPatchNames}
        />
        <Label htmlFor="show-patch-names" className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4" />
          Patch Names
        </Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch
          id="show-organisers"
          checked={showOrganisers}
          onCheckedChange={setShowOrganisers}
        />
        <Label htmlFor="show-organisers" className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          Organisers
        </Label>
      </div>
      
      {(showPatchNames || showOrganisers) && (
        <div className="flex items-center space-x-2">
          <Label className="text-sm font-medium">Labels:</Label>
          <Select value={labelMode} onValueChange={(value) => setLabelMode(value as typeof labelMode)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">Always</SelectItem>
              <SelectItem value="hover">On Hover</SelectItem>
              <SelectItem value="key">Key</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  return (
    <div className={`space-y-4 relative ${isMobile ? 'px-safe py-4 pb-safe-bottom' : ''}`}>
      {/* Print-only elements */}
      <div className="print-only print-title">
        CFMEU Patches Map
        {selectedPatchIds.length > 0 && ` - Selected Patches: ${selectedPatchIds.length}`}
        {projectColorBy !== 'default' && ` - Colored by ${projectColorBy.replace('_', ' ')}`}
      </div>
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'} no-print`}>
        <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>Patches Map</h1>
        
        <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center gap-4'}`}>
          {/* Print Buttons */}
          <Button variant="outline" onClick={handlePrint} className={`print:hidden ${isMobile ? 'w-full' : ''}`} size={isMobile ? "sm" : "default"}>
            <Printer className="h-4 w-4 mr-2" />
            Print Map
          </Button>
          
          {patchesForKey.length > 0 && (
            <Button variant="outline" onClick={handleBatchPrint} className={`print:hidden ${isMobile ? 'w-full' : ''}`} size={isMobile ? "sm" : "default"}>
              <FileText className="h-4 w-4 mr-2" />
              Print Patches ({patchesForKey.length})
            </Button>
          )}
          
          {/* Desktop Controls */}
          {!isMobile && <MapControls />}
          
          {/* Mobile Controls */}
          {isMobile && (
            <Collapsible open={mobileControlsOpen} onOpenChange={setMobileControlsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Map Options
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          )}
        </div>
      </div>
      
      {/* Mobile Controls Content */}
      {isMobile && (
        <Collapsible open={mobileControlsOpen} onOpenChange={setMobileControlsOpen}>
          <CollapsibleContent className="space-y-2 no-print">
            <Card>
              <CardContent className="pt-4">
                <MapControls />
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
      
      <Card className="print-show map-print-container">
        <CardHeader className="no-print">
          <CardTitle>Map View</CardTitle>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <MobileMap 
              showJobSites={showProjects}
              showPatchNames={showPatchNames}
              showOrganisers={showOrganisers}
              selectedPatchIds={selectedPatchIds}
              projectColorBy={projectColorBy}
              labelMode={labelMode}
              autoFocusPatches={batchPrintMode}
            />
          ) : (
            <div style={{ height: '70vh' }} className="map-container">
              <InteractiveMap 
                showJobSites={showProjects}
                showPatches={true}
                selectedPatchTypes={['geo']}
                mapMode="standard"
                showPatchNames={showPatchNames}
                showOrganisers={showOrganisers}
                selectedPatchIds={selectedPatchIds}
                projectColorBy={projectColorBy}
                labelMode={labelMode}
                autoFocusPatches={batchPrintMode}
              />
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Print-only legend positioned on map */}
      {showProjects && projectColorBy !== 'default' && (
        <div className="print-only print-legend">
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}>
            Project Colours ({projectColorBy.replace('_', ' ')})
          </div>
          {getColorSchemeLegend(projectColorBy).map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div 
                style={{ 
                  width: '12px', 
                  height: '12px', 
                  backgroundColor: color, 
                  border: '1px solid black',
                  borderRadius: '50%'
                }} 
              />
              <span style={{ fontSize: '10px', color: 'black' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Screen-only Color Legend for Projects */}
      {showProjects && projectColorBy !== 'default' && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Project Colour Legend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {getColorSchemeLegend(projectColorBy).map(({ label, color }) => {
                if (projectColorBy === 'builder_eba' && label.startsWith('Builder = EBA active')) {
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <img src="/favicon.ico" alt="Active EBA" className="w-4 h-4" />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                  )
                }
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-white shadow-sm" 
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print-only patch legend positioned on map */}
      {(showPatchNames || showOrganisers) && patchesForKey.length > 0 && (
        <div className="print-only" style={{ position: 'absolute', bottom: '20px', right: '20px', background: 'white', padding: '10px', border: '1px solid black', borderRadius: '5px', maxWidth: '300px', zIndex: 1000 }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}>
            Patch Labels
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {patchesForKey.slice(0, 20).map(patch => {
              // Generate the same color as used in the map - use RGB for print compatibility
              let hash = 0;
              for (let i = 0; i < patch.id.length; i++) hash = (hash * 31 + patch.id.charCodeAt(i)) >>> 0;
              const hue = hash % 360;
              const r = Math.round(255 * (1 + Math.cos(hue * Math.PI / 180)) / 2 * 0.8);
              const g = Math.round(255 * (1 + Math.cos((hue + 120) * Math.PI / 180)) / 2 * 0.8);
              const b = Math.round(255 * (1 + Math.cos((hue + 240) * Math.PI / 180)) / 2 * 0.8);
              const color = `rgb(${r}, ${g}, ${b})`;
              
              // Generate the same label as used in the map
              const organiserNames = organiserNamesByPatchForKey[patch.id];
              const namePart = showPatchNames ? patch.name : undefined;
              const orgPart = showOrganisers && organiserNames && organiserNames.length > 0 ? organiserNames.join(", ") : undefined;
              
              let label: string;
              if (namePart && orgPart) {
                label = `${namePart} — ${orgPart}`;
              } else {
                label = namePart || orgPart || patch.name;
              }
              
              return (
                <div key={patch.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <div 
                    style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: color, 
                      border: '2px solid black',
                      borderRadius: '2px'
                    }} 
                  />
                  <span style={{ fontSize: '10px', color: 'black', fontWeight: 'bold' }}>
                    {patch.code}: {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Screen-only Patch Labels Key Table */}
      {labelMode === 'key' && (showPatchNames || showOrganisers) && patchesForKey.length > 0 && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Patch Labels Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {patchesForKey.map(patch => {
                  // Generate the same color as used in the map
                  let hash = 0;
                  for (let i = 0; i < patch.id.length; i++) hash = (hash * 31 + patch.id.charCodeAt(i)) >>> 0;
                  const hue = hash % 360;
                  const color = `hsl(${hue} 80% 60%)`;
                  
                  // Generate the same label as used in the map
                  const organiserNames = organiserNamesByPatchForKey[patch.id];
                  const namePart = showPatchNames ? patch.name : undefined;
                  const orgPart = showOrganisers && organiserNames && organiserNames.length > 0 ? organiserNames.join(", ") : undefined;
                  
                  let label: string;
                  if (namePart && orgPart) {
                    label = `${namePart} — ${orgPart}`;
                  } else {
                    label = namePart || orgPart || patch.name;
                  }
                  
                  return (
                    <div key={patch.id} className="flex items-center gap-3 p-2 border rounded-lg">
                      <div 
                        className="w-6 h-6 rounded border-2 border-gray-300 shadow-sm flex-shrink-0" 
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          <span className="font-bold text-blue-600">{patch.code}:</span> {label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {showPatchNames && showOrganisers && organiserNames?.length > 0 && 
                            `Organiser${organiserNames.length > 1 ? 's' : ''}: ${organiserNames.join(", ")}`
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Screen-only Project Colour Key Table */}
      {showProjects && projectColorBy !== 'default' && projectsForKey.length > 0 && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Project Colour Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {projectsForKey.map((project: any) => {
                const color = getProjectColor(projectColorBy, project);
                
                // Derive builder status for display
                let statusLabel = '';
                if (projectColorBy === 'builder_eba') {
                  const builderAssignments = (project.project_assignments || []).filter((pa: any) => {
                    if (pa?.assignment_type !== 'contractor_role') return false;
                    const roleTypes = Array.isArray(pa?.contractor_role_types) ? pa.contractor_role_types : (pa?.contractor_role_types ? [pa.contractor_role_types] : []);
                    return roleTypes.some((rt: any) => rt?.code === 'builder' || rt?.code === 'head_contractor');
                  });
                  
                  let hasActiveEba = false;
                  let hasBuilder = false;
                  
                  for (const assignment of builderAssignments) {
                    const employers = Array.isArray(assignment?.employers) ? assignment.employers : (assignment?.employers ? [assignment.employers] : []);
                    for (const emp of employers) {
                      if (emp?.enterprise_agreement_status === true) {
                        hasActiveEba = true;
                      }
                      if (emp) hasBuilder = true;
                    }
                  }
                  
                  if (project.builder_id) hasBuilder = true;
                  
                  if (hasActiveEba) {
                    statusLabel = 'Builder = EBA active';
                  } else if (hasBuilder) {
                    statusLabel = 'Builder known, EBA inactive';
                  } else {
                    statusLabel = 'Builder not known';
                  }
                }
                
                return (
                  <div key={project.id} className="flex items-center gap-3 p-2 border rounded-lg">
                    {projectColorBy === 'builder_eba' && statusLabel === 'Builder = EBA active' ? (
                      <img src="/favicon.ico" alt="Active EBA" className="w-6 h-6 flex-shrink-0" />
                    ) : (
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{project.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {projectColorBy === 'tier' && project.tier && `Tier: ${project.tier}`}
                        {projectColorBy === 'organising_universe' && project.organising_universe && `Universe: ${project.organising_universe}`}
                        {projectColorBy === 'stage' && project.stage_class && `Stage: ${project.stage_class}`}
                        {projectColorBy === 'builder_eba' && statusLabel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
