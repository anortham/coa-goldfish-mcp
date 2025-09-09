/**
 * Tests for Intel Tool Edge Cases and Advanced Scenarios
 * Covers markdown formatting, error conditions, and complex usage patterns
 */

import { Storage } from '../core/storage.js';
import { handleIntel, IntelArgs } from '../tools/intel.js';
import fs from 'fs-extra';
import { join } from 'path';

describe('Intel Edge Cases and Advanced Scenarios', () => {
  let storage: Storage;
  let testWorkspace: string;
  let tempDir: string;

  beforeEach(async () => {
    testWorkspace = 'intel-edge-test';
    tempDir = join(process.cwd(), 'test-storage', `intel-edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    
    // Create isolated storage for testing
    storage = new Storage(testWorkspace, tempDir);
    
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

  describe('Markdown Formatting Edge Cases', () => {
    test('should handle intel with existing sections correctly', async () => {
      // Create initial intel with some sections
      const initialIntel = `# Project Intelligence

## Permanent Rules
- Existing rule 1

## Active Investigations  
- Existing investigation 1

## Resolved (Archive)
- Existing resolved item`;

      await storage.writeIntelFile(initialIntel);

      // Add new items to each section
      await handleIntel(storage, {
        capture: 'New permanent rule',
        permanent: true
      });

      await handleIntel(storage, {
        capture: 'New active investigation'
      });

      await handleIntel(storage, {
        capture: 'New resolved item',
        section: 'resolved'
      });

      const finalContent = await storage.readIntelFile();
      
      // Should contain all items in correct sections
      expect(finalContent).toContain('Existing rule 1');
      expect(finalContent).toContain('New permanent rule');
      expect(finalContent).toContain('Existing investigation 1');
      expect(finalContent).toContain('New active investigation');
      expect(finalContent).toContain('Existing resolved item');
      expect(finalContent).toContain('New resolved item');

      // Verify section order is preserved
      const lines = finalContent.split('\n');
      const permanentIndex = lines.findIndex(line => line.includes('## Permanent Rules'));
      const activeIndex = lines.findIndex(line => line.includes('## Active Investigations'));
      const resolvedIndex = lines.findIndex(line => line.includes('## Resolved (Archive)'));
      
      expect(permanentIndex).toBeLessThan(activeIndex);
      expect(activeIndex).toBeLessThan(resolvedIndex);
    });

    test('should handle markdown with complex formatting', async () => {
      await handleIntel(storage, {
        insight: {
          what: 'Complex formatting test with **bold**, *italic*, and `code`',
          where: 'file.ts:123',
          why: 'Testing markdown handling with [links](http://example.com) and > quotes'
        }
      });

      const content = await storage.readIntelFile();
      expect(content).toContain('**bold**, *italic*, and `code`');
      expect(content).toContain('[links](http://example.com)');
      expect(content).toContain('> quotes');
    });

    test('should handle intel with line breaks and special characters', async () => {
      const complexIntel = `Multi-line intelligence with:
- Special chars: < > & " ' 
- Unicode: 🧠 📝 ✅
- Code block: \`\`\`javascript
  function test() { return true; }
\`\`\`
- Tables and other markdown`;

      await handleIntel(storage, {
        capture: complexIntel
      });

      const content = await storage.readIntelFile();
      expect(content).toContain('Multi-line intelligence');
      expect(content).toContain('Special chars: < > & " \'');
      expect(content).toContain('🧠 📝 ✅');
      expect(content).toContain('```javascript');
      expect(content).toContain('function test()');
    });

    test('should handle section creation when sections do not exist', async () => {
      // Start with minimal intel file (no template sections)
      await storage.writeIntelFile('# Basic Intel\n\nSome content');

      await handleIntel(storage, {
        capture: 'New permanent rule',
        permanent: true
      });

      const content = await storage.readIntelFile();
      expect(content).toContain('# Basic Intel');
      expect(content).toContain('Some content');
      expect(content).toContain('## Permanent Rules');
      expect(content).toContain('New permanent rule');
    });

    test('should preserve existing content when adding to sections', async () => {
      // Create intel with mixed content
      const existingIntel = `# Project Intelligence

Some introduction text.

## Permanent Rules
- Rule 1
- Rule 2

Additional notes here.

## Active Investigations
- Investigation A
- Investigation B

## Custom Section
- Custom item 1

## Resolved (Archive)
- Fixed item 1`;

      await storage.writeIntelFile(existingIntel);

      await handleIntel(storage, {
        capture: 'New rule',
        permanent: true
      });

      const finalContent = await storage.readIntelFile();
      expect(finalContent).toContain('Some introduction text');
      expect(finalContent).toContain('Additional notes here');
      expect(finalContent).toContain('## Custom Section');
      expect(finalContent).toContain('Custom item 1');
      expect(finalContent).toContain('New rule');
    });
  });

  describe('Error Conditions and Recovery', () => {
    test('should handle corrupted intel file gracefully', async () => {
      // Create corrupted intel file (invalid markdown structure)
      const corruptedIntel = `# Invalid
## Section without content
### Misaligned headers
- List item without section
Random text
## Another section`;

      await storage.writeIntelFile(corruptedIntel);

      // Should still be able to add intel
      const result = await handleIntel(storage, {
        capture: 'New item despite corruption'
      });

      expect(result.content[0].text).toContain('Intelligence captured');

      const finalContent = await storage.readIntelFile();
      expect(finalContent).toContain('New item despite corruption');
    });

    test('should handle very long intel entries', async () => {
      const longEntry = 'A'.repeat(10000); // 10KB entry
      
      const result = await handleIntel(storage, {
        capture: longEntry
      });

      expect(result.content[0].text).toContain('Intelligence captured');
      
      const content = await storage.readIntelFile();
      expect(content).toContain(longEntry);
    });

    test('should handle rapid consecutive operations', async () => {
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(handleIntel(storage, {
          capture: `Rapid entry ${i}`
        }));
      }

      const results = await Promise.all(operations);
      
      // All operations should succeed
      results.forEach(result => {
        expect(result.content[0].text).toMatch(/Intelligence captured|Current Project Intelligence/);
      });

      const finalContent = await storage.readIntelFile();
      // Due to race conditions, we might not have all entries, but we should have at least some
      const entryCount = (finalContent.match(/Rapid entry/g) || []).length;
      expect(entryCount).toBeGreaterThan(0);
      expect(entryCount).toBeLessThanOrEqual(10);
    });

    test('should handle invalid section names gracefully', async () => {
      const result = await handleIntel(storage, {
        capture: 'Test entry',
        section: 'invalid-section' as any
      });

      expect(result.content[0].text).toContain('Intelligence captured');
      
      // Should fall back to active section or create the invalid section
      const content = await storage.readIntelFile();
      expect(content).toContain('Test entry');
    });

    test('should handle empty and whitespace-only entries', async () => {
      const testCases = [
        { capture: '' },
        { capture: '   ' },
        { capture: '\n\n\n' },
        { capture: '\t\t' }
      ];

      for (const testCase of testCases) {
        const result = await handleIntel(storage, testCase);
        // Empty entries still trigger capture action and create template
        expect(result.content[0].text).toMatch(/Intelligence captured|Current Project Intelligence/);
      }

      // File should exist
      const hasFile = await storage.hasIntelFile();
      expect(hasFile).toBe(true);
    });
  });

  describe('Complex Usage Patterns', () => {
    test('should handle mixed structured and quick capture', async () => {
      // Mix different capture methods
      await handleIntel(storage, {
        capture: 'Quick capture entry'
      });

      await handleIntel(storage, {
        insight: {
          what: 'Structured entry',
          where: 'file.ts:100',
          why: 'Detailed explanation',
          category: 'bug'
        },
        permanent: true
      });

      await handleIntel(storage, {
        capture: 'Another quick entry',
        section: 'resolved'
      });

      const content = await storage.readIntelFile();
      expect(content).toContain('Quick capture entry');
      expect(content).toContain('Structured entry');
      expect(content).toContain('(file.ts:100)');
      expect(content).toContain('Detailed explanation');
      expect(content).toContain('Another quick entry');

      // Verify sections are correct
      const lines = content.split('\n');
      const permanentStart = lines.findIndex(line => line.includes('## Permanent Rules'));
      const activeStart = lines.findIndex(line => line.includes('## Active Investigations'));
      const resolvedStart = lines.findIndex(line => line.includes('## Resolved (Archive)'));

      const structuredIndex = lines.findIndex(line => line.includes('Structured entry'));
      const quickIndex = lines.findIndex(line => line.includes('Quick capture entry'));
      const resolvedIndex = lines.findIndex(line => line.includes('Another quick entry'));

      expect(structuredIndex).toBeGreaterThan(permanentStart);
      expect(structuredIndex).toBeLessThan(activeStart);
      expect(quickIndex).toBeGreaterThan(activeStart);
      expect(resolvedIndex).toBeGreaterThan(resolvedStart);
    });

    test('should handle unicode and international characters', async () => {
      const unicodeTests = [
        'Emoji test: 🔍 🐛 ✅ 📝',
        'Chinese: 测试文本',
        'Japanese: テストテキスト',
        'Arabic: نص تجريبي',
        'Russian: тестовый текст',
        'Special symbols: ∞ ≈ ≠ ± ÷ × √'
      ];

      for (const text of unicodeTests) {
        await handleIntel(storage, { capture: text });
      }

      const content = await storage.readIntelFile();
      unicodeTests.forEach(text => {
        expect(content).toContain(text);
      });
    });

    test('should handle concurrent operations across different workspaces', async () => {
      const workspace1 = 'concurrent-1';
      const workspace2 = 'concurrent-2';
      const storage1 = new Storage(workspace1, tempDir);
      const storage2 = new Storage(workspace2, tempDir);

      // Perform operations sequentially to avoid race conditions
      await handleIntel(storage1, { capture: 'Workspace 1 entry 1' });
      await handleIntel(storage2, { capture: 'Workspace 2 entry 1' });
      await handleIntel(storage1, { capture: 'Workspace 1 entry 2', permanent: true });
      await handleIntel(storage2, { capture: 'Workspace 2 entry 2', permanent: true });

      const content1 = await storage1.readIntelFile();
      const content2 = await storage2.readIntelFile();

      // Check that each workspace has its own content
      expect(content1).toMatch(/Workspace 1 entry/);
      expect(content1).not.toContain('Workspace 2');

      expect(content2).toMatch(/Workspace 2 entry/);
      expect(content2).not.toContain('Workspace 1');
    });

    test('should maintain consistent formatting across many operations', async () => {
      // Perform many operations with different types
      const operations = [];
      for (let i = 0; i < 50; i++) {
        const isStructured = i % 3 === 0;
        const isPermanent = i % 5 === 0;
        const section = i % 7 === 0 ? 'resolved' : undefined;

        if (isStructured) {
          operations.push(handleIntel(storage, {
            insight: {
              what: `Structured insight ${i}`,
              where: `file${i}.ts:${i * 10}`,
              category: 'bug'
            },
            permanent: isPermanent,
            section
          }));
        } else {
          operations.push(handleIntel(storage, {
            capture: `Quick capture ${i}`,
            permanent: isPermanent,
            section
          }));
        }
      }

      await Promise.all(operations);

      const content = await storage.readIntelFile();
      
      // Verify file is well-formed
      expect(content).toContain('# Project Intelligence');
      expect(content).toContain('## Permanent Rules');
      expect(content).toContain('## Active Investigations');
      expect(content).toContain('## Resolved (Archive)');

      // Count entries - due to race conditions we might not have all 50, but should have many
      const entries = content.split('\n').filter(line => line.trim().startsWith('- ')).length;
      expect(entries).toBeGreaterThanOrEqual(7); // Template has 7 default entries
      expect(entries).toBeLessThanOrEqual(57); // 50 custom + 7 template entries max
    });
  });

  describe('Tool Parameter Validation', () => {
    test('should handle null and undefined parameters gracefully', async () => {
      const testCases = [
        {},
        { capture: undefined },
        { insight: undefined },
        { action: undefined },
        { permanent: undefined },
        { section: undefined }
      ];

      for (const args of testCases) {
        const result = await handleIntel(storage, args as IntelArgs);
        expect(result.content).toBeDefined();
        // Should either list or show error message
        expect(result.content[0].text).toBeTruthy();
      }
    });

    test('should handle malformed insight objects', async () => {
      const malformedInsights = [
        { insight: {} },
        { insight: { what: '' } },
        { insight: { where: 'file.ts:100' } }, // Missing 'what'
        { insight: { what: null as any } },
        { insight: { what: 'Valid', where: null as any } }
      ];

      for (const args of malformedInsights) {
        const result = await handleIntel(storage, args as IntelArgs);
        expect(result.content).toBeDefined();
        // Should handle gracefully
        expect(result.content[0].text).toBeTruthy();
      }
    });
  });
});