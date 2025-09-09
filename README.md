# COA Goldfish MCP (.NET)

> Your development session's "flight recorder" - now with SQLite persistence and behavioral enforcement

## 🐠 What is Goldfish (.NET)?

Goldfish .NET is a **crash-safe developer's work journal** rebuilt from the ground up with:

- **SQLite Database** - Fast, reliable persistence with Entity Framework Core
- **Behavioral Enforcement** - AI agents guided to use tools correctly and consistently  
- **Streamlined Architecture** - 7 unified tools that work as a cohesive system
- **Global Workspace Support** - Cross-project TODOs and plans
- **Optional API Sync** - Enterprise-ready with offline-first design
- **10x Performance** - Faster data correlations and queries

## 🚀 Installation

### Method 1: Global .NET Tool (Recommended)
```bash
# Install as global .NET tool
dotnet tool install -g COA.Goldfish

# Add to Claude Code MCP configuration
# Edit ~/.claude/settings.json:
```

```json
{
  "mcpServers": {
    "goldfish": {
      "type": "stdio", 
      "command": "goldfish",
      "args": [],
      "env": {}
    }
  }
}
```

### Method 2: Local Development
```bash
# Clone and build
git clone [repository-url]
cd "COA Goldfish MCP/dotnet"
dotnet build

# Run directly
dotnet run --project src/COA.Goldfish.McpServer

# Or add to Claude Code with full path:
# "command": "C:/path/to/COA Goldfish MCP/dotnet/src/COA.Goldfish.McpServer/bin/Debug/net9.0/COA.Goldfish.McpServer.exe"
```

## 🛠 Core Tools (Streamlined Architecture)

### Unified Smart Tools
Goldfish .NET provides **7 main tools** that enforce a cohesive workflow:

#### 1. **`mcp__goldfish__plan`** - Strategic Planning with Discovery Accumulation
- Design features and create implementation roadmaps
- Track discoveries and lessons learned during development
- Generate TODO lists automatically from plans
- **Active Plan Concept** - ONE active plan per workspace at a time

```
You: "Create a plan for implementing OAuth2 authentication"
Goldfish: Creates structured plan with items, discoveries field, and optional TODO generation
```

#### 2. **`mcp__goldfish__todo`** - Smart Task Management 
- Create and manage persistent TODO lists
- **Active List Concept** - ONE active TODO list per workspace  
- Smart keyword resolution: `"latest"`, `"active"`, `"current"`
- Automatic cleanup of completed/stale tasks

```
You: "Add urgent task to active list"
Goldfish: Adds to your current active TODO list without needing exact IDs
```

#### 3. **`mcp__goldfish__checkpoint`** - Session State Management
- Save/restore complete work context with workspace detection
- Automatic file tracking, git branch capture, session correlation
- **Behavioral Enforcement** - AI agents guided to checkpoint regularly

```
You: "Save checkpoint: Completed JWT implementation with refresh tokens"  
Goldfish: Captures description, active files, git branch, session context
```

#### 4. **`mcp__goldfish__standup`** - Cross-Tool Progress Summaries
- Daily/weekly/project summaries across all workspaces
- **Enhanced Reporting** - Correlates data from checkpoints, TODOs, plans
- Timeline integration for comprehensive progress tracking

```
You: "Generate daily standup report"
Goldfish: Shows yesterday's checkpoints, TODO progress, plan updates across all projects
```

#### 5. **`mcp__goldfish__recall`** - Context Restoration
- Quick access to recent memories and work context
- Cross-tool search for finding past decisions and solutions
- **No parameters needed** - just instant context restoration

```
You: "What was I working on?"
Goldfish: Shows recent checkpoints, active TODOs, current plans
```

#### 6. **`mcp__goldfish__chronicle`** - Decision and Progress Tracking
- **NEW** - Replaces standalone Intel tool with integrated decision tracking  
- Auto-populated from other tools or manual entry creation
- Chronological progress logging for audit trails

```
You: "Record decision: Using PostgreSQL over MongoDB for better transaction support"
Goldfish: Creates chronicle entry with timestamp, links to related plans/TODOs
```

