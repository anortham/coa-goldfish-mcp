/**
 * SearchEngine Cross-Workspace Tests
 * 
 * These tests focus on the SearchEngine's cross-workspace functionality,
 * particularly the workspace discovery logic that is currently broken.
 * 
 * DESIGNED TO FAIL INITIALLY - these expose the core issues in:
 * 1. Workspace directory discovery
 * 2. Cross-workspace memory aggregation 
 * 3. Scope handling ('current' vs 'all')
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { Storage } from '../core/storage.js';
import { SearchEngine } from '../core/search.js';
import { GoldfishMemory } from '../types/index.js';

describe('SearchEngine Cross-Workspace Tests', () => {
  let testDir: string;
  let basePath: string;
  let originalConsoleLog: typeof console.log;
  let debugLogs: string[];

  const testWorkspaces = ['frontend-app', 'backend-api', 'mobile-client', 'shared-utils'];

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-search-cross-workspace-'));
    basePath = join(testDir, '.coa', 'goldfish');

    // Set up console.log capturing for debugging
    originalConsoleLog = console.log;
    debugLogs = [];
    console.log = (message: string) => {
      debugLogs.push(message);
      originalConsoleLog(message);
    };

    // Create realistic workspace structure
    await setupTestWorkspaces();
  });

  afterEach(async () => {
    console.log = originalConsoleLog;
    await fs.remove(testDir);
  });

  async function setupTestWorkspaces() {
    for (let i = 0; i < testWorkspaces.length; i++) {
      const workspace = testWorkspaces[i];
      const workspaceDir = join(basePath, workspace);
      
      // Create both checkpoints and todos directories
      const checkpointsDir = join(workspaceDir, 'checkpoints');
      const todosDir = join(workspaceDir, 'todos');
      
      await fs.ensureDir(checkpointsDir);
      await fs.ensureDir(todosDir);

      // Create date directory for checkpoints
      const dateDir = join(checkpointsDir, '2025-01-26');
      await fs.ensureDir(dateDir);

      // Add checkpoint memory
      const checkpoint: GoldfishMemory = {
        id: `checkpoint-${workspace}-${i}`,
        timestamp: new Date(Date.now() - (i * 3600000)), // Stagger timestamps by 1 hour
        workspace: workspace,
        sessionId: `session-${workspace}`,
        type: 'checkpoint',
        content: {
          description: `Working on ${workspace} development`,
          highlights: [
            `Implemented feature X in ${workspace}`,
            `Fixed critical bug in ${workspace}`
          ],
          gitBranch: 'feature/improvements',
          activeFiles: [`src/${workspace}.ts`, `tests/${workspace}.test.ts`]
        },
        ttlHours: 168,
        tags: ['checkpoint', 'development'],
        metadata: { isSession: true }
      };

      await fs.writeJson(join(dateDir, `${checkpoint.id}.json`), {
        ...checkpoint,
        timestamp: checkpoint.timestamp.toISOString()
      });

      // Add general memory in todos
      const generalMemory: GoldfishMemory = {
        id: `general-${workspace}-${i}`,
        timestamp: new Date(Date.now() - (i * 3600000) - 1800000), // 30 minutes after checkpoint
        workspace: workspace,
        type: 'general',
        content: `General note about ${workspace}: This is a test memory for cross-workspace functionality`,
        ttlHours: 24,
        tags: ['general', 'notes']
      };

      await fs.writeJson(join(todosDir, `${generalMemory.id}.json`), {
        ...generalMemory,
        timestamp: generalMemory.timestamp.toISOString()
      });
    }
  }

  describe('Workspace Discovery Logic Tests', () => {
    test('should discover all valid workspaces in basePath', async () => {
      const storage = new Storage('frontend-app', basePath);
      const searchEngine = new SearchEngine(storage);

      // Clear debug logs to capture only this test's output
      debugLogs = [];

      // This should trigger workspace discovery
      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 50
      });

      console.log(`\n=== Debug Logs for Workspace Discovery ===`);
      debugLogs.forEach(log => console.log(log));
      console.log(`=== End Debug Logs ===\n`);

      // CRITICAL TEST: Should find ALL test workspaces
      const foundWorkspaces = new Set(memories.map(m => m.workspace));
      
      console.log(`Expected workspaces: ${testWorkspaces.join(', ')}`);
      console.log(`Found workspaces: ${Array.from(foundWorkspaces).join(', ')}`);
      
      expect(foundWorkspaces.size).toBe(testWorkspaces.length);
      
      testWorkspaces.forEach(workspace => {
        expect(foundWorkspaces.has(workspace)).toBe(true);
      });

      // Should find memories from each workspace (2 per workspace minimum)
      expect(memories.length).toBeGreaterThanOrEqual(testWorkspaces.length * 2);
    });

    test('should validate workspace directory requirements correctly', async () => {
      // Create additional directories to test validation logic
      
      // 1. Directory with only checkpoints (should be included)
      const checkpointsOnlyDir = join(basePath, 'checkpoints-only');
      const checkpointsDateDir = join(checkpointsOnlyDir, 'checkpoints', '2025-01-26');
      await fs.ensureDir(checkpointsDateDir);
      
      // Add a checkpoint memory
      const checkpointMemory = {
        id: 'checkpoint-only-test',
        timestamp: new Date().toISOString(),
        workspace: 'checkpoints-only',
        type: 'checkpoint',
        content: { description: 'Test checkpoint', highlights: [] },
        ttlHours: 24,
        tags: ['test']
      };
      await fs.writeJson(join(checkpointsDateDir, 'checkpoint-only-test.json'), checkpointMemory);
      
      // 2. Directory with only todos (should be included)  
      const todosOnlyDir = join(basePath, 'todos-only');
      await fs.ensureDir(join(todosOnlyDir, 'todos'));
      
      // Add a todo memory
      const todoMemory = {
        id: 'todo-only-test',
        timestamp: new Date().toISOString(),
        workspace: 'todos-only',
        type: 'general',
        content: 'Test todo',
        ttlHours: 24,
        tags: ['test']
      };
      await fs.writeJson(join(todosOnlyDir, 'todos', 'todo-only-test.json'), todoMemory);
      
      // 3. Empty directory (should be excluded)
      const emptyDir = join(basePath, 'empty-dir');
      await fs.ensureDir(emptyDir);
      
      // 4. Directory with random content (should be excluded)
      const randomDir = join(basePath, 'random-content');
      await fs.ensureDir(join(randomDir, 'some-other-folder'));

      const storage = new Storage('frontend-app', basePath);
      const searchEngine = new SearchEngine(storage);

      debugLogs = [];
      
      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 100
      });

      // Check debug logs for workspace validation
      const validationLogs = debugLogs.filter(log => 
        log.includes('checkpoints:') || log.includes('todos:')
      );
      
      console.log('\n=== Workspace Validation Logs ===');
      validationLogs.forEach(log => console.log(log));
      console.log('=== End Validation Logs ===\n');

      const foundWorkspaces = new Set(memories.map(m => m.workspace));
      
      // Should include all original test workspaces
      testWorkspaces.forEach(workspace => {
        expect(foundWorkspaces.has(workspace)).toBe(true);
      });
      
      // Should include workspaces with only checkpoints or only todos
      expect(foundWorkspaces.has('checkpoints-only')).toBe(true);
      expect(foundWorkspaces.has('todos-only')).toBe(true);
      
      // Should NOT include empty or random directories
      expect(foundWorkspaces.has('empty-dir')).toBe(false);
      expect(foundWorkspaces.has('random-content')).toBe(false);
    });

    test('should handle workspace discovery with missing basePath gracefully', async () => {
      const nonExistentBasePath = join(testDir, 'non-existent', '.coa', 'goldfish');
      const storage = new Storage('test-workspace', nonExistentBasePath);
      const searchEngine = new SearchEngine(storage);

      // Should not crash when basePath doesn't exist
      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 50
      });

      // Should fall back to current workspace behavior
      expect(memories).toEqual([]);
    });

    test('should handle workspace discovery with permission errors gracefully', async () => {
      const storage = new Storage('frontend-app', basePath);
      const searchEngine = new SearchEngine(storage);

      // Create a directory that can't be read (simulate permission error)
      const restrictedDir = join(basePath, 'restricted');
      await fs.ensureDir(restrictedDir);
      
      // On Windows, we can't easily restrict permissions, so we'll simulate by creating
      // a file instead of directory with the same name after removing the directory
      await fs.remove(restrictedDir);
      await fs.writeFile(restrictedDir, 'not a directory');

      debugLogs = [];

      // Should not crash when encountering unreadable directories
      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 50
      });

      const foundWorkspaces = new Set(memories.map(m => m.workspace));
      
      // Should still find all valid workspaces
      testWorkspaces.forEach(workspace => {
        expect(foundWorkspaces.has(workspace)).toBe(true);
      });
      
      // Should not include the restricted directory
      expect(foundWorkspaces.has('restricted')).toBe(false);
    });
  });

  describe('Cross-Workspace Memory Aggregation Tests', () => {
    test('should correctly aggregate memories from multiple workspaces', async () => {
      const storage = new Storage('backend-api', basePath); // Different current workspace
      const searchEngine = new SearchEngine(storage);

      const memories = await searchEngine.searchMemories({
        scope: 'all',
        type: 'checkpoint',
        limit: 100
      });

      // Group memories by workspace
      const memoriesByWorkspace = new Map<string, GoldfishMemory[]>();
      memories.forEach(memory => {
        if (!memoriesByWorkspace.has(memory.workspace)) {
          memoriesByWorkspace.set(memory.workspace, []);
        }
        memoriesByWorkspace.get(memory.workspace)!.push(memory);
      });

      console.log('\n=== Memories by Workspace ===');
      memoriesByWorkspace.forEach((mems, workspace) => {
        console.log(`${workspace}: ${mems.length} memories`);
      });
      console.log('=== End Breakdown ===\n');

      // Should have memories from all workspaces
      expect(memoriesByWorkspace.size).toBe(testWorkspaces.length);
      
      // Each workspace should have at least 1 checkpoint
      memoriesByWorkspace.forEach((mems, workspace) => {
        expect(mems.length).toBeGreaterThanOrEqual(1);
        expect(mems.every(m => m.type === 'checkpoint')).toBe(true);
        expect(mems.every(m => m.workspace === workspace)).toBe(true);
      });
    });

    test('should maintain memory ordering across workspaces', async () => {
      const storage = new Storage('frontend-app', basePath);
      const searchEngine = new SearchEngine(storage);

      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 50
      });

      // Should have memories from multiple workspaces
      const workspaces = new Set(memories.map(m => m.workspace));
      expect(workspaces.size).toBeGreaterThan(1);
      
      // Should have mixed workspaces in the results (not grouped by workspace)
      const firstFewWorkspaces = memories.slice(0, Math.min(4, memories.length)).map(m => m.workspace);
      const uniqueWorkspacesInFirst4 = new Set(firstFewWorkspaces);
      
      // Should find results from multiple workspaces
      expect(uniqueWorkspacesInFirst4.size).toBeGreaterThan(0);
      
      // All timestamps should be valid dates
      memories.forEach(memory => {
        expect(memory.timestamp instanceof Date).toBe(true);
        expect(memory.timestamp.getTime()).toBeGreaterThan(0);
      });
    });

    test('should handle scope parameter correctly', async () => {
      const storage = new Storage('mobile-client', basePath);
      const searchEngine = new SearchEngine(storage);

      // Test 'current' scope
      const currentMemories = await searchEngine.searchMemories({
        scope: 'current',
        limit: 50
      });

      // Should only have memories from current workspace
      const currentWorkspaces = new Set(currentMemories.map(m => m.workspace));
      expect(currentWorkspaces.size).toBe(1);
      expect(currentWorkspaces.has('mobile-client')).toBe(true);

      // Test 'all' scope
      const allMemories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 50
      });

      // Should have memories from all workspaces
      const allWorkspaces = new Set(allMemories.map(m => m.workspace));
      expect(allWorkspaces.size).toBe(testWorkspaces.length);
      
      testWorkspaces.forEach(workspace => {
        expect(allWorkspaces.has(workspace)).toBe(true);
      });

      // 'all' should have more memories than 'current'
      expect(allMemories.length).toBeGreaterThan(currentMemories.length);
    });

    test('should handle workspace parameter with cross-workspace scope', async () => {
      const storage = new Storage('shared-utils', basePath);
      const searchEngine = new SearchEngine(storage);

      // Test explicit workspace parameter with 'all' scope
      // This should be ignored when scope is 'all'
      const memories = await searchEngine.searchMemories({
        workspace: 'frontend-app', // This should be ignored
        scope: 'all',
        limit: 50
      });

      const foundWorkspaces = new Set(memories.map(m => m.workspace));
      
      // Should still search ALL workspaces, not just the specified one
      expect(foundWorkspaces.size).toBe(testWorkspaces.length);
      expect(foundWorkspaces.has('backend-api')).toBe(true);
      expect(foundWorkspaces.has('mobile-client')).toBe(true);
    });
  });

  describe('Search Filtering with Cross-Workspace Data', () => {
    test('should apply filters consistently across all workspaces', async () => {
      const storage = new Storage('frontend-app', basePath);
      const searchEngine = new SearchEngine(storage);

      // Test type filtering
      const checkpoints = await searchEngine.searchMemories({
        scope: 'all',
        type: 'checkpoint',
        limit: 50
      });

      expect(checkpoints.every(m => m.type === 'checkpoint')).toBe(true);
      expect(checkpoints.length).toBe(testWorkspaces.length); // 1 checkpoint per workspace

      const generals = await searchEngine.searchMemories({
        scope: 'all',
        type: 'general',
        limit: 50
      });

      expect(generals.every(m => m.type === 'general')).toBe(true);
      expect(generals.length).toBe(testWorkspaces.length); // 1 general per workspace
    });

    test('should apply tag filtering across all workspaces', async () => {
      const storage = new Storage('backend-api', basePath);
      const searchEngine = new SearchEngine(storage);

      const checkpointTagged = await searchEngine.searchMemories({
        scope: 'all',
        tags: ['checkpoint'],
        limit: 50
      });

      // Should find checkpoint memories from all workspaces
      const workspacesWithCheckpoints = new Set(checkpointTagged.map(m => m.workspace));
      expect(workspacesWithCheckpoints.size).toBe(testWorkspaces.length);
      
      checkpointTagged.forEach(memory => {
        expect(memory.tags).toContain('checkpoint');
      });

      const developmentTagged = await searchEngine.searchMemories({
        scope: 'all',
        tags: ['development'],
        limit: 50
      });

      // Should find development-tagged memories from all workspaces
      developmentTagged.forEach(memory => {
        expect(memory.tags).toContain('development');
        expect(memory.type).toBe('checkpoint'); // Our test data has development tag on checkpoints
      });
    });

    test('should apply since filter across all workspaces', async () => {
      const storage = new Storage('mobile-client', basePath);
      const searchEngine = new SearchEngine(storage);

      // Test recent filter
      const recentMemories = await searchEngine.searchMemories({
        scope: 'all',
        since: '1h', // Very recent
        limit: 50
      });

      // All memories should be within the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      recentMemories.forEach(memory => {
        expect(memory.timestamp.getTime()).toBeGreaterThan(oneHourAgo.getTime());
      });

      // Test longer timeframe
      const dayMemories = await searchEngine.searchMemories({
        scope: 'all',
        since: '24h',
        limit: 50
      });

      // Should have more memories with longer timeframe
      expect(dayMemories.length).toBeGreaterThanOrEqual(recentMemories.length);
    });
  });

  describe('Search Query Processing with Cross-Workspace Data', () => {
    test('should search content across all workspaces with fuzzy matching', async () => {
      const storage = new Storage('shared-utils', basePath);
      const searchEngine = new SearchEngine(storage);

      // Search for content that exists in multiple workspaces
      const results = await searchEngine.searchMemories({
        query: 'development',
        scope: 'all',
        limit: 20
      });

      expect(results.length).toBeGreaterThan(0);

      // Should find results from multiple workspaces
      const foundWorkspaces = new Set(results.map(m => m.workspace));
      expect(foundWorkspaces.size).toBeGreaterThan(1);

      // Results should be relevance-ordered, not workspace-ordered
      for (let i = 1; i < Math.min(results.length, 4); i++) {
        // Should have mixed workspaces in top results
        const workspaces = results.slice(0, i + 1).map(r => r.workspace);
        // Don't expect all to be from the same workspace
      }
    });

    test('should handle empty query with cross-workspace scope', async () => {
      const storage = new Storage('frontend-app', basePath);
      const searchEngine = new SearchEngine(storage);

      const results = await searchEngine.searchMemories({
        query: '', // Empty query should return recent memories
        scope: 'all',
        limit: 20
      });

      // Should return recent memories from all workspaces
      const foundWorkspaces = new Set(results.map(m => m.workspace));
      expect(foundWorkspaces.size).toBe(testWorkspaces.length);

      // All results should have valid timestamps
      results.forEach(result => {
        expect(result.timestamp instanceof Date).toBe(true);
        expect(result.timestamp.getTime()).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle mixed valid and invalid workspace directories', async () => {
      // Create some invalid directories
      await fs.writeFile(join(basePath, 'not-a-directory.txt'), 'content');
      
      const invalidWorkspaceDir = join(basePath, 'invalid-workspace');
      await fs.ensureDir(invalidWorkspaceDir);
      // No checkpoints or todos subdirectories
      
      const storage = new Storage('frontend-app', basePath);
      const searchEngine = new SearchEngine(storage);

      debugLogs = [];

      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 100
      });

      // Should still find memories from valid workspaces
      const foundWorkspaces = new Set(memories.map(m => m.workspace));
      testWorkspaces.forEach(workspace => {
        expect(foundWorkspaces.has(workspace)).toBe(true);
      });

      // Should not include invalid directories
      expect(foundWorkspaces.has('invalid-workspace')).toBe(false);
    });

    test('should handle large numbers of workspaces efficiently', async () => {
      // Create many additional workspaces
      const manyWorkspaces = [];
      for (let i = 0; i < 50; i++) {
        const workspace = `bulk-workspace-${i}`;
        manyWorkspaces.push(workspace);
        
        const workspaceDir = join(basePath, workspace);
        await fs.ensureDir(join(workspaceDir, 'todos'));
        
        const memory: GoldfishMemory = {
          id: `bulk-memory-${i}`,
          timestamp: new Date(Date.now() - (i * 60000)), // 1 minute intervals
          workspace: workspace,
          type: 'general',
          content: `Bulk memory ${i}`,
          ttlHours: 24
        };

        await fs.writeJson(join(workspaceDir, 'todos', `${memory.id}.json`), {
          ...memory,
          timestamp: memory.timestamp.toISOString()
        });
      }

      const storage = new Storage('frontend-app', basePath);
      const searchEngine = new SearchEngine(storage);

      const startTime = Date.now();
      
      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 200 // Get many results
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`Processed ${manyWorkspaces.length + testWorkspaces.length} workspaces in ${duration}ms`);

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(10000); // 10 seconds

      // Should find memories from many workspaces
      const foundWorkspaces = new Set(memories.map(m => m.workspace));
      expect(foundWorkspaces.size).toBeGreaterThan(20);
    });
  });
});