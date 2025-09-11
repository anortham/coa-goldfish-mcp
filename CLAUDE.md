# COA Goldfish MCP - AI Agent Instructions

## QUICK START FOR AI AGENTS

### Essential Actions
1. **Always use unified tools first**: `checkpoint`, `todo`, `plan`, `standup`
2. **Smart keywords work everywhere**: `"latest"`, `"active"`, `"current"` for listId/planId
3. **Default to dual output mode**: Shows both formatted text and JSON payload
4. **Proactively checkpoint after completing tasks**: Save progress automatically

### Core Unified Tools (USE THESE FIRST)
- **`mcp__goldfish__checkpoint`** - Save/restore session state. Use `action="save"` with description, `action="restore"` to resume work
- **`mcp__goldfish__todo`** - Complete task management. Use `action="create"` for new lists, `action="view"` to see tasks, `action="update"` to modify
- **`mcp__goldfish__plan`** - Strategic planning and feature design. Use `action="save"` for new plans, `action="generate-todos"` to create task lists
- **`mcp__goldfish__standup`** - Daily/weekly summaries. Use `action="daily"` for recent work, `scope="all"` for cross-workspace reports

### Support Tools (Secondary)
- **`mcp__goldfish__search`** - Full-text search across all entities with FTS5 
- **`mcp__goldfish__search_checkpoints`** - Search checkpoints specifically
- **`mcp__goldfish__search_plans`** - Search plans specifically
- **`mcp__goldfish__search_todos`** - Search todos specifically
- **`mcp__goldfish__search_chronicle`** - Search chronicle entries specifically
- **`mcp__goldfish__recall`** - Quick context restoration (no parameters needed)
- **`mcp__goldfish__chronicle`** - Decision and progress tracking
- **`mcp__goldfish__workspace`** - Workspace management and switching

## CRITICAL TESTING INFO
**After making code changes, user must restart Claude Code before testing MCP tools.**

## Architecture Overview
- **C#/.NET 9.0 MCP server** with Entity Framework Core and SQLite storage
- **Workspace-aware data persistence** with automatic database migrations
- **Cross-workspace querying** for comprehensive reporting across projects
- **Smart output modes** (plain/emoji/json/dual) with environment detection
- **High-performance SQLite backend** with indexed search capabilities

## Core Development Principles
- Handle errors gracefully with helpful messages, never crash
- Use separate content blocks to prevent Claude Code output collapse
- Tool descriptions optimized for proactive AI agent usage
- TDD methodology for all bug fixes and feature development using NUnit

## Entity Framework & Database Architecture

### Database Context
```csharp
public class GoldfishDbContext : DbContext
{
    public DbSet<WorkspaceState> WorkspaceStates { get; set; }
    public DbSet<Plan> Plans { get; set; }
    public DbSet<TodoList> TodoLists { get; set; }
    public DbSet<TodoItem> TodoItems { get; set; }
    public DbSet<Checkpoint> Checkpoints { get; set; }
    public DbSet<ChronicleEntry> ChronicleEntries { get; set; }
}
```

### Key Entities
- **Checkpoint**: Session snapshots with full context restoration
- **Plan**: Strategic planning documents with versioning and progress tracking
- **TodoList/TodoItem**: Task management with hierarchical structure
- **ChronicleEntry**: Decision tracking and milestone recording
- **WorkspaceState**: Multi-project organization with isolation

### Migration & Deployment
```bash
# Add new migration after model changes
dotnet ef migrations add MigrationName --project COA.Goldfish.McpServer

# Update database (automatic on server startup)
dotnet ef database update --project COA.Goldfish.McpServer
```

## Unified Tool Patterns (CURRENT ARCHITECTURE)

### Smart Parameter Defaults
All unified tools use intelligent defaults and action inference:
- **Action inference**: `checkpoint({ description: "..." })` automatically saves
- **Smart keywords**: `listId: "latest"`, `planId: "active"`, `since: "yesterday"`  
- **Auto-completion**: Most parameters are optional with sensible defaults
- **Environment adaptation**: Output format auto-detects CI/test/terminal environments

