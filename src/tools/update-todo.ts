/**
 * Update TODO Tool for Goldfish MCP
 * 
 * Updates TODO list items - change status, edit tasks, add new items, delete items
 */

import { Storage } from '../core/storage.js';
import { TodoList, TodoItem, ToolResponse } from '../types/index.js';
import { validateCommonArgs, createErrorResponse, createSuccessResponse, getTaskStatusIcon, truncateText, normalizeWorkspaceName, loadTodoListsWithScope, resolveSpecialTodoListId } from '../core/workspace-utils.js';

export interface UpdateTodoArgs {
  listId?: string;
  itemId?: string;
  status?: 'pending' | 'active' | 'done';
  newTask?: string;
  priority?: 'low' | 'normal' | 'high';
  delete?: boolean;
  workspace?: string;  // NEW - Optional workspace (path or name)
  markAllComplete?: boolean;  // NEW - Mark all tasks in the list as complete
  cleanupOldLists?: boolean;  // NEW - Auto-complete old lists with all tasks done
  format?: import('../core/output-utils.js').OutputMode;
}


/**
 * Handle update TODO - modify existing tasks or add new ones
 */
export async function handleUpdateTodo(storage: Storage, args: UpdateTodoArgs): Promise<ToolResponse> {
  // Validate input
  const validation = validateCommonArgs(args);
  if (!validation.isValid) {
    return createErrorResponse(validation.error!, 'update_todo', args.format || 'emoji');
  }

  const { listId, itemId, status, newTask, priority, delete: deleteItem, workspace, markAllComplete, cleanupOldLists } = args;

  // Load TODO lists - if workspace specified, search across workspaces, otherwise current only
  const todoLists = workspace ? 
    await loadTodoListsWithScope(storage, 'all') : 
    await storage.loadAllTodoLists();
  
  // Handle cleanup of old/legacy lists
  if (cleanupOldLists) {
    let cleanedCount = 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    for (const list of todoLists) {
      // Auto-complete lists that:
      // 1. Have all items marked as 'done'
      // 2. Don't have explicit status (legacy lists) OR are older than 30 days
      // 3. Are not already marked as completed
      const allItemsDone = list.items.length > 0 && list.items.every(item => item.status === 'done');
      const isOldOrLegacy = !list.status || new Date(list.updatedAt) < thirtyDaysAgo;
      const notAlreadyCompleted = list.status !== 'completed';
      
      if (allItemsDone && isOldOrLegacy && notAlreadyCompleted) {
        list.status = 'completed';
        list.completedAt = new Date();
        list.updatedAt = new Date();
        await storage.saveTodoList(list);
        cleanedCount++;
      }
    }
    
    return createSuccessResponse(
      `🧹 Cleaned up ${cleanedCount} old TODO lists that had all tasks completed`,
      'update-todo',
      { cleanedCount },
      args.format || 'emoji'
    );
  }
  
  // Use the new resolver that handles "latest" and other special keywords
  const todoList = resolveSpecialTodoListId(listId, todoLists);
  
  if (!todoList) {
    if (listId) {
      // Provide helpful error message for special keywords
      const isSpecialKeyword = ['latest', 'recent', 'last', 'active', 'current'].includes(listId.toLowerCase().trim());
      if (isSpecialKeyword) {
        return createErrorResponse(`❓ No ${listId} TODO list found. Create one first with create_todo_list.`, 'update_todo', args.format || 'emoji');
      }
      return createErrorResponse(`❓ TODO list "${listId}" not found`, 'update_todo', args.format || 'emoji');
    } else {
      return createErrorResponse(`❓ No TODO lists found. Create one first with create_todo_list.`, 'update_todo', args.format || 'emoji');
    }
  }

  // Handle markAllComplete operation
  if (markAllComplete) {
    if (!todoList) {
      return createErrorResponse(`❓ No TODO list found to mark complete`, 'update_todo', args.format || 'emoji');
    }

    // Mark all items as done
    const pendingCount = todoList.items.filter((item: TodoItem) => item.status !== 'done').length;
    
    if (pendingCount === 0) {
      return createSuccessResponse(`✅ All tasks in "${todoList.title}" are already complete`, 'update-todo', { listId: todoList.id }, args.format || 'emoji');
    }

    todoList.items.forEach((item: TodoItem) => {
      if (item.status !== 'done') {
        item.status = 'done';
        item.updatedAt = new Date();
      }
    });

    // Mark the list itself as completed
    todoList.status = 'completed';
    todoList.completedAt = new Date();
    todoList.updatedAt = new Date();
    
    await storage.saveTodoList(todoList);

    return createSuccessResponse(
      `🎉 Marked all ${pendingCount} pending task${pendingCount !== 1 ? 's' : ''} as complete in "${todoList.title}"\n` +
      `✅ TodoList "${todoList.title}" marked as completed`,
      'update-todo',
      { listId: todoList.id, pendingCount },
      args.format || 'emoji'
    );
  }

  if (itemId) {
    // Find the item first
    const item = todoList.items.find((i: TodoItem) => i.id === itemId);
    
    if (!item) {
      return createErrorResponse(`❓ Task ${itemId} not found in list "${todoList.title}"`, 'update_todo', args.format || 'emoji');
    }

    // Handle delete operation
    if (deleteItem) {
      const taskText = truncateText(item.task, 40);
      todoList.items = todoList.items.filter((i: TodoItem) => i.id !== itemId);
      todoList.updatedAt = new Date();
      await storage.saveTodoList(todoList);

      return createSuccessResponse(`🗑️ Deleted [${itemId}] ${taskText}`, 'update-todo', { listId: todoList.id, itemId }, args.format || 'emoji');
    }

    const oldStatus = item.status;
    const oldTask = item.task;
    
    // Update task description if provided
    if (newTask) {
      item.task = newTask;
    }
    
    // Update status if provided
    if (status) {
      item.status = status;
    }
    
    item.updatedAt = new Date();
    
    if (priority) {
      item.priority = priority;
    }
    
    todoList.updatedAt = new Date();
    
    // NEW - Auto-completion: Mark TodoList as completed if all items are done
    const allItemsDone = todoList.items.length > 0 && 
                        todoList.items.every(item => item.status === 'done');
    
    if (allItemsDone && (!todoList.status || todoList.status === 'active')) {
      todoList.status = 'completed';
      todoList.completedAt = new Date();
    }
    
    await storage.saveTodoList(todoList);

    const changes = [];
    if (newTask && newTask !== oldTask) changes.push(`task: "${newTask}"`);
    if (status && status !== oldStatus) changes.push(`status: ${status}`);
    if (priority) changes.push(`priority: ${priority}`);
    
    const icon = getTaskStatusIcon(item.status);
    
    let message = `${icon} Updated [${itemId}] ${changes.join(', ')}`;
    
    // NEW - Add completion notification
    if (allItemsDone && todoList.status === 'completed') {
      message += `\n🎉 All tasks completed! TodoList "${todoList.title}" marked as completed.`;
    }

    return createSuccessResponse(message, 'update-todo', { listId: todoList.id, itemId, changes }, args.format || 'emoji');
  }

  if (newTask) {
    // Add new task (only if no itemId provided)
    const newItem: TodoItem = {
      id: (todoList.items.length + 1).toString(),
      task: newTask,
      status: 'pending',
      priority: priority,
      createdAt: new Date()
    };
    
    todoList.items.push(newItem);
    todoList.updatedAt = new Date();
    
    // NEW - Reopen capability: If list was completed, reopen it when adding new tasks
    const wasCompleted = todoList.status === 'completed';
    if (wasCompleted) {
      todoList.status = 'active';
      todoList.completedAt = undefined;
    }
    
    await storage.saveTodoList(todoList);

    let message = `➕ Added "${newTask}" to "${todoList.title}"`;
    if (wasCompleted) {
      message += `\n🔄 Reopened completed list - new work detected`;
    }

    return createSuccessResponse(message, 'update-todo', { listId: todoList.id, itemId: newItem.id, reopened: wasCompleted }, args.format || 'emoji');
  }

  return createErrorResponse('❓ Please specify either newTask to add, or itemId + status to update', 'update_todo', args.format || 'emoji');
}

