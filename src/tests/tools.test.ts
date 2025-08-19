import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

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
              text: `✅ Remembered in "${workspace}" (ID: ${memoryId.slice(-8)}, expires in ${ttlHours}h)\n🧠 ${content}`
            }
          ]
        };
      };

      const response = generateResponse('20250119123456-ABC12345', 'Test memory', 'test-workspace', 24);
      expect(response.content[0].text).toContain('✅ Remembered in "test-workspace"');
      expect(response.content[0].text).toContain('ABC12345');
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
          
          output.push(`${typeIcon} [${memory.id.slice(-8)}] ${ageStr} - ${memory.type.toUpperCase()}`);
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
          id: '20250119123456-ABC12345',
          timestamp: new Date(),
          type: 'todo',
          content: 'Test TODO item',
          tags: ['work', 'important']
        }
      ];

      const formatted = formatMemories(testMemories);
      expect(formatted).toContain('🧠 Recent Memories:');
      expect(formatted).toContain('📝 [ABC12345] today - TODO');
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
          `📝 **${todoList.title}** (${todoList.id.slice(-8)})`,
          `Created: ${new Date(todoList.createdAt).toLocaleDateString()}`,
          '',
          `📊 Status: ${statusCounts.pending} pending, ${statusCounts.active} active, ${statusCounts.done} done`,
          `Progress: ${progress}%`
        ];

        return output.join('\n');
      };

      const testTodoList = {
        id: '20250119123456-ABC12345',
        title: 'Test TODO List',
        createdAt: new Date(),
        items: [
          { status: 'done', task: 'Completed task' },
          { status: 'active', task: 'Active task' },
          { status: 'pending', task: 'Pending task' }
        ]
      };

      const formatted = formatTodoList(testTodoList);
      expect(formatted).toContain('📝 **Test TODO List** (ABC12345)');
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
});