using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Services;

/// <summary>
/// Service that defines tool priorities and workflow enforcement
/// </summary>
public class ToolPriorityService
{
    private readonly ILogger<ToolPriorityService> _logger;

    public ToolPriorityService(ILogger<ToolPriorityService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Get tool priorities for different workflow scenarios
    /// </summary>
    public ToolPriorities GetToolPriorities()
    {
        return new ToolPriorities
        {
            StartingNewWork = new List<ToolPriority>
            {
                new() { ToolName = "plan", Priority = 1, Required = true, Description = "Create strategic plan before coding" },
                new() { ToolName = "todo", Priority = 2, Required = true, Description = "Generate tasks from plan using action='generate-todos'" },
                new() { ToolName = "workspace", Priority = 3, Required = false, Description = "Verify workspace state" }
            },
            
            ResumingWork = new List<ToolPriority>
            {
                new() { ToolName = "recall", Priority = 1, Required = true, Description = "Restore context - what was I working on?" },
                new() { ToolName = "workspace", Priority = 2, Required = false, Description = "Check active plan and TODO state" },
                new() { ToolName = "todo", Priority = 3, Required = false, Description = "Review active task list" }
            },
            
            DuringDevelopment = new List<ToolPriority>
            {
                new() { ToolName = "todo", Priority = 1, Required = true, Description = "Mark tasks complete as you finish them" },
                new() { ToolName = "chronicle", Priority = 2, Required = false, Description = "Record important decisions and discoveries" },
                new() { ToolName = "checkpoint", Priority = 3, Required = false, Description = "Save progress at major milestones" }
            },
            
            EndingSession = new List<ToolPriority>
            {
                new() { ToolName = "todo", Priority = 1, Required = true, Description = "Update task completion status" },
                new() { ToolName = "chronicle", Priority = 2, Required = false, Description = "Record session discoveries" },
                new() { ToolName = "checkpoint", Priority = 3, Required = true, Description = "Save session state with next steps" }
            }
        };
    }

    /// <summary>
    /// Get workflow violations based on current usage patterns
    /// </summary>
    public List<WorkflowViolation> DetectViolations(WorkflowState currentState)
    {
        var violations = new List<WorkflowViolation>();

        // Check for coding without plan
        if (currentState.IsCodingInProgress && string.IsNullOrEmpty(currentState.ActivePlanId))
        {
            violations.Add(new WorkflowViolation
            {
                Type = ViolationType.MissingPlan,
                Severity = ViolationSeverity.High,
                Message = "Coding is in progress but no active plan exists. Create a plan first.",
                RecommendedAction = "Use mcp__goldfish__plan with action='save' to create a strategic plan"
            });
        }

        // Check for stale TODO lists
        if (currentState.HasStaleTodos)
        {
            violations.Add(new WorkflowViolation
            {
                Type = ViolationType.StaleTodos,
                Severity = ViolationSeverity.Medium,
                Message = "TODO list has not been updated recently.",
                RecommendedAction = "Review and update your active TODO list"
            });
        }

        // Check for missing session checkpoint
        if (currentState.SessionDuration > TimeSpan.FromMinutes(30) && !currentState.HasRecentCheckpoint)
        {
            violations.Add(new WorkflowViolation
            {
                Type = ViolationType.MissingCheckpoint,
                Severity = ViolationSeverity.Low,
                Message = "Long session without checkpoint. Consider saving progress.",
                RecommendedAction = "Use mcp__goldfish__checkpoint to save current session state"
            });
        }

        return violations;
    }

    /// <summary>
    /// Get next recommended action based on workflow state
    /// </summary>
    public string GetNextRecommendedAction(WorkflowState currentState)
    {
        var violations = DetectViolations(currentState);
        
        // Address highest priority violations first
        var highViolation = violations.FirstOrDefault(v => v.Severity == ViolationSeverity.High);
        if (highViolation != null)
        {
            return highViolation.RecommendedAction;
        }

        // If no violations, suggest workflow progression
        if (currentState.IsStartingNewWork)
        {
            return "Create a plan: mcp__goldfish__plan with action='save'";
        }

        if (currentState.IsResumingWork)
        {
            return "Restore context: mcp__goldfish__recall";
        }

        if (currentState.IsCodingInProgress)
        {
            return "Update TODOs as you complete tasks";
        }

        return "Consider checkpointing your progress";
    }
}

/// <summary>
/// Tool priorities for different workflow scenarios
/// </summary>
public class ToolPriorities
{
    public List<ToolPriority> StartingNewWork { get; set; } = new();
    public List<ToolPriority> ResumingWork { get; set; } = new();
    public List<ToolPriority> DuringDevelopment { get; set; } = new();
    public List<ToolPriority> EndingSession { get; set; } = new();
}

/// <summary>
/// Priority information for a specific tool
/// </summary>
public class ToolPriority
{
    public string ToolName { get; set; } = string.Empty;
    public int Priority { get; set; } // 1 = highest priority
    public bool Required { get; set; }
    public string Description { get; set; } = string.Empty;
}

/// <summary>
/// Current workflow state for violation detection
/// </summary>
public class WorkflowState
{
    public bool IsStartingNewWork { get; set; }
    public bool IsResumingWork { get; set; }
    public bool IsCodingInProgress { get; set; }
    public string? ActivePlanId { get; set; }
    public string? ActiveTodoListId { get; set; }
    public bool HasStaleTodos { get; set; }
    public bool HasRecentCheckpoint { get; set; }
    public TimeSpan SessionDuration { get; set; }
}

/// <summary>
/// Workflow violation detected
/// </summary>
public class WorkflowViolation
{
    public ViolationType Type { get; set; }
    public ViolationSeverity Severity { get; set; }
    public string Message { get; set; } = string.Empty;
    public string RecommendedAction { get; set; } = string.Empty;
}

/// <summary>
/// Types of workflow violations
/// </summary>
public enum ViolationType
{
    MissingPlan,
    StaleTodos,
    MissingCheckpoint,
    MissingChronicle,
    WorkspaceClutter
}

/// <summary>
/// Severity levels for violations
/// </summary>
public enum ViolationSeverity
{
    Low,
    Medium,
    High,
    Critical
}