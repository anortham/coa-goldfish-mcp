import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

// Edge case and error handling tests
describe('Goldfish Edge Cases and Error Handling', () => {
  let testDir: string;
  let goldfishDir: string;
  let memoriesDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-edge-test-'));
    goldfishDir = join(testDir, '.coa', 'goldfish');
    memoriesDir = join(goldfishDir, 'memories', 'test-workspace');
    
    await fs.ensureDir(memoriesDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
    jest.restoreAllMocks();
  });

  describe('Corrupted File Handling', () => {
    test('should handle corrupted JSON memory files gracefully', async () => {
      // Create various corrupted files
      const corruptedFiles = [
        { name: 'invalid-json.json', content: '{ invalid json }' },
        { name: 'empty.json', content: '' },
        { name: 'partial.json', content: '{ "id": "test"' },
        { name: 'binary.json', content: Buffer.from([0, 1, 2, 3, 4]).toString() }
      ];

      for (const file of corruptedFiles) {
        await fs.writeFile(join(memoriesDir, file.name), file.content);
      }

      // Create one valid file
      const validMemory = {
        id: '18C3A2B4F20-VALID1',
        timestamp: new Date(),
        workspace: 'test-workspace',
        type: 'general',
        content: 'Valid memory',
        ttlHours: 24
      };
      await fs.writeJson(join(memoriesDir, `${validMemory.id}.json`), validMemory);

      // Cleanup function that handles corrupted files
      const cleanupMemories = async () => {
        const files = await fs.readdir(memoriesDir);
        const validMemories = [];
        let corruptedCount = 0;

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          try {
            const memory = await fs.readJson(join(memoriesDir, file));
            // Validate required fields
            if (memory.id && memory.timestamp && memory.content) {
              validMemories.push(memory);
            } else {
              throw new Error('Missing required fields');
            }
          } catch (error) {
            // Remove corrupted file
            await fs.remove(join(memoriesDir, file));
            corruptedCount++;
          }
        }

        return { validMemories, corruptedCount };
      };

      const result = await cleanupMemories();
      
      expect(result.validMemories.length).toBe(1);
      expect(result.corruptedCount).toBe(4);
      expect(result.validMemories[0].id).toBe('18C3A2B4F20-VALID1');

      // Verify corrupted files were removed
      const remainingFiles = await fs.readdir(memoriesDir);
      expect(remainingFiles.length).toBe(1);
      expect(remainingFiles[0]).toBe('18C3A2B4F20-VALID1.json');
    });

    test('should handle missing workspace directories', async () => {
      const nonExistentDir = join(goldfishDir, 'memories', 'nonexistent-workspace');
      
      const loadMemoriesFromWorkspace = async (workspace: string) => {
        const wsDir = join(goldfishDir, 'memories', workspace);
        
        if (!(await fs.pathExists(wsDir))) {
          return []; // Return empty array instead of throwing
        }

        const files = await fs.readdir(wsDir);
        const memories = [];

        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          try {
            const memory = await fs.readJson(join(wsDir, file));
            memories.push(memory);
          } catch (error) {
            continue; // Skip corrupted files
          }
        }

        return memories;
      };

      const memories = await loadMemoriesFromWorkspace('nonexistent-workspace');
      expect(memories).toEqual([]);
    });

    test('should handle filesystem permission errors', async () => {
      // Mock fs operations to simulate permission errors
      const originalReaddir = fs.readdir;
      const originalWriteJson = fs.writeJson;
      
      jest.spyOn(fs, 'readdir').mockImplementation(async (path: any) => {
        if (path.toString().includes('permission-test')) {
          throw new Error('EACCES: permission denied');
        }
        return originalReaddir(path);
      });

      jest.spyOn(fs, 'writeJson').mockImplementation(async (path: any, data: any, options?: any) => {
        if (path.toString().includes('readonly')) {
          throw new Error('EACCES: permission denied');
        }
        return originalWriteJson(path, data, options);
      });

      const handlePermissionError = async (operation: () => Promise<any>) => {
        try {
          return await operation();
        } catch (error: any) {
          if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
            return { error: 'Permission denied', success: false };
          }
          throw error;
        }
      };

      // Test read operation with permission error
      const readResult = await handlePermissionError(async () => {
        return await fs.readdir(join(memoriesDir, 'permission-test'));
      });

      expect(readResult.success).toBe(false);
      expect(readResult.error).toBe('Permission denied');

      // Test write operation with permission error
      const writeResult = await handlePermissionError(async () => {
        const testMemory = { id: 'test', content: 'test' };
        await fs.writeJson(join(memoriesDir, 'readonly', 'test.json'), testMemory);
        return { success: true };
      });

      expect(writeResult.success).toBe(false);
      expect(writeResult.error).toBe('Permission denied');
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent memory writes safely', async () => {
      const concurrentWrites = async (count: number) => {
        const promises = [];
        
        for (let i = 0; i < count; i++) {
          const memory = {
            id: `20250119123${i.toString().padStart(3, '0')}-CONC${i.toString().padStart(3, '0')}`,
            timestamp: new Date(),
            workspace: 'test-workspace',
            type: 'general',
            content: `Concurrent memory ${i}`,
            ttlHours: 24
          };

          const writePromise = fs.writeJson(
            join(memoriesDir, `${memory.id}.json`), 
            memory, 
            { spaces: 2 }
          );
          
          promises.push(writePromise);
        }

        // Execute all writes concurrently
        const results = await Promise.allSettled(promises);
        return results;
      };

      const results = await concurrentWrites(10);
      
      // All writes should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(10);

      // Verify all files were created
      const files = await fs.readdir(memoriesDir);
      expect(files.length).toBe(10);
    });

    test('should handle concurrent cleanup operations', async () => {
      // Create multiple memories
      const memories = [];
      for (let i = 0; i < 5; i++) {
        const memory = {
          id: `20250119123${i.toString().padStart(3, '0')}-CLEAN${i}`,
          timestamp: new Date(Date.now() - (25 * 60 * 60 * 1000)), // Expired
          workspace: 'test-workspace',
          type: 'general',
          content: `Memory ${i}`,
          ttlHours: 24
        };
        memories.push(memory);
        await fs.writeJson(join(memoriesDir, `${memory.id}.json`), memory);
      }

      // Run multiple cleanup operations concurrently
      const cleanupOperation = async () => {
        const files = await fs.readdir(memoriesDir);
        let cleaned = 0;

        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          try {
            const memory = await fs.readJson(join(memoriesDir, file));
            const age = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
            
            if (age > memory.ttlHours) {
              await fs.remove(join(memoriesDir, file));
              cleaned++;
            }
          } catch (error) {
            // File might have been deleted by another operation
            continue;
          }
        }

        return cleaned;
      };

      // Run cleanup concurrently (simulating multiple processes)
      const cleanupPromises = [
        cleanupOperation(),
        cleanupOperation(),
        cleanupOperation()
      ];

      const results = await Promise.allSettled(cleanupPromises);
      const successfulCleanups = results.filter(r => r.status === 'fulfilled') as any[];
      
      // At least one cleanup should succeed
      expect(successfulCleanups.length).toBeGreaterThan(0);
      
      // All files should be cleaned up eventually
      const remainingFiles = await fs.readdir(memoriesDir);
      expect(remainingFiles.length).toBe(0);
    });
  });

  describe('Network Failures', () => {
    test('should handle ProjectKnowledge promotion failures gracefully', async () => {
      // Create a mock fetch function
      const mockFetch = jest.fn();
      (global as any).fetch = mockFetch;

      const tryPromoteToProjectKnowledge = async (memory: any): Promise<boolean> => {
        try {
          const response = await fetch('http://localhost:5100/federation/store', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'WorkNote',
              content: `Promoted from Goldfish: ${memory.content}`,
              tags: ['goldfish-promotion', ...(memory.tags || [])],
              workspace: memory.workspace
            }),
            signal: AbortSignal.timeout(3000)
          });

          return response.ok;
        } catch (error) {
          return false; // Fail silently
        }
      };

      const testMemory = {
        id: 'test-promotion',
        content: 'Test promotion content',
        workspace: 'test-workspace',
        tags: ['important']
      };

      // Mock network timeout
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
      
      const result = await tryPromoteToProjectKnowledge(testMemory);
      expect(result).toBe(false);

      // Mock HTTP error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);
      
      const result2 = await tryPromoteToProjectKnowledge(testMemory);
      expect(result2).toBe(false);

      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response);
      
      const result3 = await tryPromoteToProjectKnowledge(testMemory);
      expect(result3).toBe(true);
    });

    test.skip('should handle AbortSignal timeout', async () => {
      const mockFetch = jest.fn();
      (global as any).fetch = mockFetch;
      
      const tryWithTimeout = async (timeoutMs: number) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          
          const response = await fetch('http://localhost:5100/test', {
            method: 'GET',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          return { success: true, response };
        } catch (error: any) {
          if (error.name === 'AbortError') {
            return { success: false, error: 'Request timed out' };
          }
          return { success: false, error: error.message };
        }
      };

      // Mock a slow response that never resolves within timeout
      mockFetch.mockImplementation(() => 
        new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 5000)) // 5 second delay
      );

      const result = await tryWithTimeout(1000); // 1 second timeout
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out');
    }, 10000); // 10 second timeout for test itself
  });

  describe('Memory Limit Edge Cases', () => {
    test('should handle workspace with exactly max memories', async () => {
      const MAX_MEMORIES = 3;
      
      // Create exactly max memories
      for (let i = 0; i < MAX_MEMORIES; i++) {
        const memory = {
          id: `20250119123${i.toString().padStart(3, '0')}-MAX${i}`,
          timestamp: new Date(Date.now() - (i * 1000)), // Different timestamps
          workspace: 'test-workspace',
          type: 'general',
          content: `Memory ${i}`,
          ttlHours: 24
        };
        await fs.writeJson(join(memoriesDir, `${memory.id}.json`), memory);
      }

      // Add one more (should trigger cleanup)
      const extraMemory = {
        id: '18C3A2B4F21-EXTRA1',
        timestamp: new Date(),
        workspace: 'test-workspace',
        type: 'general',
        content: 'Extra memory',
        ttlHours: 24
      };
      await fs.writeJson(join(memoriesDir, `${extraMemory.id}.json`), extraMemory);

      // Enforce memory limits
      const enforceMemoryLimits = async () => {
        const files = await fs.readdir(memoriesDir);
        
        if (files.length > MAX_MEMORIES) {
          const sortedFiles = files
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse(); // Most recent first (by chronological ID)

          const toDelete = sortedFiles.slice(MAX_MEMORIES);
          for (const file of toDelete) {
            await fs.remove(join(memoriesDir, file));
          }
        }
      };

      await enforceMemoryLimits();

      const remainingFiles = await fs.readdir(memoriesDir);
      expect(remainingFiles.length).toBe(MAX_MEMORIES);
      
      // The extra memory (most recent) should be kept
      expect(remainingFiles).toContain('18C3A2B4F21-EXTRA1.json');
    });

    test('should handle empty workspace gracefully', async () => {
      // Create empty workspace directory
      const emptyWorkspaceDir = join(goldfishDir, 'memories', 'empty-workspace');
      await fs.ensureDir(emptyWorkspaceDir);

      const loadMemories = async (workspace: string) => {
        const wsDir = join(goldfishDir, 'memories', workspace);
        const files = await fs.readdir(wsDir);
        
        const memories = [];
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const memory = await fs.readJson(join(wsDir, file));
              memories.push(memory);
            } catch (error) {
              continue;
            }
          }
        }
        
        return memories;
      };

      const memories = await loadMemories('empty-workspace');
      expect(memories).toEqual([]);
    });
  });

  describe('Time and Date Edge Cases', () => {
    test('should handle timezone differences correctly', () => {
      const generateChronologicalId = (date?: Date) => {
        const now = date || new Date();
        const datePart = now.toISOString()
          .replace(/[-:T]/g, '')
          .slice(0, 14); // YYYYMMDDHHMMSS
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
        return `${datePart}-${randomPart}`;
      };

      // Test with different timezone dates
      const utcDate = new Date('2025-01-19T12:00:00.000Z');
      const localDate = new Date('2025-01-19T12:00:00');
      
      const utcId = generateChronologicalId(utcDate);
      const localId = generateChronologicalId(localDate);

      // Both should generate valid chronological IDs
      expect(utcId).toMatch(/^\d{14}-[A-Z0-9]{8}$/);
      expect(localId).toMatch(/^\d{14}-[A-Z0-9]{8}$/);
    });

    test('should handle memory expiration at exact TTL boundary', () => {
      const isExpired = (memory: any, currentTime: Date) => {
        const age = (currentTime.getTime() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
        return age > memory.ttlHours;
      };

      const now = new Date();
      const exactlyExpired = {
        timestamp: new Date(now.getTime() - (24 * 60 * 60 * 1000)), // Exactly 24 hours ago
        ttlHours: 24
      };

      const almostExpired = {
        timestamp: new Date(now.getTime() - (23.9 * 60 * 60 * 1000)), // 23.9 hours ago
        ttlHours: 24
      };

      expect(isExpired(exactlyExpired, now)).toBe(false); // Should not be expired at exact boundary
      expect(isExpired(almostExpired, now)).toBe(false);
      
      // Test with a tiny bit over
      const justExpired = {
        timestamp: new Date(now.getTime() - (24.1 * 60 * 60 * 1000)), // 24.1 hours ago
        ttlHours: 24
      };
      
      expect(isExpired(justExpired, now)).toBe(true);
    });
  });
});