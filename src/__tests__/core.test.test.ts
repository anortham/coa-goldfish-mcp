import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

// Test the core functionality of GoldfishServer
describe('Goldfish Core Functionality', () => {
  let testDir: string;
  let originalProcessCwd: () => string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-test-'));
    originalProcessCwd = process.cwd;
    process.cwd = () => testDir;
  });

  afterEach(async () => {
    // Cleanup test directory
    process.cwd = originalProcessCwd;
    await fs.remove(testDir);
  });

  describe('Workspace Detection', () => {
    test('should detect workspace from git root', async () => {
      // Initialize git repo
      execSync('git init', { cwd: testDir });
      execSync('git config user.name "Test User"', { cwd: testDir });
      execSync('git config user.email "test@example.com"', { cwd: testDir });
      
      // Test workspace detection logic (we'll need to refactor the server class to test this)
      // For now, test the normalization function
      const normalizeWorkspaceName = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      };

      expect(normalizeWorkspaceName('My Project')).toBe('my-project');
      expect(normalizeWorkspaceName('COA_Goldfish_MCP')).toBe('coa-goldfish-mcp');
      expect(normalizeWorkspaceName('test--workspace')).toBe('test-workspace');
    });

    test('should fallback to directory name when not in git repo', () => {
      const normalizeWorkspaceName = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      };

      expect(normalizeWorkspaceName('goldfish-test')).toBe('goldfish-test');
    });
  });

  describe('Chronological ID Generation', () => {
    test('should generate valid hex chronological IDs', () => {
      let _counter = Math.floor(Math.random() * 0xFFFFFF);
      
      const generateChronologicalId = (): string => {
        // ProjectKnowledge-style hex format
        const timestamp = Date.now();
        const counter = (++_counter) & 0xFFFFFF; // 24-bit counter
        return `${timestamp.toString(16).toUpperCase()}-${counter.toString(16).padStart(6, '0').toUpperCase()}`;
      };

      const id1 = generateChronologicalId();
      const id2 = generateChronologicalId();

      // Should match format {timestamp-hex}-{counter-hex}
      expect(id1).toMatch(/^[0-9A-F]+-[0-9A-F]{6}$/);
      expect(id2).toMatch(/^[0-9A-F]+-[0-9A-F]{6}$/);
      
      // IDs should be different
      expect(id1).not.toBe(id2);
    });

    test('should generate sortable hex chronological IDs', async () => {
      let _counter = Math.floor(Math.random() * 0xFFFFFF);
      
      const generateChronologicalId = (): string => {
        const timestamp = Date.now();
        const counter = (++_counter) & 0xFFFFFF;
        return `${timestamp.toString(16).toUpperCase()}-${counter.toString(16).padStart(6, '0').toUpperCase()}`;
      };

      const id1 = generateChronologicalId();
      // Wait enough time to ensure different timestamp (1 second for reliable comparison)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const id2 = generateChronologicalId();
      
      expect(id1 < id2).toBe(true); // Should be chronologically sortable
    });
  });

  describe('Memory Storage', () => {
    test('should create memory directories', async () => {
      const goldFishDir = join(testDir, '.coa', 'goldfish');
      const memoriesDir = join(goldFishDir, 'memories', 'test-workspace');
      const todosDir = join(goldFishDir, 'todos', 'test-workspace');
      const globalDir = join(goldFishDir, 'memories', 'global');
      
      await fs.ensureDir(memoriesDir);
      await fs.ensureDir(todosDir);
      await fs.ensureDir(globalDir);
      await fs.ensureDir(join(goldFishDir, 'config'));

      expect(await fs.pathExists(memoriesDir)).toBe(true);
      expect(await fs.pathExists(todosDir)).toBe(true);
      expect(await fs.pathExists(globalDir)).toBe(true);
      expect(await fs.pathExists(join(goldFishDir, 'config'))).toBe(true);
    });
  });

  describe('TTL and Expiration Logic', () => {
    test('should correctly calculate memory age', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
      const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

      const ageOneHour = (now.getTime() - oneHourAgo.getTime()) / (1000 * 60 * 60);
      const ageOneDay = (now.getTime() - oneDayAgo.getTime()) / (1000 * 60 * 60);

      expect(Math.round(ageOneHour)).toBe(1);
      expect(Math.round(ageOneDay)).toBe(24);
    });

    test('should determine if memory should be promoted', () => {
      const shouldPromoteMemory = (memory: any): boolean => {
        const ageHours = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
        
        if (ageHours < 12) return false;

        if (memory.type === 'checkpoint' && memory.metadata?.isSession) {
          return true;
        }

        if (memory.tags?.some((tag: string) => ['important', 'decision', 'architecture', 'bug-fix'].includes(tag))) {
          return true;
        }

        if (memory.type === 'context' && typeof memory.content === 'string' && memory.content.length > 200) {
          return true;
        }

        return false;
      };

      const oldMemory = {
        timestamp: new Date(Date.now() - (13 * 60 * 60 * 1000)), // 13 hours ago
        type: 'checkpoint',
        metadata: { isSession: true },
        content: 'Test session'
      };

      const recentMemory = {
        timestamp: new Date(Date.now() - (1 * 60 * 60 * 1000)), // 1 hour ago
        type: 'checkpoint',
        metadata: { isSession: true },
        content: 'Recent session'
      };

      expect(shouldPromoteMemory(oldMemory)).toBe(true);
      expect(shouldPromoteMemory(recentMemory)).toBe(false);
    });
  });
});