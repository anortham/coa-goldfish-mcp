/**
 * Workspace utility functions for cross-workspace operations
 * 
 * Provides common patterns for loading data from multiple workspaces
 * to eliminate code duplication across tool files
 */

import { Storage } from './storage.js';
import { TodoList } from '../types/index.js';
import { buildToolContent, OutputMode } from './output-utils.js';

/**
 * Load TODO lists from either current workspace or all workspaces
 */
export async function loadTodoListsWithScope(
  storage: Storage, 
  scope: 'current' | 'all' = 'current'
): Promise<TodoList[]> {
  if (scope === 'current') {
    return await storage.loadAllTodoLists();
  }

  // Load from all workspaces
  try {
    // Use the storage's discoverWorkspaces method for proper workspace detection
    const workspaces = await storage.discoverWorkspaces();
    
    let allTodoLists: TodoList[] = [];
    
    for (const workspace of workspaces) {
      try {
        const workspaceTodos = await storage.loadAllTodoLists(workspace);
        allTodoLists.push(...workspaceTodos);
      } catch {
        // Skip workspaces that can't be read
      }
    }
    
    return allTodoLists;
  } catch {
    // Fallback to current workspace only
    return await storage.loadAllTodoLists();
  }
}

/**
 * Get workspace label for display purposes
 */
export function formatWorkspaceLabel(
  targetWorkspace: string, 
  currentWorkspace: string, 
  scope: 'current' | 'all'
): string {
  return scope === 'all' && targetWorkspace !== currentWorkspace 
    ? ` [${targetWorkspace}]` 
    : '';
}

/**
 * Validate and sanitize input parameters common across tools
 */
export function validateCommonArgs(args: any): { isValid: boolean; error?: string } {
  if (!args || typeof args !== 'object') {
    return { isValid: false, error: 'Arguments must be an object' };
  }
  return { isValid: true };
}

/**
 * Validate time range parameter with helpful error messages
 */
export function validateTimeRange(range?: string): { isValid: boolean; error?: string; normalized?: string } {
  if (!range) return { isValid: true }; // Optional parameter
  
  const validRanges = [
    '1h', '1 hour', '24h', '1d', '1 day', '7d', '1w', '1 week', 
    '30d', '1m', '1 month', 'yesterday', 'today', 'this week', 'last week'
  ];
  
  const normalizedRange = range.toLowerCase().trim();
  
  if (validRanges.includes(normalizedRange)) {
    return { isValid: true, normalized: normalizedRange };
  }
  
  // Check if it's a date string (basic validation)
  if (/^\d{4}-\d{2}-\d{2}$/.test(range)) {
    return { isValid: true, normalized: range };
  }
  
  return { 
    isValid: false, 
    error: `⏰ Invalid time range "${range}". Valid options: "1h", "24h", "7d", "1w", "30d", "yesterday", "2025-01-15", etc.`
  };
}

/**
 * Validate action parameter with suggestions
 */
export function validateAction(action: string, validActions: string[], toolName: string): { isValid: boolean; error?: string } {
  if (!validActions.includes(action)) {
    const suggestions = validActions.slice(0, 3).join('", "');
    return { 
      isValid: false, 
      error: `❓ Invalid action "${action}" for ${toolName}. Valid options: "${suggestions}"${validActions.length > 3 ? '...' : ''}`
    };
  }
  return { isValid: true };
}

/**
 * Validate string parameters with length and content checks
 */
