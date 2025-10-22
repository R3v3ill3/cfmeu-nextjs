/**
 * Idempotency Tests
 *
 * Tests for batch upload and scraper job idempotency implementation
 */

import { describe, it, expect } from '@jest/globals'
import {
  generateBatchIdempotencyKey,
  generateJobIdempotencyKey,
  generateIdempotencyKey,
  isUniqueViolationError,
} from '../src/lib/idempotency'

describe('Idempotency Key Generation', () => {
  const userId = 'user-123'
  const fileName = 'test.pdf'
  const fileSize = 12345
  const totalPages = 10

  describe('generateBatchIdempotencyKey', () => {
    it('should generate consistent keys for same input', async () => {
      const projectDefinitions = [
        { startPage: 1, endPage: 3, mode: 'new', tentativeName: 'Project A' },
        { startPage: 4, endPage: 6, mode: 'new', tentativeName: 'Project B' },
      ]

      const key1 = await generateBatchIdempotencyKey(
        userId,
        fileName,
        fileSize,
        totalPages,
        projectDefinitions
      )

      const key2 = await generateBatchIdempotencyKey(
        userId,
        fileName,
        fileSize,
        totalPages,
        projectDefinitions
      )

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^batch_[0-9a-f]{64}$/)
    })

    it('should generate different keys for different inputs', async () => {
      const projectDefinitions1 = [
        { startPage: 1, endPage: 3, mode: 'new', tentativeName: 'Project A' },
      ]

      const projectDefinitions2 = [
        { startPage: 1, endPage: 5, mode: 'new', tentativeName: 'Project A' },
      ]

      const key1 = await generateBatchIdempotencyKey(
        userId,
        fileName,
        fileSize,
        totalPages,
        projectDefinitions1
      )

      const key2 = await generateBatchIdempotencyKey(
        userId,
        fileName,
        fileSize,
        totalPages,
        projectDefinitions2
      )

      expect(key1).not.toBe(key2)
    })

    it('should be insensitive to project definition order', async () => {
      const def1 = { startPage: 1, endPage: 3, mode: 'new', tentativeName: 'Project A' }
      const def2 = { startPage: 4, endPage: 6, mode: 'new', tentativeName: 'Project B' }

      const key1 = await generateBatchIdempotencyKey(
        userId,
        fileName,
        fileSize,
        totalPages,
        [def1, def2]
      )

      const key2 = await generateBatchIdempotencyKey(
        userId,
        fileName,
        fileSize,
        totalPages,
        [def2, def1]
      )

      expect(key1).toBe(key2)
    })

    it('should change key when user changes', async () => {
      const projectDefinitions = [
        { startPage: 1, endPage: 3, mode: 'new', tentativeName: 'Project A' },
      ]

      const key1 = await generateBatchIdempotencyKey(
        'user-1',
        fileName,
        fileSize,
        totalPages,
        projectDefinitions
      )

      const key2 = await generateBatchIdempotencyKey(
        'user-2',
        fileName,
        fileSize,
        totalPages,
        projectDefinitions
      )

      expect(key1).not.toBe(key2)
    })

    it('should change key when file changes', async () => {
      const projectDefinitions = [
        { startPage: 1, endPage: 3, mode: 'new', tentativeName: 'Project A' },
      ]

      const key1 = await generateBatchIdempotencyKey(
        userId,
        'file1.pdf',
        fileSize,
        totalPages,
        projectDefinitions
      )

      const key2 = await generateBatchIdempotencyKey(
        userId,
        'file2.pdf',
        fileSize,
        totalPages,
        projectDefinitions
      )

      expect(key1).not.toBe(key2)
    })
  })

  describe('generateJobIdempotencyKey', () => {
    const scanId = 'scan-123'
    const jobType = 'mapping_sheet_scan'

    it('should generate consistent keys for same input', async () => {
      const payload = {
        fileUrl: 'https://example.com/file.pdf',
        uploadMode: 'new_project',
        selectedPages: [1, 2, 3],
      }

      const key1 = await generateJobIdempotencyKey(userId, scanId, jobType, payload)
      const key2 = await generateJobIdempotencyKey(userId, scanId, jobType, payload)

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^job_[0-9a-f]{64}$/)
    })

    it('should generate different keys for different inputs', async () => {
      const payload1 = {
        fileUrl: 'https://example.com/file.pdf',
        uploadMode: 'new_project',
        selectedPages: [1, 2, 3],
      }

      const payload2 = {
        fileUrl: 'https://example.com/file.pdf',
        uploadMode: 'new_project',
        selectedPages: [1, 2, 3, 4],
      }

      const key1 = await generateJobIdempotencyKey(userId, scanId, jobType, payload1)
      const key2 = await generateJobIdempotencyKey(userId, scanId, jobType, payload2)

      expect(key1).not.toBe(key2)
    })

    it('should be insensitive to selectedPages order', async () => {
      const payload1 = {
        fileUrl: 'https://example.com/file.pdf',
        uploadMode: 'new_project',
        selectedPages: [3, 1, 2],
      }

      const payload2 = {
        fileUrl: 'https://example.com/file.pdf',
        uploadMode: 'new_project',
        selectedPages: [1, 2, 3],
      }

      const key1 = await generateJobIdempotencyKey(userId, scanId, jobType, payload1)
      const key2 = await generateJobIdempotencyKey(userId, scanId, jobType, payload2)

      expect(key1).toBe(key2)
    })

    it('should change key when retry attempt changes', async () => {
      const payload1 = {
        fileUrl: 'https://example.com/file.pdf',
        uploadMode: 'new_project',
        selectedPages: [1, 2, 3],
        retryAttempt: 1,
      }

      const payload2 = {
        fileUrl: 'https://example.com/file.pdf',
        uploadMode: 'new_project',
        selectedPages: [1, 2, 3],
        retryAttempt: 2,
      }

      const key1 = await generateJobIdempotencyKey(userId, scanId, jobType, payload1)
      const key2 = await generateJobIdempotencyKey(userId, scanId, jobType, payload2)

      expect(key1).not.toBe(key2)
    })

    it('should ignore extra payload fields', async () => {
      const payload1 = {
        fileUrl: 'https://example.com/file.pdf',
        uploadMode: 'new_project',
        selectedPages: [1, 2, 3],
        extraField: 'ignored',
      }

      const payload2 = {
        fileUrl: 'https://example.com/file.pdf',
        uploadMode: 'new_project',
        selectedPages: [1, 2, 3],
        differentExtraField: 'also ignored',
      }

      const key1 = await generateJobIdempotencyKey(userId, scanId, jobType, payload1)
      const key2 = await generateJobIdempotencyKey(userId, scanId, jobType, payload2)

      expect(key1).toBe(key2)
    })
  })

  describe('generateIdempotencyKey', () => {
    it('should generate consistent keys for same input', async () => {
      const key1 = await generateIdempotencyKey('part1', 'part2', 123)
      const key2 = await generateIdempotencyKey('part1', 'part2', 123)

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should generate different keys for different inputs', async () => {
      const key1 = await generateIdempotencyKey('part1', 'part2')
      const key2 = await generateIdempotencyKey('part1', 'part3')

      expect(key1).not.toBe(key2)
    })

    it('should filter out null and undefined', async () => {
      const key1 = await generateIdempotencyKey('part1', null, 'part2', undefined)
      const key2 = await generateIdempotencyKey('part1', 'part2')

      expect(key1).toBe(key2)
    })
  })

  describe('isUniqueViolationError', () => {
    it('should detect PostgreSQL unique violation', () => {
      const error = { code: '23505' }
      expect(isUniqueViolationError(error)).toBe(true)
    })

    it('should detect unique in error message', () => {
      const error = { message: 'duplicate key value violates unique constraint' }
      expect(isUniqueViolationError(error)).toBe(true)
    })

    it('should detect duplicate in error message', () => {
      const error = { message: 'Duplicate entry for key' }
      expect(isUniqueViolationError(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error = { code: '42P01', message: 'relation does not exist' }
      expect(isUniqueViolationError(error)).toBe(false)
    })

    it('should handle null/undefined', () => {
      expect(isUniqueViolationError(null)).toBe(false)
      expect(isUniqueViolationError(undefined)).toBe(false)
      expect(isUniqueViolationError({})).toBe(false)
    })
  })
})

