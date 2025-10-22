# File Upload Security - Magic Byte Validation

## Overview

This document describes the magic byte (file signature) validation implemented across all file upload endpoints to prevent malicious file uploads.

## Security Problem

File extensions can be easily spoofed. An attacker can:
- Rename `malicious.exe` to `document.pdf`
- Rename `malware.php` to `data.csv`
- Upload files with fake extensions to bypass basic validation

**Solution**: Validate the actual file content by checking the first few bytes (magic bytes/file signature) that identify the file type.

## Implementation

### Server-Side Validation

Location: `/src/lib/validation/fileSignature.ts`

All server-side file upload endpoints now validate file signatures before processing.

#### Supported File Types

| File Type | Magic Bytes | Signature (Hex) |
|-----------|-------------|-----------------|
| PDF | `%PDF` | `25 50 44 46` |
| PNG | PNG header | `89 50 4E 47 0D 0A 1A 0A` |
| JPEG | JFIF/Exif | `FF D8 FF E0` (and variants) |
| XLSX | ZIP format | `50 4B 03 04` (PK..) |
| CSV | Text validation | No magic bytes - content structure validated |

#### API Functions

```typescript
// Validate PDF file
const result = await validatePdfSignature(buffer)
if (!result.valid) {
  return NextResponse.json({ error: result.error }, { status: 400 })
}

// Validate image (PNG or JPEG)
const result = await validateImageSignature(buffer)
if (!result.valid) {
  return NextResponse.json({ error: result.error }, { status: 400 })
}

// Validate Excel (XLSX)
const result = await validateExcelSignature(buffer)

// Validate CSV content (no magic bytes, checks structure)
const result = await validateCsvContent(buffer)

// Generic validation
const result = await validateUploadedFile(file, 'application/pdf', 'document.pdf')
```

### Client-Side Validation

Location: `/src/lib/validation/clientFileValidation.ts`

Client-side validation provides immediate feedback before upload, but **server-side validation is still required** for security.

```typescript
import { validatePdfFile, validateCsvFile } from '@/lib/validation/clientFileValidation'

// Validate before upload
const validation = await validatePdfFile(file)
if (!validation.valid) {
  showError(validation.error)
  return
}
```

## Protected Endpoints

### PDF Upload Endpoints

| Endpoint | Purpose | Allowed Types |
|----------|---------|---------------|
| `/api/projects/batch-upload/analyze` | AI analysis of mapping sheets | PDF only |
| `/api/projects/batch-upload/init` | Batch upload initialization | PDF only |
| `/api/admin/eba-trade-import/parse` | EBA trade list parsing | PDF only |

**Validation Added**:
- Checks for `%PDF` signature (`25 50 44 46`)
- Rejects files that don't start with PDF magic bytes
- Returns clear error message about spoofed extensions

### CSV Upload Endpoints

| Component | Purpose | Allowed Types |
|-----------|---------|---------------|
| `FileUpload.tsx` | Generic CSV file upload | CSV only |

**Validation Added**:
- Checks for text content (no binary data)
- Validates CSV structure (headers, rows)
- Detects suspicious content (PHP, JavaScript, HTML)
- Rejects executables disguised as CSV

## Error Messages

When validation fails, users see clear error messages:

```
Invalid PDF file

The uploaded file does not appear to be a valid PDF.
File extension can be spoofed - please ensure you are
uploading a genuine PDF file.
```

## Security Testing

### Test Attack Scenarios

1. **Executable as PDF**
   ```bash
   # Rename executable
   cp malicious.exe fake.pdf
   # Upload fails: signature mismatch
   ```

2. **PHP Code as CSV**
   ```bash
   echo '<?php system($_GET["cmd"]); ?>' > malicious.csv
   # Upload fails: suspicious content detected
   ```

3. **Image as PDF**
   ```bash
   cp image.png fake.pdf
   # Upload fails: PNG signature detected instead of PDF
   ```

### Running Tests

