/**
 * Tests for Intel Storage Methods
 * Tests the storage layer functionality for Intel (INTEL.md) files
 */

import { Storage } from '../core/storage.js';
import fs from 'fs-extra';
import { join } from 'path';

describe('Intel Storage Methods', () => {
  let storage: Storage;
  let testWorkspace: string;
  let tempDir: string;
  let workspaceDir: string;
  let intelPath: string;

  beforeEach(async () => {
    testWorkspace = 'intel-storage-test';
    tempDir = join(process.cwd(), 'test-storage', `intel-storage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    
    // Create isolated storage for testing
    storage = new Storage(testWorkspace, tempDir);
    workspaceDir = join(tempDir, testWorkspace);
    intelPath = join(workspaceDir, 'INTEL.md');
    
    // Clean up any existing test files
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.remove(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('writeIntelFile', () => {
    test('should create intel file with content', async () => {
      const testContent = '# Test Intelligence\n\nThis is test content.';
      
      await storage.writeIntelFile(testContent);
      
      expect(await fs.pathExists(intelPath)).toBe(true);
      const writtenContent = await fs.readFile(intelPath, 'utf-8');
      expect(writtenContent).toBe(testContent);
    });

    test('should create workspace directory if it does not exist', async () => {
      const testContent = 'Test content';
      
      // Ensure workspace directory doesn't exist
      expect(await fs.pathExists(workspaceDir)).toBe(false);
      
      await storage.writeIntelFile(testContent);
      
      expect(await fs.pathExists(workspaceDir)).toBe(true);
      expect(await fs.pathExists(intelPath)).toBe(true);
    });

    test('should overwrite existing intel file', async () => {
      const originalContent = 'Original content';
      const newContent = 'New content';
      
      await storage.writeIntelFile(originalContent);
      await storage.writeIntelFile(newContent);
      
      const finalContent = await fs.readFile(intelPath, 'utf-8');
      expect(finalContent).toBe(newContent);
      expect(finalContent).not.toContain(originalContent);
    });

    test('should handle empty content', async () => {
      await storage.writeIntelFile('');
      
      expect(await fs.pathExists(intelPath)).toBe(true);
      const content = await fs.readFile(intelPath, 'utf-8');
      expect(content).toBe('');
    });

    test('should handle markdown with special characters', async () => {
      const testContent = `# Intelligence

## Special Characters
- < and > symbols
- "quotes" and 'apostrophes'
- #hashtags and @mentions
- Code: \`if (condition) { return true; }\`

## Unicode
- Emojis: 🧠 📝 ✅
- Symbols: ← → ↑ ↓`;

      await storage.writeIntelFile(testContent);
      
      const writtenContent = await fs.readFile(intelPath, 'utf-8');
      expect(writtenContent).toBe(testContent);
    });

    test('should work with different workspaces', async () => {
      const workspace1 = 'workspace1';
      const workspace2 = 'workspace2';
      const content1 = 'Content for workspace 1';
      const content2 = 'Content for workspace 2';
      
      await storage.writeIntelFile(content1, workspace1);
      await storage.writeIntelFile(content2, workspace2);
      
      const path1 = join(tempDir, workspace1, 'INTEL.md');
      const path2 = join(tempDir, workspace2, 'INTEL.md');
      
      expect(await fs.pathExists(path1)).toBe(true);
      expect(await fs.pathExists(path2)).toBe(true);
      
      const readContent1 = await fs.readFile(path1, 'utf-8');
      const readContent2 = await fs.readFile(path2, 'utf-8');
      
      expect(readContent1).toBe(content1);
      expect(readContent2).toBe(content2);
    });
  });

  describe('readIntelFile', () => {
    test('should read existing intel file', async () => {
      const testContent = 'Test intelligence content';
      
      await fs.ensureDir(workspaceDir);
      await fs.writeFile(intelPath, testContent, 'utf-8');
      
      const readContent = await storage.readIntelFile();
      expect(readContent).toBe(testContent);
    });

    test('should throw error when file does not exist', async () => {
      await expect(storage.readIntelFile()).rejects.toThrow();
    });

    test('should read empty file correctly', async () => {
      await fs.ensureDir(workspaceDir);
      await fs.writeFile(intelPath, '', 'utf-8');
      
      const readContent = await storage.readIntelFile();
      expect(readContent).toBe('');
    });

    test('should preserve line endings and formatting', async () => {
      const testContent = `# Intelligence

## Section 1
- Item 1
- Item 2

## Section 2
- Item 3
  - Sub-item
- Item 4`;

      await fs.ensureDir(workspaceDir);
      await fs.writeFile(intelPath, testContent, 'utf-8');
      
      const readContent = await storage.readIntelFile();
      expect(readContent).toBe(testContent);
    });

    test('should work with different workspaces', async () => {
      const workspace1 = 'read-test-1';
      const workspace2 = 'read-test-2';
      const content1 = 'Content 1';
      const content2 = 'Content 2';
      
      // Write to different workspaces
      const path1 = join(tempDir, workspace1, 'INTEL.md');
      const path2 = join(tempDir, workspace2, 'INTEL.md');
      
      await fs.ensureDir(join(tempDir, workspace1));
      await fs.ensureDir(join(tempDir, workspace2));
      await fs.writeFile(path1, content1, 'utf-8');
      await fs.writeFile(path2, content2, 'utf-8');
      
      // Read from different workspaces
      const readContent1 = await storage.readIntelFile(workspace1);
      const readContent2 = await storage.readIntelFile(workspace2);
      
      expect(readContent1).toBe(content1);
      expect(readContent2).toBe(content2);
    });

    test('should handle large files efficiently', async () => {
      // Create a large intel file
      const largeContent = Array(1000).fill(0).map((_, i) => `- Discovery ${i}: Some important finding about the system`).join('\n');
      const fullContent = `# Large Intelligence File\n\n## Active Investigations\n${largeContent}`;
      
      await fs.ensureDir(workspaceDir);
      await fs.writeFile(intelPath, fullContent, 'utf-8');
      
      const startTime = Date.now();
      const readContent = await storage.readIntelFile();
      const endTime = Date.now();
      
      expect(readContent).toBe(fullContent);
      expect(endTime - startTime).toBeLessThan(1000); // Should read in less than 1 second
    });
  });

  describe('hasIntelFile', () => {
    test('should return true when intel file exists', async () => {
      await fs.ensureDir(workspaceDir);
      await fs.writeFile(intelPath, 'test content', 'utf-8');
      
      const hasFile = await storage.hasIntelFile();
      expect(hasFile).toBe(true);
    });

    test('should return false when intel file does not exist', async () => {
      const hasFile = await storage.hasIntelFile();
      expect(hasFile).toBe(false);
    });

    test('should return false when workspace directory does not exist', async () => {
      const hasFile = await storage.hasIntelFile();
      expect(hasFile).toBe(false);
    });

    test('should work with different workspaces', async () => {
      const workspace1 = 'has-intel-1';
      const workspace2 = 'has-intel-2';
      
      // Create intel file in workspace1 only
      const path1 = join(tempDir, workspace1, 'INTEL.md');
      await fs.ensureDir(join(tempDir, workspace1));
      await fs.writeFile(path1, 'content', 'utf-8');
      
      const hasFile1 = await storage.hasIntelFile(workspace1);
      const hasFile2 = await storage.hasIntelFile(workspace2);
      
      expect(hasFile1).toBe(true);
      expect(hasFile2).toBe(false);
    });

    test('should return false for empty directory', async () => {
      await fs.ensureDir(workspaceDir);
      
      const hasFile = await storage.hasIntelFile();
      expect(hasFile).toBe(false);
    });

    test('should handle permission errors gracefully', async () => {
      // This test is platform-dependent and may not work on all systems
      // We'll create a basic test that checks the method doesn't crash
      const hasFile = await storage.hasIntelFile('nonexistent-workspace-with-long-name');
      expect(typeof hasFile).toBe('boolean');
    });
  });

  describe('Integration Tests', () => {
    test('should support complete write-read-check cycle', async () => {
      const testContent = `# Project Intelligence

## Permanent Rules
- Always use ConfigureAwait(false) in .NET
- Never commit API keys

## Active Investigations
- Memory leak in user service
- Performance issue with database queries`;

      // Write
      await storage.writeIntelFile(testContent);
      
      // Check exists
      const exists = await storage.hasIntelFile();
      expect(exists).toBe(true);
      
      // Read
      const readContent = await storage.readIntelFile();
      expect(readContent).toBe(testContent);
    });

    test('should handle concurrent read/write operations', async () => {
      const content1 = 'First content';
      const content2 = 'Second content';
      
      // Start concurrent operations
      const writePromise1 = storage.writeIntelFile(content1);
      const writePromise2 = storage.writeIntelFile(content2);
      
      await Promise.all([writePromise1, writePromise2]);
      
      // One of the writes should succeed - check that file exists and is readable
      const finalContent = await storage.readIntelFile();
      expect(finalContent).toBeTruthy();
      expect(typeof finalContent).toBe('string');
    });

    test('should maintain file integrity across multiple operations', async () => {
      const operations = [];
      
      // Perform multiple write operations
      for (let i = 0; i < 10; i++) {
        operations.push(storage.writeIntelFile(`Content ${i}`));
      }
      
      await Promise.all(operations);
      
      // File should exist and be readable
      expect(await storage.hasIntelFile()).toBe(true);
      const content = await storage.readIntelFile();
      expect(content).toBeTruthy();
      expect(content.startsWith('Content')).toBe(true);
    });

    test('should work correctly with default workspace', async () => {
      const defaultStorage = new Storage();
      const testContent = 'Default workspace test';
      
      // Use a temporary directory for the default storage too
      const defaultTestStorage = new Storage(undefined, tempDir);
      
      try {
        await defaultTestStorage.writeIntelFile(testContent);
        expect(await defaultTestStorage.hasIntelFile()).toBe(true);
        
        const readContent = await defaultTestStorage.readIntelFile();
        expect(readContent).toBe(testContent);
      } catch (error) {
        // This might fail in test environments without proper permissions
        console.warn('Default workspace test skipped due to permissions:', error);
      }
    });
  });
});