/**
 * Integration Test Scenarios (Manual Testing)
 *
 * These should be tested manually in the application:
 *
 * 1. Network Retry Test
 *    - Upload a batch
 *    - Use DevTools to retry the request
 *    - Verify only one batch created
 *    - Verify both requests return same batchId
 *
 * 2. Double Click Test
 *    - Upload a batch
 *    - Rapidly click "Process Upload" multiple times
 *    - Verify only one batch created
 *    - Check database for duplicate jobs
 *
 * 3. Concurrent Tabs Test
 *    - Open app in two tabs
 *    - Upload same file with same definitions in both
 *    - Click upload simultaneously
 *    - Verify only one batch exists
 *    - Verify both tabs show same batch
 *
 * 4. Modified Content Test
 *    - Upload a batch
 *    - Modify project definitions
 *    - Upload again
 *    - Verify NEW batch created (different key)
 *
 * 5. Retry After Failure Test
 *    - Create a batch with failed scan
 *    - Click "Retry Failed"
 *    - Verify new job created
 *    - Click "Retry Failed" again immediately
 *    - Verify no duplicate retry job
 *
 * 6. Database Verification
 *    Query for duplicates:
 *    ```sql
 *    SELECT idempotency_key, COUNT(*)
 *    FROM batch_uploads
 *    WHERE idempotency_key IS NOT NULL
 *    GROUP BY idempotency_key
 *    HAVING COUNT(*) > 1;
 *    ```
 *    Should return 0 rows
 */
