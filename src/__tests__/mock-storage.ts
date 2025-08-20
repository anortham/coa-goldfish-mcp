/**
 * Mock Storage class for isolated testing
 * Provides only test data, never touches production memories
 */

import { GoldfishMemory } from '../types/index.js';
import { createTestMemories } from './search-test-harness.js';

export class MockStorage {
  private testMemories: GoldfishMemory[];
  private currentWorkspace: string;

  constructor(workspace: string = 'test-project') {
    this.testMemories = createTestMemories();
    this.currentWorkspace = workspace;
  }

  /**
   * Get current workspace name
   */
  getCurrentWorkspace(): string {
    return this.currentWorkspace;
  }

  /**
   * Load all memories for a workspace (returns test data only)
   */
  async loadAllMemories(workspace?: string): Promise<GoldfishMemory[]> {
    const targetWorkspace = workspace || this.currentWorkspace;
    
    // Return test memories only for test-project workspace
    if (targetWorkspace === 'test-project') {
      return [...this.testMemories]; // Return copy to prevent mutation
    }
    
    // Return empty for other workspaces
    return [];
  }

  /**
   * Save memory (test implementation - just adds to array)
   */
  async saveMemory(memory: GoldfishMemory): Promise<void> {
    // Remove existing memory with same ID if it exists
    this.testMemories = this.testMemories.filter(m => m.id !== memory.id);
    // Add new memory
    this.testMemories.push(memory);
  }

  /**
   * Get test memories for verification
   */
  getTestMemories(): GoldfishMemory[] {
    return [...this.testMemories];
  }

  /**
   * Clear all test memories
   */
  clearTestMemories(): void {
    this.testMemories = [];
  }

  /**
   * Reset to default test memories
   */
  resetToDefaultTestMemories(): void {
    this.testMemories = createTestMemories();
  }
}