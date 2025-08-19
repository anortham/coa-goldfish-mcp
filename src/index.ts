#!/usr/bin/env node

/**
 * COA Goldfish MCP Server 2.0
 * 
 * Event-driven work memory with session management and fuzzy search.
 * Named "Goldfish" for its focused, short-term memory that helps AI agents
 * maintain context across sessions without overwhelming long-term storage.
 * 
 * Key Features:
 * - Session-based checkpoint storage with date organization
 * - Fuse.js powered fuzzy search across work history
 * - Progressive session restoration (minimal/highlights/full)
 * - Cross-workspace standup queries
 * - Auto-expiration with 72-hour sliding window
 * - Bulletproof session continuity after /clear
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';

// Core modules
import { Storage } from './core/storage.js';
import { SessionManager } from './core/session-manager.js';

// Tool modules
import { CheckpointTool } from './tools/checkpoint.js';
import { SearchTools } from './tools/search.js';
import { SessionTools } from './tools/session.js';

// Legacy tools (TODO management)
import { GoldfishMemory, TodoItem, TodoList } from './types/index.js';

class GoldfishMCPServer {
  private server: Server;
  private storage: Storage;
  private sessionManager: SessionManager;
  private checkpointTool: CheckpointTool;
  private searchTools: SearchTools;
  private sessionTools: SessionTools;

  constructor() {
    this.server = new Server(
      {
        name: 'coa-goldfish-mcp',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize core components
    this.storage = new Storage();
    this.sessionManager = new SessionManager(this.storage.getCurrentWorkspace(), this.storage);
    
    // Initialize tool modules
    this.checkpointTool = new CheckpointTool(this.storage, this.sessionManager);
    this.searchTools = new SearchTools(this.storage, this.sessionManager);
    this.sessionTools = new SessionTools(this.storage, this.sessionManager);

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Core checkpoint tool
          CheckpointTool.getToolSchema(),
          
          // Search and timeline tools
          ...SearchTools.getToolSchemas(),
          
          // Session management tools
          ...SessionTools.getToolSchemas(),
          
          // Legacy tools (TODO management)
          {
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
                  description: 'Type of memory (default: general)'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional tags for categorization'
                },
                ttlHours: {
                  type: 'number',
                  description: 'Hours to keep this memory (default: 24)'
                }
              },
              required: ['content']
            }
          },
          {
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
          },
          {
            name: 'view_todos',
            description: 'View active TODO lists and their progress. Perfect for checking current status.',
            inputSchema: {
              type: 'object',
              properties: {
                listId: {
                  type: 'string',
                  description: 'Specific list ID to view (optional)'
                },
                showCompleted: {
                  type: 'boolean',
                  description: 'Include completed items (default: true)'
                }
              }
            }
          },
          {
            name: 'update_todo',
            description: 'Update task status or add new tasks to existing lists. Mark tasks done as you work.',
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
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'checkpoint':
            if (!args || typeof args !== 'object' || !args.description) {
              throw new Error('checkpoint requires description parameter');
            }
            return await this.checkpointTool.createCheckpoint(args as any);
          
          case 'search_history':
            if (!args || typeof args !== 'object' || !args.query) {
              throw new Error('search_history requires query parameter');
            }
            return await this.searchTools.searchHistory(args as any);
          
          case 'timeline':
            return await this.searchTools.timeline(args || {});
          
          case 'recall':
            return await this.searchTools.recall(args || {});
          
          case 'restore_session':
            return await this.sessionTools.restoreSession(args || {});
          
          case 'summarize_session':
            return await this.sessionTools.summarizeSession(args || {});
          
          // Legacy tools
          case 'remember':
            return await this.handleRemember(args);
          
          case 'create_todo_list':
            return await this.handleCreateTodoList(args);
          
          case 'view_todos':
            return await this.handleViewTodos(args);
          
          case 'update_todo':
            return await this.handleUpdateTodo(args);
          
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

  /**
   * Legacy remember tool - simple note storage
   */
  private async handleRemember(args: any) {
    const { 
      content, 
      type = 'general', 
      ttlHours = 24, 
      tags 
    } = args;

    const memory: GoldfishMemory = {
      id: this.storage.generateChronologicalFilename().replace('.json', ''),
      timestamp: new Date(),
      workspace: this.storage.getCurrentWorkspace(),
      type,
      content,
      ttlHours,
      tags,
      metadata: { simple: true }
    };

    await this.storage.saveMemory(memory);

    return {
      content: [
        {
          type: 'text',
          text: `💭 Remembered: "${content}" (ID: ${memory.id}, expires in ${ttlHours}h)`
        }
      ]
    };
  }

  /**
   * Legacy TODO management
   */
  private async handleCreateTodoList(args: any) {
    const { title, items, tags } = args;
    
    const todoList: TodoList = {
      id: this.storage.generateChronologicalFilename().replace('.json', ''),
      title,
      workspace: this.storage.getCurrentWorkspace(),
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

    await this.storage.saveTodoList(todoList);

    return {
      content: [
        {
          type: 'text',
          text: `📝 Created TODO list "${title}" with ${items.length} items (ID: ${todoList.id})`
        }
      ]
    };
  }

  private async handleViewTodos(args: any) {
    const { listId, showCompleted = true } = args;

    if (listId) {
      // View specific list - need to implement loadTodoList method
      return {
        content: [
          {
            type: 'text',
            text: '⚠️ Specific list viewing not yet implemented in 2.0'
          }
        ]
      };
    }

    const todoLists = await this.storage.loadAllTodoLists();
    
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

    for (const list of todoLists.slice(0, 5)) {
      const filteredItems = showCompleted 
        ? list.items 
        : list.items.filter(item => item.status !== 'done');

      if (filteredItems.length === 0 && !showCompleted) continue;

      const progress = list.items.filter(i => i.status === 'done').length;
      const total = list.items.length;
      const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
      const active = list.items.filter(i => i.status === 'active').length;

      output.push(`**${list.title}** [${list.id.slice(-6)}] - ${this.formatAge(list.updatedAt)}`);
      output.push(`   Progress: ${percentage}% (${progress}/${total}) | Active: ${active}`);
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

    const todoLists = await this.storage.loadAllTodoLists();
    const todoList = todoLists.find(list => list.id === listId || list.id.endsWith(listId));

    if (!todoList) {
      return {
        content: [
          {
            type: 'text',
            text: `❓ TODO list "${listId}" not found`
          }
        ]
      };
    }

    if (newTask) {
      // Add new task
      const newItem: TodoItem = {
        id: (todoList.items.length + 1).toString(),
        task: newTask,
        status: 'pending',
        priority: priority as any,
        createdAt: new Date()
      };
      
      todoList.items.push(newItem);
      todoList.updatedAt = new Date();
      await this.storage.saveTodoList(todoList);

      return {
        content: [
          {
            type: 'text',
            text: `➕ Added "${newTask}" to "${todoList.title}"`
          }
        ]
      };
    }

    if (itemId && status) {
      // Update existing task
      const item = todoList.items.find(i => i.id === itemId);
      
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
      item.status = status as any;
      item.updatedAt = new Date();
      
      if (priority) {
        item.priority = priority as any;
      }
      
      todoList.updatedAt = new Date();
      await this.storage.saveTodoList(todoList);

      const statusIcon: Record<string, string> = {
        pending: '⏳',
        active: '🔄',
        done: '✅'
      };
      const icon = statusIcon[status] || '❓';

      return {
        content: [
          {
            type: 'text',
            text: `${icon} Updated "${item.task}" from ${oldStatus} to ${status}`
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

  /**
   * Helper to format age
   */
  private formatAge(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      return 'just now';
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  }

  /**
   * Start the server
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('COA Goldfish MCP Server 2.0 started');
  }
}

// Start the server
const server = new GoldfishMCPServer();
server.start().catch(console.error);