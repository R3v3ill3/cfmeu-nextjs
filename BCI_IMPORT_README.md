# BCI Project Import System

## Overview

The BCI Project Import System is a specialized data import solution designed to handle construction project data from BCI (Building Construction Information) CSV files. This system intelligently processes complex CSV data with multiple companies per project and automatically classifies them based on their roles and trade types.

## Key Features

### 🏗️ **Smart Company Classification**
- Automatically identifies and filters out non-construction companies (consultants, engineers, etc.)
- Classifies companies as: `builder`, `head_contractor`, or `subcontractor`
- Infers trade types from company names (e.g., "Melrose Cranes & Rigging" → `tower_crane`)

### 🔄 **Intelligent Employer Matching**
- Exact name matching for existing employers
- Fuzzy matching for similar company names
- Automatic creation of new employers when no matches found
- User confirmation for employer matches

### 📊 **Comprehensive Data Processing**
- Handles multiple date formats (DD/MM/YYYY, "August 2019", "Quarter 1, 2026")
- Processes project metadata (stage, status, funding, etc.)
- Creates job sites and project relationships
- Maintains data integrity with duplicate prevention

### 🎯 **Existing Database Integration**
- Uses existing `projects`, `employers`, `job_sites`, and `project_contractor_trades` tables
- No new database schema required
- Leverages existing trade type taxonomy

## Architecture

### Components

1. **`BCICsvParser.tsx`** - Handles CSV file upload and validation
2. **`BCIProjectImport.tsx`** - Main import logic and UI flow
3. **`bciTradeTypeInference.ts`** - Utility for trade type classification
4. **Updated Upload Page** - Integration with existing upload system

### Data Flow

```
CSV Upload → Validation → Company Classification → Employer Matching → Database Import
     ↓              ↓              ↓                    ↓              ↓
BCICsvParser → Data Preview → Role Assignment → Match/Create → Insert Records
```

## CSV Format Requirements

### Required Columns (32 total)
The CSV must contain these columns in the exact order:

1. `Project ID` - Unique identifier for the project
2. `Project Type` - Type of construction project
3. `Project Name` - Name of the project
4. `Project Stage` - Current stage (e.g., "Construction")
5. `Project Status` - Current status (e.g., "Construction Commenced")
6. `Local Value` - Project value in local currency
7. `Development Type` - Type of development
8. `Floor Area (square meters)` - Floor area measurement
9. `Site Area (hectares)` - Site area measurement
10. `Storeys` - Number of storeys
11. `Last Update` - Last update date
12. `Construction Start Date (Original format)` - Start date in various formats
13. `Construction End Date (Original format)` - End date in various formats
14. `Project Address` - Street address
15. `Project Town / Suburb` - Town or suburb
16. `Project Province / State` - State or province
17. `Post Code` - Postal code
18. `Project Country` - Country
19. `Role on Project` - Company's role (e.g., "Contractor", "Design Engineer")
20. `Company Name` - Company name
21. `Company Street Name` - Company street address
22. `Company Town / Suburb` - Company town
23. `Company State / Province` - Company state
24. `Company Post Code` - Company postal code
25. `Company Country` - Company country
26. `Company Phone` - Company phone number
27. `Company Email` - Company email
28. `Contact First Name` - Contact person's first name
29. `Contact Surname` - Contact person's surname
30. `Contact Position` - Contact person's position
31. `Contact Landline` - Contact landline
32. `Contact Email` - Contact email
33. `Contact Remark` - Additional contact notes

### Data Structure
- Each project can have multiple rows (one per company)
- Project ID must be unique across all rows
- Company information is required for each row

## Company Classification Logic

### Non-Construction Companies (Filtered Out)
The system automatically identifies and skips companies with these roles:
- Design engineers
- Environmental consultants
- Acoustic consultants
- Fire engineers
- Planning consultants
- Assessment companies

### Construction Company Classification

#### Builder
- Role contains: "contractor", "builder", "principal contractor"
- Updates `projects.builder_id`

#### Head Contractor
- Role contains: "head contractor", "main contractor"
- Added to `project_employer_roles` with role "head_contractor"

