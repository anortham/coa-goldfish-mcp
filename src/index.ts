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
import { initializeVSCodeDisplay } from './vscode-bridge/simple-loader.js';
import { GoldfishDisplayHandler } from './vscode-bridge/display-handler.js';
// Removed: handleRemember, getRememberToolSchema - Memory objects deprecated in favor of TodoLists
import { handleCreateTodoList, getCreateTodoListToolSchema } from './tools/create-todo-list.js';
import { handleViewTodos, getViewTodosToolSchema } from './tools/view-todos.js';
import { handleUpdateTodo, getUpdateTodoToolSchema } from './tools/update-todo.js';
import { handleListWorkspaces, getListWorkspacesToolSchema } from './tools/list-workspaces.js';

// Type imports
import { CheckpointContent } from './types/index.js';

class GoldfishMCPServer {
  private server: Server;
  private storage: Storage;
  private sessionManager: SessionManager;
  private checkpointTool: CheckpointTool;
  private searchTools: SearchTools;
  private sessionTools: SessionTools;
  private displayHandler: GoldfishDisplayHandler | null = null;

  constructor() {
    this.server = new Server(
      {
        name: '@coa/goldfish-mcp',
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
    
    // Initialize tool modules (will be updated after VS Code display handler is initialized)
    this.checkpointTool = new CheckpointTool(this.storage, this.sessionManager);
    this.searchTools = new SearchTools(this.storage, this.sessionManager); // Will be updated with display handler
    this.sessionTools = new SessionTools(this.storage, this.sessionManager);

    this.setupHandlers();
    this.initializeOptionalFeatures();
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
          
          // Individual tools (TODO management only - Memory objects deprecated)
          getCreateTodoListToolSchema(),
          getViewTodosToolSchema(),
          getUpdateTodoToolSchema(),
          getListWorkspacesToolSchema()
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'checkpoint': {
            if (!args || typeof args !== 'object' || !args.description) {
              throw new Error('checkpoint requires description parameter');
            }
            return await this.checkpointTool.createCheckpoint(args as unknown as CheckpointContent);
          }
          
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
          
          // Individual tools (TODO management only)
          case 'create_todo_list':
            return await handleCreateTodoList(this.storage, args as any);
          
          case 'view_todos':
            return await handleViewTodos(this.storage, args as any);
          
          case 'update_todo':
            return await handleUpdateTodo(this.storage, args as any);
          
          case 'list_workspaces':
            return await handleListWorkspaces(this.storage);
          
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
   * Initialize optional features like VS Code bridge
   */
  private async initializeOptionalFeatures() {
    try {
      // Try to initialize VS Code display handler
      this.displayHandler = await initializeVSCodeDisplay();
      
      // Reinitialize SearchTools with display handler
      this.searchTools = new SearchTools(this.storage, this.sessionManager, this.displayHandler);
      
      if (this.displayHandler.isAvailable) {
        console.error('✨ VS Code bridge visualization enabled');
      } else {
        console.error('ℹ️ VS Code bridge not connected (optional feature)');
      }
    } catch (error) {
      console.error('⚠️ Failed to initialize optional features:', error);
      // Continue without optional features
      this.displayHandler = null;
      // SearchTools already initialized without display handler
    }
  }

  /**
   * Start the server
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('COA Goldfish MCP Server 2.0 started');
    
    // Log feature status
    if (this.displayHandler?.isAvailable) {
      console.error('  ✅ VS Code visualizations: Available');
    } else {
      console.error('  ⚪ VS Code visualizations: Not connected');
    }
  }
}

// Start the server
const server = new GoldfishMCPServer();
server.start().catch(console.error);