/**
 * Get tool schema for update_todo tool
 */
export function getUpdateTodoToolSchema() {
  return {
    name: 'update_todo',
    description: 'Update task status immediately as you complete work. ALWAYS mark tasks done when finished, add new tasks as discovered. Use markAllComplete to bulk-complete all tasks in a list.',
    inputSchema: {
      type: 'object',
      properties: {
        listId: {
          type: 'string',
          description: 'TODO list ID'
        },
        itemId: {
          type: 'string',
          description: 'Item ID to update (optional for adding new items)'
        },
        status: {
          type: 'string',
          enum: ['pending', 'active', 'done'],
          description: 'New status for the item'
        },
        newTask: {
          type: 'string',
          description: 'New task to add to the list (when not updating existing item)'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
          description: 'Priority level'
        },
        delete: {
          type: 'boolean',
          description: 'Delete the specified item (requires itemId)'
        },
        workspace: {
          type: 'string',
          description: 'Workspace name or path (e.g., "coa-goldfish-mcp" or "C:\\source\\COA Goldfish MCP"). Will be normalized automatically. If provided, searches across all workspaces.'
        },
        markAllComplete: {
          type: 'boolean',
          description: 'Mark all tasks in the TODO list as complete (requires listId)'
        },
        cleanupOldLists: {
          type: 'boolean',
          description: 'Auto-complete old TODO lists that have all tasks marked as done (works across all workspaces)'
        },
        format: {
          type: 'string',
          enum: ['plain', 'emoji', 'json', 'dual'],
          description: 'Output format override (defaults to env GOLDFISH_OUTPUT_MODE or dual)'
        }
      }
    }
  };
}
