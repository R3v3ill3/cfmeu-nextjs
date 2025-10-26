'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface AliasValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  conflicts: AliasConflict[]
  suggestions: AliasSuggestion[]
}

interface ValidationError {
  type: 'format' | 'length' | 'character' | 'duplicate'
  message: string
  field?: string
}

interface ValidationWarning {
  type: 'similarity' | 'formatting' | 'case'
  message: string
  suggestion?: string
}

interface AliasConflict {
  employerId: string
  employerName: string
  alias: string
  confidence: 'high' | 'medium' | 'low'
  isActive: boolean
}

interface AliasSuggestion {
  alias: string
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

interface UseAliasValidationOptions {
  employerId?: string
  skipConflictCheck?: boolean
  checkSimilarity?: boolean
  similarityThreshold?: number
}

export function useAliasValidation(options: UseAliasValidationOptions = {}) {
  const {
    employerId,
    skipConflictCheck = false,
    checkSimilarity = true,
    similarityThreshold = 0.8
  } = options

  const [isValidating, setIsValidating] = useState(false)
  const [validationCache, setValidationCache] = useState<Map<string, AliasValidationResult>>(new Map())

  // Normalize alias for comparison
  const normalizeAlias = useCallback((alias: string): string => {
    return alias
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.-]/g, '') // Remove special characters except dots and hyphens
      .replace(/\./g, ' ') // Replace dots with spaces
      .replace(/-/g, ' ') // Replace hyphens with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace again
      .trim()
  }, [])

  // Validate alias format
  const validateFormat = useCallback((alias: string): ValidationError[] => {
    const errors: ValidationError[] = []

    if (!alias || alias.trim().length === 0) {
      errors.push({
        type: 'format',
        message: 'Alias cannot be empty'
      })
      return errors
    }

    const trimmed = alias.trim()

    if (trimmed.length < 2) {
      errors.push({
        type: 'length',
        message: 'Alias must be at least 2 characters long'
      })
    }

    if (trimmed.length > 200) {
      errors.push({
        type: 'length',
        message: 'Alias cannot exceed 200 characters'
      })
    }

    // Check for invalid characters
    const invalidChars = /[<>'"&]/
    if (invalidChars.test(trimmed)) {
      errors.push({
        type: 'character',
        message: 'Alias contains invalid characters'
      })
    }

    // Check for only whitespace
    if (!trimmed.replace(/\s/g, '').length) {
      errors.push({
        type: 'format',
        message: 'Alias cannot contain only whitespace'
      })
    }

    return errors
  }, [])

  // Check for duplicate aliases
  const checkDuplicate = useCallback(async (alias: string): Promise<{
    isDuplicate: boolean
    employerId?: string
    employerName?: string
  }> => {
    try {
      const normalized = normalizeAlias(alias)

      const { data, error } = await supabase
        .from('employer_aliases')
        .select(`
          employer_id,
          alias,
          employers!employer_aliases_employer_id_fkey (name)
        `)
        .eq('alias_normalized', normalized)
        .eq('is_authoritative', true)

      if (error) throw error

      if (data && data.length > 0) {
        // Check if the duplicate is for the same employer
        const sameEmployer = data.find(d => d.employer_id === employerId)
        if (sameEmployer) {
          return {
            isDuplicate: true,
            employerId: sameEmployer.employer_id,
            employerName: sameEmployer.employers?.name
          }
        }

        // Find different employer with this alias
        const differentEmployer = data.find(d => d.employer_id !== employerId)
        if (differentEmployer) {
          return {
            isDuplicate: true,
            employerId: differentEmployer.employer_id,
            employerName: differentEmployer.employers?.name
          }
        }
      }

      return { isDuplicate: false }
    } catch (error) {
      console.error('Failed to check for duplicate alias:', error)
      return { isDuplicate: false }
    }
  }, [employerId, normalizeAlias])

  // Check for conflicts with other employers
  const checkConflicts = useCallback(async (alias: string): Promise<AliasConflict[]> => {
    if (skipConflictCheck || !employerId) return []

    try {
      const normalized = normalizeAlias(alias)
      const conflicts: AliasConflict[] = []

      // Check for exact matches
      const { data: exactMatches, error: exactError } = await supabase
        .from('employer_aliases')
        .select(`
          employer_id,
          alias,
          is_authoritative,
          employers!employer_aliases_employer_id_fkey (name)
        `)
        .eq('alias_normalized', normalized)
        .neq('employer_id', employerId)
        .eq('is_authoritative', true)

      if (exactError) throw exactError

      if (exactMatches) {
        exactMatches.forEach(match => {
          conflicts.push({
            employerId: match.employer_id,
            employerName: match.employers?.name || 'Unknown',
            alias: match.alias,
            confidence: 'high',
            isActive: match.is_authoritative
          })
        })
      }

      // Check for similar aliases if similarity checking is enabled
      if (checkSimilarity) {
        const { data: allAliases, error: allError } = await supabase
          .from('employer_aliases')
          .select(`
            employer_id,
            alias,
            is_authoritative,
            employers!employer_aliases_employer_id_fkey (name)
          `)
          .neq('employer_id', employerId)
          .eq('is_authoritative', true)
          .limit(100) // Limit for performance

        if (allError) throw allError

        if (allAliases) {
          allAliases.forEach(otherAlias => {
            const similarity = calculateSimilarity(alias, otherAlias.alias)
            if (similarity >= similarityThreshold && similarity < 1.0) {
              // Check if we already have this conflict
              const exists = conflicts.some(c =>
                c.employerId === otherAlias.employer_id && c.alias === otherAlias.alias
              )

              if (!exists) {
                conflicts.push({
                  employerId: otherAlias.employer_id,
                  employerName: otherAlias.employers?.name || 'Unknown',
                  alias: otherAlias.alias,
                  confidence: similarity > 0.9 ? 'high' : similarity > 0.7 ? 'medium' : 'low',
                  isActive: otherAlias.is_authoritative
                })
              }
            }
          })
        }
      }

      return conflicts
    } catch (error) {
      console.error('Failed to check for conflicts:', error)
      return []
    }
  }, [employerId, skipConflictCheck, checkSimilarity, similarityThreshold, normalizeAlias])

  // Calculate similarity between two strings
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = normalizeAlias(str1)
    const s2 = normalizeAlias(str2)

    if (s1 === s2) return 1.0

    // Levenshtein distance for more accurate similarity
    const distance = levenshteinDistance(s1, s2)
    const maxLength = Math.max(s1.length, s2.length)

    return maxLength === 0 ? 1.0 : 1 - (distance / maxLength)
  }

  // Calculate Levenshtein distance
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null)
    )

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  // Generate suggestions for improving the alias
  const generateSuggestions = useCallback((alias: string): AliasSuggestion[] => {
    const suggestions: AliasSuggestion[] = []
    const trimmed = alias.trim()

    // Suggest proper capitalization
    if (trimmed !== trimmed.toLowerCase() && trimmed !== toTitleCase(trimmed)) {
      suggestions.push({
        alias: toTitleCase(trimmed),
        reason: 'Consider using proper capitalization',
        confidence: 'medium'
      })
    }

    // Suggest removing extra whitespace
    if (/\s{2,}/.test(trimmed)) {
      suggestions.push({
        alias: trimmed.replace(/\s+/g, ' ').trim(),
        reason: 'Remove extra whitespace',
        confidence: 'high'
      })
    }

    // Suggest removing common suffixes/prefixes that might be noise
    const noisePatterns = /^(the |and |& |a |an )|(.{0,3} co$|.{0,3} corp$|.{0,3} inc$|.{0,3} ltd$|.{0,3} pty$)/i
    if (noisePatterns.test(trimmed.toLowerCase())) {
      const cleaned = trimmed
        .replace(/^(the |and |& |a |an )/i, '')
        .replace(/\s+(co|corp|inc|ltd|pty)$/i, '')
        .trim()

      if (cleaned && cleaned !== trimmed) {
        suggestions.push({
          alias: cleaned,
          reason: 'Consider removing common business suffixes/prefixes',
          confidence: 'low'
        })
      }
    }

    return suggestions
  }, [])

  // Convert to title case
  const toTitleCase = (str: string): string => {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase())
  }

  // Main validation function
  const validateAlias = useCallback(async (alias: string): Promise<AliasValidationResult> => {
    const cacheKey = `${employerId}-${alias}`

    // Check cache first
    if (validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey)!
    }

    setIsValidating(true)

    try {
      const errors: ValidationError[] = validateFormat(alias)
      const warnings: ValidationWarning[] = []
      const conflicts: AliasConflict[] = []
      const suggestions: AliasSuggestion[] = []

      // Early return if format validation failed
      if (errors.length > 0) {
        const result = { isValid: false, errors, warnings, conflicts, suggestions }
        setValidationCache(prev => new Map(prev).set(cacheKey, result))
        return result
      }

      // Check for duplicates
      if (!skipConflictCheck) {
        const duplicateCheck = await checkDuplicate(alias)
        if (duplicateCheck.isDuplicate && duplicateCheck.employerId !== employerId) {
          errors.push({
            type: 'duplicate',
            message: `This alias is already used by "${duplicateCheck.employerName}"`
          })
        }
      }

      // Check for conflicts
      const conflictCheck = await checkConflicts(alias)
      conflicts.push(...conflictCheck)

      // Add warning if there are conflicts
      if (conflicts.length > 0) {
        warnings.push({
          type: 'similarity',
          message: `This alias is similar to existing aliases for ${conflicts.length} other employer(s)`
        })
      }

      // Add formatting warnings
      if (alias !== alias.trim()) {
        warnings.push({
          type: 'formatting',
          message: 'Alias has leading or trailing whitespace',
          suggestion: alias.trim()
        })
      }

      if (alias !== alias.toLowerCase() && alias === toTitleCase(alias)) {
        warnings.push({
          type: 'case',
          message: 'Alias uses title case - consider lowercase for better matching',
          suggestion: alias.toLowerCase()
        })
      }

      // Generate suggestions
      suggestions.push(...generateSuggestions(alias))

      const result: AliasValidationResult = {
        isValid: errors.length === 0 && conflicts.length === 0,
        errors,
        warnings,
        conflicts,
        suggestions
      }

      // Cache the result
      setValidationCache(prev => new Map(prev).set(cacheKey, result))

      return result
    } catch (error) {
      console.error('Alias validation failed:', error)
      return {
        isValid: false,
        errors: [{ type: 'format', message: 'Validation failed due to an error' }],
        warnings: [],
        conflicts: [],
        suggestions: []
      }
    } finally {
      setIsValidating(false)
    }
  }, [
    employerId,
    skipConflictCheck,
    validateFormat,
    checkDuplicate,
    checkConflicts,
    generateSuggestions,
    validationCache
  ])

  // Validate multiple aliases at once
  const validateMultipleAliases = useCallback(async (aliases: string[]): Promise<AliasValidationResult[]> => {
    const results = await Promise.all(
      aliases.map(alias => validateAlias(alias))
    )
    return results
  }, [validateAlias])

  // Clear validation cache
  const clearCache = useCallback(() => {
    setValidationCache(new Map())
  }, [])

  return {
    validateAlias,
    validateMultipleAliases,
    isValidating,
    clearCache,
    normalizeAlias,
    calculateSimilarity
  }
}