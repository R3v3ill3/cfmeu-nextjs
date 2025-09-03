/**
 * Employer De-duplication Utilities
 * 
 * This module provides utilities for detecting and comparing employer names
 * to identify potential duplicates, with special handling for common business
 * naming variations.
 */

export interface EmployerSimilarity {
  id: string;
  name: string;
  address?: string;
  similarity: number;
  matchType: 'exact' | 'normalized' | 'fuzzy';
  reasons: string[];
}

export interface DuplicateSearchResult {
  exactMatches: EmployerSimilarity[];
  similarMatches: EmployerSimilarity[];
  hasExactMatch: boolean;
  hasSimilarMatches: boolean;
}

/**
 * Normalize company name by removing common variations and standardizing format
 */
export function normalizeEmployerName(name: string): string {
  if (!name) return '';
  
  let normalized = name.trim().toLowerCase();
  
  // Remove common business suffixes (case insensitive)
  const suffixes = [
    'pty ltd', 'pty. ltd.', 'pty ltd.', 'pty. ltd',
    'proprietary limited', 'proprietary ltd',
    'limited', 'ltd', 'ltd.',
    'incorporated', 'inc', 'inc.',
    'corporation', 'corp', 'corp.',
    'company', 'co', 'co.',
    'group', 'grp',
    'enterprises', 'ent',
    'australia', 'aust', 'aus',
    'international', 'intl', 'int\'l'
  ];
  
  // Remove suffixes at the end of the name
  for (const suffix of suffixes) {
    const pattern = new RegExp(`\\s+${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    normalized = normalized.replace(pattern, '');
  }
  
  // Remove common prefixes
  const prefixes = ['the ', 'a ', 'an '];
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.substring(prefix.length);
    }
  }
  
  // Normalize whitespace and punctuation
  normalized = normalized
    .replace(/[&]/g, 'and')  // Replace & with 'and'
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')  // Collapse multiple spaces
    .trim();
  
  return normalized;
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance implementation
 */
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

/**
 * Check if two employer names are likely the same company
 */
export function areEmployersLikelySame(name1: string, name2: string): {
  isSame: boolean;
  confidence: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let confidence = 0;
  
  // Exact match
  if (name1.toLowerCase().trim() === name2.toLowerCase().trim()) {
    return { isSame: true, confidence: 1.0, reasons: ['Exact match'] };
  }
  
  // Normalized match (after removing business suffixes)
  const norm1 = normalizeEmployerName(name1);
  const norm2 = normalizeEmployerName(name2);
  
  if (norm1 === norm2) {
    reasons.push('Same after normalizing business suffixes');
    confidence = 0.95;
  } else {
    // Fuzzy similarity
    const similarity = calculateSimilarity(norm1, norm2);
    confidence = similarity;
    
    if (similarity >= 0.9) {
      reasons.push(`Very high similarity (${Math.round(similarity * 100)}%)`);
    } else if (similarity >= 0.8) {
      reasons.push(`High similarity (${Math.round(similarity * 100)}%)`);
    } else if (similarity >= 0.7) {
      reasons.push(`Moderate similarity (${Math.round(similarity * 100)}%)`);
    }
    
    // Check for common variations
    if (containsAllKeywords(norm1, norm2)) {
      reasons.push('Contains all key words');
      confidence = Math.max(confidence, 0.85);
    }
    
    // Check for abbreviation patterns
    if (isLikelyAbbreviation(norm1, norm2)) {
      reasons.push('Likely abbreviation pattern');
      confidence = Math.max(confidence, 0.8);
    }
  }
  
  return {
    isSame: confidence >= 0.8,
    confidence,
    reasons
  };
}

/**
 * Check if one name contains all significant keywords from another
 */
function containsAllKeywords(name1: string, name2: string): boolean {
  const words1 = name1.split(/\s+/).filter(w => w.length > 2); // Skip very short words
  const words2 = name2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  const shorter = words1.length < words2.length ? words1 : words2;
  const longer = words1.length < words2.length ? words2 : words1;
  
  return shorter.every(word => 
    longer.some(longerWord => 
      longerWord.includes(word) || word.includes(longerWord)
    )
  );
}

/**
 * Check if names follow common abbreviation patterns
 */
function isLikelyAbbreviation(name1: string, name2: string): boolean {
  const words1 = name1.split(/\s+/);
  const words2 = name2.split(/\s+/);
  
  // Check if one could be an abbreviation of the other
  if (words1.length !== words2.length) return false;
  
  let abbreviationMatches = 0;
  for (let i = 0; i < words1.length; i++) {
    const word1 = words1[i];
    const word2 = words2[i];
    
    if (word1 === word2) {
      abbreviationMatches++;
    } else if (
      (word1.length === 1 && word2.startsWith(word1)) ||
      (word2.length === 1 && word1.startsWith(word2))
    ) {
      abbreviationMatches++;
    }
  }
  
  return abbreviationMatches >= words1.length * 0.7; // 70% of words match abbreviation pattern
}

/**
 * Search for duplicate employers in a list
 */
export function searchForDuplicates(
  targetName: string,
  employers: Array<{ id: string; name: string; address_line_1?: string; suburb?: string; state?: string }>,
  options: {
    exactMatchThreshold?: number;
    similarMatchThreshold?: number;
    maxResults?: number;
  } = {}
): DuplicateSearchResult {
  const {
    exactMatchThreshold = 0.95,
    similarMatchThreshold = 0.7,
    maxResults = 10
  } = options;
  
  const results: EmployerSimilarity[] = [];
  
  for (const employer of employers) {
    const comparison = areEmployersLikelySame(targetName, employer.name);
    
    if (comparison.confidence >= similarMatchThreshold) {
      const address = [
        employer.address_line_1,
        employer.suburb,
        employer.state
      ].filter(Boolean).join(', ');
      
      let matchType: 'exact' | 'normalized' | 'fuzzy' = 'fuzzy';
      if (comparison.confidence >= exactMatchThreshold) {
        matchType = targetName.toLowerCase().trim() === employer.name.toLowerCase().trim() ? 'exact' : 'normalized';
      }
      
      results.push({
        id: employer.id,
        name: employer.name,
        address,
        similarity: comparison.confidence,
        matchType,
        reasons: comparison.reasons
      });
    }
  }
  
  // Sort by similarity (highest first)
  results.sort((a, b) => b.similarity - a.similarity);
  
  // Limit results
  const limitedResults = results.slice(0, maxResults);
  
  // Separate exact and similar matches
  const exactMatches = limitedResults.filter(r => r.similarity >= exactMatchThreshold);
  const similarMatches = limitedResults.filter(r => r.similarity < exactMatchThreshold);
  
  return {
    exactMatches,
    similarMatches,
    hasExactMatch: exactMatches.length > 0,
    hasSimilarMatches: similarMatches.length > 0
  };
}

/**
 * Generate search variations for a company name to improve matching
 */
export function generateSearchVariations(name: string): string[] {
  const variations = new Set<string>();
  
  // Original name
  variations.add(name.trim());
  
  // Normalized version
  const normalized = normalizeEmployerName(name);
  if (normalized !== name.toLowerCase().trim()) {
    variations.add(normalized);
  }
  
  // With and without common suffixes
  const withoutSuffixes = normalizeEmployerName(name);
  variations.add(withoutSuffixes + ' pty ltd');
  variations.add(withoutSuffixes + ' limited');
  variations.add(withoutSuffixes + ' group');
  
  // Remove duplicates and empty strings
  return Array.from(variations).filter(v => v.length > 0);
}
