/**
 * Search functionality using Fuse.js for fuzzy matching
 */

import Fuse from 'fuse.js';
import { GoldfishMemory, SearchOptions } from '../types/index.js';
import { Storage } from './storage.js';

export class SearchEngine {
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  /**
   * Search memories with fuzzy matching
   */
  async searchMemories(options: SearchOptions): Promise<GoldfishMemory[]> {
    const {
      query = '',
      workspace,
      type,
      scope = 'current',
      limit = 50,
      since
    } = options;

    // Determine which workspaces to search
    let workspacesToSearch: string[] = [];
    
    if (scope === 'current') {
      workspacesToSearch = [workspace || this.storage.getCurrentWorkspace()];
    } else if (scope === 'all') {
      // Get all workspaces
      try {
        const { homedir } = await import('os');
        const { join } = await import('path');
        const basePath = join(homedir(), '.coa', 'goldfish');
        const fs = await import('fs-extra');
        workspacesToSearch = await fs.readdir(basePath);
      } catch {
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

    // Set up Fuse.js for fuzzy search with better multi-word support
    const fuseOptions = {
      keys: [
        { name: 'content', weight: 0.7 },
        { name: 'highlights', weight: 0.8 }, // Highlights are very important
        { name: 'tags', weight: 0.5 },
        { name: 'workspace', weight: 0.3 },
        { name: 'type', weight: 0.2 }
      ],
      threshold: 0.9, // Extremely lenient for multi-word queries
      ignoreLocation: true, // Don't penalize matches later in text
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 1, // Allow single character matches
      useExtendedSearch: false, // Disable - causing issues with OR syntax
      distance: 1000 // Allow matches far apart in text
    };

    // Prepare searchable content with better text extraction
    const searchableMemories = filteredMemories.map(memory => {
      let contentText = '';
      let highlightsText = '';
      
      if (typeof memory.content === 'string') {
        contentText = memory.content;
      } else if (memory.content && typeof memory.content === 'object') {
        // Extract description and other text fields
        if (memory.content.description) {
          contentText = memory.content.description;
        }
        // Extract highlights for searching
        if (memory.content.highlights && Array.isArray(memory.content.highlights)) {
          highlightsText = memory.content.highlights.join(' ');
        }
        // Add work context if available
        if (memory.content.workContext) {
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
      .map(result => {
        const originalMemory = filteredMemories.find(m => m.id === result.item.id);
        return originalMemory!;
      })
      .slice(0, limit);
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
    const memories = await this.searchMemories({ ...options, query, limit: 20 });
    
    // Re-run Fuse search to get match details
    const searchableMemories = memories.map(memory => ({
      ...memory,
      content: typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content),
      tags: memory.tags?.join(' ') || ''
    }));

    const fuse = new Fuse(searchableMemories, {
      keys: [
        { name: 'content', weight: 0.7 },
        { name: 'tags', weight: 0.5 },
        { name: 'workspace', weight: 0.3 }
      ],
      threshold: 0.9, // Very lenient like the main search
      ignoreLocation: true,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 1
    });

    const results = fuse.search(query);
    
    return results.map(result => ({
      memory: memories.find(m => m.id === result.item.id)!,
      score: result.score || 0,
      matches: result.matches?.map(match => ({
        key: match.key || '',
        value: match.value || '',
        indices: (match.indices || []) as [number, number][]
      })) || []
    }));
  }
}