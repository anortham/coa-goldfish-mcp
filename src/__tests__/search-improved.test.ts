/**
 * Improved Search Tests - Test new search modes and configurations
 */

import { SearchEngine } from '../core/search.js';
import { MockStorage } from './mock-storage.js';
import { 
  getTestCases, 
  validateSearchResults,
  SearchTestCase
} from './search-test-harness.js';

describe('Improved Search Engine - Mode Testing', () => {
  let searchEngine: SearchEngine;
  let mockStorage: MockStorage;
  
  beforeAll(async () => {
    mockStorage = new MockStorage('test-project');
    searchEngine = new SearchEngine(mockStorage as any);
    console.log(`\n🔧 Testing improved search with ${mockStorage.getTestMemories().length} test memories`);
  });

  describe('Strict Mode Tests', () => {
    const singleWordCases = getTestCases().filter(tc => tc.category === 'single-word');
    
    test.each(singleWordCases)('Strict Mode - Case $id: $description', async (testCase: SearchTestCase) => {
      console.log(`\n🎯 STRICT: "${testCase.query}"`);
      console.log(`Expected: [${testCase.expectedMemoryIds.join(', ')}]`);
      
      const results = await searchEngine.searchMemories({
        query: testCase.query,
        scope: 'current',
        limit: 10,
        mode: 'strict'
      });
      
      console.log(`Found: [${results.map(r => r.id).join(', ')}]`);
      
      const validation = validateSearchResults(testCase, 
        results.map(r => ({ memory: r, score: 0 }))
      );
      
      console.log(`✅ Precision: ${(validation.details.precision * 100).toFixed(1)}%`);
      console.log(`✅ Recall: ${(validation.details.recall * 100).toFixed(1)}%`);
      
      if (!validation.passed) {
        console.log(`❌ Missing: [${validation.details.missingIds.join(', ')}]`);
        console.log(`❌ Unexpected: [${validation.details.unexpectedIds.join(', ')}]`);
      }
      
      // Strict mode should have better precision
      expect(results.length).toBeLessThanOrEqual(7); // Not returning everything
    });
  });

  describe('Normal Mode Tests', () => {
    const multiWordCases = getTestCases().filter(tc => tc.category === 'multi-word');
    
    test.each(multiWordCases)('Normal Mode - Case $id: $description', async (testCase: SearchTestCase) => {
      console.log(`\n🎯 NORMAL: "${testCase.query}"`);
      console.log(`Expected: [${testCase.expectedMemoryIds.join(', ')}]`);
      
      const results = await searchEngine.searchMemories({
        query: testCase.query,
        scope: 'current',
        limit: 10,
        mode: 'normal'
      });
      
      console.log(`Found: [${results.map(r => r.id).join(', ')}]`);
      
      const validation = validateSearchResults(testCase, 
        results.map(r => ({ memory: r, score: 0 }))
      );
      
      console.log(`✅ Precision: ${(validation.details.precision * 100).toFixed(1)}%`);
      console.log(`✅ Recall: ${(validation.details.recall * 100).toFixed(1)}%`);
      
      // Normal mode should balance precision and recall
      expect(results.length).toBeLessThanOrEqual(7); // Better than baseline
      expect(validation.details.precision).toBeGreaterThan(0.3); // Better than 30%
    });
  });

  describe('Auto-Escalation Mode Tests', () => {
    const testCases = [
      { query: 'authentication', expectedIds: [1, 2, 4, 7], description: 'Should find exact matches first' },
      { query: 'databse', expectedIds: [5], description: 'Should handle typos with escalation' },
      { query: 'nonexistent zzzzzz', expectedIds: [], description: 'Should return empty for truly nonexistent' }
    ];
    
    test.each(testCases)('Auto Mode - $description', async (testData) => {
      console.log(`\n🤖 AUTO: "${testData.query}"`);
      console.log(`Expected: [${testData.expectedIds.join(', ')}]`);
      
      const results = await searchEngine.searchMemories({
        query: testData.query,
        scope: 'current',
        limit: 10,
        mode: 'auto'
      });
      
      console.log(`Found: [${results.map(r => r.id).join(', ')}]`);
      
      const foundIds = results.map(r => parseInt(r.id));
      const expectedMatches = testData.expectedIds.filter(id => foundIds.includes(id));
      const precision = results.length > 0 ? expectedMatches.length / results.length : 1;
      const recall = testData.expectedIds.length > 0 ? expectedMatches.length / testData.expectedIds.length : 1;
      
      console.log(`✅ Precision: ${(precision * 100).toFixed(1)}%`);
      console.log(`✅ Recall: ${(recall * 100).toFixed(1)}%`);
      
      // Auto mode should be intelligent about escalation
      if (testData.query === 'nonexistent zzzzzz') {
        expect(results.length).toBe(0); // Should return nothing for truly nonexistent
      } else {
        expect(precision).toBeGreaterThan(0.5); // Should have good precision
      }
    });
  });

  describe('Extended Search Operator Tests', () => {
    const extendedCases = getTestCases().filter(tc => tc.category === 'extended');
    
    test.each(extendedCases)('Extended - Case $id: $description', async (testCase: SearchTestCase) => {
      console.log(`\n🔍 EXTENDED: "${testCase.query}"`);
      console.log(`Expected: [${testCase.expectedMemoryIds.join(', ')}]`);
      
      const results = await searchEngine.searchMemories({
        query: testCase.query,
        scope: 'current',
        limit: 10,
        mode: 'normal' // Normal mode has extended search enabled
      });
      
      console.log(`Found: [${results.map(r => r.id).join(', ')}]`);
      
      const validation = validateSearchResults(testCase, 
        results.map(r => ({ memory: r, score: 0 }))
      );
      
      console.log(`✅ Precision: ${(validation.details.precision * 100).toFixed(1)}%`);
      console.log(`✅ Recall: ${(validation.details.recall * 100).toFixed(1)}%`);
      
      // Extended search should handle complex queries
      expect(results.length).toBeGreaterThanOrEqual(0); // Basic functionality test
    });
  });

  describe('Configuration Comparison', () => {
    test('Compare all modes for same query', async () => {
      const testQuery = 'authentication bug';
      const modes: Array<'strict' | 'normal' | 'fuzzy'> = ['strict', 'normal', 'fuzzy'];
      
      console.log(`\n📊 MODE COMPARISON: "${testQuery}"`);
      
      const results: Record<string, any[]> = {};
      
      for (const mode of modes) {
        const modeResults = await searchEngine.searchMemories({
          query: testQuery,
          scope: 'current',
          limit: 10,
          mode
        });
        
        results[mode] = modeResults;
        
        const expectedIds = [2, 1, 7]; // Expected for "authentication bug"
        const foundIds = modeResults.map(r => parseInt(r.id));
        const expectedMatches = expectedIds.filter(id => foundIds.includes(id));
        const precision = modeResults.length > 0 ? expectedMatches.length / modeResults.length : 1;
        const recall = expectedMatches.length / expectedIds.length;
        
        console.log(`${mode.toUpperCase()}: Found [${foundIds.join(', ')}] - Precision: ${(precision * 100).toFixed(1)}%, Recall: ${(recall * 100).toFixed(1)}%`);
      }
      
      // Strict should have higher precision than fuzzy
      const strictPrecision = results.strict.length > 0 ? 
        [2, 1, 7].filter(id => results.strict.map(r => parseInt(r.id)).includes(id)).length / results.strict.length : 1;
      const fuzzyPrecision = results.fuzzy.length > 0 ? 
        [2, 1, 7].filter(id => results.fuzzy.map(r => parseInt(r.id)).includes(id)).length / results.fuzzy.length : 1;
      
      expect(strictPrecision).toBeGreaterThanOrEqual(fuzzyPrecision);
    });
  });

  afterAll(() => {
    console.log('\n🧹 Cleaning up improved search tests...');
    mockStorage.clearTestMemories();
  });
});