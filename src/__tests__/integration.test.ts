import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

// Integration tests for complex workflows
describe('Goldfish Integration Tests', () => {
  let testDir: string;
  let goldfishDir: string;
  let memoriesDir: string;
  let todosDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-integration-test-'));
    goldfishDir = join(testDir, '.coa', 'goldfish');
    memoriesDir = join(goldfishDir, 'memories', 'test-workspace');
    todosDir = join(goldfishDir, 'todos', 'test-workspace');
    
    await fs.ensureDir(memoriesDir);
    await fs.ensureDir(todosDir);
    await fs.ensureDir(join(goldfishDir, 'memories', 'global'));
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('Memory Cleanup and Promotion', () => {
    test('should cleanup expired memories and enforce limits', async () => {
      const MAX_MEMORIES = 3; // Reduced for testing
      
      // Create memories with different ages
      const memories = [
        {
          id: '18C3A2B4000-000001',
          timestamp: new Date(Date.now() - (25 * 60 * 60 * 1000)), // 25 hours ago (expired)
          workspace: 'test-workspace',
          type: 'general',
          content: 'Old expired memory',
          ttlHours: 24
        },
        {
          id: '18C3A2B4F12-000002',
          timestamp: new Date(Date.now() - (1 * 60 * 60 * 1000)), // 1 hour ago (fresh)
          workspace: 'test-workspace',
          type: 'general',
          content: 'Fresh memory 1',
          ttlHours: 24
        },
        {
          id: '18C3A2B4F13-000003',
          timestamp: new Date(Date.now() - (30 * 60 * 1000)), // 30 minutes ago (fresh)
          workspace: 'test-workspace',
          type: 'general',
          content: 'Fresh memory 2',
          ttlHours: 24
        },
        {
          id: '18C3A2B4F14-000004',
          timestamp: new Date(), // Just now (fresh)
          workspace: 'test-workspace',
          type: 'general',
          content: 'Fresh memory 3',
          ttlHours: 24
        },
        {
          id: '18C3A2B4F15-000005',
          timestamp: new Date(), // Just now (fresh) - over limit
          workspace: 'test-workspace',
          type: 'general',
          content: 'Fresh memory 4',
          ttlHours: 24
        }
      ];

      // Save all memories
      for (const memory of memories) {
        await fs.writeJson(join(memoriesDir, `${memory.id}.json`), memory);
      }

      // Simulate cleanup process
      const cleanupExpiredMemories = async (): Promise<number> => {
        const files = await fs.readdir(memoriesDir);
        const now = new Date();
        let cleaned = 0;

        // Remove expired memories
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          try {
            const memory = await fs.readJson(join(memoriesDir, file));
            const age = (now.getTime() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
            
            if (age > memory.ttlHours) {
              await fs.remove(join(memoriesDir, file));
              cleaned++;
            }
          } catch (error) {
            await fs.remove(join(memoriesDir, file));
            cleaned++;
          }
        }

        // Enforce memory limits
        const remainingFiles = await fs.readdir(memoriesDir);
        if (remainingFiles.length > MAX_MEMORIES) {
          const sortedFiles = remainingFiles
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse(); // Most recent first

          const toDelete = sortedFiles.slice(MAX_MEMORIES);
          for (const file of toDelete) {
            await fs.remove(join(memoriesDir, file));
            cleaned++;
          }
        }

        return cleaned;
      };

      const cleanedCount = await cleanupExpiredMemories();
      expect(cleanedCount).toBeGreaterThan(0);

      // Check remaining files
      const remainingFiles = await fs.readdir(memoriesDir);
      expect(remainingFiles.length).toBeLessThanOrEqual(MAX_MEMORIES);
      
      // Expired memory should be gone
      expect(await fs.pathExists(join(memoriesDir, '18C3A2B4000-000001.json'))).toBe(false);
    });

    test('should identify memories for promotion to ProjectKnowledge', async () => {
      const shouldPromoteMemory = (memory: any): boolean => {
        const ageHours = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
        
        if (ageHours < 12) return false;

        if (memory.type === 'checkpoint' && memory.metadata?.isSession) {
          return true;
        }

        if (memory.tags?.some((tag: string) => ['important', 'decision', 'architecture', 'bug-fix'].includes(tag))) {
          return true;
        }

        if (memory.type === 'context' && typeof memory.content === 'string' && memory.content.length > 200) {
          return true;
        }

        return false;
      };

      const promotableMemory = {
        id: 'test-id',
        timestamp: new Date(Date.now() - (13 * 60 * 60 * 1000)), // 13 hours ago
        type: 'checkpoint',
        content: 'Important session checkpoint',
        metadata: { isSession: true }
      };

      const nonPromotableMemory = {
        id: 'test-id-2',
        timestamp: new Date(Date.now() - (1 * 60 * 60 * 1000)), // 1 hour ago
        type: 'general',
        content: 'Recent memory'
      };

      expect(shouldPromoteMemory(promotableMemory)).toBe(true);
      expect(shouldPromoteMemory(nonPromotableMemory)).toBe(false);
    });
  });

  describe('Session Save and Restore Workflow', () => {
    test('should save session with all context', async () => {
      const sessionId = 'test-session-123';
      const sessionData = {
        sessionId,
        description: 'Working on Goldfish MCP improvements',
        activeFiles: ['src/index.ts', 'README.md'],
        currentBranch: 'feature/improvements',
        workContext: 'Implementing new tool descriptions',
        savedAt: new Date().toISOString(),
        workspace: 'test-workspace'
      };

      const sessionMemory = {
        id: '18C3A2B4F16-SESS01',
        timestamp: new Date(),
        workspace: 'test-workspace',
        sessionId,
        type: 'checkpoint',
        content: sessionData,
        ttlHours: 72,
        tags: ['session-state', 'checkpoint'],
        metadata: { isSession: true }
      };

      await fs.writeJson(join(memoriesDir, `${sessionMemory.id}.json`), sessionMemory);
      
      // Verify session was saved
      const savedSession = await fs.readJson(join(memoriesDir, `${sessionMemory.id}.json`));
      expect(savedSession.content.sessionId).toBe(sessionId);
      expect(savedSession.content.activeFiles).toEqual(['src/index.ts', 'README.md']);
      expect(savedSession.metadata.isSession).toBe(true);
    });

    test('should restore most recent session by sessionId', async () => {
      const sessionId = 'restore-test-session';
      
      // Create multiple sessions with same ID (different timestamps)
      const sessions = [
        {
          id: '18C3A2B4F17-SESS02',
          timestamp: new Date(Date.now() - (2 * 60 * 60 * 1000)), // 2 hours ago
          sessionId,
          type: 'checkpoint',
          content: { sessionId, description: 'Older session' },
          metadata: { isSession: true }
        },
        {
          id: '18C3A2B4F18-SESS03',
          timestamp: new Date(Date.now() - (30 * 60 * 1000)), // 30 minutes ago (most recent)
          sessionId,
          type: 'checkpoint',
          content: { sessionId, description: 'Most recent session' },
          metadata: { isSession: true }
        }
      ];

      for (const session of sessions) {
        await fs.writeJson(join(memoriesDir, `${session.id}.json`), session);
      }

      // Simulate finding latest session
      const findLatestSession = async (targetSessionId: string) => {
        const files = await fs.readdir(memoriesDir);
        const sessionMemories = [];
        
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          const memory = await fs.readJson(join(memoriesDir, file));
          if (memory.type === 'checkpoint' && 
              memory.sessionId === targetSessionId && 
              memory.metadata?.isSession) {
            sessionMemories.push(memory);
          }
        }
        
        // Sort by chronological ID (most recent first)
        return sessionMemories.sort((a, b) => b.id.localeCompare(a.id))[0];
      };

      const latestSession = await findLatestSession(sessionId);
      expect(latestSession).toBeTruthy();
      expect(latestSession.content.description).toBe('Most recent session');
      expect(latestSession.id).toBe('18C3A2B4F18-SESS03');
    });
  });

  describe('TODO List Lifecycle', () => {
    test('should create, update, and promote TODO lists', async () => {
      // Create TODO list
      const todoList = {
        id: '18C3A2B4F19-TODO01',
        title: 'Goldfish Improvements',
        items: [
          {
            id: '18C3A2B4F1A-ITEM01',
            task: 'Update tool descriptions',
            status: 'pending',
            priority: 'high',
            createdAt: new Date()
          },
          {
            id: '18C3A2B4F1B-ITEM02',
            task: 'Write comprehensive tests',
            status: 'pending',
            priority: 'normal',
            createdAt: new Date()
          }
        ],
        createdAt: new Date(),
        workspace: 'test-workspace',
        tags: ['development', 'mcp']
      };

      await fs.writeJson(join(todosDir, `${todoList.id}.json`), todoList);

      // Update TODO item status
      const updateTodoStatus = async (listId: string, itemId: string, newStatus: string) => {
        const todoPath = join(todosDir, `${listId}.json`);
        const todo = await fs.readJson(todoPath);
        
        const item = todo.items.find((i: any) => i.id === itemId || i.id.startsWith(itemId));
        if (item) {
          item.status = newStatus;
          item.updatedAt = new Date();
          todo.updatedAt = new Date();
          
          await fs.writeJson(todoPath, todo, { spaces: 2 });
          return true;
        }
        return false;
      };

      const updated = await updateTodoStatus(todoList.id, todoList.items[0].id, 'done');
      expect(updated).toBe(true);

      // Verify update
      const updatedTodo = await fs.readJson(join(todosDir, `${todoList.id}.json`));
      expect(updatedTodo.items[0].status).toBe('done');
      expect(updatedTodo.updatedAt).toBeTruthy();

      // Test promotion logic
      const shouldPromoteTodoList = (list: any): boolean => {
        const completedItems = list.items.filter((item: any) => item.status === 'done');
        return completedItems.length > 0; // Has completed work
      };

      expect(shouldPromoteTodoList(updatedTodo)).toBe(true);
    });

    test('should cleanup expired TODO lists', async () => {
      const now = new Date();
      
      // Create old TODO list (older than 72 hours)
      const oldTodoList = {
        id: '18C3A2B4000-OLDTOD',
        title: 'Old TODO List',
        items: [],
        createdAt: new Date(now.getTime() - (75 * 60 * 60 * 1000)), // 75 hours ago
        workspace: 'test-workspace'
      };

      // Create fresh TODO list
      const freshTodoList = {
        id: '18C3A2B4F1C-NEWTOD',
        title: 'Fresh TODO List',
        items: [],
        createdAt: new Date(now.getTime() - (1 * 60 * 60 * 1000)), // 1 hour ago
        workspace: 'test-workspace'
      };

      await fs.writeJson(join(todosDir, `${oldTodoList.id}.json`), oldTodoList);
      await fs.writeJson(join(todosDir, `${freshTodoList.id}.json`), freshTodoList);

      // Cleanup logic
      const cleanupExpiredTodoLists = async (): Promise<number> => {
        const files = await fs.readdir(todosDir);
        let cleaned = 0;

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          try {
            const todoList = await fs.readJson(join(todosDir, file));
            const ageHours = (now.getTime() - new Date(todoList.createdAt).getTime()) / (1000 * 60 * 60);
            
            if (ageHours > 72) { // 3 days
              await fs.remove(join(todosDir, file));
              cleaned++;
            }
          } catch (error) {
            await fs.remove(join(todosDir, file));
            cleaned++;
          }
        }

        return cleaned;
      };

      const cleanedCount = await cleanupExpiredTodoLists();
      expect(cleanedCount).toBe(1);

      // Old TODO should be gone, fresh should remain
      expect(await fs.pathExists(join(todosDir, `${oldTodoList.id}.json`))).toBe(false);
      expect(await fs.pathExists(join(todosDir, `${freshTodoList.id}.json`))).toBe(true);
    });
  });

  describe('Cross-workspace Operations', () => {
    test('should handle multiple workspaces correctly', async () => {
      const workspaces = ['workspace-a', 'workspace-b', 'global'];
      
      // Create memories in different workspaces
      for (let i = 0; i < workspaces.length; i++) {
        const workspace = workspaces[i];
        const wsDir = join(goldfishDir, 'memories', workspace);
        await fs.ensureDir(wsDir);
        
        const memory = {
          id: `2025011912${i.toString().padStart(4, '0')}-WS${i}`,
          timestamp: new Date(),
          workspace: workspace,
          type: 'general',
          content: `Memory from ${workspace}`,
          ttlHours: 24
        };

        await fs.writeJson(join(wsDir, `${memory.id}.json`), memory);
      }

      // Load memories from all workspaces
      const loadFromAllWorkspaces = async () => {
        const memories = [];
        const memoriesBaseDir = join(goldfishDir, 'memories');
        const dirs = await fs.readdir(memoriesBaseDir);

        for (const dir of dirs) {
          const wsDir = join(memoriesBaseDir, dir);
          const stat = await fs.stat(wsDir);
          
          if (stat.isDirectory()) {
            const files = await fs.readdir(wsDir);
            
            for (const file of files) {
              if (file.endsWith('.json')) {
                const memory = await fs.readJson(join(wsDir, file));
                memories.push(memory);
              }
            }
          }
        }

        return memories;
      };

      const allMemories = await loadFromAllWorkspaces();
      expect(allMemories.length).toBe(3);
      
      const workspaceNames = allMemories.map(m => m.workspace);
      expect(workspaceNames).toContain('workspace-a');
      expect(workspaceNames).toContain('workspace-b');
      expect(workspaceNames).toContain('global');
    });
  });
});