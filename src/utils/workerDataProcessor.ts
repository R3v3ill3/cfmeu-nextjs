export interface ProcessedWorkerData {
  // Worker fields
  first_name: string;
  surname: string;
  mobile_phone?: string;
  email?: string;
  union_membership_status: 'member' | 'non_member' | 'potential' | 'declined';
  member_number?: string;
  
  // Employer linking
  company_name: string;
  
  // Organizer info (for matching and assignment)
  organizer_number?: string;
  organizer_surname?: string;
  organizer_first_name?: string;
  organizer_full_name?: string;
  
  // Additional fields
  comments?: string;
  source_file?: string;
}

export interface EmployerMatch {
  id: string;
  name: string;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  distance?: number;
}

export interface OrganiserMatch {
  id: string;
  name: string;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  distance?: number;
}

// Simple string similarity function for employer matching
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/PTY\.?\s*LTD\.?/gi, 'PTY LTD')
    .replace(/LIMITED/gi, 'LTD')
    .replace(/PROPRIETARY/gi, 'PTY')
    .replace(/\bAND\b/gi, '&')
    .replace(/[^\w\s&]/g, '');
}

export function findBestEmployerMatch(
  companyName: string, 
  existingEmployers: Array<{id: string, name: string}>
): EmployerMatch | null {
  const normalizedSearchName = normalizeCompanyName(companyName);
  
  let bestMatch: EmployerMatch | null = null;
  let bestScore = 0;
  
  for (const employer of existingEmployers) {
    const normalizedEmployerName = normalizeCompanyName(employer.name);
    
    // Check for exact match first
    if (normalizedSearchName === normalizedEmployerName) {
      return {
        id: employer.id,
        name: employer.name,
        confidence: 'exact',
        distance: 0
      };
    }
    
    // Calculate similarity
    const similarity = calculateSimilarity(normalizedSearchName, normalizedEmployerName);
    
    if (similarity > bestScore && similarity > 0.7) {
      bestScore = similarity;
      const confidence = similarity >= 0.95 ? 'high' : 
                       similarity >= 0.85 ? 'medium' : 'low';
      
      bestMatch = {
        id: employer.id,
        name: employer.name,
        confidence,
        distance: 1 - similarity
      };
    }
  }
  
  return bestMatch;
}

export function findBestOrganiserMatch(
  organiserName: string, 
  existingOrganisers: Array<{id: string, first_name: string, last_name: string}>
): OrganiserMatch | null {
  if (!organiserName || !organiserName.trim()) return null;
  
  const normalizedSearchName = organiserName.trim().toUpperCase();
  
  let bestMatch: OrganiserMatch | null = null;
  let bestScore = 0;
  
  for (const organiser of existingOrganisers) {
    const fullName = `${organiser.first_name} ${organiser.last_name}`.toUpperCase();
    const reverseName = `${organiser.last_name} ${organiser.first_name}`.toUpperCase();
    
    // Check for exact match first
    if (normalizedSearchName === fullName || normalizedSearchName === reverseName) {
      return {
        id: organiser.id,
        name: `${organiser.first_name} ${organiser.last_name}`,
        confidence: 'exact',
        distance: 0
      };
    }
    
    // Calculate similarity for both name orders
    const similarity1 = calculateSimilarity(normalizedSearchName, fullName);
    const similarity2 = calculateSimilarity(normalizedSearchName, reverseName);
    const similarity = Math.max(similarity1, similarity2);
    
    if (similarity > bestScore && similarity > 0.7) {
      bestScore = similarity;
      const confidence = similarity >= 0.95 ? 'high' : 
                       similarity >= 0.85 ? 'medium' : 'low';
      
      bestMatch = {
        id: organiser.id,
        name: `${organiser.first_name} ${organiser.last_name}`,
        confidence,
        distance: 1 - similarity
      };
    }
  }
  
  return bestMatch;
}

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with 04, it's an Australian mobile
  if (cleaned.startsWith('04') && cleaned.length === 10) {
    return cleaned;
  }
  
  // If it starts with +614, convert to 04
  if (cleaned.startsWith('+614') && cleaned.length === 13) {
    return '04' + cleaned.slice(4);
  }
  
  return cleaned;
}

