# Add Employer - Manual Test Checklist

## Test Environment
- **URL**: http://localhost:3000/employers
- **Dev Server**: Already running on port 3000 ✅

---

## 🖥️ DESKTOP TESTS

### ✅ Test 1: Button Visibility and Placement
**Steps:**
1. Open browser to `http://localhost:3000/employers`
2. Log in if needed
3. Look at the top right of the page header

**Expected Results:**
- [ ] "Add Employer" button is visible in top right corner
- [ ] Button has a Plus (+) icon
- [ ] Button styling matches the design system
- [ ] Button is aligned with the page title "Employers"

---

### ✅ Test 2: Dialog Opens Correctly
**Steps:**
1. Click the "Add Employer" button

**Expected Results:**
- [ ] Dialog opens smoothly
- [ ] Dialog title reads "Add New Employer"
- [ ] Dialog description mentions "Required fields are marked with *"
- [ ] All form fields are visible
- [ ] Form fields are empty/default state
- [ ] "Cancel" and "Create Employer" buttons are visible at bottom

---

### ✅ Test 3: Required Field Validation
**Steps:**
1. Open the Add Employer dialog
2. Click "Create Employer" without filling anything
3. Observe the result

**Expected Results:**
- [ ] Toast notification appears with error message
- [ ] Error message says "Employer name is required"
- [ ] Dialog remains open
- [ ] Form fields are still visible

**Steps (Part 2):**
4. Enter name: "Test Company"
5. Click "Create Employer" (without selecting type)

**Expected Results:**
- [ ] Toast notification appears with error message
- [ ] Error message says "Employer type is required"
- [ ] Dialog remains open

---

### ✅ Test 4: Create Employer (Minimal Data)
**Steps:**
1. Open Add Employer dialog
2. Enter Name: "Quick Test Construction"
3. Select Type: "Small Contractor"
4. Click "Create Employer"

**Expected Results:**
- [ ] Button changes to show "Creating..." with spinner
- [ ] Buttons are disabled during creation
- [ ] Success toast appears: "Quick Test Construction has been created successfully"
- [ ] Dialog closes
- [ ] Employer Detail Modal opens automatically
- [ ] Detail modal shows the newly created employer
- [ ] Employer name "Quick Test Construction" is visible in detail modal
- [ ] Type shows "Small Contractor"
- [ ] Employers list refreshes and shows new employer
- [ ] New employer appears in the list

---

### ✅ Test 5: Create Employer (Full Data)
**Steps:**
1. Click "Add Employer" button again
2. Fill in ALL fields:
   - **Name**: "ABC Premium Builders Pty Ltd"
   - **Type**: "Builder"
   - **ABN**: "12 345 678 901"
   - **Phone**: "03 9123 4567"
   - **Email**: "info@abcbuilders.com.au"
   - **Website**: "https://www.abcbuilders.com.au"
   - **Estimated Worker Count**: "75"
   - **Notes**: "Premium commercial builder specializing in high-rise construction. Main contact: John Smith."
3. Click "Create Employer"

**Expected Results:**
- [ ] Success toast appears
- [ ] Dialog closes
- [ ] Detail modal opens for new employer
- [ ] All entered data is correctly displayed in detail modal:
  - [ ] Name: "ABC Premium Builders Pty Ltd"
  - [ ] Type badge shows "Builder"
  - [ ] ABN: "12 345 678 901"
  - [ ] Phone: "03 9123 4567"
  - [ ] Email: "info@abcbuilders.com.au"
  - [ ] Website link: "https://www.abcbuilders.com.au"
  - [ ] Estimated workers: 75
  - [ ] Notes visible with full text
- [ ] New employer appears in the employers list

---

### ✅ Test 6: Role Tags Selection
**Steps:**
1. Open Add Employer dialog
2. Fill in required fields:
   - Name: "Role Test Company"
   - Type: "Builder"
3. Check the "Builder" role tag checkbox
4. Verify checkbox is checked
5. Click "Create Employer"

**Expected Results:**
- [ ] Checkbox toggles correctly on click
- [ ] Employer created successfully
- [ ] Success toast appears
- [ ] Detail modal opens
- [ ] Role tag is saved (can verify in employer detail if Categories section visible)

**Steps (Part 2):**
6. Close detail modal
7. Create another employer with BOTH role tags checked
8. Click "Create Employer"

**Expected Results:**
- [ ] Both checkboxes can be selected simultaneously
- [ ] Employer created with both role tags
- [ ] Tags persist in database

---

