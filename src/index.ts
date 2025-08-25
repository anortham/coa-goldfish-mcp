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
import { handleRemember, getRememberToolSchema } from './tools/remember.js';
import { handleCreateTodoList, getCreateTodoListToolSchema } from './tools/create-todo-list.js';
import { handleViewTodos, getViewTodosToolSchema } from './tools/view-todos.js';
import { handleUpdateTodo, getUpdateTodoToolSchema } from './tools/update-todo.js';

// Type imports
import { CheckpointContent } from './types/index.js';

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
          
          // Individual tools (memory and TODO management)
          getRememberToolSchema(),
          getCreateTodoListToolSchema(),
          getViewTodosToolSchema(),
          getUpdateTodoToolSchema()
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
          
          // Individual tools (memory and TODO management)
          case 'remember':
            return await handleRemember(this.storage, args as any);
          
          case 'create_todo_list':
            return await handleCreateTodoList(this.storage, args as any);
          
          case 'view_todos':
            return await handleViewTodos(this.storage, args as any);
          
          case 'update_todo':
            return await handleUpdateTodo(this.storage, args as any);
          
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