export function processWorkerRow(row: Record<string, string>): ProcessedWorkerData | null {
  const companyName = row['CompanyName'] || row['Company Name'] || row['company_name'] || row['Company'] || row['Employer'] || row['EmployerName'] || row['Employer Name'];
  const memberSurname = row['MemberSurname'] || row['Member Surname'] || row['surname'] || row['LastName'] || row['Last Name'] || row['last_name'] || row['FamilyName'] || row['Family Name'];
  const memberFirstName = row['MemberFirstName'] || row['Member First Name'] || row['first_name'] || row['FirstName'] || row['First Name'] || row['GivenName'] || row['Given Name'] || row['given_name'];
  const mobile = row['Mobile'] || row['mobile'] || row['mobile_phone'] || row['Mobile Phone'] || row['Phone'] || row['PhoneNumber'] || row['Phone Number'] || row['Contact Phone'];
  const memberNumber = row['MemberNumber'] || row['Member Number'] || row['member_number'];
  const comments = row['Comments'] || row['comments'];
  const email = row['Email'] || row['email'];
  
  // Skip rows with missing essential data (company can be injected upstream when employer is pre-selected)
  if (!companyName || !memberSurname || !memberFirstName) {
    return null;
  }
  
  // Determine union membership status from explicit column first, then fallbacks
  let unionStatus: 'member' | 'non_member' | 'potential' | 'declined' = 'potential';
  const statusRaw = row['MembershipStatus'] || row['membership_status'] || row['UnionStatus'] || row['union_status'];
  if (typeof statusRaw === 'string' && statusRaw.trim() !== '') {
    const s = statusRaw.toLowerCase().replace('-', '_').trim();
    if (s.includes('member') && !s.includes('non')) unionStatus = 'member';
    else if (s.includes('non') && s.includes('member')) unionStatus = 'non_member';
    else if (s.includes('declin')) unionStatus = 'declined';
    else if (s.includes('potential') || s.includes('prospect')) unionStatus = 'potential';
  } else if (memberNumber && memberNumber.trim() !== '') {
    unionStatus = 'member';
  } else if (comments && comments.toLowerCase().includes('non-member')) {
    unionStatus = 'non_member';
  } else if (comments && comments.toLowerCase().includes('declined')) {
    unionStatus = 'declined';
  }

  // Build organiser full name from available fields
  const organiserFirstName = row['OrganiserFirstName'] || row['Organiser First Name'];
  const organiserSurname = row['OrganiserSurname'] || row['Organiser Surname'];
  let organiserFullName = row['OrganiserFullName'] || row['Organiser Full Name'] || row['organiser_name'];
  
  if (!organiserFullName && organiserFirstName && organiserSurname) {
    organiserFullName = `${organiserFirstName.trim()} ${organiserSurname.trim()}`;
  }
  
  return {
    first_name: memberFirstName.trim(),
    surname: memberSurname.trim(),
    mobile_phone: mobile ? cleanPhoneNumber(mobile) : undefined,
    email: email?.trim(),
    union_membership_status: unionStatus,
    member_number: memberNumber?.trim(),
    company_name: companyName.trim(),
    organizer_number: row['OrganiserNumber'] || row['Organiser Number'],
    organizer_surname: organiserSurname,
    organizer_first_name: organiserFirstName,
    organizer_full_name: organiserFullName,
    comments: comments?.trim(),
    source_file: row['SourceFile'] || row['Source File'] || row['source_file']
  };
}

export function processWorkerData(csvData: any[]): ProcessedWorkerData[] {
  return csvData
    .map(row => processWorkerRow(row))
    .filter((row): row is ProcessedWorkerData => row !== null);
}