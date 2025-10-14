/**
 * Fuzzy matching utilities for employer names
 * This is a simplified wrapper around the more comprehensive employerMatching module
 */

export interface EmployerMatch {
  id: string;
  name: string;
  confidence: 'exact' | 'high' | 'medium' | 'low';
}

interface Employer {
  id: string;
  name: string;
  [key: string]: any;
}

import { normalizeEmployerName } from '@/lib/employers/normalize';

// Normalize company names for better matching
const normalizeCompanyName = (name: string): string =>
  normalizeEmployerName(name).normalized;

// Calculate similarity between two strings using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  // If either string is empty, similarity is 0 (not 1.0!)
  // This prevents false matches when normalization produces empty strings
  if (longer.length === 0 || shorter.length === 0) return 0.0;

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

  // If either normalized name is empty, return 0 (no match)
  // This prevents false matches from over-aggressive normalization
  if (!normalizedQuery || !normalizedTarget || normalizedQuery.length === 0 || normalizedTarget.length === 0) {
    return 0.0;
  }

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
 * Find the best matching employer from a list of employers
 * This is a synchronous, client-side version of the matching algorithm
 */
export function findBestEmployerMatch(
  companyName: string,
  employers: Employer[]
): EmployerMatch | null {
  if (!companyName || companyName.trim().length === 0 || !employers || employers.length === 0) {
    return null;
  }

  // Score all matches
  const scoredMatches = employers.map(employer => {
    const score = calculateMatchScore(companyName, employer.name);
    return {
      id: employer.id,
      name: employer.name,
      confidence: getConfidenceLevel(score),
      score: score
    };
  });

  // Sort by score descending
  scoredMatches.sort((a, b) => b.score - a.score);

  // Return the best match if it meets minimum threshold (0.70 for 'medium')
  const bestMatch = scoredMatches[0];
  if (bestMatch && bestMatch.score >= 0.70) {
    return {
      id: bestMatch.id,
      name: bestMatch.name,
      confidence: bestMatch.confidence
    };
  }

  return null;
}

