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
import { MapPin, Users, Building, Settings, Palette, Printer } from 'lucide-react';
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
  const [projectColorBy, setProjectColorBy] = useState<'tier' | 'organising_universe' | 'stage' | 'default'>('default');
  const [labelMode, setLabelMode] = useState<'always' | 'hover' | 'key' | 'off'>('always');

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
    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default;
      
      // Find the map container
      const mapElement = document.querySelector('.map-container') || document.querySelector('[class*="map"]');
      if (!mapElement) {
        alert('Map not found. Please wait for the map to load and try again.');
        return;
      }

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
            @page { size: A4 landscape; margin: 1cm; }
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .print-header { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .map-image { width: 100%; max-height: 60vh; object-fit: contain; border: 2px solid #000; }
            .legend-container { display: flex; gap: 20px; margin-top: 15px; flex-wrap: wrap; }
            .legend-section { flex: 1; min-width: 250px; border: 1px solid #ccc; padding: 10px; }
            .legend-title { font-weight: bold; margin-bottom: 10px; font-size: 14px; }
            .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
            .legend-color { width: 12px; height: 12px; border: 1px solid #000; border-radius: 50%; }
            .legend-label { font-size: 11px; }
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
                ${patchesForKey.slice(0, 30).map(patch => {
                  let hash = 0;
                  for (let i = 0; i < patch.id.length; i++) hash = (hash * 31 + patch.id.charCodeAt(i)) >>> 0;
                  const hue = hash % 360;
                  const color = `hsl(${hue} 80% 60%)`;
                  
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
                      <div class="legend-color" style="background-color: ${color};"></div>
                      <span class="legend-label">${label} (${patch.code})</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
            
            ${showProjects && projectColorBy !== 'default' ? `
              <div class="legend-section">
                <div class="legend-title">Project Colors (${projectColorBy.replace('_', ' ')})</div>
                ${getColorSchemeLegend(projectColorBy).map(({ label, color }) => `
                  <div class="legend-item">
                    <div class="legend-color" style="background-color: ${color};"></div>
                    <span class="legend-label">${label}</span>
                  </div>
                `).join('')}
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

  // Fetch project data for project color key
  const { data: projectsForKey = [] } = useQuery({
    queryKey: ["projects-for-key"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select(`
          project_id,
          projects:projects!fk_job_sites_project(id, name, tier, organising_universe, stage_class)
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
    <div className="space-y-4 relative">
      {/* Print-only elements */}
      <div className="print-only print-title">
        CFMEU Patches Map
        {selectedPatchIds.length > 0 && ` - Selected Patches: ${selectedPatchIds.length}`}
        {projectColorBy !== 'default' && ` - Colored by ${projectColorBy.replace('_', ' ')}`}
      </div>
      <div className="flex items-center justify-between no-print">
        <h1 className="text-2xl font-bold">Patches Map</h1>
        
        <div className="flex items-center gap-4">
          {/* Print Button */}
          <Button variant="outline" onClick={handlePrint} className="print:hidden">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          
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
              labelMode={labelMode === 'key' ? 'always' : labelMode}
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
                labelMode={labelMode === 'key' ? 'always' : labelMode}
              />
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Print-only legend positioned on map */}
      {showProjects && projectColorBy !== 'default' && (
        <div className="print-only print-legend">
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}>
            Project Colors ({projectColorBy.replace('_', ' ')})
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
              Project Color Legend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {getColorSchemeLegend(projectColorBy).map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
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
                <div key={patch.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <div 
                    style={{ 
                      width: '10px', 
                      height: '10px', 
                      backgroundColor: color, 
                      border: '1px solid black'
                    }} 
                  />
                  <span style={{ fontSize: '9px', color: 'black' }}>{label}</span>
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
                      className="w-6 h-6 rounded border-2 border-white shadow-sm flex-shrink-0" 
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{label}</div>
                      <div className="text-xs text-muted-foreground">Code: {patch.code}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Screen-only Project Color Key Table */}
      {showProjects && projectColorBy !== 'default' && projectsForKey.length > 0 && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Project Color Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {projectsForKey.map((project: any) => {
                const color = getProjectColor(projectColorBy, project);
                
                return (
                  <div key={project.id} className="flex items-center gap-3 p-2 border rounded-lg">
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{project.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {projectColorBy === 'tier' && project.tier && `Tier: ${project.tier}`}
                        {projectColorBy === 'organising_universe' && project.organising_universe && `Universe: ${project.organising_universe}`}
                        {projectColorBy === 'stage' && project.stage_class && `Stage: ${project.stage_class}`}
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
