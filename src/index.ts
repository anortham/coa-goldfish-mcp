#!/usr/bin/env node

/**
 * COA Goldfish MCP Server
 * 
 * Simple short-term memory for AI agents using JSON file storage.
 * Named "Goldfish" for the short attention span - memories expire automatically.
 * 
 * Features:
 * - 4 simple tools: remember, recall, forget, snapshot
 * - JSON file storage with chronological IDs
 * - Auto-expiration (24h default)
 * - Cross-session TODO promotion to ProjectKnowledge
 * - Zero database overhead
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import { join } from 'path';
import { homedir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Types
interface GoldfishMemory {
  id: string;
  timestamp: Date;
  workspace: string;
  sessionId?: string;
  type: 'general' | 'todo' | 'checkpoint' | 'context';
  content: any;
  ttlHours: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface TodoItem {
  id: string;
  task: string;
  status: 'pending' | 'active' | 'done';
  priority?: 'low' | 'normal' | 'high';
  createdAt: Date;
  updatedAt?: Date;
  sessionId?: string;
  tags?: string[];
}

interface TodoList {
  id: string;
  title: string;
  items: TodoItem[];
  createdAt: Date;
  updatedAt?: Date;
  workspace: string;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

// Configuration
const GOLDFISH_BASE_DIR = join(homedir(), '.coa', 'goldfish');
const DEFAULT_TTL_HOURS = 24;
const MAX_MEMORIES_PER_WORKSPACE = 50;
const GLOBAL_WORKSPACE = 'global';

class GoldfishServer {
  private server: Server;
  private currentWorkspace: string;

  constructor() {
    this.currentWorkspace = this.detectWorkspace();
    this.server = new Server(
      {
        name: 'coa-goldfish-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupDirectories();
  }

  private detectWorkspace(): string {
    try {
      const cwd = process.cwd();
      
      // Try to get git root first (most reliable)
      try {
        const gitRoot = execSync('git rev-parse --show-toplevel', { 
          encoding: 'utf8',
          timeout: 5000,
          cwd 
        }).trim();
        
        // Normalize workspace name (like ProjectKnowledge does)
        const workspaceName = gitRoot.split(/[\/\\]/).pop() || 'unknown';
        return this.normalizeWorkspaceName(workspaceName);
      } catch {
        // Not in a git repo, fall back to directory name
        const dirName = cwd.split(/[\/\\]/).pop() || 'unknown';
        return this.normalizeWorkspaceName(dirName);
      }
    } catch {
      return 'unknown';
    }
  }

  private normalizeWorkspaceName(name: string): string {
    // Convert to lowercase with hyphens (consistent with other COA tools)
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private getMemoriesDir(workspace?: string): string {
    const ws = workspace || this.currentWorkspace;
    return join(GOLDFISH_BASE_DIR, 'memories', ws);
  }

  private getGlobalMemoriesDir(): string {
    return join(GOLDFISH_BASE_DIR, 'memories', GLOBAL_WORKSPACE);
  }

  private getTodosDir(workspace?: string): string {
    const ws = workspace || this.currentWorkspace;
    return join(GOLDFISH_BASE_DIR, 'todos', ws);
  }

  private async setupDirectories(): Promise<void> {
    await fs.ensureDir(this.getMemoriesDir());
    await fs.ensureDir(this.getGlobalMemoriesDir());
    await fs.ensureDir(this.getTodosDir());
    await fs.ensureDir(join(GOLDFISH_BASE_DIR, 'config'));
  }

  private generateChronologicalId(): string {
    // Format: YYYYMMDDHHMMSS-RANDOM
    const now = new Date();
    const datePart = now.toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14); // YYYYMMDDHHMMSS
    const randomPart = uuidv4().split('-')[0]?.toUpperCase();
    return `${datePart}-${randomPart}`;
  }

  private async tryPromoteToProjectKnowledge(memory: GoldfishMemory): Promise<boolean> {
    // Only promote important memories that are aging out
    if (!this.shouldPromoteMemory(memory)) {
      return false;
    }

    try {
      // Check if ProjectKnowledge federation endpoint is available
      const response = await fetch('http://localhost:5100/federation/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'WorkNote',
          content: `Promoted from Goldfish: ${memory.content}`,
          tags: ['goldfish-promotion', ...(memory.tags || [])],
          metadata: {
            originalId: memory.id,
            originalTimestamp: memory.timestamp,
            promotedAt: new Date().toISOString(),
            source: 'goldfish'
          },
          workspace: memory.workspace
        }),
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      if (response.ok) {
        console.error(`🔄 Promoted memory ${memory.id.slice(-8)} to ProjectKnowledge`);
        return true;
      }
    } catch (error) {
      // Silently fail - promotion is optional
      // console.error(`Failed to promote memory: ${error}`);
    }
    
    return false;
  }

  private shouldPromoteMemory(memory: GoldfishMemory): boolean {
    const ageHours = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
    
    // Only promote memories that are getting old (12+ hours) and are important
    if (ageHours < 12) return false;

    // Promote checkpoints with session data
    if (memory.type === 'checkpoint' && memory.metadata?.isSession) {
      return true;
    }

    // Promote memories with specific tags
    if (memory.tags?.some(tag => ['important', 'decision', 'architecture', 'bug-fix'].includes(tag))) {
      return true;
    }

    // Promote longer context that might be valuable
    if (memory.type === 'context' && typeof memory.content === 'string' && memory.content.length > 200) {
      return true;
    }

    return false;
  }

  private async cleanupExpiredMemories(workspace?: string): Promise<number> {
    try {
      const memoriesDir = workspace ? this.getMemoriesDir(workspace) : this.getMemoriesDir();
      
      if (!(await fs.pathExists(memoriesDir))) {
        return 0;
      }

      const files = await fs.readdir(memoriesDir);
      const now = new Date();
      let cleaned = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = join(memoriesDir, file);
          const memory: GoldfishMemory = await fs.readJson(filePath);
          
          const age = (now.getTime() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
          
          if (age > memory.ttlHours) {
            // Try to promote before deletion (fire and forget)
            await this.tryPromoteToProjectKnowledge(memory);
            
            await fs.remove(filePath);
            cleaned++;
          }
        } catch (error) {
          // Remove corrupted files
          await fs.remove(join(memoriesDir, file));
          cleaned++;
        }
      }

      // Keep only MAX_MEMORIES_PER_WORKSPACE most recent
      const remainingFiles = await fs.readdir(memoriesDir);
      if (remainingFiles.length > MAX_MEMORIES_PER_WORKSPACE) {
        const sortedFiles = remainingFiles
          .filter(f => f.endsWith('.json'))
          .sort()
          .reverse(); // Most recent first

        const toDelete = sortedFiles.slice(MAX_MEMORIES_PER_WORKSPACE);
        for (const file of toDelete) {
          await fs.remove(join(memoriesDir, file));
          cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Error cleaning up memories:', error);
      return 0;
    }
  }

  private async cleanupExpiredTodoLists(workspace?: string): Promise<number> {
    try {
      const todosDir = this.getTodosDir(workspace);
      
      if (!(await fs.pathExists(todosDir))) {
        return 0;
      }

      const files = await fs.readdir(todosDir);
      const now = new Date();
      let cleaned = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = join(todosDir, file);
          const todoList: TodoList = await fs.readJson(filePath);
          
          const ageHours = (now.getTime() - new Date(todoList.createdAt).getTime()) / (1000 * 60 * 60);
          
          // Remove TODO lists older than 72 hours (3 days)
          if (ageHours > 72) {
            // Try to promote completed work to ProjectKnowledge
            await this.tryPromoteTodoList(todoList);
            
            await fs.remove(filePath);
            cleaned++;
          }
        } catch (error) {
          // Remove corrupted files
          await fs.remove(join(todosDir, file));
          cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Error cleaning up TODO lists:', error);
      return 0;
    }
  }

  private async tryPromoteTodoList(todoList: TodoList): Promise<boolean> {
    const completedItems = todoList.items.filter(item => item.status === 'done');
    
    // Only promote if there's completed work worth remembering
    if (completedItems.length === 0) {
      return false;
    }

    try {
      const completedTasks = completedItems.map(item => item.task).join('\n- ');
      const totalItems = todoList.items.length;
      const progress = Math.round((completedItems.length / totalItems) * 100);
      
      const content = `Completed TODO List: "${todoList.title}"

Progress: ${progress}% (${completedItems.length}/${totalItems} tasks completed)

Completed tasks:
- ${completedTasks}

${todoList.items.length > completedItems.length ? `\nRemaining tasks:\n- ${todoList.items.filter(item => item.status !== 'done').map(item => item.task).join('\n- ')}` : ''}`;

      const response = await fetch('http://localhost:5100/federation/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'WorkNote',
          content,
          tags: ['completed-work', 'goldfish-promotion', ...(todoList.tags || [])],
          metadata: {
            originalId: todoList.id,
            originalCreatedAt: todoList.createdAt,
            promotedAt: new Date().toISOString(),
            source: 'goldfish',
            progress,
            completedCount: completedItems.length,
            totalCount: totalItems
          },
          workspace: todoList.workspace
        }),
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        console.error(`🔄 Promoted TODO list "${todoList.title}" to ProjectKnowledge`);
        return true;
      }
    } catch (error) {
      // Silently fail - promotion is optional
    }
    
    return false;
  }

  private async saveMemory(memory: GoldfishMemory): Promise<void> {
    const memoriesDir = this.getMemoriesDir(memory.workspace);
    await fs.ensureDir(memoriesDir);
    
    const filename = `${memory.id}.json`;
    const filepath = join(memoriesDir, filename);
    await fs.writeJson(filepath, memory, { spaces: 2 });
    
    // Cleanup expired memories after saving
    await this.cleanupExpiredMemories(memory.workspace);
    
    // Also cleanup expired TODO lists
    await this.cleanupExpiredTodoLists(memory.workspace);
  }

  private async loadRecentMemories(options: {
    limit?: number;
    workspaces?: string[];
    scope?: 'current' | 'global' | 'all';
  } = {}): Promise<GoldfishMemory[]> {
    try {
      const { limit = 10, workspaces, scope = 'current' } = options;
      const memories: GoldfishMemory[] = [];
      
      let targetWorkspaces: string[] = [];
      
      if (scope === 'current') {
        targetWorkspaces = [this.currentWorkspace];
      } else if (scope === 'global') {
        targetWorkspaces = [GLOBAL_WORKSPACE];
      } else if (scope === 'all') {
        // Get all available workspaces
        const memoriesBaseDir = join(GOLDFISH_BASE_DIR, 'memories');
        if (await fs.pathExists(memoriesBaseDir)) {
          const dirs = await fs.readdir(memoriesBaseDir);
          targetWorkspaces = dirs.filter(async (dir) => {
            const stat = await fs.stat(join(memoriesBaseDir, dir));
            return stat.isDirectory();
          });
        }
      } else if (workspaces) {
        targetWorkspaces = workspaces;
      }

      // Load memories from all target workspaces
      for (const workspace of targetWorkspaces) {
        const memoriesDir = this.getMemoriesDir(workspace);
        
        if (!(await fs.pathExists(memoriesDir))) continue;
        
        try {
          const files = await fs.readdir(memoriesDir);
          
          for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            try {
              const memory = await fs.readJson(join(memoriesDir, file));
              // Ensure workspace is set
              if (!memory.workspace) {
                memory.workspace = workspace;
              }
              memories.push(memory);
            } catch (error) {
              // Skip corrupted files
              continue;
            }
          }
        } catch (error) {
          // Skip inaccessible workspace directories
          continue;
        }
      }

      // Sort by chronological ID (descending) and limit
      const sortedMemories = memories
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, limit);

      return sortedMemories;
    } catch (error) {
      return [];
    }
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'remember',
          description: 'ALWAYS store working context immediately when starting tasks, discovering issues, or making decisions. Perfect for session context, current tasks, and working notes. Proactively capture insights without being asked. Automatically organized by workspace and expires in 24h.',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Information to remember'
              },
              type: {
                type: 'string',
                enum: ['general', 'todo', 'checkpoint', 'context'],
                description: 'Type of memory',
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
              },
              sessionId: {
                type: 'string',
                description: 'Optional session identifier'
              },
              workspace: {
                type: 'string',
                description: 'Store in specific workspace (default: current workspace)'
              },
              global: {
                type: 'boolean',
                description: 'Store as global memory (visible across all workspaces)',
                default: false
              }
            },
            required: ['content']
          }
        },
        {
          name: 'recall',
          description: 'Use proactively at session start to restore context and check recent memories when resuming work. Perfect for standups: "What did I work on yesterday?" Automatically check when users ask about current status or recent work. Can search current workspace, all workspaces, or specific projects.',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'Optional search pattern to match in content'
              },
              type: {
                type: 'string',
                enum: ['general', 'todo', 'checkpoint', 'context'],
                description: 'Filter by memory type'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of memories to return (default: 5)',
                default: 5
              },
              sessionId: {
                type: 'string',
                description: 'Filter by session ID'
              },
              scope: {
                type: 'string',
                enum: ['current', 'global', 'all'],
                description: 'Memory scope: current workspace, global only, or all workspaces (default: current)',
                default: 'current'
              },
              workspaces: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific workspaces to search (overrides scope)'
              },
              since: {
                type: 'string',
                description: 'Time filter: "1h", "24h", "3d", etc. (optional)'
              }
            }
          }
        },
        {
          name: 'forget',
          description: 'Remove specific memories or clear all memories. Use with caution!',
          inputSchema: {
            type: 'object',
            properties: {
              memoryId: {
                type: 'string',
                description: 'Specific memory ID to forget (optional)'
              },
              type: {
                type: 'string',
                enum: ['general', 'todo', 'checkpoint', 'context'],
                description: 'Forget all memories of this type (optional)'
              },
              clearAll: {
                type: 'boolean',
                description: 'Clear all memories (requires confirmation)',
                default: false
              }
            }
          }
        },
        {
          name: 'snapshot',
          description: 'Create checkpoints automatically after completing significant work, before context switches, or when reaching milestones. Essential for session continuity and allows easy restoration of conversation state. Use proactively to preserve important moments.',
          inputSchema: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Descriptive label for this snapshot'
              },
              description: {
                type: 'string',
                description: 'Optional detailed description'
              },
              sessionId: {
                type: 'string',
                description: 'Session identifier for this snapshot'
              }
            },
            required: ['label']
          }
        },
        {
          name: 'create_todo_list',
          description: 'Proactively create when user mentions multiple tasks, provides a list of items, or discusses work planning. Essential for task tracking across sessions. Perfect for organizing active work (expires in 2-3 days). Use immediately when users describe multiple things to do.',
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
              sessionId: {
                type: 'string',
                description: 'Optional session identifier'
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional tags for categorization'
              }
            },
            required: ['title', 'items']
          }
        },
        {
          name: 'view_todos',
          description: 'Check automatically at session start and when user asks about current work status. Use to track progress without prompting. Perfect for "what am I working on?" questions and proactive status updates.',
          inputSchema: {
            type: 'object',
            properties: {
              listId: {
                type: 'string',
                description: 'Specific list ID to view (optional)'
              },
              sessionId: {
                type: 'string',
                description: 'Filter by session ID'
              },
              showCompleted: {
                type: 'boolean',
                description: 'Include completed items (default: true)',
                default: true
              }
            }
          }
        },
        {
          name: 'save_session',
          description: 'ALWAYS save session state before ending work, switching tasks, or when context is getting large. Critical for tomorrow\'s productivity and perfect for end-of-day workflow to capture where you left off. Use automatically when significant work is completed.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session identifier'
              },
              description: {
                type: 'string',
                description: 'Description of current state'
              },
              activeFiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Files currently being worked on'
              },
              currentBranch: {
                type: 'string',
                description: 'Current git branch'
              },
              workContext: {
                type: 'string',
                description: 'What you were working on'
              }
            },
            required: ['sessionId', 'description']
          }
        },
        {
          name: 'restore_session',
          description: 'IMMEDIATELY use at conversation start if resuming previous work. Check for existing sessions before starting new tasks. Perfect for morning startup to remember what you were doing. Essential for session continuity.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session identifier to restore'
              }
            },
            required: ['sessionId']
          }
        },
        {
          name: 'update_todo',
          description: 'Update task status immediately upon completion or progress. Mark items done as you work, not in batches. Add new tasks to existing lists when user mentions additional work. Essential for real-time task tracking.',
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
              }
            },
            required: ['listId']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'remember':
            return await this.handleRemember(args);
          case 'recall':
            return await this.handleRecall(args);
          case 'forget':
            return await this.handleForget(args);
          case 'snapshot':
            return await this.handleSnapshot(args);
          case 'create_todo_list':
            return await this.handleCreateTodoList(args);
          case 'view_todos':
            return await this.handleViewTodos(args);
          case 'update_todo':
            return await this.handleUpdateTodo(args);
          case 'save_session':
            return await this.handleSaveSession(args);
          case 'restore_session':
            return await this.handleRestoreSession(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error in ${name}: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    });
  }

  private async handleRemember(args: any) {
    const { 
      content, 
      type = 'general', 
      ttlHours = DEFAULT_TTL_HOURS, 
      tags, 
      sessionId, 
      workspace,
      global = false 
    } = args;

    const targetWorkspace = global ? GLOBAL_WORKSPACE : (workspace || this.currentWorkspace);

    const memory: GoldfishMemory = {
      id: this.generateChronologicalId(),
      timestamp: new Date(),
      workspace: targetWorkspace,
      sessionId,
      type,
      content,
      ttlHours,
      tags,
      metadata: { global }
    };

    await this.saveMemory(memory);

    const workspaceInfo = global ? 'global' : targetWorkspace;
    const icon = type === 'todo' ? '📝' : type === 'checkpoint' ? '💾' : '🧠';

    return {
      content: [
        {
          type: 'text',
          text: `✅ Remembered in "${workspaceInfo}" (ID: ${memory.id.slice(-8)}, expires in ${ttlHours}h)\n${icon} ${content}`
        }
      ]
    };
  }

  private async handleRecall(args: any) {
    const { 
      pattern, 
      type, 
      limit = 5, 
      sessionId, 
      scope = 'current', 
      workspaces, 
      since 
    } = args;

    // Parse time filter if provided
    let sinceDate: Date | undefined;
    if (since) {
      const match = since.match(/^(\d+)([hdw])$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        const now = new Date();
        
        switch (unit) {
          case 'h':
            sinceDate = new Date(now.getTime() - value * 60 * 60 * 1000);
            break;
          case 'd':
            sinceDate = new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
            break;
          case 'w':
            sinceDate = new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
            break;
        }
      }
    }

    let memories = await this.loadRecentMemories({
      limit: Math.min(limit * 3, 100), // Load more to filter
      workspaces,
      scope
    });

    // Apply filters
    if (type) {
      memories = memories.filter(m => m.type === type);
    }

    if (sessionId) {
      memories = memories.filter(m => m.sessionId === sessionId);
    }

    if (sinceDate) {
      memories = memories.filter(m => new Date(m.timestamp) >= sinceDate!);
    }

    if (pattern) {
      const searchPattern = pattern.toLowerCase();
      memories = memories.filter(m => 
        JSON.stringify(m.content).toLowerCase().includes(searchPattern) ||
        (m.tags && m.tags.some(tag => tag.toLowerCase().includes(searchPattern)))
      );
    }

    // Final limit
    memories = memories.slice(0, limit);

    if (memories.length === 0) {
      const scopeText = scope === 'all' ? 'any workspace' : scope === 'global' ? 'global memories' : `"${this.currentWorkspace}"`;
      return {
        content: [
          {
            type: 'text',
            text: `🤔 No matching memories found in ${scopeText}. Maybe they expired or were never stored?`
          }
        ]
      };
    }

    // Group by workspace for multi-workspace results
    const memoryGroups = new Map<string, GoldfishMemory[]>();
    for (const memory of memories) {
      const ws = memory.workspace || 'unknown';
      if (!memoryGroups.has(ws)) {
        memoryGroups.set(ws, []);
      }
      memoryGroups.get(ws)!.push(memory);
    }

    const output = ['🧠 Recent Memories:', ''];
    
    if (memoryGroups.size > 1 && scope === 'all') {
      // Multi-workspace display
      for (const [workspace, wsMemories] of memoryGroups) {
        const wsIcon = workspace === GLOBAL_WORKSPACE ? '🌐' : '📁';
        output.push(`${wsIcon} **${workspace}**`);
        
        for (const memory of wsMemories) {
          const age = Math.round((Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60 * 24 * 10)) / 100;
          const ageStr = age < 1 ? 'today' : `${age.toFixed(1)}d ago`;
          const typeIcon = {
            general: '💭',
            todo: '📝',
            checkpoint: '💾',
            context: '🔗'
          }[memory.type] || '📄';
          
          output.push(`  ${typeIcon} [${memory.id.slice(-8)}] ${ageStr} - ${memory.content}`);
          if (memory.tags && memory.tags.length > 0) {
            output.push(`     Tags: ${memory.tags.join(', ')}`);
          }
        }
        output.push('');
      }
    } else {
      // Single workspace display
      for (const memory of memories) {
        const age = Math.round((Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60 * 24 * 10)) / 100;
        const ageStr = age < 1 ? 'today' : `${age.toFixed(1)}d ago`;
        const typeIcon = {
          general: '💭',
          todo: '📝',
          checkpoint: '💾',
          context: '🔗'
        }[memory.type] || '📄';
        
        output.push(`${typeIcon} [${memory.id.slice(-8)}] ${ageStr} - ${memory.type.toUpperCase()}`);
        output.push(`   ${memory.content}`);
        if (memory.tags && memory.tags.length > 0) {
          output.push(`   Tags: ${memory.tags.join(', ')}`);
        }
        if (scope === 'all' && memory.workspace !== this.currentWorkspace) {
          output.push(`   Workspace: ${memory.workspace}`);
        }
        output.push('');
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: output.join('\n')
        }
      ]
    };
  }

  private async handleForget(args: any) {
    const { memoryId, type, clearAll } = args;

    if (clearAll) {
      const memoriesDir = this.getMemoriesDir();
      const files = await fs.readdir(memoriesDir);
      let deleted = 0;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.remove(join(memoriesDir, file));
          deleted++;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `🧹 Cleared all memories (${deleted} items forgotten)`
          }
        ]
      };
    }

    if (memoryId) {
      const filename = `${memoryId}.json`;
      const filepath = join(this.getMemoriesDir(), filename);
      
      if (await fs.pathExists(filepath)) {
        await fs.remove(filepath);
        return {
          content: [
            {
              type: 'text',
              text: `🗑️ Forgot memory ${memoryId}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❓ Memory ${memoryId} not found (may have already expired)`
            }
          ]
        };
      }
    }

    if (type) {
      const memoriesDir = this.getMemoriesDir();
      const files = await fs.readdir(memoriesDir);
      let deleted = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const memory = await fs.readJson(join(memoriesDir, file));
          if (memory.type === type) {
            await fs.remove(join(memoriesDir, file));
            deleted++;
          }
        } catch (error) {
          // Skip corrupted files
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `🗑️ Forgot ${deleted} memories of type '${type}'`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: '❓ Please specify memoryId, type, or clearAll=true'
        }
      ]
    };
  }

  private async handleSnapshot(args: any) {
    const { label, description, sessionId, workspace, global = false } = args;

    const targetWorkspace = global ? GLOBAL_WORKSPACE : (workspace || this.currentWorkspace);

    const snapshot: GoldfishMemory = {
      id: this.generateChronologicalId(),
      timestamp: new Date(),
      workspace: targetWorkspace,
      sessionId,
      type: 'checkpoint',
      content: {
        label,
        description: description || `Checkpoint created at ${new Date().toLocaleString()}`,
        workspace: targetWorkspace,
        sessionId,
        snapshotType: 'manual'
      },
      ttlHours: 24 * 7, // Keep snapshots for a week
      tags: ['snapshot', 'checkpoint'],
      metadata: { isSnapshot: true, global }
    };

    await this.saveMemory(snapshot);

    const workspaceInfo = global ? 'global' : targetWorkspace;

    return {
      content: [
        {
          type: 'text',
          text: `📸 Snapshot saved in "${workspaceInfo}": "${label}" (ID: ${snapshot.id.slice(-8)})\n💾 This checkpoint will be kept for 7 days`
        }
      ]
    };
  }

  private async saveTodoList(todoList: TodoList): Promise<void> {
    const todosDir = this.getTodosDir(todoList.workspace);
    await fs.ensureDir(todosDir);
    
    const filename = `${todoList.id}.json`;
    const filepath = join(todosDir, filename);
    await fs.writeJson(filepath, todoList, { spaces: 2 });
  }

  private async loadTodoList(listId: string, workspace?: string): Promise<TodoList | null> {
    try {
      const todosDir = this.getTodosDir(workspace);
      const filename = `${listId}.json`;
      const filepath = join(todosDir, filename);
      
      if (await fs.pathExists(filepath)) {
        return await fs.readJson(filepath);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private async loadAllTodoLists(workspace?: string): Promise<TodoList[]> {
    try {
      const todosDir = this.getTodosDir(workspace);
      
      if (!(await fs.pathExists(todosDir))) {
        return [];
      }
      
      const files = await fs.readdir(todosDir);
      const todoLists: TodoList[] = [];
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const todoList = await fs.readJson(join(todosDir, file));
          todoLists.push(todoList);
        } catch (error) {
          // Skip corrupted files
          continue;
        }
      }
      
      return todoLists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      return [];
    }
  }

  private async handleCreateTodoList(args: any) {
    const { title, items, sessionId, tags } = args;

    const todoList: TodoList = {
      id: this.generateChronologicalId(),
      title,
      items: items.map((task: string) => ({
        id: this.generateChronologicalId(),
        task,
        status: 'pending' as const,
        priority: 'normal' as const,
        createdAt: new Date(),
        sessionId,
        tags: []
      })),
      createdAt: new Date(),
      workspace: this.currentWorkspace,
      sessionId,
      tags: tags || [],
      metadata: {}
    };

    await this.saveTodoList(todoList);

    return {
      content: [
        {
          type: 'text',
          text: `📝 Created TODO list "${title}" with ${items.length} items (ID: ${todoList.id.slice(-8)})\n✅ Ready to track your active work for the next 2-3 days`
        }
      ]
    };
  }

  private async handleViewTodos(args: any) {
    const { listId, sessionId, showCompleted = true } = args;

    if (listId) {
      const todoList = await this.loadTodoList(listId);
      if (!todoList) {
        return {
          content: [
            {
              type: 'text',
              text: `❓ TODO list ${listId} not found (may have expired)`
            }
          ]
        };
      }

      const filteredItems = showCompleted 
        ? todoList.items 
        : todoList.items.filter(item => item.status !== 'done');

      const output = [
        `📝 **${todoList.title}** (${todoList.id.slice(-8)})`,
        `Created: ${new Date(todoList.createdAt).toLocaleDateString()}`,
        ''
      ];

      if (filteredItems.length === 0) {
        output.push('🎉 All tasks completed!');
      } else {
        const statusCounts = {
          pending: filteredItems.filter(i => i.status === 'pending').length,
          active: filteredItems.filter(i => i.status === 'active').length,
          done: filteredItems.filter(i => i.status === 'done').length
        };

        output.push(`📊 Status: ${statusCounts.pending} pending, ${statusCounts.active} active, ${statusCounts.done} done`);
        output.push('');

        for (const item of filteredItems) {
          const statusIcon = {
            pending: '⏳',
            active: '🔄', 
            done: '✅'
          }[item.status];
          
          const priorityIcon = item.priority === 'high' ? '🔥' : item.priority === 'low' ? '🔽' : '';
          output.push(`${statusIcon} ${priorityIcon}[${item.id.slice(-8)}] ${item.task}`);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: output.join('\n')
          }
        ]
      };
    }

    // View all TODO lists
    const todoLists = await this.loadAllTodoLists();
    
    if (sessionId) {
      const filteredLists = todoLists.filter(list => list.sessionId === sessionId);
    }

    if (todoLists.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '📝 No active TODO lists found. Use create_todo_list to start tracking your work!'
          }
        ]
      };
    }

    const output = ['📝 **Active TODO Lists**', ''];

    for (const todoList of todoLists) {
      const totalItems = todoList.items.length;
      const completedItems = todoList.items.filter(item => item.status === 'done').length;
      const activeItems = todoList.items.filter(item => item.status === 'active').length;
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      const age = Math.round((Date.now() - new Date(todoList.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 10)) / 100;
      const ageStr = age < 1 ? 'today' : `${age.toFixed(1)}d ago`;

      output.push(`**${todoList.title}** [${todoList.id.slice(-8)}] - ${ageStr}`);
      output.push(`   Progress: ${progress}% (${completedItems}/${totalItems}) | Active: ${activeItems}`);
      
      if (todoList.tags && todoList.tags.length > 0) {
        output.push(`   Tags: ${todoList.tags.join(', ')}`);
      }
      output.push('');
    }

    return {
      content: [
        {
          type: 'text',
          text: output.join('\n')
        }
      ]
    };
  }

  private async handleUpdateTodo(args: any) {
    const { listId, itemId, status, newTask, priority } = args;

    const todoList = await this.loadTodoList(listId);
    if (!todoList) {
      return {
        content: [
          {
            type: 'text',
            text: `❓ TODO list ${listId} not found`
          }
        ]
      };
    }

    if (newTask) {
      // Add new task
      const newItem: TodoItem = {
        id: this.generateChronologicalId(),
        task: newTask,
        status: 'pending',
        priority: priority || 'normal',
        createdAt: new Date()
      };
      
      todoList.items.push(newItem);
      todoList.updatedAt = new Date();
      
      await this.saveTodoList(todoList);
      
      return {
        content: [
          {
            type: 'text',
            text: `➕ Added new task to "${todoList.title}": "${newTask}" (ID: ${newItem.id.slice(-8)})`
          }
        ]
      };
    }

    if (itemId && status) {
      // Update existing item
      const item = todoList.items.find(item => item.id === itemId || item.id.endsWith(itemId.slice(-8)));
      
      if (!item) {
        return {
          content: [
            {
              type: 'text',
              text: `❓ Task ${itemId} not found in list "${todoList.title}"`
            }
          ]
        };
      }

      const oldStatus = item.status;
      item.status = status as 'pending' | 'active' | 'done';
      item.updatedAt = new Date();
      
      if (priority) {
        item.priority = priority as 'low' | 'normal' | 'high';
      }
      
      todoList.updatedAt = new Date();
      await this.saveTodoList(todoList);

      const statusIcon = {
        pending: '⏳',
        active: '🔄',
        done: '✅'
      }[status as string];

      return {
        content: [
          {
            type: 'text',
            text: `${statusIcon} Updated "${item.task}" from ${oldStatus} to ${status}`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: '❓ Please specify either newTask to add, or itemId + status to update'
        }
      ]
    };
  }

  private async handleSaveSession(args: any) {
    const { sessionId, description, activeFiles, currentBranch, workContext } = args;

    // Generate the chronological ID that will be used as BOTH memory ID and sessionId
    const memoryId = this.generateChronologicalId();
    const actualSessionId = sessionId || memoryId; // Use provided sessionId or fallback to memory ID

    const sessionData = {
      sessionId: actualSessionId,
      description,
      activeFiles: activeFiles || [],
      currentBranch,
      workContext,
      savedAt: new Date().toISOString(),
      workspace: this.currentWorkspace
    };

    const sessionMemory: GoldfishMemory = {
      id: memoryId,
      timestamp: new Date(),
      workspace: this.currentWorkspace,
      sessionId: actualSessionId,
      type: 'checkpoint',
      content: sessionData,
      ttlHours: 72, // Keep sessions for 3 days
      tags: ['session-state', 'checkpoint'],
      metadata: { isSession: true }
    };

    await this.saveMemory(sessionMemory);

    const filesList = activeFiles && activeFiles.length > 0 
      ? `\n📁 Files: ${activeFiles.slice(0, 5).join(', ')}${activeFiles.length > 5 ? '...' : ''}`
      : '';

    const branchInfo = currentBranch ? `\n🌿 Branch: ${currentBranch}` : '';

    return {
      content: [
        {
          type: 'text',
          text: `💾 Session "${actualSessionId}" saved successfully (ID: ${sessionMemory.id.slice(-8)})\n📝 ${description}${filesList}${branchInfo}\n⏰ Valid for 3 days - perfect for resuming tomorrow!\n🔑 Use this sessionId for restore: ${actualSessionId}`
        }
      ]
    };
  }

  private async handleRestoreSession(args: any) {
    const { sessionId } = args;

    // Find the most recent session with this sessionId
    const memories = await this.loadRecentMemories({ 
      limit: 50, 
      scope: 'current' 
    });

    const sessionMemories = memories.filter(m => 
      m.type === 'checkpoint' &&
      m.sessionId === sessionId &&
      m.metadata?.isSession
    );

    if (sessionMemories.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `❓ No session found with ID "${sessionId}". It may have expired or was never saved.`
          }
        ]
      };
    }

    const latestSession = sessionMemories[0]; // Already sorted by chronological ID (most recent first)
    if (!latestSession) {
      return { content: [{ type: "text", text: "❌ No session found" }] };
    }
    
    const sessionData = latestSession.content;

    const age = Math.round((Date.now() - new Date(latestSession.timestamp).getTime()) / (1000 * 60 * 60 * 24 * 10)) / 100;
    const ageStr = age < 1 ? 'today' : `${age.toFixed(1)}d ago`;

    const output = [
      `💾 **Restored Session: "${sessionData.sessionId}"** (saved ${ageStr})`,
      '',
      `📝 **Context:** ${sessionData.description}`,
    ];

    if (sessionData.workContext) {
      output.push(`🎯 **Work Focus:** ${sessionData.workContext}`);
    }

    if (sessionData.currentBranch) {
      output.push(`🌿 **Branch:** ${sessionData.currentBranch}`);
    }

    if (sessionData.activeFiles && sessionData.activeFiles.length > 0) {
      output.push('', '📁 **Active Files:**');
      sessionData.activeFiles.forEach((file: string) => {
        output.push(`   • ${file}`);
      });
    }

    // Also show any related TODOs for this session
    const todoLists = await this.loadAllTodoLists();
    const sessionTodos = todoLists.filter(list => list.sessionId === sessionId);

    if (sessionTodos.length > 0) {
      output.push('', '📝 **Related TODO Lists:**');
      sessionTodos.forEach(list => {
        const completedCount = list.items.filter(item => item.status === 'done').length;
        const totalCount = list.items.length;
        const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        output.push(`   • ${list.title} - ${progress}% complete (${completedCount}/${totalCount})`);
      });
    }

    output.push('', '✅ Ready to continue where you left off!');

    return {
      content: [
        {
          type: 'text',
          text: output.join('\n')
        }
      ]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🐠 Goldfish MCP server running (short-term memory active)');
  }
}

const server = new GoldfishServer();
server.run().catch((error) => {
  console.error('Failed to run server:', error);
  process.exit(1);
});