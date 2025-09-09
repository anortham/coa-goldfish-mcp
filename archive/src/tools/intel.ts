/**
 * Intel Tool for Goldfish MCP
 * 
 * Manages project intelligence and discoveries in a simple INTEL.md file.
 * Captures critical knowledge that spans multiple sessions and prevents
 * repeated investigations and mistakes.
 */

import { Storage } from '../core/storage.js';
import { ToolResponse } from '../types/index.js';
import { createErrorResponse, createSuccessResponse } from '../core/workspace-utils.js';

export interface IntelArgs {
  // Quick capture - most common use case
  capture?: string;
  
  // Structured capture
  insight?: {
    what: string;
    where?: string;  // file:line reference
    why?: string;    // brief explanation
    category?: 'bug' | 'rule' | 'workaround' | 'gotcha' | 'architecture';
  };
  
  // Management actions
  action?: 'list' | 'clean' | 'archive';
  
  // Properties
  permanent?: boolean;  // Add to permanent rules section
  section?: 'permanent' | 'active' | 'resolved';
  
  // Output format
  format?: import('../core/output-utils.js').OutputMode;
}

/**
 * Handle intel tool operations
 */
export async function handleIntel(storage: Storage, args?: IntelArgs): Promise<ToolResponse> {
  try {
    const action = args?.action || (args?.capture || args?.insight ? 'capture' : 'list');
    
    switch (action) {
      case 'capture':
        return await handleCapture(storage, args || {});
      case 'list':
        return await handleList(storage, args);
      case 'clean':
        return await handleClean(storage, args);
      case 'archive':
        return await handleArchive(storage, args);
      default:
        return createErrorResponse(`Unknown intel action: ${action}`, 'intel', args?.format);
    }
  } catch (error) {
    return createErrorResponse(
      `Failed to handle intel: ${error instanceof Error ? error.message : String(error)}`,
      'intel',
      args?.format
    );
  }
}

/**
 * Capture new intelligence
 */
async function handleCapture(storage: Storage, args: IntelArgs): Promise<ToolResponse> {
  if (!args.capture && !args.insight) {
    return createErrorResponse(
      'Either capture or insight parameter is required for capturing intelligence',
      'intel_capture',
      args.format
    );
  }

  const intel = await readIntelFile(storage);
  const newEntry = formatIntelEntry(args);
  const section = determineSection(args);
  
  const updatedIntel = addToSection(intel, newEntry, section);
  await writeIntelFile(storage, updatedIntel);
  
  const message = `📝 Intelligence captured: ${args.capture || args.insight?.what}`;
  return createSuccessResponse(
    message,
    'intel_captured',
    { entry: newEntry, section },
    args.format
  );
}

/**
 * List current intelligence
 */
async function handleList(storage: Storage, args?: IntelArgs): Promise<ToolResponse> {
  const intel = await readIntelFile(storage);
  
  if (!intel || intel.trim() === '') {
    const message = '📋 No project intelligence captured yet. Use intel("discovery") to start!';
    return createSuccessResponse(message, 'intel_empty', {}, args?.format);
  }
  
  return createSuccessResponse(
    `📋 **Current Project Intelligence:**\n\n${intel}`,
    'intel_listed',
    { hasIntel: true },
    args?.format
  );
}

/**
 * Clean up resolved intelligence
 */
async function handleClean(storage: Storage, args?: IntelArgs): Promise<ToolResponse> {
  // For now, just return a message about manual cleanup
  const message = '🧹 To clean intel, edit INTEL.md manually or use intel({ action: "archive" })';
  return createSuccessResponse(message, 'intel_clean_info', {}, args?.format);
}

/**
 * Archive resolved intelligence
 */
async function handleArchive(storage: Storage, args?: IntelArgs): Promise<ToolResponse> {
  // For now, just return a message about manual archiving
  const message = '📦 Archive functionality coming soon. For now, manually move items to "Resolved" section in INTEL.md';
  return createSuccessResponse(message, 'intel_archive_info', {}, args?.format);
}

/**
 * Read INTEL.md file or return empty template
 */
async function readIntelFile(storage: Storage): Promise<string> {
  try {
    return await storage.readIntelFile();
  } catch (_error) {
    // Return template if file doesn't exist
    return getIntelTemplate();
  }
}

/**
 * Write INTEL.md file
 */
