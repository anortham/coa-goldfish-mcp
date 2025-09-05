/**
 * Index Manager - Manages relationship mappings and metadata
 * Provides efficient lookups and relationship tracking between plans, todos, and checkpoints
 */

import fs from 'fs-extra';
import { join } from 'path';
import { Storage } from './storage.js';
import { GoldfishMemory, Plan } from '../types/index.js';

export interface RelationshipIndex {
  version: string;
  lastUpdated: string;
  workspace: string;
  relationships: RelationshipEntry[];
  metadata: IndexMetadata;
}

export interface RelationshipEntry {
  planId?: string;
  planTitle?: string;
  planStatus?: 'draft' | 'active' | 'completed' | 'abandoned';
  linkedTodos: string[];
  linkedCheckpoints: string[];
  createdAt: string;
  updatedAt: string;
  completionPercentage?: number;
  tags: string[];
}

export interface IndexMetadata {
  totalPlans: number;
  totalTodos: number;
  totalCheckpoints: number;
  activePlans: number;
  completedTasks: number;
  lastStandupGenerated?: string;
  configVersion: string;
}

export class IndexManager {
  private storage: Storage;
  private indexPath: string;

  constructor(storage: Storage, workspace?: string) {
    this.storage = storage;
    const targetWorkspace = workspace || storage.getCurrentWorkspace();
    this.indexPath = join(storage.getWorkspaceDir(targetWorkspace), 'index.json');
  }

  /**
   * Load the relationship index from file
   */
  async loadIndex(): Promise<RelationshipIndex> {
    try {
      if (await fs.pathExists(this.indexPath)) {
        const data = await fs.readJson(this.indexPath);
        return data as RelationshipIndex;
      }
    } catch (error) {
      console.error('Failed to load relationship index:', error);
    }

    // Return default index if file doesn't exist or is corrupted
    return this.createDefaultIndex();
  }

