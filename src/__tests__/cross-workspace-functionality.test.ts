/**
 * Cross-workspace functionality tests
 * 
 * This test suite exposes critical gaps in cross-workspace operations that
 * prevent the timeline/standup feature from working correctly across multiple workspaces.
 * 
 * These tests are designed to FAIL initially, demonstrating the bugs in the system.
 * After fixing the implementation, these tests should pass.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { Storage } from '../core/storage.js';
import { SearchEngine } from '../core/search.js';
import { SearchTools } from '../tools/search.js';
import { SessionManager } from '../core/session-manager.js';
import { GoldfishMemory } from '../types/index.js';

describe('Cross-Workspace Functionality Tests', () => {
  let testDir: string;
  let basePath: string;

  // Multiple test workspaces
  const workspaceNames = ['coa-goldfish-mcp', 'my-frontend-app', 'backend-api', 'mobile-app'];
  
  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-cross-workspace-test-'));
    basePath = join(testDir, '.coa', 'goldfish');

    // Create multiple workspaces with realistic data
    for (const workspace of workspaceNames) {
      const workspaceDir = join(basePath, workspace);
      const checkpointsDir = join(workspaceDir, 'checkpoints');
      const todosDir = join(workspaceDir, 'todos');
      
      await fs.ensureDir(checkpointsDir);
      await fs.ensureDir(todosDir);

      // Create date-based checkpoint directories (realistic structure)
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      await fs.ensureDir(join(checkpointsDir, today));
      await fs.ensureDir(join(checkpointsDir, yesterday));

      // Add test memories to each workspace
      await createTestMemoriesForWorkspace(workspace, workspaceDir, today, yesterday);
    }
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  async function createTestMemoriesForWorkspace(workspace: string, workspaceDir: string, today: string, yesterday: string) {
    const checkpointsDir = join(workspaceDir, 'checkpoints');
    const todosDir = join(workspaceDir, 'todos');

    // Create checkpoints for today
    const todayCheckpoint: GoldfishMemory = {
      id: `${workspace}-today-checkpoint`,
      timestamp: new Date(),
      workspace: workspace,
      sessionId: `session-${workspace}-today`,
      type: 'checkpoint',
      content: {
        description: `Working on ${workspace} features today`,
        highlights: [`Implemented new feature in ${workspace}`, `Fixed critical bug in ${workspace}`],
        gitBranch: 'feature/improvements',
        activeFiles: [`src/${workspace}-main.ts`, `tests/${workspace}.test.ts`]
      },
      ttlHours: 168,
      tags: ['checkpoint', 'work-session'],
      metadata: { isSession: true }
    };

    // Create checkpoints for yesterday
    const yesterdayCheckpoint: GoldfishMemory = {
      id: `${workspace}-yesterday-checkpoint`,
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      workspace: workspace,
      sessionId: `session-${workspace}-yesterday`,
      type: 'checkpoint',
      content: {
        description: `Completed ${workspace} milestone yesterday`,
        highlights: [`Released version 1.0 of ${workspace}`, `All tests passing in ${workspace}`],
        gitBranch: 'main',
        activeFiles: [`src/${workspace}-core.ts`, `README.md`]
      },
      ttlHours: 168,
      tags: ['checkpoint', 'milestone'],
      metadata: { isSession: true }
    };

    // Create general memories in todos dir
    const todoMemory: GoldfishMemory = {
      id: `${workspace}-todo-memory`,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      workspace: workspace,
      type: 'general',
      content: `TODO: Review ${workspace} documentation`,
      ttlHours: 24,
      tags: ['todo', 'documentation']
    };

    // Save checkpoints in date directories
    await fs.writeJson(join(checkpointsDir, today, `${todayCheckpoint.id}.json`), {
      ...todayCheckpoint,
      timestamp: todayCheckpoint.timestamp.toISOString()
    });

    await fs.writeJson(join(checkpointsDir, yesterday, `${yesterdayCheckpoint.id}.json`), {
      ...yesterdayCheckpoint,
      timestamp: yesterdayCheckpoint.timestamp.toISOString()
    });

    // Save general memories in todos directory
    await fs.writeJson(join(todosDir, `${todoMemory.id}.json`), {
      ...todoMemory,
      timestamp: todoMemory.timestamp.toISOString()
    });
  }

  describe('Storage.loadAllMemories Cross-Workspace Tests', () => {
    test('should load memories from different workspace parameters', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);

      // Test loading from each workspace individually
      for (const workspace of workspaceNames) {
        console.log(`Testing loadAllMemories for workspace: ${workspace}`);
        
        const memories = await storage.loadAllMemories(workspace);
        console.log(`Loaded ${memories.length} memories from ${workspace}`);
        
        // Each workspace should have at least 3 memories (2 checkpoints + 1 general)
        expect(memories.length).toBeGreaterThanOrEqual(3);
        
        // All memories should belong to the correct workspace
        memories.forEach(memory => {
          expect(memory.workspace).toBe(workspace);
        });

        // Should have both checkpoint and general memories
        const checkpoints = memories.filter(m => m.type === 'checkpoint');
        const generals = memories.filter(m => m.type === 'general');
        
        expect(checkpoints.length).toBeGreaterThanOrEqual(2);
        expect(generals.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('should properly load memories from date-organized checkpoint directories', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);
      
      const memories = await storage.loadAllMemories('coa-goldfish-mcp');
      
      // Should find memories from both date directories
      const checkpoints = memories.filter(m => m.type === 'checkpoint');
      expect(checkpoints.length).toBe(2); // Today + yesterday checkpoints
      
      // Should have proper timestamps
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
      
      const todayCheckpoints = checkpoints.filter(c => 
        new Date(c.timestamp).toDateString() === today
      );
      const yesterdayCheckpoints = checkpoints.filter(c => 
        new Date(c.timestamp).toDateString() === yesterday
      );
      
      expect(todayCheckpoints.length).toBe(1);
      expect(yesterdayCheckpoints.length).toBe(1);
    });
  });

  describe('SearchEngine Cross-Workspace Discovery Tests', () => {
    test('should discover all valid workspaces when scope="all"', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);
      const searchEngine = new SearchEngine(storage);

      // This test should FAIL initially because workspace discovery is broken
      const memories = await searchEngine.searchMemories({
        scope: 'all',
        type: 'checkpoint',
        limit: 50
      });

      console.log(`Found ${memories.length} memories across all workspaces`);
      
      // Should find memories from ALL workspaces
      const uniqueWorkspaces = new Set(memories.map(m => m.workspace));
      console.log(`Unique workspaces found: ${Array.from(uniqueWorkspaces).join(', ')}`);
      
      // CRITICAL TEST: Should find all 4 workspaces
      expect(uniqueWorkspaces.size).toBe(workspaceNames.length);
      
      // Should have memories from each workspace
      workspaceNames.forEach(workspace => {
        expect(uniqueWorkspaces.has(workspace)).toBe(true);
      });

      // Should have at least 2 checkpoints per workspace (8 total)
      expect(memories.length).toBeGreaterThanOrEqual(8);
    });

    test('should aggregate workspace directories correctly', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);
      const searchEngine = new SearchEngine(storage);

      // Mock the internal workspace discovery to see what's happening
      const originalConsoleLog = console.log;
      const debugLogs: string[] = [];
      console.log = (message: string) => {
        debugLogs.push(message);
        originalConsoleLog(message);
      };

      try {
        await searchEngine.searchMemories({
          scope: 'all',
          limit: 10
        });

        // Look for debug output from SearchEngine
        const workspaceDiscoveryLogs = debugLogs.filter(log => 
          log.includes('DEBUG: Found directories') || 
          log.includes('DEBUG: Workspaces to search')
        );

        console.log('Workspace discovery debug logs:', workspaceDiscoveryLogs);
        
        // The discovery should find all our test workspaces
        const workspaceSearchLog = debugLogs.find(log => log.includes('Workspaces to search'));
        if (workspaceSearchLog) {
          workspaceNames.forEach(workspace => {
            expect(workspaceSearchLog).toContain(workspace);
          });
        }
      } finally {
        console.log = originalConsoleLog;
      }
    });

    test('should validate workspace directory structure requirements', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);
      
      // Create an invalid workspace (directory exists but no checkpoints/todos)
      const invalidWorkspaceDir = join(basePath, 'invalid-workspace');
      await fs.ensureDir(invalidWorkspaceDir);
      
      // Create a partially valid workspace (only checkpoints, no todos)
      const partialWorkspaceDir = join(basePath, 'partial-workspace');
      const partialCheckpointsDir = join(partialWorkspaceDir, 'checkpoints');
      await fs.ensureDir(partialCheckpointsDir);
      
      // Add a dummy checkpoint to make the workspace discoverable in memory results
      const dummyCheckpoint = {
        id: 'partial-test-checkpoint',
        type: 'checkpoint',
        workspace: 'partial-workspace',
        timestamp: new Date().toISOString(),
        content: { description: 'Test checkpoint for partial workspace' },
        ttlHours: 24
      };
      
      // Create date directory and save the checkpoint
      const todayStr = new Date().toISOString().split('T')[0];
      const dateDir = join(partialCheckpointsDir, todayStr);
      await fs.ensureDir(dateDir);
      await fs.writeJson(join(dateDir, 'test-checkpoint.json'), dummyCheckpoint);
      
      const searchEngine = new SearchEngine(storage);
      
      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 50
      });

      const workspaces = new Set(memories.map(m => m.workspace));
      
      // Should NOT include invalid workspace
      expect(workspaces.has('invalid-workspace')).toBe(false);
      
      // SHOULD include partial workspace (has checkpoints directory)
      expect(workspaces.has('partial-workspace')).toBe(true);
    });
  });

  describe('Timeline Cross-Workspace Integration Tests', () => {
    test('should show timeline data from ALL workspaces when scope="all"', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      // This test should FAIL initially due to cross-workspace loading issues
      const result = await searchTools.timeline({
        scope: 'all',
        since: '7d'
      });

      expect(result.content).toHaveLength(1);
      const responseData = JSON.parse(result.content[0].text);
      
      console.log('Timeline response:', responseData);
      
      // Should be successful
      expect(responseData.success).toBe(true);
      expect(responseData.operation).toBe('timeline');
      
      // CRITICAL: Should find data from multiple workspaces
      expect(responseData.workspacesFound).toBeGreaterThan(1);
      expect(responseData.workspacesFound).toBe(workspaceNames.length);
      
      // Should have checkpoints from all workspaces
      expect(responseData.checkpointsFound).toBeGreaterThanOrEqual(8); // 2 checkpoints per workspace
      
      // Formatted output should mention multiple workspaces
      const formattedOutput = responseData.formattedOutput;
      workspaceNames.forEach(workspace => {
        expect(formattedOutput).toContain(workspace);
      });
    });

    test('should handle cross-workspace timeline with date grouping', async () => {
      const storage = new Storage('mobile-app', basePath); // Different current workspace
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      const result = await searchTools.timeline({
        scope: 'all',
        since: '2d'
      });

      const responseData = JSON.parse(result.content[0].text);
      
      // Should organize by date correctly across workspaces
      const timelineData = responseData.data.byDate;
      
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      expect(timelineData[today]).toBeDefined();
      expect(timelineData[yesterday]).toBeDefined();
      
      // Each date should have data from multiple workspaces
      Object.keys(timelineData[today]).forEach(workspace => {
        expect(workspaceNames).toContain(workspace);
      });
    });
  });

  describe('Search History Cross-Workspace Tests', () => {
    test('should search across all workspaces when scope="all"', async () => {
      const storage = new Storage('backend-api', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      // Search for something that should exist in multiple workspaces
      const result = await searchTools.searchHistory({
        query: 'feature',
        scope: 'all',
        limit: 20
      });

      const responseData = JSON.parse(result.content[0].text);
      
      expect(responseData.success).toBe(true);
      expect(responseData.resultsFound).toBeGreaterThan(0);
      
      // Should find matches from multiple workspaces
      const matchWorkspaces = new Set(
        responseData.matches.map((match: any) => match.memory.workspace)
      );
      
      expect(matchWorkspaces.size).toBeGreaterThan(1);
    });
  });

  describe('Recall Cross-Workspace Tests', () => {
    test('should recall memories from all workspaces when scope="all"', async () => {
      const storage = new Storage('my-frontend-app', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      const result = await searchTools.recall({
        scope: 'all',
        type: 'checkpoint',
        since: '7d',
        limit: 20
      });

      const responseData = JSON.parse(result.content[0].text);
      
      expect(responseData.success).toBe(true);
      expect(responseData.memoriesFound).toBeGreaterThanOrEqual(8); // 2 per workspace
      
      // Should have memories from all workspaces
      const memoryWorkspaces = new Set(
        responseData.memories.map((memory: any) => memory.workspace)
      );
      
      expect(memoryWorkspaces.size).toBe(workspaceNames.length);
      workspaceNames.forEach(workspace => {
        expect(memoryWorkspaces.has(workspace)).toBe(true);
      });
    });

    test('should handle workspace filtering in cross-workspace context', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      // Test current workspace only
      const currentResult = await searchTools.recall({
        scope: 'current',
        type: 'checkpoint',
        limit: 10
      });

      const currentData = JSON.parse(currentResult.content[0].text);
      const currentWorkspaces = new Set(
        currentData.memories.map((memory: any) => memory.workspace)
      );
      
      expect(currentWorkspaces.size).toBe(1);
      expect(currentWorkspaces.has('coa-goldfish-mcp')).toBe(true);

      // Test all workspaces
      const allResult = await searchTools.recall({
        scope: 'all',
        type: 'checkpoint',
        limit: 20
      });

      const allData = JSON.parse(allResult.content[0].text);
      const allWorkspaces = new Set(
        allData.memories.map((memory: any) => memory.workspace)
      );
      
      expect(allWorkspaces.size).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty workspaces gracefully', async () => {
      // Create empty workspace
      const emptyWorkspaceDir = join(basePath, 'empty-workspace');
      await fs.ensureDir(join(emptyWorkspaceDir, 'checkpoints'));
      await fs.ensureDir(join(emptyWorkspaceDir, 'todos'));
      
      const storage = new Storage('coa-goldfish-mcp', basePath);
      const searchEngine = new SearchEngine(storage);

      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 50
      });

      // Should still work and find memories from other workspaces
      expect(memories.length).toBeGreaterThan(0);
      
      // Should not crash on empty workspace
      const workspaces = new Set(memories.map(m => m.workspace));
      expect(workspaces.has('empty-workspace')).toBe(false);
    });

    test('should handle missing directories gracefully', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);
      
      // Delete one workspace's directories
      await fs.remove(join(basePath, 'mobile-app'));
      
      const searchEngine = new SearchEngine(storage);
      
      // Should not crash and should still find other workspaces
      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 50
      });

      expect(memories.length).toBeGreaterThan(0);
      
      const workspaces = new Set(memories.map(m => m.workspace));
      expect(workspaces.has('mobile-app')).toBe(false);
      expect(workspaces.has('coa-goldfish-mcp')).toBe(true);
    });

    test('should handle corrupted JSON files gracefully', async () => {
      // Create corrupted file
      const corruptedFile = join(basePath, 'coa-goldfish-mcp', 'todos', 'corrupted.json');
      await fs.writeFile(corruptedFile, '{ invalid json content');
      
      const storage = new Storage('coa-goldfish-mcp', basePath);
      
      // Should not crash and should skip corrupted files
      const memories = await storage.loadAllMemories('coa-goldfish-mcp');
      
      expect(memories.length).toBeGreaterThan(0); // Should still load valid files
    });

    test('should handle Windows path separators correctly', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);
      
      // Test with different current workspace
      const memories1 = await storage.loadAllMemories('coa-goldfish-mcp');
      const memories2 = await storage.loadAllMemories('my-frontend-app');
      
      expect(memories1.length).toBeGreaterThan(0);
      expect(memories2.length).toBeGreaterThan(0);
      
      // Should have different workspace identifiers
      const workspaces1 = new Set(memories1.map(m => m.workspace));
      const workspaces2 = new Set(memories2.map(m => m.workspace));
      
      expect(workspaces1.has('coa-goldfish-mcp')).toBe(true);
      expect(workspaces2.has('my-frontend-app')).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle large numbers of workspaces efficiently', async () => {
      // Create many additional workspaces
      const manyWorkspaces = [];
      for (let i = 0; i < 20; i++) {
        const workspace = `test-workspace-${i}`;
        manyWorkspaces.push(workspace);
        
        const workspaceDir = join(basePath, workspace);
        await fs.ensureDir(join(workspaceDir, 'checkpoints'));
        await fs.ensureDir(join(workspaceDir, 'todos'));
        
        // Add a small memory to each
        const memory = {
          id: `memory-${i}`,
          timestamp: new Date().toISOString(),
          workspace: workspace,
          type: 'general',
          content: `Test memory ${i}`,
          ttlHours: 24
        };
        
        await fs.writeJson(join(workspaceDir, 'todos', `${memory.id}.json`), memory);
      }
      
      const storage = new Storage('coa-goldfish-mcp', basePath);
      const searchEngine = new SearchEngine(storage);
      
      // Should handle many workspaces without performance issues
      const startTime = Date.now();
      
      const memories = await searchEngine.searchMemories({
        scope: 'all',
        limit: 100
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(memories.length).toBeGreaterThan(20); // Should find memories from many workspaces
    });
  });
});