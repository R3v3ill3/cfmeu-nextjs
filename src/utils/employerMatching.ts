import { supabase } from '@/integrations/supabase/client';

export interface EmployerMatchingOptions {
  confidenceThreshold: number;
  allowFuzzyMatching: boolean;
  requireUserConfirmation: boolean;
}

export interface EmployerMatch {
  id: string;
  name: string;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  distance: number;
  score: number; // Raw similarity score 0-1
}

export interface EmployerMatchResult {
  match: EmployerMatch | null;
  candidates: EmployerMatch[]; // Alternative matches for user review
  searchQuery: string;
  normalizedQuery: string;
}

// Normalize company names for better matching
function normalizeCompanyName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common business suffixes
    .replace(/\b(pty\s*ltd?|limited|ltd|inc|incorporated|corp|corporation|llc|llp)\b/gi, '')
    // Remove common words that don't help with matching
    .replace(/\b(the|and|&|of|for|in|at|to|with|by)\b/gi, '')
    // Remove special characters except spaces and hyphens
    .replace(/[^\w\s\-]/g, '')
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate similarity between two strings using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Enhanced token-based matching for better fuzzy search
function tokenBasedSimilarity(query: string, target: string): number {
  const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const targetTokens = target.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;
  
  let matches = 0;
  for (const queryToken of queryTokens) {
    for (const targetToken of targetTokens) {
      if (queryToken === targetToken) {
        matches += 1;
      } else if (targetToken.includes(queryToken) || queryToken.includes(targetToken)) {
        matches += 0.7;
      } else if (calculateSimilarity(queryToken, targetToken) > 0.8) {
        matches += 0.5;
      }
    }
  }
  
  return matches / Math.max(queryTokens.length, targetTokens.length);
}

// Create a comprehensive matching score combining multiple techniques
function calculateMatchScore(query: string, target: string): number {
  const normalizedQuery = normalizeCompanyName(query);
  const normalizedTarget = normalizeCompanyName(target);
  
  // Exact match gets perfect score
  if (normalizedQuery === normalizedTarget) return 1.0;
  
  // Multiple scoring methods
  const levenshteinScore = calculateSimilarity(normalizedQuery, normalizedTarget);
  const tokenScore = tokenBasedSimilarity(query, target);
  const containsScore = normalizedTarget.includes(normalizedQuery) || normalizedQuery.includes(normalizedTarget) ? 0.9 : 0;
  
  // Weighted combination
  return Math.max(
    levenshteinScore * 0.4 + tokenScore * 0.5 + containsScore * 0.1,
    containsScore // Ensure substring matches get good scores
  );
}

// Convert score to confidence level
function getConfidenceLevel(score: number): EmployerMatch['confidence'] {
  if (score >= 0.95) return 'exact';
  if (score >= 0.85) return 'high';
  if (score >= 0.70) return 'medium';
  return 'low';
}

/**
 * Advanced employer matching with multiple algorithms and confidence scoring
 */
export async function matchEmployerAdvanced(
  companyName: string,
  options: EmployerMatchingOptions = {
    confidenceThreshold: 0.75,
    allowFuzzyMatching: true,
    requireUserConfirmation: false
  }
): Promise<EmployerMatchResult> {
  if (!companyName || companyName.trim().length === 0) {
    return {
      match: null,
      candidates: [],
      searchQuery: companyName,
      normalizedQuery: ''
    };
  }

  const normalizedQuery = normalizeCompanyName(companyName);
  
  try {
    // First, try exact match on normalized names
    const { data: exactMatches, error: exactError } = await supabase
      .from('employers')
      .select('id, name, address_line_1, suburb, state')
      .ilike('name', companyName.trim());

    if (exactError) {
      console.error('Exact match query failed:', exactError);
    }

    // Then do fuzzy search using token-based approach
    const tokens = normalizedQuery.split(/\s+/).filter(t => t.length >= 2);
    let fuzzyMatches: any[] = [];

    if (options.allowFuzzyMatching && tokens.length > 0) {
      // Build OR query for fuzzy matching
      const orParts: string[] = [];
      tokens.forEach(token => {
        if (token.length >= 2) {
          orParts.push(`name.ilike.*${token}*`);
        }
      });

      if (orParts.length > 0) {
        const orQuery = orParts.join(',');
        const { data: fuzzyData, error: fuzzyError } = await supabase
          .from('employers')
          .select('id, name, address_line_1, suburb, state')
          .or(orQuery)
          .limit(50); // Reasonable limit for performance

        if (fuzzyError) {
          console.warn('Fuzzy search failed:', fuzzyError);
        } else {
          fuzzyMatches = fuzzyData || [];
        }
      }
    }

    // Combine and deduplicate results
    const allMatches = [...(exactMatches || []), ...fuzzyMatches];
    const uniqueMatches = allMatches.filter((match, index, arr) => 
      index === arr.findIndex(m => m.id === match.id)
    );

    // Score all matches
    const scoredMatches: EmployerMatch[] = uniqueMatches.map(employer => {
      const score = calculateMatchScore(companyName, employer.name);
      return {
        id: employer.id,
        name: employer.name,
        confidence: getConfidenceLevel(score),
        distance: 1 - score,
        score: score
      };
    });

    // Sort by score descending
    scoredMatches.sort((a, b) => b.score - a.score);

    // Find the best match that meets threshold
    const bestMatch = scoredMatches.find(match => match.score >= options.confidenceThreshold);
    
    // Return candidates for user review (top 5, excluding the selected match)
    const candidates = scoredMatches
      .filter(match => match.id !== bestMatch?.id)
      .slice(0, 5);

    return {
      match: bestMatch || null,
      candidates,
      searchQuery: companyName,
      normalizedQuery
    };

  } catch (error) {
    console.error('Employer matching failed:', error);
    return {
      match: null,
      candidates: [],
      searchQuery: companyName,
      normalizedQuery
    };
  }
}

/**
 * Batch match multiple employers efficiently
 */
export async function batchMatchEmployers(
  companyNames: string[],
  options: EmployerMatchingOptions
): Promise<Record<string, EmployerMatchResult>> {
  const results: Record<string, EmployerMatchResult> = {};
  
  // Process in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < companyNames.length; i += batchSize) {
    const batch = companyNames.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (companyName) => {
        const result = await matchEmployerAdvanced(companyName, options);
        return { companyName, result };
      })
    );
    
    batchResults.forEach(({ companyName, result }) => {
      results[companyName] = result;
    });
    
    // Small delay between batches to be respectful of database
    if (i + batchSize < companyNames.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Get matching statistics for a batch of results
 */
export function getMatchingStatistics(results: Record<string, EmployerMatchResult>) {
  const total = Object.keys(results).length;
  let exactMatches = 0;
  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;
  let noMatches = 0;

  Object.values(results).forEach(result => {
    if (!result.match) {
      noMatches++;
    } else {
      switch (result.match.confidence) {
        case 'exact':
          exactMatches++;
          break;
        case 'high':
          highConfidence++;
          break;
        case 'medium':
          mediumConfidence++;
          break;
        case 'low':
          lowConfidence++;
          break;
      }
    }
  });

  return {
    total,
    exactMatches,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    noMatches,
    matchedTotal: total - noMatches,
    matchRate: total > 0 ? ((total - noMatches) / total) * 100 : 0
  };
}
