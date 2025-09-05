/**
 * Unified Checkpoint Tool for Goldfish MCP
 * 
 * Consolidates checkpoint creation, session restoration, search, and timeline browsing
 * Actions: save, restore, search, timeline
 */

import { Storage } from '../core/storage.js';
import { SessionManager } from '../core/session-manager.js';
import { SearchEngine } from '../core/search.js';
import { GoldfishMemory, CheckpointContent, ToolResponse } from '../types/index.js';
import { normalizeWorkspaceName, createErrorResponse } from '../core/workspace-utils.js';
import { buildToolContent, OutputMode } from '../core/output-utils.js';

export interface UnifiedCheckpointArgs {
  action?: 'save' | 'restore' | 'search' | 'timeline';
  
  // For save action (checkpoint creation)
  description?: string;
  highlights?: string[];
  activeFiles?: string[];
  gitBranch?: string;
  workContext?: string;
  sessionId?: string;
  global?: boolean;
  
  // For restore action (session restoration)
  checkpointId?: string;
  depth?: 'minimal' | 'highlights' | 'full';
  mode?: 'latest' | 'specific' | 'search';
  
  // For search action
  query?: string;
  since?: string;
  limit?: number;
  
  // For timeline action
  range?: string;      // "24h", "7d", "30d"
  format?: 'compact' | 'detailed';
  
  // Common options
  workspace?: string;
  outputFormat?: OutputMode;
}

/**
 * Smart action inference for checkpoint tool
 */
function inferCheckpointAction(args: UnifiedCheckpointArgs): 'save' | 'restore' | 'search' | 'timeline' {
  // If we have description, it's a save (checkpoint creation)
  if (args.description) {
    return 'save';
  }
  
  // If we have query, it's a search
  if (args.query) {
    return 'search';
  }
  
  // If we have range, it's a timeline
  if (args.range) {
    return 'timeline';
  }
  
  // If we have checkpointId or depth specified, it's a restore
  if (args.checkpointId || args.depth || args.mode) {
    return 'restore';
  }
  
  // Default to restore (most common operation)
  return 'restore';
}

export class UnifiedCheckpointTool {
  private storage: Storage;
  private sessionManager: SessionManager;
  private searchEngine: SearchEngine;

  constructor(storage: Storage, sessionManager: SessionManager) {
    this.storage = storage;
    this.sessionManager = sessionManager;
    this.searchEngine = new SearchEngine(storage);
  }

  /**
   * Handle save action - create checkpoint
   */
  private async handleSave(args: UnifiedCheckpointArgs): Promise<ToolResponse> {
    if (!args.description) {
      return {
        content: [
          {
            type: 'text',
            text: '📝 Please provide a description for your checkpoint. Example: "Completed user authentication feature" or "Fixed database connection issue"'
          }
        ]
      };
    }

    const {
      description,
      highlights = [],
      activeFiles = [],
      gitBranch,
      workContext,
      sessionId,
      workspace,
      global = false
    } = args;

    const targetWorkspace = global ? 'global' : 
      (workspace ? normalizeWorkspaceName(workspace) : this.storage.getCurrentWorkspace());

    // Auto-detect git info if not provided
    let detectedBranch = gitBranch;
    if (!detectedBranch) {
      try {
        // Try to get git branch from storage's git detection
        detectedBranch = 'main'; // Fallback, could be enhanced with actual git detection
      } catch {
        // Ignore git detection errors
      }
    }

    // Create memory object
    const checkpointMemory: GoldfishMemory = {
      id: this.storage.generateChronologicalFilename().replace('.json', ''),
      timestamp: new Date(),
      workspace: targetWorkspace,
      sessionId: sessionId || 'default',
      type: 'checkpoint',
      content: {
        description,
        highlights,
        activeFiles,
        gitBranch: detectedBranch,
        workContext,
        sessionId: sessionId || 'default'
      } as CheckpointContent,
      ttlHours: global ? 168 : 72, // Global checkpoints last 1 week, others 3 days
      tags: ['checkpoint'],
      metadata: {
        checkpointType: 'manual',
        workspaceType: global ? 'global' : 'workspace',
        highlightCount: highlights.length,
        fileCount: activeFiles.length
      }
    };

    await this.storage.saveMemory(checkpointMemory);

    // Auto-link to active plans and todos if detected
    await this.autoLinkToActivePlansAndTodos(checkpointMemory, args);

    return buildToolContent(
      `✅ Checkpoint saved: ${description}`,
      'checkpoint',
      {
        checkpointId: checkpointMemory.id,
        sessionId: checkpointMemory.sessionId,
        workspace: targetWorkspace,
        highlights: highlights.length,
        activeFiles: activeFiles.length
      },
      args.outputFormat
    );
  }

