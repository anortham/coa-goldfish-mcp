using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Services;

/// <summary>
/// Service for providing proactive workflow suggestions to encourage systematic development practices
/// </summary>
public class WorkflowSuggestionService
{
    private readonly IStorageService _storage;
    private readonly ILogger<WorkflowSuggestionService> _logger;

    public WorkflowSuggestionService(IStorageService storage, ILogger<WorkflowSuggestionService> logger)
    {
        _storage = storage;
        _logger = logger;
    }

    /// <summary>
    /// Get proactive workflow suggestions based on current session context
    /// </summary>
    public async Task<List<string>> GetWorkflowSuggestionsAsync(string workspaceId)
    {
        var suggestions = new List<string>();

        try
        {
            // Check checkpoint discipline
            await CheckCheckpointDisciplineAsync(workspaceId, suggestions);
            
            // Check planning discipline
            await CheckPlanningDisciplineAsync(workspaceId, suggestions);
            
            // Check todo management
            await CheckTodoManagementAsync(workspaceId, suggestions);

            _logger.LogDebug("Generated {Count} workflow suggestions for workspace {WorkspaceId}", 
                suggestions.Count, workspaceId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate workflow suggestions for workspace {WorkspaceId}", workspaceId);
        }

        return suggestions;
    }

    /// <summary>
    /// Check if checkpointing is being done regularly
    /// </summary>
    private async Task CheckCheckpointDisciplineAsync(string workspaceId, List<string> suggestions)
    {
        var recentCheckpoints = await _storage.GetCheckpointsAsync(workspaceId, limit: 1);
        
        if (!recentCheckpoints.Any())
        {
            suggestions.Add("💾 Consider creating your first checkpoint to save session context and build checkpoint discipline");
            return;
        }

        var lastCheckpoint = recentCheckpoints.First();
        var timeSinceLastCheckpoint = DateTime.UtcNow - lastCheckpoint.CreatedAt;

        if (timeSinceLastCheckpoint > TimeSpan.FromHours(2))
        {
            suggestions.Add("⚠️ Consider creating a checkpoint - you've been working for 2+ hours without saving progress");
        }
        else if (timeSinceLastCheckpoint > TimeSpan.FromHours(1))
        {
            suggestions.Add("⏰ Approaching checkpoint time - consider saving your progress soon");
        }
    }

    /// <summary>
    /// Check if strategic planning is being used for complex work
    /// </summary>
    private async Task CheckPlanningDisciplineAsync(string workspaceId, List<string> suggestions)
    {
        var activePlan = await _storage.GetActivePlanAsync(workspaceId);
        var activeTodos = await _storage.GetActiveTodoListAsync(workspaceId);
        
        // If there are active todos but no active plan, suggest planning
        if (activeTodos?.Items?.Any(i => i.Status == TodoItemStatus.Pending || i.Status == TodoItemStatus.Active) == true 
            && activePlan == null)
        {
            var taskCount = activeTodos.Items.Count(i => i.Status == TodoItemStatus.Pending || i.Status == TodoItemStatus.Active);
            if (taskCount >= 3)
            {
                suggestions.Add("📋 Complex work detected (3+ tasks) - consider creating a strategic plan first for better organization");
            }
        }

        // Check for stale plans
        if (activePlan != null)
        {
            var planAge = DateTime.UtcNow - activePlan.UpdatedAt;
            if (planAge > TimeSpan.FromDays(3))
            {
                suggestions.Add("📝 Your active plan hasn't been updated in 3+ days - consider reviewing progress and updating discoveries");
            }
        }
    }

    /// <summary>
    /// Check todo management practices
    /// </summary>
    private async Task CheckTodoManagementAsync(string workspaceId, List<string> suggestions)
    {
        var activeTodos = await _storage.GetActiveTodoListAsync(workspaceId);
        
        if (activeTodos == null)
        {
            suggestions.Add("✅ No active TODO list - consider breaking current work into manageable tasks for better organization");
            return;
        }

        var pendingTasks = activeTodos.Items?.Where(i => i.Status == TodoItemStatus.Pending).ToList() ?? new List<TodoItem>();
        var activeTasks = activeTodos.Items?.Where(i => i.Status == TodoItemStatus.Active).ToList() ?? new List<TodoItem>();
        var completedTasks = activeTodos.Items?.Where(i => i.Status == TodoItemStatus.Done).ToList() ?? new List<TodoItem>();

        // Check for multiple active tasks (should focus on one at a time)
        if (activeTasks.Count > 2)
        {
            suggestions.Add("🎯 Multiple active tasks detected - consider focusing on 1-2 tasks at a time for better completion");
        }

        // Check for stale active tasks
        var staleActiveTasks = activeTasks.Where(t => 
            DateTime.UtcNow - t.UpdatedAt > TimeSpan.FromHours(4)).ToList();
            
        if (staleActiveTasks.Any())
        {
            suggestions.Add("⏳ Some active tasks haven't been updated in 4+ hours - consider completing or reprioritizing them");
        }

        // Check completion rate
        var totalTasks = pendingTasks.Count + activeTasks.Count + completedTasks.Count;
        if (totalTasks > 0)
        {
            var completionRate = (double)completedTasks.Count / totalTasks;
            if (completionRate < 0.3 && totalTasks >= 5)
            {
                suggestions.Add("📈 Low task completion rate - consider marking completed tasks as done to track progress");
            }
        }

        // Check for large pending backlog
        if (pendingTasks.Count > 10)
        {
            suggestions.Add("📦 Large pending task backlog (10+ items) - consider breaking down complex tasks or creating separate lists");
        }
    }

    /// <summary>
    /// Get contextual suggestions based on recent activity patterns
    /// </summary>
    public async Task<List<string>> GetContextualSuggestionsAsync(string workspaceId, TimeSpan activityWindow)
    {
        var suggestions = new List<string>();

        try
        {
            var since = DateTime.UtcNow - activityWindow;
            
            // Check recent activity patterns  
            var recentCheckpoints = await _storage.SearchCheckpointsAsync(workspaceId, "*", since: since);
            var recentPlans = await _storage.GetPlansAsync(workspaceId, includeCompleted: true);
            var recentPlansInWindow = recentPlans.Where(p => p.UpdatedAt >= since).ToList();

            // Suggest workflow improvements based on patterns
            if (recentCheckpoints.Count() > 5 && recentPlansInWindow.Count == 0)
            {
                suggestions.Add("🏗️ High checkpoint activity without plans - consider strategic planning for more structured development");
            }

            if (recentPlansInWindow.Count > 0 && recentCheckpoints.Count() < 2)
            {
                suggestions.Add("📋 Active planning without regular checkpoints - remember to save progress as you implement");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate contextual suggestions for workspace {WorkspaceId}", workspaceId);
        }

        return suggestions;
    }
}