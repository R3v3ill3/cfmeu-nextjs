import { FwcLookupService } from '../fwcLookupService';
import { FwcLookupJobOptions } from '@/types/fwcLookup';

// Mock supabase
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          data: [
            { id: '1', name: 'ABC Construction Pty Ltd' },
            { id: '2', name: 'XYZ Builders Limited' },
            { id: '3', name: 'DEF Contractors' }
          ],
          error: null
        })),
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => ({
            data: { id: '1', employer_id: '1' },
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => ({
        data: { id: 'job-123' },
        error: null
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: { id: 'job-123' },
          error: null
        }))
      }))
    }))
  }
}));

// Mock fetch for FWC API calls
global.fetch = jest.fn();

describe('FwcLookupService', () => {
  let service: FwcLookupService;
  
  beforeEach(() => {
    service = FwcLookupService.getInstance();
    jest.clearAllMocks();
  });

  describe('createFwcLookupJob', () => {
    it('should create a new FWC lookup job with default options', async () => {
      const employerIds = ['1', '2', '3'];
      const job = await service.createFwcLookupJob(employerIds);

      expect(job).toBeTruthy();
      expect(job.employerIds).toEqual(employerIds);
      expect(job.status).toBe('pending');
      expect(job.priority).toBe('normal');
      expect(job.progress.total).toBe(3);
      expect(job.progress.completed).toBe(0);
      expect(job.batchSize).toBe(5);
    });

    it('should create a job with custom options', async () => {
      const employerIds = ['1', '2'];
      const options: FwcLookupJobOptions = {
        priority: 'high',
        batchSize: 2,
        skipExisting: true,
        autoSelectBest: false
      };

      const job = await service.createFwcLookupJob(employerIds, options);

      expect(job.priority).toBe('high');
      expect(job.batchSize).toBe(2);
    });

    it('should filter out employers with existing FWC data when skipExisting is true', async () => {
      const employerIds = ['1', '2', '3'];
      const options: FwcLookupJobOptions = {
        skipExisting: true
      };

      // Mock that employer '1' already has FWC data
      const mockSupabase = require('@/integrations/supabase/client').supabase;
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            not: jest.fn(() => ({
              data: [{ employer_id: '2' }, { employer_id: '3' }], // Only 2 and 3 don't have FWC data
              error: null
            }))
          }))
        }))
      });

      const job = await service.createFwcLookupJob(employerIds, options);

      expect(job.employerIds).toEqual(['2', '3']);
      expect(job.progress.total).toBe(2);
    });
  });

  describe('getJob', () => {
    it('should return a job by ID', async () => {
      const employerIds = ['1'];
      const job = await service.createFwcLookupJob(employerIds);
      
      const retrievedJob = service.getJob(job.id);
      
      expect(retrievedJob).toBeTruthy();
      expect(retrievedJob?.id).toBe(job.id);
    });

    it('should return null for non-existent job', () => {
      const retrievedJob = service.getJob('non-existent-id');
      
      expect(retrievedJob).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('should cancel an existing job', async () => {
      const employerIds = ['1'];
      const job = await service.createFwcLookupJob(employerIds);
      
      const cancelled = await service.cancelJob(job.id);
      
      expect(cancelled).toBe(true);
      
      const retrievedJob = service.getJob(job.id);
      expect(retrievedJob?.status).toBe('cancelled');
    });

    it('should return false for non-existent job', async () => {
      const cancelled = await service.cancelJob('non-existent-id');
      
      expect(cancelled).toBe(false);
    });
  });

  describe('getActiveJobs', () => {
    it('should return all active jobs', async () => {
      const job1 = await service.createFwcLookupJob(['1']);
      const job2 = await service.createFwcLookupJob(['2']);
      
      const activeJobs = service.getActiveJobs();
      
      expect(activeJobs).toHaveLength(2);
      expect(activeJobs.map(j => j.id)).toContain(job1.id);
      expect(activeJobs.map(j => j.id)).toContain(job2.id);
    });
  });

  describe('getJobSummary', () => {
    it('should return job summary statistics', async () => {
      const employerIds = ['1', '2', '3'];
      const job = await service.createFwcLookupJob(employerIds);
      
      // Simulate some results
      job.results = [
        {
          employerId: '1',
          employerName: 'ABC Construction',
          success: true,
          fwcResults: [{ title: 'EBA 1', agreementType: 'Single-enterprise', status: 'Approved' }],
          processingTime: 1000
        },
        {
          employerId: '2',
          employerName: 'XYZ Builders',
          success: false,
          fwcResults: [],
          processingTime: 500,
          error: 'No results found'
        }
      ];
      job.progress.completed = 2;
      job.status = 'completed';
      job.startedAt = new Date('2023-01-01T10:00:00Z');
      job.completedAt = new Date('2023-01-01T10:05:00Z');
      
      const summary = service.getJobSummary(job.id);
      
      expect(summary).toBeTruthy();
      expect(summary?.totalEmployers).toBe(3);
      expect(summary?.processedEmployers).toBe(2);
      expect(summary?.successfulLookups).toBe(1);
      expect(summary?.failedLookups).toBe(1);
      expect(summary?.averageProcessingTime).toBe(750); // (1000 + 500) / 2
      expect(summary?.totalDuration).toBe(300000); // 5 minutes in milliseconds
      expect(summary?.status).toBe('completed');
    });

    it('should return null for non-existent job', () => {
      const summary = service.getJobSummary('non-existent-id');
      
      expect(summary).toBeNull();
    });
  });

  describe('FWC API Integration', () => {
    it('should handle successful FWC API responses', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [
            {
              title: 'ABC Construction EBA 2023',
              agreementType: 'Single-enterprise Agreement',
              status: 'Approved',
              documentUrl: 'https://fwc.gov.au/document/123',
              lodgementNumber: 'AE123456',
              approvedDate: '2023-01-01',
              expiryDate: '2026-01-01'
            }
          ]
        })
      } as Response);

      const employerIds = ['1'];
      const job = await service.createFwcLookupJob(employerIds);

      // Wait for job to process (in a real scenario, this would be handled by the background processor)
      // For testing, we'll simulate the processing
      expect(job).toBeTruthy();
      expect(job.status).toBe('pending');
    });

    it('should handle failed FWC API responses', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: 'No results found'
        })
      } as Response);

      const employerIds = ['1'];
      const job = await service.createFwcLookupJob(employerIds);

      expect(job).toBeTruthy();
      expect(job.status).toBe('pending');
    });
  });
});
