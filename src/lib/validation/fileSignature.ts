/**
 * File signature (magic byte) validation
 *
 * Validates uploaded files by checking their actual file content signatures
 * to prevent malicious files disguised with fake extensions.
 *
 * @see https://en.wikipedia.org/wiki/List_of_file_signatures
 */

export interface FileSignature {
  mimeType: string
  extension: string
  signature: number[][]  // Array of possible signatures (byte arrays)
  offset?: number        // Offset where signature starts (default 0)
}

/**
 * Known file signatures for validation
 */
export const FILE_SIGNATURES: Record<string, FileSignature> = {
  PDF: {
    mimeType: 'application/pdf',
    extension: 'pdf',
    signature: [
      [0x25, 0x50, 0x44, 0x46], // %PDF
    ],
  },
  PNG: {
    mimeType: 'image/png',
    extension: 'png',
    signature: [
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG signature
    ],
  },
  JPEG: {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    signature: [
      [0xFF, 0xD8, 0xFF, 0xE0], // JPEG JFIF
      [0xFF, 0xD8, 0xFF, 0xE1], // JPEG Exif
      [0xFF, 0xD8, 0xFF, 0xE2], // JPEG
      [0xFF, 0xD8, 0xFF, 0xE3], // JPEG
      [0xFF, 0xD8, 0xFF, 0xE8], // JPEG SPIFF
      [0xFF, 0xD8, 0xFF, 0xDB], // JPEG raw
    ],
  },
  // XLSX, DOCX, PPTX are all ZIP-based formats
  XLSX: {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    signature: [
      [0x50, 0x4B, 0x03, 0x04], // ZIP format (PK..)
      [0x50, 0x4B, 0x05, 0x06], // ZIP format (empty)
      [0x50, 0x4B, 0x07, 0x08], // ZIP format (spanned)
    ],
  },
  DOCX: {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    signature: [
      [0x50, 0x4B, 0x03, 0x04],
      [0x50, 0x4B, 0x05, 0x06],
      [0x50, 0x4B, 0x07, 0x08],
    ],
  },
  ZIP: {
    mimeType: 'application/zip',
    extension: 'zip',
    signature: [
      [0x50, 0x4B, 0x03, 0x04],
      [0x50, 0x4B, 0x05, 0x06],
      [0x50, 0x4B, 0x07, 0x08],
    ],
  },
  // CSV files don't have a magic byte signature - they're plain text
  // We validate them by checking for valid CSV content structure
}

/**
 * Read the first N bytes from a File or Buffer
 */
async function readFirstBytes(
  input: File | Buffer | Uint8Array,
  numBytes: number = 16
): Promise<Uint8Array> {
  if (input instanceof Buffer) {
    return new Uint8Array(input.slice(0, numBytes))
  }

  if (input instanceof Uint8Array) {
    return input.slice(0, numBytes)
  }

  // File object
  const arrayBuffer = await input.slice(0, numBytes).arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

/**
 * Check if bytes match a signature pattern
 */
function matchesSignature(bytes: Uint8Array, signature: number[], offset: number = 0): boolean {
  if (bytes.length < signature.length + offset) {
    return false
  }

  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) {
      return false
    }
  }

  return true
}

/**
 * Validate file signature against expected type
 */
