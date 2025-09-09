/**
 * Tests for "latest" keyword support in TODO tools
 * Verifies that AI agents can use intuitive keywords instead of exact IDs
 */

import { Storage } from '../core/storage.js';
import { resolveSpecialTodoListId } from '../core/workspace-utils.js';
import { handleUpdateTodo } from '../tools/update-todo.js';
import { handleViewTodos } from '../tools/view-todos.js';
import { handleCreateTodoList } from '../tools/create-todo-list.js';
import { TodoList } from '../types/index.js';
import * as path from 'path';
import * as os from 'os';

describe('TODO Latest Keyword Support', () => {
  let storage: Storage;
  let testWorkspace: string;
  let testBasePath: string;

  beforeEach(() => {
    // Use unique workspace for each test to avoid conflicts
    const timestamp = Date.now();
    testWorkspace = `test-latest-${timestamp}`;
    testBasePath = path.join(os.tmpdir(), `goldfish-test-latest-${timestamp}`);
    storage = new Storage(testWorkspace, testBasePath);
  });

  afterEach(async () => {
    // Tests use unique workspaces, so cleanup is automatic
  });

  describe('resolveSpecialTodoListId', () => {
    it('should resolve "latest" to most recently updated list', async () => {
      // Create multiple TODO lists with different update times
      const list1: TodoList = {
        id: 'list-1',
        title: 'First List',
        items: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        workspace: testWorkspace
      };
      
      const list2: TodoList = {
        id: 'list-2',
        title: 'Second List',
        items: [],
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-03'), // Most recent
        workspace: testWorkspace
      };
      
      const list3: TodoList = {
        id: 'list-3',
        title: 'Third List',
        items: [],
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        workspace: testWorkspace
      };

      const todoLists = [list1, list2, list3];
      
      // Test "latest" keyword
      const result = resolveSpecialTodoListId('latest', todoLists);
      expect(result?.id).toBe('list-2');
      
      // Test "recent" keyword
      const recentResult = resolveSpecialTodoListId('recent', todoLists);
      expect(recentResult?.id).toBe('list-2');
      
      // Test "last" keyword
      const lastResult = resolveSpecialTodoListId('last', todoLists);
      expect(lastResult?.id).toBe('list-2');
    });

    it('should resolve "active" to most recent list with pending tasks', async () => {
      const list1: TodoList = {
        id: 'list-1',
        title: 'Completed List',
        items: [
          { id: '1', task: 'Done task', status: 'done', createdAt: new Date() }
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-03'), // Most recent but all done
        workspace: testWorkspace
      };
      
      const list2: TodoList = {
        id: 'list-2',
        title: 'Active List',
        items: [
          { id: '1', task: 'Pending task', status: 'pending', createdAt: new Date() }
        ],
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'), // Has pending tasks
        workspace: testWorkspace
      };

      const todoLists = [list1, list2];
      
      // Test "active" keyword
      const result = resolveSpecialTodoListId('active', todoLists);
      expect(result?.id).toBe('list-2');
      
      // Test "current" keyword
      const currentResult = resolveSpecialTodoListId('current', todoLists);
      expect(currentResult?.id).toBe('list-2');
    });

    it('should return undefined when no lists match criteria', () => {
      const emptyLists: TodoList[] = [];
      
      expect(resolveSpecialTodoListId('latest', emptyLists)).toBeUndefined();
      expect(resolveSpecialTodoListId('active', emptyLists)).toBeUndefined();
    });

    it('should handle exact ID matches', () => {
      const list: TodoList = {
        id: 'exact-id-123',
        title: 'Test List',
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: testWorkspace
      };

      const todoLists = [list];
      
      // Should find by exact ID
      const result = resolveSpecialTodoListId('exact-id-123', todoLists);
      expect(result?.id).toBe('exact-id-123');
      
      // Should find by partial ID match (suffix)
      const partialResult = resolveSpecialTodoListId('123', todoLists);
      expect(partialResult?.id).toBe('exact-id-123');
    });
  });

  describe('Integration with update-todo', () => {
    it('should update task in "latest" TODO list', async () => {
      // Create a TODO list
      await handleCreateTodoList(storage, {
        title: 'Test List',
        items: ['Task 1', 'Task 2']
      });

      // Update using "latest" keyword
      const updateResult = await handleUpdateTodo(storage, {
        listId: 'latest',
        itemId: '1',
        status: 'done'
      });

      // Verify update succeeded
      expect(updateResult.content[0].text).toContain('Updated');
      
      // Verify the task was actually updated
      const todoLists = await storage.loadAllTodoLists();
      const latestList = todoLists[0];
      expect(latestList.items[0].status).toBe('done');
    });

    it('should provide helpful error when no "latest" list exists', async () => {
      // Try to update when no lists exist
      const result = await handleUpdateTodo(storage, {
        listId: 'latest',
        itemId: '1',
        status: 'done'
      });

      expect(result.content[0].text).toContain('No latest TODO list found');
    });
  });

  describe('Integration with view-todos', () => {
    it('should view "latest" TODO list', async () => {
      // Create multiple TODO lists
      await handleCreateTodoList(storage, {
        title: 'Old List',
        items: ['Old Task']
      });
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await handleCreateTodoList(storage, {
        title: 'Latest List',
        items: ['New Task 1', 'New Task 2']
      });

      // View using "latest" keyword
      const viewResult = await handleViewTodos(storage, {
        listId: 'latest'
      });

      // Parse the response
      const responseText = viewResult.content[0].text;
      const response = JSON.parse(responseText);
      
      // Verify we got the latest list
      expect(response.data.title).toBe('Latest List');
      expect(response.data.totalTasks).toBe(2);
    });

    it('should view "active" TODO list', async () => {
      // Create a completed list
      const completedList = await handleCreateTodoList(storage, {
        title: 'Completed List',
        items: ['Done Task']
      });
      
      // Mark all tasks as done
      await handleUpdateTodo(storage, {
        listId: completedList.content[0].text.match(/ID: ([^\s]+)/)?.[1],
        markAllComplete: true
      });
      
      // Create an active list
      await handleCreateTodoList(storage, {
        title: 'Active List',
        items: ['Pending Task']
      });

      // View using "active" keyword
      const viewResult = await handleViewTodos(storage, {
        listId: 'active'
      });

      const responseText = viewResult.content[0].text;
      const response = JSON.parse(responseText);
      
      // Should get the active list, not the completed one
      expect(response.data.title).toBe('Active List');
    });
  });
});