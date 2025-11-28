/**
 * Utilities for API request parameter handling.
 */
export function parseBooleanParam(value: string | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return false
}