#### 7. **`mcp__goldfish__workspace`** - Active Work State Management
- **NEW** - Manages active plan and TODO list per workspace
- Enforces the "ONE active item" concept for focused work
- Cleanup orphaned work and validate workspace state

```
You: "Set active plan to user-authentication-plan" 
Goldfish: Makes this the active plan, deactivates others, validates workspace state
```

## 🎯 Key Improvements Over TypeScript Version

### Behavioral Enforcement System
- **AI Agent Guidance** - Tools work together as a system, not isolated commands
- **Active Work State** - Enforces ONE active plan and TODO list per workspace
- **Automatic State Management** - Prevents stale/orphaned work items
- **Workflow Validation** - Ensures proper tool usage patterns

### Performance & Architecture  
- **SQLite + Entity Framework Core** - 10x faster than JSON file operations
- **Structured Queries** - Complex data correlations and cross-tool summaries
- **Transaction Safety** - ACID compliance for data integrity
- **Automatic Migrations** - Schema updates handled seamlessly

### Enterprise Features
- **Optional API Sync** - Sync data across teams/devices with offline-first design
- **Global Workspace** - Cross-project TODO lists and plans using `__global__` workspace
- **Audit Trails** - Complete history via Chronicle entries
- **Backup & Recovery** - Built-in database backup during migrations

## 📊 Database Schema

### Core Entities
```csharp
public class WorkspaceState 
{
    public string WorkspaceId { get; set; }
    public string? ActivePlanId { get; set; }      // ONE active plan
    public string? ActiveTodoListId { get; set; }  // ONE active TODO list  
    public DateTime LastActivity { get; set; }
}

public class Plan
{
    public string Id { get; set; }
    public string WorkspaceId { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public PlanStatus Status { get; set; }      // Draft, Active, Complete, Abandoned
    public List<string> Items { get; set; }
    public List<string> Discoveries { get; set; }  // NEW - replaces Intel tool
    public DateTime CreatedAt { get; set; }
}

public class TodoList
{
    public string Id { get; set; }
    public string WorkspaceId { get; set; }
    public string Title { get; set; }
    public bool IsActive { get; set; }          // Active list concept
    public List<TodoItem> Items { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ChronicleEntry  // NEW - Decision tracking
{
    public string Id { get; set; }
    public string WorkspaceId { get; set; }
    public DateTime Timestamp { get; set; }
    public ChronicleEntryType Type { get; set; }  // Decision, Milestone, Issue, Resolution
    public string Description { get; set; }
    public string? RelatedPlanId { get; set; }    // Link to plans
    public string? RelatedTodoId { get; set; }    // Link to TODOs
}
```

## 🔧 Configuration

### Database Location
```bash
# Default: ~/.coa/goldfish/goldfish.db
# Override with connection string:
export GOLDFISH_DATABASE_CONNECTION_STRING="Data Source=/custom/path/goldfish.db"

# Or set base path (goldfish.db will be created there):
export COA_GOLDFISH_BASE_PATH="/custom/goldfish/storage"
```

### API Sync (Optional)
```json
{
  "Goldfish": {
    "Sync": {
      "Enabled": true,
      "ApiUrl": "https://your-goldfish-api.com",
      "ApiKey": "your-api-key"
    }
  }
}
```

### Behavioral Enforcement Levels
```json
{
  "Goldfish": {
    "Enforcement": {
      "Level": "StronglyUrge",  // None, Suggest, StronglyUrge, Require
      "RequireActiveWork": true,
      "AutoCleanupDays": 7
    }
  }
}
```

## 🚀 Usage Examples

### Morning Workflow
```
You: "What's my current work state?"
Goldfish: 
- Active Plan: "User Authentication System" (3/7 items complete)
- Active TODO: "API Endpoints" (2 pending tasks)
- Last Checkpoint: "JWT validation complete" (yesterday 4:30 PM)
```

