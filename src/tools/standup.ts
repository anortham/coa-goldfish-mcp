/**
 * Standup Tool - Intelligent aggregation across checkpoints, todos, and plans
 * Provides comprehensive work summaries with relationship mapping
 */

import { Storage } from '../core/storage.js';
import { SearchEngine } from '../core/search.js';
import { GoldfishMemory, Plan } from '../types/index.js';
import { buildToolContent, OutputMode } from '../core/output-utils.js';
import { IndexManager } from '../core/index-manager.js';

export interface StandupArgs {
  action?: 'daily' | 'weekly' | 'project' | 'custom';
  since?: string;
  workspace?: string;
  scope?: 'current' | 'all';
  format?: OutputMode;
  outputStyle?: 'meeting' | 'written' | 'metrics' | 'executive';
  includeMetrics?: boolean;
  includePlans?: boolean;
  includeTodos?: boolean;
  includeCheckpoints?: boolean;
  includeRelationships?: boolean;
}

interface WorkSummary {
  timeRange: string;
  workspace: string;
  totalCheckpoints: number;
  totalTodos: number;
  totalPlans: number;
  completedTasks: number;
  activePlans: Plan[];
  recentCheckpoints: GoldfishMemory[];
  pendingTodos: any[];
  relationships: RelationshipMap[];
  highlights: string[];
  nextSteps: string[];
  blockers: string[];
}

interface RelationshipMap {
  planId?: string;
  planTitle?: string;
  linkedTodos: string[];
  linkedCheckpoints: string[];
  completionPercentage?: number;
}

export class StandupTool {
  private storage: Storage;
  private searchEngine: SearchEngine;

  constructor(storage: Storage) {
    this.storage = storage;
    this.searchEngine = new SearchEngine(storage);
  }

