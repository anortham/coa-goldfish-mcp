/**
 * Search functionality using Fuse.js for fuzzy matching
 */

import Fuse, { IFuseOptions, FuseResult } from 'fuse.js';
import { GoldfishMemory, SearchOptions, SearchMode } from '../types/index.js';
import { Storage } from './storage.js';
import { normalizeWorkspaceName } from './workspace-utils.js';

interface SearchableMemory extends Omit<GoldfishMemory, 'content' | 'tags'> {
  content: string;
  highlights: string;
  tags: string;
}

interface SearchConfig {
  threshold: number;
  useExtendedSearch: boolean;
  weights: {
    content: number;
    highlights: number;
    tags: number;
    workspace: number;
    type: number;
  };
  distance: number;
  minMatchCharLength: number;
}

export class SearchEngine {
  private storage: Storage;
  private searchConfigs: Record<SearchMode, SearchConfig>;

  constructor(storage: Storage) {
    this.storage = storage;
    
    // Define search configurations for different modes
    this.searchConfigs = {
      strict: {
        threshold: 0.2,
        useExtendedSearch: true,
        weights: { content: 0.8, highlights: 0.6, tags: 0.4, workspace: 0.2, type: 0.1 },
        distance: 50,
        minMatchCharLength: 2
      },
      normal: {
        threshold: 0.4,
        useExtendedSearch: true,
        weights: { content: 0.7, highlights: 0.6, tags: 0.5, workspace: 0.3, type: 0.2 },
        distance: 200,
        minMatchCharLength: 1
      },
      fuzzy: {
        threshold: 0.6,
        useExtendedSearch: false,
        weights: { content: 0.7, highlights: 0.8, tags: 0.5, workspace: 0.3, type: 0.2 },
        distance: 1000,
        minMatchCharLength: 1
      },
      auto: {
        threshold: 0.3, // Will be adjusted by auto-escalation logic
        useExtendedSearch: true,
        weights: { content: 0.8, highlights: 0.6, tags: 0.4, workspace: 0.2, type: 0.1 },
        distance: 100,
        minMatchCharLength: 1
      }
    };
  }

  // Removed duplicate normalizeWorkspaceName - now using utility from workspace-utils

