/**
 * Display Handler for VS Code Bridge
 * 
 * Sends structured Goldfish data to VS Code for visualization
 */

import { GoldfishMemory } from '../types/index.js';

export interface VSCodeBridgeClient {
  isConnected: boolean;
  sendVisualization(type: string, data: any, hint?: any): Promise<void>;
  display(data: any, options?: any): Promise<void>;
}

/**
 * Handles sending Goldfish data to VS Code for display
 */
export class GoldfishDisplayHandler {
  private bridge: VSCodeBridgeClient | null = null;
  
  constructor(bridge?: VSCodeBridgeClient) {
    this.bridge = bridge || null;
  }
  
  /**
   * Check if VS Code bridge is available
   */
  get isAvailable(): boolean {
    return this.bridge !== null && this.bridge.isConnected;
  }
  
  /**
   * Display timeline in VS Code
   */
  async displayTimeline(memories: GoldfishMemory[], title?: string): Promise<void> {
    if (!this.isAvailable) return;
    
    try {
      // Transform memories to timeline format expected by VS Code bridge
      const timelineData = {
        items: memories.map(memory => ({
          id: memory.id,
          timestamp: memory.timestamp,
          title: memory.content,
          type: memory.type,
          tags: memory.tags || [],
          metadata: memory.metadata,
          workspace: memory.workspace
        })),
        totalCount: memories.length,
        timeRange: memories.length > 0 ? {
          start: memories[memories.length - 1]?.timestamp || '',
          end: memories[0]?.timestamp || ''
        } : null
      };
      
      await this.bridge!.sendVisualization(
        'timeline',
        timelineData,
        {
          interactive: true,
          consolidateTabs: true,
          title: title || 'Goldfish Timeline'
        }
      );
    } catch (error) {
      console.warn('Failed to display timeline in VS Code:', error);
    }
  }
  
  /**
   * Display memory statistics as chart
   */
  async displayStats(memories: GoldfishMemory[]): Promise<void> {
    if (!this.isAvailable) return;
    
    try {
      // Calculate statistics
      const typeDistribution = this.calculateTypeDistribution(memories);
      const workspaceDistribution = this.calculateWorkspaceDistribution(memories);
      
      // Show type distribution as data grid
      await this.bridge!.sendVisualization(
        'data-grid',
        {
          columns: ['Type', 'Count'],
          rows: Object.entries(typeDistribution).map(([type, count]) => [type, count])
        },
        {
          title: 'Memory Types Distribution',
          interactive: true
        }
      );
      
      // Show workspace distribution as data grid
      if (Object.keys(workspaceDistribution).length > 1) {
        await this.bridge!.sendVisualization(
          'data-grid',
          {
            columns: ['Workspace', 'Count'],
            rows: Object.entries(workspaceDistribution).map(([ws, count]) => [ws, count])
          },
          {
            title: 'Memories by Workspace',
            interactive: true
          }
        );
      }
    } catch (error) {
      console.warn('Failed to display stats in VS Code:', error);
    }
  }
  
  /**
   * Display TODO lists as data grid
   */
  async displayTodos(todos: any[]): Promise<void> {
    if (!this.isAvailable) return;
    
    try {
      // Transform todos to table format
      const todoData = {
        columns: ['Task', 'Status', 'Priority', 'List'],
        rows: todos.flatMap(list => 
          list.items.map((item: any) => [
            item.task,
            item.status,
            item.priority || 'normal',
            list.title
          ])
        )
      };
      
      await this.bridge!.sendVisualization(
        'data-grid',
        todoData,
        {
          title: 'Active TODO Items',
          interactive: true,
          sortable: true
        }
      );
    } catch (error) {
      console.warn('Failed to display TODOs in VS Code:', error);
    }
  }
  
  /**
   * Display search results
   */
  async displaySearchResults(
    results: GoldfishMemory[], 
    query: string
  ): Promise<void> {
    if (!this.isAvailable) return;
    
    try {
      // Send as timeline with search context
      await this.displayTimeline(results, `Search: "${query}"`);
      
      // Also show tag analysis if results have tags
      const tagAnalysis = this.analyzeTags(results);
      if (tagAnalysis.length > 0) {
        await this.bridge!.sendVisualization(
          'data-grid',
          {
            columns: ['Tag', 'Count', 'Percentage'],
            rows: tagAnalysis
          },
          {
            title: 'Tag Analysis',
            interactive: false
          }
        );
      }
    } catch (error) {
      console.warn('Failed to display search results in VS Code:', error);
    }
  }
  
  /**
   * Display session summary
   */
  async displaySessionSummary(sessionData: any): Promise<void> {
    if (!this.isAvailable) return;
    
    try {
      // Create summary data structure
      const summaryData = {
        sessionId: sessionData.sessionId,
        duration: sessionData.duration,
        checkpoints: sessionData.checkpointCount,
        activeFiles: sessionData.activeFiles || [],
        highlights: sessionData.highlights || [],
        workspace: sessionData.workspace
      };
      
      // Show as JSON tree
      await this.bridge!.sendVisualization(
        'json-tree',
        summaryData,
        {
          title: 'Session Summary',
          interactive: false
        }
      );
    } catch (error) {
      console.warn('Failed to display session summary in VS Code:', error);
    }
  }
  
  // Helper methods
  
  private calculateTypeDistribution(memories: GoldfishMemory[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    memories.forEach(memory => {
      distribution[memory.type] = (distribution[memory.type] || 0) + 1;
    });
    
    return distribution;
  }
  
  private calculateWorkspaceDistribution(memories: GoldfishMemory[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    memories.forEach(memory => {
      const workspace = memory.workspace || 'default';
      distribution[workspace] = (distribution[workspace] || 0) + 1;
    });
    
    return distribution;
  }
  
  private analyzeTags(memories: GoldfishMemory[]): Array<[string, number, string]> {
    const tagCounts: Record<string, number> = {};
    let totalTags = 0;
    
    memories.forEach(memory => {
      if (memory.tags) {
        memory.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          totalTags++;
        });
      }
    });
    
    // Convert to array and sort by count
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 tags
      .map(([tag, count]) => [
        tag,
        count,
        `${((count / totalTags) * 100).toFixed(1)}%`
      ]);
  }
}