/**
 * Integration test for the complete Goldfish workflow:
 * Plan → TODOs → Checkpoints → Standup
 * 
 * Tests the 4-tool evolution with relationship tracking
 */

import { Storage } from '../core/storage.js';
import { IndexManager } from '../core/index-manager.js';
import { ConfigManager } from '../core/config.js';
import { handlePlan } from '../tools/plan.js';
import { handleTodo } from '../tools/todo.js';
import { handleStandup } from '../tools/standup.js';
import { UnifiedCheckpointTool } from '../tools/checkpoint-unified.js';
import { SessionManager } from '../core/session-manager.js';
import { join } from 'path';
import fs from 'fs-extra';

describe('Complete Workflow Integration', () => {
  let storage: Storage;
  let indexManager: IndexManager;
  let checkpointTool: UnifiedCheckpointTool;
  let sessionManager: SessionManager;
  let testWorkspace: string;
  let testBasePath: string;

  beforeEach(async () => {
    // Setup isolated test environment
    testWorkspace = 'workflow-test';
    testBasePath = join(process.cwd(), '.test-goldfish-workflow');
    
    storage = new Storage(testWorkspace, testBasePath);
    sessionManager = new SessionManager(testWorkspace, storage);
    indexManager = new IndexManager(storage, testWorkspace);
    checkpointTool = new UnifiedCheckpointTool(storage, sessionManager);
    
    // Ensure clean test environment
    await fs.remove(testBasePath);
    await fs.ensureDir(testBasePath);
  });

  afterEach(async () => {
    // Cleanup test files
    await fs.remove(testBasePath);
  });

  describe('Phase 1: Plan Creation and Management', () => {
    test('should create a strategic plan successfully', async () => {
      const planResult = await handlePlan(storage, {
        action: 'save',
        title: 'Implement User Authentication System',
        description: `# User Authentication System Implementation

## Overview
Build a complete authentication system with JWT tokens, password reset, and social login.

## Phases
1. **Core Authentication**
   - JWT token management
   - Login/logout flows
   - Password hashing with bcrypt

2. **Security Features** 
   - Password reset via email
   - Account lockout after failed attempts
   - Session management

3. **Social Integration**
   - Google OAuth2
   - GitHub OAuth2
   - Profile linking

## Success Criteria
- All authentication flows working
- Security audit passed
- Performance benchmarks met`,
        items: [
          'Set up JWT infrastructure',
          'Implement login/logout flows', 
          'Add password reset functionality',
          'Integrate social login providers',
          'Security audit and testing'
        ],
        category: 'feature',
        priority: 'high',
        tags: ['authentication', 'security', 'backend'],
        workspace: testWorkspace,
        format: 'json'
      });

      expect(planResult.isError).toBe(false);
      expect(planResult.content).toBeDefined();
      
      const planData = JSON.parse(planResult.content[0].text).data;
      expect(planData.title).toBe('Implement User Authentication System');
      expect(planData.status).toBe('draft');
      
      // Verify plan was saved to storage
      const memories = await storage.loadAllMemories(testWorkspace);
      const planMemories = memories.filter(m => m.type === 'plan');
      expect(planMemories).toHaveLength(1);
      
      // Verify index was updated
      const index = await indexManager.loadIndex();
      expect(index.relationships).toHaveLength(1);
      expect(index.relationships[0].planTitle).toBe('Implement User Authentication System');
      expect(index.relationships[0].planStatus).toBe('draft');
    });

    test('should list plans correctly', async () => {
      // Create multiple plans
      await handlePlan(storage, {
        action: 'save',
        title: 'Plan A',
        description: 'Description A',
        category: 'feature',
        workspace: testWorkspace
      });

      await handlePlan(storage, {
        action: 'save', 
        title: 'Plan B',
        description: 'Description B',
        category: 'refactor',
        workspace: testWorkspace
      });

      const listResult = await handlePlan(storage, {
        action: 'list',
        workspace: testWorkspace,
        format: 'json'
      });

      expect(listResult.isError).toBe(false);
      const parsedResult = JSON.parse(listResult.content[0].text);
      const listData = parsedResult.data;
      expect(listData.plans).toHaveLength(2);
      expect(listData.plans.map((p: any) => p.title)).toEqual(['Plan B', 'Plan A']); // Sorted by newest first
    });
  });

  describe('Phase 2: TODO Generation from Plans', () => {
    let planId: string;

    beforeEach(async () => {
      const planResult = await handlePlan(storage, {
        action: 'save',
        title: 'API Development Plan',
        description: 'Build REST API endpoints',
        items: [
          'Design API schema',
          'Implement authentication middleware',
          'Create CRUD endpoints',
          'Add rate limiting',
          'Write API documentation'
        ],
        category: 'feature',
        workspace: testWorkspace,
        format: 'json'
      });
      
      planId = JSON.parse(planResult.content[0].text).data.planId;
    });

    test('should generate TODOs from plan successfully', async () => {
      const todoResult = await handlePlan(storage, {
        action: 'generate-todos',
        planId: planId,
        workspace: testWorkspace
      });

      expect(todoResult.isError).toBe(false);
      
      // Verify TODO list was created
      const memories = await storage.loadAllMemories(testWorkspace);
      const todoMemories = memories.filter(m => m.type === 'todo');
      expect(todoMemories).toHaveLength(1);
      
      // Verify plan status changed to active
      const planMemories = memories.filter(m => m.type === 'plan');
      const plan = planMemories[0].content as any;
      expect(plan.status).toBe('active');
      expect(plan.generatedTodos).toHaveLength(1);
      
      // Verify relationship tracking
      const index = await indexManager.loadIndex();
      const planRelation = index.relationships.find(r => r.planId === planId);
      expect(planRelation).toBeDefined();
      expect(planRelation!.linkedTodos).toHaveLength(1);
      expect(planRelation!.planStatus).toBe('active');
    });

    test('should manage TODO items correctly', async () => {
      // Generate TODOs from plan
      await handlePlan(storage, {
        action: 'generate-todos',
        planId: planId,
        workspace: testWorkspace
      });

      // Get the generated TODO list
      const memories = await storage.loadAllMemories(testWorkspace);
      const todoMemory = memories.find(m => m.type === 'todo')!;
      const todoListId = todoMemory.id;

      // Update a TODO item to completed
      const updateResult = await handleTodo(storage, {
        action: 'update',
        listId: todoListId,
        itemId: '1', // First item (1-based indexing)
        status: 'done',
        workspace: testWorkspace
      });

      expect(updateResult.isError).toBe(false);
      
      // Verify the update
      const updatedMemories = await storage.loadAllMemories(testWorkspace);
      const updatedTodoMemory = updatedMemories.find(m => m.id === todoListId)!;
      const updatedTodo = updatedTodoMemory.content as any;
      
      expect(updatedTodo.items[0].status).toBe('done');
      const completedCount = updatedTodo.items.filter((item: any) => item.status === 'done').length;
      expect(completedCount).toBe(1);
    });
  });

  describe('Phase 3: Checkpoint Creation and Tracking', () => {
    test('should create checkpoints with auto-linking', async () => {
      // Create a plan first
      const planResult = await handlePlan(storage, {
        action: 'save',
        title: 'Database Migration Plan',
        description: 'Migrate from MySQL to PostgreSQL',
        workspace: testWorkspace,
        format: 'json'
      });
      const planId = JSON.parse(planResult.content[0].text).data.planId;

      // Create checkpoint
      const checkpointResult = await checkpointTool.handleUnifiedCheckpoint({
        action: 'save',
        description: 'Completed database schema analysis',
        highlights: ['Identified 15 tables to migrate', 'Found 3 complex foreign key relationships'],
        activeFiles: ['src/db/schema.sql', 'migration/analysis.md'],
        workContext: `Working on Database Migration Plan - analyzed current schema structure`,
        workspace: testWorkspace
      });

      expect(checkpointResult.isError).toBe(false);
      
      // Verify checkpoint was created
      const memories = await storage.loadAllMemories(testWorkspace);
      const checkpointMemories = memories.filter(m => m.type === 'checkpoint');
      expect(checkpointMemories).toHaveLength(1);
      
      const checkpoint = checkpointMemories[0];
      expect(checkpoint.content).toMatchObject({
        description: 'Completed database schema analysis',
        highlights: expect.arrayContaining(['Identified 15 tables to migrate']),
        activeFiles: expect.arrayContaining(['src/db/schema.sql'])
      });
    });

    test('should support session restore functionality', async () => {
      // Create multiple checkpoints
      await checkpointTool.handleUnifiedCheckpoint({
        action: 'save',
        description: 'Initial setup completed',
        highlights: ['Project structure created'],
        workspace: testWorkspace
      });

      await checkpointTool.handleUnifiedCheckpoint({
        action: 'save', 
        description: 'Authentication module finished',
        highlights: ['JWT integration working', 'Login/logout flows implemented'],
        workspace: testWorkspace
      });

      // Restore session with highlights
      const restoreResult = await checkpointTool.handleUnifiedCheckpoint({
        action: 'restore',
        depth: 'highlights',
        workspace: testWorkspace,
        outputFormat: 'plain'
      });

      expect(restoreResult.isError).toBe(false);
      
      const restoreText = restoreResult.content[0].text;
      expect(restoreText).toContain('RESUMING FROM CHECKPOINT');
      expect(restoreText).toContain('Authentication module finished');
      expect(restoreText).toContain('JWT integration working');
    });
  });

  describe('Phase 4: Standup Generation and Aggregation', () => {
    beforeEach(async () => {
      // Create a complete workflow: Plan → TODO → Checkpoints
      
      // 1. Create plan
      const planResult = await handlePlan(storage, {
        action: 'save',
        title: 'Frontend Refactoring Project',
        description: 'Modernize React components and improve performance',
        items: ['Audit current components', 'Implement hooks migration', 'Update tests'],
        category: 'refactor',
        priority: 'normal',
        tags: ['frontend', 'react', 'performance'],
        workspace: testWorkspace,
        format: 'json'
      });
      const planId = JSON.parse(planResult.content[0].text).data.planId;

      // 2. Generate TODOs
      await handlePlan(storage, {
        action: 'generate-todos',
        planId: planId,
        workspace: testWorkspace
      });

      // 2.5. Complete first TODO item to demonstrate progress tracking
      const allMemories = await storage.loadAllMemories(testWorkspace);
      const todoListMemory = allMemories.find(m => m.type === 'todo');
      const todoList = todoListMemory?.content as any;
      if (todoList?.items?.[0]) {
        await handleTodo(storage, {
          action: 'update',
          listId: todoList.id,
          itemId: '1', // First item ID
          status: 'done',
          workspace: testWorkspace
        });
      }

      // 3. Create some checkpoints
      await checkpointTool.handleUnifiedCheckpoint({
        action: 'save',
        description: 'Completed component audit',
        highlights: ['Found 23 class components to migrate', 'Identified performance bottlenecks'],
        activeFiles: ['src/components/audit.md'],
        workspace: testWorkspace
      });

      await checkpointTool.handleUnifiedCheckpoint({
        action: 'save',
        description: 'Started hooks migration for UserProfile component', 
        highlights: ['Converted UserProfile to hooks', 'Reduced bundle size by 15%'],
        activeFiles: ['src/components/UserProfile.tsx'],
        workspace: testWorkspace
      });

      // 4. Complete one TODO item
      const memories = await storage.loadAllMemories(testWorkspace);
      const todoMemory = memories.find(m => m.type === 'todo');
      if (!todoMemory) {
        throw new Error(`TODO memory not found. Available memories: ${memories.map(m => m.type).join(', ')}`);
      }
      await handleTodo(storage, {
        action: 'update',
        listId: todoMemory.id,
        itemId: '1', // Use 1-based indexing for TODO items
        status: 'done',
        workspace: testWorkspace
      });
    });

    test('should generate comprehensive daily standup', async () => {
      const standupResult = await handleStandup(storage, {
        action: 'daily',
        outputStyle: 'meeting',
        includeMetrics: true,
        includeRelationships: true,
        workspace: testWorkspace
      });

      expect(standupResult.isError).toBe(false);
      
      const standupText = standupResult.content[0].text;
      
      // Verify standup contains expected sections
      expect(standupText).toContain('Daily Standup');
      expect(standupText).toContain('Quick Stats');
      expect(standupText).toContain('What I accomplished');
      expect(standupText).toContain('Currently working on');
      expect(standupText).toContain('Project relationships');
      
      // Verify data integration
      expect(standupText).toContain('Frontend Refactoring Project');
      expect(standupText).toContain('Completed component audit');
      expect(standupText).toContain('hooks migration');
      
      // Verify metrics
      const standupData = JSON.parse(standupResult.content[0].text).data;
      expect(standupData.metrics.checkpoints).toBe(2);
      expect(standupData.metrics.todos).toBe(1);
      expect(standupData.metrics.plans).toBe(1);
      expect(standupData.metrics.completed).toBe(1);
      expect(standupData.relationships).toBe(1);
    });

    test('should support different standup output formats', async () => {
      // Test metrics format
      const metricsResult = await handleStandup(storage, {
        action: 'daily',
        outputStyle: 'metrics',
        workspace: testWorkspace
      });

      expect(metricsResult.isError).toBe(false);
      const metricsText = metricsResult.content[0].text;
      expect(metricsText).toContain('Metrics Dashboard');
      expect(metricsText).toContain('Productivity Metrics');
      expect(metricsText).toContain('Completion Rates');

      // Test executive format
      const execResult = await handleStandup(storage, {
        action: 'daily',
        outputStyle: 'executive',
        workspace: testWorkspace
      });

      expect(execResult.isError).toBe(false);
      const execText = execResult.content[0].text;
      expect(execText).toContain('Executive Summary');
      expect(execText).toContain('Strategic Focus');
      expect(execText).toContain('Key Wins');
    });

    test('should track relationship mappings correctly', async () => {
      // Rebuild index to capture all memories created during the workflow
      await indexManager.updateRelationships();
      
      // Verify index was updated throughout the workflow
      const index = await indexManager.loadIndex();
      console.log('DEBUG: Index relationships:', JSON.stringify(index.relationships, null, 2));
      console.log('DEBUG: Index metadata:', JSON.stringify(index.metadata, null, 2));
      
      expect(index.relationships).toHaveLength(1);
      
      const relationship = index.relationships[0];
      expect(relationship.planTitle).toBe('Frontend Refactoring Project');
      expect(relationship.planStatus).toBe('active');
      expect(relationship.linkedTodos).toHaveLength(1);
      expect(relationship.linkedCheckpoints).toHaveLength(2); // Auto-linked by content matching
      expect(relationship.tags).toContain('frontend');
      expect(relationship.completionPercentage).toBeGreaterThan(0);
    });
  });

  describe('Phase 5: Configuration and Quotas', () => {
    test('should respect configuration settings', async () => {
      const config = ConfigManager.getInstance();
      
      // Test quota enforcement would go here
      // For now, just verify config is accessible
      expect(config.get('maxPlanItemsPerPlan')).toBeGreaterThan(0);
      expect(config.get('defaultTtlHours')).toBe(72);
      expect(config.get('relationshipTrackingEnabled')).toBe(true);
    });

    test('should validate configuration values', async () => {
      const config = ConfigManager.getInstance();
      const validation = config.validate();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Cross-Tool Integration', () => {
    test('should maintain data consistency across all tools', async () => {
      // Create plan
      const planResult = await handlePlan(storage, {
        action: 'save',
        title: 'Integration Test Plan',
        description: 'Test cross-tool consistency',
        items: ['Task 1', 'Task 2', 'Task 3'], // Required for TODO generation
        workspace: testWorkspace,
        format: 'json'
      });
      const planId = JSON.parse(planResult.content[0].text).data.planId;

      // Generate TODOs
      await handlePlan(storage, {
        action: 'generate-todos',
        planId: planId,
        workspace: testWorkspace
      });

      // Create checkpoint
      await checkpointTool.handleUnifiedCheckpoint({
        action: 'save',
        description: 'Working on integration test',
        workspace: testWorkspace
      });

      // Generate standup
      await handleStandup(storage, {
        action: 'daily',
        workspace: testWorkspace
      });

      // Verify all data is consistent
      const memories = await storage.loadAllMemories(testWorkspace);
      const planMemories = memories.filter(m => m.type === 'plan');
      const todoMemories = memories.filter(m => m.type === 'todo'); 
      const checkpointMemories = memories.filter(m => m.type === 'checkpoint');

      expect(planMemories).toHaveLength(1);
      expect(todoMemories).toHaveLength(1);
      expect(checkpointMemories).toHaveLength(1);

      // Verify relationships
      await indexManager.updateRelationships(); // Rebuild index to capture all memories
      const index = await indexManager.loadIndex();
      expect(index.relationships).toHaveLength(1);
      expect(index.metadata.totalPlans).toBe(1);
      expect(index.metadata.totalTodos).toBe(1);
      expect(index.metadata.totalCheckpoints).toBe(1);
    });

    test('should handle plan completion workflow', async () => {
      // Create and activate plan
      const planResult = await handlePlan(storage, {
        action: 'save',
        title: 'Completion Test Plan',
        description: 'Test completion workflow',
        items: [
          'Set up project structure',
          'Implement core functionality',
          'Write tests',
          'Deploy to production'
        ],
        workspace: testWorkspace,
        format: 'json'
      });
      const planId = JSON.parse(planResult.content[0].text).data.planId;

      const generateResult = await handlePlan(storage, {
        action: 'generate-todos',
        planId: planId,
        workspace: testWorkspace
      });
      // Complete all TODO items
      const memories = await storage.loadAllMemories(testWorkspace);
      const todoMemory = memories.find(m => m.type === 'todo')!;
      const todoContent = todoMemory.content as any;
      
      // Complete all items
      for (let i = 0; i < todoContent.items.length; i++) {
        await handleTodo(storage, {
          action: 'update',
          listId: todoMemory.id,
          itemId: (i + 1).toString(), // Use 1-based indexing to match TODO item IDs
          status: 'done',
          workspace: testWorkspace
        });
      }

      // Mark plan as complete
      const completeResult = await handlePlan(storage, {
        action: 'complete',
        planId: planId,
        workspace: testWorkspace
      });

      expect(completeResult.isError).toBe(false);
      
      // Verify plan status and completion
      const updatedMemories = await storage.loadAllMemories(testWorkspace);
      const planMemory = updatedMemories.find(m => m.type === 'plan')!;
      const plan = planMemory.content as any;
      
      expect(plan.status).toBe('complete');
      expect(plan.completionPercentage).toBe(100);

      // Verify index is updated
      const index = await indexManager.loadIndex();
      const relationship = index.relationships.find(r => r.planId === planId)!;
      expect(relationship.planStatus).toBe('completed'); // Index uses 'completed' vs plan's 'complete'
      expect(relationship.completionPercentage).toBe(100);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle invalid plan operations gracefully', async () => {
      // Try to generate TODOs from non-existent plan
      const result = await handlePlan(storage, {
        action: 'generate-todos',
        planId: 'non-existent-plan-id',
        workspace: testWorkspace
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    test('should handle storage errors gracefully', async () => {
      // This test would require mocking storage failures
      // For now, just verify error handling structure exists
      expect(() => {
        new Storage('invalid-workspace', '/invalid/path/that/cannot/be/created');
      }).not.toThrow();
    });

    test('should recover from corrupted index files', async () => {
      // Create valid data
      await handlePlan(storage, {
        action: 'save',
        title: 'Recovery Test Plan',
        description: 'Test recovery',
        workspace: testWorkspace
      });

      // Force index rebuild
      const newIndex = await indexManager.rebuildIndex();
      
      expect(newIndex.relationships).toHaveLength(1);
      expect(newIndex.metadata.totalPlans).toBe(1);
    });
  });
});