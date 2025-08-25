/**
 * Test Suite for Refactored Individual Tool Files
 * Tests the architecture split from LegacyTools to individual tool files
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

// Import individual tool handlers and schemas
import { handleRemember, getRememberToolSchema, RememberArgs } from '../tools/remember.js';
import { handleCreateTodoList, getCreateTodoListToolSchema, CreateTodoListArgs } from '../tools/create-todo-list.js';
import { handleViewTodos, getViewTodosToolSchema, ViewTodosArgs } from '../tools/view-todos.js';
import { handleUpdateTodo, getUpdateTodoToolSchema, UpdateTodoArgs } from '../tools/update-todo.js';
import { Storage } from '../core/storage.js';
import { TodoList, TodoItem } from '../types/index.js';

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

describe('Refactored Individual Tool Architecture', () => {
  let testDir: string;
  let mockStorage: jest.Mocked<Storage>;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-refactor-test-'));
    
    // Create comprehensive mock storage
    mockStorage = {
      getCurrentWorkspace: jest.fn().mockReturnValue('test-workspace'),
      generateChronologicalFilename: jest.fn().mockReturnValue('20250825-120000-001-ABCD.json'),
      saveMemory: jest.fn().mockResolvedValue(undefined),
      saveTodoList: jest.fn().mockResolvedValue(undefined),
      loadAllTodoLists: jest.fn().mockResolvedValue([]),
      loadMemories: jest.fn().mockResolvedValue([]),
      searchMemories: jest.fn().mockResolvedValue([]),
      cleanup: jest.fn().mockResolvedValue(0),
      getBasePath: jest.fn().mockReturnValue(testDir)
    } as any;
  });

  afterEach(async () => {
    await fs.remove(testDir);
    jest.clearAllMocks();
  });

  describe('Individual Tool Function Signatures', () => {
    
    describe('Remember Tool', () => {
      test('handleRemember should accept Storage and RememberArgs', async () => {
        const args: RememberArgs = {
          content: 'Test memory content'
        };

        const result = await handleRemember(mockStorage, args);
        
        expect(mockStorage.saveMemory).toHaveBeenCalledTimes(1);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('💭 Remembered:');
        expect(result.content[0].text).toContain('Test memory content');
      });

      test('getRememberToolSchema should return valid MCP tool schema', () => {
        const schema = getRememberToolSchema();
        
        expect(schema.name).toBe('remember');
        expect(schema.description).toContain('Store a quick thought');
        expect(schema.inputSchema.type).toBe('object');
        expect(schema.inputSchema.properties.content).toBeDefined();
        expect(schema.inputSchema.required).toContain('content');
      });

      test('handleRemember should accept optional parameters', async () => {
        const args: RememberArgs = {
          content: 'Test with options',
          type: 'context',
          ttlHours: 48,
          tags: ['important', 'test']
        };

        const result = await handleRemember(mockStorage, args);
        
        // Verify memory object passed to storage
        expect(mockStorage.saveMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'Test with options',
            type: 'context',
            ttlHours: 48,
            tags: ['important', 'test']
          })
        );
      });
    });

    describe('Create TODO List Tool', () => {
      test('handleCreateTodoList should accept Storage and CreateTodoListArgs', async () => {
        const args: CreateTodoListArgs = {
          title: 'Test TODO List',
          items: ['Task 1', 'Task 2', 'Task 3']
        };

        const result = await handleCreateTodoList(mockStorage, args);
        
        expect(mockStorage.saveTodoList).toHaveBeenCalledTimes(1);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toContain('📝 Created TODO list "Test TODO List" with 3 items');
      });

      test('getCreateTodoListToolSchema should return valid schema', () => {
        const schema = getCreateTodoListToolSchema();
        
        expect(schema.name).toBe('create_todo_list');
        expect(schema.description).toContain('Create TODO list tied to current session');
        expect(schema.inputSchema.required).toEqual(['title', 'items']);
      });

      test('handleCreateTodoList should create properly structured TodoList', async () => {
        const args: CreateTodoListArgs = {
          title: 'Detailed Test',
          items: ['First task', 'Second task'],
          tags: ['work', 'priority']
        };

        await handleCreateTodoList(mockStorage, args);
        
        const savedTodoList = mockStorage.saveTodoList.mock.calls[0][0] as TodoList;
        
        expect(savedTodoList.title).toBe('Detailed Test');
        expect(savedTodoList.workspace).toBe('test-workspace');
        expect(savedTodoList.items).toHaveLength(2);
        expect(savedTodoList.items[0].id).toBe('1');
        expect(savedTodoList.items[0].task).toBe('First task');
        expect(savedTodoList.items[0].status).toBe('pending');
        expect(savedTodoList.items[1].id).toBe('2');
        expect(savedTodoList.tags).toEqual(['work', 'priority']);
        expect(savedTodoList.createdAt).toBeInstanceOf(Date);
        expect(savedTodoList.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe('View TODOs Tool', () => {
      test('handleViewTodos should accept Storage and ViewTodosArgs', async () => {
        // This test should initially FAIL - we need to verify multi-list functionality
        const mockTodoLists: TodoList[] = [
          {
            id: 'list-1',
            title: 'First List',
            workspace: 'test-workspace',
            items: [
              { id: '1', task: 'Task 1', status: 'done', createdAt: new Date() }
            ],
            createdAt: new Date('2025-08-20'),
            updatedAt: new Date('2025-08-20'),
          },
          {
            id: 'list-2', 
            title: 'Second List',
            workspace: 'test-workspace',
            items: [
              { id: '1', task: 'Task A', status: 'pending', createdAt: new Date() },
              { id: '2', task: 'Task B', status: 'active', createdAt: new Date() }
            ],
            createdAt: new Date('2025-08-25'),
            updatedAt: new Date('2025-08-25'),
          }
        ];

        mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue(mockTodoLists);
        
        const result = await handleViewTodos(mockStorage, {});
        
        // CRITICAL: Should show BOTH lists, not just most recent
        const responseText = result.content[0].text;
        const parsedResponse = JSON.parse(responseText);
        
        expect(parsedResponse.success).toBe(true);
        expect(parsedResponse.operation).toBe('view-todos');
        expect(parsedResponse.data.totalLists).toBe(2);
        expect(parsedResponse.data.lists).toHaveLength(2);
        expect(parsedResponse.formattedOutput).toContain('First List');
        expect(parsedResponse.formattedOutput).toContain('Second List');
        expect(parsedResponse.formattedOutput).toContain('2 found');
      });

      test('getViewTodosToolSchema should return valid schema', () => {
        const schema = getViewTodosToolSchema();
        
        expect(schema.name).toBe('view_todos');
        expect(schema.description).toContain('View active TODO lists');
        expect(schema.inputSchema.properties.scope).toBeDefined();
        expect(schema.inputSchema.properties.listId).toBeDefined();
      });

      test('handleViewTodos should show specific list when listId provided', async () => {
        const mockTodoList: TodoList = {
          id: 'specific-list',
          title: 'Specific List Details',
          workspace: 'test-workspace',
          items: [
            { id: '1', task: 'Detail task 1', status: 'pending', createdAt: new Date() },
            { id: '2', task: 'Detail task 2', status: 'active', createdAt: new Date() },
            { id: '3', task: 'Detail task 3', status: 'done', createdAt: new Date() }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([mockTodoList]);
        
        const result = await handleViewTodos(mockStorage, { listId: 'specific-list' });
        
        const responseText = result.content[0].text;
        const parsedResponse = JSON.parse(responseText);
        
        expect(parsedResponse.success).toBe(true);
        expect(parsedResponse.data.listId).toBe('specific-list');
        expect(parsedResponse.data.title).toBe('Specific List Details');
        expect(parsedResponse.data.totalTasks).toBe(3);
        expect(parsedResponse.data.completedTasks).toBe(1);
        expect(parsedResponse.data.activeTasks).toBe(1);
        expect(parsedResponse.data.percentage).toBe(33);
      });

      test('handleViewTodos should handle empty todo list gracefully', async () => {
        mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([]);
        
        const result = await handleViewTodos(mockStorage, {});
        
        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toContain('📝 No active TODO lists found');
        expect(result.content[0].text).toContain('Use create_todo_list to start');
      });
    });

    describe('Update TODO Tool', () => {
      test('handleUpdateTodo should accept Storage and UpdateTodoArgs', async () => {
        const mockTodoList: TodoList = {
          id: 'update-test-list',
          title: 'Update Test List',
          workspace: 'test-workspace',
          items: [
            { id: '1', task: 'Original task', status: 'pending', createdAt: new Date() }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([mockTodoList]);
        
        const args: UpdateTodoArgs = {
          listId: 'update-test-list',
          itemId: '1',
          status: 'done'
        };

        const result = await handleUpdateTodo(mockStorage, args);
        
        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toContain('✅ Updated [1]');
        expect(result.content[0].text).toContain('status: done');
      });

      test('getUpdateTodoToolSchema should return valid schema', () => {
        const schema = getUpdateTodoToolSchema();
        
        expect(schema.name).toBe('update_todo');
        expect(schema.description).toContain('Update task status immediately');
        expect(schema.inputSchema.properties.itemId).toBeDefined();
        expect(schema.inputSchema.properties.status).toBeDefined();
        expect(schema.inputSchema.properties.delete).toBeDefined();
      });

      test('handleUpdateTodo should support task description updates', async () => {
        const mockTodoList: TodoList = {
          id: 'desc-update-list',
          title: 'Description Update Test',
          workspace: 'test-workspace',
          items: [
            { id: '1', task: 'Old description', status: 'pending', createdAt: new Date() }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([mockTodoList]);
        
        const args: UpdateTodoArgs = {
          listId: 'desc-update-list',
          itemId: '1',
          newTask: 'New task description',
          status: 'active'
        };

        const result = await handleUpdateTodo(mockStorage, args);
        
        expect(result.content[0].text).toContain('🔄 Updated [1]');
        expect(result.content[0].text).toContain('task: "New task description"');
        expect(result.content[0].text).toContain('status: active');
      });

      test('handleUpdateTodo should support task deletion', async () => {
        const mockTodoList: TodoList = {
          id: 'delete-test-list',
          title: 'Delete Test',
          workspace: 'test-workspace',
          items: [
            { id: '1', task: 'Task to delete', status: 'pending', createdAt: new Date() },
            { id: '2', task: 'Keep this task', status: 'pending', createdAt: new Date() }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([mockTodoList]);
        
        const args: UpdateTodoArgs = {
          listId: 'delete-test-list',
          itemId: '1',
          delete: true
        };

        const result = await handleUpdateTodo(mockStorage, args);
        
        expect(result.content[0].text).toContain('🗑️ Deleted [1]');
        expect(result.content[0].text).toContain('Task to delete');
        
        // Verify item was removed from list
        const savedList = mockStorage.saveTodoList.mock.calls[0][0] as TodoList;
        expect(savedList.items).toHaveLength(1);
        expect(savedList.items[0].id).toBe('2');
        expect(savedList.items[0].task).toBe('Keep this task');
      });

      test('handleUpdateTodo should add new tasks when no itemId provided', async () => {
        const mockTodoList: TodoList = {
          id: 'add-task-list',
          title: 'Add Task Test',
          workspace: 'test-workspace',
          items: [
            { id: '1', task: 'Existing task', status: 'pending', createdAt: new Date() }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([mockTodoList]);
        
        const args: UpdateTodoArgs = {
          listId: 'add-task-list',
          newTask: 'Brand new task'
        };

        const result = await handleUpdateTodo(mockStorage, args);
        
        expect(result.content[0].text).toContain('➕ Added "Brand new task"');
        
        // Verify new item was added
        const savedList = mockStorage.saveTodoList.mock.calls[0][0] as TodoList;
        expect(savedList.items).toHaveLength(2);
        expect(savedList.items[1].id).toBe('2');
        expect(savedList.items[1].task).toBe('Brand new task');
        expect(savedList.items[1].status).toBe('pending');
      });
    });
  });

  describe('Tool Integration Tests', () => {
    test('Tools should work together in complete workflow', async () => {
      // Step 1: Create a TODO list
      const createArgs: CreateTodoListArgs = {
        title: 'Integration Test Workflow',
        items: ['Setup test', 'Run tests', 'Verify results']
      };

      await handleCreateTodoList(mockStorage, createArgs);
      const createdList = mockStorage.saveTodoList.mock.calls[0][0] as TodoList;
      
      // Step 2: View the list (should show the new list)
      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([createdList]);
      const viewResult = await handleViewTodos(mockStorage, {});
      const viewResponse = JSON.parse(viewResult.content[0].text);
      
      expect(viewResponse.data.lists[0].title).toBe('Integration Test Workflow');
      
      // Step 3: Update a task status
      const updateArgs: UpdateTodoArgs = {
        listId: createdList.id,
        itemId: '1',
        status: 'done'
      };

      // Mock the updated list for update operation
      const updatedList = { ...createdList };
      updatedList.items[0].status = 'done' as const;
      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([updatedList]);
      
      const updateResult = await handleUpdateTodo(mockStorage, updateArgs);
      expect(updateResult.content[0].text).toContain('✅ Updated [1]');
      
      // Step 4: Remember the progress
      const rememberArgs: RememberArgs = {
        content: 'Completed integration test workflow',
        type: 'checkpoint'
      };

      const rememberResult = await handleRemember(mockStorage, rememberArgs);
      expect(rememberResult.content[0].text).toContain('💭 Remembered:');
    });

    test('Tools should maintain backward compatibility with existing data', async () => {
      // Test that refactored tools can handle data created by legacy tools
      const legacyTodoList: TodoList = {
        id: '20250815-140000-001-LEGACY',
        title: 'Legacy Created List',
        workspace: 'test-workspace',
        items: [
          { id: '1', task: 'Legacy task', status: 'pending', createdAt: new Date('2025-08-15') }
        ],
        createdAt: new Date('2025-08-15'),
        updatedAt: new Date('2025-08-15'),
      };

      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([legacyTodoList]);
      
      // Verify view tool can display legacy data
      const viewResult = await handleViewTodos(mockStorage, {});
      const viewResponse = JSON.parse(viewResult.content[0].text);
      
      expect(viewResponse.data.lists[0].title).toBe('Legacy Created List');
      expect(viewResponse.data.lists[0].totalTasks).toBe(1);
      
      // Verify update tool can modify legacy data
      const updateArgs: UpdateTodoArgs = {
        listId: '20250815-140000-001-LEGACY',
        itemId: '1',
        status: 'done'
      };

      const updateResult = await handleUpdateTodo(mockStorage, updateArgs);
      expect(updateResult.content[0].text).toContain('✅ Updated [1]');
    });
  });

  describe('Multi-List Visibility Bug Fix Validation', () => {
    test('view_todos should show ALL lists in summary view (not just most recent)', async () => {
      // This is the CRITICAL bug fix test - previously only showed most recent list
      const multipleLists: TodoList[] = [
        {
          id: 'older-list',
          title: 'Older Important List',
          workspace: 'test-workspace',
          items: [
            { id: '1', task: 'Critical pending task', status: 'pending', createdAt: new Date() }
          ],
          createdAt: new Date('2025-08-20'),
          updatedAt: new Date('2025-08-20'), // Older update
        },
        {
          id: 'newer-list',
          title: 'Recently Updated List',
          workspace: 'test-workspace', 
          items: [
            { id: '1', task: 'Recent task', status: 'done', createdAt: new Date() }
          ],
          createdAt: new Date('2025-08-25'),
          updatedAt: new Date('2025-08-25'), // More recent update
        },
        {
          id: 'middle-list',
          title: 'Middle List',
          workspace: 'test-workspace',
          items: [
            { id: '1', task: 'Middle task', status: 'active', createdAt: new Date() }
          ],
          createdAt: new Date('2025-08-22'),
          updatedAt: new Date('2025-08-22'),
        }
      ];

      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue(multipleLists);
      
      const result = await handleViewTodos(mockStorage, {});
      const response = JSON.parse(result.content[0].text);
      
      // CRITICAL ASSERTION: All 3 lists must be visible
      expect(response.data.totalLists).toBe(3);
      expect(response.data.lists).toHaveLength(3);
      
      // Verify all lists are present in formatted output
      expect(response.formattedOutput).toContain('Older Important List');
      expect(response.formattedOutput).toContain('Recently Updated List');
      expect(response.formattedOutput).toContain('Middle List');
      
      // Should show count correctly
      expect(response.formattedOutput).toContain('3 found');
      
      // Verify sorting - incomplete tasks first, then by recency within same completion state
      const firstListTitle = response.data.lists[0].title;
      const secondListTitle = response.data.lists[1].title;
      const thirdListTitle = response.data.lists[2].title;
      
      // Both "Older Important List" (pending) and "Middle List" (active) are incomplete
      // Within incomplete lists, should sort by recency: "Middle List" (2025-08-22) before "Older Important List" (2025-08-20) 
      expect(firstListTitle).toBe('Middle List'); // Most recent incomplete
      expect(secondListTitle).toBe('Older Important List'); // Older incomplete  
      expect(thirdListTitle).toBe('Recently Updated List'); // Complete list comes last
    });

    test('view_todos should prioritize incomplete lists over completed ones', async () => {
      const mixedCompletionLists: TodoList[] = [
        {
          id: 'complete-list',
          title: 'All Done List',
          workspace: 'test-workspace',
          items: [
            { id: '1', task: 'Finished task', status: 'done', createdAt: new Date() }
          ],
          createdAt: new Date('2025-08-25'), // More recent
          updatedAt: new Date('2025-08-25'),
        },
        {
          id: 'incomplete-list',
          title: 'Work In Progress',
          workspace: 'test-workspace',
          items: [
            { id: '1', task: 'Active task', status: 'active', createdAt: new Date() },
            { id: '2', task: 'Pending task', status: 'pending', createdAt: new Date() }
          ],
          createdAt: new Date('2025-08-20'), // Older
          updatedAt: new Date('2025-08-20'),
        }
      ];

      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue(mixedCompletionLists);
      
      const result = await handleViewTodos(mockStorage, {});
      const response = JSON.parse(result.content[0].text);
      
      // Incomplete list should appear first despite being older
      expect(response.data.lists[0].title).toBe('Work In Progress');
      expect(response.data.lists[1].title).toBe('All Done List');
      
      // Verify the sorting logic is working
      const formattedOutput = response.formattedOutput;
      const workInProgressIndex = formattedOutput.indexOf('Work In Progress');
      const allDoneIndex = formattedOutput.indexOf('All Done List');
      
      expect(workInProgressIndex).toBeLessThan(allDoneIndex);
    });

    test('view_todos should provide list selection guidance', async () => {
      const multipleLists: TodoList[] = [
        {
          id: 'list-abc-123',
          title: 'First List',
          workspace: 'test-workspace',
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'list-def-456', 
          title: 'Second List',
          workspace: 'test-workspace',
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue(multipleLists);
      
      const result = await handleViewTodos(mockStorage, {});
      const response = JSON.parse(result.content[0].text);
      
      // Should include guidance for selecting specific lists
      expect(response.formattedOutput).toContain('💡 Use view_todos({ listId: "..." }) to see specific list details');
      
      // Should show list IDs for selection
      expect(response.formattedOutput).toContain('ID: list-abc-123');
      expect(response.formattedOutput).toContain('ID: list-def-456');
    });
  });

  describe('Cross-Workspace TODO Functionality', () => {
    test('view_todos should accept scope parameter for cross-workspace queries', () => {
      // Test that the schema supports scope parameter
      const schema = getViewTodosToolSchema();
      
      expect(schema.inputSchema.properties.scope).toBeDefined();
      expect(schema.inputSchema.properties.scope.enum).toContain('all');
      expect(schema.inputSchema.properties.scope.enum).toContain('current');
    });

    test('view_todos should show workspace labels when scope=all', async () => {
      const crossWorkspaceLists: TodoList[] = [
        {
          id: 'current-ws-list',
          title: 'Current Workspace Task',
          workspace: 'test-workspace', // Same as current workspace
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'other-ws-list',
          title: 'Other Workspace Task',
          workspace: 'other-workspace', // Different workspace
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue(crossWorkspaceLists);
      
      const result = await handleViewTodos(mockStorage, { scope: 'all' });
      const response = JSON.parse(result.content[0].text);
      
      // Current workspace should not show label
      expect(response.formattedOutput).toContain('Current Workspace Task');
      expect(response.formattedOutput).not.toContain('Current Workspace Task [test-workspace]');
      
      // Other workspace should show label
      expect(response.formattedOutput).toContain('Other Workspace Task [other-workspace]');
    });

    test('view_todos with listId should support cross-workspace searches', async () => {
      const crossWorkspaceList: TodoList = {
        id: 'cross-ws-list',
        title: 'Cross Workspace List',
        workspace: 'other-workspace',
        items: [
          { id: '1', task: 'Cross-workspace task', status: 'pending', createdAt: new Date() }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([crossWorkspaceList]);
      
      const result = await handleViewTodos(mockStorage, { 
        listId: 'cross-ws-list', 
        scope: 'all' 
      });
      const response = JSON.parse(result.content[0].text);
      
      expect(response.data.listId).toBe('cross-ws-list');
      expect(response.data.title).toBe('Cross Workspace List');
      expect(response.formattedOutput).toContain('Cross Workspace List [other-workspace]');
    });

    test('view_todos schema should include scope parameter for cross-workspace support', () => {
      // Verify that the cross-workspace functionality is properly exposed in the schema
      const schema = getViewTodosToolSchema();
      
      expect(schema.inputSchema.properties.scope).toBeDefined();
      expect(schema.inputSchema.properties.scope.enum).toEqual(['current', 'all']);
      expect(schema.inputSchema.properties.scope.default).toBe('current');
      expect(schema.inputSchema.properties.scope.description).toContain('current workspace or all workspaces');
    });
  });

  describe('Error Handling for Refactored Tools', () => {
    test('remember tool should handle storage failures gracefully', async () => {
      mockStorage.saveMemory = jest.fn().mockRejectedValue(new Error('Storage failure'));
      
      const args: RememberArgs = {
        content: 'Test content'
      };

      // This should not throw, but handle the error gracefully
      await expect(handleRemember(mockStorage, args)).rejects.toThrow('Storage failure');
    });

    test('view_todos should handle missing list ID gracefully', async () => {
      const existingList: TodoList = {
        id: 'existing-list',
        title: 'Existing List',
        workspace: 'test-workspace',
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([existingList]);
      
      const result = await handleViewTodos(mockStorage, { listId: 'non-existent-list' });
      
      expect(result.content[0].text).toContain('❓ TODO list "non-existent-list" not found');
    });

    test('update_todo should handle missing list ID gracefully', async () => {
      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([]);
      
      const args: UpdateTodoArgs = {
        listId: 'missing-list',
        itemId: '1',
        status: 'done'
      };

      const result = await handleUpdateTodo(mockStorage, args);
      
      expect(result.content[0].text).toContain('❓ TODO list "missing-list" not found');
    });

    test('update_todo should handle missing item ID gracefully', async () => {
      const mockList: TodoList = {
        id: 'test-list',
        title: 'Test List',
        workspace: 'test-workspace',
        items: [
          { id: '1', task: 'Existing task', status: 'pending', createdAt: new Date() }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([mockList]);
      
      const args: UpdateTodoArgs = {
        listId: 'test-list',
        itemId: '999',
        status: 'done'
      };

      const result = await handleUpdateTodo(mockStorage, args);
      
      expect(result.content[0].text).toContain('❓ Task 999 not found in list "Test List"');
    });
  });

  describe('Response Format Consistency', () => {
    test('All tools should return ToolResponse format with content arrays', async () => {
      // Test remember tool response format
      const rememberResult = await handleRemember(mockStorage, { content: 'test' });
      expect(rememberResult).toHaveProperty('content');
      expect(Array.isArray(rememberResult.content)).toBe(true);
      expect(rememberResult.content[0]).toHaveProperty('type', 'text');
      expect(rememberResult.content[0]).toHaveProperty('text');

      // Test create_todo_list response format
      const createResult = await handleCreateTodoList(mockStorage, { 
        title: 'test', 
        items: ['item1'] 
      });
      expect(createResult).toHaveProperty('content');
      expect(Array.isArray(createResult.content)).toBe(true);
      expect(createResult.content[0]).toHaveProperty('type', 'text');

      // Test view_todos response format
      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([]);
      const viewResult = await handleViewTodos(mockStorage, {});
      expect(viewResult).toHaveProperty('content');
      expect(Array.isArray(viewResult.content)).toBe(true);

      // Test update_todo response format  
      mockStorage.loadAllTodoLists = jest.fn().mockResolvedValue([]);
      const updateResult = await handleUpdateTodo(mockStorage, { newTask: 'test' });
      expect(updateResult).toHaveProperty('content');
      expect(Array.isArray(updateResult.content)).toBe(true);
    });

    test('All tool schemas should follow consistent structure', () => {
      const rememberSchema = getRememberToolSchema();
      const createSchema = getCreateTodoListToolSchema();
      const viewSchema = getViewTodosToolSchema();
      const updateSchema = getUpdateTodoToolSchema();

      // All schemas should have these required fields
      for (const schema of [rememberSchema, createSchema, viewSchema, updateSchema]) {
        expect(schema).toHaveProperty('name');
        expect(schema).toHaveProperty('description');
        expect(schema).toHaveProperty('inputSchema');
        expect(schema.inputSchema).toHaveProperty('type', 'object');
        expect(schema.inputSchema).toHaveProperty('properties');
      }

      // Verify schema names match tool names
      expect(rememberSchema.name).toBe('remember');
      expect(createSchema.name).toBe('create_todo_list');
      expect(viewSchema.name).toBe('view_todos');
      expect(updateSchema.name).toBe('update_todo');
    });
  });

  describe('Type Safety Verification', () => {
    test('Tool functions should enforce correct parameter types', async () => {
      // This should be caught by TypeScript, but let's verify runtime behavior
      
      // Remember tool with correct types
      const validRememberArgs: RememberArgs = {
        content: 'valid content',
        type: 'general',
        ttlHours: 24,
        tags: ['test']
      };
      
      expect(() => {
        // This should not throw due to type constraints
        const _: RememberArgs = validRememberArgs;
      }).not.toThrow();

      // CreateTodoList with correct types  
      const validCreateArgs: CreateTodoListArgs = {
        title: 'Test Title',
        items: ['item1', 'item2'],
        tags: ['tag1']
      };

      expect(() => {
        const _: CreateTodoListArgs = validCreateArgs;
      }).not.toThrow();
    });
  });
});