  /**
   * Save the relationship index to file
   */
  async saveIndex(index: RelationshipIndex): Promise<void> {
    try {
      await fs.ensureDir(join(this.indexPath, '..'));
      await fs.writeJson(this.indexPath, index, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save relationship index:', error);
      throw error;
    }
  }

  /**
   * Update the index with new relationship data
   */
  async updateRelationships(): Promise<RelationshipIndex> {
    const index = await this.loadIndex();
    
    // Load all memories for this workspace
    const memories = await this.storage.loadAllMemories();
    
    // Reset relationships and rebuild
    index.relationships = [];
    
    // Process plans and build relationships
    const plans = memories.filter(m => m.type === 'plan');
    const todos = memories.filter(m => m.type === 'todo');
    const checkpoints = memories.filter(m => m.type === 'checkpoint');
    
    for (const planMemory of plans) {
      if (typeof planMemory.content === 'object' && planMemory.content) {
        const plan = planMemory.content as Plan;
        
        // Calculate dynamic completion percentage based on current TODO state
        let completionPercentage = 0;
        if (plan.generatedTodos && plan.generatedTodos.length > 0) {
          let totalTasks = 0;
          let completedTasks = 0;
          
          for (const todoId of plan.generatedTodos) {
            const todoMemory = todos.find(t => {
              if (typeof t.content === 'object' && t.content) {
                return (t.content as any).id === todoId;
              }
              return false;
            });
            
            if (todoMemory && typeof todoMemory.content === 'object' && todoMemory.content) {
              const todoList = todoMemory.content as any;
              if (todoList.items && Array.isArray(todoList.items)) {
                totalTasks += todoList.items.length;
                completedTasks += todoList.items.filter((item: any) => item.status === 'done').length;
              }
            }
          }
          
          completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        }
        
        const relationship: RelationshipEntry = {
          planId: plan.id,
          planTitle: plan.title,
          planStatus: plan.status === 'complete' ? 'completed' : plan.status,
          linkedTodos: [],
          linkedCheckpoints: [],
          createdAt: plan.createdAt instanceof Date ? plan.createdAt.toISOString() : plan.createdAt,
          updatedAt: plan.updatedAt instanceof Date ? plan.updatedAt.toISOString() : plan.updatedAt,
          completionPercentage: completionPercentage,
          tags: plan.tags || []
        };

        // Find linked TODOs
        if (Array.isArray(plan.generatedTodos)) {
          relationship.linkedTodos.push(...plan.generatedTodos);
        }

        // Find linked checkpoints
        if (Array.isArray(plan.relatedCheckpoints)) {
          relationship.linkedCheckpoints.push(...plan.relatedCheckpoints);
        }

        // Search for additional relationships by content matching
        for (const checkpoint of checkpoints) {
          if (typeof checkpoint.content === 'object' && checkpoint.content) {
            const content = checkpoint.content as { description?: string; planId?: string; highlights?: string[] };
            
            let isRelated = false;
            
            // Direct planId reference
            if (content.planId === plan.id) {
              isRelated = true;
            }
            
            // Plan title mentioned in checkpoint description
            if (content.description && content.description.includes(plan.title)) {
              isRelated = true;
            }
            
            // Keyword-based matching using plan tags
            if (plan.tags && plan.tags.length > 0) {
              const checkpointText = [
                content.description || '',
                ...(content.highlights || [])
              ].join(' ').toLowerCase();
              
              for (const tag of plan.tags) {
                if (checkpointText.includes(tag.toLowerCase())) {
                  isRelated = true;
                  break;
                }
              }
            }
            
            if (isRelated && !relationship.linkedCheckpoints.includes(checkpoint.id)) {
              relationship.linkedCheckpoints.push(checkpoint.id);
            }
          }
        }

        // Search for TODOs that mention the plan
        for (const todo of todos) {
          if (typeof todo.content === 'object' && todo.content) {
            const content = todo.content as { title?: string; planId?: string };
            if (content.planId === plan.id ||
                (content.title && content.title.includes(plan.title))) {
              if (!relationship.linkedTodos.includes(todo.id)) {
                relationship.linkedTodos.push(todo.id);
              }
            }
          }
        }

        index.relationships.push(relationship);
      }
    }

    // Update metadata
    index.metadata = {
      totalPlans: plans.length,
      totalTodos: todos.length,
      totalCheckpoints: checkpoints.length,
      activePlans: plans.filter(p => {
        const plan = p.content as Plan;
        return plan.status === 'active' || plan.status === 'draft';
      }).length,
      completedTasks: todos.reduce((sum, todoMemory) => {
        if (typeof todoMemory.content === 'object' && todoMemory.content) {
          const content = todoMemory.content as { items?: any[] };
          if (Array.isArray(content.items)) {
            return sum + content.items.filter((item: any) => item.status === 'done').length;
          }
        }
        return sum;
      }, 0),
      lastStandupGenerated: index.metadata.lastStandupGenerated,
      configVersion: '2.0.0'
    };

    index.lastUpdated = new Date().toISOString();
    
    await this.saveIndex(index);
    return index;
  }

  /**
   * Add or update a relationship entry
   */
  async updateRelationship(planId: string, updates: Partial<RelationshipEntry>): Promise<void> {
    const index = await this.loadIndex();
    
    const existingIndex = index.relationships.findIndex(r => r.planId === planId);
    
    if (existingIndex >= 0) {
      // Update existing relationship
      const updatedEntry = {
        ...index.relationships[existingIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // Ensure required arrays are present
      if (!updatedEntry.linkedTodos) updatedEntry.linkedTodos = [];
      if (!updatedEntry.linkedCheckpoints) updatedEntry.linkedCheckpoints = [];
      
      index.relationships[existingIndex] = updatedEntry as RelationshipEntry;
    } else {
      // Create new relationship entry
      const newRelationship: RelationshipEntry = {
        planId,
        linkedTodos: [],
        linkedCheckpoints: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        ...updates
      };
      
      // Ensure required arrays are present
      if (!newRelationship.linkedTodos) newRelationship.linkedTodos = [];
      if (!newRelationship.linkedCheckpoints) newRelationship.linkedCheckpoints = [];
      index.relationships.push(newRelationship);
    }

    await this.saveIndex(index);
  }

  /**
   * Remove a relationship entry
   */
  async removeRelationship(planId: string): Promise<void> {
    const index = await this.loadIndex();
    index.relationships = index.relationships.filter(r => r.planId !== planId);
    await this.saveIndex(index);
  }

  /**
   * Get relationships for a specific plan
   */
  async getRelationshipsForPlan(planId: string): Promise<RelationshipEntry | null> {
    const index = await this.loadIndex();
    return index.relationships.find(r => r.planId === planId) || null;
  }

  /**
   * Get all active relationships
   */
  async getActiveRelationships(): Promise<RelationshipEntry[]> {
    const index = await this.loadIndex();
    return index.relationships.filter(r => 
      r.planStatus === 'active' || r.planStatus === 'draft'
    );
  }

  /**
   * Record that a standup was generated
   */
  async recordStandupGeneration(): Promise<void> {
    const index = await this.loadIndex();
    index.metadata.lastStandupGenerated = new Date().toISOString();
    await this.saveIndex(index);
  }

  /**
   * Get index statistics
   */
  async getStatistics(): Promise<IndexMetadata> {
    const index = await this.loadIndex();
    return index.metadata;
  }

  /**
   * Create default index structure
   */
  private createDefaultIndex(): RelationshipIndex {
    return {
      version: '2.0.0',
      lastUpdated: new Date().toISOString(),
      workspace: this.storage.getCurrentWorkspace(),
      relationships: [],
      metadata: {
        totalPlans: 0,
        totalTodos: 0,
        totalCheckpoints: 0,
        activePlans: 0,
        completedTasks: 0,
        configVersion: '2.0.0'
      }
    };
  }

  /**
   * Repair/rebuild the entire index from scratch
   */
  async rebuildIndex(): Promise<RelationshipIndex> {
    // Create fresh index
    const newIndex = this.createDefaultIndex();
    await this.saveIndex(newIndex);
    
    // Rebuild relationships
    return await this.updateRelationships();
  }

  /**
   * Clean up orphaned relationships (plans that no longer exist)
   */
  async cleanupOrphanedRelationships(): Promise<void> {
    const index = await this.loadIndex();
    const memories = await this.storage.loadAllMemories();
    const existingPlanIds = memories
      .filter(m => m.type === 'plan')
      .map(m => {
        if (typeof m.content === 'object' && m.content) {
          return (m.content as Plan).id;
        }
        return null;
      })
      .filter(Boolean) as string[];

    // Remove relationships for plans that no longer exist
    index.relationships = index.relationships.filter(r => 
      r.planId && existingPlanIds.includes(r.planId)
    );

    await this.saveIndex(index);
  }
}