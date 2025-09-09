using COA.Mcp.Framework.Models;
using COA.Goldfish.McpServer.Services;

namespace COA.Goldfish.McpServer.Models;

/// <summary>
/// Result from checkpoint operations
/// </summary>
public class CheckpointResult : ToolResultBase
{
    public override string Operation => "checkpoint";
    
    public Checkpoint? Checkpoint { get; set; }
    public List<Checkpoint>? Checkpoints { get; set; }
}

/// <summary>
/// Result from todo operations
/// </summary>
public class TodoResult : ToolResultBase
{
    public override string Operation => "todo";
    
    public TodoList? TodoList { get; set; }
    public List<TodoList>? TodoLists { get; set; }
    public TodoItem? TodoItem { get; set; }
}

/// <summary>
/// Result from plan operations
/// </summary>
public class PlanResult : ToolResultBase
{
    public override string Operation => "plan";
    
    public Plan? Plan { get; set; }
    public List<Plan>? Plans { get; set; }
    public TodoList? GeneratedTodos { get; set; }
}

/// <summary>
/// Result from recall operations
/// </summary>
public class RecallResult : ToolResultBase
{
    public override string Operation => "recall";
    
    public List<Checkpoint>? Checkpoints { get; set; }
    public List<TodoList>? TodoLists { get; set; }
    public List<Plan>? Plans { get; set; }
}

/// <summary>
/// Result from chronicle operations
/// </summary>
public class ChronicleResult : ToolResultBase
{
    public override string Operation => "chronicle";
    
    public ChronicleEntry? Entry { get; set; }
    public List<ChronicleEntry>? Entries { get; set; }
}

/// <summary>
/// Result from standup operations
/// </summary>
public class StandupResult : ToolResultBase
{
    public override string Operation => "standup";
    
    public List<Checkpoint>? RecentCheckpoints { get; set; }
    public List<TodoList>? ActiveTodos { get; set; }
    public List<Plan>? ActivePlans { get; set; }
    public List<ChronicleEntry>? RecentEntries { get; set; }
    public string? Summary { get; set; }
}

/// <summary>
/// Result from workspace operations
/// </summary>
public class WorkspaceResult : ToolResultBase
{
    public override string Operation => "workspace";
    
    public WorkspaceState? WorkspaceState { get; set; }
    public List<string>? Workspaces { get; set; }
}

/// <summary>
/// Result from workflow operations
/// </summary>
public class WorkflowResult : ToolResultBase
{
    public override string Operation => "workflow";
    
    public WorkflowState? CurrentState { get; set; }
    public List<WorkflowViolation>? Violations { get; set; }
    public ToolPriorities? ToolPriorities { get; set; }
    public string? NextRecommendedAction { get; set; }
}