### Example Usage Patterns
```csharp
// C# MCP Tool Implementation Examples
public async Task<ToolResult> CheckpointAsync(CheckpointRequest request)
{
    if (!string.IsNullOrEmpty(request.Description))
    {
        // Auto-save when description provided
        return await SaveCheckpointAsync(request);
    }
    return await RestoreCheckpointAsync(request);
}

public async Task<ToolResult> TodoAsync(TodoRequest request)
{
    // Smart keyword resolution
    if (request.ListId == "latest" || request.ListId == "active")
    {
        request.ListId = await ResolveSmartKeywordAsync(request.ListId);
    }
    
    // Action inference based on parameters
    if (!string.IsNullOrEmpty(request.Title) && request.Items?.Any() == true)
    {
        return await CreateTodoListAsync(request);
    }
    // ... other action inference logic
}
```

### Data Storage & Search
- **Checkpoints**: Session state with active files, highlights, and context
- **Plans**: Strategic planning with items, discoveries, and progress tracking
- **TodoLists**: Task management with smart keyword resolution
- **ChronicleEntries**: Decision tracking and milestone recording
- **Full-text search**: FTS5-powered search across all entities with BM25 relevance scoring

### TODO List Special Keywords
AI agents can use intuitive keywords instead of exact IDs:

**Supported Keywords for `listId` parameter:**
- `"latest"` / `"recent"` / `"last"` - Most recently updated TODO list
- `"active"` / `"current"` - Most recent list with pending tasks
- Partial ID match - Use suffix of actual ID for easy identification
- **Database queries optimize keyword resolution** for fast lookup

## Search & Discovery System

### FTS5 Full-Text Search
The system provides powerful search capabilities across all entities:

```csharp
// Search across all entities
var result = await _searchService.SearchAsync("query", workspaceId, limit: 10);

// Entity-specific searches with BM25 relevance ranking
var checkpoints = await _searchService.SearchCheckpointsAsync("implementation");
var plans = await _searchService.SearchPlansAsync("feature design");
var todos = await _searchService.SearchTodosAsync("bug fix");
var chronicle = await _searchService.SearchChronicleAsync("decision");
```

### Search Features
- **BM25 relevance scoring** for better result ranking
- **FTS5 virtual tables** with automatic sync triggers
- **Workspace-aware queries** for isolated search results
- **Contextual snippets** with query highlighting

## Project Structure

```
COA.Goldfish.McpServer/          # Main MCP server project
├── Models/                      # Entity Framework models
│   ├── Checkpoint.cs          # Session management entity
│   ├── Plan.cs                # Strategic planning entity
│   ├── TodoList.cs            # TODO list management entity
│   ├── ChronicleEntry.cs      # Decision tracking entity
│   ├── WorkspaceState.cs      # Workspace management entity
│   ├── ToolParameters.cs      # MCP tool parameters
│   └── ToolResults.cs         # MCP tool results
├── Services/                   # Business logic services
│   ├── SearchService.cs       # FTS5 search implementation
│   ├── WorkspaceService.cs    # Workspace handling
│   └── PathResolutionService.cs # Path utilities
├── Tools/                      # MCP tool implementations
│   ├── CheckpointTool.cs      # Session management
│   ├── TodoTool.cs           # Task management  
│   ├── PlanTool.cs           # Strategic planning
│   ├── StandupTool.cs        # Reporting tools
│   ├── ChronicleTool.cs      # Decision tracking
│   ├── WorkspaceTool.cs      # Workspace management
│   ├── RecallTool.cs         # Context restoration
│   └── SearchTool.cs         # Full-text search tools
├── Services/Storage/          # Database layer
│   ├── GoldfishDbContext.cs  # EF Core context with FTS5
│   └── DatabaseInitializer.cs # DB setup and FTS5 tables
└── Program.cs                 # MCP server entry point

COA.Goldfish.Migration/         # Legacy data migration utility
├── JsonToSqliteMigrator.cs    # Migrate from Node.js JSON files
└── Program.cs                 # Migration tool entry point

COA.Goldfish.IntegrationTests/  # Integration test suite
├── ClaudeCodeIntegrationTests.cs     # End-to-end MCP tests
├── ErrorHandlingIntegrationTests.cs # Error scenario tests
├── McpProtocolIntegrationTests.cs   # MCP protocol compliance
└── WorkspaceDetectionTests.cs       # Cross-workspace functionality

COA.Goldfish.PerformanceTests/  # Performance benchmarks
└── PerformanceBenchmarkTests.cs     # Load and performance tests
```

