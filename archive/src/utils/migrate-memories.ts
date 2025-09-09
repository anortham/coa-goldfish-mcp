/**
 * Migration utility to convert Memory objects to TodoLists
 * Part of the storage architecture simplification (Phase 3.1)
 */

import { Storage } from '../core/storage.js';
import { GoldfishMemory, TodoList } from '../types/index.js';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
  details: string[];
}

/**
 * Migrate Memory objects to enhanced TodoLists
 * This handles the transition from 4+ memory types to just 2 core types
 */
export async function migrateMemoriesToTodoLists(
  storage: Storage, 
  dryRun: boolean = true
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
    details: []
  };

  try {
    const workspaces = await storage.discoverWorkspaces();
    result.details.push(`Found ${workspaces.length} workspaces to migrate`);

    for (const workspace of workspaces) {
      result.details.push(`\n--- Processing workspace: ${workspace} ---`);
      
      // Load all memories for this workspace
      const memories = await storage.loadAllMemories(workspace);
      const memoryObjects = memories.filter(m => 
        m.type && ['general', 'todo', 'context'].includes(m.type)
      );
      
      result.details.push(`Found ${memoryObjects.length} Memory objects to migrate`);

      for (const memory of memoryObjects) {
        try {
          if (memory.type === 'checkpoint') {
            // Skip checkpoints - they stay as-is
            result.skippedCount++;
            continue;
          }

          const todoList = await convertMemoryToTodoList(memory, storage);
          result.details.push(`✓ Converted ${memory.type} memory "${memory.id}" to TodoList`);

          if (!dryRun) {
            await storage.saveTodoList(todoList);
            // Note: We don't delete the original memory here for safety
            // That will be done in Phase 3.2
          }

          result.migratedCount++;
        } catch (error) {
          const errorMsg = `Failed to migrate memory ${memory.id}: ${error}`;
          result.errors.push(errorMsg);
          result.details.push(`✗ ${errorMsg}`);
        }
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

  } catch (error) {
    result.success = false;
    result.errors.push(`Migration failed: ${error}`);
  }

  return result;
}

/**
 * Convert a Memory object to a TodoList
 */
async function convertMemoryToTodoList(
  memory: GoldfishMemory, 
  storage: Storage
): Promise<TodoList> {
  const now = new Date();

  let title: string;
  let description: string | undefined;
  let metadata: Record<string, any> | undefined;
  let items: Array<{id: string, task: string, status: 'pending' | 'active' | 'done', createdAt: Date}>;
  let ttlHours: number | undefined;

  switch (memory.type) {
    case 'general':
      // Convert general memories to single-item TodoLists
      title = `Quick Note - ${memory.timestamp.toLocaleDateString()}`;
      description = 'Migrated from general memory';
      items = [{
        id: '1',
        task: typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content),
        status: 'pending' as const,
        createdAt: memory.timestamp
      }];
      ttlHours = memory.ttlHours || 168; // Default 1 week
      break;

    case 'context':
      // Convert context memories (agent handoffs) to structured TodoLists
      title = `Agent Handoff - ${memory.timestamp.toLocaleDateString()}`;
      description = 'Migrated from context memory (agent handoff)';
      
      // Try to extract meaningful data from content
      if (typeof memory.content === 'object' && memory.content !== null) {
        metadata = memory.content as Record<string, any>;
        
        // Try to extract actionable items
        const contentObj = memory.content as any;
        if (contentObj.testSpecs || contentObj.fixes || contentObj.actions) {
          items = extractItemsFromHandoff(contentObj);
        } else {
          items = [{
            id: '1',
            task: `Process handoff data: ${JSON.stringify(memory.content)}`,
            status: 'pending' as const,
            createdAt: memory.timestamp
          }];
        }
      } else {
        items = [{
          id: '1',
          task: typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content),
          status: 'pending' as const,
          createdAt: memory.timestamp
        }];
      }
      
      ttlHours = memory.ttlHours || 24; // Agent handoffs are typically short-lived
      break;

    case 'todo':
      // Convert todo memories to proper TodoLists
      title = `Todo Memory - ${memory.timestamp.toLocaleDateString()}`;
      description = 'Migrated from todo memory (not a real TodoList)';
      items = [{
        id: '1',
        task: typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content),
        status: 'pending' as const,
        createdAt: memory.timestamp
      }];
      ttlHours = memory.ttlHours;
      break;

    default:
      throw new Error(`Unknown memory type: ${memory.type}`);
  }

  return {
    id: storage.generateChronologicalFilename().replace('.json', ''),
    title,
    description,
    metadata,
    workspace: memory.workspace,
    items,
    createdAt: memory.timestamp,
    updatedAt: now,
    status: 'active',
    ttlHours,
    sessionId: memory.sessionId,
    tags: memory.tags
  };
}

/**
 * Try to extract actionable items from handoff content
 */
function extractItemsFromHandoff(content: any): Array<{id: string, task: string, status: 'pending' | 'active' | 'done', createdAt: Date}> {
  const items: Array<{id: string, task: string, status: 'pending' | 'active' | 'done', createdAt: Date}> = [];
  let itemId = 1;

  // Extract from testSpecs
  if (content.testSpecs && typeof content.testSpecs === 'object') {
    Object.entries(content.testSpecs).forEach(([key, value]) => {
      items.push({
        id: itemId.toString(),
        task: `Test: ${key} - ${value}`,
        status: 'pending',
        createdAt: new Date()
      });
      itemId++;
    });
  }

  // Extract from fixes array
  if (Array.isArray(content.fixes)) {
    content.fixes.forEach((fix: any) => {
      items.push({
        id: itemId.toString(),
        task: `Fix: ${typeof fix === 'string' ? fix : JSON.stringify(fix)}`,
        status: 'pending',
        createdAt: new Date()
      });
      itemId++;
    });
  }

  // Extract from actions array
  if (Array.isArray(content.actions)) {
    content.actions.forEach((action: any) => {
      items.push({
        id: itemId.toString(),
        task: typeof action === 'string' ? action : JSON.stringify(action),
        status: 'pending',
        createdAt: new Date()
      });
      itemId++;
    });
  }

  // Fallback: create a generic item
  if (items.length === 0) {
    items.push({
      id: '1',
      task: `Process handoff: ${JSON.stringify(content)}`,
      status: 'pending',
      createdAt: new Date()
    });
  }

  return items;
}