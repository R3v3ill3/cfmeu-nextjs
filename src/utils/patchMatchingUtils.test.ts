import { 
  findBestPatchMatches, 
  normalizePatchName, 
  convertToWKT,
  parsePatchesWithFuzzyMatching 
} from './patchMatchingUtils';

// Mock data for testing
const mockExistingPatches = [
  { id: '1', name: 'Sydney CBD', code: 'SYD_CBD' },
  { id: '2', name: 'North Sydney', code: 'NSYD' },
  { id: '3', name: 'Parramatta', code: 'PARA' },
  { id: '4', name: 'Western Sydney', code: 'WSYD' }
];

const mockGeoJSONFeatures = [
  {
    type: 'Feature' as const,
    properties: {
      fid: 1,
      patch_id: 'PATCH_001',
      patch_name: 'Sydney CBD',
      coordinator: 'John Smith'
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[151.2, -33.8], [151.3, -33.8], [151.3, -33.9], [151.2, -33.9], [151.2, -33.8]]]
    }
  },
  {
    type: 'Feature' as const,
    properties: {
      fid: 2,
      patch_id: 'PATCH_002',
      patch_name: 'North Syd',
      coordinator: 'Jane Doe'
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[151.2, -33.8], [151.3, -33.8], [151.3, -33.9], [151.2, -33.9], [151.2, -33.8]]]
    }
  },
  {
    type: 'Feature' as const,
    properties: {
      fid: 3,
      patch_id: 'PATCH_003',
      patch_name: 'New Area',
      coordinator: 'Bob Wilson'
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[151.2, -33.8], [151.3, -33.8], [151.3, -33.9], [151.2, -33.9], [151.2, -33.8]]]
    }
  }
];

describe('Patch Matching Utils', () => {
  describe('normalizePatchName', () => {
    it('should normalize patch names correctly', () => {
      expect(normalizePatchName('Sydney CBD')).toBe('sydney cbd');
      expect(normalizePatchName('North-Sydney')).toBe('north sydney');
      expect(normalizePatchName('  Parramatta  ')).toBe('parramatta');
      expect(normalizePatchName('Western Sydney!')).toBe('western sydney');
    });
  });

  describe('findBestPatchMatches', () => {
    it('should find exact matches', () => {
      const matches = findBestPatchMatches('Sydney CBD', mockExistingPatches);
      expect(matches[0].confidence).toBe('exact');
      expect(matches[0].similarity).toBe(1.0);
      expect(matches[0].name).toBe('Sydney CBD');
    });

    it('should find high confidence matches', () => {
      const matches = findBestPatchMatches('North Syd', mockExistingPatches);
      expect(matches[0].confidence).toBe('high');
      expect(matches[0].name).toBe('North Sydney');
      expect(matches[0].similarity).toBeGreaterThan(0.85);
    });

    it('should return empty array for no matches', () => {
      const matches = findBestPatchMatches('Completely Different', mockExistingPatches);
      expect(matches).toHaveLength(0);
    });

    it('should sort matches by confidence and similarity', () => {
      const matches = findBestPatchMatches('Sydney', mockExistingPatches);
      expect(matches.length).toBeGreaterThan(0);
      // First match should be exact or highest confidence
      expect(matches[0].confidence).toBe('exact');
    });
  });

  describe('convertToWKT', () => {
    it('should convert Polygon to WKT format', () => {
      const geometry = {
        type: 'Polygon' as const,
        coordinates: [[[151.2, -33.8], [151.3, -33.8], [151.3, -33.9], [151.2, -33.9], [151.2, -33.8]]]
      };
      const wkt = convertToWKT(geometry);
      expect(wkt).toBe('POLYGON((151.2 -33.8, 151.3 -33.8, 151.3 -33.9, 151.2 -33.9, 151.2 -33.8))');
    });

    it('should convert MultiPolygon to WKT format', () => {
      const geometry = {
        type: 'MultiPolygon' as const,
        coordinates: [
          [[[151.2, -33.8], [151.3, -33.8], [151.3, -33.9], [151.2, -33.9], [151.2, -33.8]]],
          [[[151.4, -33.8], [151.5, -33.8], [151.5, -33.9], [151.4, -33.9], [151.4, -33.8]]]
        ]
      };
      const wkt = convertToWKT(geometry);
      expect(wkt).toContain('MULTIPOLYGON');
      expect(wkt).toContain('151.2 -33.8');
      expect(wkt).toContain('151.4 -33.8');
    });

    it('should throw error for unsupported geometry types', () => {
      const geometry = { type: 'Point' as const, coordinates: [151.2, -33.8] };
      expect(() => convertToWKT(geometry)).toThrow('Unsupported geometry type: Point');
    });
  });

  describe('parsePatchesWithFuzzyMatching', () => {
    it('should parse patches with correct statuses', () => {
      const patches = parsePatchesWithFuzzyMatching(mockGeoJSONFeatures, mockExistingPatches);
      
      // First patch should be exact match
      expect(patches[0].status).toBe('existing');
      expect(patches[0].existing_patch_ids).toEqual(['1']);
      
      // Second patch should be manual match
      expect(patches[1].status).toBe('manual_match');
      expect(patches[1].suggested_matches).toBeDefined();
      
      // Third patch should be new
      expect(patches[2].status).toBe('new');
    });

    it('should include match confidence and similarity', () => {
      const patches = parsePatchesWithFuzzyMatching(mockGeoJSONFeatures, mockExistingPatches);
      
      const manualMatch = patches.find(p => p.status === 'manual_match');
      expect(manualMatch?.match_confidence).toBeDefined();
      expect(manualMatch?.match_similarity).toBeDefined();
      expect(manualMatch?.match_similarity).toBeGreaterThan(0.6);
    });

    it('should convert geometry to WKT format', () => {
      const patches = parsePatchesWithFuzzyMatching(mockGeoJSONFeatures, mockExistingPatches);
      
      patches.forEach(patch => {
        expect(patch.geometry).toContain('POLYGON');
        expect(patch.geometry).toContain('151.2 -33.8');
      });
    });
  });
});
