/**
 * Create TODO List Tool for Goldfish MCP
 * 
 * Creates new TODO lists for tracking tasks and projects
 */

import { Storage } from '../core/storage.js';
import { TodoList, ToolResponse } from '../types/index.js';
import { validateCommonArgs, createErrorResponse, createSuccessResponse, normalizeWorkspaceName } from '../core/workspace-utils.js';

export interface CreateTodoListArgs {
  title: string;
  items: string[];
  tags?: string[];
  description?: string;          // NEW - For context/handoff data
  metadata?: Record<string, any>; // NEW - Flexible data storage
  status?: 'active' | 'completed' | 'archived';  // NEW - Lifecycle status
  ttlHours?: number;             // NEW - Optional expiration
  workspace?: string;            // NEW - Optional workspace (path or name)
  format?: import('../core/output-utils.js').OutputMode;
}


/**
 * Handle create TODO list
 */
export async function handleCreateTodoList(storage: Storage, args: CreateTodoListArgs): Promise<ToolResponse> {
  // Validate input
  const validation = validateCommonArgs(args);
  if (!validation.isValid) {
    return createErrorResponse(validation.error!, 'create_todo_list', args.format);
  }

  if (!args.title || args.title.trim().length === 0) {
    return createErrorResponse('Title is required and cannot be empty', 'create_todo_list', args.format);
  }

  if (!args.items || !Array.isArray(args.items) || args.items.length === 0) {
    return createErrorResponse('Items array is required and must contain at least one item', 'create_todo_list', args.format);
  }

  const { title, items, tags, description, metadata, status, ttlHours, workspace } = args;
  
  // Determine target workspace - normalize if provided, otherwise use current
  const targetWorkspace = workspace ? normalizeWorkspaceName(workspace) : storage.getCurrentWorkspace();
  
  const todoList: TodoList = {
    id: storage.generateChronologicalFilename().replace('.json', ''),
    title,
    description,              // NEW - Optional description
    metadata,                 // NEW - Optional metadata
    workspace: targetWorkspace,
    items: items.map((task: string, index: number) => ({
      id: `${index + 1}`,
      task,
      status: 'pending' as const,
      createdAt: new Date()
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
    status: status || 'active', // NEW - Default to 'active'
    ttlHours,                 // NEW - Optional TTL
    tags
  };

  await storage.saveTodoList(todoList);

  return createSuccessResponse(
    `📝 Created TODO list "${title}" with ${items.length} items (ID: ${todoList.id})`,
    'create-todo-list',
    { id: todoList.id, title, items: todoList.items.length, workspace: targetWorkspace },
    args.format || 'emoji'
  );
}

/**
 * Get tool schema for create_todo_list tool
 */
export function getCreateTodoListToolSchema() {
  return {
    name: 'create_todo_list',
    description: 'Create TODO list tied to current session. Use when user mentions multiple tasks or planning work.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title for the TODO list'
        },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of task items to add'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for categorization'
        },
        description: {
          type: 'string',
          description: 'Optional description providing context for the TODO list'
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata for flexible data storage (e.g., agent handoff data)'
        },
        status: {
          type: 'string',
          enum: ['active', 'completed', 'archived'],
          description: 'Lifecycle status (defaults to active)'
        },
        ttlHours: {
          type: 'number',
          description: 'Time-to-live in hours for automatic expiration'
        },
        workspace: {
          type: 'string',
          description: 'Workspace name or path (e.g., "coa-goldfish-mcp" or "C:\\source\\COA Goldfish MCP"). Will be normalized automatically. Defaults to current workspace.'
        },
        format: {
          type: 'string',
          enum: ['plain', 'emoji', 'json', 'dual'],
          description: 'Output format override (defaults to env GOLDFISH_OUTPUT_MODE or dual)'
        }
      },
      required: ['title', 'items']
    }
  };
}
