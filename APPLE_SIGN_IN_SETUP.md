# Apple Sign In Setup Guide

This guide walks you through setting up Apple ID sign-in for the CFMEU Next.js application. Apple Sign In is configured as an alternative authentication method, restricted to users with existing registered emails.

## Prerequisites

- Apple Developer account with access to create Service IDs and Keys
- Supabase project with Authentication enabled
- Your Apple Team ID: `N78UG8TQR2`
- Your Apple Service ID: `app.uconstruct.cfmeu`
- Your Apple .p8 private key file downloaded from Apple Developer

## Step 1: Install Dependencies

Install the required package for JWT generation:

```bash
npm install --save-dev jsonwebtoken @types/jsonwebtoken
```

Or with pnpm:

```bash
pnpm add -D jsonwebtoken @types/jsonwebtoken
```

## Step 2: Find Your Apple Key ID

1. Log in to [Apple Developer](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles** > **Keys**
3. Find the key you created for Sign in with Apple
4. Copy the **Key ID** (a 10-character string like `ABC123DEFG`)

## Step 3: Generate Apple Client Secret JWT

You can run the JWT generation script in two ways:

### Option A: Interactive Key Input (RECOMMENDED - Easiest)

This method prompts you to paste the key contents, avoiding shell quoting issues:

**Using npm (requires `--` to pass arguments):**
```bash
npm run generate-apple-jwt -- --key <key-id> <team-id> <client-id>
```

**Or run directly with npx/pnpm (no `--` needed):**
```bash
npx tsx scripts/generate-apple-jwt.ts --key <key-id> <team-id> <client-id>
```

**Or with pnpm:**
```bash
pnpm exec tsx scripts/generate-apple-jwt.ts --key <key-id> <team-id> <client-id>
```

**Example:**
```bash
npm run generate-apple-jwt -- --key 24VUD679A4 N78UG8TQR2 app.uconstruct.cfmeu
```

**Or:**
```bash
npx tsx scripts/generate-apple-jwt.ts --key 24VUD679A4 N78UG8TQR2 app.uconstruct.cfmeu
```

**Or with pnpm:**
```bash
pnpm exec tsx scripts/generate-apple-jwt.ts --key 24VUD679A4 N78UG8TQR2 app.uconstruct.cfmeu
```

When prompted, paste your entire `.p8` file contents (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines), then press **Ctrl+D** (or **Ctrl+Z** on Windows) when done.

### Option B: Use File Path

**Using npm:**
```bash
npm run generate-apple-jwt -- ./AuthKey_ABC123DEFG.p8 ABC123DEFG N78UG8TQR2 app.uconstruct.cfmeu
```

**Or run directly:**
```bash
npx tsx scripts/generate-apple-jwt.ts ./AuthKey_ABC123DEFG.p8 ABC123DEFG N78UG8TQR2 app.uconstruct.cfmeu
```

**Or with pnpm:**
```bash
pnpm exec tsx scripts/generate-apple-jwt.ts ./AuthKey_ABC123DEFG.p8 ABC123DEFG N78UG8TQR2 app.uconstruct.cfmeu
```

**Note:** When using `npm run`, you must include `--` before the arguments to pass them to the script. Alternatively, run the script directly with `npx tsx` or `pnpm exec tsx` to avoid this.

The script will output a JWT token. **Copy this entire token** - you'll need it for Supabase configuration.

**Note:** This JWT expires in 6 months. Set a reminder to regenerate it before expiration.

## Step 4: Configure Supabase Dashboard

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** > **Providers**
4. Find **Apple** in the list and click to configure
5. Enable the Apple provider
6. Enter the following:
   - **Client ID**: `app.uconstruct.cfmeu` (your Service ID)
   - **Secret Key**: Paste the JWT token generated in Step 3
7. Click **Save**

**Important:** The Secret Key field expects a JWT, not the .p8 file contents. Make sure you paste the complete JWT token.

### Enable Signups for OAuth (Required)

**Critical:** You must enable signups in Supabase for OAuth providers to work, even though we restrict access to existing users:

1. Navigate to **Authentication** > **Settings** > **Auth**
2. Under **User Management**, ensure **"Enable Signups"** is **enabled** (checked)
3. This allows OAuth flows to complete, but our callback handler will validate and reject unauthorized users

**Why this is safe:**
- OAuth users will be created in `auth.users` table
- Our callback handler (`/auth/confirm`) checks if the email exists in `profiles` or `pending_users`
- If the user doesn't exist, they are immediately signed out and shown an error
- Users without a profile cannot access any application data due to RLS policies

## Step 5: Apply Database Migration

Run the database migration to add the user validation function:

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually in Supabase Dashboard > SQL Editor
# Run the contents of: supabase/migrations/20250115000000_add_apple_oauth_user_validation.sql
```

This migration creates the `check_user_exists_for_oauth()` function that validates whether a user's email exists in the system before allowing sign-in.

## Step 6: Verify Apple Service ID Configuration

In Apple Developer, ensure your Service ID is configured correctly:

1. Go to **Certificates, Identifiers & Profiles** > **Identifiers**
2. Select your Service ID: `app.uconstruct.cfmeu`
3. Under **Sign in with Apple**, click **Configure**
4. Verify the **Return URLs** include:
   - `https://[your-project-ref].supabase.co/auth/v1/callback`
   - Your production domain callback URL (if applicable)

**Note:** The code automatically requests the `email` scope, which ensures Apple shows the "Share My Email" / "Hide My Email" option during sign-in. No additional Apple Developer configuration is needed for this.

## Step 7: Test the Implementation

1. Navigate to `/auth` in your application
2. Click **Continue with Apple**
3. Complete the Apple sign-in flow
4. **For existing users**: You should be redirected to the dashboard
5. **For new users**: You should see an error message indicating the email is not registered

## How It Works

### Authentication Flow

1. User clicks "Continue with Apple" on the auth page
2. User is redirected to Apple's sign-in page
3. User authenticates with Apple
4. Apple redirects back to `/auth/confirm` with an authorization code
5. The callback handler:
   - Exchanges the code for a session
   - Extracts the user's email
   - Calls `check_user_exists_for_oauth()` to verify the email exists in `profiles` or `pending_users`
   - If email exists: User is signed in and redirected to dashboard
   - If email doesn't exist: User is signed out and shown an error message

### User Validation

The system checks for user existence in two places:
- **profiles** table: Active users with `is_active = true`
- **pending_users** table: Users with status `'draft'` or `'invited'`

This ensures that only users who have been registered (either activated or pending) can sign in via Apple ID.

## Troubleshooting

### "Secret key should be a JWT" Error

This means Supabase rejected your secret key. Ensure:
- You're pasting the complete JWT token (not the .p8 file contents)
- The JWT was generated correctly using the script
- All parameters (Team ID, Key ID, Client ID) are correct

### "No email in OAuth session" Error

Apple may not return an email if:
- The user chose to hide their email
- The Service ID configuration is incorrect
- The user hasn't granted email permission

Ensure your Apple Service ID is configured to request email scope.

### "User not registered" Error (Expected)

This is the intended behavior for users not in the system. They will see a message directing them to contact their administrator.

### JWT Expiration

The JWT expires after 6 months. To regenerate:
1. Run the JWT generation script again (Step 3)
2. Copy the new JWT
3. Update it in Supabase Dashboard (Step 4)

Set a calendar reminder for 5.5 months to regenerate proactively.

## Security Considerations

- **Private Key Security**: Never commit your .p8 file to version control
- **JWT Expiration**: The JWT expires in 6 months - plan for renewal
- **Email Validation**: The system validates emails server-side to prevent unauthorized access
- **Error Messages**: Error messages don't reveal whether an email exists (security best practice)

## Files Modified/Created

- `scripts/generate-apple-jwt.ts` - JWT generation script
- `src/app/(auth)/auth/page.tsx` - Added Apple Sign In button
- `src/app/(auth)/auth/confirm/route.ts` - OAuth callback handler with user validation
- `supabase/migrations/20250115000000_add_apple_oauth_user_validation.sql` - Database function for user validation
- `package.json` - Added jsonwebtoken dependency and script command

## Next Steps

After setup:
1. Test with an existing user account
2. Test with a non-existent email (should be rejected)
3. Monitor Supabase logs for any authentication errors
4. Set a reminder to regenerate the JWT before expiration (5.5 months)

