/**
 * Client-side file validation utilities
 *
 * Provides basic file signature validation on the client side
 * before uploading to the server. This is a first line of defense,
 * but server-side validation is still required for security.
 */

/**
 * Read first N bytes from a File
 */
async function readFirstBytes(file: File, numBytes: number = 16): Promise<Uint8Array> {
  const arrayBuffer = await file.slice(0, numBytes).arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

/**
 * Check if bytes match a signature pattern
 */
function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) {
    return false
  }

  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) {
      return false
    }
  }

  return true
}

/**
 * Validate CSV file content on client side
 */
export async function validateCsvFile(file: File): Promise<{ valid: boolean; error?: string }> {
  try {
    // Read first 1KB to check for valid CSV structure
    const text = await file.slice(0, 1024).text()

    // Basic validation
    if (text.length === 0) {
      return { valid: false, error: 'CSV file is empty' }
    }

    // Check for binary content (not text)
    const binaryPattern = /[\x00-\x08\x0B-\x0C\x0E-\x1F]/
    if (binaryPattern.test(text)) {
      return { valid: false, error: 'File contains binary data, not a valid CSV' }
    }

    // Check for suspicious content
    const suspiciousPatterns = [
      { pattern: /^<\?php/i, name: 'PHP code' },
      { pattern: /^<script/i, name: 'JavaScript' },
      { pattern: /^<html/i, name: 'HTML' },
      { pattern: /^%PDF/, name: 'PDF' },
      { pattern: /^PK\x03\x04/, name: 'ZIP/Office' },
      { pattern: /^MZ/, name: 'Executable' },
      { pattern: /^\x7fELF/, name: 'Linux executable' },
    ]

    for (const { pattern, name } of suspiciousPatterns) {
      if (pattern.test(text)) {
        return {
          valid: false,
          error: `File does not appear to be a CSV (detected ${name})`,
        }
      }
    }

    // Check that first line has some structure (commas or single column)
    const firstLine = text.split('\n')[0]
    if (!firstLine || firstLine.trim().length === 0) {
      return { valid: false, error: 'CSV file has no header row' }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Validate PDF file signature on client side
 */
export async function validatePdfFile(file: File): Promise<{ valid: boolean; error?: string }> {
  try {
    const bytes = await readFirstBytes(file, 8)

    // PDF signature: %PDF
    const pdfSignature = [0x25, 0x50, 0x44, 0x46]

    if (matchesSignature(bytes, pdfSignature)) {
      return { valid: true }
    }

    // Get hex representation for error message
    const bytesHex = Array.from(bytes.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')

    return {
      valid: false,
      error: `File is not a valid PDF (signature: ${bytesHex}, expected: 25 50 44 46)`,
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Validate image file signature (PNG or JPEG)
 */
export async function validateImageFile(
  file: File
): Promise<{ valid: boolean; type?: 'png' | 'jpeg'; error?: string }> {
  try {
    const bytes = await readFirstBytes(file, 8)

    // PNG signature
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    if (matchesSignature(bytes, pngSignature)) {
      return { valid: true, type: 'png' }
    }

    // JPEG signatures
    const jpegSignatures = [
      [0xFF, 0xD8, 0xFF, 0xE0], // JFIF
      [0xFF, 0xD8, 0xFF, 0xE1], // Exif
      [0xFF, 0xD8, 0xFF, 0xE2],
      [0xFF, 0xD8, 0xFF, 0xE3],
      [0xFF, 0xD8, 0xFF, 0xE8], // SPIFF
      [0xFF, 0xD8, 0xFF, 0xDB], // Raw
    ]

    for (const signature of jpegSignatures) {
      if (matchesSignature(bytes, signature)) {
        return { valid: true, type: 'jpeg' }
      }
    }

    const bytesHex = Array.from(bytes.slice(0, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')

    return {
      valid: false,
      error: `File is not a valid PNG or JPEG (signature: ${bytesHex})`,
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate image: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Validate Excel file signature (XLSX)
 */
export async function validateExcelFile(file: File): Promise<{ valid: boolean; error?: string }> {
  try {
    const bytes = await readFirstBytes(file, 8)

    // ZIP signature (XLSX files are ZIP-based)
    const zipSignatures = [
      [0x50, 0x4B, 0x03, 0x04],
      [0x50, 0x4B, 0x05, 0x06],
      [0x50, 0x4B, 0x07, 0x08],
    ]

    for (const signature of zipSignatures) {
      if (matchesSignature(bytes, signature)) {
        return { valid: true }
      }
    }

    const bytesHex = Array.from(bytes.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')

    return {
      valid: false,
      error: `File is not a valid XLSX (signature: ${bytesHex}, expected ZIP format: 50 4B 03 04)`,
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Generic file type validation
 */
export async function validateFileType(
  file: File,
  expectedType: 'pdf' | 'csv' | 'image' | 'excel'
): Promise<{ valid: boolean; error?: string }> {
  switch (expectedType) {
    case 'pdf':
      return validatePdfFile(file)
    case 'csv':
      return validateCsvFile(file)
    case 'image':
      return validateImageFile(file)
    case 'excel':
      return validateExcelFile(file)
    default:
      return { valid: false, error: 'Unsupported file type' }
  }
}
