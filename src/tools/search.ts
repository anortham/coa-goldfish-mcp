/**
 * Search tools - Fuse.js powered fuzzy search and timeline
 */

import { SearchEngine } from '../core/search.js';
import { Storage } from '../core/storage.js';
import { SessionManager } from '../core/session-manager.js';

export class SearchTools {
  private searchEngine: SearchEngine;
  private storage: Storage;
  private sessionManager: SessionManager;

  constructor(storage: Storage, sessionManager: SessionManager) {
    this.storage = storage;
    this.sessionManager = sessionManager;
    this.searchEngine = new SearchEngine(storage);
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
        
        if (typeof memory.content === 'object' && memory.content.description) {
          output.push(`   ${memory.content.description}`);
          
          if (memory.content.highlights && memory.content.highlights.length > 0) {
            output.push(`   ✨ ${memory.content.highlights.slice(0, 2).join(', ')}`);
          }
        } else {
          output.push(`   ${memory.content}`);
        }

        // Show match context
        if (matches.length > 0) {
          const bestMatch = matches[0];
          if (bestMatch && bestMatch.value) {
            const snippet = this.getMatchSnippet(bestMatch.value, bestMatch.indices);
            output.push(`   🎯 "${snippet}"`);
          }
        }

        output.push('');
      }

      if (results.length > 10) {
        output.push(`... and ${results.length - 10} more results`);
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
        workspace,
        scope,
        type: 'checkpoint',
        limit: 200
      });

      if (memories.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `📅 No work sessions found in the last ${since}\n\nTry extending the time range or checking other workspaces.`
            }
          ]
        };
      }

      // Group by date and workspace
      const timelineMap = new Map<string, Map<string, { count: number; highlights: string[] }>>();
      
      for (const memory of memories) {
        const date = memory.timestamp.toISOString().split('T')[0] || 'unknown';
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
        if (typeof memory.content === 'object' && memory.content.highlights) {
          wsData.highlights.push(...memory.content.highlights);
        }
      }

      // Format timeline
      const output = [`📅 Work Timeline (${since})\n`];
      
      const sortedDates = Array.from(timelineMap.keys()).sort().reverse();
      
      for (const date of sortedDates) {
        const dayData = timelineMap.get(date)!;
        const dayName = this.formatDateName(new Date(date));
        
        output.push(`**${dayName}** (${date})`);
        
        for (const [ws, data] of dayData.entries()) {
          const wsDisplay = ws === this.storage.getCurrentWorkspace() ? 'current' : ws;
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
    limit?: number;
  }) {
    const {
      query,
      since = '7d',
      workspace,
      scope = 'current',
      type,
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
          limit
        });
      } else {
        // Return recent memories
        memories = await this.searchEngine.searchMemories({
          since,
          workspace,
          scope,
          type,
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

      const output = ['🧠 Recent Memories:\n'];

      for (const memory of memories) {
        const age = this.formatAge(memory.timestamp);
        const typeIcon = this.getTypeIcon(memory.type);
        const workspaceInfo = memory.workspace === this.storage.getCurrentWorkspace() 
          ? '' 
          : ` [${memory.workspace}]`;

        output.push(`${typeIcon} [${memory.id.slice(-6)}] ${age}${workspaceInfo}`);
        
        if (typeof memory.content === 'object' && memory.content.description) {
          output.push(`   ${memory.content.description}`);
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

  private formatDateName(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
  }

  private getTypeIcon(type: string): string {
    const icons = {
      checkpoint: '💾',
      general: '💭',
      todo: '📝',
      context: '🧭'
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
        description: 'Search work history with fuzzy matching. Perfect for "Did we fix the auth bug last week?" type questions. Searches across checkpoints and finds relevant work.',
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
              description: 'Specific workspace to search (optional)'
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
        description: 'Show timeline of work sessions. Perfect for standups and understanding recent activity across projects. Shows checkpoints grouped by date and workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            since: {
              type: 'string',
              description: 'Time range to show (default: "7d")'
            },
            workspace: {
              type: 'string',
              description: 'Specific workspace (optional)'
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
        description: 'Enhanced memory recall with fuzzy search support. Can search or just show recent memories. Perfect for "what did I work on yesterday?" questions.',
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
              description: 'Specific workspace (optional)'
            },
            scope: {
              type: 'string',
              enum: ['current', 'all'],
              description: 'Search scope (default: "current")'
            },
            type: {
              type: 'string',
              enum: ['general', 'todo', 'checkpoint', 'context'],
              description: 'Memory type filter (optional)'
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