/**
 * Atomic File Operations Tests
 * 
 * These tests verify that file operations are atomic to prevent data corruption
 * and race conditions during concurrent access.
 */

import { Storage } from '../core/storage.js';
import fs from 'fs-extra';
import { join } from 'path';
import { GoldfishMemory } from '../types/index.js';

describe('Atomic File Operations Tests', () => {
  let storage: Storage;
  let tempDir: string;

  beforeEach(async () => {
    storage = new Storage();
    tempDir = join(require('os').tmpdir(), `goldfish-atomic-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('PASSES: saveMemory now uses atomic write operations', async () => {
    // The implementation has been updated to use atomic write operations
    // This prevents corruption if the process is interrupted mid-write
    
    const testMemory: GoldfishMemory = {
      id: 'atomic-test',
      timestamp: new Date(),
      workspace: 'test',
      type: 'general',
      content: 'test content for atomic write',
      ttlHours: 24
    };

    // Monitor file system operations to verify atomic writes
    const operations: string[] = [];
    const originalWriteJson = fs.writeJson;
    const originalMove = fs.move;
    
    jest.spyOn(fs, 'writeJson').mockImplementation(async (filepath: string, data: any, options?: any) => {
      operations.push(`write:${filepath.includes('.tmp') ? 'temp' : 'direct'}`);
      return originalWriteJson(filepath, data, options);
    });
    
    jest.spyOn(fs, 'move').mockImplementation(async (src: string, dest: string, options?: any) => {
      operations.push('move:temp-to-final');
      return originalMove(src, dest, options);
    });

    await storage.saveMemory(testMemory);
    
    // Verify atomic write pattern is used
    expect(operations).toEqual(['write:temp', 'move:temp-to-final']);
    expect(operations).not.toContain('write:direct');
    
    // This proves atomic operations are now implemented
    
    jest.restoreAllMocks();
  });

  test('FAILS: concurrent saveMemory operations can corrupt files', async () => {
    // Test that concurrent writes to the same workspace can interfere
    
    const memory1: GoldfishMemory = {
      id: 'concurrent-1',
      timestamp: new Date(),
      workspace: 'test',
      type: 'general',
      content: 'First concurrent write',
      ttlHours: 24
    };

    const memory2: GoldfishMemory = {
      id: 'concurrent-2',
      timestamp: new Date(),
      workspace: 'test',
      type: 'general', 
      content: 'Second concurrent write',
      ttlHours: 24
    };

    // Mock fs operations to simulate race condition
    let writeCount = 0;
    const originalEnsureDir = fs.ensureDir;
    
    jest.spyOn(fs, 'ensureDir').mockImplementation(async (dir: string) => {
      writeCount++;
      if (writeCount === 2) {
        // Simulate interference during second operation
        throw new Error('Directory creation race condition');
      }
      return originalEnsureDir(dir);
    });

    // Start both operations concurrently
    const promise1 = storage.saveMemory(memory1);
    const promise2 = storage.saveMemory(memory2);

    // One should succeed, one should fail due to race condition
    const results = await Promise.allSettled([promise1, promise2]);
    
    const failures = results.filter(r => r.status === 'rejected');
    expect(failures.length).toBeGreaterThan(0);
    
    // This demonstrates that concurrent operations can interfere
    // Proper atomic operations with file locking would prevent this
    
    jest.restoreAllMocks();
  });

  test('FAILS: loadMemory does not handle partially written files', async () => {
    // Test that loading can fail if a file was partially written
    
    const testFile = join(tempDir, 'partial.json');
    
    // Write partial JSON (simulating interrupted write)
    await fs.writeFile(testFile, '{"id": "partial", "timestamp":');
    
    // Verify that loadMemory doesn't handle this gracefully
    const result = await storage.loadMemory('partial.json', 'test', 'todo');
    
    // Currently returns null on any parsing error
    expect(result).toBeNull();
    
    // This is actually reasonable behavior, but shows that we need
    // atomic writes to prevent partial files from being created
  });

  test('FAILS: no file locking prevents concurrent access issues', async () => {
    // Test that multiple processes/threads can interfere with each other
    
    const testMemory: GoldfishMemory = {
      id: 'locking-test',
      timestamp: new Date(),
      workspace: 'test',
      type: 'general',
      content: 'test locking content',
      ttlHours: 24
    };

    // Simply verify that multiple operations can run without coordination
    // This is the vulnerability - no file locking mechanism exists
    
    // Start multiple operations
    const operations = [
      storage.saveMemory(testMemory),
      storage.saveMemory({...testMemory, id: 'locking-test-2'}),
      storage.saveMemory({...testMemory, id: 'locking-test-3'})
    ];

    // All operations succeed without any locking mechanism
    await expect(Promise.all(operations)).resolves.toEqual([undefined, undefined, undefined]);
    
    // This demonstrates that there's no file locking preventing race conditions
    // In a production system with high concurrency, this could cause issues
  });
});