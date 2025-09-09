/**
 * Bug Reproduction Tests - Date Handling Timeline Failures
 * 
 * These tests reproduce the exact failures found in date-handling.test.ts:
 * 1. Line 105: byDate object undefined for today's date
 * 2. Line 137: nested workspace structure not created properly
 * 
 * THESE TESTS SHOULD FAIL - They demonstrate the bugs that need fixing
 */

import { SearchTools } from '../tools/search.js';
import { MockStorage } from './mock-storage.js';
import { SessionManager } from '../core/session-manager.js';

describe('BUG FIX VALIDATION: Date Handling Timeline Fixes', () => {
  let storage: MockStorage;
  let sessionManager: SessionManager;
  let searchTools: SearchTools;

  beforeEach(() => {
    storage = new MockStorage();
    sessionManager = new SessionManager(storage);
    searchTools = new SearchTools(storage, sessionManager);
  });

  describe('FIXED: byDate Object Structure Creation', () => {
    beforeEach(async () => {
      // Create a simple test checkpoint for today
      const today = new Date();
      
      await storage.saveMemory({
        id: 'test-today-checkpoint',
        workspace: 'test-workspace',
        type: 'checkpoint',
        content: {
          description: 'Today work session',
          highlights: ['Fixed timeline bug']
        },
        timestamp: today,
        tags: ['checkpoint'],
        ttlHours: 24
      });
    });

    it('NOW PASSES: byDate object correctly contains today\'s date key using local date format', async () => {
      const result = await searchTools.timeline({ since: '1d', scope: 'current' });
      
      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);
      
      // These should all pass now that the bug is fixed
      expect(response.success).toBe(true);
      expect(response.data.byDate).toBeDefined();
      
      // Get today's date string in LOCAL format (as the fixed implementation uses)
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      // THIS NOW PASSES - byDate[todayStr] is properly defined
      expect(response.data.byDate[todayStr]).toBeDefined();
      
      // Log the actual structure to show it's working correctly
      console.log('CORRECT byDate structure:', JSON.stringify(response.data.byDate, null, 2));
      console.log('Found today key:', todayStr);
      console.log('Available keys:', Object.keys(response.data.byDate));
    });

    it('NOW PASSES: nested workspace structure correctly exists with local date key', async () => {
      const result = await searchTools.timeline({ since: '1d', scope: 'current' });
      
      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);
      
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      // Now using correct local date key format - this passes
      expect(response.data.byDate[todayStr]).toBeDefined();
      
      // THIS NOW PASSES - workspace nested structure exists properly
      expect(response.data.byDate[todayStr]['test-workspace']).toBeDefined();
      expect(response.data.byDate[todayStr]['test-workspace'].count).toBeGreaterThan(0);
      
      // Log actual vs expected structure to show it's working
      if (response.data.byDate[todayStr]) {
        console.log('CORRECT workspace structure:', JSON.stringify(response.data.byDate[todayStr], null, 2));
      }
    });
  });

  describe('FIXED: Date Format Consistency Issues', () => {
    beforeEach(async () => {
      // Create checkpoints with different timestamp formats to test edge cases
      const now = new Date();
      
      // Test with exact current time
      await storage.saveMemory({
        id: 'exact-now',
        workspace: 'test-workspace',
        type: 'checkpoint',
        content: { description: 'Exact now timestamp' },
        timestamp: now,
        tags: ['checkpoint'],
        ttlHours: 24
      });
      
      // Test with constructed date using getFullYear, getMonth, getDate
      const constructedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      await storage.saveMemory({
        id: 'constructed-date',
        workspace: 'test-workspace', 
        type: 'checkpoint',
        content: { description: 'Constructed date timestamp' },
        timestamp: constructedDate,
        tags: ['checkpoint'],
        ttlHours: 24
      });
    });

    it('NOW PASSES: date conversion logic creates consistent local date keys', async () => {
      const result = await searchTools.timeline({ since: '1d', scope: 'current' });
      
      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);
      
      // Examine what date keys are actually created
      const dateKeys = Object.keys(response.data.byDate);
      console.log('Generated date keys:', dateKeys);
      
      const today = new Date();
      const expectedTodayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      // The fix: timeline function now uses getLocalDateKey which uses:
      // Local date components directly without UTC conversion
      // This creates consistent date strings
      
      expect(dateKeys).toContain(expectedTodayKey);
      expect(response.data.byDate[expectedTodayKey]).toBeDefined();
      
      // Should have combined both memories under same date
      expect(response.data.byDate[expectedTodayKey]['test-workspace'].count).toBe(2);
    });
  });

  describe('FIXED: Timezone Edge Cases', () => {
    beforeEach(async () => {
      // Create a checkpoint near midnight that might cross date boundaries
      const nearMidnight = new Date();
      nearMidnight.setHours(23, 59, 59, 999);
      
      await storage.saveMemory({
        id: 'near-midnight',
        workspace: 'test-workspace',
        type: 'checkpoint',
        content: {
          description: 'Near midnight checkpoint',
          highlights: ['Late night work']
        },
        timestamp: nearMidnight,
        tags: ['checkpoint'],
        ttlHours: 24
      });
    });

    it('NOW PASSES: near-midnight timestamps correctly group by local date', async () => {
      const result = await searchTools.timeline({ since: '1d', scope: 'current' });
      
      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);
      
      // With the fix, midnight memory is correctly grouped under today's local date
      
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      // This now passes - timezone handling is fixed
      expect(response.data.byDate[todayStr]).toBeDefined();
      expect(response.data.byDate[todayStr]['test-workspace']).toBeDefined();
      expect(response.data.byDate[todayStr]['test-workspace'].count).toBeGreaterThanOrEqual(1);
      
      // Verify it shows "Today" in formatted output
      expect(response.formattedOutput).toMatch(/\*\*Today\*\*/);
    });
  });

  describe('FIXED: Expected vs Actual Behavior Documentation', () => {
    it('NOW PASSES: documents the correct behavior after timeline function bug fix', async () => {
      // Create test data
      const today = new Date();
      await storage.saveMemory({
        id: 'sample-checkpoint',
        workspace: 'test-workspace',
        type: 'checkpoint',
        content: { description: 'Sample work', highlights: ['Key achievement'] },
        timestamp: today,
        tags: ['checkpoint'],
        ttlHours: 24
      });

      const result = await searchTools.timeline({ since: '1d', scope: 'current' });
      const response = JSON.parse(result.content[0].text);
      
      // CORRECT BEHAVIOR (after bug fix):
      // 1. response.data.byDate has date keys in local YYYY-MM-DD format
      // 2. response.data.byDate[dateKey] is an object with workspace keys  
      // 3. response.data.byDate[dateKey][workspaceKey] has { count, highlights }
      
      // FIXED BEHAVIOR:
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      console.log('\n=== FIXED STRUCTURE ===');
      console.log('Correct structure:');
      console.log(`response.data.byDate['${todayKey}']['test-workspace'] = { count: 1, highlights: [...] }`);
      console.log('\nActual structure (now working):');
      console.log(JSON.stringify(response.data.byDate, null, 2));
      
      // These assertions now pass
      expect(response.data.byDate[todayKey]).toBeDefined();
      expect(response.data.byDate[todayKey]['test-workspace']).toBeDefined();
      expect(response.data.byDate[todayKey]['test-workspace'].count).toBeGreaterThan(0);
    });
  });
});