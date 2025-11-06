/**
 * Authentication Utilities
 *
 * Utilities for managing user authentication, password generation, and testing workflows
 */

/**
 * Generates a secure temporary password for testing accounts
 * @returns Secure temporary password (12 characters with mixed case, numbers, and special chars)
 */
export function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%&';

  let password = '';

  // Ensure at least one character from each set
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += special.charAt(Math.floor(Math.random() * special.length));

  // Fill remaining characters (8 more for total of 12)
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = 0; i < 8; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle the password characters
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Validates if a password meets the minimum security requirements
 * @param password - Password to validate
 * @returns true if password meets requirements
 */
export function isValidPassword(password: string): boolean {
  if (!password || password.length < 8) {
    return false;
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%&]/.test(password);

  return hasUppercase && hasLowercase && hasNumbers && hasSpecial;
}

/**
 * Creates a development-only auth user bypass
 * @param email - User email
 * @param role - User role
 * @param fullName - User full name
 * @returns Promise resolving to created user data
 */
export async function createDevAuthUser(email: string, role: string, fullName?: string) {
  // Only allow in development environment
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Dev auth user creation is only allowed in development environment');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const tempPassword = generateTemporaryPassword();

  const { data: authUser, error } = await supabase.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password: tempPassword,
    email_confirm: true, // Skip email verification for development
    user_metadata: {
      role: role,
      full_name: fullName || email.split('@')[0],
      created_via: 'development_activation',
      created_at: new Date().toISOString()
    }
  });

  if (error) {
    throw new Error(`Failed to create dev auth user: ${error.message}`);
  }

  return {
    user: authUser.user,
    temporaryPassword: tempPassword
  };
}

/**
 * Checks if an email is a development/testing email
 * @param email - Email address to check
 * @returns true if email is for development/testing
 */
export function isDevelopmentEmail(email: string): boolean {
  const devDomains = [
    '@testing.org',
    '@cfmeu-test.local',
    '@test.cfmeu.local',
    '@dev.cfmeu.local'
  ];

  return devDomains.some(domain => email.toLowerCase().endsWith(domain));
}

/**
 * Prepares user metadata for auth creation
 * @param role - User role
 * @param fullName - User full name
 * @param metadata - Additional metadata
 * @returns Formatted user metadata object
 */
export function prepareUserMetadata(role: string, fullName?: string, metadata?: Record<string, any>) {
  return {
    role,
    full_name: fullName || '',
    created_via: 'pending_user_activation',
    activation_phase: 'testing',
    created_at: new Date().toISOString(),
    ...metadata
  };
}