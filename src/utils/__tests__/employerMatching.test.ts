import { matchEmployerAdvanced, getMatchingStatistics } from '../employerMatching';
import { normalizeEmployerName } from '@/lib/employers/normalize';

// Mock supabase
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        ilike: jest.fn(() => ({
          data: [
            { id: '1', name: 'ABC Construction Pty Ltd', address_line_1: '123 Main St', suburb: 'Sydney', state: 'NSW' },
            { id: '2', name: 'ABC Constructions Limited', address_line_1: '456 High St', suburb: 'Melbourne', state: 'VIC' }
          ],
          error: null
        })),
        or: jest.fn(() => ({
          limit: jest.fn(() => ({
            data: [
              { id: '1', name: 'ABC Construction Pty Ltd', address_line_1: '123 Main St', suburb: 'Sydney', state: 'NSW' },
              { id: '2', name: 'ABC Constructions Limited', address_line_1: '456 High St', suburb: 'Melbourne', state: 'VIC' },
              { id: '3', name: 'XYZ Builders', address_line_1: '789 Low St', suburb: 'Brisbane', state: 'QLD' }
            ],
            error: null
          }))
        }))
      }))
    }))
  }
}));

describe('employerMatching', () => {
  describe('normalizeEmployerName', () => {
    it('normalizes complex names consistently', () => {
      expect(normalizeEmployerName('Acme T/A Builders Pty Ltd').normalized).toBe('ACME')
    })
  })
  describe('matchEmployerAdvanced', () => {
    it('should find exact matches with high confidence', async () => {
      const result = await matchEmployerAdvanced('ABC Construction Pty Ltd', {
        confidenceThreshold: 0.75,
        allowFuzzyMatching: true,
        requireUserConfirmation: false
      });

      expect(result.match).toBeTruthy();
      expect(result.match?.confidence).toBe('exact');
      expect(result.match?.score).toBe(1.0);
      expect(result.match?.name).toBe('ABC Construction Pty Ltd');
    });

    it('should find high confidence matches for similar names', async () => {
      const result = await matchEmployerAdvanced('ABC Construction', {
        confidenceThreshold: 0.75,
        allowFuzzyMatching: true,
        requireUserConfirmation: false
      });

      expect(result.match).toBeTruthy();
      expect(result.match?.confidence).toBeOneOf(['exact', 'high']);
      expect(result.match?.score).toBeGreaterThan(0.75);
    });

    it('should return candidates for user review', async () => {
      const result = await matchEmployerAdvanced('ABC Construction', {
        confidenceThreshold: 0.75,
        allowFuzzyMatching: true,
        requireUserConfirmation: false
      });

      expect(result.candidates).toBeInstanceOf(Array);
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should handle empty or invalid input', async () => {
      const result = await matchEmployerAdvanced('', {
        confidenceThreshold: 0.75,
        allowFuzzyMatching: true,
        requireUserConfirmation: false
      });

      expect(result.match).toBeNull();
      expect(result.candidates).toEqual([]);
    });
  });

  describe('getMatchingStatistics', () => {
    it('should calculate matching statistics correctly', () => {
      const mockResults = {
        'Company A': {
          match: { id: '1', name: 'Company A', confidence: 'exact' as const, distance: 0, score: 1.0 },
          candidates: [],
          searchQuery: 'Company A',
          normalizedQuery: 'COMPANY A'
        },
        'Company B': {
          match: { id: '2', name: 'Company B Match', confidence: 'high' as const, distance: 0.1, score: 0.9 },
          candidates: [],
          searchQuery: 'Company B',
          normalizedQuery: 'COMPANY B'
        },
        'Company C': {
          match: null,
          candidates: [],
          searchQuery: 'Company C',
          normalizedQuery: 'COMPANY C'
        }
      };

      const stats = getMatchingStatistics(mockResults);

      expect(stats.total).toBe(3);
      expect(stats.exactMatches).toBe(1);
      expect(stats.highConfidence).toBe(1);
      expect(stats.noMatches).toBe(1);
      expect(stats.matchRate).toBeCloseTo(66.67, 1);
    });
  });
});
