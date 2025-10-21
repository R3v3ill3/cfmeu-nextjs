# EBA Trade Import - Quick Start Guide

## 🚀 Getting Started

### Prerequisites

1. **Admin Access**: Ensure you have admin role in the system
2. **API Key**: Verify `ANTHROPIC_API_KEY` is configured in environment
3. **PDFs Ready**: Have your EBA trade PDFs available

## 📋 Step-by-Step Guide

### Step 1: Navigate to EBA Trade Import

1. Log in as admin user
2. Go to **Admin** → **Employer Management**
3. Click the **EBA Trade Import** card

### Step 2: Upload PDFs

1. **Drag & drop** PDF files onto the upload zone, or click to browse
2. Multiple files can be uploaded at once
3. For each file:
   - Trade type is **auto-detected** from filename
   - You can **manually override** using the dropdown if needed

**Example filenames**:
- `Bricklaying as of 1.10.25.pdf` → Auto-detects as "Bricklaying"
- `Civil as of 1.10.25.pdf` → Auto-detects as "Civil"
- `Concrete as of 1.10.25.pdf` → Auto-detects as "Concrete"

### Step 3: Process Files

1. Review the file list to ensure trade types are correct
2. Click **"Process All Files"**
3. Watch the progress:
   - Each file shows status: Parsing → Saving → Complete
   - Employer count updates per file
   - Total cost tracked in real-time

**What's Happening**:
- PDFs are sent to Claude AI for parsing
- Employer records extracted (name, address, phone, sector code)
- Data stored in pending_employers table for review
- Trade types automatically tagged

### Step 4: Review Pending Employers

1. After processing completes, you'll see: "X employers added to pending import queue"
2. Switch to **"Import Pending Employers"** tab
3. You'll see your parsed employers in the list with:
   - Company names
   - Source: "eba_trade_pdf"
   - Trade type in csv_role column
   - Batch identifier for tracking

### Step 5: Import Employers

1. The pending employers workflow provides:
   - **Duplicate detection**: Automatically finds similar employers
   - **FWC search**: Search Fair Work Commission for EBAs
   - **Alias management**: Handle alternate names
   - **Merge options**: Consolidate duplicates

2. Select employers you want to import
3. Click **"Import Selected"**
4. Employers are created with **trade types automatically assigned**!

## 🎯 Expected Results

### For New Employers

- Employer record created in `employers` table
- Trade capability created in `contractor_trade_capabilities` table
- Trade type set as `is_primary = true`
- Source notes: "Imported from BCI data. Original CSV role: [trade_type]"

### For Duplicate Employers

- Duplicate detected via name matching
- Option to:
  - **Merge**: Combine with existing employer
  - **Skip**: Don't import this record
  - **Create New**: Import as separate employer

## 📊 What Gets Imported

### Employer Data

From the PDF, we extract:
- ✅ Company name
- ✅ Street address
- ✅ Suburb
- ✅ State
- ✅ Postcode
- ✅ Phone number(s)
- ✅ Sector code (e.g., "23YBR")
- ✅ Trade classification (from filename)

### Trade Assignment

Each employer is automatically tagged with:
- **Trade Type**: Based on PDF category
- **Role**: Subcontractor
- **Primary**: Yes
- **Source**: EBA Trade PDF import

## 💰 Cost Tracking

The system shows real-time costs:
- Per-file cost: ~$0.05-0.15
- Total batch cost displayed at end
- Costs are for AI parsing only (one-time per PDF)

**Typical costs**:
- Single PDF: $0.08
- 17 PDFs (full set): ~$2.50

## ⚠️ Common Scenarios

### Scenario 1: Employer Already Exists

**What happens**:
1. Duplicate detection flags the match
2. You see similarity score and matched employer
3. Options:
   - **Merge**: Consolidate data into existing record
   - **Skip**: Don't import this duplicate
   - **Review**: Check details before deciding

**Recommendation**: Merge duplicates to maintain clean data

### Scenario 2: Unclear Trade Type

**What happens**:
1. Filename doesn't match expected pattern
2. Trade type dropdown shows blank or "unknown"

**Solution**:
1. Manually select correct trade from dropdown before processing
2. Your selection overrides auto-detection

### Scenario 3: Parsing Errors

**What happens**:
1. File status shows "Error"
2. Error message displayed below file name

**Common causes**:
- PDF is encrypted or protected
- PDF has unusual structure
- Network timeout

**Solution**:
- Check PDF can be opened normally
- Try uploading again
- Check browser console for details

## 🔍 Verification

### Check Parsed Data

1. Go to **Import Pending Employers** tab
2. Filter by source containing: "eba_trade_pdf"
3. Review employer names and trade types
4. Verify addresses look correct

### Check Imported Employers

1. Go to **Employers** page
2. Search for imported company names
3. View employer details:
   - Check trade capabilities section
   - Verify primary trade matches PDF category
   - Review addresses and contact info

### Database Verification (Optional)

```sql
-- Check pending EBA employers
SELECT company_name, csv_role, source
FROM pending_employers
WHERE source LIKE 'eba_trade_pdf:%'
ORDER BY created_at DESC;

-- Check imported employers with trades
SELECT e.name, ctc.trade_type, ctc.is_primary
FROM employers e
JOIN contractor_trade_capabilities ctc ON ctc.employer_id = e.id
WHERE e.created_at > NOW() - INTERVAL '1 hour';
```

## 📝 Tips & Best Practices

### Before Processing

1. **Check filenames**: Ensure they follow "TradeName as of DD.MM.YY.pdf" format
2. **Start small**: Test with 1-2 PDFs before processing all 17
3. **Verify admin access**: You need admin role for this feature

### During Processing

1. **Don't close browser**: Wait for all files to complete
2. **Monitor progress**: Watch for any error messages
3. **Note costs**: Keep track of total API usage

### After Processing

1. **Review before importing**: Check parsed data looks correct
2. **Handle duplicates**: Merge or skip as appropriate
3. **Verify trades**: Confirm trade types assigned correctly
4. **Document batch**: Note which PDFs were processed and when

## 🆘 Troubleshooting

### "AI service not configured"

Add to your `.env.local`:
```bash
ANTHROPIC_API_KEY=sk-ant-api-xxxxx
```

### "Unauthorized" or "Admin access required"

Contact your system administrator to grant admin role.

### Parsing returns 0 employers

1. Check if PDF opens normally
2. Verify PDF contains employer list (not blank pages)
3. Check browser console for errors
4. Try different PDF

### Trade not assigned after import

1. Verify `our_role` was set to 'subcontractor' in pending record
2. Check `inferred_trade_type` field is populated
3. Review import logs for trade capability creation errors

## 📞 Support

If you encounter issues:

1. **Check logs**: Browser console shows detailed progress
2. **Review docs**: See `EBA_TRADE_IMPORT_IMPLEMENTATION.md`
3. **Test incrementally**: Start with 1 PDF, then expand
4. **Verify prerequisites**: Admin access + API key configured

## ✅ Success Checklist

- [ ] Uploaded PDFs successfully
- [ ] Trade types auto-detected correctly
- [ ] All files processed without errors
- [ ] Employers appear in pending queue
- [ ] Duplicates detected and handled
- [ ] Employers imported successfully
- [ ] Trade capabilities assigned
- [ ] Cost tracking looks reasonable

---

**Ready to start?** Navigate to Admin → Employer Management → EBA Trade Import! 🚀