```bash
# Run validation tests
npm test src/lib/validation/__tests__/fileSignature.test.ts

# Test specific endpoint
curl -X POST http://localhost:3000/api/projects/batch-upload/analyze \
  -F "file=@test.pdf"
```

## Common File Signatures Reference

| Type | Extension | Signature (Hex) | ASCII |
|------|-----------|-----------------|-------|
| PDF | .pdf | `25 50 44 46` | `%PDF` |
| PNG | .png | `89 50 4E 47 0D 0A 1A 0A` | `.PNG....` |
| JPEG | .jpg | `FF D8 FF E0` (JFIF) | N/A |
| JPEG | .jpg | `FF D8 FF E1` (Exif) | N/A |
| ZIP/XLSX | .xlsx | `50 4B 03 04` | `PK..` |
| Windows EXE | .exe | `4D 5A` | `MZ` |
| Linux ELF | (none) | `7F 45 4C 46` | `.ELF` |

## Best Practices

### For Developers

1. **Always validate on server-side** - Client validation can be bypassed
2. **Read file content, not just extension** - Check magic bytes
3. **Validate early** - Before storing or processing
4. **Log validation failures** - Monitor for attack attempts
5. **Return clear errors** - Help legitimate users understand issues

### For Users

1. **Use original files** - Don't rename file extensions
2. **Scan files before upload** - Use antivirus software
3. **Check file sources** - Only upload trusted files
4. **Report issues** - If legitimate files are rejected

## Integration Guide

### Adding Validation to New Endpoint

1. **Import validation function**
   ```typescript
   import { validatePdfSignature } from '@/lib/validation/fileSignature'
   ```

2. **Read file to buffer**
   ```typescript
   const arrayBuffer = await file.arrayBuffer()
   const buffer = Buffer.from(arrayBuffer)
   ```

3. **Validate before processing**
   ```typescript
   const validation = await validatePdfSignature(buffer)
   if (!validation.valid) {
     console.warn('[endpoint] Validation failed:', validation.error)
     return NextResponse.json({
       error: 'Invalid file',
       details: validation.error,
     }, { status: 400 })
   }
   ```

### Adding New File Type

1. **Add signature to `FILE_SIGNATURES` in `fileSignature.ts`**
   ```typescript
   WORD_DOC: {
     mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     extension: 'docx',
     signature: [[0x50, 0x4B, 0x03, 0x04]],
   }
   ```

2. **Create validation function**
   ```typescript
   export async function validateWordSignature(
     input: File | Buffer | Uint8Array
   ): Promise<{ valid: boolean; error?: string }> {
     const result = await validateFileSignature(input, [FILE_SIGNATURES.WORD_DOC])
     return { valid: result.valid, error: result.error }
   }
   ```

3. **Add to `validateUploadedFile` switch statement**

## Limitations

1. **ZIP-based formats** (XLSX, DOCX, PPTX) - All have same ZIP signature
   - Additional validation of internal structure may be needed
   - Consider parsing ZIP contents to verify file type

2. **CSV files** - No magic bytes signature
   - Validates text content and structure instead
   - Cannot definitively prove file is legitimate CSV

3. **File size** - Only reads first 16 bytes for performance
   - Malicious content could be later in file
   - Combine with file size limits and content scanning

4. **Polyglot files** - Files valid as multiple types
   - Advanced attack: file is both valid PDF and executable
   - Consider additional content analysis for high-security needs

## Monitoring and Logging

All validation failures are logged with context:

```typescript
console.warn('[endpoint] PDF signature validation failed:', validation.error)
```

Monitor logs for patterns:
- Repeated failures from same IP
- Specific file types being rejected
- Timing of rejection attempts

## References

- [List of file signatures (Wikipedia)](https://en.wikipedia.org/wiki/List_of_file_signatures)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [MIME Sniffing Standard](https://mimesniff.spec.whatwg.org/)

## Support

For questions or issues:
1. Check error message details
2. Verify file is genuine (not renamed)
3. Review validation logs
4. Contact development team with file signature hex dump