export function validateStringParam(value: any, paramName: string, options: {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  examples?: string[];
} = {}): { isValid: boolean; error?: string; value?: string } {
  const { required = false, minLength = 0, maxLength = 500, examples = [] } = options;
  
  if (!value && required) {
    const exampleText = examples.length > 0 ? ` Examples: ${examples.slice(0, 2).join(', ')}` : '';
    return { 
      isValid: false, 
      error: `📝 ${paramName} is required.${exampleText}`
    };
  }
  
  if (!value) return { isValid: true }; // Optional parameter
  
  if (typeof value !== 'string') {
    return { 
      isValid: false, 
      error: `❓ ${paramName} must be a string, got ${typeof value}`
    };
  }
  
  const trimmedValue = value.trim();
  
  if (trimmedValue.length < minLength) {
    const exampleText = examples.length > 0 ? ` Examples: ${examples.slice(0, 2).join(', ')}` : '';
    return { 
      isValid: false, 
      error: `📏 ${paramName} must be at least ${minLength} characters long.${exampleText}`
    };
  }
  
  if (trimmedValue.length > maxLength) {
    return { 
      isValid: false, 
      error: `📏 ${paramName} must be no more than ${maxLength} characters long. Current length: ${trimmedValue.length}`
    };
  }
  
  return { isValid: true, value: trimmedValue };
}

/**
 * Create consistent error response
 */
export function createErrorResponse(message: string, context?: string, format?: OutputMode, data?: any): any {
  const fullMessage = context ? `${context}: ${message}` : message;
  const op = context || 'error';
  const result = buildToolContent(op, fullMessage, data, format);
  result.isError = true;
  return result;
}

/**
 * Create consistent success response
 */
export function createSuccessResponse(message: string, operation = 'success', data?: any, format?: OutputMode): any {
  const result = buildToolContent(operation, message, data, format);
  result.isError = false;
  return result;
}

/**
 * Create structured response with formatted output
 * Common pattern used across tool outputs for consistent formatting
 */
export function createStructuredResponse(
  operation: string,
  formattedOutput: string,
  data: any,
  additionalMeta?: Record<string, any>,
  format?: OutputMode
): any {
  // buildToolContent already wraps both plain and JSON views
  const enriched = {
    ...(data || {}),
    ...(additionalMeta ? { meta: additionalMeta } : {})
  } as Record<string, unknown>;
  return buildToolContent(operation, formattedOutput, enriched, format);
}

/**
 * Common helper for task status icons
 */
export function getTaskStatusIcon(status: string): string {
  const statusIcons: Record<string, string> = {
    pending: '⏳',
    active: '🔄',
    done: '✅'
  };
  return statusIcons[status] || '❓';
}

/**
 * Common helper for percentage calculation
 */
export function calculatePercentage(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

/**
 * Common helper for text truncation
 */
export function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

/**
 * Normalize workspace name to match storage format
 * Handles both paths and workspace names, converting to consistent format
 */
export function normalizeWorkspaceName(name: string): string {
  // Handle absolute paths like "C:\source\COA Goldfish MCP" or "/home/user/project"
  if (name.includes('/') || name.includes('\\')) {
    // Remove trailing separators first, then split and get the last non-empty segment
    const cleanPath = name.replace(/[/\\]+$/, '');
    const segments = cleanPath.split(/[/\\]+/).filter(segment => segment.length > 0);
    name = segments.pop() || name;
  }
  
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolve special TODO list identifiers like "latest" to actual list IDs
 * Makes AI agents more intuitive by supporting semantic keywords
 * 
 * @param listId The list ID or special keyword (e.g., "latest")
 * @param todoLists Available TODO lists to search through
 * @returns The resolved TODO list or undefined if not found
 */
export function resolveSpecialTodoListId(
  listId: string | undefined,
  todoLists: TodoList[]
): TodoList | undefined {
  if (!listId) {
    // No ID provided - return most recently updated list
    return todoLists.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  }

  // Check for special keywords
  const normalizedId = listId.toLowerCase().trim();
  
  if (normalizedId === 'latest' || normalizedId === 'recent' || normalizedId === 'last') {
    // Return the most recently updated list
    return todoLists.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  }
  
  if (normalizedId === 'active' || normalizedId === 'current') {
    // Return the most recent list with pending tasks
    const activeLists = todoLists.filter(list => 
      list.items.some(item => item.status !== 'done')
    );
    return activeLists.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  }
  
  // Not a special keyword - try to find by exact ID or partial match
  return todoLists.find(list => 
    list.id === listId || list.id.endsWith(listId)
  );
}
