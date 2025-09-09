using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace COA.Goldfish.McpServer.Models;

/// <summary>
/// Parameters for checkpoint operations
/// </summary>
public class CheckpointParameters
{
    /// <summary>
    /// Action to perform (save, restore, search, timeline)
    /// </summary>
    [Description("Action to perform. Defaults to 'restore' (most common). Use 'save' with description to create checkpoint.")]
    public string Action { get; set; } = "restore";

    /// <summary>
    /// Checkpoint description (required for save action)
    /// </summary>
    [Description("Checkpoint description (required for save action)")]
    [StringLength(2000, ErrorMessage = "Description cannot exceed 2000 characters")]
    public string? Description { get; set; }

    /// <summary>
    /// What you're working on or next steps
    /// </summary>
    [Description("What you're working on or next steps")]
    public string? WorkContext { get; set; }

    /// <summary>
    /// Files currently being worked on
    /// </summary>
    [Description("Files currently being worked on")]
    public List<string>? ActiveFiles { get; set; }

    /// <summary>
    /// Key achievements or decisions to remember
    /// </summary>
    [Description("Key achievements or decisions to remember")]
    public List<string>? Highlights { get; set; }

    /// <summary>
    /// Current git branch
    /// </summary>
    [Description("Current git branch (auto-detected if not provided)")]
    public string? GitBranch { get; set; }

    /// <summary>
    /// Session identifier
    /// </summary>
    [Description("Session identifier (auto-generated if not provided)")]
    public string? SessionId { get; set; }

    /// <summary>
    /// Store as global checkpoint
    /// </summary>
    [Description("Store as global checkpoint (visible across all workspaces)")]
    public bool Global { get; set; } = false;

    /// <summary>
    /// Specific checkpoint ID to restore
    /// </summary>
    [Description("Specific checkpoint ID to restore")]
    public string? CheckpointId { get; set; }

    /// <summary>
    /// Target workspace
    /// </summary>
    [Description("Target workspace (path or name)")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for todo operations
/// </summary>
public class TodoParameters
{
    /// <summary>
    /// Action to perform
    /// </summary>
    [Description("Action to perform. Defaults to 'view' to show current tasks. Use 'update' to modify existing lists.")]
    public string Action { get; set; } = "view";

    /// <summary>
    /// Title for new TODO list
    /// </summary>
    [Description("Title for new TODO list (required for create action)")]
    [StringLength(200, ErrorMessage = "Title cannot exceed 200 characters")]
    public string? Title { get; set; }

    /// <summary>
    /// Array of task items
    /// </summary>
    [Description("Array of task items (required for create action)")]
    public List<string>? Items { get; set; }

    /// <summary>
    /// TODO list ID
    /// </summary>
    [Description("TODO list ID (supports 'latest', 'active', partial matches)")]
    public string? ListId { get; set; }

    /// <summary>
    /// Specific item ID within the list
    /// </summary>
    [Description("Specific item ID within the list")]
    public string? ItemId { get; set; }

    /// <summary>
    /// New task to add to the list
    /// </summary>
    [Description("New task to add to the list")]
    public string? NewTask { get; set; }

    /// <summary>
    /// Status to set for the item
    /// </summary>
    [Description("Status to set for the item")]
    public string? Status { get; set; }

    /// <summary>
    /// Target workspace
    /// </summary>
    [Description("Target workspace (path or name)")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for plan operations  
/// </summary>
public class PlanParameters
{
    /// <summary>
    /// Action to perform
    /// </summary>
    [Description("Action to perform. Defaults to 'list' to show current plans. Use 'save' to create new plans.")]
    public string Action { get; set; } = "list";

    /// <summary>
    /// Plan title
    /// </summary>
    [Description("Plan title (required for save action)")]
    [StringLength(200, ErrorMessage = "Title cannot exceed 200 characters")]
    public string? Title { get; set; }

    /// <summary>
    /// Full markdown plan description
    /// </summary>
    [Description("Full markdown plan description (required for save action)")]
    [StringLength(10000, ErrorMessage = "Description cannot exceed 10000 characters")]
    public string? Description { get; set; }

    /// <summary>
    /// High-level plan items/milestones
    /// </summary>
    [Description("High-level plan items/milestones")]
    public List<string>? Items { get; set; }

    /// <summary>
    /// Plan ID
    /// </summary>
    [Description("Plan ID (supports 'latest', 'active', partial matches)")]
    public string? PlanId { get; set; }

    /// <summary>
    /// Plan category
    /// </summary>
    [Description("Plan category for organization")]
    public string? Category { get; set; }

    /// <summary>
    /// Plan priority level
    /// </summary>
    [Description("Plan priority level")]
    public string Priority { get; set; } = "normal";

    /// <summary>
    /// Strategic discoveries and learnings (replaces Intel functionality)
    /// </summary>
    [Description("Strategic discoveries and learnings accumulated during plan implementation")]
    [JsonPropertyName("discoveries")]
    public List<string>? Discoveries { get; set; }

    /// <summary>
    /// Target workspace
    /// </summary>
    [Description("Target workspace (path or name)")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for recall operations
/// </summary>
public class RecallParameters
{
    /// <summary>
    /// Search query
    /// </summary>
    [Description("Search query (optional - if not provided, shows recent memories)")]
    public string? Query { get; set; }

    /// <summary>
    /// Time range
    /// </summary>
    [Description("Time range (default: '7d')")]
    public string Since { get; set; } = "7d";

    /// <summary>
    /// Maximum results
    /// </summary>
    [Description("Maximum results (default: 10)")]
    public int Limit { get; set; } = 10;

    /// <summary>
    /// Target workspace
    /// </summary>
    [Description("Target workspace (path or name)")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for chronicle operations
/// </summary>
public class ChronicleParameters
{
    /// <summary>
    /// Action to perform
    /// </summary>
    [Description("Action to perform")]
    public string Action { get; set; } = "list";

    /// <summary>
    /// Entry description
    /// </summary>
    [Description("Entry description")]
    public string? Description { get; set; }

    /// <summary>
    /// Entry type
    /// </summary>
    [Description("Entry type")]
    public string Type { get; set; } = "Note";

    /// <summary>
    /// Time range
    /// </summary>
    [Description("Time range")]
    public string Since { get; set; } = "7d";

    /// <summary>
    /// Target workspace
    /// </summary>
    [Description("Target workspace (path or name)")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for standup operations
/// </summary>
public class StandupParameters
{
    /// <summary>
    /// Type of standup
    /// </summary>
    [Description("Type of standup: daily (1 day), weekly (7 days), project (30 days), custom (use since parameter)")]
    public string Action { get; set; } = "daily";

    /// <summary>
    /// Time range
    /// </summary>
    [Description("Time range (e.g., '1d', '3d', '1w', '2025-01-15'). Overrides action default.")]
    public string? Since { get; set; }

    /// <summary>
    /// Target workspace
    /// </summary>
    [Description("Target workspace (path or name)")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for workspace operations
/// </summary>
public class WorkspaceParameters
{
    /// <summary>
    /// Action to perform
    /// </summary>
    [Description("Action to perform")]
    public string Action { get; set; } = "list";

    /// <summary>
    /// Target workspace
    /// </summary>
    [Description("Target workspace (path or name)")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for workflow operations
/// </summary>
public class WorkflowParameters
{
    /// <summary>
    /// Action to perform
    /// </summary>
    [Description("Action to perform: check, validate, priorities, enforce, recommend")]
    public string Action { get; set; } = "check";

    /// <summary>
    /// Target workspace
    /// </summary>
    [Description("Target workspace (path or name)")]
    public string? Workspace { get; set; }
}