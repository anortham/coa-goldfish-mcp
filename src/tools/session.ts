/**
 * Session management tools - restore and summarize sessions
 */

import { Storage } from '../core/storage.js';
import { SessionManager } from '../core/session-manager.js';
import { SearchEngine } from '../core/search.js';
import { GoldfishMemory } from '../types/index.js';
import { SessionRestoreResponse, SessionSummaryResponse } from '../types/responses.js';

export class SessionTools {
  private storage: Storage;
  private sessionManager: SessionManager;
  private searchEngine: SearchEngine;

  constructor(storage: Storage, sessionManager: SessionManager) {
    this.storage = storage;
    this.sessionManager = sessionManager;
    this.searchEngine = new SearchEngine(storage);
  }

  /**
   * Restore session with progressive depth
   */
  async restoreSession(args: {
    sessionId?: string;
    depth?: 'minimal' | 'highlights' | 'full';
    workspace?: string;
  } = {}) {
    const {
      sessionId,
      depth = 'highlights',
      workspace
    } = args;

    try {
      let targetMemories: GoldfishMemory[] = [];
      if (sessionId) {
        // Restore specific session
        targetMemories = await this.getSessionMemories(sessionId, workspace);
      } else {
        // Get latest checkpoint
        const recentMemories = await this.searchEngine.searchMemories({
          type: 'checkpoint',
          workspace,
          scope: 'current',
          limit: 1
        });
        
        if (recentMemories.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '❓ No recent checkpoints found. Create your first checkpoint to establish session state!'
              }
            ]
          };
        }

