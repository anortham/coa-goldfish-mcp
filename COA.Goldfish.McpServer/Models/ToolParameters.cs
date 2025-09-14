using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace COA.Goldfish.McpServer.Models;

/// <summary>
/// Parameters for checkpoint operations - save and restore session context for seamless development workflow continuity
/// </summary>
public class CheckpointParameters
{
    /// <summary>
    /// Action to perform - save progress or restore session context for seamless workflow continuity
    /// </summary>
    /// <example>save</example>
    /// <example>restore</example>
    [Description("Action to perform. Examples: 'save' (checkpoint progress), 'restore' (resume work)")]
    public string Action { get; set; } = "restore";

    /// <summary>
    /// Checkpoint description explaining current work state and accomplishments (required for save action)
    /// </summary>
    /// <example>Implemented user authentication with JWT tokens</example>
    /// <example>Fixed database connection issues and added retry logic</example>
    /// <example>Completed frontend refactoring for dashboard components</example>
    /// <example>Added comprehensive error handling to payment processing</example>
    [Description("Checkpoint description (required for save). Examples: 'Completed auth system', 'Fixed DB issues', 'Refactored components'")]
    [StringLength(2000, ErrorMessage = "Description cannot exceed 2000 characters")]
    public string? Description { get; set; }

    /// <summary>
    /// What you're working on or next steps - provides context for resuming work later
    /// </summary>
    /// <example>Next: Add unit tests for authentication service</example>
    /// <example>Working on: Optimizing database queries for user dashboard</example>
    /// <example>Planning: Implement WebSocket real-time notifications</example>
    /// <example>Debugging: Race condition in payment processing workflow</example>
    [Description("Work context or next steps. Examples: 'Next: Add unit tests', 'Working on: API optimization', 'Planning: WebSocket implementation'")]
    public string? WorkContext { get; set; }

    /// <summary>
    /// Files currently being worked on - tracks which files are part of the current work session
    /// </summary>
    /// <example>src/services/AuthService.cs</example>
    /// <example>components/Dashboard.tsx</example>
    /// <example>tests/UserService.test.js</example>
    /// <example>docs/api-design.md</example>
    [Description("Files currently being worked on. Examples: ['src/AuthService.cs', 'components/Dashboard.tsx', 'tests/UserService.test.js']")]
    public List<string>? ActiveFiles { get; set; }

    /// <summary>
    /// Key achievements or decisions to remember - important milestones and architectural choices made during this session
    /// </summary>
    /// <example>Decided to use Redis for session caching instead of in-memory</example>
    /// <example>Successfully resolved performance bottleneck in user query endpoint</example>
    /// <example>Implemented proper error boundaries in React components</example>
    /// <example>Chose PostgreSQL over MongoDB for better transaction support</example>
    [Description("Key achievements or decisions. Examples: ['Used Redis for caching', 'Fixed performance bottleneck', 'Added error boundaries']")]
    public List<string>? Highlights { get; set; }

    /// <summary>
    /// Current git branch being worked on - helps track development context across different features
    /// </summary>
    /// <example>feature/user-authentication</example>
    /// <example>bugfix/payment-processing</example>
    /// <example>develop</example>
    /// <example>main</example>
    [Description("Current git branch (auto-detected if not provided). Examples: 'feature/user-auth', 'bugfix/payment-issue', 'develop'")]
    public string? GitBranch { get; set; }

    /// <summary>
    /// Session identifier for grouping related checkpoints together
    /// </summary>
    /// <example>dev-session-2025-01-15</example>
    /// <example>feature-auth-implementation</example>
    /// <example>debugging-payment-flow</example>
    [Description("Session identifier (auto-generated if not provided). Examples: 'dev-session-2025-01-15', 'feature-auth-impl'")]
    public string? SessionId { get; set; }

    /// <summary>
    /// Store as global checkpoint visible across all workspaces for cross-project reference
    /// </summary>
    /// <example>true</example>
    /// <example>false</example>
    [Description("Store as global checkpoint (visible across workspaces). Examples: true (global), false (workspace-specific)")]
    public bool Global { get; set; } = false;

    /// <summary>
    /// Specific checkpoint ID to restore - use for returning to exact previous state
    /// </summary>
    /// <example>b73bbb3c-54c1-4f0d-8fd3-27368817f1a8</example>
    /// <example>8a3f2b1c</example>
    [Description("Specific checkpoint ID to restore. Examples: 'b73bbb3c-54c1-4f0d-8fd3-27368817f1a8', '8a3f' (partial)")]
    public string? CheckpointId { get; set; }

