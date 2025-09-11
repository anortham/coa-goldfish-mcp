> Here’s a focused review of the .NET port with concrete issues, gaps, and quick wins.

High-Risk Issues

- Broken integration test: ClaudeCodeIntegrationTests.cs - Calls StartMcpServerAsync, InitializeMcpConnectionAsync, and SendMcpRequestAsync but does not define them (contrast:
  McpProtocolIntegrationTests.cs defines these). This test won’t compile/run as-is. - Action: copy the helper methods region from McpProtocolIntegrationTests.cs or factor shared helpers into a common test utility.
- Tool name inconsistency in tests - Some tests call tools using unprefixed names ("todo", "checkpoint", "standup"), others use prefixed names ("mcp**goldfish**todo",
  "mcp**goldfish**recall"). This can pass if the framework supports aliasing, but it’s a fragile inconsistency. - Action: pick a single convention (recommended: the full prefixed tool names) and standardize tests.
- Documentation vs. implementation mismatch (misleads users/agents) - CLAUDE.md references entities like Memory, full-text search (FTS5), “search_history”, “timeline” tools, and code structure that doesn’t
  exist in the .NET code. Current implementation uses Checkpoint, Plan, TodoList, ChronicleEntry, and simple Contains(...) searches. - Action: update CLAUDE.md and README sections to reflect the current schema, features, and tool list.

Functionality Gaps vs. TypeScript Version

- Standup feature parity - TS supported includePlans, includeTodos, includeCheckpoints, includeRelationships, format, outputStyle, etc. .NET StandupParameters
  only include Action, Since, Workspace. - One test calls standup with includeRelationships, etc. These are silently ignored today (likely fine), but functionality is missing. - Action: either implement the extra parameters or remove them from tests/docs to avoid confusion.
- Search and session services are stubs
  - SearchService.cs and SessionService.cs are registered in DI but contain TODOs and are unused.
  - Action: remove until needed or implement basic functionality to avoid dead code and confusion.
- Workspace env var not honored - Tests set GOLDFISH_WORKSPACE, but PathResolutionService only considers Goldfish:PrimaryWorkspace and defaults to
  Environment.CurrentDirectory. It works because tests also set WorkingDirectory; however, env var support would match docs and improve
  ergonomics. - Action: read GOLDFISH_WORKSPACE in PathResolutionService.InitializePrimaryWorkspace() (fallback to current directory if not set).

Test Quality Issues

- Over-reliance on string contains for errors and content checks - Explicitly parses top-level error in a few places (good), but other assertions still use substring checks like
  Contains("\"isError\":true"). - Action: consistently parse responses and assert against structured JSON; avoid substring checks that can false-positive.
- Performance tests use prefixed names while integration tests mix both
  - Action: normalize tool names everywhere.
- Potential flakiness due to SQLite file locks - Many tests properly add GC/clear pool delays; a couple of places still just Directory.Delete in teardown without ensuring pools
  cleared. - Action: apply the same cleanup helper (GC + SqliteConnection.ClearAllPools() + small delay) across all tests that spin processes.

Code Smells and Minor Improvements

- DI/tool registration inconsistency - Program.cs registers seven tools individually, then runs DiscoverTools. WorkflowTool.cs exists but is not explicitly added. If the
  framework adds discovered tools into DI automatically, explicit registration is unnecessary and uneven. - Action: choose one pattern (explicitly add all or rely solely on discovery). If keeping explicit adds, include WorkflowTool for
  consistency.
- Parameter validation inconsistency
  - TodoTool uses ParameterValidator, PlanTool and CheckpointTool do their own manual checks. Inconsistent but non-blocking.
  - Action: standardize on the same validation approach for uniform error messages and behavior.
- Logging noise vs. STDIO safety
  - You correctly route logs to file-only; great. Consider making log levels configurable via env for test runs (to reduce file churn).
- EF model constraints look solid
  - Good use of JSON conversion + ValueComparers for lists/dictionaries and indexing. Keep it.
- Database initialization - DatabaseInitializer uses EnsureCreated, ignoring migrations even though MigrationsAssembly exists in config. - Action: either remove the MigrationsAssembly config or add optional migrations path. At a minimum, clarify in README which model you
  use.

Parities with Goals (plan → todos → checkpoint → recall → standup)

- Tools present and integrated via EF:
  - PlanTool (supports save, list, update, complete, generate-todos).
  - TodoTool (supports create, view, update; smart keywords implemented).
  - CheckpointTool (save/restore works; simple and clear).
  - RecallTool (lists or queries across checkpoints, todos, plans).
  - StandupTool (daily/weekly summaries; lacks advanced relationship visuals but meets basic need).
  - ChronicleTool (replaces Intel with decision tracking).
  - WorkspaceTool (list/status/switch/cleanup/summary).
- Behavioral templates and tool priorities
  - Good. Templates are embedded; priorities and enforcement services exist and are wired. This is a nice step beyond the TS version.

Recommended Fix List (quick wins first)

- Fix test compilation - Add the missing MCP server/helper methods to ClaudeCodeIntegrationTests.cs (copy from McpProtocolIntegrationTests.cs) or centralize
  into a test utility.
- Standardize tool names in tests - Use prefixed tool names everywhere: mcp**goldfish**plan, mcp**goldfish**todo, etc., or confirm the COA framework’s aliasing and
  document it. Consistency is key.
- Update docs
  - Bring CLAUDE.md and README in sync with the .NET implementation:
  - Entity list (`Checkpoint`, `Plan`, `TodoList`, `ChronicleEntry`, `WorkspaceState`).
  - Remove references to `Memory` and FTS5 unless you intend to add them.
  - Align tool list to the 7 implemented tools. Mention `workflow` only if you intend to expose it.
- Honor GOLDFISH_WORKSPACE
  - In PathResolutionService.InitializePrimaryWorkspace(), check env var GOLDFISH_WORKSPACE (if set, normalize and use it).
- Clean DI or discovery approach
  - Either remove explicit AddScoped<...Tool> calls and rely on DiscoverTools, or add WorkflowTool explicitly for parity.
- Remove or implement stubs
  - Either remove SearchService and SessionService registrations or provide basic implementations to avoid confusion.
- Optional: expand StandupTool - If you care about parity, add optional parameters (includePlans, includeTodos, includeCheckpoints, includeRelationships) and reflect
  in summary.
