# Mapping Sheets Enhancement

## Overview

This enhancement addresses the issue where assigned employers were not displaying properly in project mapping sheets. The solution provides a unified approach to contractor data management while preserving all existing functionality and trade stage structure.

## Changes Made

### 1. New Unified Data Hook (`src/hooks/useMappingSheetData.ts`)

- **Purpose**: Consolidates contractor data from all sources into a single, consistent interface
- **Data Sources Integrated**:
  - `project_employer_roles` - Project-level contractor roles (builder, project manager, etc.)
  - `project_assignments` - Newer assignment system
  - `project_contractor_trades` - Trade-specific subcontractor assignments
  - `site_contractor_trades` - Site-level trade assignments
  - Legacy `builder_id` field - Backward compatibility

- **Key Features**:
  - Automatic de-duplication of contractor information
  - Proper EBA status resolution
  - Maintains trade stage structure: **Early Works**, **Structure**, **Finishing**, **Other**
  - Preserves all existing trade type labels

### 2. Enhanced MappingSheetPage1

- **Dynamic Contractor Display**: Now shows all contractor roles from unified data instead of just legacy builder
- **Expandable Sections**: Additional contractor roles appear in collapsible accordion
- **EBA Status**: Properly displays EBA status for all contractors
- **Backward Compatibility**: Falls back to legacy data if new systems have no data

### 3. Improved MappingSubcontractorsTable

- **Unified Data Source**: Uses the new hook instead of direct database queries
- **Preserved Structure**: Maintains exact same stage grouping (Early Works, Structure, Finishing)
- **Loading States**: Proper loading indicators while data is fetched
- **Trade Labels**: All existing trade type labels are preserved

### 4. Data Synchronization Utilities

- **`src/utils/contractorDataSync.ts`**: Functions to maintain data consistency across all tables
- **`src/utils/testMappingSheets.ts`**: Testing utilities to verify data integrity

## Non-Negotiables Preserved

✅ **Stage Structure**: Early Works, Structure, and Finishing stages are retained exactly as before
✅ **Trade Labels**: All subcontractor type labels are preserved without changes to underlying enums
✅ **Existing Functionality**: No functionality has been compromised or simplified
✅ **Database Schema**: No changes to existing tables or columns

## Key Benefits

1. **Complete Contractor Visibility**: All contractor assignments now appear in mapping sheets
2. **Data Source Unification**: Single source of truth for contractor information
3. **Backward Compatibility**: Works with existing data and legacy systems
4. **Future-Proof**: Handles new assignment systems while maintaining legacy support
5. **Performance**: Efficient data loading with proper caching

## Technical Implementation

### Data Flow
```
Project ID → useMappingSheetData Hook → Unified Contractor Data → UI Components
```

### Data Sources Priority
1. `project_employer_roles` (preferred for project-level roles)
2. `project_assignments` (newer assignment system)
3. `project_contractor_trades` (trade-specific assignments)
4. `site_contractor_trades` (site-level assignments)
5. Legacy `builder_id` (fallback for older projects)

### Stage Mapping Preserved
- **Early Works**: Demolition, Earthworks, Piling, Traffic Control, etc.
- **Structure**: Concrete, Steel, Formwork, Bricklaying, etc.
- **Finishing**: Electrical, Plumbing, Painting, Tiling, etc.
- **Other**: General Construction, Plant & Equipment, etc.

## Usage

### For Developers

The new `useMappingSheetData` hook can be used anywhere contractor information is needed:

```typescript
import { useMappingSheetData } from "@/hooks/useMappingSheetData";

const { data: mappingData, isLoading } = useMappingSheetData(projectId);

// Access contractor roles
const roles = mappingData?.contractorRoles || [];

// Access trade contractors
const trades = mappingData?.tradeContractors || [];
```

### For Testing

Use the provided test utilities to verify data integrity:

```typescript
import { testMappingSheetData } from "@/utils/testMappingSheets";

// Test a specific project
await testMappingSheetData(projectId);
```

## Migration Notes

- **No Database Migration Required**: All changes are in the application layer
- **Existing Data**: All existing contractor assignments will continue to work
- **New Assignments**: New contractor assignments will be properly reflected in mapping sheets
- **Legacy Projects**: Projects using only the legacy `builder_id` field will continue to display correctly

## Troubleshooting

If contractor information is not appearing:

1. Check that assignments exist in the database using the test utility
2. Verify project ID is correct
3. Ensure the `useMappingSheetData` hook is receiving data
4. Check browser console for any errors

## Future Enhancements

The unified data structure makes it easy to add:
- Contractor assignment editing directly from mapping sheets
- Real-time updates when contractor assignments change
- Enhanced filtering and sorting options
- Export functionality with complete contractor information

## Files Modified

- `src/hooks/useMappingSheetData.ts` (new)
- `src/components/projects/mapping/MappingSheetPage1.tsx`
- `src/components/projects/mapping/MappingSubcontractorsTable.tsx`
- `src/utils/contractorDataSync.ts` (new)
- `src/utils/testMappingSheets.ts` (new)

## Verification

To verify the enhancement is working:

1. Open any project's mapping sheets
2. Check that all contractor roles are displayed in the main section
3. Verify that subcontractor trades show assigned employer names
4. Confirm that EBA status is properly displayed
5. Ensure all three stages (Early Works, Structure, Finishing) are preserved