    /// <summary>
    /// Target workspace path or name - determines where checkpoint is saved or retrieved from
    /// </summary>
    /// <example>C:\source\MyProject</example>
    /// <example>./current-project</example>
    /// <example>my-workspace</example>
    [Description("Target workspace (path or name). Examples: 'C:\\source\\MyProject', './current-project', 'my-workspace'")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for todo operations - smart task management with intelligent keyword resolution and progress tracking
/// </summary>
public class TodoParameters
{
    /// <summary>
    /// Action to perform - controls what operation to execute on todo lists
    /// </summary>
    /// <example>view</example>
    /// <example>create</example>
    /// <example>update</example>
    /// <example>complete</example>
    [Description("Action to perform. Examples: 'view' (show tasks), 'create' (new list), 'update' (modify), 'complete' (mark done)")]
    public string Action { get; set; } = "view";

    /// <summary>
    /// Title for new TODO list - descriptive name for the task collection being created
    /// </summary>
    /// <example>User Authentication Implementation</example>
    /// <example>Database Migration Tasks</example>
    /// <example>Frontend Component Refactoring</example>
    /// <example>Bug Fixes for Payment System</example>
    [Description("Title for new TODO list (required for create). Examples: 'User Auth Implementation', 'DB Migration Tasks', 'Frontend Refactoring'")]
    [StringLength(200, ErrorMessage = "Title cannot exceed 200 characters")]
    public string? Title { get; set; }

    /// <summary>
    /// Array of task items - individual tasks to be included in the todo list
    /// </summary>
    /// <example>Implement JWT token validation middleware</example>
    /// <example>Add unit tests for user service</example>
    /// <example>Update API documentation for auth endpoints</example>
    /// <example>Set up Redis for session storage</example>
    [Description("Array of task items (required for create). Examples: ['Implement JWT validation', 'Add unit tests', 'Update documentation']")]
    public List<string>? Items { get; set; }

    /// <summary>
    /// TODO list identifier with intelligent keyword resolution for quick access to recent work
    /// </summary>
    /// <example>latest</example>
    /// <example>active</example>
    /// <example>8a3f2b1c-54c1-4f0d</example>
    /// <example>8a3f</example>
    /// <example>current</example>
    [Description("TODO list ID with smart keywords. Examples: 'latest' (most recent), 'active' (pending tasks), '8a3f' (partial ID), 'current'")]
    public string? ListId { get; set; }

    /// <summary>
    /// Specific item ID within the list for targeted task operations
    /// </summary>
    /// <example>1</example>
    /// <example>3</example>
    /// <example>task-5</example>
    [Description("Specific item ID within the list. Examples: '1', '3', 'task-5'")]
    public string? ItemId { get; set; }

    /// <summary>
    /// New task to add to the existing todo list
    /// </summary>
    /// <example>Add error handling to payment processing</example>
    /// <example>Write integration tests for API endpoints</example>
    /// <example>Implement caching layer for user data</example>
    [Description("New task to add to the list. Examples: 'Add error handling', 'Write integration tests', 'Implement caching'")]
    public string? NewTask { get; set; }

    /// <summary>
    /// Status to set for the item - controls task completion state
    /// </summary>
    /// <example>pending</example>
    /// <example>in_progress</example>
    /// <example>completed</example>
    /// <example>blocked</example>
    [Description("Status to set for the item. Examples: 'pending', 'in_progress', 'completed', 'blocked'")]
    public string? Status { get; set; }

    /// <summary>
    /// Target workspace path or name - determines where todo list is stored or retrieved from
    /// </summary>
    /// <example>C:\source\MyProject</example>
    /// <example>./current-project</example>
    /// <example>my-workspace</example>
    [Description("Target workspace (path or name). Examples: 'C:\\source\\MyProject', './current-project', 'my-workspace'")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for plan operations - strategic planning with discovery accumulation and automatic TODO generation
/// </summary>
public class PlanParameters
{
    /// <summary>
    /// Action to perform - controls what operation to execute on strategic plans
    /// </summary>
    /// <example>list</example>
    /// <example>save</example>
    /// <example>view</example>
    /// <example>generate-todos</example>
    [Description("Action to perform. Examples: 'list' (show plans), 'save' (create plan), 'view' (display plan), 'generate-todos' (create tasks)")]
    public string Action { get; set; } = "list";

    /// <summary>
    /// Plan title - descriptive name for the strategic plan being created
    /// </summary>
    /// <example>OAuth2 Authentication Implementation</example>
    /// <example>Database Migration to MongoDB</example>
    /// <example>Frontend Performance Optimization</example>
    /// <example>Microservices Architecture Refactor</example>
    [Description("Plan title (required for save). Examples: 'OAuth2 Implementation', 'DB Migration to MongoDB', 'Frontend Optimization'")]
    [StringLength(200, ErrorMessage = "Title cannot exceed 200 characters")]
    public string? Title { get; set; }

    /// <summary>
    /// Full markdown plan description with implementation details, risks, and approach (required for save action)
    /// </summary>
    /// <example>## OAuth2 Implementation Plan\n### Requirements\n- Support Google and GitHub providers\n- Secure token storage\n### Approach\n1. Install OAuth libraries\n2. Configure providers\n3. Implement token validation</example>
    /// <example>## Database Migration Strategy\n### Current State\n- PostgreSQL 14 with 50GB data\n### Target\n- MongoDB with sharding\n### Migration Steps\n1. Schema analysis\n2. Data transformation scripts</example>
    /// <example>## Performance Optimization Plan\n### Current Issues\n- Slow dashboard loading (5s+)\n### Optimization Areas\n1. Database query optimization\n2. Frontend bundle splitting\n3. CDN implementation</example>
    [Description("Full markdown plan (required for save). Examples: '## Feature Plan\\n### Requirements...', '## Migration Strategy...', '## Optimization Plan...'")]
    [StringLength(10000, ErrorMessage = "Description cannot exceed 10000 characters")]
    public string? Description { get; set; }

    /// <summary>
    /// High-level plan items/milestones - key deliverables and checkpoints for the strategic plan
    /// </summary>
    /// <example>Research OAuth2 libraries and providers</example>
    /// <example>Implement authentication middleware</example>
    /// <example>Add comprehensive test coverage</example>
    /// <example>Deploy and monitor in production</example>
    [Description("High-level plan items/milestones. Examples: ['Research OAuth libraries', 'Implement middleware', 'Add test coverage']")]
    public List<string>? Items { get; set; }

    /// <summary>
    /// Plan identifier with intelligent keyword resolution for quick access to strategic plans
    /// </summary>
    /// <example>latest</example>
    /// <example>active</example>
    /// <example>b73bbb3c-54c1-4f0d</example>
    /// <example>8a3f</example>
    /// <example>current</example>
    [Description("Plan ID with smart keywords. Examples: 'latest' (most recent), 'active' (current plan), '8a3f' (partial ID), 'current'")]
    public string? PlanId { get; set; }

    /// <summary>
    /// Plan category for organization and filtering - helps group related strategic initiatives
    /// </summary>
    /// <example>Architecture</example>
    /// <example>Feature</example>
    /// <example>Migration</example>
    /// <example>Performance</example>
    [Description("Plan category for organization. Examples: 'Architecture', 'Feature', 'Migration', 'Performance', 'Security'")]
    public string? Category { get; set; }

    /// <summary>
    /// Plan priority level indicating urgency and resource allocation needs
    /// </summary>
    /// <example>high</example>
    /// <example>normal</example>
    /// <example>low</example>
    /// <example>critical</example>
    [Description("Plan priority level. Examples: 'critical' (urgent), 'high', 'normal' (default), 'low' (future)")]
    public string Priority { get; set; } = "normal";

    /// <summary>
    /// Strategic discoveries and learnings accumulated during plan implementation - captures insights and decisions
    /// </summary>
    /// <example>Found that OAuth2 library X has better TypeScript support than Y</example>
    /// <example>Database migration requires 2-hour downtime window</example>
    /// <example>Performance bottleneck was in N+1 queries, not frontend</example>
    /// <example>Security review identified need for rate limiting</example>
    [Description("Strategic discoveries and learnings. Examples: ['OAuth lib X has better TS support', 'Migration needs 2hr downtime', 'Bottleneck in N+1 queries']")]
    [JsonPropertyName("discoveries")]
    public List<string>? Discoveries { get; set; }

    /// <summary>
    /// Target workspace path or name - determines where strategic plan is stored or retrieved from
    /// </summary>
    /// <example>C:\source\MyProject</example>
    /// <example>./current-project</example>
    /// <example>my-workspace</example>
    [Description("Target workspace (path or name). Examples: 'C:\\source\\MyProject', './current-project', 'my-workspace'")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for recall operations - context restoration from memory with flexible time-based filtering
/// </summary>
public class RecallParameters
{
    /// <summary>
    /// Search query for finding specific memories - uses full-text search across all stored content
    /// </summary>
    /// <example>authentication implementation</example>
    /// <example>database migration</example>
    /// <example>performance optimization</example>
    /// <example>JWT token validation</example>
    [Description("Search query (optional - shows recent memories if empty). Examples: 'authentication implementation', 'database migration', 'performance'")]
    public string? Query { get; set; }

    /// <summary>
    /// Time range for memory recall using natural language expressions or specific dates
    /// </summary>
    /// <example>1d</example>
    /// <example>7d</example>
    /// <example>1w</example>
    /// <example>yesterday</example>
    /// <example>this week</example>
    [Description("Time range. Examples: '1d' (yesterday), '7d' (past week), '1w' (week), 'yesterday', 'this week'")]
    public string Since { get; set; } = "7d";

    /// <summary>
    /// Maximum number of results to return for memory recall
    /// </summary>
    /// <example>10</example>
    /// <example>25</example>
    /// <example>5</example>
    [Description("Maximum results (default: 10). Examples: 10 (default), 25 (comprehensive), 5 (quick overview)")]
    public int Limit { get; set; } = 10;

    /// <summary>
    /// Target workspace path or name - determines where memories are recalled from
    /// </summary>
    /// <example>C:\source\MyProject</example>
    /// <example>./current-project</example>
    /// <example>my-workspace</example>
    [Description("Target workspace (path or name). Examples: 'C:\\source\\MyProject', './current-project', 'my-workspace'")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for chronicle operations - decision and progress tracking with timestamped entries
/// </summary>
public class ChronicleParameters
{
    /// <summary>
    /// Action to perform - controls what chronicle operation to execute
    /// </summary>
    /// <example>list</example>
    /// <example>add</example>
    /// <example>view</example>
    /// <example>search</example>
    [Description("Action to perform. Examples: 'list' (show entries), 'add' (create entry), 'view' (display), 'search'")]
    public string Action { get; set; } = "list";

    /// <summary>
    /// Entry description - records important decisions, discoveries, or progress notes
    /// </summary>
    /// <example>Decided to use JWT tokens for authentication instead of sessions</example>
    /// <example>Discovered performance bottleneck in user query endpoint</example>
    /// <example>Completed migration of user service to new architecture</example>
    /// <example>Meeting notes: API design review with security team</example>
    [Description("Entry description. Examples: 'Decided to use JWT tokens', 'Discovered performance bottleneck', 'Completed migration'")]
    public string? Description { get; set; }

    /// <summary>
    /// Entry type - categorizes the nature of the chronicle entry
    /// </summary>
    /// <example>Decision</example>
    /// <example>Discovery</example>
    /// <example>Progress</example>
    /// <example>Meeting</example>
    /// <example>Note</example>
    [Description("Entry type. Examples: 'Decision' (architectural choice), 'Discovery' (finding), 'Progress' (milestone), 'Meeting', 'Note'")]
    public string Type { get; set; } = "Note";

    /// <summary>
    /// Time range for retrieving chronicle entries using natural language expressions
    /// </summary>
    /// <example>1d</example>
    /// <example>7d</example>
    /// <example>1w</example>
    /// <example>yesterday</example>
    [Description("Time range. Examples: '1d' (today), '7d' (week), '1w' (week), 'yesterday'")]
    public string Since { get; set; } = "7d";

    /// <summary>
    /// Target workspace path or name - determines where chronicle entries are stored or retrieved from
    /// </summary>
    /// <example>C:\source\MyProject</example>
    /// <example>./current-project</example>
    /// <example>my-workspace</example>
    [Description("Target workspace (path or name). Examples: 'C:\\source\\MyProject', './current-project', 'my-workspace'")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for standup operations - daily work summaries and progress reports for meetings and status updates
/// </summary>
public class StandupParameters
{
    /// <summary>
    /// Type of standup report determining the time range and detail level of the summary
    /// </summary>
    /// <example>daily</example>
    /// <example>weekly</example>
    /// <example>project</example>
    /// <example>custom</example>
    [Description("Standup type. Examples: 'daily' (1 day), 'weekly' (7 days), 'project' (30 days), 'custom' (use since parameter)")]
    public string Action { get; set; } = "daily";

    /// <summary>
    /// Time range for standup report - overrides the default time range from action type
    /// </summary>
    /// <example>1d</example>
    /// <example>3d</example>
    /// <example>1w</example>
    /// <example>2025-01-15</example>
    /// <example>yesterday</example>
    [Description("Time range overriding action default. Examples: '1d' (yesterday), '3d' (3 days), '1w' (week), '2025-01-15' (since date)")]
    public string? Since { get; set; }

    /// <summary>
    /// Target workspace path or name - determines which workspace's progress to summarize
    /// </summary>
    /// <example>C:\source\MyProject</example>
    /// <example>./current-project</example>
    /// <example>my-workspace</example>
    [Description("Target workspace (path or name). Examples: 'C:\\source\\MyProject', './current-project', 'my-workspace'")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for workspace operations - manage and switch between different development workspaces
/// </summary>
public class WorkspaceParameters
{
    /// <summary>
    /// Action to perform - controls what workspace operation to execute
    /// </summary>
    /// <example>list</example>
    /// <example>switch</example>
    /// <example>create</example>
    /// <example>current</example>
    [Description("Action to perform. Examples: 'list' (show workspaces), 'switch' (change workspace), 'create' (new workspace), 'current' (show active)")]
    public string Action { get; set; } = "list";

    /// <summary>
    /// Target workspace path or name for the operation
    /// </summary>
    /// <example>C:\source\MyProject</example>
    /// <example>./current-project</example>
    /// <example>my-workspace</example>
    /// <example>new-project</example>
    [Description("Target workspace (path or name). Examples: 'C:\\source\\MyProject', './current-project', 'my-workspace', 'new-project'")]
    public string? Workspace { get; set; }
}

/// <summary>
/// Parameters for search operations - powerful FTS5 search across all Goldfish data with ranking and relevance scoring
/// </summary>
public class SearchParameters
{
    /// <summary>
    /// Search query string using SQLite FTS5 syntax for powerful full-text search across all Goldfish data
    /// </summary>
    /// <example>authentication AND jwt</example>
    /// <example>database OR mongodb</example>
    /// <example>"user interface"</example>
    /// <example>plan NEAR/5 implementation</example>
    /// <example>checkpoint:session</example>
    [Required]
    [Description("FTS5 search query. Examples: 'auth AND jwt', 'database OR mongodb', '\"exact phrase\"', 'plan NEAR/5 implementation', 'checkpoint:session'")]
    [StringLength(500, ErrorMessage = "Query cannot exceed 500 characters")]
    public string Query { get; set; } = string.Empty;

    /// <summary>
    /// Target workspace identifier - path or name determining search scope
    /// </summary>
    /// <example>C:\source\MyProject</example>
    /// <example>./current-project</example>
    /// <example>my-workspace</example>
    /// <example>global</example>
    [Description("Target workspace (path or name) - uses current workspace if not specified. Examples: 'C:\\source\\MyProject', './current-project', 'global'")]
    public string? WorkspaceId { get; set; }

    /// <summary>
    /// Maximum number of results to return with relevance ranking
    /// </summary>
    /// <example>10</example>
    /// <example>25</example>
    /// <example>50</example>
    /// <example>5</example>
    [Description("Maximum number of results to return (default: 10, max: 50). Examples: 10 (default), 25 (comprehensive), 50 (maximum), 5 (quick)")]
    [Range(1, 50, ErrorMessage = "Limit must be between 1 and 50")]
    public int? Limit { get; set; } = 10;

    /// <summary>
    /// Time range filter for searching recent items using natural language or ISO dates
    /// </summary>
    /// <example>1h</example>
    /// <example>1d</example>
    /// <example>3d</example>
    /// <example>1w</example>
    /// <example>2025-01-15</example>
    [Description("Time range filter. Examples: '1h' (last hour), '1d' (today), '3d' (3 days), '1w' (week), '2025-01-15' (since date)")]
    public string? Since { get; set; }
}