### Strategic Planning  
```
You: "Create plan for database migration to PostgreSQL"
Goldfish: Creates plan with structured items, then asks:
"Would you like me to generate a TODO list from this plan?"

You: "Yes, create TODO list"
Goldfish: 
- Creates TODO list with plan items
- Sets as active TODO list
- Links plan and TODO list in database
```

### Cross-Workspace Reporting
```
You: "Generate weekly standup across all projects"
Goldfish:
## Weekly Standup (Sept 2-8, 2025)

**Completed Across All Projects:**
- goldfish-mcp: Migration to .NET complete (23 checkpoints)
- api-project: OAuth2 integration (15 checkpoints)  
- client-portal: UI redesign phase 1 (8 checkpoints)

**Active Work:**
- 3 active plans across projects
- 12 pending TODO items
- Next: API testing and deployment
```

### Decision Tracking
```
You: "Record decision: Using Entity Framework Core over Dapper for better migration support"
Goldfish: Creates chronicle entry linked to current active plan, searchable in future
```

## 🧪 Development & Testing

```bash
# Run all tests
dotnet test

# Run specific test project
dotnet test tests/COA.Goldfish.McpServer.Tests/
dotnet test tests/COA.Goldfish.IntegrationTests/

# Development with hot reload
dotnet watch run --project src/COA.Goldfish.McpServer

# Database migrations
dotnet ef migrations add NewMigration --project src/COA.Goldfish.McpServer
dotnet ef database update --project src/COA.Goldfish.McpServer
```

## 📦 Migration from TypeScript Version

If you have existing TypeScript Goldfish data:

```bash
# Run migration tool (will scan ~/.coa/goldfish automatically)
cd dotnet
dotnet run --project src/COA.Goldfish.Migration

# Or specify custom paths:
dotnet run --project src/COA.Goldfish.Migration -- "/custom/json/path" "Data Source=/custom/db/path"
```

**Note:** Migration preserves all checkpoints, TODO lists, and plans while converting them to the new SQLite schema.

## 🎯 Behavioral Philosophy

### Active Work Concept
- **ONE active plan per workspace** - Enforces focused strategic work
- **ONE active TODO list per workspace** - Prevents task fragmentation  
- **Automatic cleanup** - Stale work items are automatically archived
- **AI agent guidance** - Built-in templates encourage proper usage patterns

### Tool Priorities for AI Agents
1. **Plan** (90) - Strategic thinking first
2. **Todo** (95) - Task management 
3. **Checkpoint** (100) - Session persistence
4. **Standup** (85) - Progress reporting
5. **Recall** (80) - Context restoration
6. **Chronicle** (75) - Decision tracking
7. **Workspace** (70) - State management

## 🏗 Architecture Overview

```
src/
├── COA.Goldfish.McpServer/           # Main MCP server
│   ├── Program.cs                    # Entry point with behavioral enforcement
│   ├── Models/                       # EF Core entities  
│   ├── Services/                     # Business logic layer
│   │   ├── Storage/                  # Database context and services
│   │   ├── WorkspaceService.cs       # Workspace state management
│   │   └── SyncService.cs            # Optional API sync
│   ├── Tools/                        # 7 MCP tools
│   └── Templates/                    # Behavioral adoption templates
└── COA.Goldfish.Migration/           # Data migration from TypeScript
```

## 🚀 Deployment

### Global Tool Package
```bash
# Build and pack
dotnet pack src/COA.Goldfish.McpServer -c Release

# Install locally for testing
dotnet tool install -g COA.Goldfish --add-source ./src/COA.Goldfish.McpServer/bin/Release

# Publish to NuGet (when ready)
dotnet nuget push COA.Goldfish.*.nupkg --api-key YOUR_API_KEY --source https://api.nuget.org/v3/index.json
```

### Container Deployment (API Sync Server)
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0
COPY . /app
WORKDIR /app
EXPOSE 80
ENTRYPOINT ["dotnet", "COA.Goldfish.McpServer.dll"]
```

## 📄 License

MIT License - Build amazing workflows with structured persistence!

---

**Ready to upgrade?** The .NET version provides everything the TypeScript version offered, plus enterprise features, better performance, and AI agent behavioral enforcement for more productive development sessions.