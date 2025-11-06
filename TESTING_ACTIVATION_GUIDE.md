# Testing User Activation Guide

## Overview

The enhanced activation system now supports creating **testing accounts** with temporary passwords for draft users with `@testing.org` emails. This allows complete testing of user workflows without requiring real email accounts.

## How It Works

### Phase 1: Draft Users (Current State)
- Users exist in `pending_users` table
- Have roles, patch assignments, and hierarchies configured
- Status: `'draft'` or `'invited'`

### Phase 2: Testing Account Activation (New Enhancement)
- Click "Activate" on draft users with `@testing.org` emails
- System creates Supabase auth user with **temporary password**
- All relationships migrated to production tables
- User can login immediately for testing

### Phase 3: Production Email Transition (Future)
- Update email from `@testing.org` → `@cfmeu.org`
- No data migration needed (already done in Phase 2)
- User sets real password via email reset

## Testing Workflow

### 1. Create Testing Draft Users
```sql
INSERT INTO pending_users (email, full_name, role, status, assigned_patch_ids, notes)
VALUES
  ('test.organiser.sydney@testing.org', 'Test Organiser Sydney', 'organiser', 'draft', '{sydney-patch-1}', 'Testing account for Sydney organiser workflows'),
  ('test.lead.organiser@testing.org', 'Test Lead Organiser', 'lead_organiser', 'draft', '{sydney-region}', 'Testing account for lead organiser workflows');
```

### 2. Activate Testing Users
1. Go to **Admin → Draft Users**
2. Find your `@testing.org` user
3. Click **"Activate"** button
4. Review the activation details
5. Click **"Activate User"**

### 3. Login with Testing Credentials
After activation, you'll see:
- **Email**: `test.organiser.sydney@testing.org`
- **Temporary Password**: `xK7#mP9$qL2!` (example)

Use these credentials to:
- ✅ Test login flow
- ✅ Verify role-based permissions
- ✅ Test patch assignments work correctly
- ✅ Verify hierarchy relationships
- ✅ Test mobile device access

## Key Features

### ✅ Preserves All Data
- **Patch assignments**: Migrated to `organiser_patch_assignments`/`lead_organiser_patch_assignments`
- **Hierarchies**: Migrated to `role_hierarchy` table
- **User role**: Applied to user profile
- **All relationships**: Maintained through activation

### ✅ Secure Temporary Passwords
- 12-character secure passwords
- Mixed case, numbers, special characters
- Generated automatically during activation
- Displayed only once to admin

### ✅ Rollback Protection
- If auth creation fails, database changes are automatically rolled back
- Prevents partial activations that could corrupt data
- Maintains data integrity

### ✅ Testing vs Production Logic
- **Testing emails** (`@testing.org`): Create auth user with temp password
- **Production emails** (`@cfmeu.org`): Require existing auth user

## Testing Scenarios

### 1. Basic Organiser Testing
```sql
-- Create test organiser
INSERT INTO pending_users (email, full_name, role, status, assigned_patch_ids)
VALUES ('organiser.test1@testing.org', 'Test Organiser One', 'organiser', 'draft', '{patch-id-1}');

-- Activate → Login → Verify patch access ✅
```

### 2. Lead Organiser Hierarchy Testing
```sql
-- Create test lead organiser with subordinates
INSERT INTO pending_users (email, full_name, role, status, assigned_patch_ids)
VALUES ('lead.test1@testing.org', 'Test Lead Organiser', 'lead_organiser', 'draft', '{patch-id-1}');

-- Create hierarchies using existing links
-- Activate → Login → Verify subordinate access ✅
```

### 3. Multi-Patch Organiser Testing
```sql
-- Create organiser with multiple patches
INSERT INTO pending_users (email, full_name, role, status, assigned_patch_ids)
VALUES ('organiser.multi@testing.org', 'Multi-Patch Organiser', 'organiser', 'draft', '{patch-1, patch-2, patch-3}');

-- Activate → Login → Verify all patches accessible ✅
```

## Mobile Testing

### 1. Activate Testing User
- Use admin panel on desktop to create testing account
- Note the temporary password

### 2. Test on Mobile Device
- Open mobile browser
- Navigate to your app URL
- Login with testing credentials
- Test mobile-specific workflows:
  - ✅ Dashboard access
  - ✅ Project navigation
  - ✅ Employer views
  - ✅ Compliance workflows
  - ✅ Map functionality

## Production Transition Planning

### When Ready for Production:
1. **Update user email** in Supabase auth: `test.organiser@testing.org` → `real.user@cfmeu.org`
2. **Send password reset email** to new address
3. **User sets real password** via email link
4. **Delete testing auth user** (optional)

### Data Migration Status:
- ✅ **Already complete** - All data migrated during Phase 2 activation
- ✅ **No data loss** - All assignments preserved
- ✅ **No additional migration needed** - Just email update

## Troubleshooting

### Activation Fails
- **Check logs**: Look for auth creation errors
- **Verify email format**: Must be valid email address
- **Check Supabase service key**: Must have admin permissions

### Login Fails
- **Verify email**: Use exact email from activation
- **Check password**: Copy-paste temporary password exactly
- **Clear browser cache**: Remove old sessions

### Missing Permissions
- **Check role**: Verify role was applied correctly
- **Verify patches**: Confirm patch assignments migrated
- **Check hierarchies**: Verify lead/organiser relationships

## Security Notes

### Temporary Passwords
- **Single display**: Shown only once during activation
- **Secure generation**: Meets password complexity requirements
- **Admin responsibility**: Share securely with testers

### Testing Environment
- **Development only**: Enhanced activation works for testing emails
- **Email verification bypassed**: Only for `@testing.org` domains
- **Rollback protection**: Prevents partial activations

## Admin Workflow Summary

1. **Setup**: Create draft users with `@testing.org` emails
2. **Configure**: Assign patches, roles, and hierarchies
3. **Activate**: Use "Activate" button for each test user
4. **Share**: Provide temporary passwords to testers
5. **Test**: Verify complete user workflows
6. **Transition**: When ready, update to production emails

This system provides a complete, secure testing workflow that maintains all your carefully configured user relationships and permissions while enabling thorough testing of the CFMEU platform.