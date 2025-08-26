/**
 * Tests for TDD Agent Handoff Mechanism
 * 
 * Ensures reliable data passing between TDD phases:
 * test-designer → test-implementer → refactoring-expert → test-reviewer
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { Storage } from '../core/storage.js';
import { SearchEngine } from '../core/search.js';
import { SearchTools } from '../tools/search.js';
import { SessionManager } from '../core/session-manager.js';
import { handleRemember } from '../tools/remember.js';
import { GoldfishMemory } from '../types/index.js';

describe('TDD Agent Handoff Mechanism', () => {
  let storage: Storage;
  let searchEngine: SearchEngine;
  let searchTools: SearchTools;
  let sessionManager: SessionManager;
  let testDir: string;
  let originalProcessCwd: () => string;

  beforeEach(async () => {
    // Create isolated test environment
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-handoff-test-'));
    originalProcessCwd = process.cwd;
    process.cwd = () => testDir;
    
    // Initialize fresh storage for each test with unique workspace and base path
    const testBasePath = join(testDir, '.test-goldfish');
    const testWorkspace = `test-handoff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    storage = new Storage(testWorkspace, testBasePath);
    sessionManager = new SessionManager(storage);
    searchEngine = new SearchEngine(storage);
    searchTools = new SearchTools(storage, sessionManager);
  });

  afterEach(async () => {
    // Cleanup test directory and restore process
    process.cwd = originalProcessCwd;
    await fs.remove(testDir);
  });

  describe('Tag-Based Search Functionality', () => {
    it('should filter memories by exact tags', async () => {
      // Create test memories with different tag combinations
      await handleRemember(storage, {
        content: 'Test Designer handoff data',
        type: 'context',
        tags: ['handoff', 'from-test-designer', 'to-test-implementer', 'tdd-workflow']
      });

      await handleRemember(storage, {
        content: 'Test Implementer handoff data', 
        type: 'context',
        tags: ['handoff', 'from-test-implementer', 'to-refactoring-expert', 'tdd-workflow']
      });

      await handleRemember(storage, {
        content: 'Unrelated memory',
        type: 'general',
        tags: ['random', 'other']
      });

      // Test exact tag filtering
      const results = await searchEngine.searchMemories({
        tags: ['handoff', 'to-test-implementer'],
        type: 'context'
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Test Designer handoff data');
      expect(results[0].tags).toContain('from-test-designer');
      expect(results[0].tags).toContain('to-test-implementer');
    });

    it('should require ALL specified tags to match', async () => {
      await handleRemember(storage, {
        content: 'Partial match memory',
        type: 'context', 
        tags: ['handoff', 'from-test-designer', 'different-workflow']
      });

      await handleRemember(storage, {
        content: 'Full match memory',
        type: 'context',
        tags: ['handoff', 'from-test-designer', 'to-test-implementer', 'tdd-workflow']
      });

      // Should only return memories that have ALL specified tags
      const results = await searchEngine.searchMemories({
        tags: ['handoff', 'to-test-implementer', 'tdd-workflow'],
        type: 'context'
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Full match memory');
    });

    it('should work with empty tag arrays', async () => {
      await handleRemember(storage, {
        content: 'Memory without tags',
        type: 'context'
      });

      await handleRemember(storage, {
        content: 'Memory with tags',
        type: 'context',
        tags: ['handoff', 'test']
      });

      // Empty tags array should not filter
      const results = await searchEngine.searchMemories({
        tags: [],
        type: 'context'
      });

      expect(results).toHaveLength(2);
    });
  });

  describe('TDD Agent Handoff Patterns', () => {
    it('should support test-designer to test-implementer handoff', async () => {
      const testSpecs = {
        testFile: 'user-validation.test.ts',
        keyTypes: ['UserService', 'ValidationError'],
        expectedBehavior: 'Should validate email format and throw proper errors',
        architecture: 'Use dependency injection with proper error handling'
      };

      // Test-designer stores handoff
      await handleRemember(storage, {
        content: JSON.stringify({
          fromAgent: 'test-designer',
          toAgent: 'test-implementer', 
          phase: 'RED-to-GREEN',
          testSpecs,
          summary: 'Test suite created for user email validation'
        }),
        type: 'context',
        tags: ['handoff', 'from-test-designer', 'to-test-implementer', 'tdd-workflow']
      });

      // Test-implementer retrieves handoff
      const response = await searchTools.recall({
        type: 'context',
        tags: ['handoff', 'to-test-implementer'],
        limit: 5
      });

      expect(response.content).toHaveLength(1);
      const responseData = JSON.parse(response.content[0].text);
      expect(responseData.memoriesFound).toBe(1);
      
      const handoffData = JSON.parse(responseData.memories[0].content);
      expect(handoffData.fromAgent).toBe('test-designer');
      expect(handoffData.toAgent).toBe('test-implementer');
      expect(handoffData.phase).toBe('RED-to-GREEN');
      expect(handoffData.testSpecs.testFile).toBe('user-validation.test.ts');
    });

    it('should support test-implementer to refactoring-expert handoff', async () => {
      const implementationNotes = {
        filesModified: ['src/validation/EmailValidator.ts'],
        keyDecisions: ['Used regex pattern for email validation'],
        shortcuts: ['Basic regex only', 'No edge case handling'],
        needsRefactoring: ['More robust email patterns', 'Better error messages']
      };

      // Test-implementer stores handoff
      await handleRemember(storage, {
        content: JSON.stringify({
          fromAgent: 'test-implementer',
          toAgent: 'refactoring-expert',
          phase: 'GREEN-to-REFACTOR', 
          implementationNotes,
          summary: 'Basic email validation implemented - needs refactoring'
        }),
        type: 'context',
        tags: ['handoff', 'from-test-implementer', 'to-refactoring-expert', 'tdd-workflow']
      });

      // Refactoring-expert retrieves handoff
      const response = await searchTools.recall({
        type: 'context',
        tags: ['handoff', 'to-refactoring-expert'],
        limit: 5
      });

      expect(response.content).toHaveLength(1);
      const responseData = JSON.parse(response.content[0].text);
      expect(responseData.memoriesFound).toBe(1);

      const handoffData = JSON.parse(responseData.memories[0].content);
      expect(handoffData.fromAgent).toBe('test-implementer');
      expect(handoffData.toAgent).toBe('refactoring-expert');
      expect(handoffData.implementationNotes.filesModified).toContain('src/validation/EmailValidator.ts');
    });

    it('should support refactoring-expert to test-reviewer handoff', async () => {
      const refactoringNotes = {
        filesRefactored: ['src/validation/EmailValidator.ts', 'src/types/ValidationError.ts'],
        patternsApplied: ['Strategy pattern for validators'],
        smellsEliminated: ['Hardcoded error messages', 'Regex duplication'],
        areasNeedingAttention: ['Performance testing', 'Edge case coverage']
      };

      // Refactoring-expert stores handoff
      await handleRemember(storage, {
        content: JSON.stringify({
          fromAgent: 'refactoring-expert',
          toAgent: 'test-reviewer',
          phase: 'REFACTOR-to-REVIEW',
          refactoringNotes, 
          summary: 'Email validation refactored with strategy pattern - review coverage'
        }),
        type: 'context',
        tags: ['handoff', 'from-refactoring-expert', 'to-test-reviewer', 'tdd-workflow']
      });

      // Test-reviewer retrieves handoff
      const response = await searchTools.recall({
        type: 'context',
        tags: ['handoff', 'to-test-reviewer'],
        limit: 5
      });

      expect(response.content).toHaveLength(1);
      const responseData = JSON.parse(response.content[0].text);
      expect(responseData.memoriesFound).toBe(1);

      const handoffData = JSON.parse(responseData.memories[0].content);
      expect(handoffData.fromAgent).toBe('refactoring-expert');
      expect(handoffData.toAgent).toBe('test-reviewer');
      expect(handoffData.refactoringNotes.patternsApplied).toContain('Strategy pattern for validators');
    });
  });

  describe('Fallback Search Mechanism', () => {
    it('should find handoffs using query-based search when tag search fails', async () => {
      // Store handoff with old tag format (simulating legacy data)
      await handleRemember(storage, {
        content: JSON.stringify({
          fromAgent: 'test-designer',
          toAgent: 'test-implementer',
          phase: 'RED-to-GREEN',
          summary: 'Legacy handoff data'
        }),
        type: 'context',
        tags: ['handoff', 'test-designer-to-implementer', 'tdd-workflow'] // old format
      });

      // Tag-based search should fail
      let response = await searchTools.recall({
        type: 'context',
        tags: ['handoff', 'to-test-implementer'],
        limit: 5
      });

      // When no memories found, returns text message instead of JSON
      expect(response.content[0].text).toContain('No memories found');

      // Fallback query-based search should succeed  
      response = await searchTools.recall({
        query: 'handoff test-designer',
        type: 'context',
        since: '24h',
        limit: 5
      });

      const responseData = JSON.parse(response.content[0].text);
      expect(responseData.memoriesFound).toBe(1);
      
      const handoffData = JSON.parse(responseData.memories[0].content);
      expect(handoffData.fromAgent).toBe('test-designer');
      expect(handoffData.summary).toBe('Legacy handoff data');
    });

    it('should prioritize exact tag matches over fuzzy query matches', async () => {
      // Store both new format and old format handoffs
      await handleRemember(storage, {
        content: JSON.stringify({
          fromAgent: 'test-designer',
          toAgent: 'test-implementer',
          phase: 'RED-to-GREEN',
          summary: 'New format handoff',
          priority: 'high'
        }),
        type: 'context',
        tags: ['handoff', 'from-test-designer', 'to-test-implementer', 'tdd-workflow']
      });

      await handleRemember(storage, {
        content: JSON.stringify({
          fromAgent: 'test-designer', 
          toAgent: 'test-implementer',
          phase: 'RED-to-GREEN',
          summary: 'Old format handoff',
          priority: 'low'
        }),
        type: 'context',
        tags: ['handoff', 'test-designer-to-implementer', 'tdd-workflow']
      });

      // Tag-based search should find new format first
      const response = await searchTools.recall({
        type: 'context',
        tags: ['handoff', 'to-test-implementer'],
        limit: 5
      });

      const responseData = JSON.parse(response.content[0].text);
      expect(responseData.memoriesFound).toBe(1);

      const handoffData = JSON.parse(responseData.memories[0].content);
      expect(handoffData.summary).toBe('New format handoff');
      expect(handoffData.priority).toBe('high');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle memories without tags gracefully', async () => {
      await handleRemember(storage, {
        content: 'Memory without tags',
        type: 'context'
      });

      const results = await searchEngine.searchMemories({
        tags: ['handoff', 'to-test-implementer'],
        type: 'context'
      });

      expect(results).toHaveLength(0);
    });

    it('should handle empty handoff search results', async () => {
      const response = await searchTools.recall({
        type: 'context',
        tags: ['handoff', 'to-nonexistent-agent'],
        limit: 5
      });

      // When no memories found, returns text message instead of JSON structure
      expect(response.content[0].text).toContain('No memories found');
    });

    it('should handle malformed handoff JSON gracefully', async () => {
      await handleRemember(storage, {
        content: '{"invalid": json malformed',
        type: 'context',
        tags: ['handoff', 'from-test-designer', 'to-test-implementer', 'tdd-workflow']
      });

      const response = await searchTools.recall({
        type: 'context',
        tags: ['handoff', 'to-test-implementer'],
        limit: 5
      });

      expect(response.content).toHaveLength(1);
      const responseData = JSON.parse(response.content[0].text);
      expect(responseData.memoriesFound).toBe(1);
      // Should still return the memory even if JSON is malformed
      expect(responseData.memories[0].content).toContain('invalid');
    });

    it('should respect time filters in handoff searches', async () => {
      // Create old handoff
      const oldMemory: GoldfishMemory = {
        id: 'old-handoff',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        workspace: 'test-handoff',
        type: 'context',
        content: JSON.stringify({ fromAgent: 'test-designer', summary: 'Old handoff' }),
        ttlHours: 168,
        tags: ['handoff', 'from-test-designer', 'to-test-implementer', 'tdd-workflow']
      };
      await storage.saveMemory(oldMemory);

      // Create recent handoff
      await handleRemember(storage, {
        content: JSON.stringify({ fromAgent: 'test-designer', summary: 'Recent handoff' }),
        type: 'context',
        tags: ['handoff', 'from-test-designer', 'to-test-implementer', 'tdd-workflow']
      });

      // Search with time filter should only return recent
      const response = await searchTools.recall({
        type: 'context',
        tags: ['handoff', 'to-test-implementer'],
        since: '3d',
        limit: 5
      });

      const responseData = JSON.parse(response.content[0].text);
      expect(responseData.memoriesFound).toBe(1);
      
      const handoffData = JSON.parse(responseData.memories[0].content);
      expect(handoffData.summary).toBe('Recent handoff');
    });
  });

  describe('Complete TDD Workflow Integration', () => {
    it('should support full workflow: designer → implementer → refactorer → reviewer', async () => {
      // Phase 1: Test Designer creates failing tests
      const designerHandoff = {
        fromAgent: 'test-designer',
        toAgent: 'test-implementer',
        phase: 'RED-to-GREEN',
        testSpecs: {
          testFile: 'user-service.test.ts',
          keyTypes: ['UserService', 'User'],
          expectedBehavior: 'Should create user with validation',
          architecture: 'Repository pattern with dependency injection'
        },
        summary: 'Created failing tests for user creation with validation'
      };

      await handleRemember(storage, {
        content: JSON.stringify(designerHandoff),
        type: 'context',
        tags: ['handoff', 'from-test-designer', 'to-test-implementer', 'tdd-workflow']
      });

      // Phase 2: Test Implementer makes tests pass
      const implementerHandoff = {
        fromAgent: 'test-implementer',
        toAgent: 'refactoring-expert', 
        phase: 'GREEN-to-REFACTOR',
        implementationNotes: {
          filesModified: ['src/services/UserService.ts', 'src/repositories/UserRepository.ts'],
          keyDecisions: ['Basic validation only', 'In-memory storage for now'],
          shortcuts: ['No persistence layer', 'Hardcoded validation rules'],
          needsRefactoring: ['Add database persistence', 'Extract validation logic', 'Add error handling']
        },
        summary: 'Basic user creation implemented - needs refactoring for production'
      };

      await handleRemember(storage, {
        content: JSON.stringify(implementerHandoff),
        type: 'context',
        tags: ['handoff', 'from-test-implementer', 'to-refactoring-expert', 'tdd-workflow']
      });

      // Phase 3: Refactoring Expert improves code quality
      const refactorerHandoff = {
        fromAgent: 'refactoring-expert',
        toAgent: 'test-reviewer',
        phase: 'REFACTOR-to-REVIEW',
        refactoringNotes: {
          filesRefactored: ['src/services/UserService.ts', 'src/validation/UserValidator.ts'],
          patternsApplied: ['Strategy pattern for validation', 'Repository pattern'],
          smellsEliminated: ['Hardcoded validation', 'Tight coupling'],
          performanceImprovements: ['Lazy loading of validators'],
          areasNeedingAttention: ['Integration test coverage', 'Error boundary testing']
        },
        summary: 'Refactored user service with proper patterns - needs comprehensive review'
      };

      await handleRemember(storage, {
        content: JSON.stringify(refactorerHandoff),
        type: 'context',
        tags: ['handoff', 'from-refactoring-expert', 'to-test-reviewer', 'tdd-workflow']
      });

      // Verify each phase can retrieve its handoff
      const implementerResponse = await searchTools.recall({
        type: 'context',
        tags: ['handoff', 'to-test-implementer'],
        limit: 1
      });

      const refactorerResponse = await searchTools.recall({
        type: 'context', 
        tags: ['handoff', 'to-refactoring-expert'],
        limit: 1
      });

      const reviewerResponse = await searchTools.recall({
        type: 'context',
        tags: ['handoff', 'to-test-reviewer'], 
        limit: 1
      });

      // Verify all handoffs are found
      expect(JSON.parse(implementerResponse.content[0].text).memoriesFound).toBe(1);
      expect(JSON.parse(refactorerResponse.content[0].text).memoriesFound).toBe(1);
      expect(JSON.parse(reviewerResponse.content[0].text).memoriesFound).toBe(1);

      // Verify handoff data integrity
      const implementerData = JSON.parse(JSON.parse(implementerResponse.content[0].text).memories[0].content);
      expect(implementerData.testSpecs.testFile).toBe('user-service.test.ts');
      
      const refactorerData = JSON.parse(JSON.parse(refactorerResponse.content[0].text).memories[0].content);
      expect(refactorerData.implementationNotes.filesModified).toContain('src/services/UserService.ts');

      const reviewerData = JSON.parse(JSON.parse(reviewerResponse.content[0].text).memories[0].content);
      expect(reviewerData.refactoringNotes.patternsApplied).toContain('Strategy pattern for validation');
    });

    it('should maintain handoff chain context across phases', async () => {
      // Create a workflow where each phase references previous work
      const workflowId = 'user-auth-feature-123';
      
      await handleRemember(storage, {
        content: JSON.stringify({
          fromAgent: 'test-designer',
          toAgent: 'test-implementer',
          workflowId,
          phase: 'RED-to-GREEN',
          summary: 'Phase 1: Tests created for user authentication'
        }),
        type: 'context',
        tags: ['handoff', 'from-test-designer', 'to-test-implementer', 'tdd-workflow', workflowId]
      });

      await handleRemember(storage, {
        content: JSON.stringify({
          fromAgent: 'test-implementer',
          toAgent: 'refactoring-expert',
          workflowId,
          phase: 'GREEN-to-REFACTOR', 
          summary: 'Phase 2: Basic auth implemented',
          references: ['Phase 1: Tests created for user authentication']
        }),
        type: 'context',
        tags: ['handoff', 'from-test-implementer', 'to-refactoring-expert', 'tdd-workflow', workflowId]
      });

      // Search by workflow ID should return related handoffs
      const workflowHandoffs = await searchEngine.searchMemories({
        tags: [workflowId, 'tdd-workflow'],
        type: 'context'
      });

      expect(workflowHandoffs).toHaveLength(2);
      
      const phases = workflowHandoffs.map(h => JSON.parse(h.content as string).phase);
      expect(phases).toContain('RED-to-GREEN');
      expect(phases).toContain('GREEN-to-REFACTOR');
    });
  });
});