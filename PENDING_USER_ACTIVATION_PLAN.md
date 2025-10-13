# Pending User Activation System - Implementation Plan

## Overview
Generic system to transition pending_users (with @testing.org emails) to activated users (with @cfmeu.org emails), migrating all hierarchies, patch assignments, and relationships.

## What We Learned from Chris Pappas Migration

### Key Issues Addressed
1. ✅ Table name corrections: `role_hierarchy` not `lead_organiser_links`
2. ✅ Invalid patch IDs cause foreign key violations during trigger execution
3. ✅ Need to clean up invalid patch references before creating relationships
4. ✅ Role must be transferred from pending_user to profiles
5. ✅ Multiple relationship tables need to be updated:
   - `draft_lead_organiser_links` (where user is draft lead)
   - `lead_draft_organiser_links` (where user is pending organiser under live lead)
   - `role_hierarchy` (live lead ↔ live organiser relationships)
6. ✅ Patch assignments go to different tables based on role:
   - `organiser_patch_assignments` for organisers
   - `lead_organiser_patch_assignments` for lead_organisers

## Implementation Components

### 1. Database Function: `activate_pending_user()`

**Location**: `supabase/migrations/20251010050000_pending_user_activation_function.sql`

**Function Signature**:
```sql
CREATE OR REPLACE FUNCTION activate_pending_user(
  p_pending_email text,
  p_activated_email text
) RETURNS jsonb
```

**Parameters**:
- `p_pending_email`: Email of pending_user (e.g., `cpappas@testing.org`)
- `p_activated_email`: Email of activated user (e.g., `cpappas@cfmeu.org`)

**Returns**: JSON with migration summary
```json
{
  "success": true,
  "pending_user_id": "uuid",
  "activated_user_id": "uuid",
  "role": "lead_organiser",
  "hierarchy_migrated": {
    "role_hierarchy_created": 5,
    "lead_draft_links_created": 3,
    "draft_links_updated": 2,
    "links_deactivated": 10
  },
  "patches_migrated": 4,
  "invalid_patches_cleaned": 2
}
```

**Error Handling**:
- Returns `{"success": false, "error": "message"}` on failure
- Does not RAISE EXCEPTION to allow graceful error handling in UI

**Logic Flow**:
1. Find pending_user by email (case-insensitive)
2. Find or create activated user profile by email
3. Clean invalid patch IDs from affected pending organisers
4. Migrate hierarchy relationships:
   - Draft lead → live organisers: Create `role_hierarchy`
   - Draft lead → pending organisers: Create `lead_draft_organiser_links`
   - Update `draft_lead_organiser_links` where user is pending organiser
   - Live leads → pending organiser: Create `role_hierarchy`
5. Update activated user's role from pending_user
6. Migrate patch assignments to appropriate tables
7. Archive pending_user (set status='archived', add notes)
8. Return summary JSON

### 2. API Endpoint: `/api/admin/activate-pending-user`

**Location**: `src/app/api/admin/activate-pending-user/route.ts`

**Method**: POST

**Request Body**:
```typescript
{
  pendingEmail: string;     // e.g., "cpappas@testing.org"
  activatedEmail?: string;  // Optional, defaults to converting @testing.org → @cfmeu.org
}
```

**Response**:
```typescript
{
  success: boolean;
  data?: {
    pending_user_id: string;
    activated_user_id: string;
    role: string;
    hierarchy_migrated: object;
    patches_migrated: number;
  };
  error?: string;
}
```

**Logic**:
1. Check if user is admin
2. Validate pending email format
3. Generate activated email if not provided:
   - Replace `@testing.org` with `@cfmeu.org`
4. Call `activate_pending_user()` database function
5. Return result to client

**Security**: Admin-only (check `profiles.role = 'admin'`)

### 3. UI Component: Activate Button in PendingUsersTable

**Location**: `src/components/admin/PendingUsersTable.tsx`

**Changes**:
1. Add new "Activate" button for pending users (especially those with @testing.org emails)
2. Show confirmation dialog before activation:
   ```
   Activate User?
   
   This will:
   - Create/link active user: cpappas@cfmeu.org
   - Transfer role: lead_organiser
   - Migrate all hierarchies and patch assignments
   - Archive pending user: cpappas@testing.org
   
   This action cannot be undone.
   
   [Cancel] [Activate]
   ```
3. Show success toast with summary
4. Refresh pending users table after activation
5. Auto-detect email conversion (@testing.org → @cfmeu.org)
6. Allow manual override of activated email if needed

**Button States**:
- Disabled if already status='archived'
- Disabled if email doesn't match expected format
- Show loading spinner during activation

### 4. Helper Function: Email Conversion

**Location**: `src/utils/emailConversion.ts`

