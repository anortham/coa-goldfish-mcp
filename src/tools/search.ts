/**
 * Search tools - Fuse.js powered fuzzy search and timeline
 */

import { SearchEngine } from '../core/search.js';
import { Storage } from '../core/storage.js';
import { SessionManager } from '../core/session-manager.js';
import { SearchHistoryResponse, RecallResponse, TimelineResponse } from '../types/responses.js';
import { getLocalDateKey, formatDateName } from '../utils/date-utils.js';
import { GoldfishDisplayHandler } from '../vscode-bridge/display-handler.js';

export class SearchTools {
  private searchEngine: SearchEngine;
  private storage: Storage;
  private sessionManager: SessionManager;
  private displayHandler?: GoldfishDisplayHandler;

  constructor(storage: Storage, sessionManager: SessionManager, displayHandler?: GoldfishDisplayHandler) {
    this.storage = storage;
    this.sessionManager = sessionManager;
    this.searchEngine = new SearchEngine(storage);
    this.displayHandler = displayHandler;
  }

  /**
   * Search work history with fuzzy matching
   */
  async searchHistory(args: {
    query: string;
    since?: string;
    workspace?: string;
    scope?: 'current' | 'all';
    limit?: number;
  }) {
    const {
      query,
      since,
      workspace,
      scope = 'current',
      limit = 20
    } = args;

    try {
      const results = await this.searchEngine.searchWithHighlights(query, {
        since,
        workspace,
        scope,
        limit,
        type: 'checkpoint' // Focus on checkpoints for history
      });

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `🔍 No results found for "${query}"\n\nTry:\n• Different keywords\n• Broader time range (e.g., since: "7d")\n• Cross-workspace search (scope: "all")`
            }
          ]
        };
      }

      const output = [`🔍 Found ${results.length} results for "${query}"\n`];

      for (const result of results.slice(0, 10)) {
        const { memory, score, matches } = result;
        const age = this.formatAge(memory.timestamp);
        const workspace = memory.workspace === this.storage.getCurrentWorkspace() 
          ? '' 
          : ` [${memory.workspace}]`;

        output.push(`💾 ${age}${workspace} - Score: ${(1 - score).toFixed(2)}`);
        
        if (typeof memory.content === 'object' && memory.content && 'description' in memory.content) {
          const contentObj = memory.content as { description?: string; highlights?: string[] };
          output.push(`   ${contentObj.description}`);
          
          if (contentObj.highlights && Array.isArray(contentObj.highlights) && contentObj.highlights.length > 0) {
            output.push(`   ✨ ${contentObj.highlights.slice(0, 2).join(', ')}`);
          }
        } else {
          output.push(`   ${memory.content}`);
        }

        // Show match context (skip if it looks like raw JSON)
        if (matches.length > 0) {
          const bestMatch = matches[0];
          if (bestMatch && bestMatch.value && !bestMatch.value.startsWith('{')) {
            const snippet = this.getMatchSnippet(bestMatch.value, bestMatch.indices);
            output.push(`   🎯 "${snippet}"`);
          }
        }

        output.push('');
      }

      if (results.length > 10) {
        output.push(`... and ${results.length - 10} more results`);
      }

      // Create structured response with proper formatting
      const response: SearchHistoryResponse = {
        success: true,
        operation: 'search-history',
        formattedOutput: output.join('\n'),  // Preserve as structured field
        query,
        resultsFound: results.length,
        matches: results.slice(0, 10).map(result => ({
          memory: result.memory as Record<string, unknown>,
          score: 1 - result.score,
          snippet: result.matches.length > 0 && result.matches[0] ? 
            this.getMatchSnippet(result.matches[0].value, result.matches[0].indices) : undefined
        })),
        meta: {
          mode: 'formatted',
          lines: output.length
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)  // Serialize entire object
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Search failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  /**
   * Show timeline of recent work sessions
   */
  async timeline(args: {
    since?: string;
    workspace?: string;
    scope?: 'current' | 'all';
  }) {
    const {
      since = '7d',
      workspace,
      scope = 'current'
    } = args;

    try {
      const memories = await this.searchEngine.searchMemories({
        since,
        workspace: scope === 'all' ? undefined : workspace,
        scope,
        type: 'checkpoint',
        limit: 200
      });

      if (memories.length === 0) {
        const response: TimelineResponse = {
          success: true,
          operation: 'timeline',
          formattedOutput: `📅 No work sessions found in the last ${since}\n\nTry extending the time range or checking other workspaces.`,
          scope,
          since,
          workspace,
          totalItems: 0,
          workspacesFound: 0,
          checkpointsFound: 0,
          data: {
            byDate: {},
            byWorkspace: {}
          },
          meta: {
            mode: 'formatted',
            lines: 2
          }
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      // Group by date and workspace
      const timelineMap = new Map<string, Map<string, { count: number; highlights: string[] }>>();
      
      for (const memory of memories) {
        // Extract local date key for user-intuitive timeline grouping
        const date = getLocalDateKey(memory.timestamp);
        const ws = memory.workspace || 'unknown';
        
        if (!timelineMap.has(date)) {
          timelineMap.set(date, new Map());
        }
        
        const dayMap = timelineMap.get(date);
        if (!dayMap) continue;
        
        if (!dayMap.has(ws)) {
          dayMap.set(ws, { count: 0, highlights: [] });
        }
        
        const wsData = dayMap.get(ws)!;
        wsData.count++;
        
        // Extract highlights
        if (typeof memory.content === 'object' && memory.content && 'highlights' in memory.content) {
          const contentObj = memory.content as { highlights?: string[] };
          if (Array.isArray(contentObj.highlights)) {
            wsData.highlights.push(...contentObj.highlights);
          }
        }
      }

      // Build formatted output
      const output = [`📅 Work Timeline (${since})`];
      
      const sortedDates = Array.from(timelineMap.keys()).sort().reverse();
      
      for (const date of sortedDates) {
        const dayData = timelineMap.get(date)!;
        // Use centralized date formatting utility for consistent Today/Yesterday logic
        const dayName = formatDateName(date);
        
        output.push(`\n**${dayName}** (${date})`);
        
        for (const [ws, data] of dayData.entries()) {
          const wsDisplay = ws; // Always show actual workspace name
          output.push(`  📁 ${wsDisplay}: ${data.count} checkpoints`);
          
          // Show unique highlights
          const uniqueHighlights = [...new Set(data.highlights)];
          if (uniqueHighlights.length > 0) {
            uniqueHighlights.slice(0, 3).forEach(highlight => {
              output.push(`     ✨ ${highlight}`);
            });
            if (uniqueHighlights.length > 3) {
              output.push(`     ... and ${uniqueHighlights.length - 3} more`);
            }
          }
        }
      }

      // Send to VS Code if available
      if (this.displayHandler?.isAvailable) {
        try {
          await this.displayHandler.displayTimeline(memories, `Work Timeline (${since})`);
          console.error('📊 Timeline sent to VS Code');
        } catch (error) {
          console.error('⚠️ Failed to send timeline to VS Code:', error);
        }
      }

      // Create structured response with proper formatting
      const response: TimelineResponse = {
        success: true,
        operation: 'timeline',
        formattedOutput: output.join('\n'),  // Preserve as structured field
        scope,
        since,
        workspace,
        totalItems: memories.length,
        workspacesFound: new Set(memories.map(m => m.workspace || 'unknown')).size,
        checkpointsFound: memories.filter(m => m.type === 'checkpoint').length,
        data: {
          byDate: Object.fromEntries(Array.from(timelineMap.entries()).map(([date, wsMap]) => [
            date, 
            Object.fromEntries(wsMap.entries())
          ])),
          byWorkspace: {}  // Could organize by workspace if needed
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
            text: JSON.stringify(response, null, 2)  // Serialize entire object
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Timeline failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  /**
   * Enhanced recall with Fuse.js search
   */
  async recall(args: {
    query?: string;
    since?: string;
    workspace?: string;
    scope?: 'current' | 'all';
    type?: string;
    tags?: string[];
    limit?: number;
  }) {
    const {
      query,
      since = '7d',
      workspace,
      scope = 'current',
      type,
      tags,
      limit = 10
    } = args;

    try {
      let memories;
      
      if (query) {
        // Use fuzzy search
        memories = await this.searchEngine.searchMemories({
          query,
          since,
          workspace,
          scope,
          type,
          tags,
          limit
        });
      } else {
        // Return recent memories
        memories = await this.searchEngine.searchMemories({
          since,
          workspace,
          scope,
          type,
          tags,
          limit
        });
      }

      if (memories.length === 0) {
        const searchInfo = query ? ` matching "${query}"` : '';
        return {
          content: [
            {
              type: 'text',
              text: `🧠 No memories found${searchInfo} in the last ${since}`
            }
          ]
        };
      }

      // Build formatted output
      const output = ['🧠 Recent Memories:'];

      for (const memory of memories) {
        const age = this.formatAge(memory.timestamp);
        const typeIcon = this.getTypeIcon(memory.type);
        const workspaceInfo = memory.workspace === this.storage.getCurrentWorkspace() 
          ? '' 
          : ` [${memory.workspace}]`;

        output.push(`${typeIcon} [${memory.id.slice(-6)}] ${age}${workspaceInfo}`);
        
        if (typeof memory.content === 'object' && memory.content && 'description' in memory.content) {
          const contentObj = memory.content as { description?: string };
          output.push(`   ${contentObj.description}`);
        } else {
          const contentStr = typeof memory.content === 'string' 
            ? memory.content 
            : JSON.stringify(memory.content);
          output.push(`   ${contentStr.slice(0, 200)}${contentStr.length > 200 ? '...' : ''}`);
        }

        if (memory.tags && memory.tags.length > 0) {
          output.push(`   Tags: ${memory.tags.join(', ')}`);
        }

        output.push('');
      }

      // Create structured response with proper formatting
      const response: RecallResponse = {
        success: true,
        operation: 'recall',
        formattedOutput: output.join('\n'),  // Preserve as structured field
        memoriesFound: memories.length,
        timeRange: since,
        memories: memories.map(m => ({
          id: m.id,
          type: m.type,
          age: this.formatAge(m.timestamp),
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          workspace: m.workspace,
          tags: m.tags
        })),
        meta: {
          mode: 'formatted',
          lines: output.length
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)  // Serialize entire object
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Recall failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  /**
   * Helper methods
   */
  private formatAge(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  }


  private getTypeIcon(type: string): string {
    const icons = {
      checkpoint: '💾',
      // Deprecated: general, todo, context (now handled by TodoLists)
    };
    return icons[type as keyof typeof icons] || '📄';
  }

  private getMatchSnippet(text: string, indices: readonly [number, number][]): string {
    if (indices.length === 0) return text.slice(0, 100);
    
    const firstIndex = indices[0];
    if (!firstIndex) return text.slice(0, 100);
    
    const [start, end] = firstIndex;
    const contextStart = Math.max(0, start - 20);
    const contextEnd = Math.min(text.length, end + 20);
    
    let snippet = text.slice(contextStart, contextEnd);
    if (contextStart > 0) snippet = '...' + snippet;
    if (contextEnd < text.length) snippet = snippet + '...';
    
    return snippet;
  }

  /**
   * Get tool schemas for MCP
   */
  static getToolSchemas() {
    return [
      {
        name: 'search_history',
        description: 'PROACTIVELY search before implementing features to find related past work. ALWAYS use when user mentions past work or asks about previous solutions. Essential for avoiding duplicate effort.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (e.g., "auth bug fix", "database migration")'
            },
            since: {
              type: 'string',
              description: 'Time range (e.g., "3d", "1w", "yesterday", "2025-01-15")'
            },
            workspace: {
              type: 'string',
              description: 'Workspace name or path (e.g., "coa-goldfish-mcp" or "C:\\source\\COA Goldfish MCP"). Will be normalized automatically.'
            },
            scope: {
              type: 'string',
              enum: ['current', 'all'],
              description: 'Search scope: current workspace or all workspaces'
            },
            limit: {
              type: 'number',
              description: 'Maximum results to return (default: 20)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'timeline',
        description: 'Use DAILY to review work progress. ALWAYS run when user asks "what did I do" or mentions reporting. Essential for tracking multi-day projects and standup preparation.',
        inputSchema: {
          type: 'object',
          properties: {
            since: {
              type: 'string',
              description: 'Time range to show (default: "7d")'
            },
            workspace: {
              type: 'string',
              description: 'Workspace name or path (e.g., "coa-goldfish-mcp" or "C:\\source\\COA Goldfish MCP"). Will be normalized automatically.'
            },
            scope: {
              type: 'string',
              enum: ['current', 'all'],
              description: 'Timeline scope: current workspace or all workspaces'
            }
          }
        }
      },
      {
        name: 'recall',
        description: 'IMMEDIATELY recall context when returning to work or after breaks. Use WITHOUT query to see recent activity. Essential after /clear or session restarts. ALWAYS use to restore working memory.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (optional - if not provided, shows recent memories)'
            },
            since: {
              type: 'string',
              description: 'Time range (default: "7d")'
            },
            workspace: {
              type: 'string',
              description: 'Workspace name or path (e.g., "coa-goldfish-mcp" or "C:\\source\\COA Goldfish MCP"). Will be normalized automatically.'
            },
            scope: {
              type: 'string',
              enum: ['current', 'all'],
              description: 'Search scope (default: "current")'
            },
            type: {
              type: 'string',
              enum: ['checkpoint'],
              description: 'Content type filter - only checkpoints available (Memory objects deprecated)'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by exact tags (all tags must match)'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 10)'
            }
          }
        }
      }
    ];
  }
}