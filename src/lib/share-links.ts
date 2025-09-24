/**
 * Utility functions for secure share link functionality
 */

// Valid resource types that can be shared
export const SHARE_RESOURCE_TYPES = [
  'PROJECT_MAPPING_SHEET',
  'PROJECT_SITE_VISIT',
] as const;

export type ShareResourceType = typeof SHARE_RESOURCE_TYPES[number];

/**
 * Get the base URL for the application
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  return 'http://localhost:3000';
}

/**
 * Generate a share URL from a token
 */
export function generateShareUrl(token: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/share/${token}`;
}

/**
 * Validate a resource type
 */
export function isValidResourceType(resourceType: string): resourceType is ShareResourceType {
  return SHARE_RESOURCE_TYPES.includes(resourceType as ShareResourceType);
}

/**
 * Get human-readable resource type name
 */
export function getResourceTypeName(resourceType: ShareResourceType): string {
  const names: Record<ShareResourceType, string> = {
    PROJECT_MAPPING_SHEET: 'Project Mapping Sheet',
    PROJECT_SITE_VISIT: 'Site Visit Form',
  };
  
  return names[resourceType] || resourceType.replace(/_/g, ' ').toLowerCase();
}

/**
 * Calculate expiry time from hours
 */
export function calculateExpiryTime(hoursFromNow: number): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hoursFromNow);
  return expiry;
}

/**
 * Format time remaining until expiry
 */
export function formatTimeRemaining(expiresAt: string | Date): {
  text: string;
  isExpired: boolean;
  isExpiringSoon: boolean; // < 6 hours
} {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const hoursRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  if (hoursRemaining <= 0) {
    return { text: 'Expired', isExpired: true, isExpiringSoon: false };
  }
  
  if (hoursRemaining < 24) {
    const text = `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'} remaining`;
    return { text, isExpired: false, isExpiringSoon: hoursRemaining < 6 };
  }
  
  const daysRemaining = Math.ceil(hoursRemaining / 24);
  const text = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
  return { text, isExpired: false, isExpiringSoon: false };
}
