/**
 * Storage Cross-Workspace Tests
 * 
 * These tests focus specifically on the Storage layer's ability to handle
 * cross-workspace operations correctly. They test the core functionality
 * that other layers depend on.
 * 
 * DESIGNED TO FAIL INITIALLY - these expose the fundamental issues
 * in workspace management and cross-workspace loading.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { Storage } from '../core/storage.js';
import { GoldfishMemory } from '../types/index.js';

describe('Storage Cross-Workspace Tests', () => {
  let testDir: string;
  let basePath: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-storage-workspace-test-'));
    basePath = join(testDir, '.coa', 'goldfish');
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('Workspace Directory Structure Tests', () => {
    test('should handle new directory structure correctly', async () => {
      const workspaces = ['project-a', 'project-b', 'shared-lib'];
      
      // Set up realistic workspace structure
      for (const workspace of workspaces) {
        const workspaceDir = join(basePath, workspace);
        const checkpointsDir = join(workspaceDir, 'checkpoints');
        const todosDir = join(workspaceDir, 'todos');
        
        await fs.ensureDir(checkpointsDir);
        await fs.ensureDir(todosDir);

        // Create date-based checkpoint structure
        const dateDir = join(checkpointsDir, '2025-01-26');
        await fs.ensureDir(dateDir);

        // Add test checkpoint
        const checkpoint: GoldfishMemory = {
          id: `checkpoint-${workspace}`,
          timestamp: new Date(),
          workspace: workspace,
          type: 'checkpoint',
          content: {
            description: `Working on ${workspace}`,
            highlights: [`Feature completed in ${workspace}`]
          },
          ttlHours: 168,
          tags: ['checkpoint']
        };

        await fs.writeJson(join(dateDir, `${checkpoint.id}.json`), {
          ...checkpoint,
          timestamp: checkpoint.timestamp.toISOString()
        });

        // Add test todo memory
        const todoMemory: GoldfishMemory = {
          id: `todo-${workspace}`,
          timestamp: new Date(),
          workspace: workspace,
          type: 'general',
          content: `TODO for ${workspace}`,
          ttlHours: 24,
          tags: ['todo']
        };

        await fs.writeJson(join(todosDir, `${todoMemory.id}.json`), {
          ...todoMemory,
          timestamp: todoMemory.timestamp.toISOString()
        });
      }

      // Test loading from each workspace
      const storage = new Storage('project-a', basePath);

      for (const workspace of workspaces) {
        const memories = await storage.loadAllMemories(workspace);
        
        console.log(`Loaded ${memories.length} memories from ${workspace}`);
        
        // Should load both checkpoint and todo memories
        expect(memories.length).toBe(2);
        
        // Verify workspace assignment
        memories.forEach(memory => {
          expect(memory.workspace).toBe(workspace);
        });

        // Verify types
        const types = memories.map(m => m.type).sort();
        expect(types).toEqual(['checkpoint', 'general']);
      }
    });

    test('should load memories from complex date directory structure', async () => {
      const workspace = 'complex-project';
      const workspaceDir = join(basePath, workspace);
      const checkpointsDir = join(workspaceDir, 'checkpoints');
      
      await fs.ensureDir(checkpointsDir);

      // Create multiple date directories with checkpoints
      const dates = ['2025-01-24', '2025-01-25', '2025-01-26'];
      const expectedMemories = [];

      for (let i = 0; i < dates.length; i++) {
        const dateDir = join(checkpointsDir, dates[i]);
        await fs.ensureDir(dateDir);

        for (let j = 0; j < 2; j++) { // 2 checkpoints per date
          const checkpoint: GoldfishMemory = {
            id: `checkpoint-${dates[i]}-${j}`,
            timestamp: new Date(dates[i] + 'T10:00:00.000Z'),
            workspace: workspace,
            type: 'checkpoint',
            content: {
              description: `Work session ${i}-${j}`,
              highlights: [`Achievement ${i}-${j}`]
            },
            ttlHours: 168,
            tags: ['checkpoint']
          };

          expectedMemories.push(checkpoint);

          await fs.writeJson(join(dateDir, `${checkpoint.id}.json`), {
            ...checkpoint,
            timestamp: checkpoint.timestamp.toISOString()
          });
        }
      }

      const storage = new Storage(workspace, basePath);
      const loadedMemories = await storage.loadAllMemories(workspace);

      console.log(`Expected ${expectedMemories.length} memories, loaded ${loadedMemories.length}`);
      
      // Should load all checkpoints from all date directories
      expect(loadedMemories.length).toBe(expectedMemories.length);
      
      // Verify all expected IDs are present
      const loadedIds = new Set(loadedMemories.map(m => m.id));
      expectedMemories.forEach(expected => {
        expect(loadedIds.has(expected.id)).toBe(true);
      });
    });
  });

  describe('Cross-Workspace Loading Tests', () => {
    test('should load memories with correct workspace parameter handling', async () => {
      const workspaces = ['workspace-alpha', 'workspace-beta', 'workspace-gamma'];
      
      // Create workspaces with unique memories
      for (const workspace of workspaces) {
        const workspaceDir = join(basePath, workspace);
        await fs.ensureDir(join(workspaceDir, 'todos'));
        
        const uniqueMemory: GoldfishMemory = {
          id: `unique-${workspace}`,
          timestamp: new Date(),
          workspace: workspace,
          type: 'general',
          content: `Unique content for ${workspace}`,
          ttlHours: 24,
          tags: ['unique']
        };

        await fs.writeJson(join(workspaceDir, 'todos', `${uniqueMemory.id}.json`), {
          ...uniqueMemory,
          timestamp: uniqueMemory.timestamp.toISOString()
        });
      }

      const storage = new Storage('workspace-alpha', basePath); // Current workspace

      // Test explicit workspace parameter
      for (const workspace of workspaces) {
        const memories = await storage.loadAllMemories(workspace);
        
        expect(memories.length).toBe(1);
        expect(memories[0].workspace).toBe(workspace);
        expect(memories[0].id).toBe(`unique-${workspace}`);
        expect(memories[0].content).toContain(workspace);
      }
    });

    test('should handle default workspace parameter correctly', async () => {
      const currentWorkspace = 'default-test-workspace';
      const storage = new Storage(currentWorkspace, basePath);
      
      // Set up current workspace with memories
      const workspaceDir = join(basePath, currentWorkspace);
      await fs.ensureDir(join(workspaceDir, 'todos'));
      
      const memory: GoldfishMemory = {
        id: 'default-memory',
        timestamp: new Date(),
        workspace: currentWorkspace,
        type: 'general',
        content: 'Default workspace memory',
        ttlHours: 24
      };

      await fs.writeJson(join(workspaceDir, 'todos', `${memory.id}.json`), {
        ...memory,
        timestamp: memory.timestamp.toISOString()
      });

      // Test loading without explicit workspace parameter
      const memories = await storage.loadAllMemories();
      
      expect(memories.length).toBe(1);
      expect(memories[0].workspace).toBe(currentWorkspace);
    });

    test('should handle non-existent workspaces gracefully', async () => {
      const storage = new Storage('existing-workspace', basePath);
      
      // Create existing workspace
      const existingDir = join(basePath, 'existing-workspace', 'todos');
      await fs.ensureDir(existingDir);
      
      const memory: GoldfishMemory = {
        id: 'existing-memory',
        timestamp: new Date(),
        workspace: 'existing-workspace',
        type: 'general',
        content: 'Existing memory',
        ttlHours: 24
      };

      await fs.writeJson(join(existingDir, `${memory.id}.json`), {
        ...memory,
        timestamp: memory.timestamp.toISOString()
      });

      // Try to load from non-existent workspace
      const nonExistentMemories = await storage.loadAllMemories('non-existent-workspace');
      expect(nonExistentMemories).toEqual([]);

      // Verify existing workspace still works
      const existingMemories = await storage.loadAllMemories('existing-workspace');
      expect(existingMemories.length).toBe(1);
    });
  });

  describe('Memory Type and Structure Validation Tests', () => {
    test('should correctly load mixed memory types from todos and checkpoints', async () => {
      const workspace = 'mixed-types-workspace';
      const workspaceDir = join(basePath, workspace);
      
      // Set up directories
      const checkpointsDir = join(workspaceDir, 'checkpoints', '2025-01-26');
      const todosDir = join(workspaceDir, 'todos');
      
      await fs.ensureDir(checkpointsDir);
      await fs.ensureDir(todosDir);

      // Create different types of memories
      const memories = [
        {
          id: 'checkpoint-1',
          timestamp: new Date(),
          workspace: workspace,
          type: 'checkpoint',
          content: { description: 'Checkpoint memory', highlights: [] },
          ttlHours: 168,
          directory: checkpointsDir
        },
        {
          id: 'general-1',
          timestamp: new Date(),
          workspace: workspace,
          type: 'general',
          content: 'General memory',
          ttlHours: 24,
          directory: todosDir
        },
        {
          id: 'todo-1',
          timestamp: new Date(),
          workspace: workspace,
          type: 'todo',
          content: 'Todo memory',
          ttlHours: 24,
          directory: todosDir
        },
        {
          id: 'context-1',
          timestamp: new Date(),
          workspace: workspace,
          type: 'context',
          content: 'Context memory',
          ttlHours: 24,
          directory: todosDir
        }
      ];

      // Save memories in appropriate directories
      for (const memory of memories) {
        await fs.writeJson(join(memory.directory, `${memory.id}.json`), {
          ...memory,
          timestamp: memory.timestamp.toISOString(),
          directory: undefined // Remove directory field from saved data
        });
      }

      const storage = new Storage(workspace, basePath);
      const loadedMemories = await storage.loadAllMemories(workspace);

      console.log(`Loaded ${loadedMemories.length} memories of types: ${loadedMemories.map(m => m.type).join(', ')}`);
      
      // Should load all memory types
      expect(loadedMemories.length).toBe(4);

      // Verify all types are present
      const types = loadedMemories.map(m => m.type).sort();
      expect(types).toEqual(['checkpoint', 'context', 'general', 'todo']);

      // Verify structure preservation
      const checkpointMemory = loadedMemories.find(m => m.type === 'checkpoint');
      expect(checkpointMemory?.content).toHaveProperty('description');
      expect(checkpointMemory?.content).toHaveProperty('highlights');

      const generalMemory = loadedMemories.find(m => m.type === 'general');
      expect(typeof generalMemory?.content).toBe('string');
    });

    test('should preserve timestamp and date information correctly', async () => {
      const workspace = 'timestamp-test';
      const workspaceDir = join(basePath, workspace, 'todos');
      await fs.ensureDir(workspaceDir);

      // Create memories with specific timestamps
      const testTimestamps = [
        new Date('2025-01-26T10:00:00.000Z'),
        new Date('2025-01-26T14:30:00.000Z'),
        new Date('2025-01-25T18:45:00.000Z')
      ];

      for (let i = 0; i < testTimestamps.length; i++) {
        const memory: GoldfishMemory = {
          id: `timestamp-memory-${i}`,
          timestamp: testTimestamps[i],
          workspace: workspace,
          type: 'general',
          content: `Memory at ${testTimestamps[i].toISOString()}`,
          ttlHours: 24
        };

        await fs.writeJson(join(workspaceDir, `${memory.id}.json`), {
          ...memory,
          timestamp: memory.timestamp.toISOString()
        });
      }

      const storage = new Storage(workspace, basePath);
      const loadedMemories = await storage.loadAllMemories(workspace);

      expect(loadedMemories.length).toBe(3);

      // Verify timestamps are preserved and converted back to Date objects
      loadedMemories.forEach((memory, index) => {
        expect(memory.timestamp instanceof Date).toBe(true);
        expect(memory.timestamp.getTime()).toBe(testTimestamps.find(t => 
          t.toISOString() === memory.timestamp.toISOString()
        )?.getTime());
      });

      // Verify sorting (should be newest first)
      const timestamps = loadedMemories.map(m => m.timestamp.getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sortedTimestamps);
    });
  });

  describe('File System Integration Tests', () => {
    test('should handle concurrent access to workspace directories', async () => {
      const workspace = 'concurrent-test';
      const workspaceDir = join(basePath, workspace, 'todos');
      await fs.ensureDir(workspaceDir);

      // Create multiple storage instances (simulating concurrent access)
      const storage1 = new Storage(workspace, basePath);
      const storage2 = new Storage(workspace, basePath);
      const storage3 = new Storage(workspace, basePath);

      // Save memories concurrently
      const savePromises = [];
      for (let i = 0; i < 3; i++) {
        const memory: GoldfishMemory = {
          id: `concurrent-memory-${i}`,
          timestamp: new Date(),
          workspace: workspace,
          type: 'general',
          content: `Concurrent memory ${i}`,
          ttlHours: 24
        };

        const storageInstance = [storage1, storage2, storage3][i];
        savePromises.push(storageInstance.saveMemory(memory));
      }

      await Promise.all(savePromises);

      // Load memories and verify all were saved successfully
      const loadedMemories = await storage1.loadAllMemories(workspace);
      expect(loadedMemories.length).toBe(3);

      // Verify all memories have unique IDs and correct content
      const ids = loadedMemories.map(m => m.id);
      expect(new Set(ids).size).toBe(3); // All IDs should be unique
    });

    test('should handle corrupted files and skip them gracefully', async () => {
      const workspace = 'corruption-test';
      const workspaceDir = join(basePath, workspace, 'todos');
      await fs.ensureDir(workspaceDir);

      // Create valid memory
      const validMemory: GoldfishMemory = {
        id: 'valid-memory',
        timestamp: new Date(),
        workspace: workspace,
        type: 'general',
        content: 'Valid memory',
        ttlHours: 24
      };

      await fs.writeJson(join(workspaceDir, 'valid.json'), {
        ...validMemory,
        timestamp: validMemory.timestamp.toISOString()
      });

      // Create corrupted files
      await fs.writeFile(join(workspaceDir, 'corrupted-1.json'), '{ invalid json');
      await fs.writeFile(join(workspaceDir, 'corrupted-2.json'), 'not json at all');
      await fs.writeFile(join(workspaceDir, 'empty.json'), '');

      const storage = new Storage(workspace, basePath);
      const loadedMemories = await storage.loadAllMemories(workspace);

      // Should load only the valid memory, skip corrupted ones
      expect(loadedMemories.length).toBe(1);
      expect(loadedMemories[0].id).toBe('valid-memory');
    });

    test('should handle workspace names with special characters', async () => {
      const specialWorkspaces = [
        'my-project-name',
        'project_with_underscores',
        'project.with.dots',
        'PROJECT-UPPERCASE'
      ];

      for (const workspace of specialWorkspaces) {
        const workspaceDir = join(basePath, workspace, 'todos');
        await fs.ensureDir(workspaceDir);

        const memory: GoldfishMemory = {
          id: `memory-${workspace}`,
          timestamp: new Date(),
          workspace: workspace,
          type: 'general',
          content: `Memory for ${workspace}`,
          ttlHours: 24
        };

        await fs.writeJson(join(workspaceDir, `${memory.id}.json`), {
          ...memory,
          timestamp: memory.timestamp.toISOString()
        });

        const storage = new Storage(workspace, basePath);
        const loadedMemories = await storage.loadAllMemories(workspace);

        expect(loadedMemories.length).toBe(1);
        expect(loadedMemories[0].workspace).toBe(workspace);
      }
    });
  });

  describe('Workspace Detection and Path Resolution Tests', () => {
    test('should handle custom basePath parameter correctly', async () => {
      const customBasePath = join(testDir, 'custom', '.goldfish');
      const workspace = 'custom-path-test';
      
      // Create workspace in custom location
      const workspaceDir = join(customBasePath, workspace, 'todos');
      await fs.ensureDir(workspaceDir);

      const memory: GoldfishMemory = {
        id: 'custom-path-memory',
        timestamp: new Date(),
        workspace: workspace,
        type: 'general',
        content: 'Memory in custom path',
        ttlHours: 24
      };

      await fs.writeJson(join(workspaceDir, `${memory.id}.json`), {
        ...memory,
        timestamp: memory.timestamp.toISOString()
      });

      // Test with custom basePath
      const storage = new Storage(workspace, customBasePath);
      const loadedMemories = await storage.loadAllMemories(workspace);

      expect(loadedMemories.length).toBe(1);
      expect(loadedMemories[0].content).toBe('Memory in custom path');
    });

    test('should provide correct directory paths for workspaces', async () => {
      const workspace = 'path-resolution-test';
      const storage = new Storage(workspace, basePath);

      // Test directory path methods
      const workspaceDir = storage.getWorkspaceDir(workspace);
      const checkpointsDir = storage.getCheckpointsDir(workspace);
      const todosDir = storage.getTodosDir(workspace);
      const dateDir = storage.getDateDir('2025-01-26', workspace);

      expect(workspaceDir).toBe(join(basePath, workspace));
      expect(checkpointsDir).toBe(join(basePath, workspace, 'checkpoints'));
      expect(todosDir).toBe(join(basePath, workspace, 'todos'));
      expect(dateDir).toBe(join(basePath, workspace, 'checkpoints', '2025-01-26'));
    });

    test('should handle default workspace parameter in directory methods', async () => {
      const currentWorkspace = 'default-dir-test';
      const storage = new Storage(currentWorkspace, basePath);

      // Test methods without explicit workspace parameter
      const workspaceDir = storage.getWorkspaceDir();
      const checkpointsDir = storage.getCheckpointsDir();
      const todosDir = storage.getTodosDir();
      const dateDir = storage.getDateDir();

      expect(workspaceDir).toBe(join(basePath, currentWorkspace));
      expect(checkpointsDir).toBe(join(basePath, currentWorkspace, 'checkpoints'));
      expect(todosDir).toBe(join(basePath, currentWorkspace, 'todos'));
      
      // Date dir should use current date when no date provided
      const today = new Date().toISOString().split('T')[0];
      expect(dateDir).toBe(join(basePath, currentWorkspace, 'checkpoints', today));
    });
  });
});