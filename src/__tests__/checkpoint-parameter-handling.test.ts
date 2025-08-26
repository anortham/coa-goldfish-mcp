import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { Storage } from '../core/storage.js';
import { SessionManager } from '../core/session-manager.js';
import { CheckpointTool } from '../tools/checkpoint.js';

describe('Checkpoint Parameter Handling', () => {
  let testDir: string;
  let storage: Storage;
  let sessionManager: SessionManager;
  let checkpointTool: CheckpointTool;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-checkpoint-params-test-'));
    storage = new Storage('test-workspace', testDir);
    sessionManager = new SessionManager('test-workspace', storage);
    checkpointTool = new CheckpointTool(storage, sessionManager);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should handle highlights as string parameter', async () => {
    const checkpointArgs = {
      description: 'Test checkpoint with string highlights',
      highlights: 'Single highlight as string',
      activeFiles: ['test.ts'],
      gitBranch: 'main'
    };

    // This should not throw an error
    const result = await checkpointTool.createCheckpoint(checkpointArgs as any);
    
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('Test checkpoint with string highlights');
    expect(result.content[0].text).toContain('Single highlight as string');
  });

  test('should handle highlights as array parameter', async () => {
    const checkpointArgs = {
      description: 'Test checkpoint with array highlights',
      highlights: ['First highlight', 'Second highlight'],
      activeFiles: ['test1.ts', 'test2.ts'],
      gitBranch: 'feature-branch'
    };

    const result = await checkpointTool.createCheckpoint(checkpointArgs);
    
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('Test checkpoint with array highlights');
    expect(result.content[0].text).toContain('First highlight, Second highlight');
  });

  test('should handle empty highlights array', async () => {
    const checkpointArgs = {
      description: 'Test checkpoint with empty highlights',
      highlights: [],
      activeFiles: ['empty-test.ts']
    };

    const result = await checkpointTool.createCheckpoint(checkpointArgs);
    
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('Test checkpoint with empty highlights');
    expect(result.content[0].text).not.toContain('✨ Highlights:');
  });

  test('should handle missing highlights parameter', async () => {
    const checkpointArgs = {
      description: 'Test checkpoint without highlights',
      activeFiles: ['no-highlights.ts']
    };

    const result = await checkpointTool.createCheckpoint(checkpointArgs);
    
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('Test checkpoint without highlights');
    expect(result.content[0].text).not.toContain('✨ Highlights:');
  });

  test('should preserve checkpoint data in storage', async () => {
    const checkpointArgs = {
      description: 'Persistent checkpoint test',
      highlights: ['Data persistence test'],
      activeFiles: ['storage-test.ts']
    };

    await checkpointTool.createCheckpoint(checkpointArgs);
    
    // Verify the checkpoint was stored
    const memories = await storage.loadAllMemories();
    const checkpoints = memories.filter(m => m.type === 'checkpoint');
    
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].content.description).toBe('Persistent checkpoint test');
    expect(checkpoints[0].content.highlights).toEqual(['Data persistence test']);
    expect(checkpoints[0].content.activeFiles).toEqual(['storage-test.ts']);
  });
});