## Development Commands

```bash
# Build solution
dotnet build COA.Goldfish.sln

# Run main MCP server
dotnet run --project COA.Goldfish.McpServer

# Kill stuck process (Windows)
taskkill /F /PID [process_id]

# Run all tests
dotnet test COA.Goldfish.sln

# Run integration tests only
dotnet test COA.Goldfish.IntegrationTests

# Run performance benchmarks
dotnet test COA.Goldfish.PerformanceTests

# Database migrations
dotnet ef migrations add <MigrationName> --project COA.Goldfish.McpServer
dotnet ef database update --project COA.Goldfish.McpServer

# Legacy migration from Node.js
dotnet run --project COA.Goldfish.Migration
```

## Testing Architecture

### NUnit Test Framework
All tests use NUnit with the following patterns:
```csharp
[Test]
public async Task Should_SaveCheckpoint_When_DescriptionProvided()
{
    // Arrange
    var request = new CheckpointRequest { Description = "Test checkpoint" };
    
    // Act
    var result = await _checkpointTool.ExecuteAsync(request);
    
    // Assert
    Assert.That(result.IsSuccess, Is.True);
    Assert.That(result.Content, Contains.Substring("checkpoint saved"));
}
```

### Test Categories
- **Integration Tests**: Full MCP protocol testing with real database
- **Performance Tests**: Load testing and benchmark measurements
- **Unit Tests**: Individual component testing with mocked dependencies

## Configuration & Environment

### Database Configuration
- **Development**: SQLite database in `%USERPROFILE%\.coa\goldfish\{workspace}\goldfish.db`
- **Testing**: In-memory SQLite database with isolated test data
- **CI/CD**: Temporary SQLite databases cleaned up after tests

### Environment Variables
- `COA_GOLDFISH_BASE_PATH`: Custom base path for data storage
- `GOLDFISH_WORKSPACE`: Current workspace name override
- `ASPNETCORE_ENVIRONMENT`: ASP.NET Core environment setting

### MCP Server Configuration
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source={workspace-path}/goldfish.db"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "COA.Goldfish": "Debug"
    }
  }
}
```

## Key Features & Fixes

### Database-Powered Features
- **Fast full-text search** with SQLite FTS5 indexes
- **Cross-workspace queries** with workspace isolation
- **Automatic data migration** from legacy Node.js JSON storage
- **Optimized keyword resolution** for smart parameters

### Performance Improvements
- **Entity Framework Core** with optimized queries and indexing
- **Connection pooling** for database efficiency
- **Async/await patterns** throughout the codebase
- **Memory management** with proper disposal patterns

### Reliability Enhancements
- **Comprehensive error handling** with graceful degradation
- **Database transaction safety** for data consistency
- **Migration path** from legacy Node.js implementation
- **Cross-platform compatibility** (Windows, macOS, Linux)

## Migration from Node.js

### Automatic Migration Tool
The `COA.Goldfish.Migration` project provides automatic migration:
```bash
# Run migration tool to convert JSON files to SQLite
dotnet run --project COA.Goldfish.Migration

# Migration preserves:
# - All existing memories and their metadata
# - TODO lists with complete history
# - Workspace organization
# - Timestamps and relationships
```

### Legacy Compatibility
- **Smart keyword support** maintains existing agent workflows
- **JSON serialization compatibility** for memory content
- **Workspace detection** automatically finds existing data
- **Incremental migration** handles partial conversions

## Critical Notes
- **Database-first approach**: All data persisted in SQLite with EF Core
- **Performance optimized**: Indexed queries and efficient data access
- **Cross-platform ready**: Runs on Windows, macOS, and Linux
- **Migration included**: Seamless upgrade path from Node.js version
- **Test coverage**: Comprehensive integration and performance test suites
- **Production ready**: Error handling, logging, and monitoring built-in
- scriban docs are available at "C:\source\COA CodeSearch MCP\docs\scriban-docs.md"