# Goldfish .NET Migration - Active Development Guide

## 📋 Migration Status: **PLANNING PHASE**

This document tracks the migration of Goldfish MCP from TypeScript to .NET, implementing a streamlined tool architecture with behavioral enforcement.

---

## 🎯 Key Improvements in .NET Version

### Core Philosophy Changes
- **Lifecycle Enforcement**: Tools work as a cohesive system, not isolated commands
- **Active Work State**: ONE active plan and TODO list per workspace at a time
- **Automatic State Management**: AI agents guided to maintain work state consistently
- **Chronicle Integration**: Decision tracking replaces standalone Intel tool

### Streamlined 7-Tool Architecture
1. **Plan** - Strategic planning with discoveries field (replaces separate Intel)
2. **Todo** - Task management with active list concept
3. **Checkpoint** - Session state management (unchanged)
4. **Recall** - Context restoration (unchanged)  
5. **Chronicle** - Decision/progress log (NEW, auto-populated)
6. **Standup** - Cross-tool summaries (enhanced)
7. **Workspace** - Active work state management (NEW)

### Technical Improvements
- **SQLite + Entity Framework Core**: Replace JSON files with proper database
- **Optional API Sync**: Enterprise-ready with offline-first design
- **Performance**: 10x improvement for data correlations
- **Global Workspace**: Cross-project todos and plans

---

## 📁 Project Structure

```
C:\source\COA Goldfish MCP\
├── [existing TypeScript implementation]
├── src/, tests/, package.json, etc.
│
├── ACTIVE_MIGRATION.md              # THIS FILE - migration guide
│
├── dotnet/                          # NEW: .NET implementation
│   ├── COA.Goldfish.sln
│   ├── Directory.Build.props
│   ├── README.md
│   │
│   ├── src/
│   │   ├── COA.Goldfish.McpServer/
│   │   │   ├── COA.Goldfish.McpServer.csproj
│   │   │   ├── Program.cs
│   │   │   ├── appsettings.json
│   │   │   ├── Models/              # EF Core entities
│   │   │   │   ├── Checkpoint.cs
│   │   │   │   ├── Plan.cs
│   │   │   │   ├── TodoList.cs
│   │   │   │   ├── TodoItem.cs
│   │   │   │   ├── ChronicleEntry.cs
│   │   │   │   └── WorkspaceState.cs
│   │   │   ├── Services/
│   │   │   │   ├── Storage/
│   │   │   │   │   ├── GoldfishDbContext.cs
│   │   │   │   │   └── IStorageService.cs
│   │   │   │   ├── WorkspaceService.cs
│   │   │   │   ├── SearchService.cs
│   │   │   │   ├── SessionService.cs
│   │   │   │   └── SyncService.cs
│   │   │   ├── Tools/               # MCP tools
│   │   │   │   ├── PlanTool.cs
│   │   │   │   ├── TodoTool.cs
│   │   │   │   ├── CheckpointTool.cs
│   │   │   │   ├── RecallTool.cs
│   │   │   │   ├── ChronicleTool.cs
│   │   │   │   ├── StandupTool.cs
│   │   │   │   └── WorkspaceTool.cs
│   │   │   ├── Providers/           # Resource providers
│   │   │   └── Templates/           # Behavioral adoption
│   │   │       └── goldfish-instructions.scriban
│   │   │
│   │   └── COA.Goldfish.Migration/
│   │       ├── COA.Goldfish.Migration.csproj
│   │       └── JsonToSqliteMigrator.cs
│   │
│   ├── tests/
│   │   ├── COA.Goldfish.McpServer.Tests/
│   │   └── COA.Goldfish.McpServer.IntegrationTests/
│   │
│   └── docs/
│       └── migration-guide.md
│
└── shared/                          # Shared resources
    ├── schemas/                     # JSON schemas for validation
    └── test-data/                   # Test data for both versions
```

---

## 🗃️ Data Model Architecture

### Core Entities

```csharp
public class WorkspaceState 
{
    public string WorkspaceId { get; set; }
    public string? ActivePlanId { get; set; }
    public string? ActiveTodoListId { get; set; }
    public DateTime LastActivity { get; set; }
}

public class Plan
{
    public string Id { get; set; }
    public string WorkspaceId { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public PlanStatus Status { get; set; } // Draft, Active, Complete, Abandoned
    public List<string> Items { get; set; }
    public List<string> Discoveries { get; set; } // Replaces Intel
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class TodoList
{
    public string Id { get; set; }
    public string WorkspaceId { get; set; }
    public string Title { get; set; }
    public bool IsActive { get; set; }
    public List<TodoItem> Items { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ChronicleEntry  // NEW - Decision tracking
{
    public string Id { get; set; }
    public string WorkspaceId { get; set; }
    public DateTime Timestamp { get; set; }
    public ChronicleEntryType Type { get; set; } // Decision, Milestone, Issue, Resolution
    public string Description { get; set; }
    public string? RelatedPlanId { get; set; }
    public string? RelatedTodoId { get; set; }
}
```

