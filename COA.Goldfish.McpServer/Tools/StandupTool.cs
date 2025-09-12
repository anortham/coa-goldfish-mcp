using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;
using System.Text;

namespace COA.Goldfish.McpServer.Tools;

/// <summary>
/// Tool for standup operations - progress summaries
/// </summary>
public class StandupTool : GoldfishToolBase<StandupParameters, StandupResult>
{
    private readonly IStorageService _storage;
    private readonly ILogger<StandupTool> _logger;

    public StandupTool(IServiceProvider serviceProvider, ILogger<StandupTool> logger, IStorageService storage) 
        : base(serviceProvider, logger)
    {
        _storage = storage;
        _logger = logger;
    }

    public override string Name => "standup";
    public override string Description => "Daily work summaries and progress reports. Shows what you accomplished, current tasks, blockers. Perfect for meetings and \"what did I do?\" questions.";

    protected override async Task<StandupResult> ExecuteInternalAsync(
        StandupParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var workspaceId = parameters.Workspace ?? "default";
            var result = new StandupResult();

            // Determine time range based on action
            DateTime sinceDate = parameters.Action.ToLowerInvariant() switch
            {
                "daily" => DateTime.UtcNow.AddDays(-1),
                "weekly" => DateTime.UtcNow.AddDays(-7),
                "project" => DateTime.UtcNow.AddDays(-30),
                "custom" when !string.IsNullOrEmpty(parameters.Since) => ParseTimeRange(parameters.Since) ?? DateTime.UtcNow.AddDays(-1),
                _ => DateTime.UtcNow.AddDays(-1)
            };

            // Override with explicit since parameter if provided
            if (!string.IsNullOrEmpty(parameters.Since))
            {
                var parsedSince = ParseTimeRange(parameters.Since);
                if (parsedSince.HasValue)
                {
                    sinceDate = parsedSince.Value;
                }
            }

            // Gather data from all sources concurrently
            var checkpointsTask = _storage.GetCheckpointsAsync(workspaceId, limit: 10);
            var activeTodosTask = _storage.GetActiveTodoListAsync(workspaceId);
            var allTodosTask = _storage.GetTodoListsAsync(workspaceId, includeCompleted: false);
            var activePlansTask = _storage.GetActivePlanAsync(workspaceId);
            var allPlansTask = _storage.GetPlansAsync(workspaceId, includeCompleted: false);
            var recentEntriesTask = _storage.GetChronicleEntriesAsync(workspaceId, sinceDate, limit: 20);

            await Task.WhenAll(checkpointsTask, activeTodosTask, allTodosTask, activePlansTask, allPlansTask, recentEntriesTask);

            // Populate result with aggregated data
            result.RecentCheckpoints = await checkpointsTask;
            result.RecentEntries = await recentEntriesTask;

            var activeTodo = await activeTodosTask;
            result.ActiveTodos = activeTodo != null ? new List<TodoList> { activeTodo } : new List<TodoList>();

            var activePlan = await activePlansTask;
            result.ActivePlans = activePlan != null ? new List<Plan> { activePlan } : new List<Plan>();

            // Generate summary
            var summary = GenerateStandupSummary(
                parameters.Action,
                sinceDate,
                result.RecentCheckpoints,
                result.ActiveTodos,
                result.ActivePlans,
                result.RecentEntries,
                await allTodosTask,
                await allPlansTask
            );

            result.Summary = summary;
            result.Message = $"Generated {parameters.Action} standup summary for {workspaceId}";

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Standup operation failed");
            return new StandupResult
            {
                Success = false,
                Error = new ErrorInfo
                {
                    Code = "STANDUP_ERROR",
                    Message = ex.Message
                }
            };
        }
    }

    private string GenerateStandupSummary(
        string action,
        DateTime sinceDate,
        List<Checkpoint> checkpoints,
        List<TodoList> activeTodos,
        List<Plan> activePlans,
        List<ChronicleEntry> recentEntries,
        List<TodoList> allTodos,
        List<Plan> allPlans)
    {
        var summary = new StringBuilder();
        var timeFrame = action.ToLowerInvariant() switch
        {
            "daily" => "Daily",
            "weekly" => "Weekly", 
            "project" => "Project (30-day)",
            _ => "Custom"
        };

        summary.AppendLine($"# {timeFrame} Standup Summary");
        summary.AppendLine($"**Period:** {sinceDate:yyyy-MM-dd} to {DateTime.UtcNow:yyyy-MM-dd}");
        summary.AppendLine();

        // Recent Progress (Checkpoints)
        summary.AppendLine("## Recent Progress");
        if (checkpoints.Any())
        {
            foreach (var checkpoint in checkpoints.Take(5))
            {
                summary.AppendLine($"- **{checkpoint.CreatedAt:MM/dd}**: {checkpoint.Description}");
                if (checkpoint.Highlights.Any())
                {
                    foreach (var highlight in checkpoint.Highlights.Take(2))
                    {
                        summary.AppendLine($"  - {highlight}");
                    }
                }
            }
        }
        else
        {
            summary.AppendLine("- No recent checkpoints");
        }
        summary.AppendLine();

        // Active Work
        summary.AppendLine("## Active Work");
        if (activePlans.Any())
        {
            var plan = activePlans.First();
            summary.AppendLine($"**Current Plan:** {plan.Title}");
            summary.AppendLine($"- Status: {plan.Status} | Priority: {plan.Priority}");
            if (plan.Items.Any())
            {
                summary.AppendLine("- Key Items:");
                foreach (var item in plan.Items.Take(3))
                {
                    summary.AppendLine($"  - {item}");
                }
            }
        }
        else
        {
            summary.AppendLine("**Current Plan:** None active");
        }

        if (activeTodos.Any())
        {
            var todoList = activeTodos.First();
            summary.AppendLine($"**Active TODOs:** {todoList.Title} ({todoList.Items.Count} items)");
            var pendingTasks = todoList.Items.Where(i => i.Status == TodoItemStatus.Pending).Take(5);
            foreach (var task in pendingTasks)
            {
                summary.AppendLine($"- [ ] {task.Content}");
            }
            var completedCount = todoList.Items.Count(i => i.Status == TodoItemStatus.Done);
            if (completedCount > 0)
            {
                summary.AppendLine($"- ✅ {completedCount} tasks completed");
            }
        }
        else
        {
            summary.AppendLine("**Active TODOs:** None");
        }
        summary.AppendLine();

        // Recent Decisions/Notes (Chronicle)
        summary.AppendLine("## Recent Decisions & Notes");
        if (recentEntries.Any())
        {
            var recentGrouped = recentEntries.GroupBy(e => e.Type).Take(3);
            foreach (var group in recentGrouped)
            {
                summary.AppendLine($"**{group.Key}:**");
                foreach (var entry in group.Take(3))
                {
                    summary.AppendLine($"- {entry.Description} _{entry.Timestamp:MM/dd}_");
                }
            }
        }
        else
        {
            summary.AppendLine("- No recent decisions or notes");
        }
        summary.AppendLine();

        // Overall Stats
        summary.AppendLine("## Workspace Stats");
        summary.AppendLine($"- **Total Plans:** {allPlans.Count} ({allPlans.Count(p => p.Status == PlanStatus.Active)} active)");
        summary.AppendLine($"- **Total TODO Lists:** {allTodos.Count} ({allTodos.Count(t => t.IsActive)} active)");
        var totalTasks = allTodos.SelectMany(t => t.Items).Count();
        var completedTasks = allTodos.SelectMany(t => t.Items).Count(i => i.Status == TodoItemStatus.Done);
        summary.AppendLine($"- **Total Tasks:** {totalTasks} ({completedTasks} completed, {totalTasks - completedTasks} pending)");
        summary.AppendLine($"- **Recent Checkpoints:** {checkpoints.Count}");
        summary.AppendLine($"- **Chronicle Entries:** {recentEntries.Count} in period");

        return summary.ToString();
    }

    /// <summary>
    /// Parse time range strings like "7d", "1w", "24h", "2025-01-15"
    /// </summary>
    private DateTime? ParseTimeRange(string timeRange)
    {
        if (string.IsNullOrEmpty(timeRange))
            return null;

        try
        {
            // Try parsing as absolute date first
            if (DateTime.TryParse(timeRange, out var absoluteDate))
            {
                return absoluteDate;
            }

            // Parse relative time ranges
            var now = DateTime.UtcNow;
            var lowerRange = timeRange.ToLowerInvariant();

            if (lowerRange.EndsWith('d'))
            {
                if (int.TryParse(lowerRange[..^1], out var days))
                    return now.AddDays(-days);
            }
            else if (lowerRange.EndsWith('h'))
            {
                if (int.TryParse(lowerRange[..^1], out var hours))
                    return now.AddHours(-hours);
            }
            else if (lowerRange.EndsWith('w'))
            {
                if (int.TryParse(lowerRange[..^1], out var weeks))
                    return now.AddDays(-weeks * 7);
            }

            // Handle common aliases
            return lowerRange switch
            {
                "today" => now.Date,
                "yesterday" => now.Date.AddDays(-1),
                "week" => now.AddDays(-7),
                "month" => now.AddDays(-30),
                _ => null
            };
        }
        catch
        {
            return null;
        }
    }
}