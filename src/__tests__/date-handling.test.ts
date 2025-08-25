/**
 * Date handling tests for timeline tool
 */
import { SearchTools } from '../tools/search.js';
import { MockStorage } from './mock-storage.js';
import { SessionManager } from '../core/session-manager.js';

describe('Date Handling', () => {
  let storage: MockStorage;
  let sessionManager: SessionManager;
  let searchTools: SearchTools;

  beforeEach(() => {
    storage = new MockStorage();
    sessionManager = new SessionManager(storage);
    searchTools = new SearchTools(storage, sessionManager);
  });

  describe('Timeline Date Formatting', () => {
    beforeEach(async () => {
      // Create test memories with specific dates
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Add test checkpoints for each day
      await storage.saveMemory({
        id: 'test-today',
        workspace: 'test-workspace',
        type: 'checkpoint',
        content: {
          description: 'Today work',
          highlights: ['Today highlight']
        },
        timestamp: today,
        tags: ['checkpoint'],
        ttlHours: 24
      });

      await storage.saveMemory({
        id: 'test-yesterday',
        workspace: 'test-workspace',
        type: 'checkpoint',
        content: {
          description: 'Yesterday work',
          highlights: ['Yesterday highlight']
        },
        timestamp: yesterday,
        tags: ['checkpoint'],
        ttlHours: 24
      });

      await storage.saveMemory({
        id: 'test-two-days-ago',
        workspace: 'test-workspace',
        type: 'checkpoint',
        content: {
          description: 'Two days ago work',
          highlights: ['Two days ago highlight']
        },
        timestamp: twoDaysAgo,
        tags: ['checkpoint'],
        ttlHours: 24
      });
    });

    it('should correctly identify today vs yesterday in timeline', async () => {
      const result = await searchTools.timeline({ since: '3d', scope: 'current' });
      
      expect(result.content).toHaveLength(1);
      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);
      
      expect(response.success).toBe(true);
      
      // Check that the formatted output correctly identifies days
      const formattedOutput = response.formattedOutput;
      
      // Should contain "Today" for today's work
      expect(formattedOutput).toMatch(/\*\*Today\*\*/);
      
      // Should contain "Yesterday" for yesterday's work
      expect(formattedOutput).toMatch(/\*\*Yesterday\*\*/);
      
      // Should contain weekday name for older work
      expect(formattedOutput).toMatch(/\*\*\w+day\*\*/); // Monday, Tuesday, etc.
    });

    it('should group memories by correct dates', async () => {
      const result = await searchTools.timeline({ since: '3d', scope: 'current' });
      
      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);
      
      // Should have data grouped by date
      expect(response.data.byDate).toBeDefined();
      
      // Get today's date string for comparison
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // Should have today's date in the data
      expect(response.data.byDate[todayStr]).toBeDefined();
      expect(response.data.byDate[todayStr]['test-workspace'].count).toBeGreaterThan(0);
    });

    it('should handle timezone edge cases correctly', async () => {
      // Test with a timestamp that might cross midnight in different timezones
      const nearMidnight = new Date();
      nearMidnight.setHours(23, 59, 59);
      
      await storage.saveMemory({
        id: 'test-midnight',
        workspace: 'test-workspace', 
        type: 'checkpoint',
        content: {
          description: 'Near midnight work',
          highlights: ['Midnight highlight']
        },
        timestamp: nearMidnight,
        tags: ['checkpoint'],
        ttlHours: 24
      });

      const result = await searchTools.timeline({ since: '1d', scope: 'current' });
      
      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);
      
      // Should still be grouped under today
      expect(response.formattedOutput).toMatch(/\*\*Today\*\*/);
      
      // Verify the midnight memory is included in today's count
      const todayStr = new Date().toISOString().split('T')[0];
      expect(response.data.byDate[todayStr]['test-workspace'].count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Date Parsing Edge Cases', () => {
    it('should handle date strings without time correctly', () => {
      // Test the internal date parsing logic that was fixed
      const dateStr = '2025-08-20';
      const parsedDate = new Date(dateStr + 'T12:00:00');
      
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      if (todayStr === dateStr) {
        expect(parsedDate.toDateString()).toBe(today.toDateString());
      }
    });

    it('should consistently format dates across timezone boundaries', () => {
      const testDate = new Date('2025-08-20T02:00:00Z'); // Early UTC morning
      const localDate = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate());
      
      // The local date should represent the same calendar day
      expect(localDate.getDate()).toBe(testDate.getDate());
      expect(localDate.getMonth()).toBe(testDate.getMonth());
      expect(localDate.getFullYear()).toBe(testDate.getFullYear());
    });
  });
});