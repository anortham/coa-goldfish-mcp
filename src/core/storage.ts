/**
 * Storage layer for Goldfish MCP
 * Handles file I/O and workspace management
 */

import fs from 'fs-extra';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { GoldfishMemory, TodoList } from '../types/index.js';

export class Storage {
  private basePath: string;
  private currentWorkspace: string;

  constructor(customWorkspace?: string, customBasePath?: string) {
    this.basePath = customBasePath || join(homedir(), '.coa', 'goldfish');
    this.currentWorkspace = customWorkspace || this.detectWorkspace();
  }

  /**
   * Detect current workspace from git or directory name
   * Uses spawn instead of execSync for better security
   */
  private detectWorkspace(): string {
    try {
      // Try git root first using safer spawn approach
      const gitRoot = this.safeGitCommand('rev-parse', ['--show-toplevel']);
      
      if (gitRoot) {
        const projectName = gitRoot.split(/[/\\]/).pop() || 'unknown-project';
        return projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      }
    } catch {
      // Fall through to fallback
    }
    
    // Fall back to current directory name
    const cwd = process.cwd();
    const dirName = cwd.split(/[/\\]/).pop() || 'unknown-workspace';
    return dirName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  /**
   * Safely execute git commands using spawn instead of execSync
   * This prevents command injection vulnerabilities
   */
  private safeGitCommand(command: string, args: string[]): string | null {
    try {
      const { spawnSync } = require('child_process');
      
      const result = spawnSync('git', [command, ...args], {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000, // 5 second timeout
        windowsHide: true
      });
      
      if (result.status === 0 && result.stdout) {
        return result.stdout.trim();
      }
      
      return null;
    } catch {
      return null;
    }
  }

  getCurrentWorkspace(): string {
    return this.currentWorkspace;
  }

  /**
   * Generate chronological filename with improved collision safety
   * Format: YYYYMMDD-HHMMSS-MMM-XXXX-YYYY.json
   * Uses process ID and higher entropy random number
   */
  generateChronologicalFilename(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
    
    // Add process ID for multi-process safety
    const processId = process.pid.toString(16).toUpperCase().padStart(4, '0');
    
    // Use crypto-grade randomness if available, fall back to Math.random
    let randomPart: string;
    try {
      const crypto = require('crypto');
      const randomBytes = crypto.randomBytes(2);
      randomPart = randomBytes.toString('hex').toUpperCase();
    } catch {
      // Fallback to Math.random with higher entropy
      const counter = Math.floor(Math.random() * 0xFFFF);
      randomPart = counter.toString(16).toUpperCase().padStart(4, '0');
    }
    
    return `${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}-${processId}-${randomPart}.json`;
  }

  /**
   * Get workspace directory
   */
  getWorkspaceDir(workspace: string = this.currentWorkspace): string {
    return join(this.basePath, workspace);
  }

  /**
   * Get checkpoints directory for workspace
   */
  getCheckpointsDir(workspace: string = this.currentWorkspace): string {
    return join(this.getWorkspaceDir(workspace), 'checkpoints');
  }

  /**
   * Get todos directory for workspace
   */
  getTodosDir(workspace: string = this.currentWorkspace): string {
    return join(this.getWorkspaceDir(workspace), 'todos');
  }

  /**
   * Get date directory for checkpoints
   */
  getDateDir(date?: string, workspace: string = this.currentWorkspace): string {
    const targetDate = date || new Date().toISOString().split('T')[0] || 'unknown';
    return join(this.getCheckpointsDir(workspace), targetDate);
  }

  /**
   * Save memory to appropriate directory based on type
   * Uses atomic write operations to prevent data corruption
   */
  async saveMemory(memory: GoldfishMemory): Promise<void> {
    let targetDir: string;
    
    if (memory.type === 'checkpoint') {
      // Save checkpoints in date-organized folders
      const date = memory.timestamp.toISOString().split('T')[0];
      targetDir = this.getDateDir(date, memory.workspace);
    } else {
      // Save other memories (todos, general) in todos folder
      targetDir = this.getTodosDir(memory.workspace);
    }
    
    await fs.ensureDir(targetDir);
    
    const filename = this.generateChronologicalFilename();
    const filepath = join(targetDir, filename);
    
    // Convert dates to ISO strings for JSON storage
    const serializable = {
      ...memory,
      timestamp: memory.timestamp.toISOString()
    };
    
    // Use atomic write operation to prevent corruption
    await this.atomicWriteJson(filepath, serializable);
  }

  /**
   * Atomic write operation using write-then-rename pattern
   * This prevents partial writes that could corrupt data
   */
  private async atomicWriteJson(filepath: string, data: any): Promise<void> {
    const tempFilepath = filepath + '.tmp';
    
    try {
      // Write to temporary file first
      await fs.writeJson(tempFilepath, data, { spaces: 2 });
      
      // Atomically move temp file to final location
      await fs.move(tempFilepath, filepath, { overwrite: true });
    } catch (error) {
      // Clean up temp file if it exists
      if (await fs.pathExists(tempFilepath)) {
        await fs.unlink(tempFilepath).catch(() => {
          // Ignore cleanup errors
        });
      }
      throw error;
    }
  }

  /**
   * Load memory from file by filename
   */
  async loadMemory(filename: string, workspace: string = this.currentWorkspace, type: 'checkpoint' | 'todo' = 'checkpoint'): Promise<GoldfishMemory | null> {
    try {
      let filepath: string | undefined;
      
      if (type === 'checkpoint') {
        // Search in date directories for checkpoints
        const checkpointsDir = this.getCheckpointsDir(workspace);
        const dateDirs = await fs.readdir(checkpointsDir).catch(() => []);
        
        for (const dateDir of dateDirs) {
          const candidatePath = join(checkpointsDir, dateDir, filename);
          if (await fs.pathExists(candidatePath)) {
            filepath = candidatePath;
            break;
          }
        }
        
        if (!filepath) return null;
      } else {
        filepath = join(this.getTodosDir(workspace), filename);
        if (!await fs.pathExists(filepath)) return null;
      }
      
      const data = await fs.readJson(filepath);
      
      return {
        ...data,
        timestamp: new Date(data.timestamp)
      };
    } catch {
      return null;
    }
  }

  /**
   * Load all memories for workspace from new structure
   */
  async loadAllMemories(workspace: string = this.currentWorkspace): Promise<GoldfishMemory[]> {
    try {
      const memories: GoldfishMemory[] = [];
      
      // Load checkpoints from date directories
      const checkpointsDir = this.getCheckpointsDir(workspace);
      if (await fs.pathExists(checkpointsDir)) {
        const dateDirs = await fs.readdir(checkpointsDir);
        
        for (const dateDir of dateDirs) {
          const datePath = join(checkpointsDir, dateDir);
          const stat = await fs.stat(datePath).catch(() => null);
          if (!stat || !stat.isDirectory()) continue;
          
          const files = await fs.readdir(datePath);
          const jsonFiles = files.filter(f => f.endsWith('.json'));
          
          for (const file of jsonFiles) {
            try {
              const data = await fs.readJson(join(datePath, file));
              memories.push({
                ...data,
                timestamp: new Date(data.timestamp)
              });
            } catch {
              // Skip corrupted files
            }
          }
        }
      }
      
      // Load todos
      const todosDir = this.getTodosDir(workspace);
      if (await fs.pathExists(todosDir)) {
        const files = await fs.readdir(todosDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        for (const file of jsonFiles) {
          try {
            const data = await fs.readJson(join(todosDir, file));
            memories.push({
              ...data,
              timestamp: new Date(data.timestamp)
            });
          } catch {
            // Skip corrupted files
          }
        }
      }
      
      return memories.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch {
      return [];
    }
  }

  /**
   * Load all memories from session folders (new architecture)
   */
  async loadAllSessionMemories(workspace: string = this.currentWorkspace): Promise<GoldfishMemory[]> {
    try {
      const sessionsPath = join(this.basePath, 'memories', workspace, 'sessions');
      const memories: GoldfishMemory[] = [];
      
      if (!await fs.pathExists(sessionsPath)) {
        return [];
      }
      
      // Get all date folders
      const dateFolders = await fs.readdir(sessionsPath);
      
      for (const dateFolder of dateFolders) {
        if (dateFolder === 'current') continue; // Skip symlink
        
        const datePath = join(sessionsPath, dateFolder);
        const stat = await fs.stat(datePath).catch(() => null);
        if (!stat || !stat.isDirectory()) continue;
        
        // Get all session folders for this date
        const sessionFolders = await fs.readdir(datePath).catch(() => []);
        
        for (const sessionFolder of sessionFolders) {
          const sessionPath = join(datePath, sessionFolder);
          const sessionStat = await fs.stat(sessionPath).catch(() => null);
          if (!sessionStat || !sessionStat.isDirectory()) continue;
          
          // Load all checkpoint files from this session
          const files = await fs.readdir(sessionPath).catch(() => []);
          const checkpointFiles = files.filter(f => f.startsWith('checkpoint-') && f.endsWith('.json'));
          
          for (const file of checkpointFiles) {
            try {
              const data = await fs.readJson(join(sessionPath, file));
              memories.push({
                ...data,
                timestamp: new Date(data.timestamp)
              });
            } catch (_error) {
              // Skip corrupted files
              console.warn(`Skipping corrupted file: ${file}`);
            }
          }
        }
      }
      
      return memories.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.warn('Failed to load session memories:', error);
      return [];
    }
  }

  /**
   * Delete memory file (search across date directories)
   */
  async deleteMemory(filename: string, workspace: string = this.currentWorkspace): Promise<void> {
    try {
      // Search in checkpoints directories
      const checkpointsDir = this.getCheckpointsDir(workspace);
      const dateDirs = await fs.readdir(checkpointsDir).catch(() => []);
      
      for (const dateDir of dateDirs) {
        const candidatePath = join(checkpointsDir, dateDir, filename);
        if (await fs.pathExists(candidatePath)) {
          await fs.unlink(candidatePath);
          return;
        }
      }
      
      // Search in todos directory
      const todosPath = join(this.getTodosDir(workspace), filename);
      if (await fs.pathExists(todosPath)) {
        await fs.unlink(todosPath);
      }
    } catch {
      // File doesn't exist, that's fine
    }
  }

  /**
   * Save TODO list using atomic operations
   */
  async saveTodoList(todoList: TodoList): Promise<void> {
    const todosDir = this.getTodosDir(todoList.workspace);
    await fs.ensureDir(todosDir);
    
    const filename = `${todoList.id}.json`;
    const filepath = join(todosDir, filename);
    
    // Convert dates to ISO strings
    const serializable = {
      ...todoList,
      createdAt: todoList.createdAt.toISOString(),
      updatedAt: todoList.updatedAt.toISOString(),
      completedAt: todoList.completedAt?.toISOString(), // NEW - Handle completedAt
      items: todoList.items.map(item => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt?.toISOString()
      }))
    };
    
    // Use atomic write operation
    await this.atomicWriteJson(filepath, serializable);
  }

  /**
   * Load all TODO lists for workspace
   */
  async loadAllTodoLists(workspace: string = this.currentWorkspace): Promise<TodoList[]> {
    try {
      const todosDir = this.getTodosDir(workspace);
      const files = await fs.readdir(todosDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const todoLists = await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            const data = await fs.readJson(join(todosDir, file));
            return {
              ...data,
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.updatedAt),
              completedAt: data.completedAt ? new Date(data.completedAt) : undefined, // NEW - Handle completedAt
              items: data.items.map((item: Record<string, unknown>) => ({
                ...item,
                createdAt: new Date(item.createdAt as string),
                updatedAt: item.updatedAt ? new Date(item.updatedAt as string) : undefined
              }))
            };
          } catch {
            return null;
          }
        })
      );
      
      return todoLists
        .filter((list): list is TodoList => list !== null)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch {
      return [];
    }
  }

  /**
   * Discover all valid workspaces in basePath
   * A workspace is valid if it has either checkpoints or todos directories
   */
  async discoverWorkspaces(): Promise<string[]> {
    try {
      const allDirs = await fs.readdir(this.basePath);
      const validWorkspaces: string[] = [];
      
      for (const dir of allDirs) {
        const checkpointsPath = join(this.basePath, dir, 'checkpoints');
        const todosPath = join(this.basePath, dir, 'todos');
        
        const hasCheckpoints = await fs.pathExists(checkpointsPath);
        const hasTodos = await fs.pathExists(todosPath);
        
        // Include workspace if it has checkpoints OR todos directory
        if (hasCheckpoints || hasTodos) {
          validWorkspaces.push(dir);
        }
      }
      
      return validWorkspaces;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get the base path used by this storage instance
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Clean up expired memories
   */
  async cleanupExpiredMemories(): Promise<number> {
    let cleanedCount = 0;
    const now = new Date();
    
    try {
      const workspaces = await fs.readdir(join(this.basePath, 'memories'));
      
      for (const workspace of workspaces) {
        const memories = await this.loadAllMemories(workspace);
        
        for (const memory of memories) {
          const expiryTime = new Date(memory.timestamp.getTime() + memory.ttlHours * 60 * 60 * 1000);
          
          if (now > expiryTime) {
            await this.deleteMemory(memory.id, workspace);
            cleanedCount++;
          }
        }
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
    
    return cleanedCount;
  }
}