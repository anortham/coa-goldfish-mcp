/**
 * Session Management for Goldfish MCP
 * Simplified for workspace-centric date folders
 */

import fs from 'fs-extra';
import { join } from 'path';
import { homedir } from 'os';
import { Storage } from './storage.js';

export class SessionManager {
  private storage: Storage;
  private currentWorkspace: string;

  constructor(workspace: string, storage: Storage) {
    this.currentWorkspace = workspace;
    this.storage = storage;
  }

  /**
   * Get the checkpoints directory for a workspace
   */
  getCheckpointsDir(workspace: string = this.currentWorkspace): string {
    return this.storage.getCheckpointsDir(workspace);
  }

  /**
   * Get current date directory for checkpoints
   */
  async getCurrentDateDir(): Promise<string> {
    const today = new Date().toISOString().split('T')[0];
    const dateDir = this.storage.getDateDir(today, this.currentWorkspace);
    await fs.ensureDir(dateDir);
    return dateDir;
  }

  /**
   * Ensure date directory exists for today
   */
  async ensureDateDir(): Promise<string> {
    return await this.getCurrentDateDir();
  }

  /**
   * Check if we need a new date directory (simplified)
   */
  async shouldCreateNewDateDir(): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dateDir = this.storage.getDateDir(today, this.currentWorkspace);
      return !await fs.pathExists(dateDir);
    } catch {
      return true;
    }
  }

  /**
   * No longer needed - checkpoints are standalone files
   */
  async updateCheckpointCount(): Promise<void> {
    // This method is now a no-op since we don't track session manifests
    // Checkpoints are standalone files in date directories
  }

  /**
   * Get all checkpoints for today
   */
  async getTodaysCheckpoints(): Promise<string[]> {
    try {
      const dateDir = await this.getCurrentDateDir();
      const files = await fs.readdir(dateDir);
      return files.filter(f => f.endsWith('.json')).sort();
    } catch {
      return [];
    }
  }
}