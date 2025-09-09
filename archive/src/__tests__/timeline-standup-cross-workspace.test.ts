/**
 * Timeline/Standup Cross-Workspace Tests
 * 
 * These tests focus specifically on the timeline and standup functionality
 * that users rely on for cross-workspace reporting. This is the feature
 * that is currently broken and needs to work correctly.
 * 
 * DESIGNED TO FAIL INITIALLY - these tests expose the critical gaps in
 * cross-workspace timeline generation that impact daily standup workflows.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { Storage } from '../core/storage.js';
import { SessionManager } from '../core/session-manager.js';
import { SearchTools } from '../tools/search.js';
import { GoldfishMemory } from '../types/index.js';

describe('Timeline/Standup Cross-Workspace Tests', () => {
  let testDir: string;
  let basePath: string;

  // Simulate a realistic multi-project workspace scenario
  const projectWorkspaces = [
    'coa-goldfish-mcp',
    'client-dashboard',
    'api-backend',
    'mobile-app',
    'shared-components'
  ];

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'goldfish-timeline-test-'));
    basePath = join(testDir, '.coa', 'goldfish');

    await setupRealisticProjectData();
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  async function setupRealisticProjectData() {
    // Create data that represents a typical developer's multi-project work
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (let i = 0; i < projectWorkspaces.length; i++) {
      const workspace = projectWorkspaces[i];
      const workspaceDir = join(basePath, workspace);
      
      // Set up directory structure
      const checkpointsDir = join(workspaceDir, 'checkpoints');
      const todosDir = join(workspaceDir, 'todos');
      
      await fs.ensureDir(checkpointsDir);
      await fs.ensureDir(todosDir);

      // Create date directories
      await fs.ensureDir(join(checkpointsDir, today));
      await fs.ensureDir(join(checkpointsDir, yesterday));
      await fs.ensureDir(join(checkpointsDir, twoDaysAgo));

      // Create realistic work sessions for each project
      await createWorkSession(workspace, today, 'Today', i * 2);
      await createWorkSession(workspace, yesterday, 'Yesterday', i * 2 + 1);
      if (i < 3) { // Only some projects worked on two days ago
        await createWorkSession(workspace, twoDaysAgo, 'Two days ago', i * 2 + 2);
      }
    }
  }

  async function createWorkSession(workspace: string, date: string, dayLabel: string, hourOffset: number) {
    const workspaceDir = join(basePath, workspace);
    const checkpointsDir = join(workspaceDir, 'checkpoints', date);
    const todosDir = join(workspaceDir, 'todos');

    // Create morning checkpoint
    const morningCheckpoint: GoldfishMemory = {
      id: `${workspace}-morning-${date}`,
      timestamp: new Date(date + `T${String(8 + (hourOffset % 4)).padStart(2, '0')}:00:00.000Z`),
      workspace: workspace,
      sessionId: `session-${workspace}-${date}`,
      type: 'checkpoint',
      content: {
        description: `Started ${dayLabel} work on ${workspace}`,
        highlights: [
          `Set up development environment for ${workspace}`,
          `Reviewed pending PRs in ${workspace}`,
          `Planned feature implementation for ${workspace}`
        ],
        gitBranch: 'feature/improvements',
        activeFiles: [`src/${workspace}/main.ts`, `docs/${workspace}.md`],
        workContext: `Beginning daily work session on ${workspace} - focusing on new feature development`
      },
      ttlHours: 168,
      tags: ['checkpoint', 'morning', 'planning'],
      metadata: { isSession: true }
    };

    // Create afternoon checkpoint
    const afternoonCheckpoint: GoldfishMemory = {
      id: `${workspace}-afternoon-${date}`,
      timestamp: new Date(date + `T${String(14 + (hourOffset % 3)).padStart(2, '0')}:30:00.000Z`),
      workspace: workspace,
      sessionId: `session-${workspace}-${date}`,
      type: 'checkpoint',
      content: {
        description: `Afternoon progress on ${workspace}`,
        highlights: [
          `Implemented core feature in ${workspace}`,
          `Fixed 3 critical bugs in ${workspace}`,
          `Added comprehensive tests for ${workspace}`,
          `Updated documentation for ${workspace} API`
        ],
        gitBranch: 'feature/improvements',
        activeFiles: [`src/${workspace}/core.ts`, `tests/${workspace}.test.ts`, `api/${workspace}.yaml`],
        workContext: `Made significant progress on ${workspace} feature - ready for code review`
      },
      ttlHours: 168,
      tags: ['checkpoint', 'afternoon', 'progress'],
      metadata: { isSession: true }
    };

    // Create some general memories (todos, notes)
    const todoMemory: GoldfishMemory = {
      id: `${workspace}-todo-${date}`,
      timestamp: new Date(date + `T${String(12 + (hourOffset % 2)).padStart(2, '0')}:15:00.000Z`),
      workspace: workspace,
      type: 'general',
      content: `TODO: Review ${workspace} performance metrics and optimize database queries`,
      ttlHours: 72,
      tags: ['todo', 'performance', 'database']
    };

    // Save the memories
    await fs.writeJson(join(checkpointsDir, `${morningCheckpoint.id}.json`), {
      ...morningCheckpoint,
      timestamp: morningCheckpoint.timestamp.toISOString()
    });

    await fs.writeJson(join(checkpointsDir, `${afternoonCheckpoint.id}.json`), {
      ...afternoonCheckpoint,
      timestamp: afternoonCheckpoint.timestamp.toISOString()
    });

    await fs.writeJson(join(todosDir, `${todoMemory.id}.json`), {
      ...todoMemory,
      timestamp: todoMemory.timestamp.toISOString()
    });
  }

  describe('Timeline Cross-Workspace Core Functionality', () => {
    test('CRITICAL: timeline should show data from ALL workspaces for standup', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      // This is the key test - timeline with scope='all' should work for standups
      const result = await searchTools.timeline({
        scope: 'all',
        since: '3d'
      });

      expect(result.content).toHaveLength(1);
      const responseData = JSON.parse(result.content[0].text);
      
      console.log('\n=== TIMELINE RESPONSE ANALYSIS ===');
      console.log(`Success: ${responseData.success}`);
      console.log(`Operation: ${responseData.operation}`);
      console.log(`Workspaces found: ${responseData.workspacesFound}`);
      console.log(`Total items: ${responseData.totalItems}`);
      console.log(`Checkpoints found: ${responseData.checkpointsFound}`);
      console.log('=== END ANALYSIS ===\n');

      // CRITICAL ASSERTIONS FOR STANDUP FUNCTIONALITY
      expect(responseData.success).toBe(true);
      expect(responseData.operation).toBe('timeline');
      
      // MUST find all project workspaces
      expect(responseData.workspacesFound).toBe(projectWorkspaces.length);
      
      // MUST have sufficient checkpoints (2 per workspace per day for 3 workspaces over 3 days = minimum 18)
      expect(responseData.checkpointsFound).toBeGreaterThanOrEqual(18);
      
      // MUST show data organized by date and workspace
      expect(responseData.data.byDate).toBeDefined();
      
      // Check the formatted output for standup readability
      const formattedOutput = responseData.formattedOutput;
      
      // Should mention all projects
      projectWorkspaces.forEach(workspace => {
        expect(formattedOutput).toContain(workspace);
      });
      
      // Should have timeline structure with dates
      expect(formattedOutput).toContain('Work Timeline');
      expect(formattedOutput).toMatch(/\*\*.*\*\*.*(2025-\d{2}-\d{2})/); // Should have date headers
      expect(formattedOutput).toMatch(/📁.*:/); // Should have workspace entries
      expect(formattedOutput).toMatch(/✨/); // Should have highlights
    });

    test('timeline should organize data by date correctly across workspaces', async () => {
      const storage = new Storage('api-backend', basePath); // Different current workspace
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      const result = await searchTools.timeline({
        scope: 'all',
        since: '7d'
      });

      const responseData = JSON.parse(result.content[0].text);
      const timelineData = responseData.data.byDate;

      console.log('\n=== DATE ORGANIZATION TEST ===');
      Object.keys(timelineData).forEach(date => {
        console.log(`Date: ${date}`);
        Object.keys(timelineData[date]).forEach(workspace => {
          const data = timelineData[date][workspace];
          console.log(`  ${workspace}: ${data.count} checkpoints, ${data.highlights.length} highlights`);
        });
      });
      console.log('=== END DATE ORGANIZATION ===\n');

      // Should have at least 2 dates (today and yesterday minimum)
      const dates = Object.keys(timelineData);
      expect(dates.length).toBeGreaterThanOrEqual(2);

      // Each date should have multiple workspaces
      dates.forEach(date => {
        const workspacesOnDate = Object.keys(timelineData[date]);
        expect(workspacesOnDate.length).toBeGreaterThan(1);
        
        // Each workspace entry should have count and highlights
        workspacesOnDate.forEach(workspace => {
          const wsData = timelineData[date][workspace];
          expect(wsData.count).toBeGreaterThan(0);
          expect(Array.isArray(wsData.highlights)).toBe(true);
        });
      });
    });

    test('timeline should handle different time ranges correctly', async () => {
      const storage = new Storage('mobile-app', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      // Test 1 day
      const oneDayResult = await searchTools.timeline({
        scope: 'all',
        since: '1d'
      });
      const oneDayData = JSON.parse(oneDayResult.content[0].text);

      // Test 3 days  
      const threeDayResult = await searchTools.timeline({
        scope: 'all',
        since: '3d'
      });
      const threeDayData = JSON.parse(threeDayResult.content[0].text);

      console.log('\n=== TIME RANGE COMPARISON ===');
      console.log(`1 day: ${oneDayData.totalItems} items, ${oneDayData.workspacesFound} workspaces`);
      console.log(`3 days: ${threeDayData.totalItems} items, ${threeDayData.workspacesFound} workspaces`);
      console.log('=== END COMPARISON ===\n');

      // 3 days should have more items than 1 day
      expect(threeDayData.totalItems).toBeGreaterThan(oneDayData.totalItems);
      
      // Both should find all workspaces (since we have recent data in all)
      expect(oneDayData.workspacesFound).toBe(projectWorkspaces.length);
      expect(threeDayData.workspacesFound).toBe(projectWorkspaces.length);

      // 3 days should have more dates in the timeline
      const oneDayDates = Object.keys(oneDayData.data.byDate);
      const threeDayDates = Object.keys(threeDayData.data.byDate);
      
      expect(threeDayDates.length).toBeGreaterThanOrEqual(oneDayDates.length);
    });
  });

  describe('Standup Report Generation Tests', () => {
    test('should generate comprehensive standup report from timeline', async () => {
      const storage = new Storage('shared-components', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      const result = await searchTools.timeline({
        scope: 'all',
        since: '2d' // Typical standup timeframe
      });

      const responseData = JSON.parse(result.content[0].text);
      const formattedOutput = responseData.formattedOutput;

      console.log('\n=== STANDUP REPORT CONTENT ===');
      console.log(formattedOutput);
      console.log('=== END STANDUP REPORT ===\n');

      // Standup report should be comprehensive and readable
      
      // Should have clear project breakdown
      projectWorkspaces.forEach(workspace => {
        expect(formattedOutput).toContain(workspace);
        
        // Should show checkpoint counts
        expect(formattedOutput).toMatch(new RegExp(`${workspace}.*checkpoints?`));
      });

      // Should show highlights/achievements
      expect(formattedOutput).toContain('✨');
      
      // Should have proper standup-style formatting
      expect(formattedOutput).toMatch(/📁.*:/); // Project indicators
      expect(formattedOutput).toMatch(/\*\*.*\*\*/); // Date headers
      
      // Should include actual accomplishments
      expect(formattedOutput).toContain('Implemented');
      expect(formattedOutput).toContain('Fixed');
      expect(formattedOutput).toContain('Added');
    });

    test('should show progress across different projects in timeline', async () => {
      const storage = new Storage('client-dashboard', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      const result = await searchTools.timeline({
        scope: 'all',
        since: '7d'
      });

      const responseData = JSON.parse(result.content[0].text);
      
      // Extract highlights across all workspaces
      const allHighlights: string[] = [];
      Object.values(responseData.data.byDate).forEach((dateData: any) => {
        Object.values(dateData).forEach((workspaceData: any) => {
          allHighlights.push(...workspaceData.highlights);
        });
      });

      console.log('\n=== ALL HIGHLIGHTS ACROSS WORKSPACES ===');
      allHighlights.forEach((highlight, i) => {
        console.log(`${i + 1}. ${highlight}`);
      });
      console.log('=== END HIGHLIGHTS ===\n');

      // Should have highlights from multiple projects
      const projectsWithHighlights = new Set<string>();
      allHighlights.forEach(highlight => {
        projectWorkspaces.forEach(workspace => {
          if (highlight.includes(workspace)) {
            projectsWithHighlights.add(workspace);
          }
        });
      });

      expect(projectsWithHighlights.size).toBeGreaterThan(2); // Multiple projects
      expect(allHighlights.length).toBeGreaterThan(10); // Substantial work
    });
  });

  describe('Current vs All Scope Comparison Tests', () => {
    test('should show clear difference between current and all scope', async () => {
      const storage = new Storage('coa-goldfish-mcp', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      // Get current workspace timeline
      const currentResult = await searchTools.timeline({
        scope: 'current',
        since: '3d'
      });
      const currentData = JSON.parse(currentResult.content[0].text);

      // Get all workspaces timeline
      const allResult = await searchTools.timeline({
        scope: 'all',
        since: '3d'
      });
      const allData = JSON.parse(allResult.content[0].text);

      console.log('\n=== SCOPE COMPARISON ===');
      console.log(`Current workspace only: ${currentData.workspacesFound} workspaces, ${currentData.totalItems} items`);
      console.log(`All workspaces: ${allData.workspacesFound} workspaces, ${allData.totalItems} items`);
      console.log('=== END COMPARISON ===\n');

      // Current should only show one workspace
      expect(currentData.workspacesFound).toBe(1);
      expect(currentData.totalItems).toBeGreaterThan(0);

      // All should show all workspaces
      expect(allData.workspacesFound).toBe(projectWorkspaces.length);
      expect(allData.totalItems).toBeGreaterThan(currentData.totalItems);

      // Current should only mention the current workspace in output
      expect(currentData.formattedOutput).toContain('coa-goldfish-mcp');
      expect(currentData.formattedOutput).not.toContain('client-dashboard');

      // All should mention multiple workspaces
      expect(allData.formattedOutput).toContain('coa-goldfish-mcp');
      expect(allData.formattedOutput).toContain('client-dashboard');
      expect(allData.formattedOutput).toContain('api-backend');
    });
  });

  describe('Timeline Error Handling and Edge Cases', () => {
    test('should handle empty workspaces gracefully in timeline', async () => {
      // Add empty workspace
      const emptyWorkspace = 'empty-project';
      const emptyDir = join(basePath, emptyWorkspace);
      await fs.ensureDir(join(emptyDir, 'checkpoints'));
      await fs.ensureDir(join(emptyDir, 'todos'));

      const storage = new Storage('coa-goldfish-mcp', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      const result = await searchTools.timeline({
        scope: 'all',
        since: '7d'
      });

      const responseData = JSON.parse(result.content[0].text);

      // Should still work and show data from projects with content
      expect(responseData.success).toBe(true);
      expect(responseData.workspacesFound).toBe(projectWorkspaces.length); // Should not count empty workspace
      expect(responseData.totalItems).toBeGreaterThan(0);
    });

    test('should handle timeline when no checkpoints exist', async () => {
      // Create workspace with only general memories, no checkpoints
      const generalOnlyWorkspace = 'general-only-project';
      const generalDir = join(basePath, generalOnlyWorkspace);
      await fs.ensureDir(join(generalDir, 'todos'));

      const generalMemory: GoldfishMemory = {
        id: 'general-only-memory',
        timestamp: new Date(),
        workspace: generalOnlyWorkspace,
        type: 'general',
        content: 'Just a general note',
        ttlHours: 24
      };

      await fs.writeJson(join(generalDir, 'todos', 'general.json'), {
        ...generalMemory,
        timestamp: generalMemory.timestamp.toISOString()
      });

      const storage = new Storage('coa-goldfish-mcp', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      const result = await searchTools.timeline({
        scope: 'all',
        since: '7d'
      });

      const responseData = JSON.parse(result.content[0].text);

      // Should still show timeline from workspaces with checkpoints
      expect(responseData.success).toBe(true);
      expect(responseData.checkpointsFound).toBeGreaterThan(0);
      
      // Should not include workspace with only general memories in checkpoint-focused timeline
      expect(responseData.formattedOutput).not.toContain(generalOnlyWorkspace);
    });

    test('should handle timeline with future date range', async () => {
      const storage = new Storage('api-backend', basePath);
      const sessionManager = new SessionManager(storage);
      const searchTools = new SearchTools(storage, sessionManager);

      const result = await searchTools.timeline({
        scope: 'all',
        since: '1h' // Very recent - might not have data
      });

      const responseData = JSON.parse(result.content[0].text);

      // Should handle gracefully even if no recent data
      expect(responseData.success).toBe(true);
      expect(responseData.operation).toBe('timeline');
      
      // May have 0 items, but should not crash
      expect(responseData.totalItems).toBeGreaterThanOrEqual(0);
    });
  });
});