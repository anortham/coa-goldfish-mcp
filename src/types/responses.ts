/**
 * Response interfaces for structured JSON returns
 * Matches COA MCP Framework pattern to prevent CLI collapse
 */

export interface FormattedResponse {
  success: boolean;
  operation: string;
  formattedOutput?: string;  // Key: dedicated formatted text field
  data?: Record<string, unknown>;
  meta?: {
    mode: string;
    tokens?: number;
    lines?: number;
  };
}

export interface SearchHistoryResponse extends FormattedResponse {
  operation: 'search-history';
  query: string;
  resultsFound: number;
  matches?: Array<{
    memory: Record<string, unknown>;
    score: number;
    snippet?: string;
  }>;
}

export interface RecallResponse extends FormattedResponse {
  operation: 'recall';
  memoriesFound: number;
  timeRange: string;
  memories?: Array<{
    id: string;
    type: string;
    age: string;
    content: string;
    workspace?: string;
    tags?: string[];
  }>;
}

export interface TimelineResponse extends FormattedResponse {
  operation: 'timeline';
  scope: string;
  since: string;
  workspace?: string;
  totalItems: number;
  workspacesFound: number;
  checkpointsFound: number;
  data?: {
    byDate: Record<string, Record<string, unknown>>;
    byWorkspace: Record<string, Record<string, unknown>>;
  };
}

export interface SessionRestoreResponse extends FormattedResponse {
  operation: 'session-restore';
  sessionId?: string;
  depth: string;
  checkpointsFound: number;
  highlightsFound?: number;
  workspace?: string;
}

export interface SessionSummaryResponse extends FormattedResponse {
  operation: 'session-summary';
  sessionId?: string;
  timeRange: string;
  workspace?: string;
  achievements?: string[];
  nextSteps?: string[];
}