  /**
   * Handle restore action - restore from checkpoint/session
   */
  private async handleRestore(args: UnifiedCheckpointArgs): Promise<ToolResponse> {
    const {
      checkpointId,
      depth = 'highlights',
      mode = 'latest',
      workspace
    } = args;

    try {
      let targetMemories: GoldfishMemory[] = [];
      
      if (mode === 'specific' && checkpointId) {
        // Restore specific checkpoint
        const memory = await this.storage.loadMemory(checkpointId, workspace, 'checkpoint');
        if (memory) {
          targetMemories = [memory];
        }
      } else if (mode === 'search' && args.query) {
        // Search for checkpoints
        targetMemories = await this.searchEngine.searchMemories({
          query: args.query,
          type: 'checkpoint',
          workspace,
          scope: 'current',
          limit: args.limit || 5
        });
      } else {
        // Get latest checkpoint (default mode)
        targetMemories = await this.searchEngine.searchMemories({
          type: 'checkpoint',
          workspace,
          scope: 'current',
          limit: depth === 'full' ? 10 : 1
        });
      }

      if (targetMemories.length === 0) {
        const message = checkpointId 
          ? `❓ Checkpoint "${checkpointId}" not found`
          : '❓ No recent checkpoints found. Create your first checkpoint to establish session state!';
        
        return {
          content: [
            {
              type: 'text',
              text: message
            }
          ]
        };
      }

      // Format output based on depth
      const output = [
        '═══════════════════════════════════════════════════════════',
        '📍 RESUMING FROM CHECKPOINT',
        '═══════════════════════════════════════════════════════════',
        ''
      ];

      if (depth === 'minimal') {
        // Just the latest checkpoint
        const latest = targetMemories[0];
        if (latest) {
          output.push(this.formatCheckpoint(latest, true));
        }
        
      } else if (depth === 'highlights') {
        // Latest checkpoint + session highlights
        const latest = targetMemories[0];
        if (latest) {
          output.push(this.formatCheckpoint(latest, true));
          
          // Get accumulated session highlights from multiple checkpoints
          const sessionId = latest.sessionId;
          if (sessionId && targetMemories.length > 1) {
            const sessionHighlights = this.extractSessionHighlights(targetMemories);
            if (sessionHighlights.length > 0) {
              output.push('');
              output.push('🌟 **Session Highlights:**');
              sessionHighlights.forEach(highlight => {
                output.push(`   ✨ ${highlight}`);
              });
            }
          }
        }
        
      } else if (depth === 'full') {
        // All session checkpoints
        output.push('📊 **Full Session Context:**');
        output.push('');
        
        targetMemories.forEach((memory, index) => {
          output.push(`**${index + 1}.** ${this.formatCheckpoint(memory, false)}`);
          if (index < targetMemories.length - 1) {
            output.push('');
          }
        });
      }

      output.push('');
      output.push('═══════════════════════════════════════════════════════════');
      output.push('✅ Session restored successfully');
      output.push(`📝 ${targetMemories.length} checkpoint${targetMemories.length > 1 ? 's' : ''} loaded`);
      output.push('🚀 Ready to continue. What would you like to work on?');
      output.push('═══════════════════════════════════════════════════════════');

      return buildToolContent(
        'session_restored',
        output.join('\n'),
        {
          checkpointsLoaded: targetMemories.length,
          depth,
          mode,
          workspace
        },
        args.outputFormat
      );

    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Unknown error',
        'restore_session',
        args.outputFormat
      );
    }
  }

  /**
   * Handle search action - search through checkpoints
   */
  private async handleSearch(args: UnifiedCheckpointArgs): Promise<ToolResponse> {
    if (!args.query) {
      return {
        content: [
          {
            type: 'text',
            text: '🔍 Please provide a search query. Examples: "authentication", "bug fix", "database migration", or "completed today"'
          }
        ]
      };
    }

    try {
      const results = await this.searchEngine.searchMemories({
        query: args.query,
        type: 'checkpoint',
        since: args.since,
        workspace: args.workspace,
        scope: args.workspace ? 'all' : 'current',
        limit: args.limit || 10
      });

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `🔍 No checkpoints found matching "${args.query}"`
            }
          ]
        };
      }

      const output = [
        `🔍 Found ${results.length} checkpoint${results.length > 1 ? 's' : ''} matching "${args.query}"`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ''
      ];

      results.forEach((memory, index) => {
        const content = memory.content as CheckpointContent;
        const timeAgo = this.formatTimeAgo(memory.timestamp);
        
        output.push(`**${index + 1}.** ${content.description}`);
        output.push(`    📅 ${timeAgo} • ID: ${memory.id}`);
        
        if (content.highlights && content.highlights.length > 0) {
          output.push(`    ✨ ${content.highlights.length} highlight${content.highlights.length > 1 ? 's' : ''}`);
        }
        
        if (index < results.length - 1) {
          output.push('');
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: output.join('\n')
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error searching checkpoints: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }

  /**
   * Handle timeline action - browse checkpoints chronologically
   */
  private async handleTimeline(args: UnifiedCheckpointArgs): Promise<ToolResponse> {
    const range = args.range || '7d';
    const format = args.format || 'compact';
    
    try {
      // Parse time range
      const since = this.parseTimeRange(range);
      
      const results = await this.searchEngine.searchMemories({
        type: 'checkpoint',
        since: since,
        workspace: args.workspace,
        scope: args.workspace ? 'all' : 'current',
        limit: 50
      });

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `📅 No checkpoints found in the last ${range}`
            }
          ]
        };
      }

      // Group by date
      const groupedByDate = this.groupCheckpointsByDate(results);
      
      const output = [
        `📅 Checkpoint Timeline - Last ${range}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Found ${results.length} checkpoint${results.length > 1 ? 's' : ''}`,
        ''
      ];

      for (const [date, checkpoints] of Object.entries(groupedByDate)) {
        const dateLabel = this.formatDateLabel(date);
        output.push(`## ${dateLabel}`);
        output.push('');

        if (checkpoints) {
          checkpoints.forEach((memory, index) => {
            const content = memory.content as CheckpointContent;
            const time = memory.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            if (format === 'detailed') {
              output.push(`### ${time} - ${content.description}`);
              if (content.highlights && content.highlights.length > 0) {
                content.highlights.forEach(highlight => {
                  output.push(`• ${highlight}`);
                });
              }
              if (content.activeFiles && content.activeFiles.length > 0) {
                output.push(`📁 Files: ${content.activeFiles.join(', ')}`);
              }
            } else {
              output.push(`${time} - ${content.description}`);
            }
            
            if (index < checkpoints.length - 1) {
              output.push('');
            }
          });
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

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error generating timeline: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }

  /**
   * Main unified checkpoint handler
   */
  async handleUnifiedCheckpoint(args: UnifiedCheckpointArgs): Promise<ToolResponse> {
    try {
      // Determine action - use provided action or infer from arguments
      const action = args.action || inferCheckpointAction(args);
      
      // Route to appropriate handler based on action
      switch (action) {
        case 'save':
          return this.handleSave(args);
        case 'restore':
          return this.handleRestore(args);
        case 'search':
          return this.handleSearch(args);
        case 'timeline':
          return this.handleTimeline(args);
        default:
          return {
            content: [
              {
                type: 'text',
                text: `❓ Unknown action: ${action}. Supported actions: save, restore, search, timeline`
              }
            ]
          };
      }
      
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error in checkpoint tool: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }

  /**
   * Auto-link checkpoint to active plans and todos
   */
  private async autoLinkToActivePlansAndTodos(checkpoint: GoldfishMemory, args: UnifiedCheckpointArgs): Promise<void> {
    try {
      const workspace = checkpoint.workspace;
      
      // Look for active plans in the same workspace
      const planMemories = await this.storage.loadAllMemories(workspace);
      const activePlans = planMemories
        .filter(m => m.type === 'plan')
        .map(m => m.content as any) // Plan interface
        .filter(plan => plan.status === 'active');
      
      // Look for active TODO lists
      const todoLists = await this.storage.loadAllTodoLists(workspace);
      const activeTodoLists = todoLists.filter(list => 
        list.items.some(item => item.status !== 'done') && 
        list.status !== 'completed'
      );
      
      // Update plans to include this checkpoint
      for (const plan of activePlans) {
        if (plan.relatedCheckpoints && !plan.relatedCheckpoints.includes(checkpoint.id)) {
          plan.relatedCheckpoints.push(checkpoint.id);
          plan.updatedAt = new Date();
          
          // Save updated plan back as memory
          const updatedPlanMemory = {
            id: plan.id,
            timestamp: plan.updatedAt,
            workspace: plan.workspace,
            sessionId: plan.sessionId,
            type: 'plan' as const,
            content: plan,
            ttlHours: plan.ttlHours || 0,
            tags: plan.tags,
            metadata: {
              planTitle: plan.title,
              planStatus: plan.status,
              planCategory: plan.category,
              linkedCheckpoint: checkpoint.id
            }
          };
          
          await this.storage.saveMemory(updatedPlanMemory);
        }
      }
      
      // Update checkpoint metadata to reference active plans and todos
      const linkedPlans = activePlans.map(p => p.id);
      const linkedTodos = activeTodoLists.map(t => t.id);
      
      if (linkedPlans.length > 0 || linkedTodos.length > 0) {
        checkpoint.metadata = {
          ...checkpoint.metadata,
          linkedPlans,
          linkedTodos,
          autoLinked: true
        };
        
        // Re-save checkpoint with updated metadata
        await this.storage.saveMemory(checkpoint);
      }
      
    } catch (error) {
      // Don't fail the checkpoint creation if auto-linking fails
      console.warn('Auto-linking checkpoint failed:', error);
    }
  }

  // Helper methods
  private formatCheckpoint(memory: GoldfishMemory, includeHeader: boolean): string {
    const content = memory.content as CheckpointContent;
    const output = [];

    if (includeHeader) {
      output.push(`📝 **Last Work:** ${content.description}`);
      output.push(`🎯 **Context:** ${content.workContext || 'No additional context'}`);
      output.push(`🌿 **Branch:** ${content.gitBranch || 'unknown'}`);
      if (content.activeFiles && content.activeFiles.length > 0) {
        output.push(`📁 **Files:** ${content.activeFiles.join(', ')}`);
      }
      if (content.highlights && content.highlights.length > 0) {
        output.push(`✨ **Highlights:** ${content.highlights.join(', ')}`);
      }
    } else {
      output.push(content.description);
      if (content.workContext) {
        output.push(`   Context: ${content.workContext}`);
      }
      if (content.highlights && content.highlights.length > 0) {
        output.push(`   Highlights: ${content.highlights.join(', ')}`);
      }
    }

    return output.join('\n');
  }

  private extractSessionHighlights(memories: GoldfishMemory[]): string[] {
    const allHighlights: string[] = [];
    
    for (const memory of memories) {
      const content = memory.content as CheckpointContent;
      if (content.highlights) {
        allHighlights.push(...content.highlights);
      }
    }
    
    // Remove duplicates and return up to 10 most recent
    return Array.from(new Set(allHighlights)).slice(0, 10);
  }

  private formatTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  }

  private parseTimeRange(range: string): string {
    const now = new Date();
    let targetTime: Date;

    switch (range.toLowerCase()) {
      case '1h':
      case '1 hour':
        targetTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
      case '1d':
      case '1 day':
        targetTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
      case '1w':
      case '1 week':
        targetTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
      case '1m':
      case '1 month':
        targetTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        // Default to 7 days
        targetTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return targetTime.toISOString();
  }

  private groupCheckpointsByDate(memories: GoldfishMemory[]): Record<string, GoldfishMemory[]> {
    const groups: Record<string, GoldfishMemory[]> = {};
    
    for (const memory of memories) {
      const dateKey = memory.timestamp.toISOString().split('T')[0];
      if (dateKey) {
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(memory);
      }
    }
    
    // Sort each group by time
    for (const dateKey of Object.keys(groups)) {
      groups[dateKey]!.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    
    return groups;
  }

  private formatDateLabel(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (dateString === today) {
      return 'Today';
    } else if (dateString === yesterday) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  }

  /**
   * Get tool schema for unified checkpoint tool
   */
  static getToolSchema() {
    return {
      name: 'checkpoint',
      description: 'Save progress or restore session context. Use after completing tasks, before breaks, when resuming work, or asking "what was I working on?"',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['save', 'restore', 'search', 'timeline'],
            description: 'Action to perform. Defaults to "restore" (most common). Use "save" with description to create checkpoint.'
          },
          
          // Save action properties
          description: {
            type: 'string',
            description: 'Checkpoint description (required for save action)'
          },
          highlights: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key achievements or decisions to remember'
          },
          activeFiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files currently being worked on'
          },
          gitBranch: {
            type: 'string',
            description: 'Current git branch (auto-detected if not provided)'
          },
          workContext: {
            type: 'string',
            description: 'What you\'re working on or next steps'
          },
          sessionId: {
            type: 'string',
            description: 'Session identifier (auto-generated if not provided)'
          },
          global: {
            type: 'boolean',
            description: 'Store as global checkpoint (visible across all workspaces)',
            default: false
          },
          
          // Restore action properties
          checkpointId: {
            type: 'string',
            description: 'Specific checkpoint ID to restore'
          },
          depth: {
            type: 'string',
            enum: ['minimal', 'highlights', 'full'],
            description: 'Restoration depth',
            default: 'highlights'
          },
          mode: {
            type: 'string',
            enum: ['latest', 'specific', 'search'],
            description: 'Restoration mode',
            default: 'latest'
          },
          
          // Search action properties
          query: {
            type: 'string',
            description: 'Search query for finding specific checkpoints'
          },
          since: {
            type: 'string',
            description: 'Time range for search (e.g., "24h", "1week")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10
          },
          
          // Timeline action properties
          range: {
            type: 'string',
            description: 'Time range for timeline: "1h", "24h", "7d", "30d"',
            default: '7d'
          },
          format: {
            type: 'string',
            enum: ['compact', 'detailed'],
            description: 'Timeline display format',
            default: 'compact'
          },
          
          // Common properties
          workspace: {
            type: 'string',
            description: 'Target workspace (path or name)'
          },
          outputFormat: {
            type: 'string',
            enum: ['plain', 'emoji', 'json', 'dual'],
            description: 'Output format override'
          }
        }
      }
    };
  }
}