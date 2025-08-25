/**
 * Remember Tool for Goldfish MCP
 * 
 * Stores simple notes and thoughts with automatic expiration
 */

import { Storage } from '../core/storage.js';
import { GoldfishMemory, ToolResponse } from '../types/index.js';
import { validateCommonArgs, createErrorResponse, createSuccessResponse } from '../core/workspace-utils.js';

export interface RememberArgs {
  content: string;
  type?: 'general' | 'todo' | 'context';
  ttlHours?: number;
  tags?: string[];
}


/**
 * Handle remember tool - simple note storage
 */
export async function handleRemember(storage: Storage, args: RememberArgs): Promise<ToolResponse> {
  // Validate input
  const validation = validateCommonArgs(args);
  if (!validation.isValid) {
    return createErrorResponse(validation.error!, 'remember');
  }

  if (!args.content || args.content.trim().length === 0) {
    return createErrorResponse('Content is required and cannot be empty', 'remember');
  }

  const { 
    content, 
    type = 'general', 
    ttlHours = 24, 
    tags 
  } = args;

  const memory: GoldfishMemory = {
    id: storage.generateChronologicalFilename().replace('.json', ''),
    timestamp: new Date(),
    workspace: storage.getCurrentWorkspace(),
    type,
    content,
    ttlHours,
    tags,
    metadata: { simple: true }
  };

  await storage.saveMemory(memory);

  return createSuccessResponse(`💭 Remembered: "${content}" (ID: ${memory.id}, expires in ${ttlHours}h)`);
}

/**
 * Get tool schema for remember tool
 */
export function getRememberToolSchema() {
  return {
    name: 'remember',
    description: 'Store a quick thought or note in current session. For detailed checkpoints use checkpoint tool instead.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The thought or note to remember'
        },
        type: {
          type: 'string',
          enum: ['general', 'todo', 'context'],
          description: 'Type of memory (default: general)',
          default: 'general'
        },
        ttlHours: {
          type: 'number',
          description: 'Hours to keep this memory (default: 24)',
          default: 24
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for categorization'
        }
      },
      required: ['content']
    }
  };
}