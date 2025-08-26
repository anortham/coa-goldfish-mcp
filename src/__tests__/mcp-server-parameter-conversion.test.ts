import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

describe('MCP Server Parameter Conversion', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-mcp-params-test-'));
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should convert string highlights to array format', () => {
    // Simulate the type conversion logic from index.ts
    const convertHighlights = (args: any) => {
      const checkpointArgs = { ...args };
      if (checkpointArgs.highlights !== undefined && typeof checkpointArgs.highlights === 'string') {
        checkpointArgs.highlights = [checkpointArgs.highlights];
      }
      return checkpointArgs;
    };

    // Test string input
    const stringInput = {
      description: 'Test checkpoint',
      highlights: 'Single highlight string'
    };
    
    const converted = convertHighlights(stringInput);
    expect(converted.highlights).toEqual(['Single highlight string']);
    expect(Array.isArray(converted.highlights)).toBe(true);
  });

  test('should preserve array highlights unchanged', () => {
    const convertHighlights = (args: any) => {
      const checkpointArgs = { ...args };
      if (checkpointArgs.highlights !== undefined && typeof checkpointArgs.highlights === 'string') {
        checkpointArgs.highlights = [checkpointArgs.highlights];
      }
      return checkpointArgs;
    };

    // Test array input
    const arrayInput = {
      description: 'Test checkpoint',
      highlights: ['First highlight', 'Second highlight']
    };
    
    const converted = convertHighlights(arrayInput);
    expect(converted.highlights).toEqual(['First highlight', 'Second highlight']);
    expect(Array.isArray(converted.highlights)).toBe(true);
  });

  test('should handle undefined highlights', () => {
    const convertHighlights = (args: any) => {
      const checkpointArgs = { ...args };
      if (checkpointArgs.highlights !== undefined && typeof checkpointArgs.highlights === 'string') {
        checkpointArgs.highlights = [checkpointArgs.highlights];
      }
      return checkpointArgs;
    };

    // Test undefined input
    const undefinedInput = {
      description: 'Test checkpoint'
      // highlights is undefined
    };
    
    const converted = convertHighlights(undefinedInput);
    expect(converted.highlights).toBeUndefined();
  });

  test('should handle empty string highlights', () => {
    const convertHighlights = (args: any) => {
      const checkpointArgs = { ...args };
      if (checkpointArgs.highlights !== undefined && typeof checkpointArgs.highlights === 'string') {
        checkpointArgs.highlights = [checkpointArgs.highlights];
      }
      return checkpointArgs;
    };

    // Test empty string input
    const emptyStringInput = {
      description: 'Test checkpoint',
      highlights: ''
    };
    
    const converted = convertHighlights(emptyStringInput);
    expect(converted.highlights).toEqual(['']);
    expect(Array.isArray(converted.highlights)).toBe(true);
  });
});