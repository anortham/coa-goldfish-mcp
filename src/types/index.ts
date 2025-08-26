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
  id: string;
  title: string;
  workspace: string;
  items: TodoItem[];
  createdAt: Date;
  updatedAt: Date;
  sessionId?: string;
  tags?: string[];
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