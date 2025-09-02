# Interactive Map Functionality

## Overview
The CFMEU platform now includes a comprehensive interactive map page that displays patch boundaries and job sites with advanced visualization and printing capabilities.

## Features

### 🗺️ Interactive Map Display
- **Google Maps Integration**: Uses `@react-google-maps/api` for smooth, responsive mapping
- **GeoJSON Rendering**: Displays patch boundaries from PostGIS geometry data
- **Job Site Markers**: Shows job site locations with interactive markers
- **Color-coded Patches**: Different colors for geographic (red), trade (green), and sub-sector (blue) patches
- **Clear Black Outlines**: All patches have distinct black borders for clarity

### 🎛️ Layer Controls
- **Toggle Job Sites**: Show/hide job site markers
- **Toggle Patch Types**: Individual controls for different patch types
- **Map Style Options**: Switch between standard and satellite views
- **Interactive Legend**: Dynamic legend showing active layers

### 📋 Information Overlays
- **Patch Info Windows**: Click patches to see details, codes, and navigation links
- **Job Site Info Windows**: Click markers to see site details and project information
- **Direct Navigation**: Links to patch pages and project details

### 🖨️ Printable Maps
- **Print Functionality**: Optimized print layouts with landscape orientation
- **Export to PNG**: Download maps as high-resolution images
- **Print-only Elements**: Title and legend appear only in print/export
- **Clean Print Layout**: Hides navigation and controls for clean printed output

## Navigation
The map is accessible via the main navigation menu with a map pin icon. It's available to all user roles.

## Technical Implementation

### Components
- `/src/app/(app)/map/page.tsx` - Main map page with controls
- `/src/components/map/InteractiveMap.tsx` - Core map component
- `/src/styles/print.css` - Print-specific styling

### Data Sources
- **Patches**: Uses `patches_with_geojson` view for geometry data
- **Job Sites**: Queries `job_sites` table with coordinates
- **Real-time Updates**: Powered by React Query for efficient data fetching

### Dependencies
- `@react-google-maps/api` - Google Maps integration
- `html2canvas` - Map export functionality
- Existing Supabase and UI components

## Usage Instructions

### Viewing the Map
1. Navigate to "Map" in the main menu
2. Use the layer controls to toggle different elements
3. Click on patches or job sites for detailed information
4. Switch between standard and satellite views

### Printing Maps
1. Configure desired layers and zoom level
2. Click the "Print" button in the header
3. Use browser print dialog (landscape recommended)
4. Or click "Export" to download as PNG image

### Navigation
- Click patch info windows to navigate to patch details
- Click job site info windows to view project or patch pages
- Use standard Google Maps controls for zoom and pan

## Configuration

### Environment Variables
Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with:
- Maps JavaScript API enabled
- Geometry library access

### Database Requirements
- `patches` table with PostGIS geometry
- `patches_with_geojson` view for GeoJSON conversion
- `job_sites` table with latitude/longitude coordinates

## Future Enhancements
- Clustering for dense job site areas
- Advanced filtering and search
- Measurement tools
- Custom map styles
- Batch export functionality
- Mobile-optimized controls