### ✅ Test 7: Trade Capabilities - Key Trades Only
**Steps:**
1. Open Add Employer dialog
2. Fill in:
   - Name: "Scaffolding Specialists"
   - Type: "Small Contractor"
3. Click on "Trade Capabilities" dropdown button

**Expected Results:**
- [ ] Dropdown opens
- [ ] Shows "Common Trades" heading
- [ ] Lists 10 key trades (demolition, piling, concrete, scaffolding, formwork, tower crane, mobile crane, labour hire, earthworks, traffic control)
- [ ] Shows "Show all trades (43 more)" button at bottom
- [ ] Can search trades using search box

**Steps (Part 2):**
4. Select "Scaffolding" from key trades
5. Click outside dropdown to close it

**Expected Results:**
- [ ] Scaffolding appears as badge below dropdown
- [ ] Badge has "×" remove button  
- [ ] Dropdown button text changes to "1 trade selected"

**Steps (Part 3):**
6. Reopen dropdown
7. Select "Formwork" as well
8. Close dropdown
9. Click "Create Employer"

**Expected Results:**
- [ ] Both badges visible (Scaffolding and Formwork)
- [ ] Dropdown shows "2 trades selected"
- [ ] Employer created successfully
- [ ] Detail modal opens showing new employer
- [ ] Trade capabilities visible in employer details

---

### ✅ Test 8: Trade Capabilities - Expand to All Trades
**Steps:**
1. Open Add Employer dialog
2. Fill in basic fields
3. Open Trade Capabilities dropdown
4. Click "Show all trades (43 more)" button

**Expected Results:**
- [ ] Button changes to "Show less trades"
- [ ] Additional "All Trades" section appears below
- [ ] Shows 40+ additional trades (electrical, plumbing, carpentry, painting, etc.)
- [ ] List is scrollable
- [ ] Search box still works across all trades

**Steps (Part 2):**
5. Select "Electrical" from the all trades section
6. Select "Plumbing" as well
7. Click "Show less trades"

**Expected Results:**
- [ ] All trades section collapses
- [ ] Key trades section still visible
- [ ] Selected badges still show Electrical and Plumbing
- [ ] Dropdown shows "2 trades selected"

**Steps (Part 3):**
8. Reopen dropdown

**Expected Results:**
- [ ] Electrical and Plumbing still have checkmarks
- [ ] All trades section is collapsed again
- [ ] Can click "Show all trades" to see them again with checkmarks

---

### ✅ Test 9: Trade Capabilities - Search Functionality
**Steps:**
1. Open Add Employer dialog
2. Open Trade Capabilities dropdown
3. Type "plumb" in search box

**Expected Results:**
- [ ] List filters instantly
- [ ] Shows only "Plumbing" 
- [ ] Checkmark visible if already selected
- [ ] Can select from filtered results
- [ ] Search is case-insensitive

**Steps (Part 2):**
4. Clear search (delete text)
5. Type "cran"

**Expected Results:**
- [ ] Shows: Tower Crane, Mobile Crane, Crane & Rigging
- [ ] All matching trades visible
- [ ] Can select any of them
- [ ] Selected trades appear as badges

**Steps (Part 3):**
6. Type gibberish like "zzzzzz"

**Expected Results:**
- [ ] Shows "No trade found." message
- [ ] No crash or error

---

### ✅ Test 10: Trade Capabilities - Remove Badges
**Steps:**
1. Open Add Employer dialog
2. Fill in basic fields
3. Select 3 trades: Scaffolding, Formwork, Concreting
4. Close dropdown

**Expected Results:**
- [ ] Three badges visible below dropdown
- [ ] Each badge has "×" button on the right
- [ ] Badges wrap to multiple lines if needed

**Steps (Part 2):**
5. Click "×" on "Formwork" badge

**Expected Results:**
- [ ] Formwork badge disappears immediately
- [ ] Other 2 badges (Scaffolding, Concreting) remain
- [ ] Dropdown button updates to "2 trades selected"

**Steps (Part 3):**
6. Reopen dropdown

**Expected Results:**
- [ ] Formwork no longer has checkmark
- [ ] Scaffolding and Concreting still have checkmarks
- [ ] Can add Formwork back by clicking it again

---

### ✅ Test 11: Create Employer with Roles & Trades (Complete)
**Steps:**
1. Open Add Employer dialog
2. Fill in ALL fields including new features:
   - **Name**: "Complete Capabilities Builders"
   - **Type**: "Builder"
   - **Employer Roles**: ☑ Builder, ☑ Head Contractor
   - **Trade Capabilities**: Scaffolding, Formwork, Concreting
   - **ABN**: "98 765 432 109"
   - **Phone**: "03 8888 7777"
   - **Email**: "hello@completebuilders.com"
   - **Website**: "https://completebuilders.com"
   - **Estimated Worker Count**: "120"
   - **Notes**: "Full-service construction company specializing in structural work."
