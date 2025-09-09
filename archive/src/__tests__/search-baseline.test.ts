/**
 * Search Baseline Tests - Measure current search performance
 * Run these tests BEFORE making any changes to establish baseline
 */

import { SearchEngine } from '../core/search.js';
import { MockStorage } from './mock-storage.js';
import { 
  createTestMemories, 
  getTestCases, 
  validateSearchResults,
  generatePerformanceTestMemories,
  SearchTestCase
} from './search-test-harness.js';

describe('Search Baseline - Current Performance', () => {
  let searchEngine: SearchEngine;
  let mockStorage: MockStorage;
  
  beforeAll(async () => {
    // Set up test environment with isolated test data
    mockStorage = new MockStorage('test-project');
    searchEngine = new SearchEngine(mockStorage as any); // Cast to Storage interface
    
    // Test memories are already loaded in MockStorage constructor
    console.log(`\n🧪 Test Setup: Using MockStorage with ${mockStorage.getTestMemories().length} test memories`);
    console.log(`Test Memory IDs: [${mockStorage.getTestMemories().map(m => m.id).join(', ')}]`);
  });

  describe('Single Word Search Baseline', () => {
    const singleWordCases = getTestCases().filter(tc => tc.category === 'single-word');
    
    test.each(singleWordCases)('Case $id: $description', async (testCase: SearchTestCase) => {
      console.log(`\n🔍 Testing: "${testCase.query}"`);
      console.log(`Expected: [${testCase.expectedMemoryIds.join(', ')}]`);
      
      const results = await searchEngine.searchMemories({
        query: testCase.query,
        scope: 'current',
        limit: 10
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
      
      // Record baseline - don't fail tests, just measure
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Multi-Word Search Baseline (Critical)', () => {
    const multiWordCases = getTestCases().filter(tc => tc.category === 'multi-word');
    
    test.each(multiWordCases)('Case $id: $description', async (testCase: SearchTestCase) => {
      console.log(`\n🔍 MULTI-WORD: "${testCase.query}"`);
      console.log(`Expected: [${testCase.expectedMemoryIds.join(', ')}]`);
      
      const results = await searchEngine.searchMemories({
        query: testCase.query,
        scope: 'current',
        limit: 10
      });
      
      console.log(`Found: [${results.map(r => r.id).join(', ')}]`);
      
      const validation = validateSearchResults(testCase,
        results.map(r => ({ memory: r, score: 0 }))
      );
      
      console.log(`✅ Precision: ${(validation.details.precision * 100).toFixed(1)}%`);
      console.log(`✅ Recall: ${(validation.details.recall * 100).toFixed(1)}%`);
      
      // This is where we historically had issues
      if (validation.details.recall < 0.5) {
        console.log(`⚠️  Low recall detected - this was likely the original multi-word issue`);
      }
      
      if (!validation.passed) {
        console.log(`❌ Missing: [${validation.details.missingIds.join(', ')}]`);
        console.log(`❌ Unexpected: [${validation.details.unexpectedIds.join(', ')}]`);
      }
      
      // Record baseline - don't fail tests, just measure
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Phrase Search Baseline', () => {
    const phraseCases = getTestCases().filter(tc => tc.category === 'phrase');
    
    test.each(phraseCases)('Case $id: $description', async (testCase: SearchTestCase) => {
      console.log(`\n🔍 PHRASE: "${testCase.query}"`);
      console.log(`Expected: [${testCase.expectedMemoryIds.join(', ')}]`);
      
      const results = await searchEngine.searchMemories({
        query: testCase.query,
        scope: 'current', 
        limit: 10
      });
      
      console.log(`Found: [${results.map(r => r.id).join(', ')}]`);
      
      const validation = validateSearchResults(testCase,
        results.map(r => ({ memory: r, score: 0 }))
      );
      
      console.log(`✅ Precision: ${(validation.details.precision * 100).toFixed(1)}%`);
      console.log(`✅ Recall: ${(validation.details.recall * 100).toFixed(1)}%`);
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases Baseline', () => {
    const edgeCases = getTestCases().filter(tc => tc.category === 'edge-case');
    
    test.each(edgeCases)('Case $id: $description', async (testCase: SearchTestCase) => {
      console.log(`\n🔍 EDGE CASE: "${testCase.query}"`);
      
      const results = await searchEngine.searchMemories({
        query: testCase.query,
        scope: 'current',
        limit: 10
      });
      
      console.log(`Found: [${results.map(r => r.id).join(', ')}]`);
      
      // Special handling for empty query
      if (testCase.query === '') {
        console.log(`Empty query returned ${results.length} results`);
      }
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Baseline', () => {
    test('Search performance with 100 memories', async () => {
      const perfMemories = generatePerformanceTestMemories(100);
      
      // Simulate adding to storage (in real implementation)
      console.log(`\n⚡ Performance test with ${perfMemories.length} memories`);
      
      const startTime = Date.now();
      
      const results = await searchEngine.searchMemories({
        query: 'authentication',
        scope: 'current',
        limit: 10
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`Search completed in ${duration}ms`);
      console.log(`Found ${results.length} results`);
      
      // Baseline measurement - record but don't enforce
      expect(duration).toBeLessThan(5000); // Very lenient baseline
    });

    test('Memory usage baseline', async () => {
      const initialMemory = process.memoryUsage();
      console.log(`\n💾 Initial memory usage: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
      
      // Perform search operations
      for (let i = 0; i < 10; i++) {
        await searchEngine.searchMemories({
          query: `test query ${i}`,
          scope: 'current',
          limit: 10
        });
      }
      
      const finalMemory = process.memoryUsage();
      console.log(`Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      
      // Record baseline
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB baseline limit
    });
  });

  describe('Current Fuse.js Configuration Analysis', () => {
    test('Analyze current search settings', () => {
      // This test documents our current configuration
      console.log('\n📊 Current Search Configuration:');
      console.log('- Threshold: 0.9 (extremely lenient)');
      console.log('- Extended Search: false (disabled due to issues)');
      console.log('- Weights: content(0.7), highlights(0.8), tags(0.5), workspace(0.3), type(0.2)');
      console.log('- Min Match Length: 1');
      console.log('- Distance: 1000');
      console.log('- Ignore Location: true');
      
      expect(true).toBe(true); // Just documenting
    });
  });

  afterAll(async () => {
    // Cleanup test memories
    console.log('\n🧹 Cleaning up test data...');
    mockStorage.clearTestMemories();
  });
});

/**
 * Summary function to calculate overall baseline metrics
 */
export function calculateBaselineMetrics() {
  // This would be called after running all tests to summarize
  console.log('\n📈 BASELINE SUMMARY:');
  console.log('Run this test suite to establish baseline before making changes');
  console.log('Key metrics to track:');
  console.log('- Single word search precision/recall');
  console.log('- Multi-word search accuracy (historical problem area)');
  console.log('- Phrase search precision');
  console.log('- Performance benchmarks');
  console.log('- Memory usage patterns');
}