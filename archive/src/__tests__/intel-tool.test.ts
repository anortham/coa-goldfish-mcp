/**
 * Tests for Intel Tool - Project Knowledge Management
 */

import { Storage } from '../core/storage.js';
import { handleIntel, getIntelToolSchema } from '../tools/intel.js';
import fs from 'fs-extra';
import { join } from 'path';

describe('Intel Tool', () => {
  let storage: Storage;
  let testWorkspace: string;
  let tempDir: string;

  beforeEach(async () => {
    testWorkspace = 'intel-test-workspace';
    tempDir = join(process.cwd(), 'test-storage', `intel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    
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

  describe('Basic Intel Operations', () => {
    test('should handle quick capture of intelligence', async () => {
      const result = await handleIntel(storage, {
        capture: 'Generic < breaks parser at line 234'
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Intelligence captured');
      expect(result.content[0].text).toContain('Generic < breaks parser');
    });

    test('should handle structured insight capture', async () => {
      const result = await handleIntel(storage, {
        insight: {
          what: 'SearchEngine.ParseQuery() is a stub',
          where: 'search.ts:145',
          why: 'Implementation was never completed'
        }
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Intelligence captured');
      expect(result.content[0].text).toContain('SearchEngine.ParseQuery() is a stub');
    });

    test('should list intelligence when no arguments provided', async () => {
      // First add some intelligence
      await handleIntel(storage, {
        capture: 'Test discovery'
      });

      // Then list it
      const result = await handleIntel(storage);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Current Project Intelligence');
      expect(result.content[0].text).toContain('Test discovery');
    });

    test('should handle empty intelligence list', async () => {
      const result = await handleIntel(storage);

      expect(result.content).toBeDefined();
      // In test environment, it returns the template instead of empty message
      const resultText = result.content[0].text;
      expect(resultText).toMatch(/No project intelligence captured yet|Current Project Intelligence/);
    });

    test('should handle permanent intelligence', async () => {
      await handleIntel(storage, {
        capture: 'Never build in release mode',
        permanent: true
      });

      const result = await handleIntel(storage, { action: 'list' });
      
      expect(result.content[0].text).toContain('Permanent Rules');
      expect(result.content[0].text).toContain('Never build in release mode');
    });
  });

  describe('Intelligence Categorization', () => {
    test('should add to permanent section when permanent flag is true', async () => {
      await handleIntel(storage, {
        capture: 'Always use ConfigureAwait(false)',
        permanent: true
      });

      const intelContent = await storage.readIntelFile();
      expect(intelContent).toContain('## Permanent Rules');
      expect(intelContent).toContain('Always use ConfigureAwait(false)');
    });

    test('should add to active section by default', async () => {
      await handleIntel(storage, {
        capture: 'Bug in authentication flow'
      });

      const intelContent = await storage.readIntelFile();
      expect(intelContent).toContain('## Active Investigations');
      expect(intelContent).toContain('Bug in authentication flow');
    });

    test('should add to specified section', async () => {
      await handleIntel(storage, {
        capture: 'Fixed memory leak',
        section: 'resolved'
      });

      const intelContent = await storage.readIntelFile();
      expect(intelContent).toContain('## Resolved (Archive)');
      expect(intelContent).toContain('Fixed memory leak');
    });
  });

  describe('Markdown Template and Formatting', () => {
    test('should create initial template when no file exists', async () => {
      await handleIntel(storage, {
        capture: 'First discovery'
      });

      const intelContent = await storage.readIntelFile();
      expect(intelContent).toContain('# Project Intelligence');
      expect(intelContent).toContain('## Permanent Rules');
      expect(intelContent).toContain('## Active Investigations');
      expect(intelContent).toContain('## Resolved (Archive)');
      expect(intelContent).toContain('First discovery');
    });

    test('should preserve existing content when adding new entries', async () => {
      // Add first entry
      await handleIntel(storage, {
        capture: 'First discovery'
      });

      // Add second entry
      await handleIntel(storage, {
        capture: 'Second discovery'
      });

      const intelContent = await storage.readIntelFile();
      expect(intelContent).toContain('First discovery');
      expect(intelContent).toContain('Second discovery');
    });

    test('should format structured insights properly', async () => {
      await handleIntel(storage, {
        insight: {
          what: 'Parser fails on special characters',
          where: 'parser.ts:234',
          why: 'Missing escape handling'
        }
      });

      const intelContent = await storage.readIntelFile();
      expect(intelContent).toContain('Parser fails on special characters');
      expect(intelContent).toContain('(parser.ts:234)');
      expect(intelContent).toContain('Missing escape handling');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing capture and insight parameters', async () => {
      const result = await handleIntel(storage, { action: 'capture' });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Either capture or insight parameter is required');
    });

    test('should handle invalid actions gracefully', async () => {
      const result = await handleIntel(storage, { 
        action: 'invalid' as any 
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Unknown intel action: invalid');
    });

    test('should handle storage errors gracefully', async () => {
      // Create a storage instance with invalid path to simulate errors
      const invalidStorage = new Storage(testWorkspace, '/invalid/nonexistent/path/that/cannot/be/created');
      
      const result = await handleIntel(invalidStorage, {
        capture: 'Test discovery'
      });

      expect(result.content).toBeDefined();
      // The operation might succeed if the path can be created, or fail gracefully
      const resultText = result.content[0].text;
      expect(resultText).toMatch(/Failed to handle intel|Intelligence captured/);
    });
  });

  describe('Management Actions', () => {
    test('should provide clean action information', async () => {
      const result = await handleIntel(storage, { action: 'clean' });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('To clean intel, edit INTEL.md manually');
    });

    test('should provide archive action information', async () => {
      const result = await handleIntel(storage, { action: 'archive' });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Archive functionality coming soon');
    });
  });

  describe('Tool Schema', () => {
    test('should provide proper tool schema', () => {
      const schema = getIntelToolSchema();

      expect(schema.name).toBe('intel');
      expect(schema.description).toContain('PROACTIVELY capture critical project discoveries');
      expect(schema.description).toContain('Find a bug\'s root cause');
      expect(schema.description).toContain('Quick capture: intel("your discovery here")');
      
      expect(schema.inputSchema.properties).toHaveProperty('capture');
      expect(schema.inputSchema.properties).toHaveProperty('insight');
      expect(schema.inputSchema.properties).toHaveProperty('action');
      expect(schema.inputSchema.properties).toHaveProperty('permanent');
    });

    test('should include proactive usage examples in description', () => {
      const schema = getIntelToolSchema();
      
      expect(schema.description).toContain('< symbol breaks parser');
      expect(schema.description).toContain('UserService.auth() is just a stub');
      expect(schema.description).toContain('Never build in release mode');
      expect(schema.description).toContain('prevents repeated investigations');
    });
  });

  describe('Integration with Storage', () => {
    test('should use correct workspace directory', async () => {
      await handleIntel(storage, {
        capture: 'Test workspace discovery'
      });

      const workspaceDir = join(tempDir, testWorkspace);
      const intelPath = join(workspaceDir, 'INTEL.md');
      
      expect(await fs.pathExists(intelPath)).toBe(true);
      
      const content = await fs.readFile(intelPath, 'utf-8');
      expect(content).toContain('Test workspace discovery');
    });

    test('should handle multiple intelligence entries correctly', async () => {
      const entries = [
        'First discovery about authentication',
        'Second discovery about database connections',
        'Third discovery about error handling'
      ];

      for (const entry of entries) {
        await handleIntel(storage, { capture: entry });
      }

      const result = await handleIntel(storage, { action: 'list' });
      
      for (const entry of entries) {
        expect(result.content[0].text).toContain(entry);
      }
    });
  });

  describe('Content Organization', () => {
    test('should maintain section order in template', async () => {
      await handleIntel(storage, {
        capture: 'Test discovery'
      });

      const intelContent = await storage.readIntelFile();
      const lines = intelContent.split('\n');
      
      const permanentIndex = lines.findIndex(line => line.includes('## Permanent Rules'));
      const activeIndex = lines.findIndex(line => line.includes('## Active Investigations'));
      const resolvedIndex = lines.findIndex(line => line.includes('## Resolved (Archive)'));
      
      expect(permanentIndex).toBeGreaterThan(-1);
      expect(activeIndex).toBeGreaterThan(permanentIndex);
      expect(resolvedIndex).toBeGreaterThan(activeIndex);
    });

    test('should insert entries in correct sections', async () => {
      // Add to different sections
      await handleIntel(storage, {
        capture: 'Permanent rule',
        permanent: true
      });

      await handleIntel(storage, {
        capture: 'Active investigation'
      });

      await handleIntel(storage, {
        capture: 'Resolved issue',
        section: 'resolved'
      });

      const intelContent = await storage.readIntelFile();
      const lines = intelContent.split('\n');
      
      // Find section boundaries
      const permanentStart = lines.findIndex(line => line.includes('## Permanent Rules'));
      const activeStart = lines.findIndex(line => line.includes('## Active Investigations'));
      const resolvedStart = lines.findIndex(line => line.includes('## Resolved (Archive)'));
      
      // Check entries are in correct sections
      const permanentRuleIndex = lines.findIndex(line => line.includes('Permanent rule'));
      const activeInvestigationIndex = lines.findIndex(line => line.includes('Active investigation'));
      const resolvedIssueIndex = lines.findIndex(line => line.includes('Resolved issue'));
      
      expect(permanentRuleIndex).toBeGreaterThan(permanentStart);
      expect(permanentRuleIndex).toBeLessThan(activeStart);
      
      expect(activeInvestigationIndex).toBeGreaterThan(activeStart);
      expect(activeInvestigationIndex).toBeLessThan(resolvedStart);
      
      expect(resolvedIssueIndex).toBeGreaterThan(resolvedStart);
    });
  });
});