3. Verify all selections are correct
4. Click "Create Employer"

**Expected Results:**
- [ ] Success toast appears
- [ ] Dialog closes smoothly
- [ ] Detail modal opens for new employer
- [ ] ALL data correctly displayed:
  - [ ] Name, Type, ABN, Phone, Email, Website, Worker Count, Notes
  - [ ] Role tags: Builder and Head Contractor visible (if shown in detail)
  - [ ] Trade capabilities: Scaffolding, Formwork, Concreting visible
- [ ] New employer appears in employers list
- [ ] Can search for and find new employer

---

### ✅ Test 12: Cancel Button
**Steps:**
1. Click "Add Employer"
2. Fill in some fields:
   - Name: "Will Be Cancelled"
   - Type: "Individual"
   - Phone: "0400 123 456"
3. Click "Cancel" button
4. Reopen "Add Employer" dialog

**Expected Results:**
- [ ] Dialog closes when Cancel is clicked
- [ ] No employer is created
- [ ] No toast notification appears
- [ ] When reopened, form is completely empty (previous data cleared)
- [ ] All fields reset to default state

---

### ✅ Test 7: Field Types and Formatting
**Steps:**
1. Open Add Employer dialog
2. Test each field:

**Name Field:**
- [ ] Accepts text input
- [ ] Placeholder shows "e.g., ABC Construction Pty Ltd"

**Type Dropdown:**
- [ ] Opens with 5 options
- [ ] Options: Builder, Principal Contractor, Large Contractor, Small Contractor, Individual
- [ ] Can select each option

**ABN Field:**
- [ ] Accepts text/numbers
- [ ] Placeholder shows "e.g., 12 345 678 901"

**Phone Field:**
- [ ] Type shows as "tel"
- [ ] Placeholder shows "e.g., 03 9123 4567"

**Email Field:**
- [ ] Type shows as "email"
- [ ] Placeholder shows "e.g., contact@company.com"

**Website Field:**
- [ ] Type shows as "url"
- [ ] Placeholder shows "e.g., https://example.com"

**Worker Count:**
- [ ] Type shows as "number"
- [ ] Cannot enter negative numbers
- [ ] Placeholder shows "e.g., 50"

**Notes:**
- [ ] Multi-line textarea
- [ ] Accepts long text
- [ ] Shows 3 rows initially

---

### ✅ Test 8: Grid Layout on Desktop
**Steps:**
1. Open Add Employer dialog
2. Observe the form layout

**Expected Results:**
- [ ] Name field spans full width (2 columns)
- [ ] Type field spans full width (2 columns)
- [ ] ABN and Phone are side-by-side (1 column each)
- [ ] Email and Website are side-by-side (1 column each)
- [ ] Worker Count field is single column
- [ ] Notes field spans full width (2 columns)
- [ ] Layout looks organized and balanced

---

### ✅ Test 9: Escape Key Closes Dialog
**Steps:**
1. Open Add Employer dialog
2. Press ESC key on keyboard

**Expected Results:**
- [ ] Dialog closes
- [ ] Same behavior as clicking Cancel
- [ ] No employer created

---

### ✅ Test 10: Click Outside to Close
**Steps:**
1. Open Add Employer dialog
2. Click on the dark overlay outside the dialog

**Expected Results:**
- [ ] Dialog closes
- [ ] No employer created
- [ ] Form resets

---

## 📱 MOBILE TESTS

### ✅ Test 11: Mobile Button Visibility
**Steps:**
1. Resize browser to mobile width (< 768px) OR use mobile device
2. Navigate to `http://localhost:3000/employers`

**Expected Results:**
- [ ] Compact "Add" button visible in top right
- [ ] Button shows Plus (+) icon
- [ ] Button text is just "Add" (not "Add Employer")
- [ ] Button is properly sized for mobile
- [ ] Button doesn't overlap with title

---

### ✅ Test 12: Mobile Dialog Responsiveness
**Steps:**
1. In mobile view, click "Add" button

**Expected Results:**
- [ ] Dialog opens and fits mobile screen
- [ ] Dialog is scrollable if content exceeds screen height
- [ ] All form fields are accessible
- [ ] Fields are stacked vertically (1 column layout)
- [ ] No horizontal scrolling needed
- [ ] Text is readable (not too small)
- [ ] Buttons at bottom are accessible

