/**
 * Type definitions for Goldfish MCP
 */

export interface GoldfishMemory {
  id: string;
  timestamp: Date;
  workspace: string;
  sessionId?: string;
  type: 'general' | 'todo' | 'checkpoint' | 'context';
  content: any;
  ttlHours: number;
  tags?: string[];
  metadata?: Record<string, any>;
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

export interface CheckpointContent {
  description: string;
  highlights?: string[];
  activeFiles?: string[];
  gitBranch?: string;
  workContext?: string;
  sessionId?: string;
}

export interface SearchOptions {
  query?: string;
  since?: string;
  workspace?: string;
  type?: string;
  scope?: 'current' | 'global' | 'all';
  limit?: number;
}

export interface TimelineEntry {
  date: string;
  workspace: string;
  sessionId: string;
  checkpointCount: number;
  highlights: string[];
}