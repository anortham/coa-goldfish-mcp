/**
 * List Workspaces Tool for Goldfish MCP
 * 
 * Helps external agents discover available workspaces and understand
 * the workspace naming conventions
 */

import { Storage } from '../core/storage.js';
import { ToolResponse } from '../types/index.js';
import { createErrorResponse, createSuccessResponse } from '../core/workspace-utils.js';

/**
 * Handle list workspaces - discover available workspaces
 */
export async function handleListWorkspaces(storage: Storage, args?: { format?: import('../core/output-utils.js').OutputMode }): Promise<ToolResponse> {
  try {
    const workspaces = await storage.discoverWorkspaces();
    const current = storage.getCurrentWorkspace();
    
    const output = [
      '📁 Available Workspaces:',
      '',
      `🎯 Current: ${current}`,
      ''
    ];
    
    if (workspaces.length === 0) {
      output.push('❓ No workspaces found');
    } else {
      output.push('📋 All Available:');
      workspaces.forEach((ws, index) => {
        const icon = ws === current ? '👉' : '  ';
        output.push(`${icon} ${index + 1}. ${ws}`);
      });
    }
    
    output.push('');
    output.push('💡 Tips for external agents:');
    output.push('• Use exact workspace names from this list');
    output.push('• Full paths like "C:\\source\\Project" are auto-normalized');
    output.push('• Omit workspace parameter to use current workspace');
    
    return createSuccessResponse(output.join('\n'), 'list-workspaces', { current, total: workspaces.length, workspaces }, args?.format);
    
  } catch (error) {
    return createErrorResponse(`Failed to list workspaces: ${error instanceof Error ? error.message : String(error)}`, 'list_workspaces', args?.format);
  }
}

/**
 * Get tool schema for list_workspaces tool
 */
export function getListWorkspacesToolSchema() {
  return {
    name: 'list_workspaces',
    description: 'Discover available workspaces and their normalized names. Perfect for external agents to know valid workspace values.',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['plain', 'emoji', 'json', 'dual'],
          description: 'Output format override (defaults to env GOLDFISH_OUTPUT_MODE or dual)'
        }
      },
      additionalProperties: false
    }
  };
}