---

## 🔧 Development Phases

### Phase 1: Foundation Setup ⏳
**Goal**: Basic .NET MCP server running with Entity Framework

#### Checklist:
- [ ] Create `dotnet/COA.Goldfish.sln` solution
- [ ] Setup `COA.Goldfish.McpServer.csproj` with proper NuGet references:
  - [ ] `COA.Mcp.Framework` (2.1.10+)
  - [ ] `COA.Mcp.Framework.TokenOptimization`
  - [ ] `Microsoft.EntityFrameworkCore.Sqlite`
  - [ ] `Serilog` packages
- [ ] Create `Program.cs` following CodeSearch pattern
- [ ] Setup dependency injection container
- [ ] Configure Serilog for file-only logging
- [ ] Create basic `GoldfishDbContext` with initial entities
- [ ] Add EF Core migrations support
- [ ] Validate MCP protocol handshake works

### Phase 2: Core Storage Layer ⏳
**Goal**: SQLite database with Entity Framework working

#### Checklist:
- [ ] Design complete entity model with relationships
- [ ] Implement `IStorageService` interface
- [ ] Create EF Core `GoldfishDbContext` with all entities
- [ ] Add initial database migration
- [ ] Implement workspace-aware queries
- [ ] Add transaction support for atomic operations
- [ ] Create connection string configuration
- [ ] Test database operations with in-memory SQLite

### Phase 3: Tool Implementation ⏳
**Goal**: All 7 tools implemented and working

#### Core Tools:
- [ ] **CheckpointTool** - Port from TS version (start here - simplest)
  - [ ] Save/restore session state
  - [ ] Workspace detection
  - [ ] JSON compatibility validation
- [ ] **TodoTool** - Enhanced with active list concept
  - [ ] Create/view/update TODO lists
  - [ ] Active list management per workspace
  - [ ] Smart keyword resolution ("latest", "active")
  - [ ] Item status tracking
- [ ] **PlanTool** - Enhanced with discoveries field
  - [ ] Create/manage strategic plans
  - [ ] Active plan per workspace
  - [ ] Discovery accumulation (replaces Intel)
  - [ ] Auto-cleanup of stale plans
- [ ] **RecallTool** - Context restoration
  - [ ] Recent memory retrieval
  - [ ] Cross-tool context building
  - [ ] Timeline integration
- [ ] **ChronicleTool** - NEW decision tracking
  - [ ] Manual entry creation
  - [ ] Auto-entry from other tools
  - [ ] Chronological querying
  - [ ] Export capabilities
- [ ] **StandupTool** - Enhanced cross-tool summaries
  - [ ] Daily/weekly reports
  - [ ] Cross-workspace aggregation
  - [ ] Progress tracking
- [ ] **WorkspaceTool** - NEW active work management
  - [ ] Set/get active plan/todo
  - [ ] Workspace state validation
  - [ ] Cleanup orphaned work

### Phase 4: Behavioral Adoption ⏳
**Goal**: AI agents use tools correctly and consistently

#### Checklist:
- [ ] Create `goldfish-instructions.scriban` template
- [ ] Define tool priorities and comparisons
- [ ] Implement enforcement strategies:
  - [ ] Mandatory plan creation before coding
  - [ ] Active work state validation
  - [ ] TODO update requirements
  - [ ] Automatic cleanup triggers
- [ ] Add template variables for has_tool helpers
- [ ] Configure workflow enforcement level
- [ ] Test behavioral guidance in Claude Code

### Phase 5: Advanced Features ⏳
**Goal**: API sync, global workspace, performance optimization

#### Checklist:
- [ ] **Global Workspace Support**
  - [ ] Reserved `__global__` workspace ID
  - [ ] Cross-project TODO lists
  - [ ] Global plans and chronicles
- [ ] **API Sync Service**
  - [ ] `ISyncService` interface
  - [ ] Offline-first with queue
  - [ ] Conflict resolution
  - [ ] Authentication support
  - [ ] Configuration management
