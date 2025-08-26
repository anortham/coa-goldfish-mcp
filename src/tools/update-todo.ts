/**
 * Update TODO Tool for Goldfish MCP
 * 
 * Updates TODO list items - change status, edit tasks, add new items, delete items
 */

import { Storage } from '../core/storage.js';
import { TodoList, TodoItem, ToolResponse } from '../types/index.js';
import { validateCommonArgs, createErrorResponse, createSuccessResponse, getTaskStatusIcon, truncateText } from '../core/workspace-utils.js';

export interface UpdateTodoArgs {
  listId?: string;
  itemId?: string;
  status?: 'pending' | 'active' | 'done';
  newTask?: string;
  priority?: 'low' | 'normal' | 'high';
  delete?: boolean;
}


/**
 * Handle update TODO - modify existing tasks or add new ones
 */
export async function handleUpdateTodo(storage: Storage, args: UpdateTodoArgs): Promise<ToolResponse> {
  // Validate input
  const validation = validateCommonArgs(args);
  if (!validation.isValid) {
    return createErrorResponse(validation.error!, 'update_todo');
  }

  const { listId, itemId, status, newTask, priority, delete: deleteItem } = args;

  const todoLists = await storage.loadAllTodoLists();
  
  let todoList: TodoList | undefined;
  
  if (listId) {
    // Find by explicit list ID
    todoList = todoLists.find(list => list.id === listId || list.id.endsWith(listId));
    
    if (!todoList) {
      return createErrorResponse(`❓ TODO list "${listId}" not found`);
    }
  } else {
    // No listId provided - use most recently updated list
    todoList = todoLists.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
    
    if (!todoList) {
      return createErrorResponse(`❓ No TODO lists found. Create one first with create_todo_list.`);
    }
  }

  if (itemId) {
    // Find the item first
    const item = todoList.items.find((i: TodoItem) => i.id === itemId);
    
    if (!item) {
      return createErrorResponse(`❓ Task ${itemId} not found in list "${todoList.title}"`);
    }

    // Handle delete operation
    if (deleteItem) {
      const taskText = truncateText(item.task, 40);
      todoList.items = todoList.items.filter((i: TodoItem) => i.id !== itemId);
      todoList.updatedAt = new Date();
      await storage.saveTodoList(todoList);

      return createSuccessResponse(`🗑️ Deleted [${itemId}] ${taskText}`);
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

    return createSuccessResponse(message);
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
    await storage.saveTodoList(todoList);

    return createSuccessResponse(`➕ Added "${newTask}" to "${todoList.title}"`);
  }

  return createErrorResponse('❓ Please specify either newTask to add, or itemId + status to update', 'update_todo');
}

/**
 * Get tool schema for update_todo tool
 */
export function getUpdateTodoToolSchema() {
  return {
    name: 'update_todo',
    description: 'Update task status immediately as you complete work. ALWAYS mark tasks done when finished, add new tasks as discovered.',
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
        }
      }
    }
  };
}