---

### ✅ Test 13: Mobile Form Submission
**Steps:**
1. In mobile view, open Add Employer dialog
2. Fill in:
   - Name: "Mobile Test Builder"
   - Type: "Large Contractor"
3. Click "Create Employer"

**Expected Results:**
- [ ] Success toast appears at top of screen
- [ ] Dialog closes smoothly
- [ ] Detail modal opens (responsive for mobile)
- [ ] New employer appears in mobile list view
- [ ] Can scroll to see the new employer

---

## 🔧 EDGE CASES

### ✅ Test 14: Special Characters in Name
**Steps:**
1. Open Add Employer dialog
2. Enter Name: "O'Brien & Sons Construction (Pty) Ltd"
3. Select Type: "Builder"
4. Click "Create Employer"

**Expected Results:**
- [ ] Employer created successfully
- [ ] Name stored exactly as entered (with apostrophe, ampersand, parentheses)
- [ ] Displays correctly in list and detail modal

---

### ✅ Test 15: Very Long Text
**Steps:**
1. Open Add Employer dialog
2. Enter a very long name: "The International Premium Construction and Development Company of Australia and New Zealand Proprietary Limited"
3. Enter very long notes (200+ words)
4. Select Type: "Principal Contractor"
5. Click "Create Employer"

**Expected Results:**
- [ ] Long name is accepted
- [ ] Long notes are accepted
- [ ] Data saves successfully
- [ ] Text wraps properly in dialog
- [ ] Text displays properly in detail modal
- [ ] No text overflow issues

---

### ✅ Test 16: Rapid Clicking Prevention
**Steps:**
1. Open Add Employer dialog
2. Fill in required fields
3. Click "Create Employer" multiple times rapidly

**Expected Results:**
- [ ] Button is disabled after first click
- [ ] Shows "Creating..." state
- [ ] Only ONE employer is created (no duplicates)
- [ ] Loading state prevents multiple submissions

---

### ✅ Test 17: Form Reset After Success
**Steps:**
1. Create an employer successfully
2. Close the detail modal that opens
3. Click "Add Employer" again

**Expected Results:**
- [ ] Form is completely empty
- [ ] No data from previous employer
- [ ] All fields reset to default state
- [ ] Ready for new entry

---

### ✅ Test 18: List Refresh Verification
**Steps:**
1. Before opening dialog, note the current employer count
2. Create a new employer
3. Close the detail modal
4. Check the employers list

**Expected Results:**
- [ ] New employer appears immediately (no page refresh needed)
- [ ] Employer count increased by 1
- [ ] New employer is in correct alphabetical position (if sorted by name)
- [ ] Can click on new employer to view details again

---

### ✅ Test 19: Search After Creation
**Steps:**
1. Create employer with name "Unique Test Builder 123"
2. Close detail modal
3. Use search box to search for "Unique Test Builder"

**Expected Results:**
- [ ] New employer appears in search results
- [ ] Search functionality works with newly created employer
- [ ] Can filter and find the new employer

---

### ✅ Test 20: Filter Compatibility
**Steps:**
1. Create employer:
   - Name: "Filter Test Co"
   - Type: "Individual"
   - Estimated Worker Count: 25
2. Apply filters:
   - Set "Contractor type" to "Individual"
   - Toggle "Engaged" filter

**Expected Results:**
- [ ] New employer respects all filters
- [ ] Appears when "Individual" type is selected
- [ ] Behaves correctly with engagement filter
- [ ] Can be filtered out when different type selected

---

## 📊 SUMMARY CHECKLIST

After completing all tests:
- [ ] Desktop button works
- [ ] Mobile button works
- [ ] Dialog opens and closes properly
- [ ] Form validation works
- [ ] Can create employer with minimal data
- [ ] Can create employer with full data
- [ ] Cancel button works
- [ ] Form resets properly
- [ ] List refreshes automatically
- [ ] Detail modal opens after creation
- [ ] Mobile responsive design works
- [ ] All field types work correctly
- [ ] Edge cases handled properly
- [ ] No console errors observed
- [ ] Performance is acceptable

---

## 🐛 ISSUES FOUND

Document any issues here:

| Test # | Issue Description | Severity | Screenshot/Details |
|--------|------------------|----------|-------------------|
|        |                  |          |                   |
|        |                  |          |                   |

---

## ✨ NOTES

Additional observations or feedback:

```
[Your notes here]
```

---

**Tested by:** _________________  
**Date:** _________________  
**Browser:** _________________  
**Screen Size:** _________________