  /**
   * Search memories with configurable search modes
   */
  async searchMemories(options: SearchOptions): Promise<GoldfishMemory[]> {
    const {
      query = '',
      workspace,
      type,
      tags,
      scope = 'current',
      limit = 50,
      since,
      mode = 'normal'
    } = options;

    // Normalize workspace name if provided
    const normalizedWorkspace = workspace ? normalizeWorkspaceName(workspace) : undefined;

    // Determine which workspaces to search
    let workspacesToSearch: string[] = [];
    
    if (scope === 'current') {
      workspacesToSearch = [normalizedWorkspace || this.storage.getCurrentWorkspace()];
    } else if (scope === 'all') {
      // Get all valid workspaces using Storage's discovery method
      try {
        workspacesToSearch = await this.storage.discoverWorkspaces();
      } catch (_error) {
        workspacesToSearch = [this.storage.getCurrentWorkspace()];
      }
    }

    // Load memories from all target workspaces
    let allMemories: GoldfishMemory[] = [];
    for (const ws of workspacesToSearch) {
      if (ws) {
        const memories = await this.storage.loadAllMemories(ws);
        allMemories.push(...memories);
      }
    }

    // Apply filters
    let filteredMemories = allMemories;

    if (type) {
      filteredMemories = filteredMemories.filter(m => m.type === type);
    }

    if (tags && tags.length > 0) {
      filteredMemories = filteredMemories.filter(m => 
        m.tags && tags.every(tag => m.tags!.includes(tag))
      );
    }

    if (since) {
      const cutoffTime = this.parseSinceFilter(since);
      if (cutoffTime) {
        filteredMemories = filteredMemories.filter(m => m.timestamp >= cutoffTime);
      }
    }

    // If no query, return filtered results
    if (!query.trim()) {
      return filteredMemories.slice(0, limit);
    }

    // Handle auto-escalation mode
    if (mode === 'auto') {
      return this.performAutoEscalationSearch(query, filteredMemories, limit);
    }

    // Get configuration for the specified mode
    const config = this.searchConfigs[mode];
    
    // Set up Fuse.js with mode-specific configuration
    const fuseOptions: IFuseOptions<SearchableMemory> = {
      keys: [
        { name: 'content', weight: config.weights.content },
        { name: 'highlights', weight: config.weights.highlights },
        { name: 'tags', weight: config.weights.tags },
        { name: 'workspace', weight: config.weights.workspace },
        { name: 'type', weight: config.weights.type }
      ],
      threshold: config.threshold,
      ignoreLocation: true, // Don't penalize matches later in text
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: config.minMatchCharLength,
      useExtendedSearch: config.useExtendedSearch,
      distance: config.distance
    };

    // Prepare searchable content with better text extraction
    const searchableMemories = filteredMemories.map(memory => {
      let contentText = '';
      let highlightsText = '';
      
      if (typeof memory.content === 'string') {
        contentText = memory.content;
      } else if (memory.content && typeof memory.content === 'object') {
        // Extract description and other text fields
        if ('description' in memory.content && typeof memory.content.description === 'string') {
          contentText = memory.content.description;
        }
        // Extract highlights for searching
        if ('highlights' in memory.content && Array.isArray(memory.content.highlights)) {
          highlightsText = memory.content.highlights.join(' ');
        }
        // Add work context if available
        if ('workContext' in memory.content && typeof memory.content.workContext === 'string') {
          contentText += ' ' + memory.content.workContext;
        }
      }
      
      return {
        ...memory,
        content: contentText,
        highlights: highlightsText,
        tags: memory.tags?.join(' ') || ''
      };
    });

    const fuse = new Fuse(searchableMemories, fuseOptions);
    const results = fuse.search(query);

    // Extract memories from Fuse results and restore original format
    return results
      .map((result: FuseResult<SearchableMemory>) => {
        const originalMemory = filteredMemories.find(m => m.id === result.item.id);
        return originalMemory!;
      })
      .slice(0, limit);
  }

  /**
   * Perform auto-escalation search: strict -> normal -> fuzzy
   */
  private async performAutoEscalationSearch(query: string, filteredMemories: GoldfishMemory[], limit: number): Promise<GoldfishMemory[]> {
    const escalationModes: SearchMode[] = ['strict', 'normal', 'fuzzy'];
    
    for (const escalationMode of escalationModes) {
      const config = this.searchConfigs[escalationMode];
      
      const fuseOptions: IFuseOptions<SearchableMemory> = {
        keys: [
          { name: 'content', weight: config.weights.content },
          { name: 'highlights', weight: config.weights.highlights },
          { name: 'tags', weight: config.weights.tags },
          { name: 'workspace', weight: config.weights.workspace },
          { name: 'type', weight: config.weights.type }
        ],
        threshold: config.threshold,
        ignoreLocation: true,
        includeScore: true,
        includeMatches: true,
        minMatchCharLength: config.minMatchCharLength,
        useExtendedSearch: config.useExtendedSearch,
        distance: config.distance
      };

      // Prepare searchable content
      const searchableMemories = filteredMemories.map(memory => {
        let contentText = '';
        let highlightsText = '';
        
        if (typeof memory.content === 'string') {
          contentText = memory.content;
        } else if (memory.content && typeof memory.content === 'object') {
          if ('description' in memory.content && typeof memory.content.description === 'string') {
            contentText = memory.content.description;
          }
          if ('highlights' in memory.content && Array.isArray(memory.content.highlights)) {
            highlightsText = memory.content.highlights.join(' ');
          }
          if ('workContext' in memory.content && typeof memory.content.workContext === 'string') {
            contentText += ' ' + memory.content.workContext;
          }
        }
        
        return {
          ...memory,
          content: contentText,
          highlights: highlightsText,
          tags: memory.tags?.join(' ') || ''
        };
      });

      const fuse = new Fuse(searchableMemories, fuseOptions);
      const results = fuse.search(query);

      // Only return results if we have adequate matches for the escalation level
      if (escalationMode === 'strict' || escalationMode === 'normal') {
        // For strict/normal modes, require at least 2 good matches or stop escalating
        if (results.length >= Math.min(2, limit)) {
          return results
            .map((result: FuseResult<SearchableMemory>) => {
              const originalMemory = filteredMemories.find(m => m.id === result.item.id);
              return originalMemory!;
            })
            .slice(0, limit);
        }
      } else if (escalationMode === 'fuzzy') {
        // For fuzzy mode, filter by score to maintain reasonable precision
        const goodResults = results.filter((r: FuseResult<SearchableMemory>) => r.score !== undefined && r.score <= 0.4);
        if (goodResults.length >= 1) {
          return goodResults
            .map((result: FuseResult<SearchableMemory>) => {
              const originalMemory = filteredMemories.find(m => m.id === result.item.id);
              return originalMemory!;
            })
            .slice(0, limit);
        }
      }
    }

    // If all modes failed, return empty results
    return [];
  }

