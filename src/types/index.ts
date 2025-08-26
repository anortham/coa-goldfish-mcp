/**
 * Type definitions for Goldfish MCP
 */

export interface GoldfishMemory extends Record<string, unknown> {
  id: string;
  timestamp: Date;
  workspace: string;
  sessionId?: string;
  type: 'general' | 'todo' | 'checkpoint' | 'context';
  content: string | Record<string, unknown>;
  ttlHours: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface TodoItem {
  id: string;
  task: string;
  status: 'pending' | 'active' | 'done';
  priority?: 'low' | 'normal' | 'high';
  createdAt: Date;
  updatedAt?: Date;
  sessionId?: string;
}

export interface TodoList {
  id: string;                    // Existing
  title: string;                 // Existing
  description?: string;          // NEW - For context/handoff data
  metadata?: Record<string, any>; // NEW - Flexible data storage
  workspace: string;             // Existing
  items: TodoItem[];             // Existing
  createdAt: Date;               // Existing
  updatedAt: Date;               // Existing
  completedAt?: Date;            // NEW - When marked complete
  status?: 'active' | 'completed' | 'archived';  // NEW - Lifecycle
  ttlHours?: number;             // NEW - Optional expiration
  sessionId?: string;            // Existing
  tags?: string[];               // Existing
}

export interface SessionManifest {
  id: string;
  workspace: string;
  startTime: Date;
  endTime?: Date;
  checkpointCount: number;
  description?: string;
  highlights: string[];
  gitBranch?: string;
  activeFiles?: string[];
}

export interface CheckpointContent extends Record<string, unknown> {
  description: string;
  highlights?: string[];
  activeFiles?: string[];
  gitBranch?: string;
  workContext?: string;
  sessionId?: string;
}

export type SearchMode = 'strict' | 'normal' | 'fuzzy' | 'auto';

export interface SearchOptions {
  query?: string;
  since?: string;
  workspace?: string;
  type?: string;
  tags?: string[];
  scope?: 'current' | 'global' | 'all';
  limit?: number;
  mode?: SearchMode;
}

export interface TimelineEntry {
  date: string;
  workspace: string;
  sessionId: string;
  checkpointCount: number;
  highlights: string[];
}

/**
 * Common interface for MCP tool responses
 */
export interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}