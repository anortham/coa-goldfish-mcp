/**
 * Search Validation Tests - Validate success criteria
 * Success Criteria: 80% precision, 90% recall, 75% multi-word accuracy
 */

import { SearchEngine } from '../core/search.js';
import { MockStorage } from './mock-storage.js';
import { 
  getTestCases, 
  validateSearchResults,
  SearchTestCase
} from './search-test-harness.js';

describe('Search Validation - Success Criteria', () => {
  let searchEngine: SearchEngine;
  let mockStorage: MockStorage;
  
  beforeAll(async () => {
    mockStorage = new MockStorage('test-project');
    searchEngine = new SearchEngine(mockStorage as any);
    console.log(`\n🎯 VALIDATION: Testing search success criteria`);
  });

  describe('Precision Target: 80%', () => {
    test('Single word queries should achieve 80%+ precision', async () => {
      const singleWordCases = getTestCases().filter(tc => tc.category === 'single-word' && tc.expectedMemoryIds.length > 0);
      let totalPrecision = 0;
      let testCount = 0;
      
      console.log('\n📊 PRECISION ANALYSIS - Single Word:');
      
      for (const testCase of singleWordCases) {
        const results = await searchEngine.searchMemories({
          query: testCase.query,
          scope: 'current',
          limit: 10,
          mode: 'normal'
        });
        
        const validation = validateSearchResults(testCase, 
          results.map(r => ({ memory: r, score: 0 }))
        );
        
        console.log(`"${testCase.query}": ${(validation.details.precision * 100).toFixed(1)}% precision`);
        totalPrecision += validation.details.precision;
        testCount++;
      }
      
      const averagePrecision = totalPrecision / testCount;
      console.log(`📈 Average Single Word Precision: ${(averagePrecision * 100).toFixed(1)}%`);
      
      expect(averagePrecision).toBeGreaterThanOrEqual(0.8); // 80% target
    });

    test('Multi-word queries should achieve 75%+ precision', async () => {
      const multiWordCases = getTestCases().filter(tc => tc.category === 'multi-word' && tc.expectedMemoryIds.length > 0);
      let totalPrecision = 0;
      let testCount = 0;
      
      console.log('\n📊 PRECISION ANALYSIS - Multi-Word:');
      
      for (const testCase of multiWordCases) {
        const results = await searchEngine.searchMemories({
          query: testCase.query,
          scope: 'current',
          limit: 10,
          mode: 'normal'
        });
        
        const validation = validateSearchResults(testCase, 
          results.map(r => ({ memory: r, score: 0 }))
        );
        
        console.log(`"${testCase.query}": ${(validation.details.precision * 100).toFixed(1)}% precision`);
        totalPrecision += validation.details.precision;
        testCount++;
      }
      
      const averagePrecision = totalPrecision / testCount;
      console.log(`📈 Average Multi-Word Precision: ${(averagePrecision * 100).toFixed(1)}%`);
      
      expect(averagePrecision).toBeGreaterThanOrEqual(0.75); // 75% target for multi-word
    });
  });

  describe('Recall Target: 90%', () => {
    test('All queries should achieve 90%+ recall', async () => {
      const allCases = getTestCases().filter(tc => 
        ['single-word', 'multi-word', 'phrase'].includes(tc.category) && 
        tc.expectedMemoryIds.length > 0
      );
      let totalRecall = 0;
      let testCount = 0;
      
      console.log('\n📊 RECALL ANALYSIS:');
      
      for (const testCase of allCases) {
        const results = await searchEngine.searchMemories({
          query: testCase.query,
          scope: 'current',
          limit: 10,
          mode: 'normal'
        });
        
        const validation = validateSearchResults(testCase, 
          results.map(r => ({ memory: r, score: 0 }))
        );
        
        console.log(`"${testCase.query}": ${(validation.details.recall * 100).toFixed(1)}% recall`);
        totalRecall += validation.details.recall;
        testCount++;
      }
      
      const averageRecall = totalRecall / testCount;
      console.log(`📈 Average Recall: ${(averageRecall * 100).toFixed(1)}%`);
      
      expect(averageRecall).toBeGreaterThanOrEqual(0.9); // 90% target
    });
  });

  describe('Overall Performance Metrics', () => {
    test('Complete performance analysis', async () => {
      const categories = ['single-word', 'multi-word', 'phrase'];
      const results: Record<string, { precision: number; recall: number; f1: number; count: number }> = {};
      
      console.log('\n📊 COMPLETE PERFORMANCE ANALYSIS:');
      
      for (const category of categories) {
        const cases = getTestCases().filter(tc => tc.category === category && tc.expectedMemoryIds.length > 0);
        let totalPrecision = 0;
        let totalRecall = 0;
        
        for (const testCase of cases) {
          const searchResults = await searchEngine.searchMemories({
            query: testCase.query,
            scope: 'current',
            limit: 10,
            mode: 'normal'
          });
          
          const validation = validateSearchResults(testCase, 
            searchResults.map(r => ({ memory: r, score: 0 }))
          );
          
          totalPrecision += validation.details.precision;
          totalRecall += validation.details.recall;
        }
        
        const avgPrecision = totalPrecision / cases.length;
        const avgRecall = totalRecall / cases.length;
        const f1Score = avgPrecision + avgRecall > 0 ? (2 * avgPrecision * avgRecall) / (avgPrecision + avgRecall) : 0;
        
        results[category] = {
          precision: avgPrecision,
          recall: avgRecall,
          f1: f1Score,
          count: cases.length
        };
        
        console.log(`${category.toUpperCase()}:`);
        console.log(`  Precision: ${(avgPrecision * 100).toFixed(1)}% (${cases.length} tests)`);
        console.log(`  Recall: ${(avgRecall * 100).toFixed(1)}%`);
        console.log(`  F1 Score: ${(f1Score * 100).toFixed(1)}%`);
      }
      
      // Calculate overall metrics
      const totalTests = Object.values(results).reduce((sum, r) => sum + r.count, 0);
      const weightedPrecision = Object.values(results).reduce((sum, r) => sum + (r.precision * r.count), 0) / totalTests;
      const weightedRecall = Object.values(results).reduce((sum, r) => sum + (r.recall * r.count), 0) / totalTests;
      const overallF1 = (2 * weightedPrecision * weightedRecall) / (weightedPrecision + weightedRecall);
      
      console.log(`\n🎯 OVERALL RESULTS:`);
      console.log(`  Precision: ${(weightedPrecision * 100).toFixed(1)}% (Target: 80%+)`);
      console.log(`  Recall: ${(weightedRecall * 100).toFixed(1)}% (Target: 90%+)`);
      console.log(`  F1 Score: ${(overallF1 * 100).toFixed(1)}%`);
      console.log(`  Multi-Word Accuracy: ${(results['multi-word'].precision * 100).toFixed(1)}% (Target: 75%+)`);
      
      // Validate success criteria
      expect(weightedPrecision).toBeGreaterThanOrEqual(0.8); // 80% precision
      expect(weightedRecall).toBeGreaterThanOrEqual(0.9); // 90% recall
      expect(results['multi-word'].precision).toBeGreaterThanOrEqual(0.75); // 75% multi-word accuracy
      
      console.log(`\n✅ SUCCESS CRITERIA MET!`);
    });
  });

  describe('Comparison with Baseline', () => {
    test('Show improvement over baseline', async () => {
      const testQuery = 'authentication bug';
      
      console.log(`\n📈 IMPROVEMENT ANALYSIS: "${testQuery}"`);
      
      // Test with old configuration (approximated)
      const baselineResults = await searchEngine.searchMemories({
        query: testQuery,
        scope: 'current',
        limit: 10,
        mode: 'fuzzy' // Closest to old 0.9 threshold
      });
      
      // Test with improved configuration
      const improvedResults = await searchEngine.searchMemories({
        query: testQuery,
        scope: 'current',
        limit: 10,
        mode: 'normal' // Our improved default
      });
      
      const expectedIds = [2, 1, 7]; // Expected for this query
      
      // Calculate baseline metrics
      const baselineFoundIds = baselineResults.map(r => parseInt(r.id));
      const baselineMatches = expectedIds.filter(id => baselineFoundIds.includes(id));
      const baselinePrecision = baselineResults.length > 0 ? baselineMatches.length / baselineResults.length : 1;
      const baselineRecall = baselineMatches.length / expectedIds.length;
      
      // Calculate improved metrics  
      const improvedFoundIds = improvedResults.map(r => parseInt(r.id));
      const improvedMatches = expectedIds.filter(id => improvedFoundIds.includes(id));
      const improvedPrecision = improvedResults.length > 0 ? improvedMatches.length / improvedResults.length : 1;
      const improvedRecall = improvedMatches.length / expectedIds.length;
      
      console.log(`Baseline (Fuzzy): Found [${baselineFoundIds.join(', ')}]`);
      console.log(`  Precision: ${(baselinePrecision * 100).toFixed(1)}%, Recall: ${(baselineRecall * 100).toFixed(1)}%`);
      console.log(`Improved (Normal): Found [${improvedFoundIds.join(', ')}]`);
      console.log(`  Precision: ${(improvedPrecision * 100).toFixed(1)}%, Recall: ${(improvedRecall * 100).toFixed(1)}%`);
      
      const precisionImprovement = ((improvedPrecision - baselinePrecision) / baselinePrecision) * 100;
      console.log(`📈 Precision Improvement: ${precisionImprovement.toFixed(1)}%`);
      
      // Should show improvement
      expect(improvedPrecision).toBeGreaterThanOrEqual(baselinePrecision);
    });
  });

  afterAll(() => {
    console.log('\n🧹 Validation tests complete');
    mockStorage.clearTestMemories();
  });
});