/**
 * Bug Analysis - Root Cause Found: Date Offset Bug in Timeline Function
 * 
 * CRITICAL BUG DISCOVERED:
 * The timeline function (search.ts lines 175-176) creates date keys that are OFF BY ONE DAY
 * 
 * EVIDENCE:
 * - Test expects: '2025-08-26' (today)
 * - Actual result: '2025-08-25' (yesterday)
 * - This causes byDate[todayStr] to be undefined
 * 
 * ROOT CAUSE ANALYSIS:
 * The bug is in this line (search.ts:175-176):
 * ```
 * const date = new Date(memory.timestamp.getFullYear(), memory.timestamp.getMonth(), memory.timestamp.getDate())
 *   .toISOString().split('T')[0] || 'unknown';
 * ```
 * 
 * PROBLEM: When constructing a new Date() with local date components, then calling .toISOString(),
 * the timezone conversion can shift the date by one day if the local timezone is behind UTC.
 * 
 * SOLUTION NEEDED: Use consistent date handling that doesn't mix local and UTC operations
 */

import { SearchTools } from '../tools/search.js';
import { MockStorage } from './mock-storage.js';
import { SessionManager } from '../core/session-manager.js';

describe('BUG ANALYSIS: Root Cause - Date Offset in Timeline Function', () => {
  let storage: MockStorage;
  let sessionManager: SessionManager;
  let searchTools: SearchTools;

  beforeEach(() => {
    storage = new MockStorage();
    sessionManager = new SessionManager(storage);
    searchTools = new SearchTools(storage, sessionManager);
  });

  describe('Root Cause Demonstration', () => {
    it('DEMONSTRATES: Timeline function creates wrong date keys due to timezone conversion bug', async () => {
      // Create a checkpoint with today's timestamp
      const now = new Date();
      console.log('Current timestamp:', now.toISOString());
      console.log('Current local date components:', {
        year: now.getFullYear(),
        month: now.getMonth(),
        date: now.getDate()
      });

      await storage.saveMemory({
        id: 'root-cause-test',
        workspace: 'test-workspace',
        type: 'checkpoint',
        content: { description: 'Root cause analysis' },
        timestamp: now,
        tags: ['checkpoint'],
        ttlHours: 24
      });

      const result = await searchTools.timeline({ since: '1d', scope: 'current' });
      const response = JSON.parse(result.content[0].text);

      // Show what the current buggy logic produces
      console.log('\n=== ROOT CAUSE ANALYSIS ===');
      console.log('Expected date key (today):', now.toISOString().split('T')[0]);
      console.log('Actual date keys produced:', Object.keys(response.data.byDate));

      // Demonstrate the buggy conversion
      const buggyConversion = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        .toISOString().split('T')[0];
      console.log('Buggy conversion result:', buggyConversion);
      
      // Show correct conversion
      const correctConversion = now.toISOString().split('T')[0];
      console.log('Correct conversion result:', correctConversion);

      console.log('\n=== THE BUG ===');
      console.log('The timeline function mixes local date components with UTC conversion:');
      console.log('1. Takes local date components: getFullYear(), getMonth(), getDate()');
      console.log('2. Creates new Date() with these components (creates local midnight)');
      console.log('3. Calls .toISOString() which converts to UTC');
      console.log('4. If local timezone is behind UTC, this shifts the date backwards');
      
      // This test now PASSES because the bug has been fixed
      // The implementation now uses local date keys, so we need to check for that
      const localDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(Object.keys(response.data.byDate)).toContain(localDateKey);
    });

    it('DEMONSTRATES: Multiple timestamps on same local day get scattered across dates', async () => {
      const baseTime = new Date();
      
      // Create multiple checkpoints throughout the day
      const timestamps = [
        new Date(baseTime.getFullYear(), baseTime.getMonth(), baseTime.getDate(), 0, 30), // 12:30 AM
        new Date(baseTime.getFullYear(), baseTime.getMonth(), baseTime.getDate(), 12, 0), // 12:00 PM
        new Date(baseTime.getFullYear(), baseTime.getMonth(), baseTime.getDate(), 23, 30) // 11:30 PM
      ];

      for (let i = 0; i < timestamps.length; i++) {
        await storage.saveMemory({
          id: `scatter-test-${i}`,
          workspace: 'test-workspace',
          type: 'checkpoint',
          content: { description: `Checkpoint ${i} at ${timestamps[i].toLocaleTimeString()}` },
          timestamp: timestamps[i],
          tags: ['checkpoint'],
          ttlHours: 24
        });
      }

      const result = await searchTools.timeline({ since: '1d', scope: 'current' });
      const response = JSON.parse(result.content[0].text);

      console.log('\n=== SCATTERING EFFECT ===');
      console.log('All timestamps are on same local calendar day:');
      timestamps.forEach((ts, i) => {
        console.log(`  ${i}: ${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`);
      });

      console.log('\nBut timeline groups them as:');
      Object.keys(response.data.byDate).forEach(dateKey => {
        const count = response.data.byDate[dateKey]['test-workspace']?.count || 0;
        console.log(`  ${dateKey}: ${count} checkpoints`);
      });

      // This demonstrates how checkpoints from the same local day get scattered
      const dateKeys = Object.keys(response.data.byDate);
      console.log(`\nResult: ${timestamps.length} checkpoints from same local day scattered across ${dateKeys.length} date keys`);
    });
  });

  describe('Expected Behavior Specification', () => {
    it('SPECIFICATION: Timeline should group by local calendar date, not UTC conversion artifacts', () => {
      // This test documents what the FIXED implementation should do:
      
      console.log('\n=== EXPECTED BEHAVIOR FOR IMPLEMENTER ===');
      console.log('1. Timeline function should group memories by local calendar date');
      console.log('2. All memories from same local day should appear under same date key');
      console.log('3. Date key format should be YYYY-MM-DD in local timezone');
      console.log('4. Avoid mixing local date components with UTC string conversion');
      
      console.log('\n=== SUGGESTED FIX ===');
      console.log('Replace buggy lines 175-176 in search.ts:');
      console.log('  OLD (buggy):');
      console.log('    const date = new Date(memory.timestamp.getFullYear(), memory.timestamp.getMonth(), memory.timestamp.getDate())');
      console.log('      .toISOString().split("T")[0] || "unknown";');
      console.log('');
      console.log('  NEW (correct):');
      console.log('    const date = memory.timestamp.toLocaleDateString("en-CA") || "unknown"; // en-CA gives YYYY-MM-DD format');
      console.log('  OR:');
      console.log('    const year = memory.timestamp.getFullYear();');
      console.log('    const month = String(memory.timestamp.getMonth() + 1).padStart(2, "0");');
      console.log('    const day = String(memory.timestamp.getDate()).padStart(2, "0");');
      console.log('    const date = `${year}-${month}-${day}`;');
    });
  });

  describe('Edge Cases That Must Be Handled', () => {
    it('EDGE CASE: Timezone boundaries (near midnight)', async () => {
      console.log('\n=== EDGE CASE REQUIREMENTS ===');
      console.log('1. Memory created at 11:59 PM local time should group with that local day');
      console.log('2. Memory created at 12:01 AM local time should group with that local day');
      console.log('3. Timezone offset should not affect local date grouping');
      console.log('4. DST transitions should not cause date jumping');
    });

    it('EDGE CASE: Multiple timezones (for reference)', () => {
      console.log('\n=== TIMEZONE CONSIDERATIONS ===');
      console.log('The fix should work correctly regardless of:');
      console.log('- User\'s local timezone offset from UTC');
      console.log('- Daylight saving time transitions');
      console.log('- System timezone settings');
      console.log('');
      console.log('Key principle: Group by local calendar date, not UTC date artifacts');
    });
  });
});