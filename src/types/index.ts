/**
 * Type definitions for Goldfish MCP
 */

export interface GoldfishMemory extends Record<string, unknown> {
  id: string;
  timestamp: Date;
  workspace: string;
  sessionId?: string;
  type: 'general' | 'todo' | 'checkpoint' | 'context' | 'plan';
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

export interface Plan extends Record<string, unknown> {
  id: string;
  title: string;
  description: string;           // Full markdown plan content
  items: string[];              // High-level plan items/milestones
  category?: 'feature' | 'refactor' | 'research' | 'architecture' | 'bugfix' | 'maintenance';
  status: 'draft' | 'active' | 'complete' | 'abandoned';
  workspace: string;
  
  // Lifecycle timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  abandonedAt?: Date;
  
  // Relationship tracking
  generatedTodos: string[];      // TODO list IDs created from this plan
  relatedCheckpoints: string[];  // Checkpoint IDs related to this plan
  
  // Progress and outcome tracking
  completionPercentage: number;
  outcomes?: string[];           // What actually happened vs plan
  lessons?: string[];            // What we learned
  blockers?: string[];           // What prevented progress
  
  // Metadata
  estimatedEffort?: string;      // Time estimate
  actualEffort?: string;         // Actual time spent
  priority?: 'low' | 'normal' | 'high' | 'critical';
  tags?: string[];
  sessionId?: string;
  
  // Optional expiration
  ttlHours?: number;
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
  isError?: boolean;
}