```typescript
export function convertTestingToProductionEmail(email: string): string {
  return email.replace(/@testing\.org$/i, '@cfmeu.org');
}

export function isTestingEmail(email: string): boolean {
  return /@testing\.org$/i.test(email);
}

export function extractUserFromEmail(email: string): string {
  return email.split('@')[0];
}
```

### 5. Activation Dialog Component

**Location**: `src/components/admin/ActivatePendingUserDialog.tsx`

**Props**:
```typescript
interface ActivatePendingUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingUser: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    assigned_patch_ids: string[];
  };
  onSuccess: () => void;
}
```

**Features**:
- Shows pending email and auto-generated activated email
- Allows editing the activated email
- Shows summary of what will be migrated
- Handles loading and error states
- Shows detailed success message with counts

## Implementation Steps

### Step 1: Create Database Function (20 min)
- [x] Test with Chris Pappas (completed)
- [x] Generalize the script into a reusable function
- [x] Add comprehensive error handling
- [x] Add transaction support
- [x] Return detailed JSON summary

### Step 2: Create API Endpoint (15 min)
- [ ] Create route handler
- [ ] Add admin authentication check
- [ ] Add email validation
- [ ] Call database function
- [ ] Handle errors gracefully

### Step 3: Create Helper Utilities (5 min)
- [ ] Email conversion functions
- [ ] Validation utilities

### Step 4: Create Activation Dialog (20 min)
- [ ] Build dialog component
- [ ] Add form for email confirmation/override
- [ ] Add loading and error states
- [ ] Add success message with details

### Step 5: Update PendingUsersTable (15 min)
- [ ] Add "Activate" button column
- [ ] Wire up dialog
- [ ] Add conditional rendering for testing.org emails
- [ ] Add refresh after activation

### Step 6: Testing (20 min)
- [ ] Test with various pending user scenarios:
  - Pending organiser with patches
  - Pending lead_organiser with organisers under them
  - Pending organiser under a live lead
  - Pending user with invalid patch IDs
  - Edge cases (no relationships, no patches, etc.)
- [ ] Test error handling
- [ ] Test UI feedback
- [ ] Verify all relationships migrated correctly

## Edge Cases to Handle

1. **Activated user already exists**: 
   - Link to existing profile
   - Merge data (don't overwrite existing)

2. **Invalid patch IDs**: 
   - Clean before migration (already handled)
   - Log which patches were invalid

3. **Pending user not found**: 
   - Return clear error message

4. **Activated user email already used by another pending_user**: 
   - Return error, suggest resolving conflict first

5. **No relationships to migrate**: 
   - Still archive pending user
   - Return success with zero counts

6. **Partial migration failure**: 
   - Use transaction to rollback
   - Return detailed error

## Database Schema Reminder

### Tables Involved:
- `pending_users`: Source of pending user data
- `profiles`: Destination for activated users
- `role_hierarchy`: Live lead ↔ live organiser relationships
- `draft_lead_organiser_links`: Pending lead ↔ organiser relationships
- `lead_draft_organiser_links`: Live lead ↔ pending organiser relationships
- `organiser_patch_assignments`: Patch assignments for organisers
- `lead_organiser_patch_assignments`: Patch assignments for lead_organisers
- `patches`: Reference table for valid patches

### Triggers That Fire:
- `sync_lead_patches_on_draft_links_change`: Fires on `lead_draft_organiser_links` insert/update
  - Can cause foreign key violations if invalid patch IDs exist
  - **Solution**: Clean invalid patch IDs first

## Success Criteria

✅ Pending user can be activated via UI with one click  
✅ Email automatically converts from @testing.org to @cfmeu.org  
✅ All hierarchy relationships are preserved  
✅ All patch assignments are migrated  
✅ Role is correctly transferred  
✅ Pending user is archived (not deleted)  
✅ Clear success/error feedback in UI  
✅ Admin-only access  
✅ Works for all user roles (organiser, lead_organiser, etc.)  
✅ Handles edge cases gracefully  

## Future Enhancements

1. **Bulk Activation**: Activate multiple pending users at once
2. **Rollback Function**: Undo an activation if needed
3. **Audit Trail**: Track who activated which users and when
4. **Email Notification**: Send email to activated user
5. **Conflict Resolution UI**: Handle email conflicts visually
6. **Preview Mode**: Show what would be migrated before activating
7. **Validation Rules**: Check that user setup is complete before allowing activation

## Timeline

- Database Function: 20 minutes
- API Endpoint: 15 minutes  
- Helper Utilities: 5 minutes
- Activation Dialog: 20 minutes
- UI Integration: 15 minutes
- Testing: 20 minutes

**Total Estimated Time: ~95 minutes (~1.5 hours)**

