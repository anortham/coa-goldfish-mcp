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
import { UnifiedCheckpointTool } from './tools/checkpoint-unified.js';
import { SearchTools } from './tools/search.js';
import { initializeVSCodeDisplay } from './vscode-bridge/simple-loader.js';
import { GoldfishDisplayHandler } from './vscode-bridge/display-handler.js';
// Unified TODO tool (consolidates create-todo-list, view-todos, update-todo)
import { handleTodo, getTodoToolSchema } from './tools/todo.js';
// Plan tool for strategic planning and design decisions
import { handlePlan, getPlanToolSchema } from './tools/plan.js';
// Standup tool for intelligent work aggregation and reporting
import { handleStandup, getStandupToolSchema } from './tools/standup.js';
import { handleListWorkspaces, getListWorkspacesToolSchema } from './tools/list-workspaces.js';

// Type imports
import { CheckpointContent } from './types/index.js';

class GoldfishMCPServer {
  private server: Server;
  private storage: Storage;
  private sessionManager: SessionManager;
  private unifiedCheckpointTool: UnifiedCheckpointTool;
  private searchTools: SearchTools;
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
    this.unifiedCheckpointTool = new UnifiedCheckpointTool(this.storage, this.sessionManager);
    this.searchTools = new SearchTools(this.storage, this.sessionManager); // Will be updated with display handler

    this.setupHandlers();
    this.initializeOptionalFeatures();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Unified checkpoint tool (replaces checkpoint, restore_session, and search functionality)
          UnifiedCheckpointTool.getToolSchema(),
          
          // Search and timeline tools
          ...SearchTools.getToolSchemas(),
          
          // Unified TODO tool (replaces create_todo_list, view_todos, update_todo)
          getTodoToolSchema(),
          
          // Plan tool for strategic planning and design decisions
          getPlanToolSchema(),
          
          // Standup tool for intelligent work aggregation and reporting
          getStandupToolSchema(),
          
          getListWorkspacesToolSchema()
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'checkpoint':
            return await this.unifiedCheckpointTool.handleUnifiedCheckpoint(args as any);
          
          case 'search_history':
            if (!args || typeof args !== 'object' || !args.query) {
              throw new Error('search_history requires query parameter');
            }
            return await this.searchTools.searchHistory(args as { query: string; since?: string; workspace?: string; scope?: 'current' | 'all'; limit?: number });
          
          case 'timeline':
            return await this.searchTools.timeline(args || {});
          
          case 'recall':
            return await this.searchTools.recall(args || {});
          
          // Unified TODO tool (handles create, update, view, complete, quick actions)
          case 'todo':
            return await handleTodo(this.storage, args as any);
          
          // Plan tool (handles save, restore, update, complete, abandon, list, generate-todos)
          case 'plan':
            return await handlePlan(this.storage, args as any);
          
          // Standup tool (handles daily, weekly, project, custom reports with relationship mapping)
          case 'standup':
            return await handleStandup(this.storage, args as any);
          
          case 'list_workspaces':
            return await handleListWorkspaces(this.storage, args as any);
          
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