- [ ] **Response Optimization**
  - [ ] Token estimation service
  - [ ] Response builders following CodeSearch pattern
  - [ ] Resource storage for large results
  - [ ] Smart caching with eviction

### Phase 6: Migration & Testing ⏳
**Goal**: Complete migration from TypeScript with data preservation

#### Migration Tool:
- [ ] Create `COA.Goldfish.Migration` project
- [ ] Implement `JsonToSqliteMigrator`
- [ ] Preserve all existing data:
  - [ ] Checkpoints
  - [ ] TODO lists
  - [ ] Plans
  - [ ] Memories/Intel → Chronicle entries
- [ ] Data integrity validation
- [ ] Rollback capability

#### Testing:
- [ ] **Unit Tests** (NUnit)
  - [ ] All services
  - [ ] All tools
  - [ ] Data models
  - [ ] Migration logic
- [ ] **Integration Tests**
  - [ ] EF Core operations
  - [ ] MCP protocol compliance
  - [ ] Tool execution end-to-end
- [ ] **Performance Tests**
  - [ ] SQLite vs JSON performance
  - [ ] Memory usage
  - [ ] Response times
- [ ] **Migration Tests**
  - [ ] Data preservation
  - [ ] Schema compatibility
  - [ ] Rollback scenarios

### Phase 7: Deployment ⏳
**Goal**: Production-ready .NET global tool

#### Checklist:
- [ ] Configure as .NET global tool with `PackAsTool`
- [ ] Create NuGet package configuration
- [ ] Build installation scripts
- [ ] Update Claude Code MCP configuration
- [ ] Create user migration guide
- [ ] Performance benchmarking documentation
- [ ] Release notes and changelog

---

## 🏗️ Development Workflow

### Daily Development Process
1. **Reference Implementation**: Keep TypeScript version running for comparison
   ```bash
   npm run dev
   ```

2. **Build .NET Version**: Use watch mode for rapid iteration
   ```bash
   cd dotnet
   dotnet watch run --project src/COA.Goldfish.McpServer
   ```

3. **Validation**: Run both versions in parallel to compare outputs

### Testing Strategy
- **Test Isolation**: Use in-memory SQLite for unit tests
- **Shared Test Data**: Validate both implementations produce same results
- **Integration Testing**: Test against real Claude Code MCP client
- **Performance Benchmarking**: Measure improvements over TypeScript

---

## 🎯 Success Criteria

### Functional Requirements
- [ ] All existing Goldfish features working in .NET
- [ ] No data loss during migration
- [ ] Behavioral enforcement actually works (agents use tools correctly)
- [ ] Global workspace functionality
- [ ] Optional API sync capability

### Performance Requirements
- [ ] 10x improvement in data correlation speed
- [ ] Sub-100ms response times for common operations
- [ ] Memory usage under 100MB for typical workloads
- [ ] Startup time under 2 seconds

### Quality Requirements
- [ ] 95%+ test coverage
- [ ] All integration tests passing
- [ ] Migration validation successful
- [ ] Documentation complete
- [ ] Claude Code configuration working

---

## 🚨 Migration Risks & Mitigation

### High Risk Items
1. **Data Loss During Migration**
   - *Mitigation*: Comprehensive backup and rollback strategy
   - *Validation*: Test migration on copies of real data

2. **Behavioral Enforcement Not Working**
   - *Mitigation*: Extensive testing with real Claude Code usage
   - *Validation*: Measure stale todo/plan reduction

3. **Performance Regression**
   - *Mitigation*: Continuous benchmarking during development
   - *Validation*: Performance tests in CI pipeline

4. **MCP Protocol Incompatibility**
   - *Mitigation*: Start with simple tool and validate protocol early
   - *Validation*: Test with multiple MCP clients

---

## 📝 Notes & Discoveries

*This section will be updated during development with key learnings and decisions.*

### Architecture Decisions
- Using SQLite over LiteDB for better EF Core support
- Chronicle entries auto-created vs manual to reduce cognitive load
- Global workspace as convention (`__global__`) vs special logic

### Performance Insights
- *To be filled during benchmarking*

### Migration Challenges
- *To be documented as encountered*

---

## 🔗 References

- [COA MCP Framework Documentation](C:\source\COA MCP Framework\README.md)
- [CodeSearch MCP Implementation](C:\source\COA CodeSearch MCP)
- [Current TypeScript Implementation](./src/)
- [Existing JSON Data Structure](~/.coa/goldfish/)

---

**Last Updated**: 2025-01-09  
**Phase Status**: Planning Complete, Foundation Setup Ready  
**Next Milestone**: Basic MCP server running with EF Core