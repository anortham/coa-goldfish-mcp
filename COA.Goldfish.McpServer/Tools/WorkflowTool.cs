using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Services;
using COA.Goldfish.McpServer.Models;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Tools;

/// <summary>
/// Tool for workflow enforcement and behavioral guidance
/// </summary>
public class WorkflowTool : GoldfishToolBase<WorkflowParameters, WorkflowResult>
{
    private readonly IStorageService _storage;
    private readonly ToolPriorityService _priorityService;
    private readonly ILogger<WorkflowTool> _logger;

    public WorkflowTool(IServiceProvider serviceProvider, ILogger<WorkflowTool> logger, 
        IStorageService storage, ToolPriorityService priorityService) 
        : base(serviceProvider, logger)
    {
        _storage = storage;
        _priorityService = priorityService;
        _logger = logger;
    }

    public override string Name => "workflow";
    public override string Description => "Workflow enforcement and behavioral guidance for AI agents";

    protected override async Task<WorkflowResult> ExecuteInternalAsync(
        WorkflowParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var workspaceId = parameters.Workspace ?? "default";
            var result = new WorkflowResult();

            switch (parameters.Action.ToLowerInvariant())
            {
                case "check":
                case "validate":
                    var workflowState = await GetCurrentWorkflowStateAsync(workspaceId);
                    var violations = _priorityService.DetectViolations(workflowState);
                    
                    result.CurrentState = workflowState;
                    result.Violations = violations;
                    result.NextRecommendedAction = _priorityService.GetNextRecommendedAction(workflowState);
                    result.Message = violations.Any() 
                        ? $"Found {violations.Count} workflow violations" 
                        : "Workflow is compliant";
                    break;

                case "priorities":
                case "guidance":
                    var priorities = _priorityService.GetToolPriorities();
                    result.ToolPriorities = priorities;
                    result.Message = "Retrieved tool priorities and workflow guidance";
                    break;

                case "enforce":
                    // Check for workflow violations and provide enforcement response
                    var currentState = await GetCurrentWorkflowStateAsync(workspaceId);
                    var criticalViolations = _priorityService.DetectViolations(currentState)
                        .Where(v => v.Severity >= ViolationSeverity.High)
                        .ToList();

                    if (criticalViolations.Any())
                    {
                        result.Success = false;
                        result.Violations = criticalViolations;
                        result.Error = new ErrorInfo
                        {
                            Code = "WORKFLOW_VIOLATION",
                            Message = $"Critical workflow violations detected: {string.Join(", ", criticalViolations.Select(v => v.Message))}"
                        };
                        return result;
                    }

                    result.Message = "No critical workflow violations detected";
                    break;

                case "recommend":
                    var state = await GetCurrentWorkflowStateAsync(workspaceId);
                    result.NextRecommendedAction = _priorityService.GetNextRecommendedAction(state);
                    result.CurrentState = state;
                    result.Message = $"Recommended next action: {result.NextRecommendedAction}";
                    break;

                default:
                    result.Success = false;
                    result.Error = new ErrorInfo
                    {
                        Code = "INVALID_ACTION",
                        Message = $"Unknown action: {parameters.Action}"
                    };
                    break;
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Workflow operation failed");
            return new WorkflowResult
            {
                Success = false,
                Error = new ErrorInfo
                {
                    Code = "WORKFLOW_ERROR",
                    Message = ex.Message
                }
            };
        }
    }

    /// <summary>
    /// Get current workflow state from storage
    /// </summary>
    private async Task<WorkflowState> GetCurrentWorkflowStateAsync(string workspaceId)
    {
        try
        {
            var workspaceState = await _storage.GetWorkspaceStateAsync(workspaceId);
            var activePlan = await _storage.GetActivePlanAsync(workspaceId);
            var activeTodos = await _storage.GetActiveTodoListAsync(workspaceId);
            var recentCheckpoints = await _storage.GetCheckpointsAsync(workspaceId, limit: 1);

            // Determine if TODOs are stale (not updated in last 2 hours)
            var hasStaleTodos = activeTodos != null && 
                (DateTime.UtcNow - activeTodos.UpdatedAt) > TimeSpan.FromHours(2);

            // Check for recent checkpoint (within last hour)
            var hasRecentCheckpoint = recentCheckpoints.Any() &&
                (DateTime.UtcNow - recentCheckpoints.First().CreatedAt) < TimeSpan.FromHours(1);

            return new WorkflowState
            {
                ActivePlanId = activePlan?.Id,
                ActiveTodoListId = activeTodos?.Id,
                HasStaleTodos = hasStaleTodos,
                HasRecentCheckpoint = hasRecentCheckpoint,
                SessionDuration = TimeSpan.FromMinutes(30), // This could be tracked more accurately
                IsCodingInProgress = !string.IsNullOrEmpty(activePlan?.Id), // Simplification
                IsStartingNewWork = string.IsNullOrEmpty(activePlan?.Id),
                IsResumingWork = !string.IsNullOrEmpty(activePlan?.Id) && !hasRecentCheckpoint
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get workflow state for workspace {WorkspaceId}", workspaceId);
            return new WorkflowState(); // Return empty state on error
        }
    }
}