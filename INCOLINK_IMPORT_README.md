# Incolink Import Guide

## Overview
The Incolink Import feature allows you to upload Incolink employer data and automatically match it to existing employers in the system using fuzzy name matching. This feature is designed to handle cases where there's no common key between Incolink and our system, relying on employer name matching with manual override options.

## Features
- **Fuzzy Name Matching**: Automatically matches Incolink employers to existing system employers using advanced fuzzy matching algorithms
- **Confidence Scoring**: Shows match confidence levels (Exact, High, Medium, Low) with percentage scores
- **Manual Override**: Ability to manually search and select employers for uncertain matches
- **Duplicate Detection**: Identifies potential duplicate employers and offers bulk merge functionality
- **Bulk Operations**: Auto-accept exact matches and process multiple records efficiently
- **Import Validation**: Prevents duplicate Incolink IDs and validates data before import

## CSV Format Requirements

### Required Fields
- `employer_name` (or `company name`, `name`) - The employer's name for matching
- `incolink_id` - Unique Incolink identifier

### Optional Fields
- `contact_name` - Contact person name
- `contact_phone` - Contact phone number
- `contact_email` - Contact email address
- `abn` - Australian Business Number
- `address` - Business address
- `notes` - Additional notes or comments

### Example CSV Format
```csv
company name,incolink_id,contact_name,contact_phone,contact_email,abn
"ABC Construction Pty Ltd",7125289,"John Smith","0412345678","john@abcconstruction.com.au","12345678901"
"XYZ Builders",7125290,"Jane Doe","0398765432","jane@xyzbuilders.com","98765432109"
```

## Step-by-Step Usage

### 1. Access the Import Feature
1. Navigate to **Admin > Data Upload**
2. Click on **Import Incolink Data** card

### 2. Upload CSV File
1. Select your Incolink CSV file
2. The system will parse and validate the data
3. Review the import settings:
   - **Allow creating new employers**: Enable to create new employer records for unmatched entries
   - **Update existing records**: Enable to add Incolink IDs to matched employers
   - **Require manual confirmation**: Enable to review all fuzzy matches before import

### 3. Review Matching Results
After clicking "Start Matching", you'll see:
- **Statistics Cards**: Summary of exact matches, fuzzy matches, no matches, and overall match rate
- **Detailed Results Table**: Each record with its match status and confidence score

#### Match Types:
- **Exact Match (>95%)**: Employer names match perfectly or near-perfectly
- **Fuzzy Match (70-95%)**: Similar employer names that likely refer to the same entity
- **No Match (<70%)**: No suitable employer found in the system

### 4. Resolve Matches
For each record, you can:
- **Use existing**: Link to the matched employer (default for exact matches)
- **Create new**: Create a new employer record
- **Skip**: Skip this record
- **Manual search**: Click the search icon to manually find and select an employer

### 5. Handle Duplicates
If multiple existing employers match a single Incolink record:
1. Expand the row to see all potential matches
2. Select the primary employer to use
3. Check "These appear to be duplicates" to merge them after import
4. The system will consolidate duplicate employers into a single record

### 6. Import Data
1. Review your selections
2. Use "Auto-accept Exact Matches" to quickly confirm all high-confidence matches
3. Click "Import Selected" to process the records
4. Monitor the progress bar during import
5. Review the import summary for any errors

## Matching Algorithm Details

The fuzzy matching algorithm uses multiple techniques:

1. **Name Normalization**: Removes common suffixes (Pty Ltd, Limited, etc.) and standardizes formatting
2. **Levenshtein Distance**: Calculates character-level similarity between names
3. **Token-based Matching**: Compares individual words in company names
4. **Substring Matching**: Checks if one name contains the other

### Confidence Scoring
- **Exact (95-100%)**: Names are identical after normalization
- **High (85-95%)**: Very similar names with minor differences
- **Medium (70-85%)**: Moderate similarity, manual review recommended
- **Low (<70%)**: Weak similarity, likely different employers

## Troubleshooting

### Common Issues

**Issue: "Employer already has a different Incolink ID"**
- **Cause**: The matched employer already has an Incolink ID that differs from the import
- **Solution**: Review the existing data and either skip the record or update if the new ID is correct

**Issue: Poor matching results**
- **Cause**: Significant differences in employer naming conventions
- **Solutions**:
  - Use manual search for important records
  - Consider creating employer aliases for common variations
  - Clean/standardize employer names before import

**Issue: Duplicate employers detected**
- **Cause**: Multiple employer records exist for the same entity
- **Solution**: Use the merge functionality to consolidate before linking Incolink IDs

### Best Practices

1. **Data Preparation**:
   - Clean employer names (remove extra spaces, fix capitalization)
   - Verify Incolink IDs are unique and valid
   - Remove test or dummy data

2. **Import Strategy**:
   - Start with a small test batch to verify matching quality
   - Review fuzzy matches carefully, especially for key employers
   - Use the duplicate merge feature to clean up data

3. **Post-Import**:
   - Download and review the error report if any issues occurred
   - Verify high-value employers were matched correctly
   - Update employer aliases for future imports

## Technical Details

### Database Changes
The import uses the `incolink_id` field in the employers table:
- Type: `text`
- Constraint: `UNIQUE`
- Indexed for performance
- Also includes `incolink_last_matched` date field for tracking

### Security
- Feature restricted to Co-ordinators and Administrators
- All imports are logged with user attribution
- No existing data is deleted, only updated or created

## Support
For assistance with Incolink imports:
1. Check this guide for common issues
2. Review the error messages in the import summary
3. Contact your system administrator for complex matching issues
