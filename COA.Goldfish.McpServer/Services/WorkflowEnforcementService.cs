using COA.Goldfish.McpServer.Services.Storage;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Services;

/// <summary>
/// Service for enforcing workflow compliance and behavioral patterns
/// </summary>
public class WorkflowEnforcementService
{
    private readonly IStorageService _storage;
    private readonly ILogger<WorkflowEnforcementService> _logger;

    public WorkflowEnforcementService(IStorageService storage, ILogger<WorkflowEnforcementService> logger)
    {
        _storage = storage;
        _logger = logger;
    }

    /// <summary>
    /// Validate that a plan exists before allowing coding-related operations
    /// </summary>
    public async Task<ErrorInfo?> ValidatePlanRequiredAsync(string workspaceId, string operationDescription)
    {
        try
        {
            var activePlan = await _storage.GetActivePlanAsync(workspaceId);
            if (activePlan == null)
            {
                _logger.LogWarning("Operation '{Operation}' attempted without active plan in workspace '{WorkspaceId}'", 
                    operationDescription, workspaceId);
                
                return new ErrorInfo
                {
                    Code = "MISSING_PLAN_REQUIRED",
                    Message = $"A strategic plan is required before {operationDescription}. " +
                             "Create a plan using mcp__goldfish__plan with action='save' first."
                };
            }

            return null; // No error - plan exists
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to validate plan requirement for operation '{Operation}'", operationDescription);
            return new ErrorInfo
            {
                Code = "ENFORCEMENT_ERROR",
                Message = "Unable to validate workflow requirements due to system error"
            };
        }
    }

    /// <summary>
    /// Validate that active TODOs are maintained and updated
    /// </summary>
    public async Task<ErrorInfo?> ValidateTodoMaintenanceAsync(string workspaceId)
    {
        try
        {
            var activeTodos = await _storage.GetActiveTodoListAsync(workspaceId);
            
            // Check if there are active TODOs
            if (activeTodos == null)
            {
                _logger.LogWarning("No active TODO list found in workspace '{WorkspaceId}'", workspaceId);
                return new ErrorInfo
                {
                    Code = "MISSING_ACTIVE_TODOS",
                    Message = "An active TODO list is required for task management. " +
                             "Create tasks using mcp__goldfish__todo or generate them from your plan."
                };
            }

            // Check if TODOs are stale (not updated in last 4 hours)
            if ((DateTime.UtcNow - activeTodos.UpdatedAt) > TimeSpan.FromHours(4))
            {
                _logger.LogWarning("Stale TODO list detected in workspace '{WorkspaceId}' - last updated {UpdatedAt}", 
                    workspaceId, activeTodos.UpdatedAt);
                
                return new ErrorInfo
                {
                    Code = "STALE_TODOS_WARNING",
                    Message = "Your TODO list hasn't been updated in over 4 hours. " +
                             "Please review and update your tasks to maintain workflow organization."
                };
            }

            return null; // No error - TODOs are current
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to validate TODO maintenance for workspace '{WorkspaceId}'", workspaceId);
            return null; // Don't block operations due to validation errors
        }
    }

    /// <summary>
    /// Recommend or enforce checkpointing after significant work
    /// </summary>
    public async Task<string?> GetCheckpointRecommendationAsync(string workspaceId)
    {
        try
        {
            var recentCheckpoints = await _storage.GetCheckpointsAsync(workspaceId, limit: 1);
            
            if (!recentCheckpoints.Any())
            {
                return "Consider creating your first checkpoint to save session context: mcp__goldfish__checkpoint";
            }

            var lastCheckpoint = recentCheckpoints.First();
            var timeSinceLastCheckpoint = DateTime.UtcNow - lastCheckpoint.CreatedAt;

            if (timeSinceLastCheckpoint > TimeSpan.FromMinutes(45))
            {
                return "Consider checkpointing your progress - it's been over 45 minutes since your last checkpoint";
            }

            return null; // No checkpoint needed
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get checkpoint recommendation for workspace '{WorkspaceId}'", workspaceId);
            return null;
        }
    }

    /// <summary>
    /// Check if an operation represents "coding activity" that requires a plan
    /// </summary>
    public bool IsCodingOperation(string toolName, string action)
    {
        var codingOperations = new Dictionary<string, string[]>
        {
            ["todo"] = new[] { "create", "update", "add" },
            ["plan"] = new[] { "save", "create" },
            ["checkpoint"] = new[] { "save" }
        };

        if (codingOperations.TryGetValue(toolName.ToLowerInvariant(), out var actions))
        {
            return actions.Contains(action.ToLowerInvariant());
        }

        return false;
    }

    /// <summary>
    /// Enforce workflow compliance for a given operation
    /// </summary>
    public async Task<ErrorInfo?> EnforceWorkflowAsync(string workspaceId, string toolName, string action, 
        WorkflowEnforcementLevel level = WorkflowEnforcementLevel.Guided)
    {
        switch (level)
        {
            case WorkflowEnforcementLevel.Strict:
                // Strict mode - block operations that violate workflow
                if (IsCodingOperation(toolName, action))
                {
                    var planError = await ValidatePlanRequiredAsync(workspaceId, $"{toolName} {action}");
                    if (planError != null) return planError;
                }

                var todoError = await ValidateTodoMaintenanceAsync(workspaceId);
                if (todoError?.Code == "MISSING_ACTIVE_TODOS") return todoError;
                break;

            case WorkflowEnforcementLevel.Guided:
                // Guided mode - warn but don't block
                if (IsCodingOperation(toolName, action))
                {
                    var planWarning = await ValidatePlanRequiredAsync(workspaceId, $"{toolName} {action}");
                    if (planWarning != null)
                    {
                        _logger.LogWarning("Workflow guidance: {Message}", planWarning.Message);
                        // Don't return error - just log warning
                    }
                }
                break;

            case WorkflowEnforcementLevel.Flexible:
                // Flexible mode - minimal enforcement
                break;
        }

        return null; // No blocking errors
    }
}

/// <summary>
/// Enforcement levels for workflow compliance
/// </summary>
public enum WorkflowEnforcementLevel
{
    /// <summary>
    /// Flexible mode - minimal enforcement, suggestions only
    /// </summary>
    Flexible = 0,
    
    /// <summary>
    /// Guided mode - warnings and recommendations, no blocking
    /// </summary>
    Guided = 1,
    
    /// <summary>
    /// Strict mode - enforce critical workflow patterns, may block operations
    /// </summary>
    Strict = 2
}