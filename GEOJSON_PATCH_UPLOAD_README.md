# Enhanced GeoJSON Patch Upload with Fuzzy Matching

## Overview

The GeoJSON patch upload functionality has been enhanced to include fuzzy logic matching and user confirmation workflows. This allows administrators to upload geographic patch boundaries with intelligent matching to existing patches, reducing duplicate creation and improving data quality.

## New Features

### 1. Fuzzy Logic Matching
- **Automatic Detection**: The system automatically detects potential matches between uploaded patch names and existing patches
- **Similarity Scoring**: Uses Levenshtein distance algorithm to calculate string similarity
- **Confidence Levels**: Categorizes matches as:
  - **Exact** (100% match) - Automatically confirmed
  - **High** (95%+ similarity) - Suggested for manual review
  - **Medium** (85%+ similarity) - Suggested for manual review
  - **Low** (60%+ similarity) - Available for manual selection

### 2. User Confirmation Workflow
- **Manual Review Step**: Features with potential matches are presented for user confirmation
- **Multiple Options**: Users can choose from suggested matches or create new patches
- **Visual Indicators**: Clear status badges and confidence scores for each feature

### 3. Enhanced Database Support
- **PostGIS Geometry**: Full support for geographic boundaries
- **Patch Codes**: Unique identifier system for patches
- **Audit Trail**: Tracks creation and updates with user attribution

## Workflow

### Step 1: File Upload
1. Select GeoJSON file (.geojson or .json)
2. File is parsed and validated
3. Features are extracted and analyzed

### Step 2: Fuzzy Matching
1. System compares each uploaded patch name against existing patches
2. Calculates similarity scores using fuzzy logic
3. Categorizes matches by confidence level

### Step 3: Manual Review (if needed)
1. Features requiring confirmation are presented in a dedicated dialog
2. Users can:
   - Select from suggested matches
   - Create new patches for unmatched features
   - Review confidence scores and patch details

### Step 4: Import
1. All confirmed matches are processed
2. New patches are created with geometry
3. Existing patches are updated with new boundaries
4. Results are reported with success/error counts

## File Format Requirements

### Required Properties
- `fid`: Feature identifier (number)
- `patch_name`: Name of the patch (string)

### Optional Properties
- `coordinator`: Coordinator name (string)
- `patch_id`: Legacy patch identifier (string)

### Geometry Requirements
- **Polygon**: Single polygon boundary
- **MultiPolygon**: Multiple polygon boundaries
- **Coordinate System**: WGS84 (EPSG:4326)

### Example GeoJSON Structure
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "fid": 1,
        "patch_name": "Sydney CBD",
        "coordinator": "John Smith"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[151.2, -33.8], [151.3, -33.8], [151.3, -33.9], [151.2, -33.9], [151.2, -33.8]]]
      }
    }
  ]
}
```

## Configuration

### Similarity Thresholds
- **Exact Match**: 100% similarity
- **High Confidence**: 95%+ similarity
- **Medium Confidence**: 85%+ similarity
- **Low Confidence**: 60%+ similarity
- **Minimum Threshold**: 60% (configurable in `patchMatchingUtils.ts`)

### Database Functions
The system includes several database functions for patch management:
- `update_patch_geometry()`: Updates existing patch boundaries
- `create_patch_with_geometry()`: Creates new patches with geometry
- `find_patch_for_coordinates()`: Finds patches containing specific coordinates

## Technical Implementation

### Components
- **GeoJSONPatchUpload**: Main upload component with workflow management
- **PatchMatchingDialog**: Manual confirmation dialog for fuzzy matches
- **patchMatchingUtils**: Utility functions for fuzzy matching and geometry conversion

### Dependencies
- **PostGIS**: For geographic data handling
- **React Query**: For data fetching and caching
- **Lucide React**: For UI icons
- **Tailwind CSS**: For styling

### Database Schema
The patches table includes:
- `id`: Primary key (UUID)
- `name`: Patch name
- `code`: Unique patch code
- `type`: Patch type (geo/trade)
- `geom`: PostGIS geometry column
- `status`: Patch status
- `created_by`: Creator user ID
- `updated_by`: Last updater user ID
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

## Usage Examples

### Basic Upload
1. Navigate to Administration > Patches
2. Click "Upload GeoJSON"
3. Select your GeoJSON file
4. Review automatic matches
5. Confirm manual matches if needed
6. Complete import

### Batch Processing
The system can handle large numbers of features efficiently:
- Automatic processing of exact matches
- Batch review of potential matches
- Bulk import with detailed reporting

## Error Handling

### Validation Errors
- Invalid GeoJSON format
- Missing required properties
- Unsupported geometry types
- Coordinate system issues

### Import Errors
- Database constraint violations
- Geometry processing failures
- Permission issues
- Network timeouts

### Recovery
- Failed imports are reported with details
- Partial success is supported
- Users can retry failed operations

## Performance Considerations

### Large Files
- Features are processed in batches
- Progress indicators for long operations
- Memory-efficient parsing

### Database Optimization
- Spatial indexes on geometry columns
- Efficient similarity calculations
- Batch database operations

## Future Enhancements

### Planned Features
- **KML Support**: Import from KML files
- **Batch Operations**: Process multiple files
- **Advanced Matching**: Machine learning-based matching
- **Conflict Resolution**: Handle overlapping boundaries
- **Export Functionality**: Export patches to various formats

### Integration Opportunities
- **GIS Systems**: Connect with external mapping tools
- **Data Validation**: Automated boundary validation
- **Workflow Automation**: Integration with approval processes

## Troubleshooting

### Common Issues
1. **No matches found**: Check patch name spelling and existing patch names
2. **Geometry errors**: Verify coordinate system and polygon validity
3. **Import failures**: Check database permissions and constraints
4. **Performance issues**: Consider file size and database optimization

### Debug Information
- Console logs for detailed error information
- Database query logging for performance analysis
- User feedback collection for workflow improvements

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.