  /**
   * Generate intelligent standup report
   */
  async generateStandup(args: StandupArgs = {}): Promise<any> {
    const {
      action = 'daily',
      since,
      workspace,
      scope = 'current',
      format,
      outputStyle = 'meeting',
      includeMetrics = true,
      includePlans = true,
      includeTodos = true,
      includeCheckpoints = true,
      includeRelationships = true
    } = args;

    try {
      // Determine time range based on action
      const timeRange = since || this.getDefaultTimeRange(action);
      
      // Collect data from all three sources
      const summary = await this.aggregateWorkData({
        timeRange,
        workspace,
        scope,
        includePlans,
        includeTodos,
        includeCheckpoints,
        includeRelationships
      });

      // Format output based on style
      const formatted = this.formatStandupOutput(summary, outputStyle, includeMetrics);
      
      const data = {
        action,
        timeRange: summary.timeRange,
        workspace: summary.workspace,
        outputStyle,
        metrics: {
          checkpoints: summary.totalCheckpoints,
          todos: summary.totalTodos,
          plans: summary.totalPlans,
          completed: summary.completedTasks
        },
        relationships: summary.relationships.length,
        highlights: summary.highlights.length
      } as const;

      // Record that a standup was generated
      try {
        const indexManager = new IndexManager(this.storage, workspace);
        await indexManager.recordStandupGeneration();
      } catch (error) {
        console.error('Failed to record standup generation in index:', error);
        // Don't fail the standup if index update fails
      }

      return buildToolContent('standup', formatted, data as any, format);

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Standup generation failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  /**
   * Aggregate work data from all sources
   */
  private async aggregateWorkData(options: {
    timeRange: string;
    workspace?: string;
    scope: 'current' | 'all';
    includePlans: boolean;
    includeTodos: boolean;
    includeCheckpoints: boolean;
    includeRelationships: boolean;
  }): Promise<WorkSummary> {
    const { timeRange, workspace, scope, includePlans, includeTodos, includeCheckpoints, includeRelationships } = options;

    // Initialize summary
    const summary: WorkSummary = {
      timeRange,
      workspace: workspace || this.storage.getCurrentWorkspace(),
      totalCheckpoints: 0,
      totalTodos: 0,
      totalPlans: 0,
      completedTasks: 0,
      activePlans: [],
      recentCheckpoints: [],
      pendingTodos: [],
      relationships: [],
      highlights: [],
      nextSteps: [],
      blockers: []
    };

    // Collect checkpoints
    if (includeCheckpoints) {
      const checkpoints = await this.searchEngine.searchMemories({
        type: 'checkpoint',
        since: timeRange,
        workspace,
        scope,
        limit: 50
      });
      summary.totalCheckpoints = checkpoints.length;
      summary.recentCheckpoints = checkpoints.slice(0, 10);
      
      // Extract highlights from checkpoints
      for (const checkpoint of checkpoints) {
        if (typeof checkpoint.content === 'object' && checkpoint.content) {
          const content = checkpoint.content as { highlights?: string[]; description?: string };
          if (Array.isArray(content.highlights)) {
            summary.highlights.push(...content.highlights);
          }
          if (content.description) {
            // Simple heuristic to identify next steps
            if (content.description.toLowerCase().includes('next') || 
                content.description.toLowerCase().includes('todo') ||
                content.description.toLowerCase().includes('need to')) {
              summary.nextSteps.push(content.description);
            }
          }
        }
      }
    }

    // Collect TODOs
    if (includeTodos) {
      const todos = await this.searchEngine.searchMemories({
        type: 'todo',
        since: timeRange,
        workspace,
        scope,
        limit: 100
      });
      summary.totalTodos = todos.length;
      
      // Process TODO lists to count completed vs pending
      for (const todoMemory of todos) {
        if (typeof todoMemory.content === 'object' && todoMemory.content) {
          const content = todoMemory.content as { items?: any[]; status?: string };
          if (Array.isArray(content.items)) {
            const completed = content.items.filter((item: any) => item.status === 'done').length;
            const pending = content.items.filter((item: any) => item.status === 'pending' || item.status === 'active').length;
            
            summary.completedTasks += completed;
            if (pending > 0) {
              summary.pendingTodos.push({
                id: todoMemory.id,
                title: (todoMemory.content as any).title,
                pendingCount: pending,
                items: content.items.filter((item: any) => item.status !== 'done')
              });
            }
          }
        }
      }
    }

    // Collect Plans
    if (includePlans) {
      const plans = await this.searchEngine.searchMemories({
        type: 'plan',
        since: timeRange,
        workspace,
        scope,
        limit: 50
      });
      summary.totalPlans = plans.length;
      
      // Process active plans
      for (const planMemory of plans) {
        if (typeof planMemory.content === 'object' && planMemory.content) {
          const plan = planMemory.content as Plan;
          if (plan.status === 'active' || plan.status === 'draft') {
            summary.activePlans.push(plan);
          }
        }
      }
    }

    // Build relationship mappings
    if (includeRelationships && (includePlans || includeCheckpoints || includeTodos)) {
      summary.relationships = await this.buildRelationshipMappings(summary);
    }

    // Deduplicate highlights and limit
    summary.highlights = [...new Set(summary.highlights)].slice(0, 10);
    summary.nextSteps = [...new Set(summary.nextSteps)].slice(0, 5);

    return summary;
  }

  /**
   * Build relationship mappings between plans, todos, and checkpoints
   */
  private async buildRelationshipMappings(summary: WorkSummary): Promise<RelationshipMap[]> {
    const relationships: RelationshipMap[] = [];

    for (const plan of summary.activePlans) {
      const relationship: RelationshipMap = {
        planId: plan.id,
        planTitle: plan.title,
        linkedTodos: [],
        linkedCheckpoints: [],
        completionPercentage: plan.completionPercentage || 0
      };

      // Find linked TODOs (based on generatedTodos or mentions)
      if (Array.isArray(plan.generatedTodos)) {
        relationship.linkedTodos.push(...plan.generatedTodos);
      }

      // Find linked checkpoints (based on relatedCheckpoints or recent activity)
      if (Array.isArray(plan.relatedCheckpoints)) {
        relationship.linkedCheckpoints.push(...plan.relatedCheckpoints);
      }

      // Look for mentions in recent checkpoints
      for (const checkpoint of summary.recentCheckpoints) {
        if (typeof checkpoint.content === 'object' && checkpoint.content) {
          const content = checkpoint.content as { description?: string; planId?: string };
          if (content.planId === plan.id || 
              (content.description && content.description.includes(plan.title))) {
            if (!relationship.linkedCheckpoints.includes(checkpoint.id)) {
              relationship.linkedCheckpoints.push(checkpoint.id);
            }
          }
        }
      }

      relationships.push(relationship);
    }

    return relationships;
  }

  /**
   * Format standup output based on style
   */
  private formatStandupOutput(summary: WorkSummary, style: string, includeMetrics: boolean): string {
    const output: string[] = [];

    switch (style) {
      case 'meeting':
        return this.formatMeetingStyle(summary, includeMetrics);
      case 'written':
        return this.formatWrittenStyle(summary, includeMetrics);
      case 'metrics':
        return this.formatMetricsStyle(summary);
      case 'executive':
        return this.formatExecutiveStyle(summary, includeMetrics);
      default:
        return this.formatMeetingStyle(summary, includeMetrics);
    }
  }

  private formatMeetingStyle(summary: WorkSummary, includeMetrics: boolean): string {
    const output = [
      `🏃‍♂️ **Daily Standup** (${summary.timeRange})`,
      `📍 Workspace: ${summary.workspace}`,
      ''
    ];

    if (includeMetrics) {
      output.push('📊 **Quick Stats:**');
      output.push(`   • ${summary.totalCheckpoints} checkpoints recorded`);
      output.push(`   • ${summary.completedTasks} tasks completed`);
      output.push(`   • ${summary.activePlans.length} active plans`);
      output.push(`   • ${summary.pendingTodos.length} TODO lists with pending items`);
      output.push('');
    }

    // What I did (from checkpoints)
    if (summary.recentCheckpoints.length > 0) {
      output.push('✅ **What I accomplished:**');
      summary.recentCheckpoints.slice(0, 5).forEach(checkpoint => {
        if (typeof checkpoint.content === 'object' && checkpoint.content) {
          const content = checkpoint.content as { description?: string };
          if (content.description) {
            output.push(`   • ${content.description}`);
          }
        }
      });
      output.push('');
    }

    // Key highlights
    if (summary.highlights.length > 0) {
      output.push('⭐ **Key highlights:**');
      summary.highlights.slice(0, 5).forEach(highlight => {
        output.push(`   • ${highlight}`);
      });
      output.push('');
    }

    // What I'm working on (from active plans)
    if (summary.activePlans.length > 0) {
      output.push('🎯 **Currently working on:**');
      summary.activePlans.slice(0, 3).forEach(plan => {
        output.push(`   • ${plan.title} (${plan.completionPercentage || 0}% complete)`);
        if (plan.description) {
          output.push(`     └ ${plan.description}`);
        }
      });
      output.push('');
    }

    // Next steps (from TODO lists and plans)
    if (summary.pendingTodos.length > 0 || summary.nextSteps.length > 0) {
      output.push('🚀 **Next steps:**');
      
      // From explicit next steps
      summary.nextSteps.slice(0, 3).forEach(step => {
        output.push(`   • ${step}`);
      });
      
      // From pending TODOs
      summary.pendingTodos.slice(0, 2).forEach(todoList => {
        output.push(`   • Continue "${todoList.title}" (${todoList.pendingCount} items pending)`);
      });
      output.push('');
    }

    // Blockers (simple heuristic)
    if (summary.blockers.length > 0) {
      output.push('🚫 **Blockers:**');
      summary.blockers.forEach(blocker => {
        output.push(`   • ${blocker}`);
      });
      output.push('');
    }

    // Relationship insights
    if (summary.relationships.length > 0) {
      output.push('🔗 **Project relationships:**');
      summary.relationships.slice(0, 3).forEach(rel => {
        output.push(`   • "${rel.planTitle}": ${rel.linkedCheckpoints.length} checkpoints, ${rel.linkedTodos.length} TODOs`);
      });
    }

    return output.join('\n');
  }

  private formatWrittenStyle(summary: WorkSummary, includeMetrics: boolean): string {
    const output = [
      `📝 **Work Summary** - ${summary.timeRange}`,
      `Workspace: ${summary.workspace}`,
      ''
    ];

    if (includeMetrics) {
      output.push(`During ${summary.timeRange}, I completed ${summary.completedTasks} tasks across ${summary.totalCheckpoints} work sessions. Currently managing ${summary.activePlans.length} active plans with ${summary.pendingTodos.length} TODO lists requiring attention.`);
      output.push('');
    }

    if (summary.highlights.length > 0) {
      output.push('**Key Accomplishments:**');
      output.push(summary.highlights.slice(0, 8).map(h => `• ${h}`).join('\n'));
      output.push('');
    }

    if (summary.activePlans.length > 0) {
      output.push('**Active Projects:**');
      summary.activePlans.forEach(plan => {
        output.push(`• **${plan.title}** (${plan.completionPercentage || 0}% complete)`);
        if (plan.description) {
          output.push(`  ${plan.description}`);
        }
      });
      output.push('');
    }

    if (summary.pendingTodos.length > 0) {
      output.push('**Pending Tasks:**');
      summary.pendingTodos.slice(0, 5).forEach(todoList => {
        output.push(`• ${todoList.title} (${todoList.pendingCount} items)`);
      });
    }

    return output.join('\n');
  }

  private formatMetricsStyle(summary: WorkSummary): string {
    const output = [
      `📈 **Metrics Dashboard** - ${summary.timeRange}`,
      `Workspace: ${summary.workspace}`,
      '',
      '**Productivity Metrics:**',
      `├─ Checkpoints recorded: ${summary.totalCheckpoints}`,
      `├─ Tasks completed: ${summary.completedTasks}`,
      `├─ Active plans: ${summary.activePlans.length}`,
      `└─ Pending TODO items: ${summary.pendingTodos.reduce((sum, todo) => sum + todo.pendingCount, 0)}`,
      '',
      '**Completion Rates:**'
    ];

    // Calculate completion rates for active plans
    if (summary.activePlans.length > 0) {
      summary.activePlans.forEach(plan => {
        const completion = plan.completionPercentage || 0;
        const bar = '█'.repeat(Math.floor(completion / 10)) + '░'.repeat(10 - Math.floor(completion / 10));
        output.push(`├─ ${plan.title}: ${completion}% [${bar}]`);
      });
    }

    output.push('');
    output.push('**Relationship Mapping:**');
    output.push(`└─ Active plan-todo-checkpoint links: ${summary.relationships.length}`);

    return output.join('\n');
  }

  private formatExecutiveStyle(summary: WorkSummary, includeMetrics: boolean): string {
    const output = [
      `🎯 **Executive Summary** - ${summary.timeRange}`,
      `${summary.workspace} Workspace`,
      ''
    ];

    // High-level impact
    if (includeMetrics) {
      const completionRate = summary.totalTodos > 0 ? 
        Math.round((summary.completedTasks / summary.totalTodos) * 100) : 0;
      
      output.push(`**Impact:** Delivered ${summary.completedTasks} completed tasks with ${completionRate}% task completion rate across ${summary.activePlans.length} strategic initiatives.`);
      output.push('');
    }

    // Strategic focus
    if (summary.activePlans.length > 0) {
      output.push('**Strategic Focus:**');
      summary.activePlans.slice(0, 3).forEach((plan, index) => {
        output.push(`${index + 1}. ${plan.title} - ${plan.completionPercentage || 0}% complete`);
      });
      output.push('');
    }

    // Key wins
    if (summary.highlights.length > 0) {
      output.push('**Key Wins:**');
      summary.highlights.slice(0, 5).forEach((highlight, index) => {
        output.push(`${index + 1}. ${highlight}`);
      });
      output.push('');
    }

    // Forward outlook
    if (summary.nextSteps.length > 0 || summary.pendingTodos.length > 0) {
      output.push('**Forward Outlook:**');
      if (summary.nextSteps.length > 0) {
        output.push(`Next priorities: ${summary.nextSteps.slice(0, 2).join(', ')}`);
      }
      if (summary.pendingTodos.length > 0) {
        const totalPending = summary.pendingTodos.reduce((sum, todo) => sum + todo.pendingCount, 0);
        output.push(`${totalPending} tasks queued across ${summary.pendingTodos.length} workstreams`);
      }
    }

    return output.join('\n');
  }

  /**
   * Get default time range based on action
   */
  private getDefaultTimeRange(action: string): string {
    switch (action) {
      case 'daily':
        return '1d';
      case 'weekly':
        return '7d';
      case 'project':
        return '30d';
      default:
        return '1d';
    }
  }

  /**
   * Get tool schema for MCP
   */
  static getToolSchema() {
    return {
      name: 'standup',
      description: 'Daily work summaries and progress reports. Shows what you accomplished, current tasks, blockers. Perfect for meetings and "what did I do?" questions.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['daily', 'weekly', 'project', 'custom'],
            description: 'Type of standup: daily (1 day), weekly (7 days), project (30 days), custom (use since parameter)',
            default: 'daily'
          },
          since: {
            type: 'string',
            description: 'Time range (e.g., "1d", "3d", "1w", "2025-01-15"). Overrides action default.'
          },
          workspace: {
            type: 'string',
            description: 'Workspace name or path. Defaults to current workspace.'
          },
          scope: {
            type: 'string',
            enum: ['current', 'all'],
            description: 'Search scope: current workspace or all workspaces (default: current)',
            default: 'current'
          },
          format: {
            type: 'string',
            enum: ['plain', 'emoji', 'json', 'dual'],
            description: 'Output format override (defaults to env GOLDFISH_OUTPUT_MODE or dual)'
          },
          outputStyle: {
            type: 'string',
            enum: ['meeting', 'written', 'metrics', 'executive'],
            description: 'Output style: meeting (standup format), written (narrative), metrics (dashboard), executive (high-level)',
            default: 'meeting'
          },
          includeMetrics: {
            type: 'boolean',
            description: 'Include productivity metrics and statistics (default: true)',
            default: true
          },
          includePlans: {
            type: 'boolean',
            description: 'Include active plans and project status (default: true)',
            default: true
          },
          includeTodos: {
            type: 'boolean',
            description: 'Include TODO lists and task progress (default: true)',
            default: true
          },
          includeCheckpoints: {
            type: 'boolean',
            description: 'Include recent checkpoints and accomplishments (default: true)',
            default: true
          },
          includeRelationships: {
            type: 'boolean',
            description: 'Include relationship mapping between plans, TODOs, and checkpoints (default: true)',
            default: true
          }
        }
      }
    };
  }
}

/**
 * Handle standup tool calls with smart action inference
 */
export async function handleStandup(storage: Storage, args: StandupArgs = {}): Promise<any> {
  const standupTool = new StandupTool(storage);
  
  // Smart action inference
  if (!args.action) {
    args.action = 'daily'; // Default to daily standup
  }
  
  return await standupTool.generateStandup(args);
}

/**
 * Get standup tool schema for MCP registration
 */
export function getStandupToolSchema() {
  return StandupTool.getToolSchema();
}