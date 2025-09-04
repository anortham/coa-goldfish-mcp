/**
 * View TODO Lists Tool for Goldfish MCP
 * 
 * Views all active TODO lists or specific list details
 * Features multi-list visibility to prevent disappearing lists
 */

import { Storage } from '../core/storage.js';
import { ToolResponse } from '../types/index.js';
import { 
  loadTodoListsWithScope, 
  formatWorkspaceLabel, 
  validateCommonArgs, 
  createErrorResponse,
  createStructuredResponse,
  getTaskStatusIcon,
  calculatePercentage,
  truncateText,
  resolveSpecialTodoListId
} from '../core/workspace-utils.js';

export interface ViewTodosArgs {
  listId?: string;
  showCompleted?: boolean;
  scope?: 'current' | 'all';
  format?: import('../core/output-utils.js').OutputMode;
  summary?: boolean;
}

/**
 * Background cleanup - silently maintain TODO list lifecycle
 * 1. Complete lists where all tasks are done
 * 2. Archive lists inactive for 7+ days with pending tasks
 * 3. Delete archived lists older than 30 days
 */
async function performBackgroundCleanup(storage: Storage, todoLists: any[]): Promise<void> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  for (const list of todoLists) {
    let needsSave = false;
    const lastUpdate = new Date(list.updatedAt);
    
    // 1. Auto-complete lists where all tasks are done
    const allItemsDone = list.items.length > 0 && list.items.every((item: any) => item.status === 'done');
    if (allItemsDone && list.status !== 'completed') {
      list.status = 'completed';
      list.completedAt = now;
      list.updatedAt = now;
      needsSave = true;
    }
    
    // 2. Archive lists inactive for 7+ days with pending tasks
    else if (list.status === 'active' && lastUpdate < sevenDaysAgo && !allItemsDone) {
      list.status = 'archived';
      list.archivedAt = now;
      list.updatedAt = now;
      needsSave = true;
    }
    
    // 3. Delete archived lists older than 30 days
    else if (list.status === 'archived' && lastUpdate < thirtyDaysAgo) {
      try {
        await storage.deleteTodoList(list.id, list.workspace);
        continue; // Skip save since we deleted
      } catch (error) {
        // Ignore deletion errors, list will be retried next time
      }
    }
    
    if (needsSave) {
      try {
        await storage.saveTodoList(list);
      } catch (error) {
        // Ignore save errors to prevent blocking the view operation
      }
    }
  }
}


/**
 * Handle view TODOs - shows all lists or specific list details
 */
