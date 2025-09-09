/**
 * Search Test Harness - Creates test data for search validation
 * This file provides utilities to create consistent test memories
 * for validating search functionality improvements.
 */

import { GoldfishMemory } from '../types/index.js';

export interface SearchTestCase {
  id: number;
  query: string;
  expectedMemoryIds: number[];
  description: string;
  category: 'single-word' | 'multi-word' | 'phrase' | 'edge-case' | 'extended' | 'performance' | 'regression';
}

/**
 * Standard test memories for search validation
 */
export function createTestMemories(): GoldfishMemory[] {
  const baseDate = new Date('2025-01-15T10:00:00Z');
  
  return [
    {
      id: '1',
      timestamp: new Date(baseDate.getTime() + 1000),
      workspace: 'test-project',
      type: 'checkpoint',
      content: 'Implemented user authentication with JWT tokens',
      ttlHours: 24,
      tags: ['authentication', 'jwt', 'security'],
    },
    {
      id: '2', 
      timestamp: new Date(baseDate.getTime() + 2000),
      workspace: 'test-project',
      type: 'checkpoint',
      content: 'Fixed authentication bug in login flow',
      ttlHours: 24,
      tags: ['bug-fix', 'authentication', 'login'],
    },
    {
      id: '3',
      timestamp: new Date(baseDate.getTime() + 3000),
      workspace: 'test-project',
      type: 'general',
      content: 'Added password reset functionality',
      ttlHours: 24,
      tags: ['feature', 'password', 'user-management'],
    },
    {
      id: '4',
      timestamp: new Date(baseDate.getTime() + 4000),
      workspace: 'test-project',
      type: 'general',
      content: 'Updated API documentation for auth endpoints',
      ttlHours: 24,
      tags: ['documentation', 'api', 'authentication'],
    },
    {
      id: '5',
      timestamp: new Date(baseDate.getTime() + 5000),
      workspace: 'test-project',
      type: 'checkpoint',
      content: 'Resolved database connection timeout issues',
      ttlHours: 24,
      tags: ['database', 'performance', 'bug-fix'],
    },
    {
      id: '6',
      timestamp: new Date(baseDate.getTime() + 6000),
      workspace: 'test-project',
      type: 'general',
      content: 'bug fix for user profile update feature',
      ttlHours: 24,
      tags: ['bug-fix', 'user-profile', 'feature'],
    },
    {
      id: '7',
      timestamp: new Date(baseDate.getTime() + 7000),
      workspace: 'test-project',
      type: 'checkpoint',
      content: 'authentication system refactor complete',
      ttlHours: 24,
      tags: ['refactor', 'authentication', 'system'],
    }
  ];
}

/**
 * Complete test case suite for search validation
 */
export function getTestCases(): SearchTestCase[] {
  return [
    // Single Word Searches
    {
      id: 1,
      query: 'authentication',
      expectedMemoryIds: [1, 2, 4, 7],
      description: 'Should find all authentication-related memories',
      category: 'single-word'
    },
    {
      id: 2,
      query: 'auth',
      expectedMemoryIds: [1, 2, 4, 7],
      description: 'Should find auth as partial match of authentication',
      category: 'single-word'
    },
    {
      id: 3,
      query: 'bug',
      expectedMemoryIds: [2, 6],
      description: 'Should find bug-related memories',
      category: 'single-word'
    },
    {
      id: 4,
      query: 'user',
      expectedMemoryIds: [1, 6],
      description: 'Should find user-related memories',
      category: 'single-word'
    },
    {
      id: 5,
      query: 'databse',
      expectedMemoryIds: [5],
      description: 'Should handle typo in database',
      category: 'single-word'
    },

    // Multi-word Searches (Critical)
    {
      id: 6,
      query: 'authentication bug',
      expectedMemoryIds: [2, 1, 7],
      description: 'Should rank memory 2 highest (contains both terms)',
      category: 'multi-word'
    },
    {
      id: 7,
      query: 'user authentication',
      expectedMemoryIds: [1, 7],
      description: 'Should find memories with both user and authentication',
      category: 'multi-word'
    },
    {
      id: 8,
      query: 'bug fix',
      expectedMemoryIds: [6, 2],
      description: 'Should rank exact phrase match highest',
      category: 'multi-word'
    },
    {
      id: 9,
      query: 'password reset',
      expectedMemoryIds: [3],
      description: 'Should find exact phrase match',
      category: 'multi-word'
    },
    {
      id: 10,
      query: 'api documentation',
      expectedMemoryIds: [4],
      description: 'Should find exact phrase match',
      category: 'multi-word'
    },

    // Phrase Searches
    {
      id: 11,
      query: 'authentication with JWT',
      expectedMemoryIds: [1],
      description: 'Should find exact phrase',
      category: 'phrase'
    },
    {
      id: 12,
      query: 'database connection timeout',
      expectedMemoryIds: [5],
      description: 'Should find exact phrase',
      category: 'phrase'
    },
    {
      id: 13,
      query: 'login flow',
      expectedMemoryIds: [2],
      description: 'Should find phrase in content',
      category: 'phrase'
    },

    // Edge Cases
    {
      id: 14,
      query: 'JWT tokens authentication',
      expectedMemoryIds: [1],
      description: 'Should handle words in different order',
      category: 'edge-case'
    },
    {
      id: 15,
      query: 'fix bug authentication',
      expectedMemoryIds: [2],
      description: 'Should handle scrambled word order',
      category: 'edge-case'
    },
    {
      id: 16,
      query: 'nonexistent term',
      expectedMemoryIds: [],
      description: 'Should return no results for non-existent terms',
      category: 'edge-case'
    },
    {
      id: 17,
      query: '',
      expectedMemoryIds: [1, 2, 3, 4, 5, 6, 7],
      description: 'Empty query should return all memories',
      category: 'edge-case'
    },
    {
      id: 18,
      query: 'auth*',
      expectedMemoryIds: [1, 2, 4, 7],
      description: 'Should handle wildcard-like patterns',
      category: 'edge-case'
    },

    // Extended Search Operators (if implemented)
    {
      id: 19,
      query: '="authentication bug"',
      expectedMemoryIds: [2],
      description: 'Exact phrase only',
      category: 'extended'
    },
    {
      id: 20,
      query: "'authentication 'bug",
      expectedMemoryIds: [2],
      description: 'Must include both terms',
      category: 'extended'
    },
    {
      id: 21,
      query: 'authentication !refactor',
      expectedMemoryIds: [1, 2, 4],
      description: 'Include authentication, exclude refactor',
      category: 'extended'
    },
    {
      id: 22,
      query: 'bug | issue',
      expectedMemoryIds: [2, 6],
      description: 'Either bug OR issue',
      category: 'extended'
    },

    // Performance Tests
    {
      id: 23,
      query: 'performance_test_100',
      expectedMemoryIds: [],
      description: 'Performance test with 100 memories',
      category: 'performance'
    },
    {
      id: 24,
      query: 'performance_test_1000', 
      expectedMemoryIds: [],
      description: 'Performance test with 1000 memories',
      category: 'performance'
    },
    {
      id: 25,
      query: 'memory_usage_test',
      expectedMemoryIds: [],
      description: 'Memory usage test',
      category: 'performance'
    },

    // Regression Tests
    {
      id: 26,
      query: 'timeline_regression',
      expectedMemoryIds: [],
      description: 'Timeline tool search regression test',
      category: 'regression'
    },
    {
      id: 27,
      query: 'recall_regression',
      expectedMemoryIds: [],
      description: 'Recall tool search regression test',
      category: 'regression'
    },
    {
      id: 28,
      query: 'search_history_regression',
      expectedMemoryIds: [],
      description: 'Search history tool regression test',
      category: 'regression'
    }
  ];
}

