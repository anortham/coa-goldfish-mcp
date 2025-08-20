/**
 * Checkpoint tool - The core memory capture mechanism
 * Replaces both snapshot and save_session with flexible parameters
 */

import { GoldfishMemory, CheckpointContent } from '../types/index.js';
import { Storage } from '../core/storage.js';
import { SessionManager } from '../core/session-manager.js';

export class CheckpointTool {
  private storage: Storage;
  private sessionManager: SessionManager;

  constructor(storage: Storage, sessionManager: SessionManager) {
    this.storage = storage;
    this.sessionManager = sessionManager;
  }

  /**
   * Create a checkpoint - flexible for both quick notes and detailed sessions
   */
  async createCheckpoint(args: {
    description: string;
    highlights?: string[];
    activeFiles?: string[];
    gitBranch?: string;
    workContext?: string;
    sessionId?: string;
    workspace?: string;
    global?: boolean;
  }) {
    const {
      description,
      highlights = [],
      activeFiles = [],
      gitBranch,
      workContext,
      sessionId,
      workspace,
      global = false
    } = args;

    const targetWorkspace = global ? 'global' : (workspace || this.storage.getCurrentWorkspace());

    // Auto-detect git info if not provided
    let detectedBranch = gitBranch;
    if (!detectedBranch) {
      try {
        const { execSync } = await import('child_process');
        detectedBranch = execSync('git branch --show-current', { 
          encoding: 'utf8', 
          stdio: 'pipe' 
        }).trim();
      } catch {
        // Not in a git repo or git not available
      }
    }

    // Ensure date directory exists
    const dateDir = await this.sessionManager.ensureDateDir();
    const today = new Date().toISOString().split('T')[0];
    const actualSessionId = sessionId || `${today}-checkpoint`;

    const checkpointContent: CheckpointContent = {
      description,
      highlights,
      activeFiles: activeFiles.length > 0 ? activeFiles : undefined,
      gitBranch: detectedBranch,
      workContext,
      sessionId: actualSessionId
    };

    const checkpoint: GoldfishMemory = {
      id: this.storage.generateChronologicalFilename().replace('.json', ''),
      timestamp: new Date(),
      workspace: targetWorkspace,
      sessionId: actualSessionId,
      type: 'checkpoint',
      content: checkpointContent,
      ttlHours: 72, // Keep checkpoints for 3 days
      tags: ['checkpoint'],
      metadata: { 
        isCheckpoint: true,
        dateDir: dateDir,
        global 
      }
    };

    // Save checkpoint using new storage method
    await this.storage.saveMemory(checkpoint);

    const filesInfo = activeFiles.length > 0 
      ? `\n📁 Files: ${activeFiles.slice(0, 3).join(', ')}${activeFiles.length > 3 ? '...' : ''}`
      : '';

    const branchInfo = detectedBranch ? `\n🌿 Branch: ${detectedBranch}` : '';
    const highlightsInfo = highlights.length > 0 ? `\n✨ Highlights: ${highlights.join(', ')}` : '';

    return {
      content: [
        {
          type: 'text',
          text: `💾 Checkpoint saved: "${description}"\n🆔 ID: ${checkpoint.id}\n⏰ Session: ${actualSessionId}${filesInfo}${branchInfo}${highlightsInfo}\n\n✅ Ready to continue or /clear context!`
        }
      ]
    };
  }

  /**
   * No longer needed - storage handles file operations
   */

  /**
   * Auto-checkpoint from git commit (for hooks)
   */
  async autoCheckpointFromCommit(commitMessage: string, commitHash?: string) {
    const highlights = [`Committed: "${commitMessage}"`];
    
    if (commitHash) {
      highlights.push(`Hash: ${commitHash.substring(0, 8)}`);
    }

    return await this.createCheckpoint({
      description: `Auto-checkpoint: ${commitMessage}`,
      highlights,
      workContext: 'Automatic checkpoint from git commit'
    });
  }

  /**
   * Get the tool schema for MCP
   */
  static getToolSchema() {
    return {
      name: 'checkpoint',
      description: 'Create a checkpoint to save current progress. Use frequently for crash-safe development. Required: description only. Optional: add context like files, branch, highlights for detailed session tracking.',
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Brief description of what was accomplished or current state'
          },
          highlights: {
            type: 'array',
            items: { type: 'string' },
            description: 'Important achievements or decisions to remember (accumulates in session)'
          },
          activeFiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files currently being worked on'
          },
          gitBranch: {
            type: 'string',
            description: 'Current git branch (auto-detected if not provided)'
          },
          workContext: {
            type: 'string',
            description: 'What you were working on or next steps'
          },
          sessionId: {
            type: 'string',
            description: 'Session identifier (auto-generated if not provided)'
          },
          workspace: {
            type: 'string',
            description: 'Store in specific workspace (default: current workspace)'
          },
          global: {
            type: 'boolean',
            description: 'Store as global checkpoint (visible across all workspaces)'
          }
        },
        required: ['description']
      }
    };
  }
}