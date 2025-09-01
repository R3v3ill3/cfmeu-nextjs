# Map Features for GeoJSON Patches

This document describes the new map functionality added to display GeoJSON patches uploaded through the administration system.

## Features Added

### 1. Administration Patch Maps
- **Location**: Administration → Patches tab
- **Button**: "View Patch Maps" button (with globe icon)
- **Functionality**: 
  - Displays all patches with geometry on an interactive Google Map
  - Color-coded by patch type (geo=red, trade=green, sub-sector=blue, other=orange, inactive=gray)
  - Interactive sidebar with patch list and visibility controls
  - Click on patches to see details and navigate to patch pages
  - Zoom controls and responsive design

### 2. Individual Patch Maps
- **Location**: Individual patch pages (when viewing a specific patch)
- **Display**: Shows the specific patch boundary on a map
- **Features**: 
  - Displays single patch geometry
  - Shows patch status and type badges
  - Link to administration for management

### 3. Google Maps Integration
- **Component**: `src/components/ui/GoogleMap.tsx`
- **Features**:
  - Automatic Google Maps script loading
  - PostGIS geometry parsing (SRID=4326 format)
  - Interactive polygon overlays
  - Zoom controls
  - Error handling for missing API keys

## Setup Requirements

### Environment Variables
Ensure you have the Google Maps API key configured:
```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### Google Maps API
The API key needs access to:
- Maps JavaScript API
- Geometry library (for polygon operations)

## Usage

### Viewing All Patches
1. Navigate to Administration → Patches
2. Click "View Patch Maps" button
3. Use the sidebar to:
   - Show/hide specific patches
   - View patch details
   - Navigate to individual patch pages

### Viewing Individual Patches
1. Navigate to a specific patch page (e.g., `/patch?patch=123`)
2. The patch map will automatically display above the sites table
3. Click the external link icon to go to administration

## Technical Details

### Components Created
- `GoogleMap.tsx` - Base Google Maps component
- `PatchMapViewer.tsx` - Administration patch map viewer
- `PatchMap.tsx` - Individual patch map display

### Data Flow
1. GeoJSON upload → Database storage (PostGIS geometry)
2. Map components query patches with geometry
3. PostGIS geometry parsed and converted to Google Maps polygons
4. Interactive display with click handlers and styling

### Geometry Format
The system expects PostGIS geometry in the format:
```
SRID=4326;POLYGON((lng1 lat1, lng2 lat2, lng3 lat3, lng1 lat1))
```

## Troubleshooting

### Common Issues
1. **Map not loading**: Check Google Maps API key configuration
2. **No patches visible**: Ensure patches have geometry data
3. **Geometry errors**: Verify PostGIS format in database

### Debug Information
- Check browser console for Google Maps loading errors
- Verify environment variable is set correctly
- Ensure patches table has valid geometry data

## Future Enhancements
- Add clustering for many patches
- Implement search and filtering on maps
- Add measurement tools
- Support for different map styles
- Export map views as images
