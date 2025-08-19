interface ContactDetails {
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
}

export interface ProcessedContractorData {
  name: string;
  employer_type: 'small_contractor' | 'large_contractor';
  phone?: string;
  email?: string;
  address_line_1?: string;
  address_line_2?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  website?: string;
  contact_notes?: string;
  trade_type: string;
  eba_signatory: 'yes' | 'no' | 'not_specified';
}

// Trade name mapping from CSV format to database enum
const TRADE_MAPPING: Record<string, string> = {
  'Tower Crane': 'tower_crane',
  'Mobile Crane': 'mobile_crane',
  'Demo': 'demolition',
  'Demolition': 'demolition',
  'Scaffold': 'scaffolding',
  'Scaffolding': 'scaffolding',
  'Stressor (Post-Tensioning)': 'post_tensioning',
  'Post-Tensioning': 'post_tensioning',
  'Concreter': 'concreting',
  'Concrete': 'concreting',
  'Form worker': 'form_work',
  'Formwork': 'form_work',
  'Steel fixer': 'steel_fixing',
  'Steel Fixing': 'steel_fixing',
  'Bricklayer': 'bricklaying',
  'Bricklaying': 'bricklaying',
  'Traffic Control': 'traffic_control',
  'Labour hire': 'labour_hire',
  'Labour Hire': 'labour_hire',
  'Carpentry': 'carpentry',
  'Windows': 'windows',
  'Painters': 'painting',
  'Painting': 'painting',
  'Waterproofing': 'waterproofing',
  'Plasterers': 'plastering',
  'Plastering': 'plastering',
  'Edge protection': 'edge_protection',
  'Hoist': 'hoist',
  'Kitchens': 'kitchens',
  'Tiling': 'tiling',
  'Cleaners': 'cleaning',
  'Cleaning': 'cleaning',
  'Flooring': 'flooring',
  'Structural Steel': 'structural_steel',
  'Landscaping': 'landscaping'
};

export function parseContactDetails(contactString: string): ContactDetails {
  const result: ContactDetails = {};
  
  if (!contactString || contactString.trim() === '' || contactString === '*Data Not Available*') {
    return result;
  }

  // Extract phone numbers (P: format)
  const phoneMatch = contactString.match(/P:\s*([^;]+)/i);
  if (phoneMatch) {
    result.phone = phoneMatch[1].trim();
  }

  // Extract email addresses (E: format)
  const emailMatch = contactString.match(/E:\s*([^;]+)/i);
  if (emailMatch) {
    result.email = emailMatch[1].trim();
  }

  // Extract address (A: format)
  const addressMatch = contactString.match(/A:\s*([^;]+)/i);
  if (addressMatch) {
    result.address = addressMatch[1].trim();
  }

  // Extract website URLs
  const websiteMatch = contactString.match(/(https?:\/\/[^\s;]+)/i);
  if (websiteMatch) {
    result.website = websiteMatch[1].trim();
  }

  return result;
}

export function parseAddress(addressString: string): {
  address_line_1?: string;
  address_line_2?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
} {
  if (!addressString) return {};

  const result: any = {};
  
  // Remove reference numbers like [2], [3], etc.
  const cleanAddress = addressString.replace(/\s*\[\d+\]\s*$/, '').trim();
  
  // Split by comma to get address components
  const parts = cleanAddress.split(',').map(p => p.trim());
  
  if (parts.length >= 1) {
    result.address_line_1 = parts[0];
  }
  
  if (parts.length >= 2) {
    // Try to identify suburb/state/postcode from the last part
    const lastPart = parts[parts.length - 1];
    const statePostcodeMatch = lastPart.match(/(.+?)\s+(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\s+(\d{4})$/i);
    
    if (statePostcodeMatch) {
      const [, suburb, state, postcode] = statePostcodeMatch;
      result.suburb = suburb.trim();
      result.state = state.toUpperCase();
      result.postcode = postcode;
      
      // If there are middle parts, combine them as address_line_2
      if (parts.length > 2) {
        result.address_line_2 = parts.slice(1, -1).join(', ');
      }
    } else {
      // Fallback: treat remaining parts as address_line_2
      result.address_line_2 = parts.slice(1).join(', ');
    }
  }
  
  return result;
}

export function mapTradeType(tradeName: string): string {
  const normalizedTrade = tradeName.trim();
  return TRADE_MAPPING[normalizedTrade] || 'general_construction';
}

export function mapEbaStatus(ebaString: string): 'yes' | 'no' | 'not_specified' {
  const normalized = ebaString.toLowerCase().trim();
  if (normalized === 'y' || normalized === 'yes') return 'yes';
  if (normalized === 'n' || normalized === 'no') return 'no';
  return 'not_specified';
}

export function processContractorRow(row: Record<string, string>): ProcessedContractorData | null {
  const trade = row['Trade'] || row['trade'];
  const company = row['Company'] || row['company'];
  const contactDetails = row['Contact Details'] || row['contact_details'] || '';
  const ebaSignatory = row['EBA Signatory (Y/N)'] || row['eba_signatory'] || 'Not Specified';

  // Skip rows with missing data
  if (!trade || !company || company === '*Data Not Available*') {
    return null;
  }

  const parsedContact = parseContactDetails(contactDetails);
  const parsedAddress = parseAddress(parsedContact.address || '');
  
  return {
    name: company.trim(),
    employer_type: 'small_contractor', // Default for most contractors
    phone: parsedContact.phone,
    email: parsedContact.email,
    website: parsedContact.website,
    contact_notes: contactDetails, // Keep original for reference
    trade_type: mapTradeType(trade),
    eba_signatory: mapEbaStatus(ebaSignatory),
    ...parsedAddress
  };
}

export function processContractorData(csvData: any[]): ProcessedContractorData[] {
  return csvData
    .map(row => processContractorRow(row))
    .filter((row): row is ProcessedContractorData => row !== null);
}