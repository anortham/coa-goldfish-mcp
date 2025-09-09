/**
 * Unified TODO Tool for Goldfish MCP
 * 
 * Consolidates create-todo-list, update-todo, and view-todos into one smart tool
 * Actions: create, update, view, complete, quick
 */

import { Storage } from '../core/storage.js';
import { TodoList, TodoItem, ToolResponse } from '../types/index.js';

// Import existing handlers to maintain functionality
import { handleCreateTodoList, CreateTodoListArgs } from './create-todo-list.js';
import { handleUpdateTodo, UpdateTodoArgs } from './update-todo.js';
import { handleViewTodos, ViewTodosArgs } from './view-todos.js';

export interface TodoArgs {
  action?: 'create' | 'update' | 'view' | 'complete' | 'quick';
  
  // For create action (matches CreateTodoListArgs)
  title?: string;
  items?: string[];
  tags?: string[];
  description?: string;
  metadata?: Record<string, any>;
  status?: 'active' | 'completed' | 'archived';
  ttlHours?: number;
  
  // For update action (matches UpdateTodoArgs)
  listId?: string;
  itemId?: string;
  newTask?: string;
  priority?: 'low' | 'normal' | 'high';
  delete?: boolean;
  markAllComplete?: boolean;
  cleanupOldLists?: boolean;
  
  // For view action (matches ViewTodosArgs)
  showCompleted?: boolean;
  scope?: 'current' | 'all';
  summary?: boolean;
  
  // For complete action
  reason?: string;
  
  // For quick action (replaces /todo slash commands)
  quick?: string;  // Examples: "add buy milk", "done 3", "list", "active 2"
  
  // Common options
  workspace?: string;
  format?: import('../core/output-utils.js').OutputMode;
}

/**
 * Smart action inference - determines action from arguments if not explicitly provided
 */
function inferAction(args: TodoArgs): 'create' | 'update' | 'view' | 'complete' | 'quick' {
  // If quick is provided, it's a quick action
  if (args.quick) {
    return 'quick';
  }
  
  // If we have title and items, it's a create
  if (args.title && args.items && args.items.length > 0) {
    return 'create';
  }
  
  // If we have listId with markAllComplete, it's a complete action
  if (args.listId && args.markAllComplete) {
    return 'complete';
  }
  
  // If we have listId and some update parameters, it's an update
  if (args.listId && (args.itemId || args.newTask || args.status || args.delete || args.cleanupOldLists)) {
    return 'update';
  }
  
  // Default to view if no clear action indicators
  return 'view';
}

/**
 * Handle quick actions - parse natural language commands
 */
async function handleQuickAction(storage: Storage, args: TodoArgs): Promise<ToolResponse> {
  const quickCommand = args.quick?.trim().toLowerCase();
  
  if (!quickCommand) {
    return {
      content: [
        {
          type: 'text',
          text: '⚡ Please provide a quick command. Examples: "add implement login", "done 3" to complete item 3, or "list" to view all tasks.'
        }
      ]
    };
  }
  
  // Parse quick commands
  if (quickCommand.startsWith('add ')) {
    // Extract task from "add task name"
    const taskName = args.quick!.substring(4).trim();
    if (!taskName) {
      return {
        content: [
          {
            type: 'text',
            text: '📝 Please specify a task to add. Example: "add implement authentication" or "add write unit tests"'
          }
        ]
      };
    }
    
    // Create a quick TODO list with one item, or add to latest list
    const existingLists = await storage.loadAllTodoLists();
    const latestList = existingLists.find(list => 
      list.items.some(item => item.status !== 'done') && 
      list.status !== 'completed'
    );
    
    if (latestList) {
      // Add to existing active list
      return handleUpdateTodo(storage, {
        listId: latestList.id,
        newTask: taskName,
        format: args.format
      });
    } else {
      // Create new quick list
      return handleCreateTodoList(storage, {
        title: `Quick Tasks - ${new Date().toLocaleDateString()}`,
        items: [taskName],
        format: args.format
      });
    }
  }
  
  if (quickCommand.startsWith('done ') || quickCommand.startsWith('complete ')) {
    // Extract item ID from "done 3" or "complete 3"
    const prefix = quickCommand.startsWith('done ') ? 'done ' : 'complete ';
    const itemIdStr = quickCommand.substring(prefix.length).trim();
    const itemId = parseInt(itemIdStr);
    
    if (isNaN(itemId)) {
      return {
        content: [
          {
            type: 'text',
            text: `❓ Please specify a valid item ID. Example: "done 3"`
          }
        ]
      };
    }
    
    // Find the list containing this item ID and mark it done
    const todoLists = await storage.loadAllTodoLists();
    for (const list of todoLists) {
      const item = list.items.find(item => parseInt(item.id) === itemId);
      if (item) {
        return handleUpdateTodo(storage, {
          listId: list.id,
          itemId: item.id,
          status: 'done',
          format: args.format
        });
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `❓ Item ${itemId} not found in any TODO list`
        }
      ]
    };
  }
  
  if (quickCommand === 'list' || quickCommand === 'show') {
    // Show current todos
    return handleViewTodos(storage, {
      summary: true,
      format: args.format
    });
  }
  
  if (quickCommand.startsWith('active ')) {
    // Set item as active: "active 2"
    const itemIdStr = quickCommand.substring(7).trim();
    const itemId = parseInt(itemIdStr);
    
    if (isNaN(itemId)) {
      return {
        content: [
          {
            type: 'text',
            text: `❓ Please specify a valid item ID. Example: "active 2"`
          }
        ]
      };
    }
    
    // Find and mark as active
    const todoLists = await storage.loadAllTodoLists();
    for (const list of todoLists) {
      const item = list.items.find(item => parseInt(item.id) === itemId);
      if (item) {
        return handleUpdateTodo(storage, {
          listId: list.id,
          itemId: item.id,
          status: 'active',
          format: args.format
        });
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `❓ Item ${itemId} not found in any TODO list`
        }
      ]
    };
  }
  
  // Unrecognized command
  return {
    content: [
      {
        type: 'text',
        text: `❓ Unrecognized quick command: "${quickCommand}"\n\nSupported commands:\n• "add [task]" - Add new task\n• "done [id]" - Mark task complete\n• "active [id]" - Mark task active\n• "list" - Show current todos`
      }
    ]
  };
}

