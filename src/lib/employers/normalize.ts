const DEFAULT_SUFFIXES = [
  'PTY LTD',
  'PTY. LTD.',
  'PROPRIETARY LIMITED',
  'LIMITED',
  'LTD',
  'INCORPORATED',
  'INC',
  'CORPORATION',
  'CORP',
  'COMPANY',
  'CO',
  'GROUP',
  'HOLDINGS',
  'ENTERPRISES',
  'SERVICES',
  'SOLUTIONS',
  'TRUST',
  'PLC',
  'LLC',
  'LLP',
  'BV',
  'GMBH',
  'SARL'
]

const DEFAULT_PREFIXES = ['THE', 'A', 'AN']

const TRADING_KEYWORDS = ['T/A', 'TRADING AS', 'ATF', 'AS TRUSTEE FOR']

export interface NormalizeEmployerNameOptions {
  suffixes?: string[]
  prefixes?: string[]
  preserveSuffixTokens?: string[]
  allowAcronymLowerBound?: number
}

export interface NormalizedEmployerName {
  normalized: string
  tokens: string[]
  raw: string
}

export function normalizeEmployerName(
  input: string,
  options: NormalizeEmployerNameOptions = {}
): NormalizedEmployerName {
  const value = input ?? ''
  const suffixes = (options.suffixes || DEFAULT_SUFFIXES).map((s) => s.toUpperCase())
  const prefixes = (options.prefixes || DEFAULT_PREFIXES).map((p) => p.toUpperCase())
  const preserveTokens = (options.preserveSuffixTokens || ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT', 'NZ']).map((p) => p.toUpperCase())
  const acronymMinLength = options.allowAcronymLowerBound ?? 2

  let working = value.trim()
  if (!working) {
    return { normalized: '', tokens: [], raw: value }
  }

  working = removeTradingSegments(working)
  working = normalizeUnicode(working)
  working = working.toUpperCase()
  working = replaceConnectors(working)
  working = working.replace(/[^A-Z0-9&\s]/g, ' ')
  working = working.replace(/\s+/g, ' ').trim()

  working = stripPrefixes(working, prefixes)
  working = stripSuffixes(working, suffixes, preserveTokens)

  const tokens = working
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= acronymMinLength || preserveTokens.includes(token) || token === '&')

  const normalized = tokens.join(' ')
  return { normalized, tokens, raw: value }
}

function normalizeUnicode(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

function replaceConnectors(value: string): string {
  return value
    .replace(/\bAND\b/g, ' & ')
    .replace(/\+/g, ' & ')
    .replace(/\s*&\s*/g, ' & ')
}

function stripPrefixes(value: string, prefixes: string[]): string {
  let result = value
  for (const prefix of prefixes) {
    if (result.startsWith(`${prefix} `) && result.split(' ').length > 1) {
      result = result.slice(prefix.length + 1)
      break
    }
  }
  return result.trim()
}

function stripSuffixes(value: string, suffixes: string[], preserveTokens: string[]): string {
  let result = value

  let changed = true
  while (changed && result.length > 0) {
    changed = false
    for (const suffix of suffixes) {
      if (preserveTokens.includes(suffix)) continue

      // Don't strip if it would leave empty string
      if (result === suffix) {
        // Only strip if it's a common suffix and not the entire company name
        const commonStripableSuffixes = ['PTY LTD', 'PTY. LTD.', 'LIMITED', 'LTD', 'PROPRIETARY LIMITED',
                                         'INCORPORATED', 'INC', 'CORPORATION', 'CORP',
                                         'GROUP', 'HOLDINGS', 'ENTERPRISES', 'SERVICES',
                                         'SOLUTIONS', 'TRUST', 'PLC', 'LLC', 'LLP', 'BV', 'GMBH', 'SARL'];
        if (!commonStripableSuffixes.includes(suffix)) {
          // Don't strip single-word suffixes that are the entire name (like "CO", "COMPANY")
          break;
        }
        result = ''
        changed = true
        break
      }

      if (result.endsWith(` ${suffix}`)) {
        const remaining = result.slice(0, result.length - (suffix.length + 1)).trim()
        // Don't strip suffix if it would leave us with nothing or just a prefix/article
        if (remaining.length === 0 || ['THE', 'A', 'AN'].includes(remaining)) {
          continue;
        }
        result = remaining
        changed = true
        break
      }
    }
  }

  return result.trim()
}

function removeTradingSegments(value: string): string {
  let result = value
  for (const keyword of TRADING_KEYWORDS) {
    const index = result.toUpperCase().indexOf(keyword)
    if (index !== -1) {
      const primary = result.slice(0, index).trim()
      if (primary.length > 0) {
        result = primary
      }
    }
  }
  return result
}

export function normalizeEmployerNameForSql(value: string): string {
  return normalizeEmployerName(value).normalized
}

export function normalizeEmployerNameTokens(value: string): string[] {
  return normalizeEmployerName(value).tokens
}