export async function validateFileSignature(
  input: File | Buffer | Uint8Array,
  expectedTypes: FileSignature[]
): Promise<{ valid: boolean; detectedType?: FileSignature; error?: string }> {
  try {
    // Read first 16 bytes (enough for most signatures)
    const bytes = await readFirstBytes(input, 16)

    // Check against each expected type
    for (const expectedType of expectedTypes) {
      const offset = expectedType.offset || 0

      // Check all possible signatures for this type
      for (const signature of expectedType.signature) {
        if (matchesSignature(bytes, signature, offset)) {
          return {
            valid: true,
            detectedType: expectedType,
          }
        }
      }
    }

    // No match found
    const bytesHex = Array.from(bytes.slice(0, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')

    return {
      valid: false,
      error: `File signature does not match expected type(s). Detected bytes: ${bytesHex}`,
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to read file signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Validate PDF file signature
 */
export async function validatePdfSignature(
  input: File | Buffer | Uint8Array
): Promise<{ valid: boolean; error?: string }> {
  const result = await validateFileSignature(input, [FILE_SIGNATURES.PDF])
  return {
    valid: result.valid,
    error: result.error,
  }
}

/**
 * Validate image file signature (PNG or JPEG)
 */
export async function validateImageSignature(
  input: File | Buffer | Uint8Array
): Promise<{ valid: boolean; detectedType?: 'png' | 'jpeg'; error?: string }> {
  const result = await validateFileSignature(input, [
    FILE_SIGNATURES.PNG,
    FILE_SIGNATURES.JPEG,
  ])

  return {
    valid: result.valid,
    detectedType: result.detectedType?.extension === 'png' ? 'png' :
                  result.detectedType?.extension === 'jpg' ? 'jpeg' : undefined,
    error: result.error,
  }
}

/**
 * Validate Excel file signature (XLSX)
 * Note: XLSX files are ZIP-based, so this checks for ZIP signature
 * Additional validation should verify the internal structure
 */
export async function validateExcelSignature(
  input: File | Buffer | Uint8Array
): Promise<{ valid: boolean; error?: string }> {
  const result = await validateFileSignature(input, [FILE_SIGNATURES.XLSX])
  return {
    valid: result.valid,
    error: result.error,
  }
}

/**
 * Validate CSV file content
 * CSVs are plain text and don't have magic bytes, so we validate structure
 */
export async function validateCsvContent(
  input: File | Buffer | Uint8Array
): Promise<{ valid: boolean; error?: string }> {
  try {
    let text: string

    if (input instanceof File) {
      text = await input.text()
    } else if (input instanceof Buffer) {
      text = input.toString('utf-8')
    } else {
      text = new TextDecoder('utf-8').decode(input)
    }

    // Basic CSV validation
    // 1. Should have at least one line
    const lines = text.trim().split('\n')
    if (lines.length === 0) {
      return { valid: false, error: 'CSV file is empty' }
    }

    // 2. First line should look like CSV headers (contains commas or is single column)
    const firstLine = lines[0].trim()
    if (firstLine.length === 0) {
      return { valid: false, error: 'CSV file has empty first line' }
    }

    // 3. Check for valid text encoding (no binary data)
    const binaryPattern = /[\x00-\x08\x0B-\x0C\x0E-\x1F]/
    if (binaryPattern.test(text.slice(0, 1000))) {
      return { valid: false, error: 'File contains binary data, not a valid CSV' }
    }

    // 4. Optionally check that it doesn't start with suspicious content
    const suspiciousPatterns = [
      /^<\?php/i,           // PHP code
      /^<script/i,          // JavaScript
      /^<html/i,            // HTML
      /^\x89PNG/,           // PNG
      /^%PDF/,              // PDF
      /^PK\x03\x04/,        // ZIP
      /^MZ/,                // Windows executable
      /^\x7fELF/,           // Linux executable
    ]

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text.slice(0, 100))) {
        return { valid: false, error: 'File does not appear to be a CSV (suspicious content detected)' }
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate CSV content: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Comprehensive file validation with detailed error messages
 */
export interface FileValidationResult {
  valid: boolean
  detectedType?: string
  expectedType: string
  error?: string
  securityRisk?: string
}

export async function validateUploadedFile(
  file: File | Buffer | Uint8Array,
  expectedMimeType: string,
  fileName?: string
): Promise<FileValidationResult> {
  const result: FileValidationResult = {
    valid: false,
    expectedType: expectedMimeType,
  }

  // Determine expected file type
  let validationResult: { valid: boolean; error?: string; detectedType?: any }

  switch (expectedMimeType) {
    case 'application/pdf':
      validationResult = await validatePdfSignature(file)
      result.detectedType = validationResult.valid ? 'application/pdf' : 'unknown'
      break

    case 'image/png':
    case 'image/jpeg':
      const imageResult = await validateImageSignature(file)
      validationResult = imageResult
      result.detectedType = imageResult.detectedType ? `image/${imageResult.detectedType}` : 'unknown'
      break

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      validationResult = await validateExcelSignature(file)
      result.detectedType = validationResult.valid ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'unknown'
      break

    case 'text/csv':
    case 'application/csv':
      validationResult = await validateCsvContent(file)
      result.detectedType = validationResult.valid ? 'text/csv' : 'unknown'
      break

    default:
      return {
        ...result,
        error: `Unsupported file type: ${expectedMimeType}`,
      }
  }

  if (validationResult.valid) {
    result.valid = true
  } else {
    result.error = validationResult.error
    result.securityRisk = 'File signature does not match expected type. This could indicate a malicious file with a spoofed extension.'
  }

  return result
}