/**
 * Handle complete action - mark entire list as completed
 */
async function handleCompleteAction(storage: Storage, args: TodoArgs): Promise<ToolResponse> {
  if (!args.listId) {
    return {
      content: [
        {
          type: 'text',
          text: '❓ Please specify a listId to complete'
        }
      ]
    };
  }
  
  // Use the markAllComplete functionality from update-todo
  return handleUpdateTodo(storage, {
    listId: args.listId,
    markAllComplete: true,
    format: args.format
  });
}

/**
 * Main unified TODO tool handler
 */
export async function handleTodo(storage: Storage, args: TodoArgs): Promise<ToolResponse> {
  try {
    // Determine action - use provided action or infer from arguments
    const action = args.action || inferAction(args);
    
    // Route to appropriate handler based on action
    switch (action) {
      case 'create':
        // Map TodoArgs to CreateTodoListArgs
        const createArgs: CreateTodoListArgs = {
          title: args.title!,
          items: args.items!,
          tags: args.tags,
          description: args.description,
          metadata: args.metadata,
          status: args.status,
          ttlHours: args.ttlHours,
          workspace: args.workspace,
          format: args.format
        };
        return handleCreateTodoList(storage, createArgs);
        
      case 'update':
        // Map TodoArgs to UpdateTodoArgs
        const updateArgs: UpdateTodoArgs = {
          listId: args.listId,
          itemId: args.itemId,
          status: args.status as 'pending' | 'active' | 'done',
          newTask: args.newTask,
          priority: args.priority,
          delete: args.delete,
          workspace: args.workspace,
          markAllComplete: args.markAllComplete,
          cleanupOldLists: args.cleanupOldLists,
          format: args.format
        };
        return handleUpdateTodo(storage, updateArgs);
        
      case 'view':
        // Map TodoArgs to ViewTodosArgs
        const viewArgs: ViewTodosArgs = {
          listId: args.listId,
          showCompleted: args.showCompleted,
          scope: args.scope,
          summary: args.summary,
          format: args.format
        };
        return handleViewTodos(storage, viewArgs);
        
      case 'complete':
        return handleCompleteAction(storage, args);
        
      case 'quick':
        return handleQuickAction(storage, args);
        
      default:
        return {
          content: [
            {
              type: 'text',
              text: `❓ Unknown action: ${action}. Supported actions: create, update, view, complete, quick`
            }
          ]
        };
    }
    
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error in todo tool: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
}

/**
 * Get tool schema for unified todo tool
 */
export function getTodoToolSchema() {
  return {
    name: 'todo',
    description: 'Manage tasks efficiently. Create lists, track progress, mark complete. Use keywords "latest" and "active" to reference lists quickly.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'view', 'complete', 'quick'],
          description: 'Action to perform. Defaults to "view" to show current tasks. Use "update" to modify existing lists.'
        },
        
        // Create action properties
        title: {
          type: 'string',
          description: 'Title for new TODO list (required for create action)'
        },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of task items (required for create action)'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for categorization'
        },
        description: {
          type: 'string',
          description: 'Optional description or context for the list'
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata for flexible data storage'
        },
        
        // Update action properties
        listId: {
          type: 'string',
          description: 'TODO list ID (supports "latest", "active", partial matches)'
        },
        itemId: {
          type: 'string',
          description: 'Specific item ID within the list'
        },
        newTask: {
          type: 'string',
          description: 'New task to add to the list'
        },
        status: {
          type: 'string',
          enum: ['pending', 'active', 'done'],
          description: 'Status to set for the item'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
          description: 'Priority level for the item'
        },
        delete: {
          type: 'boolean',
          description: 'Delete the specified item'
        },
        markAllComplete: {
          type: 'boolean',
          description: 'Mark all tasks in the list as complete'
        },
        cleanupOldLists: {
          type: 'boolean',
          description: 'Auto-complete old lists with all tasks marked as done'
        },
        
        // View action properties
        showCompleted: {
          type: 'boolean',
          description: 'Include completed items in view (default: true)',
          default: true
        },
        scope: {
          type: 'string',
          enum: ['current', 'all'],
          description: 'View scope: current workspace or all workspaces',
          default: 'current'
        },
        summary: {
          type: 'boolean',
          description: 'Show compact summary view',
          default: false
        },
        
        // Complete action properties
        reason: {
          type: 'string',
          description: 'Reason for completing the list'
        },
        
        // Quick action properties
        quick: {
          type: 'string',
          description: 'Quick command: "add [task]", "done [id]", "active [id]", "list"'
        },
        
        // Common properties
        workspace: {
          type: 'string',
          description: 'Target workspace (path or name)'
        },
        ttlHours: {
          type: 'number',
          description: 'Time-to-live in hours for automatic expiration'
        },
        format: {
          type: 'string',
          enum: ['plain', 'emoji', 'json', 'dual'],
          description: 'Output format override'
        }
      }
    }
  };
}