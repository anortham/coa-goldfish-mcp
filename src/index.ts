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
import { GoldfishMemory, TodoItem, TodoList, CheckpointContent } from './types/index.js';

// Tool argument interfaces
interface RememberArgs {
  content: string;
  type?: 'general' | 'todo' | 'context';
  ttlHours?: number;
  tags?: string[];
}

interface CreateTodoListArgs {
  title: string;
  items: string[];
  tags?: string[];
}

interface ViewTodosArgs {
  listId?: string;
  showCompleted?: boolean;
}

interface UpdateTodoArgs {
  listId?: string;
  itemId?: string;
  status?: 'pending' | 'active' | 'done';
  newTask?: string;
  priority?: 'low' | 'normal' | 'high';
  delete?: boolean;
}

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
            description: 'Update task status immediately as you complete work. ALWAYS mark tasks done when finished, add new tasks as discovered.',
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
                },
                delete: {
                  type: 'boolean',
                  description: 'Delete the specified item (requires itemId)'
                }
              },
              required: []
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
            return await this.checkpointTool.createCheckpoint(args as unknown as CheckpointContent);
          
          case 'search_history':
            if (!args || typeof args !== 'object' || !args.query) {
              throw new Error('search_history requires query parameter');
            }
            return await this.searchTools.searchHistory(args as { query: string; since?: string; workspace?: string; scope?: 'current' | 'all'; limit?: number });
          
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
            return await this.handleRemember(args as unknown as RememberArgs);
          
          case 'create_todo_list':
            return await this.handleCreateTodoList(args as unknown as CreateTodoListArgs);
          
          case 'view_todos':
            return await this.handleViewTodos(args as unknown as ViewTodosArgs);
          
          case 'update_todo':
            return await this.handleUpdateTodo(args as unknown as UpdateTodoArgs);
          
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
  private async handleRemember(args: RememberArgs) {
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
  private async handleCreateTodoList(args: CreateTodoListArgs) {
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

  private async handleViewTodos(args: ViewTodosArgs) {
    const { listId } = args;

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

    // Focus on the most recently updated list (most likely to be active)
    const sortedLists = todoLists.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const currentList = sortedLists[0];
    
    if (!currentList) {
      return {
        content: [
          {
            type: 'text',
            text: '📝 No active TODO lists found. Use create_todo_list to start tracking your work!'
          }
        ]
      };
    }
    
    // Sort items by ID number (1,2,3,4,5,6,7) regardless of status
    const listItems = [...currentList.items].sort((a, b) => {
      return parseInt(a.id) - parseInt(b.id);
    });

    // Build formatted output like ProjectKnowledge
    const output = [];
    
    const completedCount = listItems.filter(i => i.status === 'done').length;
    const activeCount = listItems.filter(i => i.status === 'active').length;
    const percentage = listItems.length > 0 ? Math.round((completedCount / listItems.length) * 100) : 0;
    
    // Build formatted todo list
    output.push(`📋 ${currentList.title}`);
    output.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    output.push(`📊 Progress: ${percentage}% (${completedCount}/${listItems.length}) • Active: ${activeCount}`);
    output.push(``);
    
    // Each todo item
    for (const item of listItems) {
      const icon = item.status === 'done' ? '✅' : item.status === 'active' ? '🔄' : '⏳';
      const taskText = item.task.length > 80 ? item.task.slice(0, 80) + '...' : item.task;
      output.push(`${icon} [${item.id}] ${taskText}`);
    }
    
    // Create structured response following ProjectKnowledge pattern
    const response = {
      success: true,
      operation: 'view-todos',
      formattedOutput: output.join('\n'),  // Preserve multi-line formatting
      data: {
        listId: currentList.id,
        title: currentList.title,
        totalTasks: listItems.length,
        completedTasks: completedCount,
        activeTasks: activeCount,
        percentage: percentage,
        items: listItems.map(item => ({
          id: item.id,
          task: item.task,
          status: item.status,
          priority: item.priority
        }))
      },
      meta: {
        mode: 'formatted',
        lines: output.length
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)  // Serialize like ProjectKnowledge
        }
      ]
    };
  }

  private async handleUpdateTodo(args: UpdateTodoArgs) {
    const { listId, itemId, status, newTask, priority, delete: deleteItem } = args;

    const todoLists = await this.storage.loadAllTodoLists();
    
    let todoList: TodoList | undefined;
    
    if (listId) {
      // Find by explicit list ID
      todoList = todoLists.find(list => list.id === listId || list.id.endsWith(listId));
      
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
    } else {
      // No listId provided - use most recently updated list
      todoList = todoLists.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      
      if (!todoList) {
        return {
          content: [
            {
              type: 'text',
              text: `❓ No TODO lists found. Create one first with create_todo_list.`
            }
          ]
        };
      }
    }

    if (itemId) {
      // Find the item first
      const item = todoList.items.find((i: TodoItem) => i.id === itemId);
      
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

      // Handle delete operation
      if (deleteItem) {
        const taskText = item.task.length > 40 ? item.task.slice(0, 40) + '...' : item.task;
        todoList.items = todoList.items.filter((i: TodoItem) => i.id !== itemId);
        todoList.updatedAt = new Date();
        await this.storage.saveTodoList(todoList);

        return {
          content: [
            {
              type: 'text',
              text: `🗑️ Deleted [${itemId}] ${taskText}`
            }
          ]
        };
      }

      const oldStatus = item.status;
      const oldTask = item.task;
      
      // Update task description if provided
      if (newTask) {
        item.task = newTask;
      }
      
      // Update status if provided
      if (status) {
        item.status = status;
      }
      
      item.updatedAt = new Date();
      
      if (priority) {
        item.priority = priority;
      }
      
      todoList.updatedAt = new Date();
      await this.storage.saveTodoList(todoList);

      const changes = [];
      if (newTask && newTask !== oldTask) changes.push(`task: "${newTask}"`);
      if (status && status !== oldStatus) changes.push(`status: ${status}`);
      if (priority) changes.push(`priority: ${priority}`);
      
      const statusIcon: Record<string, string> = {
        pending: '⏳',
        active: '🔄',
        done: '✅'
      };
      const icon = statusIcon[item.status] || '❓';

      return {
        content: [
          {
            type: 'text',
            text: `${icon} Updated [${itemId}] ${changes.join(', ')}`
          }
        ]
      };
    }

    if (newTask) {
      // Add new task (only if no itemId provided)
      const newItem: TodoItem = {
        id: (todoList.items.length + 1).toString(),
        task: newTask,
        status: 'pending',
        priority: priority,
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