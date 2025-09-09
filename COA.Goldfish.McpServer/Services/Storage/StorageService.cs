using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using COA.Goldfish.McpServer.Models;

namespace COA.Goldfish.McpServer.Services.Storage;

public class StorageService : IStorageService
{
    private readonly GoldfishDbContext _context;
    private readonly ILogger<StorageService> _logger;

    public StorageService(GoldfishDbContext context, ILogger<StorageService> logger)
    {
        _context = context;
        _logger = logger;
    }

    // Checkpoint operations
    public async Task<Checkpoint> SaveCheckpointAsync(Checkpoint checkpoint)
    {
        var existing = await _context.Checkpoints.FindAsync(checkpoint.Id);
        if (existing != null)
        {
            _context.Entry(existing).CurrentValues.SetValues(checkpoint);
        }
        else
        {
            _context.Checkpoints.Add(checkpoint);
        }
        
        await _context.SaveChangesAsync();
        return checkpoint;
    }

    public async Task<Checkpoint?> GetCheckpointAsync(string checkpointId)
    {
        return await _context.Checkpoints.FindAsync(checkpointId);
    }

    public async Task<List<Checkpoint>> GetCheckpointsAsync(string workspaceId, int limit = 10)
    {
        return await _context.Checkpoints
            .Where(c => c.WorkspaceId == workspaceId)
            .OrderByDescending(c => c.CreatedAt)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<Checkpoint?> GetLatestCheckpointAsync(string workspaceId)
    {
        return await _context.Checkpoints
            .Where(c => c.WorkspaceId == workspaceId)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();
    }

    public async Task<bool> DeleteCheckpointAsync(string checkpointId)
    {
        var checkpoint = await _context.Checkpoints.FindAsync(checkpointId);
        if (checkpoint != null)
        {
            _context.Checkpoints.Remove(checkpoint);
            await _context.SaveChangesAsync();
            return true;
        }
        return false;
    }

    // Plan operations
    public async Task<Plan> SavePlanAsync(Plan plan)
    {
        var existing = await _context.Plans.FindAsync(plan.Id);
        if (existing != null)
        {
            plan.UpdatedAt = DateTime.UtcNow;
            _context.Entry(existing).CurrentValues.SetValues(plan);
        }
        else
        {
            _context.Plans.Add(plan);
        }
        
        await _context.SaveChangesAsync();
        return plan;
    }

    public async Task<Plan?> GetPlanAsync(string planId)
    {
        return await _context.Plans.FindAsync(planId);
    }

    public async Task<List<Plan>> GetPlansAsync(string workspaceId, bool includeCompleted = true)
    {
        var query = _context.Plans.Where(p => p.WorkspaceId == workspaceId);
        
        if (!includeCompleted)
        {
            query = query.Where(p => p.Status != PlanStatus.Complete && p.Status != PlanStatus.Abandoned);
        }
        
        return await query
            .OrderByDescending(p => p.UpdatedAt)
            .ToListAsync();
    }

    public async Task<Plan?> GetActivePlanAsync(string workspaceId)
    {
        return await _context.Plans
            .Where(p => p.WorkspaceId == workspaceId && p.Status == PlanStatus.Active)
            .OrderByDescending(p => p.UpdatedAt)
            .FirstOrDefaultAsync();
    }

    public async Task<bool> DeletePlanAsync(string planId)
    {
        var plan = await _context.Plans.FindAsync(planId);
        if (plan != null)
        {
            _context.Plans.Remove(plan);
            await _context.SaveChangesAsync();
            return true;
        }
        return false;
    }

    // TODO operations
    public async Task<TodoList> SaveTodoListAsync(TodoList todoList)
    {
        var existing = await _context.TodoLists.FindAsync(todoList.Id);
        if (existing != null)
        {
            todoList.UpdatedAt = DateTime.UtcNow;
            _context.Entry(existing).CurrentValues.SetValues(todoList);
        }
        else
        {
            _context.TodoLists.Add(todoList);
        }
        
        await _context.SaveChangesAsync();
        return todoList;
    }

    public async Task<TodoList?> GetTodoListAsync(string todoListId)
    {
        return await _context.TodoLists
            .Include(tl => tl.Items)
            .FirstOrDefaultAsync(tl => tl.Id == todoListId);
    }

    public async Task<List<TodoList>> GetTodoListsAsync(string workspaceId, bool includeCompleted = true)
    {
        var query = _context.TodoLists
            .Include(tl => tl.Items)
            .Where(tl => tl.WorkspaceId == workspaceId);
        
        return await query
            .OrderByDescending(tl => tl.UpdatedAt)
            .ToListAsync();
    }

    public async Task<TodoList?> GetActiveTodoListAsync(string workspaceId)
    {
        return await _context.TodoLists
            .Include(tl => tl.Items)
            .Where(tl => tl.WorkspaceId == workspaceId && tl.IsActive)
            .OrderByDescending(tl => tl.UpdatedAt)
            .FirstOrDefaultAsync();
    }

    public async Task<TodoList?> GetLatestTodoListAsync(string workspaceId)
    {
        return await _context.TodoLists
            .Include(tl => tl.Items)
            .Where(tl => tl.WorkspaceId == workspaceId)
            .OrderByDescending(tl => tl.UpdatedAt)
            .FirstOrDefaultAsync();
    }

    public async Task<bool> DeleteTodoListAsync(string todoListId)
    {
        var todoList = await _context.TodoLists.FindAsync(todoListId);
        if (todoList != null)
        {
            _context.TodoLists.Remove(todoList);
            await _context.SaveChangesAsync();
            return true;
        }
        return false;
    }

    public async Task<TodoItem> SaveTodoItemAsync(TodoItem todoItem)
    {
        var existing = await _context.TodoItems.FindAsync(todoItem.Id);
        if (existing != null)
        {
            todoItem.UpdatedAt = DateTime.UtcNow;
            _context.Entry(existing).CurrentValues.SetValues(todoItem);
        }
        else
        {
            _context.TodoItems.Add(todoItem);
        }
        
        await _context.SaveChangesAsync();
        return todoItem;
    }

    public async Task<TodoItem?> GetTodoItemAsync(string todoItemId)
    {
        return await _context.TodoItems.FindAsync(todoItemId);
    }

    public async Task<bool> DeleteTodoItemAsync(string todoItemId)
    {
        var todoItem = await _context.TodoItems.FindAsync(todoItemId);
        if (todoItem != null)
        {
            _context.TodoItems.Remove(todoItem);
            await _context.SaveChangesAsync();
            return true;
        }
        return false;
    }

    // Chronicle operations
    public async Task<ChronicleEntry> SaveChronicleEntryAsync(ChronicleEntry entry)
    {
        var existing = await _context.ChronicleEntries.FindAsync(entry.Id);
        if (existing != null)
        {
            _context.Entry(existing).CurrentValues.SetValues(entry);
        }
        else
        {
            _context.ChronicleEntries.Add(entry);
        }
        
        await _context.SaveChangesAsync();
        return entry;
    }

    public async Task<ChronicleEntry?> GetChronicleEntryAsync(string entryId)
    {
        return await _context.ChronicleEntries.FindAsync(entryId);
    }

    public async Task<List<ChronicleEntry>> GetChronicleEntriesAsync(string workspaceId, DateTime? since = null, int limit = 50)
    {
        var query = _context.ChronicleEntries.Where(e => e.WorkspaceId == workspaceId);
        
        if (since.HasValue)
        {
            query = query.Where(e => e.Timestamp >= since.Value);
        }
        
        return await query
            .OrderByDescending(e => e.Timestamp)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<bool> DeleteChronicleEntryAsync(string entryId)
    {
        var entry = await _context.ChronicleEntries.FindAsync(entryId);
        if (entry != null)
        {
            _context.ChronicleEntries.Remove(entry);
            await _context.SaveChangesAsync();
            return true;
        }
        return false;
    }

    // Workspace operations
    public async Task<WorkspaceState> GetWorkspaceStateAsync(string workspaceId)
    {
        var state = await _context.WorkspaceStates.FindAsync(workspaceId);
        if (state == null)
        {
            state = new WorkspaceState { WorkspaceId = workspaceId };
            _context.WorkspaceStates.Add(state);
            await _context.SaveChangesAsync();
        }
        return state;
    }

    public async Task<WorkspaceState> SaveWorkspaceStateAsync(WorkspaceState workspaceState)
    {
        workspaceState.LastActivity = DateTime.UtcNow;
        var existing = await _context.WorkspaceStates.FindAsync(workspaceState.WorkspaceId);
        if (existing != null)
        {
            _context.Entry(existing).CurrentValues.SetValues(workspaceState);
        }
        else
        {
            _context.WorkspaceStates.Add(workspaceState);
        }
        
        await _context.SaveChangesAsync();
        return workspaceState;
    }

    public async Task<List<string>> GetWorkspacesAsync()
    {
        return await _context.WorkspaceStates
            .Select(ws => ws.WorkspaceId)
            .Distinct()
            .ToListAsync();
    }

    // Search operations
    public async Task<List<T>> SearchAsync<T>(string workspaceId, string query, DateTime? since = null, int limit = 20) where T : class
    {
        // Basic implementation - can be enhanced with full-text search later
        var results = new List<T>();
        
        if (typeof(T) == typeof(Checkpoint))
        {
            var checkpoints = await SearchCheckpointsAsync(workspaceId, query, since, limit);
            results.AddRange(checkpoints.Cast<T>());
        }
        else if (typeof(T) == typeof(Plan))
        {
            var plans = await SearchPlansAsync(workspaceId, query, since, limit);
            results.AddRange(plans.Cast<T>());
        }
        else if (typeof(T) == typeof(TodoList))
        {
            var todoLists = await SearchTodoListsAsync(workspaceId, query, since, limit);
            results.AddRange(todoLists.Cast<T>());
        }
        else if (typeof(T) == typeof(ChronicleEntry))
        {
            var chronicles = await SearchChronicleEntriesAsync(workspaceId, query, since, limit);
            results.AddRange(chronicles.Cast<T>());
        }
        
        return results;
    }

    public async Task<List<Checkpoint>> SearchCheckpointsAsync(string workspaceId, string query, DateTime? since = null, int limit = 20)
    {
        var queryLower = query.ToLowerInvariant();
        return await _context.Checkpoints
            .Where(c => c.WorkspaceId == workspaceId && 
                       (c.Description.ToLower().Contains(queryLower) || 
                        c.WorkContext.ToLower().Contains(queryLower) ||
                        c.GitBranch.ToLower().Contains(queryLower)))
            .Where(c => !since.HasValue || c.CreatedAt >= since.Value)
            .OrderByDescending(c => c.CreatedAt)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<List<Plan>> SearchPlansAsync(string workspaceId, string query, DateTime? since = null, int limit = 20)
    {
        var queryLower = query.ToLowerInvariant();
        return await _context.Plans
            .Where(p => p.WorkspaceId == workspaceId && 
                       (p.Title.ToLower().Contains(queryLower) || 
                        p.Description.ToLower().Contains(queryLower) ||
                        p.Category.ToLower().Contains(queryLower)))
            .Where(p => !since.HasValue || p.CreatedAt >= since.Value)
            .OrderByDescending(p => p.UpdatedAt)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<List<TodoList>> SearchTodoListsAsync(string workspaceId, string query, DateTime? since = null, int limit = 20)
    {
        var queryLower = query.ToLowerInvariant();
        return await _context.TodoLists
            .Include(tl => tl.Items)
            .Where(tl => tl.WorkspaceId == workspaceId && 
                        (tl.Title.ToLower().Contains(queryLower) || 
                         tl.Description.ToLower().Contains(queryLower)))
            .Where(tl => !since.HasValue || tl.CreatedAt >= since.Value)
            .OrderByDescending(tl => tl.UpdatedAt)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<List<ChronicleEntry>> SearchChronicleEntriesAsync(string workspaceId, string query, DateTime? since = null, int limit = 20)
    {
        var queryLower = query.ToLowerInvariant();
        return await _context.ChronicleEntries
            .Where(ce => ce.WorkspaceId == workspaceId && 
                        ce.Description.ToLower().Contains(queryLower))
            .Where(ce => !since.HasValue || ce.Timestamp >= since.Value)
            .OrderByDescending(ce => ce.Timestamp)
            .Take(limit)
            .ToListAsync();
    }

    // Advanced queries for keyword resolution (latest, active, etc.)
    public async Task<TodoList?> ResolveTodoListKeywordAsync(string workspaceId, string keyword)
    {
        return keyword.ToLowerInvariant() switch
        {
            "latest" or "recent" or "last" => await GetLatestTodoListAsync(workspaceId),
            "active" or "current" => await GetActiveTodoListAsync(workspaceId),
            _ => await _context.TodoLists
                .Include(tl => tl.Items)
                .Where(tl => tl.WorkspaceId == workspaceId && 
                           (tl.Id.EndsWith(keyword) || tl.Id.Contains(keyword)))
                .OrderByDescending(tl => tl.UpdatedAt)
                .FirstOrDefaultAsync()
        };
    }

    public async Task<Plan?> ResolvePlanKeywordAsync(string workspaceId, string keyword)
    {
        return keyword.ToLowerInvariant() switch
        {
            "latest" or "recent" or "last" => await _context.Plans
                .Where(p => p.WorkspaceId == workspaceId)
                .OrderByDescending(p => p.UpdatedAt)
                .FirstOrDefaultAsync(),
            "active" or "current" => await GetActivePlanAsync(workspaceId),
            _ => await _context.Plans
                .Where(p => p.WorkspaceId == workspaceId && 
                           (p.Id.EndsWith(keyword) || p.Id.Contains(keyword)))
                .OrderByDescending(p => p.UpdatedAt)
                .FirstOrDefaultAsync()
        };
    }

    // Cleanup operations
    public async Task<int> CleanupExpiredItemsAsync()
    {
        var now = DateTime.UtcNow;
        var count = 0;
        
        // Clean up expired checkpoints
        var expiredCheckpoints = await _context.Checkpoints
            .Where(c => c.TtlExpiry.HasValue && c.TtlExpiry.Value <= now)
            .ToListAsync();
        _context.Checkpoints.RemoveRange(expiredCheckpoints);
        count += expiredCheckpoints.Count;
        
        // Clean up expired plans
        var expiredPlans = await _context.Plans
            .Where(p => p.TtlExpiry.HasValue && p.TtlExpiry.Value <= now)
            .ToListAsync();
        _context.Plans.RemoveRange(expiredPlans);
        count += expiredPlans.Count;
        
        // Clean up expired todo lists
        var expiredTodos = await _context.TodoLists
            .Where(t => t.TtlExpiry.HasValue && t.TtlExpiry.Value <= now)
            .ToListAsync();
        _context.TodoLists.RemoveRange(expiredTodos);
        count += expiredTodos.Count;
        
        // Clean up expired chronicle entries
        var expiredChronicles = await _context.ChronicleEntries
            .Where(c => c.TtlExpiry.HasValue && c.TtlExpiry.Value <= now)
            .ToListAsync();
        _context.ChronicleEntries.RemoveRange(expiredChronicles);
        count += expiredChronicles.Count;
        
        if (count > 0)
        {
            await _context.SaveChangesAsync();
            _logger.LogInformation("Cleaned up {Count} expired items", count);
        }
        
        return count;
    }

    public async Task<int> CleanupWorkspaceAsync(string workspaceId)
    {
        var count = 0;
        
        // Clean up checkpoints for workspace
        var checkpoints = await _context.Checkpoints
            .Where(c => c.WorkspaceId == workspaceId)
            .ToListAsync();
        _context.Checkpoints.RemoveRange(checkpoints);
        count += checkpoints.Count;
        
        // Clean up plans for workspace
        var plans = await _context.Plans
            .Where(p => p.WorkspaceId == workspaceId)
            .ToListAsync();
        _context.Plans.RemoveRange(plans);
        count += plans.Count;
        
        // Clean up todo lists for workspace
        var todoLists = await _context.TodoLists
            .Where(t => t.WorkspaceId == workspaceId)
            .ToListAsync();
        _context.TodoLists.RemoveRange(todoLists);
        count += todoLists.Count;
        
        // Clean up chronicle entries for workspace
        var chronicles = await _context.ChronicleEntries
            .Where(c => c.WorkspaceId == workspaceId)
            .ToListAsync();
        _context.ChronicleEntries.RemoveRange(chronicles);
        count += chronicles.Count;
        
        // Clean up workspace state
        var workspaceState = await _context.WorkspaceStates.FindAsync(workspaceId);
        if (workspaceState != null)
        {
            _context.WorkspaceStates.Remove(workspaceState);
            count++;
        }
        
        if (count > 0)
        {
            await _context.SaveChangesAsync();
            _logger.LogInformation("Cleaned up workspace {WorkspaceId}: {Count} items removed", workspaceId, count);
        }
        
        return count;
    }

    // Transaction support
    public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var result = await operation();
            await transaction.CommitAsync();
            return result;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task ExecuteInTransactionAsync(Func<Task> operation)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            await operation();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Bulk operations
    public async Task<int> BulkSaveCheckpointsAsync(IEnumerable<Checkpoint> checkpoints)
    {
        var checkpointList = checkpoints.ToList();
        var count = 0;
        
        foreach (var checkpoint in checkpointList)
        {
            var existing = await _context.Checkpoints.FindAsync(checkpoint.Id);
            if (existing != null)
            {
                _context.Entry(existing).CurrentValues.SetValues(checkpoint);
            }
            else
            {
                _context.Checkpoints.Add(checkpoint);
                count++;
            }
        }
        
        await _context.SaveChangesAsync();
        return count;
    }

    public async Task<int> BulkDeleteExpiredAsync<T>(DateTime expiredBefore) where T : class
    {
        var count = 0;
        
        if (typeof(T) == typeof(Checkpoint))
        {
            var expired = await _context.Checkpoints
                .Where(c => c.TtlExpiry.HasValue && c.TtlExpiry.Value <= expiredBefore)
                .ToListAsync();
            _context.Checkpoints.RemoveRange(expired);
            count = expired.Count;
        }
        else if (typeof(T) == typeof(Plan))
        {
            var expired = await _context.Plans
                .Where(p => p.TtlExpiry.HasValue && p.TtlExpiry.Value <= expiredBefore)
                .ToListAsync();
            _context.Plans.RemoveRange(expired);
            count = expired.Count;
        }
        else if (typeof(T) == typeof(TodoList))
        {
            var expired = await _context.TodoLists
                .Where(t => t.TtlExpiry.HasValue && t.TtlExpiry.Value <= expiredBefore)
                .ToListAsync();
            _context.TodoLists.RemoveRange(expired);
            count = expired.Count;
        }
        else if (typeof(T) == typeof(ChronicleEntry))
        {
            var expired = await _context.ChronicleEntries
                .Where(c => c.TtlExpiry.HasValue && c.TtlExpiry.Value <= expiredBefore)
                .ToListAsync();
            _context.ChronicleEntries.RemoveRange(expired);
            count = expired.Count;
        }
        
        if (count > 0)
        {
            await _context.SaveChangesAsync();
            _logger.LogInformation("Bulk deleted {Count} expired {Type} items", count, typeof(T).Name);
        }
        
        return count;
    }
}