async function writeIntelFile(storage: Storage, content: string): Promise<void> {
  await storage.writeIntelFile(content);
}

/**
 * Format intelligence entry
 */
function formatIntelEntry(args: IntelArgs): string {
  if (args.capture) {
    return `- ${args.capture}`;
  }
  
  if (args.insight) {
    const parts = [`- ${args.insight.what}`];
    if (args.insight.where) parts.push(`(${args.insight.where})`);
    if (args.insight.why) parts.push(`- ${args.insight.why}`);
    return parts.join(' ');
  }
  
  return '- Unknown intelligence';
}

/**
 * Determine which section to add to
 */
function determineSection(args: IntelArgs): string {
  if (args.section) return args.section;
  if (args.permanent) return 'permanent';
  return 'active';
}

/**
 * Add entry to appropriate section
 */
function addToSection(intel: string, entry: string, section: string): string {
  const lines = intel.split('\n');
  const sectionHeaders = {
    permanent: '## Permanent Rules',
    active: '## Active Investigations',
    resolved: '## Resolved (Archive)'
  };
  
  const headerLine = sectionHeaders[section as keyof typeof sectionHeaders];
  const headerIndex = lines.findIndex(line => line.includes(headerLine));
  
  if (headerIndex === -1) {
    // Section doesn't exist, add it
    const newSection = `\n${headerLine}\n\n${entry}\n`;
    return intel + newSection;
  }
  
  // Find next section or end of file
  let insertIndex = headerIndex + 1;
  while (insertIndex < lines.length) {
    const line = lines[insertIndex];
    if (!line || line.startsWith('##')) {
      break;
    }
    insertIndex++;
  }
  
  // Insert before next section or at end
  lines.splice(insertIndex, 0, entry);
  return lines.join('\n');
}

/**
 * Get initial INTEL.md template
 */
function getIntelTemplate(): string {
  return `# Project Intelligence

## Permanent Rules
- Add permanent project rules and constraints here
- These should always be relevant (e.g., "Never build in release mode")

## Active Investigations
- Add current investigation findings here  
- These are temporary and should be moved to Resolved when done

## Resolved (Archive)
- Completed investigations and fixed issues
- Keep recent ones for reference, clean up old ones

---
*This file is automatically managed by Goldfish Intel tool*
*You can also edit it manually if needed*
`;
}

/**
 * Get tool schema for intel tool
 */
export function getIntelToolSchema() {
  return {
    name: 'intel',
    description: `PROACTIVELY capture critical project discoveries and knowledge. Use IMMEDIATELY when you:
    
- Find a bug's root cause ("< symbol breaks parser at line 234")
- Discover incomplete/stub implementations ("UserService.auth() is just a stub")
- Identify workarounds or gotchas ("Test X is flaky, always skip")
- Learn project-specific rules ("Never build in release mode - locks files")
- Find anything that would surprise you in the next session
    
Quick capture: intel("your discovery here")
Structured: intel({ insight: { what, where, why }, permanent: true })

Intelligence persists across sessions in INTEL.md and prevents repeated investigations.`,
    inputSchema: {
      type: 'object',
      properties: {
        capture: {
          type: 'string',
          description: 'Quick capture - just pass the discovery as a string'
        },
        insight: {
          type: 'object',
          description: 'Structured intelligence capture',
          properties: {
            what: {
              type: 'string',
              description: 'What was discovered'
            },
            where: {
              type: 'string',
              description: 'File and line reference (e.g., "parser.ts:234")'
            },
            why: {
              type: 'string',
              description: 'Brief explanation of why this matters'
            },
            category: {
              type: 'string',
              enum: ['bug', 'rule', 'workaround', 'gotcha', 'architecture'],
              description: 'Category of discovery'
            }
          },
          required: ['what'],
          additionalProperties: false
        },
        action: {
          type: 'string',
          enum: ['list', 'clean', 'archive'],
          description: 'Management action to perform'
        },
        permanent: {
          type: 'boolean',
          description: 'Add to permanent rules section (default: false)'
        },
        section: {
          type: 'string',
          enum: ['permanent', 'active', 'resolved'],
          description: 'Which section to add to'
        },
        format: {
          type: 'string',
          enum: ['plain', 'emoji', 'json', 'dual'],
          description: 'Output format override'
        }
      },
      additionalProperties: false
    }
  };
}