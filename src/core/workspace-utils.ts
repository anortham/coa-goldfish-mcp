/**
 * Workspace utility functions for cross-workspace operations
 * 
 * Provides common patterns for loading data from multiple workspaces
 * to eliminate code duplication across tool files
 */

import { Storage } from './storage.js';

/**
 * Load TODO lists from either current workspace or all workspaces
 */
export async function loadTodoListsWithScope(
  storage: Storage, 
  scope: 'current' | 'all' = 'current'
): Promise<any[]> {
  if (scope === 'current') {
    return await storage.loadAllTodoLists();
  }

  // Load from all workspaces
  try {
    const { homedir } = await import('os');
    const { join } = await import('path');
    const fs = await import('fs-extra');
    
    const basePath = join(homedir(), '.coa', 'goldfish');
    const workspaces = await fs.readdir(basePath);
    
    let allTodoLists: any[] = [];
    
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
 * Create consistent error response
 */
export function createErrorResponse(message: string, context?: string): any {
  const fullMessage = context ? `${context}: ${message}` : message;
  return {
    content: [
      {
        type: 'text' as const,
        text: fullMessage
      }
    ]
  };
}

/**
 * Create consistent success response
 */
export function createSuccessResponse(message: string): any {
  return {
    content: [
      {
        type: 'text' as const,
        text: message
      }
    ]
  };
}

/**
 * Create structured response with formatted output
 * Common pattern used across tool outputs for consistent formatting
 */
export function createStructuredResponse(
  operation: string,
  formattedOutput: string,
  data: any,
  additionalMeta?: Record<string, any>
): any {
  const response = {
    success: true,
    operation,
    formattedOutput,
    data,
    meta: {
      mode: 'formatted',
      lines: formattedOutput.split('\n').length,
      ...additionalMeta
    }
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(response, null, 2)
      }
    ]
  };
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