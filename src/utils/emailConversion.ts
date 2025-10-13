/**
 * Email Conversion Utilities
 * 
 * Utilities for converting between testing and production email formats
 * Used in the pending user activation flow
 */

/**
 * Converts a testing email to production format
 * @param email - Email address (e.g., cpappas@testing.org)
 * @returns Production email (e.g., cpappas@cfmeu.org)
 */
export function convertTestingToProductionEmail(email: string): string {
  return email.replace(/@testing\.org$/i, '@cfmeu.org')
}

/**
 * Checks if an email is a testing email
 * @param email - Email address to check
 * @returns true if email ends with @testing.org
 */
export function isTestingEmail(email: string): boolean {
  return /@testing\.org$/i.test(email)
}

/**
 * Checks if an email is a production CFMEU email
 * @param email - Email address to check
 * @returns true if email ends with @cfmeu.org
 */
export function isProductionEmail(email: string): boolean {
  return /@cfmeu\.org$/i.test(email)
}

/**
 * Extracts the username part from an email
 * @param email - Email address
 * @returns Username before the @ symbol
 */
export function extractUserFromEmail(email: string): string {
  return email.split('@')[0]
}

/**
 * Validates email format
 * @param email - Email address to validate
 * @returns true if email format is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Checks if a pending user should show the activate button
 * @param email - Pending user email
 * @param status - Pending user status
 * @returns true if user can be activated
 */
export function canActivatePendingUser(email: string, status: string): boolean {
  return isTestingEmail(email) && status !== 'archived'
}

