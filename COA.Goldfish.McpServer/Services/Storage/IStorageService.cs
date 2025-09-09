using COA.Goldfish.McpServer.Models;

namespace COA.Goldfish.McpServer.Services.Storage;

public interface IStorageService
{
    // Checkpoint operations
    Task<Checkpoint> SaveCheckpointAsync(Checkpoint checkpoint);
    Task<Checkpoint?> GetCheckpointAsync(string checkpointId);
    Task<List<Checkpoint>> GetCheckpointsAsync(string workspaceId, int limit = 10);
    Task<Checkpoint?> GetLatestCheckpointAsync(string workspaceId);
    Task<bool> DeleteCheckpointAsync(string checkpointId);

    // Plan operations
    Task<Plan> SavePlanAsync(Plan plan);
    Task<Plan?> GetPlanAsync(string planId);
    Task<List<Plan>> GetPlansAsync(string workspaceId, bool includeCompleted = true);
    Task<Plan?> GetActivePlanAsync(string workspaceId);
    Task<bool> DeletePlanAsync(string planId);

    // TODO operations
    Task<TodoList> SaveTodoListAsync(TodoList todoList);
    Task<TodoList?> GetTodoListAsync(string todoListId);
    Task<List<TodoList>> GetTodoListsAsync(string workspaceId, bool includeCompleted = true);
    Task<TodoList?> GetActiveTodoListAsync(string workspaceId);
    Task<TodoList?> GetLatestTodoListAsync(string workspaceId);
    Task<bool> DeleteTodoListAsync(string todoListId);
    
    Task<TodoItem> SaveTodoItemAsync(TodoItem todoItem);
    Task<TodoItem?> GetTodoItemAsync(string todoItemId);
    Task<bool> DeleteTodoItemAsync(string todoItemId);

    // Chronicle operations
    Task<ChronicleEntry> SaveChronicleEntryAsync(ChronicleEntry entry);
    Task<ChronicleEntry?> GetChronicleEntryAsync(string entryId);
    Task<List<ChronicleEntry>> GetChronicleEntriesAsync(string workspaceId, DateTime? since = null, int limit = 50);
    Task<bool> DeleteChronicleEntryAsync(string entryId);

    // Workspace operations
    Task<WorkspaceState> GetWorkspaceStateAsync(string workspaceId);
    Task<WorkspaceState> SaveWorkspaceStateAsync(WorkspaceState workspaceState);
    Task<List<string>> GetWorkspacesAsync();

    // Search operations
    Task<List<T>> SearchAsync<T>(string workspaceId, string query, DateTime? since = null, int limit = 20) where T : class;
    Task<List<Checkpoint>> SearchCheckpointsAsync(string workspaceId, string query, DateTime? since = null, int limit = 20);
    Task<List<Plan>> SearchPlansAsync(string workspaceId, string query, DateTime? since = null, int limit = 20);
    Task<List<TodoList>> SearchTodoListsAsync(string workspaceId, string query, DateTime? since = null, int limit = 20);
    Task<List<ChronicleEntry>> SearchChronicleEntriesAsync(string workspaceId, string query, DateTime? since = null, int limit = 20);
    
    // Advanced queries for keyword resolution (latest, active, etc.)
    Task<TodoList?> ResolveTodoListKeywordAsync(string workspaceId, string keyword);
    Task<Plan?> ResolvePlanKeywordAsync(string workspaceId, string keyword);
    
    // Cleanup operations
    Task<int> CleanupExpiredItemsAsync();
    Task<int> CleanupWorkspaceAsync(string workspaceId);
    
    // Transaction support
    Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation);
    Task ExecuteInTransactionAsync(Func<Task> operation);
    
    // Bulk operations
    Task<int> BulkSaveCheckpointsAsync(IEnumerable<Checkpoint> checkpoints);
    Task<int> BulkDeleteExpiredAsync<T>(DateTime expiredBefore) where T : class;
}