/**
 * Utility functions for CFMEU delegate registration form submission
 */

export interface CFMEUFormData {
  firstName: string;
  surname: string;
  mobileNumber: string;
  union: string;
  emailAddress: string;
  homeAddress: string;
  employer: string;
  siteName: string;
  siteAddress: string;
  sitePhone: string;
  siteFax: string;
  siteType: string;
  siteEstimatedCompletionDate: string;
  industrySector: string;
  electedBy: string;
  dateElected: string;
  organiser: string;
  repType: 'Delegate Only' | 'OHS Rep Only' | 'Delegate & OHS Rep';
  dateCompletedOHSRefresherTraining: string;
  dateCompletedOHSTraining: string;
}

/**
 * Opens the CFMEU registration form in a new window with pre-filled data
 * Note: Due to CORS restrictions, we can't automatically submit the form,
 * but we can provide instructions and open the form for manual completion
 */
export function openCFMEURegistrationForm(formData: CFMEUFormData): void {
  const cfmeuUrl = 'https://nsw.cfmeu.org/members/health-safety/delegate-hsr-registration/';
  
  // Open the form in a new window
  const newWindow = window.open(cfmeuUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
  
  if (newWindow) {
    // Store form data in localStorage for potential auto-fill script
    localStorage.setItem('cfmeu_form_data', JSON.stringify(formData));
    
    // Focus the new window
    newWindow.focus();
  } else {
    // Fallback if popup is blocked
    window.location.href = cfmeuUrl;
  }
}

/**
 * Generates a summary of the form data for display to the user
 */
export function generateFormSummary(formData: CFMEUFormData): string {
  return `
CFMEU Delegate/HSR Registration Summary:

Personal Details:
- Name: ${formData.firstName} ${formData.surname}
- Mobile: ${formData.mobileNumber}
- Email: ${formData.emailAddress}
- Address: ${formData.homeAddress}

Work Details:
- Employer: ${formData.employer}
- Site: ${formData.siteName}
- Site Address: ${formData.siteAddress}
- Site Phone: ${formData.sitePhone}
- Estimated Completion: ${formData.siteEstimatedCompletionDate}

Representative Details:
- Type: ${formData.repType}
- Elected By: ${formData.electedBy}
- Date Elected: ${formData.dateElected}
- OHS Training: ${formData.dateCompletedOHSTraining}
- OHS Refresher: ${formData.dateCompletedOHSRefresherTraining}

Please complete any remaining fields in the CFMEU form and submit.
  `.trim();
}

/**
 * Validates that required form data is present
 */
export function validateCFMEUFormData(formData: Partial<CFMEUFormData>): string[] {
  const errors: string[] = [];
  
  if (!formData.firstName) errors.push('First name is required');
  if (!formData.surname) errors.push('Surname is required');
  if (!formData.mobileNumber) errors.push('Mobile number is required');
  if (!formData.employer) errors.push('Employer is required');
  if (!formData.siteName) errors.push('Site name is required');
  if (!formData.repType) errors.push('Representative type is required');
  
  return errors;
}

/**
 * Maps internal union role names to CFMEU rep types
 */
export function mapUnionRoleToRepType(unionRoles: string[]): 'Delegate Only' | 'OHS Rep Only' | 'Delegate & OHS Rep' {
  const hasDelegateRole = unionRoles.some(role => 
    ['site_delegate', 'shift_delegate', 'company_delegate'].includes(role)
  );
  const hasHSRRole = unionRoles.some(role => 
    ['hsr', 'ohs_committee_chair'].includes(role)
  );
  
  if (hasDelegateRole && hasHSRRole) {
    return 'Delegate & OHS Rep';
  } else if (hasHSRRole) {
    return 'OHS Rep Only';
  } else {
    return 'Delegate Only';
  }
}

/**
 * Site type options for CFMEU form
 */
export const SITE_TYPE_OPTIONS = [
  'Apartments',
  'Bridges', 
  'Factory',
  'Construction Site',
  'Roads',
  'Powerstations'
] as const;

export type SiteType = typeof SITE_TYPE_OPTIONS[number];
