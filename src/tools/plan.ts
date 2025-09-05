/**
 * Plan Tool for Goldfish MCP
 * 
 * Handles strategic planning and design decisions with lifecycle management
 * Actions: save, restore, update, complete, abandon, list, generate-todos
 */

import { Storage } from '../core/storage.js';
import { Plan, ToolResponse } from '../types/index.js';
import { validateCommonArgs, createErrorResponse, createSuccessResponse, normalizeWorkspaceName } from '../core/workspace-utils.js';
import { IndexManager } from '../core/index-manager.js';

// Import TODO tool for plan → TODO generation
import { handleTodo } from './todo.js';

export interface PlanArgs {
  action?: 'save' | 'restore' | 'update' | 'complete' | 'abandon' | 'list' | 'generate-todos';
  
  // For save action
  title?: string;
  description?: string;          // Full markdown plan
  items?: string[];             // High-level plan items
  category?: 'feature' | 'refactor' | 'research' | 'architecture' | 'bugfix' | 'maintenance';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  estimatedEffort?: string;
  tags?: string[];
  
  // For update action
  planId?: string;              // Supports "latest", "active", partial matches
  status?: 'draft' | 'active' | 'complete' | 'abandoned';
  outcomes?: string[];          // What actually happened
  lessons?: string[];           // What we learned
  blockers?: string[];          // Current blockers
  actualEffort?: string;
  
  // For complete/abandon actions
  reason?: string;
  nextSteps?: string[];
  
  // For generate-todos action
  todoTitle?: string;           // Title for generated TODO list
  
  // For list action
  scope?: 'current' | 'all';
  showCompleted?: boolean;
  
  // Common options
  workspace?: string;
  ttlHours?: number;
  format?: import('../core/output-utils.js').OutputMode;
}

/**
 * Smart action inference for plan tool
 */
function inferPlanAction(args: PlanArgs): 'save' | 'restore' | 'update' | 'complete' | 'abandon' | 'list' | 'generate-todos' {
  // If we have title and description, it's a save (new plan)
  if (args.title && args.description) {
    return 'save';
  }
  
  // If we have planId with status change to complete/abandon
  if (args.planId && args.status === 'complete') {
    return 'complete';
  }
  if (args.planId && args.status === 'abandoned') {
    return 'abandon';
  }
  
  // If we have planId with other updates, it's an update
  if (args.planId && (args.outcomes || args.lessons || args.blockers || args.actualEffort)) {
    return 'update';
  }
  
  // If we have planId only, it's a restore (view specific plan)
  if (args.planId) {
    return 'restore';
  }
  
  // Default to list
  return 'list';
}

/**
 * Resolve special plan keywords like "latest", "active"
 */
function resolveSpecialPlanId(planId: string, plans: Plan[]): Plan | null {
  const lowerKeyword = planId.toLowerCase().trim();
  
  // Handle special keywords
  switch (lowerKeyword) {
    case 'latest':
    case 'recent':
    case 'last':
      // Most recently updated plan
      return plans.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] || null;
      
    case 'active':
    case 'current':
      // Most recent active plan
      const activePlans = plans.filter(p => p.status === 'active');
      return activePlans.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] || null;
      
    default:
      // Try exact ID match first
      const exactMatch = plans.find(p => p.id === planId);
      if (exactMatch) return exactMatch;
      
      // Try partial ID match (suffix matching)
      const partialMatch = plans.find(p => p.id.endsWith(planId));
      if (partialMatch) return partialMatch;
      
      return null;
  }
}

/**
 * Load all plans for workspace or across workspaces
 */
async function loadPlansWithScope(storage: Storage, scope: 'current' | 'all' = 'current'): Promise<Plan[]> {
  if (scope === 'all') {
    // Load from all workspaces
    const workspaces = await storage.discoverWorkspaces();
    const allPlans: Plan[] = [];
    
    for (const workspace of workspaces) {
      const plans = await loadAllPlansForWorkspace(storage, workspace);
      allPlans.push(...plans);
    }
    
    return allPlans.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } else {
    // Load from current workspace only
    return loadAllPlansForWorkspace(storage, storage.getCurrentWorkspace());
  }
}