        targetMemories = recentMemories;
        // Using latest checkpoint
      }

      if (targetMemories.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `❓ No session found${sessionId ? ` with ID "${sessionId}"` : ''}. It may have expired or was never saved.`
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
          
          // Get session highlights
          if (typeof latest.content === 'object' && latest.content && 'highlights' in latest.content) {
            const contentObj = latest.content as { highlights?: string[] };
            if (Array.isArray(contentObj.highlights) && contentObj.highlights.length > 0) {
              output.push('\n🌟 **Session Highlights:**');
              contentObj.highlights.slice(-5).forEach((highlight: string) => {
                output.push(`   ✨ ${highlight}`);
              });
            }
          }
        }
        
      } else if (depth === 'full') {
        // All checkpoints from session
        output.push(`📊 Found ${targetMemories.length} checkpoints:\n`);
        
        targetMemories.slice(0, 10).forEach((memory, index) => {
          output.push(`**Checkpoint ${index + 1}** (${this.formatAge(memory.timestamp)})`);
          output.push(this.formatCheckpoint(memory, false));
          output.push('');
        });
        
        if (targetMemories.length > 10) {
          output.push(`... and ${targetMemories.length - 10} more checkpoints`);
        }
      }

      output.push('');
      output.push('═══════════════════════════════════════════════════════════');
      output.push('✅ Session restored successfully');
      output.push('📝 Ready to continue where you left off!');
      output.push('🚀 What would you like to work on?');
      output.push('═══════════════════════════════════════════════════════════');

      // Create structured response with proper formatting
      const response: SessionRestoreResponse = {
        success: true,
        operation: 'session-restore',
        formattedOutput: output.join('\n'),  // Preserve as structured field
        sessionId: sessionId || 'latest',
        depth,
        checkpointsFound: targetMemories.length,
        highlightsFound: targetMemories.filter((m: GoldfishMemory) => 
          typeof m.content === 'object' && m.content && 'highlights' in m.content &&
          Array.isArray((m.content as { highlights?: string[] }).highlights) &&
          (m.content as { highlights?: string[] }).highlights!.length > 0
        ).length,
        workspace,
        data: targetMemories.slice(0, 3) as unknown as Record<string, unknown>, // Sample data for debugging
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
            text: `❌ Session restoration failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  /**
   * Summarize session using AI-like condensation
   */
  async summarizeSession(args: {
    sessionId?: string;
    depth?: 'highlights' | 'full';
    workspace?: string;
    since?: string;
  }) {
    const {
      sessionId,
      depth = 'highlights',
      workspace,
      since = '1d'
    } = args;

    try {
      let memories: GoldfishMemory[] = [];
      let summaryTitle = '';

      if (sessionId) {
        memories = await this.getSessionMemories(sessionId, workspace);
        summaryTitle = `Session ${sessionId} Summary`;
      } else {
        // Summarize recent work
        memories = await this.searchEngine.searchMemories({
          type: 'checkpoint',
          since,
          workspace,
          scope: 'current',
          limit: 50
        });
        summaryTitle = `Work Summary (${since})`;
      }

      if (memories.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '📝 No checkpoints found for summary. Create checkpoints as you work to enable session summaries.'
            }
          ]
        };
      }

      // Extract key information
      const workAreas = new Set<string>();
      const allHighlights: string[] = [];
      const gitBranches = new Set<string>();
      const activeFiles = new Set<string>();
      
      for (const memory of memories) {
        if (typeof memory.content === 'object' && memory.content) {
          const content = memory.content as { 
            description?: string; 
            workContext?: string; 
            gitBranch?: string; 
            activeFiles?: string[]; 
            highlights?: string[] 
          };
          
          // Collect work areas from descriptions
          if (content.description) {
            const workArea = this.extractWorkArea(content.description);
            if (workArea) workAreas.add(workArea);
          }
          
          // Collect highlights
          if (Array.isArray(content.highlights)) {
            allHighlights.push(...content.highlights);
          }
          
          // Collect git info
          if (content.gitBranch) {
            gitBranches.add(content.gitBranch);
          }
          
          // Collect files
          if (Array.isArray(content.activeFiles)) {
            content.activeFiles.forEach((file: string) => activeFiles.add(file));
          }
        }
      }

      // Build summary
      const output = [`📝 **${summaryTitle}**\n`];
      
      output.push(`📊 **Overview:**`);
      output.push(`   • ${memories.length} checkpoints`);
      output.push(`   • ${workAreas.size} work areas`);
      if (gitBranches.size > 0) {
        output.push(`   • Branches: ${Array.from(gitBranches).join(', ')}`);
      }
      output.push('');

      // Work areas
      if (workAreas.size > 0) {
        output.push('🎯 **Work Areas:**');
        Array.from(workAreas).forEach(area => {
          output.push(`   • ${area}`);
        });
        output.push('');
      }

      // Key highlights
      const uniqueHighlights = [...new Set(allHighlights)];
      if (uniqueHighlights.length > 0) {
        output.push('✨ **Key Accomplishments:**');
        uniqueHighlights.slice(-8).forEach(highlight => {
          output.push(`   • ${highlight}`);
        });
        output.push('');
      }

      // Recent progress (last few checkpoints)
      if (depth === 'full' && memories.length > 1) {
        output.push('🔄 **Recent Progress:**');
        memories.slice(0, 5).forEach(memory => {
          const age = this.formatAge(memory.timestamp);
          if (typeof memory.content === 'object' && memory.content && 'description' in memory.content) {
            const contentObj = memory.content as { description?: string };
            output.push(`   • ${age}: ${contentObj.description}`);
          }
        });
        output.push('');
      }

      // Active files
      if (activeFiles.size > 0) {
        output.push('📁 **Files Involved:**');
        Array.from(activeFiles).slice(0, 10).forEach(file => {
          output.push(`   • ${file}`);
        });
        if (activeFiles.size > 10) {
          output.push(`   ... and ${activeFiles.size - 10} more files`);
        }
      }

      // Create structured response with proper formatting
      const response: SessionSummaryResponse = {
        success: true,
        operation: 'session-summary',
        formattedOutput: output.join('\n'),  // Preserve as structured field
        sessionId: sessionId || undefined,
        timeRange: since,
        workspace,
        achievements: uniqueHighlights.slice(-5),
        nextSteps: [],  // Could be populated from TODOs if available
        data: {
          checkpoints: memories.length,
          workAreas: Array.from(workAreas),
          branches: Array.from(gitBranches),
          files: Array.from(activeFiles).slice(0, 10)
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
            text: `❌ Summary failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  /**
   * Get memories for a specific session
   */
  private async getSessionMemories(sessionId: string, workspace?: string): Promise<GoldfishMemory[]> {
    const memories = await this.searchEngine.searchMemories({
      workspace,
      scope: workspace ? 'current' : 'all',
      limit: 100
    });

    return memories.filter(m => 
      m.sessionId === sessionId || 
      m.id === sessionId || 
      m.id.startsWith(sessionId) ||
      (m.metadata?.sessionId === sessionId)
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Format a checkpoint for display
   */
  private formatCheckpoint(memory: GoldfishMemory, detailed: boolean): string {
    const output: string[] = [];
    
    if (typeof memory.content === 'object' && memory.content) {
      const content = memory.content as { 
        description?: string; 
        workContext?: string; 
        gitBranch?: string; 
        activeFiles?: string[]; 
        highlights?: string[] 
      };
      
      output.push(`📝 **Description:** ${content.description || 'No description'}`);
      
      if (detailed) {
        if (content.workContext) {
          output.push(`🎯 **Context:** ${content.workContext}`);
        }
        
        if (content.gitBranch) {
          output.push(`🌿 **Branch:** ${content.gitBranch}`);
        }
        
        if (Array.isArray(content.activeFiles) && content.activeFiles.length > 0) {
          output.push(`📁 **Files:** ${content.activeFiles.slice(0, 5).join(', ')}`);
        }
      }
    } else {
      output.push(`📝 ${memory.content}`);
    }

    return output.join('\n');
  }

  /**
   * Extract work area from description
   */
  private extractWorkArea(description: string): string | null {
    // Simple heuristics to extract work areas
    const patterns = [
      /(?:working on|implementing|fixing|updating|refactoring)\s+(.+?)(?:\s|$)/i,
      /(?:^|\s)(auth|api|database|ui|test|deploy|bug|feature)(?:\s|$)/i
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  /**
   * Format age for display
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
   * Get tool schemas for MCP
   */
  static getToolSchemas() {
    return [
      {
        name: 'restore_session',
        description: 'Restore session state after /clear or break. Default shows last checkpoint + highlights. Use depth: "full" for complete session replay when returning after days away.',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Specific session ID to restore (optional - defaults to latest)'
            },
            depth: {
              type: 'string',
              enum: ['minimal', 'highlights', 'full'],
              description: 'Restoration depth: minimal=last checkpoint only, highlights=last+key points, full=entire session'
            },
            workspace: {
              type: 'string',
              description: 'Workspace to restore from (optional)'
            }
          }
        }
      },
      {
        name: 'summarize_session',
        description: 'Create AI-condensed summary of session or recent work. Perfect for "what did I accomplish today?" or understanding long sessions.',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Specific session to summarize (optional)'
            },
            depth: {
              type: 'string',
              enum: ['highlights', 'full'],
              description: 'Summary depth: highlights=key points only, full=detailed timeline'
            },
            workspace: {
              type: 'string',
              description: 'Workspace to summarize (optional)'
            },
            since: {
              type: 'string',
              description: 'Time range for summary when no sessionId (default: "1d")'
            }
          }
        }
      }
    ];
  }
}