export async function handleViewTodos(storage: Storage, args: ViewTodosArgs): Promise<ToolResponse> {
  // Validate input (args can be empty/undefined for this tool)
  if (args !== undefined && args !== null) {
    const validation = validateCommonArgs(args);
    if (!validation.isValid) {
      return createErrorResponse(validation.error!, 'view_todos', 'emoji');
    }
  }

  const safeArgs = args || {};
  const { listId, scope = 'current', format, summary = false } = safeArgs;

  if (listId) {
    // View specific list 
    const todoLists = await loadTodoListsWithScope(storage, scope);
    
    // Use the resolver to handle "latest" and other special keywords
    const targetList = resolveSpecialTodoListId(listId, todoLists);
    
    if (!targetList) {
      // Provide helpful error message for special keywords
      const isSpecialKeyword = ['latest', 'recent', 'last', 'active', 'current'].includes(listId.toLowerCase().trim());
      if (isSpecialKeyword) {
        return createErrorResponse(`❓ No ${listId} TODO list found`, 'view_todos', 'emoji');
      }
      return createErrorResponse(`❓ TODO list "${listId}" not found`, 'view_todos', 'emoji');
    }
    
    // Sort items by ID number (1,2,3,4,5,6,7) regardless of status
    const listItems = [...targetList.items].sort((a, b) => {
      return parseInt(a.id) - parseInt(b.id);
    });

    // Build formatted output for specific list
    const output = [];
    
    const completedCount = listItems.filter(i => i.status === 'done').length;
    const activeCount = listItems.filter(i => i.status === 'active').length;
    const percentage = calculatePercentage(completedCount, listItems.length);
    
    const workspaceLabel = formatWorkspaceLabel(targetList.workspace, storage.getCurrentWorkspace(), scope);
    
    output.push(`📋 ${targetList.title}${workspaceLabel}`);
    output.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    output.push(`📊 Progress: ${percentage}% (${completedCount}/${listItems.length}) • Active: ${activeCount}`);
    output.push(``);
    
    // Each todo item
    for (const item of listItems) {
      const icon = getTaskStatusIcon(item.status);
      const taskText = truncateText(item.task, 80);
      output.push(`${icon} [${item.id}] ${taskText}`);
    }
    
    // Create structured response
    const data = {
      listId: targetList.id,
      title: targetList.title,
      totalTasks: listItems.length,
      completedTasks: completedCount,
      activeTasks: activeCount,
      percentage: percentage,
      items: listItems.map(item => ({
        id: item.id,
        task: item.task,
        status: item.status
      }))
    };

    // For specific list details, prefer JSON for easier parsing in tests/consumers unless explicitly overridden
    return createStructuredResponse('view-todos', output.join('\n'), data, undefined, format || 'json');
  }

  let todoLists = await loadTodoListsWithScope(storage, scope);
  
  // Background cleanup - silently maintain list lifecycle
  await performBackgroundCleanup(storage, todoLists);
  
  // Reload to get cleaned up lists
  todoLists = await loadTodoListsWithScope(storage, scope);
  
  if (todoLists.length === 0) {
    const scopeText = scope === 'all' ? ' across all workspaces' : '';
    return {
      content: [
        {
          type: 'text',
          text: `📝 No active TODO lists found${scopeText}. Use create_todo_list to start tracking your work!`
        }
      ]
    };
  }

  // Show ALL todo lists with summary information
  // Sort: incomplete lists first, then by most recent update
  const sortedLists = todoLists.sort((a, b) => {
    const aIncomplete = a.items.some((item: any) => item.status !== 'done');
    const bIncomplete = b.items.some((item: any) => item.status !== 'done');
    
    // Incomplete lists first
    if (aIncomplete && !bIncomplete) return -1;
    if (!aIncomplete && bIncomplete) return 1;
    
    // Within same completion state, sort by most recent update
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Check if we need summary mode for token limit management
  if (summary || sortedLists.length > 10) {
    // Build compact summary for standup/large datasets
    const output = [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const relevantLists = sortedLists.filter(list => {
      const lastUpdate = new Date(list.updatedAt);
      const hasPendingTasks = list.items.some((item: any) => item.status !== 'done');
      
      // Show lists that are:
      // 1. Recently updated (within 24h) OR
      // 2. Active status with pending tasks OR  
      // 3. Have no explicit status (legacy) with pending tasks
      return (
        lastUpdate > twentyFourHoursAgo ||
        (list.status === 'active' && hasPendingTasks) ||
        (!list.status && hasPendingTasks)
      );
    });
    
    if (relevantLists.length === 0) {
      output.push(`📋 No active or recent TODO lists found! 🎉`);
    } else {
      output.push(`📋 ${relevantLists.length} active/recent TODO lists (${todoLists.length} total)`);
      
      // Show only relevant lists with basic info
      for (const list of relevantLists.slice(0, 5)) {
        const pendingTasks = list.items.filter((item: any) => item.status !== 'done');
        const workspaceLabel = formatWorkspaceLabel(list.workspace, storage.getCurrentWorkspace(), scope);
        const statusIcon = list.status === 'completed' ? '✅' : (pendingTasks.length === 0 ? '✅' : '📝');
        output.push(`${statusIcon} ${list.title}${workspaceLabel}: ${pendingTasks.length} pending`);
      }
      
      if (relevantLists.length > 5) {
        output.push(`... and ${relevantLists.length - 5} more relevant lists`);
      }
    }
    
    output.push(`💡 Use view_todos({ listId: "latest" }) for details`);
    
    // Minimal data for summary mode  
    const data = {
      totalLists: todoLists.length,
      activeLists: relevantLists.length,
      completedLists: todoLists.length - relevantLists.length,
      summaryMode: true,
      filteredView: true // Indicate this is showing only active/recent
    };

    return createStructuredResponse('view-todos', output.join('\n'), data, undefined, format || 'json');
  }

  // Full detailed view for smaller datasets
  const output = [];
  
  output.push(`📋 Active TODO Lists (${todoLists.length} found)`);
  output.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Show each list with summary
  for (let i = 0; i < sortedLists.length; i++) {
    const list = sortedLists[i];
    if (!list) continue; // Skip null/undefined entries
    
    const completedCount = list.items.filter((item: any) => item.status === 'done').length;
    const totalCount = list.items.length;
    const percentage = calculatePercentage(completedCount, totalCount);
    const pendingCount = totalCount - completedCount;
    
    const workspaceLabel = formatWorkspaceLabel(list.workspace, storage.getCurrentWorkspace(), scope);
    
    const numberIcon = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'][i] || `${i + 1}️⃣`;
    
    output.push(`${numberIcon} ${list.title}${workspaceLabel}`);
    output.push(`   ID: ${list.id}`);
    
    if (percentage === 100) {
      output.push(`   📊 100% (${completedCount}/${totalCount}) • ✅ Complete`);
    } else {
      output.push(`   📊 ${percentage}% (${completedCount}/${totalCount}) • ${pendingCount} pending tasks`);
    }
    
    if (i < sortedLists.length - 1) {
      output.push(``); // Blank line between lists
    }
  }
  
  output.push(``);
  output.push(`💡 Use view_todos({ listId: "..." }) to see specific list details`);
  
  // Create structured response with proper formatting
  const data = {
    totalLists: todoLists.length,
    lists: sortedLists.map(list => {
      const completedTasks = list.items.filter((item: any) => item.status === 'done').length;
      const totalTasks = list.items.length;
      return {
        id: list.id,
        title: list.title,
        totalTasks,
        completedTasks,
        activeTasks: list.items.filter((item: any) => item.status === 'active').length,
        percentage: calculatePercentage(completedTasks, totalTasks),
        workspace: list.workspace
      };
    })
  };

  // Summary view: prefer JSON for stable parsing in tests/consumers unless explicitly overridden
  return createStructuredResponse('view-todos', output.join('\n'), data, undefined, format || 'json');
}

/**
 * Get tool schema for view_todos tool
 */
export function getViewTodosToolSchema() {
  return {
    name: 'view_todos',
    description: 'ALWAYS check TODO lists when starting work or after completing tasks. Shows progress and pending items. Use PROACTIVELY to stay organized and track work. Smart filtering shows only active/recent lists by default. Auto-summary mode for large datasets.',
    inputSchema: {
      type: 'object',
      properties: {
        listId: {
          type: 'string',
          description: 'Specific list ID to view (optional)'
        },
        showCompleted: {
          type: 'boolean',
          description: 'Include completed items (default: true)',
          default: true
        },
        scope: {
          type: 'string',
          enum: ['current', 'all'],
          description: 'Search scope: current workspace or all workspaces (default: current)',
          default: 'current'
        },
        format: {
          type: 'string',
          enum: ['plain', 'emoji', 'json', 'dual'],
          description: 'Output format override (defaults to env GOLDFISH_OUTPUT_MODE or dual)'
        },
        summary: {
          type: 'boolean',
          description: 'Show compact summary view for token limit management (default: false, auto-enabled for >10 lists)',
          default: false
        }
      }
    }
  };
}