#### Subcontractor
- All other construction companies
- Added to `project_contractor_trades` with inferred trade type

### Trade Type Inference

The system uses intelligent keyword matching to infer trade types:

| Company Name Keywords | Inferred Trade Type |
|----------------------|---------------------|
| "crane", "rigging" | `tower_crane` or `crane_and_rigging` |
| "electrical", "electric" | `electrical` |
| "plumbing", "plumber" | `plumbing` |
| "concrete", "formwork" | `concrete` |
| "steel", "structural" | `structural_steel` |
| "roof", "roofing" | `roofing` |
| "scaffold" | `scaffolding` |
| "paint", "painting" | `painting` |
| "carpent", "joinery" | `carpentry` |
| "floor", "tiling" | `flooring` or `tiling` |
| "window", "glaz" | `windows` |

## Database Integration

### Tables Used
- **`projects`** - Main project information
- **`employers`** - Company master data
- **`job_sites`** - Project locations
- **`project_employer_roles`** - Head contractor relationships
- **`project_contractor_trades`** - Subcontractor relationships

### New Fields Added
The system uses existing fields that were already added to the `projects` table:
- `bci_project_id` - External BCI project identifier
- `project_stage` - Project stage information
- `project_status` - Project status information
- `last_update_date` - Last update timestamp

## Usage

### 1. Access the Import System
Navigate to the Upload page and select the "BCI Projects" tab.

### 2. Upload CSV File
- Click "Choose File" to select your BCI CSV
- The system validates the file format and headers
- Download the template if needed

### 3. Review Data Preview
- See how your CSV data will be processed
- Review company classifications and trade type inferences
- Verify project grouping

### 4. Start Import
- Click "Start Import" to begin processing
- The system matches companies to existing employers
- Creates new employers as needed
- Imports projects and relationships

### 5. Review Results
- See successful imports and any errors
- Download results or import another file

## Error Handling

### Validation Errors
- Missing required columns
- Empty required fields
- Invalid data formats

### Import Errors
- Duplicate BCI project IDs
- Database constraint violations
- Network or authentication issues

### Company Matching Issues
- No exact matches found
- Multiple potential matches
- Company creation failures

## Configuration

### Environment Variables
Ensure these are set in your `.env` file:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Trade Type Customization
Edit `src/utils/bciTradeTypeInference.ts` to:
- Add new trade types
- Modify keyword matching rules
- Update trade type categories

## Performance Considerations

### Large Files
- Process files in chunks for very large CSVs
- Consider background processing for >1000 rows
- Monitor database performance during imports

### Memory Usage
- CSV parsing is done client-side
- Large files may impact browser performance
- Consider server-side processing for enterprise use

## Security

### Data Validation
- All CSV data is sanitized and validated
- SQL injection protection via Supabase client
- Input length and format restrictions

### Access Control
- Uses existing application authentication
- Respects user permissions and RLS policies
- Audit trail via database timestamps

## Troubleshooting

### Common Issues

#### CSV Not Parsing
- Check column headers match exactly
- Ensure CSV is properly formatted (no extra commas)
- Verify file encoding (UTF-8 recommended)

#### Company Matching Fails
- Check employer names in database
- Verify company name spelling
- Review fuzzy matching logic

#### Import Errors
- Check database constraints
- Verify user permissions
- Review error logs

### Debug Mode
Enable console logging to see detailed processing information:
```typescript
// In BCIProjectImport.tsx
console.log('Processing company:', company);
console.log('Match result:', matchResult);
```

## Future Enhancements

### Planned Features
- Batch processing for multiple files
- Advanced company matching algorithms
- Custom trade type mapping
- Import scheduling and automation
- Data validation rules configuration

### Integration Opportunities
- API endpoints for external systems
- Webhook notifications
- Data export capabilities
- Reporting and analytics

## Support

### Documentation
- This README
- Code comments and JSDoc
- Database schema documentation

### Development
- TypeScript interfaces for type safety
- Comprehensive error handling
- Unit test coverage
- Code review guidelines

---

**Note**: This system is designed to work with the existing CFMEU application architecture and database schema. Any modifications should be tested thoroughly in a development environment before deployment to production.