/**
 * Load all plans for a specific workspace
 */
async function loadAllPlansForWorkspace(storage: Storage, workspace: string): Promise<Plan[]> {
  // Plans are stored as memories with type 'plan'
  const memories = await storage.loadAllMemories(workspace);
  const planMemories = memories.filter(m => m.type === 'plan');
  
  return planMemories.map(memory => {
    const plan = memory.content as unknown as Plan;
    // Convert date strings back to Date objects if needed
    if (typeof plan.createdAt === 'string') {
      plan.createdAt = new Date(plan.createdAt);
    }
    if (typeof plan.updatedAt === 'string') {
      plan.updatedAt = new Date(plan.updatedAt);
    }
    return plan;
  }).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Save plan as a memory
 */
async function savePlanAsMemory(storage: Storage, plan: Plan): Promise<void> {
  const memory = {
    id: plan.id,
    timestamp: plan.updatedAt,
    workspace: plan.workspace,
    sessionId: plan.sessionId,
    type: 'plan' as const,
    content: plan,
    ttlHours: plan.ttlHours || 0, // Plans don't expire by default
    tags: plan.tags,
    metadata: {
      planTitle: plan.title,
      planStatus: plan.status,
      planCategory: plan.category
    }
  };
  
  await storage.saveMemory(memory);
  
  // Update the relationship index
  try {
    const indexManager = new IndexManager(storage, plan.workspace);
    await indexManager.updateRelationship(plan.id, {
      planId: plan.id,
      planTitle: plan.title,
      planStatus: plan.status === 'complete' ? 'completed' : plan.status,
      linkedTodos: plan.generatedTodos,
      linkedCheckpoints: plan.relatedCheckpoints,
      completionPercentage: plan.completionPercentage,
      tags: plan.tags || []
    });
  } catch (error) {
    console.error('Failed to update relationship index:', error);
    // Don't fail the entire operation if index update fails
  }
}

/**
 * Calculate plan completion percentage based on generated TODOs
 */
async function calculatePlanCompletion(storage: Storage, plan: Plan): Promise<number> {
  if (plan.generatedTodos.length === 0) {
    return 0;
  }
  
  let totalTasks = 0;
  let completedTasks = 0;
  
  // Check completion status of all generated TODO lists
  for (const todoId of plan.generatedTodos) {
    try {
      const todoLists = await storage.loadAllTodoLists(plan.workspace);
      const todoList = todoLists.find(list => list.id === todoId);
      
      if (todoList) {
        totalTasks += todoList.items.length;
        completedTasks += todoList.items.filter(item => item.status === 'done').length;
      }
    } catch (error) {
      // Skip if TODO list not found or error loading
    }
  }
  
  return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
}

/**
 * Handle save action - create new plan
 */
async function handleSavePlan(storage: Storage, args: PlanArgs): Promise<ToolResponse> {
  if (!args.title || !args.description) {
    return createErrorResponse('📋 Please provide both title and description for your plan. Example: title="User Auth System", description="## Overview\\nImplement OAuth2 authentication..."', 'plan', args.format || 'emoji');
  }
  
  const targetWorkspace = args.workspace ? normalizeWorkspaceName(args.workspace) : storage.getCurrentWorkspace();
  
  const plan: Plan = {
    id: storage.generateChronologicalFilename().replace('.json', ''),
    title: args.title,
    description: args.description,
    items: args.items || [],
    category: args.category,
    status: 'draft',
    workspace: targetWorkspace,
    
    createdAt: new Date(),
    updatedAt: new Date(),
    
    generatedTodos: [],
    relatedCheckpoints: [],
    
    completionPercentage: 0,
    
    priority: args.priority || 'normal',
    tags: args.tags,
    estimatedEffort: args.estimatedEffort,
    ttlHours: args.ttlHours
  };
  
  await savePlanAsMemory(storage, plan);
  
  return createSuccessResponse(
    `📋 Plan "${args.title}" created successfully\n💡 Use plan({ action: "generate-todos", planId: "${plan.id}" }) to create TODO lists from this plan`,
    'plan',
    { planId: plan.id, title: plan.title, status: plan.status },
    args.format || 'emoji'
  );
}

/**
 * Handle restore action - view specific plan
 */
async function handleRestorePlan(storage: Storage, args: PlanArgs): Promise<ToolResponse> {
  if (!args.planId) {
    return createErrorResponse('planId is required for restore action', 'plan', args.format || 'emoji');
  }
  
  const plans = await loadPlansWithScope(storage, 'current');
  const plan = resolveSpecialPlanId(args.planId, plans);
  
  if (!plan) {
    return createErrorResponse(`🔍 Plan "${args.planId}" not found. Try using "latest" for the most recent plan, "active" for current work, or use action="list" to see all available plans.`, 'plan', args.format || 'emoji');
  }
  
  // Update completion percentage
  plan.completionPercentage = await calculatePlanCompletion(storage, plan);
  
  const statusIcon = plan.status === 'complete' ? '✅' : plan.status === 'abandoned' ? '❌' : plan.status === 'active' ? '🔄' : '📝';
  const priorityIcon = plan.priority === 'critical' ? '🔥' : plan.priority === 'high' ? '⚠️' : plan.priority === 'low' ? '🔹' : '📊';
  
  const output = [
    `${statusIcon} **${plan.title}** ${priorityIcon}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 Status: ${plan.status.toUpperCase()} • Progress: ${plan.completionPercentage}%`,
    `📂 Category: ${plan.category || 'general'} • Priority: ${plan.priority}`,
    `⏱️  Estimated: ${plan.estimatedEffort || 'not specified'}${plan.actualEffort ? ` • Actual: ${plan.actualEffort}` : ''}`,
    ``,
    `📝 **Description:**`,
    plan.description,
    ``
  ];
  
  if (plan.items.length > 0) {
    output.push(`🎯 **Plan Items:**`);
    plan.items.forEach((item, index) => {
      output.push(`   ${index + 1}. ${item}`);
    });
    output.push(``);
  }
  
  if (plan.generatedTodos.length > 0) {
    output.push(`✅ **Generated TODO Lists:** ${plan.generatedTodos.length}`);
    output.push(``);
  }
  
  if (plan.blockers && plan.blockers.length > 0) {
    output.push(`🚧 **Current Blockers:**`);
    plan.blockers.forEach(blocker => {
      output.push(`   • ${blocker}`);
    });
    output.push(``);
  }
  
  if (plan.outcomes && plan.outcomes.length > 0) {
    output.push(`📈 **Outcomes:**`);
    plan.outcomes.forEach(outcome => {
      output.push(`   • ${outcome}`);
    });
    output.push(``);
  }
  
  if (plan.lessons && plan.lessons.length > 0) {
    output.push(`💡 **Lessons Learned:**`);
    plan.lessons.forEach(lesson => {
      output.push(`   • ${lesson}`);
    });
    output.push(``);
  }
  
  return createSuccessResponse(
    output.join('\n'),
    'plan',
    {
      planId: plan.id,
      title: plan.title,
      status: plan.status,
      completionPercentage: plan.completionPercentage,
      generatedTodos: plan.generatedTodos.length,
      blockers: plan.blockers?.length || 0
    },
    args.format || 'emoji'
  );
}

/**
 * Handle update action - modify existing plan
 */
async function handleUpdatePlan(storage: Storage, args: PlanArgs): Promise<ToolResponse> {
  if (!args.planId) {
    return createErrorResponse('planId is required for update action', 'plan', args.format || 'emoji');
  }
  
  const plans = await loadPlansWithScope(storage, 'current');
  const plan = resolveSpecialPlanId(args.planId, plans);
  
  if (!plan) {
    return createErrorResponse(`🔍 Plan "${args.planId}" not found. Try using "latest" for the most recent plan, "active" for current work, or use action="list" to see all available plans.`, 'plan', args.format || 'emoji');
  }
  
  // Update fields
  if (args.status && args.status !== 'complete' && args.status !== 'abandoned') {
    plan.status = args.status;
  }
  
  if (args.outcomes) {
    plan.outcomes = [...(plan.outcomes || []), ...args.outcomes];
  }
  
  if (args.lessons) {
    plan.lessons = [...(plan.lessons || []), ...args.lessons];
  }
  
  if (args.blockers) {
    plan.blockers = args.blockers;
  }
  
  if (args.actualEffort) {
    plan.actualEffort = args.actualEffort;
  }
  
  plan.updatedAt = new Date();
  plan.completionPercentage = await calculatePlanCompletion(storage, plan);
  
  await savePlanAsMemory(storage, plan);
  
  return createSuccessResponse(
    `📋 Plan "${plan.title}" updated successfully (${plan.completionPercentage}% complete)`,
    'plan',
    { planId: plan.id, completionPercentage: plan.completionPercentage },
    args.format || 'emoji'
  );
}

/**
 * Handle complete action - mark plan as completed
 */
async function handleCompletePlan(storage: Storage, args: PlanArgs): Promise<ToolResponse> {
  if (!args.planId) {
    return createErrorResponse('planId is required for complete action', 'plan', args.format || 'emoji');
  }
  
  const plans = await loadPlansWithScope(storage, 'current');
  const plan = resolveSpecialPlanId(args.planId, plans);
  
  if (!plan) {
    return createErrorResponse(`🔍 Plan "${args.planId}" not found. Try using "latest" for the most recent plan, "active" for current work, or use action="list" to see all available plans.`, 'plan', args.format || 'emoji');
  }
  
  plan.status = 'complete';
  plan.completedAt = new Date();
  plan.updatedAt = new Date();
  plan.completionPercentage = await calculatePlanCompletion(storage, plan);
  
  if (args.reason) {
    plan.outcomes = [...(plan.outcomes || []), `Completed: ${args.reason}`];
  }
  
  if (args.nextSteps) {
    plan.lessons = [...(plan.lessons || []), ...args.nextSteps.map(step => `Next: ${step}`)];
  }
  
  await savePlanAsMemory(storage, plan);
  
  return createSuccessResponse(
    `✅ Plan "${plan.title}" marked as complete! (${plan.completionPercentage}% completion)`,
    'plan',
    { planId: plan.id, status: 'complete', completionPercentage: plan.completionPercentage },
    args.format || 'emoji'
  );
}

/**
 * Handle abandon action - mark plan as abandoned
 */
async function handleAbandonPlan(storage: Storage, args: PlanArgs): Promise<ToolResponse> {
  if (!args.planId) {
    return createErrorResponse('planId is required for abandon action', 'plan', args.format || 'emoji');
  }
  
  const plans = await loadPlansWithScope(storage, 'current');
  const plan = resolveSpecialPlanId(args.planId, plans);
  
  if (!plan) {
    return createErrorResponse(`🔍 Plan "${args.planId}" not found. Try using "latest" for the most recent plan, "active" for current work, or use action="list" to see all available plans.`, 'plan', args.format || 'emoji');
  }
  
  plan.status = 'abandoned';
  plan.abandonedAt = new Date();
  plan.updatedAt = new Date();
  
  if (args.reason) {
    plan.lessons = [...(plan.lessons || []), `Abandoned: ${args.reason}`];
  }
  
  await savePlanAsMemory(storage, plan);
  
  return createSuccessResponse(
    `❌ Plan "${plan.title}" marked as abandoned`,
    'plan',
    { planId: plan.id, status: 'abandoned', reason: args.reason },
    args.format || 'emoji'
  );
}

/**
 * Handle list action - show all plans
 */
async function handleListPlans(storage: Storage, args: PlanArgs): Promise<ToolResponse> {
  const plans = await loadPlansWithScope(storage, args.scope || 'current');
  
  if (plans.length === 0) {
    return createSuccessResponse(
      '📋 No plans found. Use plan({ action: "save", title: "...", description: "..." }) to create your first plan!',
      'plan',
      { totalPlans: 0 },
      args.format || 'emoji'
    );
  }
  
  // Filter by completion status if specified
  const filteredPlans = args.showCompleted === false 
    ? plans.filter(p => p.status !== 'complete' && p.status !== 'abandoned')
    : plans;
  
  const output = [`📋 ${filteredPlans.length} Plans Found`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`];
  
  for (const plan of filteredPlans.slice(0, 10)) {
    const statusIcon = plan.status === 'complete' ? '✅' : plan.status === 'abandoned' ? '❌' : plan.status === 'active' ? '🔄' : '📝';
    const priorityIcon = plan.priority === 'critical' ? '🔥' : plan.priority === 'high' ? '⚠️' : '';
    
    // Update completion percentage
    plan.completionPercentage = await calculatePlanCompletion(storage, plan);
    
    output.push(`${statusIcon} **${plan.title}** ${priorityIcon}`);
    output.push(`   ID: ${plan.id} • ${plan.category || 'general'} • ${plan.completionPercentage}% complete`);
    output.push(``);
  }
  
  if (filteredPlans.length > 10) {
    output.push(`... and ${filteredPlans.length - 10} more plans`);
  }
  
  return createSuccessResponse(
    output.join('\n'),
    'plan',
    {
      totalPlans: plans.length,
      filteredPlans: filteredPlans.length,
      activePlans: plans.filter(p => p.status === 'active').length,
      completedPlans: plans.filter(p => p.status === 'complete').length,
      plans: filteredPlans.slice(0, 10) // Include actual plan objects for API consumers
    },
    args.format || 'emoji'
  );
}

/**
 * Handle generate-todos action - create TODO lists from plan items
 */
async function handleGenerateTodos(storage: Storage, args: PlanArgs): Promise<ToolResponse> {
  if (!args.planId) {
    return createErrorResponse('planId is required for generate-todos action', 'plan', args.format || 'emoji');
  }
  
  const plans = await loadPlansWithScope(storage, 'current');
  const plan = resolveSpecialPlanId(args.planId, plans);
  
  if (!plan) {
    return createErrorResponse(`🔍 Plan "${args.planId}" not found. Try using "latest" for the most recent plan, "active" for current work, or use action="list" to see all available plans.`, 'plan', args.format || 'emoji');
  }
  
  if (!plan.items || plan.items.length === 0) {
    return createErrorResponse(`Plan "${plan.title}" has no items to generate TODOs from`, 'plan', args.format || 'emoji');
  }
  
  // Create a TODO list from the plan items
  const todoTitle = args.todoTitle || `${plan.title} - Implementation Tasks`;
  
  try {
    const todoResult = await handleTodo(storage, {
      action: 'create',
      title: todoTitle,
      items: plan.items,
      description: `Generated from plan: ${plan.title}`,
      metadata: {
        sourcePlan: plan.id,
        planTitle: plan.title,
        generatedAt: new Date().toISOString()
      },
      workspace: plan.workspace
    });
    
    // Check if TODO creation failed
    if (todoResult.isError) {
      throw new Error(`TODO creation failed: ${todoResult.content?.[0]?.text || 'Unknown error'}`);
    }
    
    // Extract TODO list ID from the response data
    let todoListId: string | undefined;
    try {
      if (todoResult.content?.[0]?.text) {
        const parsedData = JSON.parse(todoResult.content[0].text);
        todoListId = parsedData.data?.id;
      }
      
      if (!todoListId) {
        throw new Error('TODO ID not found in response');
      }
    } catch (parseError) {
      // Fallback: extract ID from text message using regex
      if (todoResult.content?.[0]?.text) {
        const idMatch = todoResult.content[0].text.match(/ID: ([^)]+)\)/);
        if (idMatch && idMatch[1]) {
          todoListId = idMatch[1];
        } else {
          throw new Error('Could not extract TODO ID from response');
        }
      } else {
        throw new Error('No content available to extract TODO ID');
      }
    }
    
    // Ensure todoListId is defined before proceeding
    if (!todoListId) {
      throw new Error('Failed to extract TODO ID from response');
    }
    
    // Update the plan to track the generated TODO
    plan.generatedTodos.push(todoListId);
    plan.status = 'active'; // Activate the plan when TODOs are generated
    plan.updatedAt = new Date();
    
    await savePlanAsMemory(storage, plan);
    
    return createSuccessResponse(
      `✅ Generated TODO list "${todoTitle}" from plan "${plan.title}"\n🔗 Plan is now active and linked to the TODO list`,
      'plan',
      { 
        planId: plan.id, 
        todoTitle: todoTitle,
        itemsGenerated: plan.items.length,
        planStatus: 'active'
      },
      args.format || 'emoji'
    );
    
  } catch (error) {
    return createErrorResponse(
      `Failed to generate TODO list: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'plan',
      args.format || 'emoji'
    );
  }
}

