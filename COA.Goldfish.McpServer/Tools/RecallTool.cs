using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Services;
using COA.Goldfish.McpServer.Models;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Tools;

/// <summary>
/// Tool for recall operations - context restoration
/// </summary>
public class RecallTool : GoldfishToolBase<RecallParameters, RecallResult>
{
    private readonly IStorageService _storage;
    private readonly WorkspaceService _workspaceService;
    private readonly ILogger<RecallTool> _logger;

    public RecallTool(IServiceProvider serviceProvider, ILogger<RecallTool> logger, IStorageService storage, WorkspaceService workspaceService) 
        : base(serviceProvider, logger)
    {
        _storage = storage;
        _workspaceService = workspaceService;
        _logger = logger;
    }

    public override string Name => "recall";
    public override string Description => "Context restoration from memory";

    protected override async Task<RecallResult> ExecuteInternalAsync(
        RecallParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var workspaceId = parameters.Workspace ?? _workspaceService.GetCurrentWorkspace();
            var result = new RecallResult();

            // Parse time range
            DateTime? sinceDate = null;
            if (!string.IsNullOrEmpty(parameters.Since))
            {
                sinceDate = ParseTimeRange(parameters.Since);
            }

            if (string.IsNullOrEmpty(parameters.Query))
            {
                // No query provided - return recent memories across all types
                result.Checkpoints = await _storage.GetCheckpointsAsync(workspaceId, parameters.Limit);
                
                var recentTodos = await _storage.GetTodoListsAsync(workspaceId, includeCompleted: false);
                result.TodoLists = recentTodos.Take(Math.Max(1, parameters.Limit / 3)).ToList();

                var recentPlans = await _storage.GetPlansAsync(workspaceId, includeCompleted: false);  
                result.Plans = recentPlans.Take(Math.Max(1, parameters.Limit / 3)).ToList();

                var totalItems = result.Checkpoints.Count + result.TodoLists.Count + result.Plans.Count;
                result.Message = $"Recalled {totalItems} recent memories from workspace";
            }
            else
            {
                // Query provided - search across all entity types
                var searchTasks = new List<Task>();
                
                // Search checkpoints
                var checkpointTask = _storage.SearchCheckpointsAsync(workspaceId, parameters.Query, sinceDate, parameters.Limit / 3);
                searchTasks.Add(checkpointTask);

                // Search todo lists  
                var todoTask = _storage.SearchTodoListsAsync(workspaceId, parameters.Query, sinceDate, parameters.Limit / 3);
                searchTasks.Add(todoTask);

                // Search plans
                var planTask = _storage.SearchPlansAsync(workspaceId, parameters.Query, sinceDate, parameters.Limit / 3);
                searchTasks.Add(planTask);

                // Execute all searches concurrently
                await Task.WhenAll(searchTasks);

                result.Checkpoints = await checkpointTask;
                result.TodoLists = await todoTask;  
                result.Plans = await planTask;

                var totalItems = result.Checkpoints.Count + result.TodoLists.Count + result.Plans.Count;
                result.Message = $"Found {totalItems} items matching '{parameters.Query}'";
            }

            // If no results found, provide helpful message
            if ((result.Checkpoints?.Count ?? 0) == 0 && 
                (result.TodoLists?.Count ?? 0) == 0 && 
                (result.Plans?.Count ?? 0) == 0)
            {
                result.Message = string.IsNullOrEmpty(parameters.Query) 
                    ? "No recent memories found in this workspace"
                    : $"No items found matching '{parameters.Query}'";
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Recall operation failed");
            return new RecallResult
            {
                Success = false,
                Error = new ErrorInfo
                {
                    Code = "RECALL_ERROR",
                    Message = ex.Message
                }
            };
        }
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
            else if (lowerRange.EndsWith("days"))
            {
                var numberPart = lowerRange.Replace("days", "").Trim();
                if (int.TryParse(numberPart, out var days))
                    return now.AddDays(-days);
            }
            else if (lowerRange.EndsWith("hours"))
            {
                var numberPart = lowerRange.Replace("hours", "").Trim();
                if (int.TryParse(numberPart, out var hours))
                    return now.AddHours(-hours);
            }
            else if (lowerRange.EndsWith("weeks"))
            {
                var numberPart = lowerRange.Replace("weeks", "").Trim();
                if (int.TryParse(numberPart, out var weeks))
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