/**
 * Utility to validate search results against expected outcomes
 */
export interface SearchResult {
  memory: GoldfishMemory;
  score: number;
}

export function validateSearchResults(
  testCase: SearchTestCase,
  actualResults: SearchResult[]
): {
  passed: boolean;
  details: {
    expectedCount: number;
    actualCount: number;
    foundIds: number[];
    missingIds: number[];
    unexpectedIds: number[];
    precision: number;
    recall: number;
  };
} {
  const foundIds = actualResults.map(r => parseInt(r.memory.id));
  const expectedIds = testCase.expectedMemoryIds;
  
  const missingIds = expectedIds.filter(id => !foundIds.includes(id));
  const unexpectedIds = foundIds.filter(id => !expectedIds.includes(id));
  
  const truePositives = foundIds.filter(id => expectedIds.includes(id)).length;
  const precision = actualResults.length > 0 ? truePositives / actualResults.length : 1;
  const recall = expectedIds.length > 0 ? truePositives / expectedIds.length : 1;
  
  return {
    passed: missingIds.length === 0 && unexpectedIds.length === 0,
    details: {
      expectedCount: expectedIds.length,
      actualCount: actualResults.length,
      foundIds,
      missingIds,
      unexpectedIds,
      precision,
      recall
    }
  };
}

/**
 * Generate large datasets for performance testing
 */
export function generatePerformanceTestMemories(count: number): GoldfishMemory[] {
  const memories: GoldfishMemory[] = [];
  const baseDate = new Date('2025-01-01T00:00:00Z');
  
  const contentTemplates = [
    'Implemented {feature} with {technology}',
    'Fixed {issue} in {component} module',
    'Added {functionality} to {system}',
    'Updated {documentation} for {api} endpoints',
    'Resolved {problem} in {area}',
    'Refactored {module} {status}'
  ];
  
  const features = ['authentication', 'authorization', 'validation', 'caching', 'logging'];
  const technologies = ['JWT', 'OAuth', 'Redis', 'PostgreSQL', 'Node.js'];
  const issues = ['memory leak', 'timeout', 'race condition', 'deadlock', 'bug'];
  
  for (let i = 0; i < count; i++) {
    const template = contentTemplates[i % contentTemplates.length];
    if (!template) {
      throw new Error(`Template not found at index ${i % contentTemplates.length}`);
    }
    
    const content = template
      .replace('{feature}', features[i % features.length] || 'feature')
      .replace('{technology}', technologies[i % technologies.length] || 'technology')
      .replace('{issue}', issues[i % issues.length] || 'issue')
      .replace('{component}', `component-${i % 10}`)
      .replace('{functionality}', `feature-${i % 20}`)
      .replace('{system}', `system-${i % 15}`)
      .replace('{documentation}', 'API documentation')
      .replace('{api}', `api-v${(i % 3) + 1}`)
      .replace('{problem}', issues[i % issues.length] || 'problem')
      .replace('{area}', `area-${i % 8}`)
      .replace('{module}', `module-${i % 12}`)
      .replace('{status}', 'complete');
    
    memories.push({
      id: `perf-${i + 1}`,
      timestamp: new Date(baseDate.getTime() + i * 1000),
      workspace: `test-workspace-${(i % 5) + 1}`,
      type: i % 3 === 0 ? 'checkpoint' : 'general',
      content,
      ttlHours: 24,
      tags: [`tag-${i % 10}`, `category-${i % 5}`]
    });
  }
  
  return memories;
}