/**
 * Main unified Plan tool handler
 */
export async function handlePlan(storage: Storage, args: PlanArgs): Promise<ToolResponse> {
  try {
    // Validate input
    const validation = validateCommonArgs(args || {});
    if (!validation.isValid) {
      return createErrorResponse(validation.error!, 'plan', args?.format || 'emoji');
    }
    
    // Determine action - use provided action or infer from arguments
    const action = args.action || inferPlanAction(args);
    
    // Route to appropriate handler based on action
    switch (action) {
      case 'save':
        return handleSavePlan(storage, args);
      case 'restore':
        return handleRestorePlan(storage, args);
      case 'update':
        return handleUpdatePlan(storage, args);
      case 'complete':
        return handleCompletePlan(storage, args);
      case 'abandon':
        return handleAbandonPlan(storage, args);
      case 'list':
        return handleListPlans(storage, args);
      case 'generate-todos':
        return handleGenerateTodos(storage, args);
      default:
        return createErrorResponse(`Unknown action: ${action}`, 'plan', args.format || 'emoji');
    }
    
  } catch (error) {
    return createErrorResponse(
      `Error in plan tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'plan',
      args?.format || 'emoji'
    );
  }
}

/**
 * Get tool schema for plan tool
 */
export function getPlanToolSchema() {
  return {
    name: 'plan',
    description: 'PROACTIVE planning tool for complex features and architecture. Use BEFORE coding to design implementation approach, break down requirements, identify risks, and generate TODO lists. Different from checkpoint: plan = future work design, checkpoint = current progress save. Essential for features requiring multiple files/steps.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['save', 'restore', 'update', 'complete', 'abandon', 'list', 'generate-todos'],
          description: 'Action to perform. Defaults to "list" to show current plans. Use "save" to create new plans.'
        },
        
        // Save action properties
        title: {
          type: 'string',
          description: 'Plan title (required for save action)'
        },
        description: {
          type: 'string',
          description: 'Full markdown plan description (required for save action)'
        },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'High-level plan items/milestones'
        },
        category: {
          type: 'string',
          enum: ['feature', 'refactor', 'research', 'architecture', 'bugfix', 'maintenance'],
          description: 'Plan category for organization'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'critical'],
          description: 'Plan priority level',
          default: 'normal'
        },
        estimatedEffort: {
          type: 'string',
          description: 'Estimated time/effort (e.g., "2 days", "1 week")'
        },
        
        // Update/restore properties
        planId: {
          type: 'string',
          description: 'Plan ID (supports "latest", "active", partial matches)'
        },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'complete', 'abandoned'],
          description: 'Plan status for updates'
        },
        outcomes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Outcomes or results achieved'
        },
        lessons: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lessons learned during execution'
        },
        blockers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Current blockers preventing progress'
        },
        actualEffort: {
          type: 'string',
          description: 'Actual time spent on the plan'
        },
        
        // Complete/abandon properties
        reason: {
          type: 'string',
          description: 'Reason for completion or abandonment'
        },
        nextSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Follow-up steps or recommendations'
        },
        
        // Generate-todos properties
        todoTitle: {
          type: 'string',
          description: 'Title for generated TODO list (optional, will auto-generate)'
        },
        
        // List properties
        scope: {
          type: 'string',
          enum: ['current', 'all'],
          description: 'Search scope: current workspace or all workspaces',
          default: 'current'
        },
        showCompleted: {
          type: 'boolean',
          description: 'Include completed and abandoned plans',
          default: true
        },
        
        // Common properties
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization and search'
        },
        workspace: {
          type: 'string',
          description: 'Target workspace (path or name)'
        },
        ttlHours: {
          type: 'number',
          description: 'Time-to-live in hours (plans persist indefinitely by default)'
        },
        format: {
          type: 'string',
          enum: ['plain', 'emoji', 'json', 'dual'],
          description: 'Output format override'
        }
      }
    }
  };
}