/**
 * Idempotency utilities for preventing duplicate job creation
 *
 * Generates deterministic keys from request content to ensure exactly-once semantics
 * for batch uploads and scraper jobs, even with network retries or concurrent requests.
 */

/**
 * Generates a deterministic idempotency key for batch uploads
 *
 * Key is derived from immutable content characteristics:
 * - User ID (who is uploading)
 * - File name and size (content identity)
 * - Total pages (structure)
 * - Project definitions (what will be created)
 *
 * @param userId - ID of the user creating the batch
 * @param fileName - Original file name
 * @param fileSize - File size in bytes
 * @param totalPages - Total number of pages in the PDF
 * @param projectDefinitions - Array of project definitions with page ranges
 * @returns SHA-256 hash as hex string
 */
export async function generateBatchIdempotencyKey(
  userId: string,
  fileName: string,
  fileSize: number,
  totalPages: number,
  projectDefinitions: any[]
): Promise<string> {
  // Sort project definitions to ensure deterministic ordering
  const sortedDefs = [...projectDefinitions].sort((a, b) => {
    // Sort by start page, then end page
    if (a.startPage !== b.startPage) {
      return a.startPage - b.startPage
    }
    return a.endPage - b.endPage
  })

  // Create canonical string representation
  const canonical = JSON.stringify({
    userId,
    fileName,
    fileSize,
    totalPages,
    projects: sortedDefs.map(def => ({
      startPage: def.startPage,
      endPage: def.endPage,
      mode: def.mode,
      projectId: def.projectId || null,
      tentativeName: def.tentativeName || null,
    }))
  })

  // Generate SHA-256 hash
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return `batch_${hashHex}`
}

/**
 * Generates a deterministic idempotency key for scraper jobs
 *
 * Key is derived from:
 * - User ID (who created the job)
 * - Scan ID (unique scan identifier)
 * - Job type (mapping_sheet_scan, etc.)
 * - Key payload fields (fileUrl, uploadMode, selectedPages)
 *
 * @param userId - ID of the user creating the job
 * @param scanId - ID of the mapping sheet scan
 * @param jobType - Type of scraper job
 * @param payload - Job payload with fileUrl, uploadMode, selectedPages
 * @returns SHA-256 hash as hex string
 */
export async function generateJobIdempotencyKey(
  userId: string,
  scanId: string,
  jobType: string,
  payload: {
    fileUrl?: string
    uploadMode?: string
    selectedPages?: number[]
    [key: string]: any
  }
): Promise<string> {
  // Extract and sort selectedPages for deterministic ordering
  const selectedPages = payload.selectedPages
    ? [...payload.selectedPages].sort((a, b) => a - b)
    : []

  // Create canonical string representation
  const canonical = JSON.stringify({
    userId,
    scanId,
    jobType,
    fileUrl: payload.fileUrl,
    uploadMode: payload.uploadMode,
    selectedPages,
  })

  // Generate SHA-256 hash
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return `job_${hashHex}`
}

/**
 * Generates a simple idempotency key for general use
 *
 * @param parts - Array of strings/numbers to include in the key
 * @returns SHA-256 hash as hex string
 */
export async function generateIdempotencyKey(
  ...parts: (string | number | boolean | null | undefined)[]
): Promise<string> {
  // Filter out null/undefined and convert to strings
  const canonical = JSON.stringify(
    parts.filter(p => p !== null && p !== undefined)
  )

  // Generate SHA-256 hash
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return hashHex
}

/**
 * Type guard to check if an error is a unique constraint violation
 * Useful for handling idempotency key collisions gracefully
 */
export function isUniqueViolationError(error: any): boolean {
  return (
    error?.code === '23505' || // PostgreSQL unique violation
    error?.message?.toLowerCase().includes('unique') ||
    error?.message?.toLowerCase().includes('duplicate')
  )
}