  /**
   * Parse "since" filter into Date object
   */
  private parseSinceFilter(since: string): Date | null {
    const now = new Date();
    const match = since.match(/^(\d+)([hdw])$/);
    
    if (!match) {
      // Try specific date formats
      if (since === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        return yesterday;
      }
      
      if (since === 'today') {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        return today;
      }

      // Try parsing as date string
      try {
        return new Date(since);
      } catch {
        return null;
      }
    }

    const [, amount, unit] = match;
    const num = parseInt(amount || '0', 10);
    const cutoff = new Date(now);

    switch (unit) {
      case 'h': // hours
        cutoff.setHours(cutoff.getHours() - num);
        break;
      case 'd': // days
        cutoff.setDate(cutoff.getDate() - num);
        break;
      case 'w': // weeks
        cutoff.setDate(cutoff.getDate() - (num * 7));
        break;
      default:
        return null;
    }

    return cutoff;
  }

  /**
   * Search for specific patterns with highlighting
   */
  async searchWithHighlights(query: string, options: SearchOptions = {}): Promise<Array<{
    memory: GoldfishMemory;
    score: number;
    matches: Array<{ key: string; value: string; indices: [number, number][] }>;
  }>> {
    const mode = options.mode || 'normal';
    const memories = await this.searchMemories({ ...options, query, limit: 20, mode });
    
    // Re-run Fuse search to get match details using same mode
    const config = this.searchConfigs[mode];
    const searchableMemories = memories.map(memory => ({
      ...memory,
      content: typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content),
      highlights: '', // Add empty highlights to match interface
      tags: memory.tags?.join(' ') || ''
    }));

    const fuse = new Fuse(searchableMemories, {
      keys: [
        { name: 'content', weight: config.weights.content },
        { name: 'highlights', weight: config.weights.highlights },
        { name: 'tags', weight: config.weights.tags },
        { name: 'workspace', weight: config.weights.workspace }
      ],
      threshold: config.threshold,
      ignoreLocation: true,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: config.minMatchCharLength,
      useExtendedSearch: config.useExtendedSearch
    });

    const results = fuse.search(query);
    
    return results.map((result: FuseResult<SearchableMemory>) => ({
      memory: memories.find(m => m.id === result.item.id)!,
      score: result.score || 0,
      matches: result.matches?.map((match: any) => ({
        key: match.key || '',
        value: match.value || '',
        indices: (match.indices || []) as [number, number][]
      })) || []
    }));
  }
}