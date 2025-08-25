/**
 * Create TODO List Tool for Goldfish MCP
 * 
 * Creates new TODO lists for tracking tasks and projects
 */

import { Storage } from '../core/storage.js';
import { TodoList, ToolResponse } from '../types/index.js';
import { validateCommonArgs, createErrorResponse, createSuccessResponse } from '../core/workspace-utils.js';

export interface CreateTodoListArgs {
  title: string;
  items: string[];
  tags?: string[];
}


/**
 * Handle create TODO list
 */
export async function handleCreateTodoList(storage: Storage, args: CreateTodoListArgs): Promise<ToolResponse> {
  // Validate input
  const validation = validateCommonArgs(args);
  if (!validation.isValid) {
    return createErrorResponse(validation.error!, 'create_todo_list');
  }

  if (!args.title || args.title.trim().length === 0) {
    return createErrorResponse('Title is required and cannot be empty', 'create_todo_list');
  }

  if (!args.items || !Array.isArray(args.items) || args.items.length === 0) {
    return createErrorResponse('Items array is required and must contain at least one item', 'create_todo_list');
  }

  const { title, items, tags } = args;
  
  const todoList: TodoList = {
    id: storage.generateChronologicalFilename().replace('.json', ''),
    title,
    workspace: storage.getCurrentWorkspace(),
    items: items.map((task: string, index: number) => ({
      id: `${index + 1}`,
      task,
      status: 'pending' as const,
      createdAt: new Date()
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
    tags
  };

  await storage.saveTodoList(todoList);

  return createSuccessResponse(`📝 Created TODO list "${title}" with ${items.length} items (ID: ${todoList.id})`);
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
        }
      },
      required: ['title', 'items']
    }
  };
}