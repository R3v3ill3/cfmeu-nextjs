/**
 * Tests for file signature validation
 *
 * Run with: npm test src/lib/validation/__tests__/fileSignature.test.ts
 */

import { describe, it, expect } from '@jest/globals'
import {
  validatePdfSignature,
  validateImageSignature,
  validateExcelSignature,
  validateCsvContent,
  validateUploadedFile,
} from '../fileSignature'

describe('File Signature Validation', () => {
  describe('PDF Validation', () => {
    it('should accept valid PDF signature', async () => {
      // %PDF signature
      const validPdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
      const result = await validatePdfSignature(validPdf)
      expect(result.valid).toBe(true)
    })

    it('should reject invalid PDF signature', async () => {
      const invalidPdf = Buffer.from([0x00, 0x00, 0x00, 0x00])
      const result = await validatePdfSignature(invalidPdf)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject text file with .pdf extension', async () => {
      const textFile = Buffer.from('This is a text file, not a PDF')
      const result = await validatePdfSignature(textFile)
      expect(result.valid).toBe(false)
    })
  })

  describe('Image Validation', () => {
    it('should accept valid PNG signature', async () => {
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      const result = await validateImageSignature(validPng)
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('png')
    })

    it('should accept valid JPEG signature (JFIF)', async () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
      const result = await validateImageSignature(validJpeg)
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('jpeg')
    })

    it('should accept valid JPEG signature (Exif)', async () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10])
      const result = await validateImageSignature(validJpeg)
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('jpeg')
    })

    it('should reject invalid image signature', async () => {
      const invalidImage = Buffer.from([0x00, 0x00, 0x00, 0x00])
      const result = await validateImageSignature(invalidImage)
      expect(result.valid).toBe(false)
    })
  })

  describe('Excel Validation', () => {
    it('should accept valid XLSX signature (ZIP format)', async () => {
      const validXlsx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00])
      const result = await validateExcelSignature(validXlsx)
      expect(result.valid).toBe(true)
    })

    it('should reject invalid XLSX signature', async () => {
      const invalidXlsx = Buffer.from([0x00, 0x00, 0x00, 0x00])
      const result = await validateExcelSignature(invalidXlsx)
      expect(result.valid).toBe(false)
    })
  })

  describe('CSV Validation', () => {
    it('should accept valid CSV content', async () => {
      const validCsv = Buffer.from('Name,Email,Phone\nJohn,john@example.com,555-1234\n')
      const result = await validateCsvContent(validCsv)
      expect(result.valid).toBe(true)
    })

    it('should reject empty CSV', async () => {
      const emptyCsv = Buffer.from('')
      const result = await validateCsvContent(emptyCsv)
      expect(result.valid).toBe(false)
    })

    it('should reject binary data disguised as CSV', async () => {
      // PDF disguised as CSV
      const fakeCsv = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
      const result = await validateCsvContent(fakeCsv)
      expect(result.valid).toBe(false)
    })

    it('should reject PHP code disguised as CSV', async () => {
      const phpCsv = Buffer.from('<?php system($_GET["cmd"]); ?>')
      const result = await validateCsvContent(phpCsv)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('suspicious')
    })

    it('should reject HTML disguised as CSV', async () => {
      const htmlCsv = Buffer.from('<html><script>alert("XSS")</script></html>')
      const result = await validateCsvContent(htmlCsv)
      expect(result.valid).toBe(false)
    })
  })

  describe('Comprehensive File Validation', () => {
    it('should validate PDF with correct signature', async () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
      const result = await validateUploadedFile(pdfBuffer, 'application/pdf', 'test.pdf')
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('application/pdf')
    })

    it('should reject PDF with wrong signature', async () => {
      const notPdf = Buffer.from('This is not a PDF')
      const result = await validateUploadedFile(notPdf, 'application/pdf', 'fake.pdf')
      expect(result.valid).toBe(false)
      expect(result.securityRisk).toBeDefined()
    })

    it('should validate CSV with valid content', async () => {
      const csvBuffer = Buffer.from('Name,Age\nJohn,30\nJane,25\n')
      const result = await validateUploadedFile(csvBuffer, 'text/csv', 'data.csv')
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('text/csv')
    })
  })

  describe('Security Tests', () => {
    it('should detect executable disguised as PDF', async () => {
      // Windows executable (MZ header)
      const exeFile = Buffer.from([0x4d, 0x5a, 0x90, 0x00])
      const result = await validatePdfSignature(exeFile)
      expect(result.valid).toBe(false)
    })

    it('should detect PHP code in CSV', async () => {
      const maliciousCsv = Buffer.from('<?php eval($_POST["cmd"]); ?>,test,data')
      const result = await validateCsvContent(maliciousCsv)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('suspicious')
    })

    it('should detect script tags in CSV', async () => {
      const xssCsv = Buffer.from('<script>alert("XSS")</script>,test,data')
      const result = await validateCsvContent(xssCsv)
      expect(result.valid).toBe(false)
    })
  })
})
