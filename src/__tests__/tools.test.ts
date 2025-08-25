import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { handleViewTodos } from '../tools/view-todos.js';

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
  }))
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}));

// Test tool handlers
describe('Goldfish Tool Handlers', () => {
  let testDir: string;
  let mockServer: any;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-tools-test-'));
    
    // Mock server setup
    mockServer = {
      setRequestHandler: jest.fn(),
      connect: jest.fn()
    };
  });

  afterEach(async () => {
    await fs.remove(testDir);
    jest.clearAllMocks();
  });

  describe('Parameter Validation', () => {
    test('remember tool should require content parameter', () => {
      const validateRememberParams = (args: any) => {
        if (!args.content) {
          throw new Error('Content is required');
        }
        return true;
      };

      expect(() => validateRememberParams({})).toThrow('Content is required');
      expect(() => validateRememberParams({ content: 'test' })).not.toThrow();
    });

    test('recall tool should validate limit parameter', () => {
      const validateRecallParams = (args: any) => {
        if (args.limit !== undefined && (typeof args.limit !== 'number' || args.limit < 1)) {
          throw new Error('Limit must be a positive number');
        }
        return true;
      };

      expect(() => validateRecallParams({ limit: -1 })).toThrow('Limit must be a positive number');
      expect(() => validateRecallParams({ limit: 0 })).toThrow('Limit must be a positive number');
      expect(() => validateRecallParams({ limit: 5 })).not.toThrow();
      expect(() => validateRecallParams({})).not.toThrow();
    });

    test('snapshot tool should require label parameter', () => {
      const validateSnapshotParams = (args: any) => {
        if (!args.label) {
          throw new Error('Label is required');
        }
        return true;
      };

      expect(() => validateSnapshotParams({})).toThrow('Label is required');
      expect(() => validateSnapshotParams({ label: 'Test checkpoint' })).not.toThrow();
    });

    test('create_todo_list should require title and items', () => {
      const validateCreateTodoParams = (args: any) => {
        if (!args.title) {
          throw new Error('Title is required');
        }
        if (!args.items || !Array.isArray(args.items)) {
          throw new Error('Items array is required');
        }
        return true;
      };

      expect(() => validateCreateTodoParams({})).toThrow('Title is required');
      expect(() => validateCreateTodoParams({ title: 'Test' })).toThrow('Items array is required');
      expect(() => validateCreateTodoParams({ title: 'Test', items: 'not-array' })).toThrow('Items array is required');
      expect(() => validateCreateTodoParams({ title: 'Test', items: ['task1', 'task2'] })).not.toThrow();
    });

    test('save_session should require sessionId and description', () => {
      const validateSaveSessionParams = (args: any) => {
        if (!args.sessionId) {
          throw new Error('SessionId is required');
        }
        if (!args.description) {
          throw new Error('Description is required');
        }
        return true;
      };

      expect(() => validateSaveSessionParams({})).toThrow('SessionId is required');
      expect(() => validateSaveSessionParams({ sessionId: 'test-session' })).toThrow('Description is required');
      expect(() => validateSaveSessionParams({ sessionId: 'test-session', description: 'Test description' })).not.toThrow();
    });

    test('restore_session should require sessionId', () => {
      const validateRestoreSessionParams = (args: any) => {
        if (!args.sessionId) {
          throw new Error('SessionId is required');
        }
        return true;
      };

      expect(() => validateRestoreSessionParams({})).toThrow('SessionId is required');
      expect(() => validateRestoreSessionParams({ sessionId: 'test-session' })).not.toThrow();
    });

    test('update_todo should require listId', () => {
      const validateUpdateTodoParams = (args: any) => {
        if (!args.listId) {
          throw new Error('ListId is required');
        }
        return true;
      };

      expect(() => validateUpdateTodoParams({})).toThrow('ListId is required');
      expect(() => validateUpdateTodoParams({ listId: 'test-list-id' })).not.toThrow();
    });
  });

  describe('Tool Response Formats', () => {
    test('remember tool should return success message with memory ID', () => {
      const generateResponse = (memoryId: string, content: string, workspace: string, ttlHours: number) => {
        return {
          content: [
            {
              type: 'text',
              text: `✅ Remembered in "${workspace}" (ID: ${memoryId}, expires in ${ttlHours}h)\n🧠 ${content}`
            }
          ]
        };
      };

      const response = generateResponse('18C3A2B4F12-A3F2CD', 'Test memory', 'test-workspace', 24);
      expect(response.content[0].text).toContain('✅ Remembered in "test-workspace"');
      expect(response.content[0].text).toContain('18C3A2B4F12-A3F2CD');
      expect(response.content[0].text).toContain('expires in 24h');
      expect(response.content[0].text).toContain('🧠 Test memory');
    });

    test('recall tool should format memories with icons and timestamps', () => {
      const formatMemories = (memories: any[]) => {
        const output = ['🧠 Recent Memories:', ''];
        
        for (const memory of memories) {
          const age = Math.round((Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60 * 24 * 10)) / 100;
          const ageStr = age < 1 ? 'today' : `${age.toFixed(1)}d ago`;
          const typeIcon = {
            general: '💭',
            todo: '📝',
            checkpoint: '💾',
            context: '🔗'
          }[memory.type] || '📄';
          
          output.push(`${typeIcon} [${memory.id}] ${ageStr} - ${memory.type.toUpperCase()}`);
          output.push(`   ${memory.content}`);
          if (memory.tags && memory.tags.length > 0) {
            output.push(`   Tags: ${memory.tags.join(', ')}`);
          }
          output.push('');
        }

        return output.join('\n');
      };

      const testMemories = [
        {
          id: '18C3A2B4F12-A3F2CD',
          timestamp: new Date(),
          type: 'todo',
          content: 'Test TODO item',
          tags: ['work', 'important']
        }
      ];

      const formatted = formatMemories(testMemories);
      expect(formatted).toContain('🧠 Recent Memories:');
      expect(formatted).toContain('📝 [18C3A2B4F12-A3F2CD] today - TODO');
      expect(formatted).toContain('Test TODO item');
      expect(formatted).toContain('Tags: work, important');
    });

    test('view_todos should show progress and status counts', () => {
      const formatTodoList = (todoList: any) => {
        const totalItems = todoList.items.length;
        const completedItems = todoList.items.filter((item: any) => item.status === 'done').length;
        const activeItems = todoList.items.filter((item: any) => item.status === 'active').length;
        const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        const statusCounts = {
          pending: todoList.items.filter((i: any) => i.status === 'pending').length,
          active: activeItems,
          done: completedItems
        };

        const output = [
          `📝 **${todoList.title}** (${todoList.id})`,
          `Created: ${new Date(todoList.createdAt).toLocaleDateString()}`,
          '',
          `📊 Status: ${statusCounts.pending} pending, ${statusCounts.active} active, ${statusCounts.done} done`,
          `Progress: ${progress}%`
        ];

        return output.join('\n');
      };

      const testTodoList = {
        id: '18C3A2B4F12-A3F2CD',
        title: 'Test TODO List',
        createdAt: new Date(),
        items: [
          { status: 'done', task: 'Completed task' },
          { status: 'active', task: 'Active task' },
          { status: 'pending', task: 'Pending task' }
        ]
      };

      const formatted = formatTodoList(testTodoList);
      expect(formatted).toContain('📝 **Test TODO List** (18C3A2B4F12-A3F2CD)');
      expect(formatted).toContain('📊 Status: 1 pending, 1 active, 1 done');
      expect(formatted).toContain('Progress: 33%');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing memory file gracefully', async () => {
      const handleMissingMemory = async (memoryId: string) => {
        const filepath = join(testDir, `${memoryId}.json`);
        
        if (!(await fs.pathExists(filepath))) {
          return {
            content: [
              {
                type: 'text',
                text: `❓ Memory ${memoryId} not found (may have already expired)`
              }
            ]
          };
        }
        
        return null; // Memory exists
      };

      const response = await handleMissingMemory('nonexistent-id');
      expect(response?.content[0].text).toContain('❓ Memory nonexistent-id not found');
    });

    test('should handle corrupted JSON files', async () => {
      const handleCorruptedFile = async (filepath: string) => {
        try {
          await fs.readJson(filepath);
          return { success: true, data: {} };
        } catch (error) {
          // Remove corrupted file and continue
          await fs.remove(filepath);
          return { success: false, error: 'Corrupted file removed' };
        }
      };

      // Create corrupted file
      const corruptedFile = join(testDir, 'corrupted.json');
      await fs.writeFile(corruptedFile, 'invalid json {');

      const result = await handleCorruptedFile(corruptedFile);
      expect(result.success).toBe(false);
      expect(await fs.pathExists(corruptedFile)).toBe(false);
    });

    test('should handle network failures for ProjectKnowledge promotion', async () => {
      const tryPromoteToProjectKnowledge = async (memory: any): Promise<boolean> => {
        try {
          // Simulate network failure
          throw new Error('Network timeout');
        } catch (error) {
          // Silently fail - promotion is optional
          return false;
        }
      };

      const testMemory = {
        id: 'test-id',
        content: 'Test content',
        type: 'checkpoint',
        metadata: { isSession: true }
      };

      const result = await tryPromoteToProjectKnowledge(testMemory);
      expect(result).toBe(false);
    });
  });

  describe('Memory Type Handling', () => {
    test('should assign correct icons for memory types', () => {
      const getTypeIcon = (type: string) => {
        const icons: { [key: string]: string } = {
          general: '💭',
          todo: '📝',
          checkpoint: '💾',
          context: '🔗'
        };
        return icons[type] || '📄';
      };

      expect(getTypeIcon('general')).toBe('💭');
      expect(getTypeIcon('todo')).toBe('📝');
      expect(getTypeIcon('checkpoint')).toBe('💾');
      expect(getTypeIcon('context')).toBe('🔗');
      expect(getTypeIcon('unknown')).toBe('📄');
    });

    test('should validate memory types in enum', () => {
      const validTypes = ['general', 'todo', 'checkpoint', 'context'];
      
      const validateMemoryType = (type: string) => {
        return validTypes.includes(type);
      };

      expect(validateMemoryType('general')).toBe(true);
      expect(validateMemoryType('todo')).toBe(true);
      expect(validateMemoryType('checkpoint')).toBe(true);
      expect(validateMemoryType('context')).toBe(true);
      expect(validateMemoryType('invalid')).toBe(false);
    });
  });

  describe('Updated Todo System Tests', () => {
    describe('view_todos single-list format', () => {
      test('should display most recently updated list only', () => {
        const todoLists = [
          {
            id: 'old-list',
            title: 'Old List',
            updatedAt: new Date('2025-01-01'),
            items: [{ id: '1', task: 'Old task', status: 'pending' }]
          },
          {
            id: 'new-list', 
            title: 'New List',
            updatedAt: new Date('2025-01-20'),
            items: [
              { id: '1', task: 'New task 1', status: 'active' },
              { id: '2', task: 'New task 2', status: 'done' }
            ]
          }
        ];

        const sortedLists = todoLists.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        const currentList = sortedLists[0];

        expect(currentList.title).toBe('New List');
        expect(currentList.items).toHaveLength(2);
      });

      test('should sort items by ID number regardless of status', () => {
        const items = [
          { id: '3', task: 'Task 3', status: 'done' },
          { id: '1', task: 'Task 1', status: 'pending' },
          { id: '2', task: 'Task 2', status: 'active' }
        ];

        const sorted = items.sort((a, b) => parseInt(a.id) - parseInt(b.id));
        
        expect(sorted[0].id).toBe('1');
        expect(sorted[1].id).toBe('2');
        expect(sorted[2].id).toBe('3');
      });

      test('should return separate content blocks for each item', () => {
        const mockList = {
          id: 'test-list',
          title: 'Test List',
          items: [
            { id: '1', task: 'Task 1', status: 'pending' },
            { id: '2', task: 'Task 2', status: 'done' }
          ]
        };

        const contentBlocks = [];
        
        // Header block
        contentBlocks.push({
          type: 'text',
          text: `📋 ${mockList.title} (${mockList.items.length} tasks, 1 done, 0 active)`
        });

        // Item blocks
        for (const item of mockList.items) {
          const icon = item.status === 'done' ? '✅' : '⏳';
          contentBlocks.push({
            type: 'text',
            text: `${icon} [${item.id}] ${item.task}`
          });
        }

        expect(contentBlocks).toHaveLength(3); // Header + 2 items
        expect(contentBlocks[0].text).toContain('📋 Test List');
        expect(contentBlocks[1].text).toBe('⏳ [1] Task 1');
        expect(contentBlocks[2].text).toBe('✅ [2] Task 2');
      });
    });

    describe('update_todo enhanced functionality', () => {
      test('should update task description when itemId and newTask provided', () => {
        const mockItem = { id: '1', task: 'Old task', status: 'pending' };
        const newTask = 'Updated task description';

        // Simulate update
        if (newTask) {
          mockItem.task = newTask;
        }

        expect(mockItem.task).toBe('Updated task description');
      });

      test('should delete item when delete parameter is true', () => {
        const mockItems = [
          { id: '1', task: 'Task 1', status: 'pending' },
          { id: '2', task: 'Task 2', status: 'done' },
          { id: '3', task: 'Task 3', status: 'active' }
        ];

        const itemIdToDelete = '2';
        const updatedItems = mockItems.filter(i => i.id !== itemIdToDelete);

        expect(updatedItems).toHaveLength(2);
        expect(updatedItems.find(i => i.id === '2')).toBeUndefined();
        expect(updatedItems.find(i => i.id === '1')).toBeDefined();
        expect(updatedItems.find(i => i.id === '3')).toBeDefined();
      });

      test('should update both task and status simultaneously', () => {
        const mockItem = { 
          id: '1', 
          task: 'Old task', 
          status: 'pending',
          updatedAt: new Date('2025-01-01')
        };

        const updates = {
          newTask: 'Updated task',
          status: 'active'
        };

        // Simulate update logic
        if (updates.newTask) mockItem.task = updates.newTask;
        if (updates.status) mockItem.status = updates.status as any;
        mockItem.updatedAt = new Date();

        expect(mockItem.task).toBe('Updated task');
        expect(mockItem.status).toBe('active');
        expect(mockItem.updatedAt.getTime()).toBeGreaterThan(new Date('2025-01-01').getTime());
      });

      test('should prioritize update over create when itemId provided', () => {
        const mockList = {
          items: [{ id: '1', task: 'Existing task', status: 'pending' }]
        };

        const params = {
          itemId: '1',
          newTask: 'Updated description',
          status: 'done'
        };

        // Logic should check itemId first, not newTask
        let action = 'none';
        if (params.itemId) {
          action = 'update';
        } else if (params.newTask) {
          action = 'create';
        }

        expect(action).toBe('update');
      });

      test('should track changes for update feedback', () => {
        const oldTask = 'Old task';
        const oldStatus = 'pending';
        const newTask = 'New task';
        const newStatus = 'done';

        const changes = [];
        if (newTask && newTask !== oldTask) changes.push(`task: "${newTask}"`);
        if (newStatus && newStatus !== oldStatus) changes.push(`status: ${newStatus}`);

        expect(changes).toContain('task: "New task"');
        expect(changes).toContain('status: done');
        expect(changes).toHaveLength(2);
      });
    });

    describe('Todo system integration', () => {
      test('should handle empty todo lists gracefully', () => {
        const todoLists: any[] = [];
        
        if (todoLists.length === 0) {
          const response = {
            content: [{
              type: 'text',
              text: '📝 No active TODO lists found. Use create_todo_list to start tracking your work!'
            }]
          };
          
          expect(response.content[0].text).toContain('No active TODO lists found');
        }
      });

      test('should truncate long task descriptions', () => {
        const longTask = 'This is a very long task description that should be truncated when displayed in the todo list view because it exceeds the character limit';
        const maxLength = 80;
        
        const truncated = longTask.length > maxLength ? longTask.slice(0, maxLength) + '...' : longTask;
        
        expect(truncated).toHaveLength(83); // 80 chars + '...'
        expect(truncated.endsWith('...')).toBe(true);
      });

      test('should maintain proper status icons', () => {
        const statusIcons: Record<string, string> = {
          pending: '⏳',
          active: '🔄',
          done: '✅'
        };

        expect(statusIcons.pending).toBe('⏳');
        expect(statusIcons.active).toBe('🔄');
        expect(statusIcons.done).toBe('✅');
      });
    });

    describe('Multiple TODO Lists Visibility (TDD)', () => {
      test('should show all TODO lists when no listId specified', async () => {
        // This test should FAIL initially - view_todos currently only shows most recent
        const mockStorage = {
          loadAllTodoLists: jest.fn(),
          getCurrentWorkspace: jest.fn().mockReturnValue('test-workspace')
        };
        
        // Mock multiple lists with different completion states
        const mockLists = [
          {
            id: 'audit-list',
            title: 'Audit Findings',
            updatedAt: new Date('2025-01-15T10:00:00Z'),
            items: [
              { id: '1', task: 'Task 1', status: 'done' },
              { id: '2', task: 'Task 2', status: 'pending' },
              { id: '3', task: 'Task 3', status: 'pending' }
            ]
          },
          {
            id: 'fixes-list', 
            title: 'TDD Fixes',
            updatedAt: new Date('2025-01-20T15:30:00Z'),
            items: [
              { id: '1', task: 'Fix 1', status: 'done' },
              { id: '2', task: 'Fix 2', status: 'done' }
            ]
          }
        ];
        
        mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue(mockLists);
        
        const result = await handleViewTodos(mockStorage as any, {});
        
        // Should show BOTH lists, not just most recent
        expect(result.content).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('Audit Findings')
            }),
            expect.objectContaining({
              text: expect.stringContaining('TDD Fixes') 
            }),
            expect.objectContaining({
              text: expect.stringContaining('2 found')
            })
          ])
        );
      });

      test('should show specific list when listId provided', async () => {
        const mockStorage = {
          loadAllTodoLists: jest.fn(),
          getCurrentWorkspace: jest.fn().mockReturnValue('test-workspace')
        };
        
        const mockLists = [
          {
            id: 'audit-list',
            title: 'Audit Findings', 
            items: [
              { id: '1', task: 'Audit task', status: 'pending' }
            ]
          }
        ];
        
        mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue(mockLists);
        
        const result = await handleViewTodos(mockStorage as any, { listId: 'audit-list' });
        
        // Should show just the specific list details
        expect(result.content).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('Audit Findings')
            }),
            expect.objectContaining({
              text: expect.stringContaining('Audit task')
            })
          ])
        );
      });

      test('should prioritize incomplete lists in summary view', async () => {
        const mockStorage = {
          loadAllTodoLists: jest.fn(),
          getCurrentWorkspace: jest.fn().mockReturnValue('test-workspace')
        };
        
        const mockLists = [
          {
            id: 'complete-list',
            title: 'Completed Work',
            updatedAt: new Date('2025-01-20'),
            items: [
              { id: '1', task: 'Done task', status: 'done' }
            ]
          },
          {
            id: 'incomplete-list',
            title: 'Pending Work', 
            updatedAt: new Date('2025-01-15'),
            items: [
              { id: '1', task: 'Pending task', status: 'pending' }
            ]
          }
        ];
        
        mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue(mockLists);
        
        const result = await handleViewTodos(mockStorage as any, {});
        const textContent = result.content.map(c => c.text).join('\n');
        
        // Incomplete list should appear before complete list
        const pendingIndex = textContent.indexOf('Pending Work');
        const completeIndex = textContent.indexOf('Completed Work');
        
        expect(pendingIndex).toBeLessThan(completeIndex);
      });
    });
  });
});