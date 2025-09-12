# COA Goldfish MCP - AI Agent Instructions

## QUICK START FOR AI AGENTS

### Essential Actions
1. **Always use unified tools first**: `checkpoint`, `todo`, `plan`, `standup`
2. **Smart keywords work everywhere**: `"latest"`, `"active"`, `"current"` for listId/planId
3. **Proactively checkpoint after completing tasks**: Save progress automatically
4. **Plan before implementing complex features**: Use `plan` tool to design approach first

### Core Unified Tools (USE THESE FIRST)
- **`mcp__goldfish__checkpoint`** - Save/restore session state. Use `action="save"` with description, `action="restore"` to resume work
- **`mcp__goldfish__todo`** - Complete task management. Use `action="create"` for new lists, `action="view"` to see tasks, `action="update"` to modify
- **`mcp__goldfish__plan`** - Strategic planning and feature design. Use `action="save"` for new plans, `action="generate-todos"` to create task lists
- **`mcp__goldfish__standup`** - Daily/weekly summaries. Use `action="daily"` for recent work, `scope="all"` for cross-workspace reports

### Support Tools (Secondary)
- **`mcp__goldfish__search`** - Full-text search across all entities with FTS5 
- **`mcp__goldfish__recall`** - Quick context restoration (no parameters needed)
- **`mcp__goldfish__chronicle`** - Decision and progress tracking
- **`mcp__goldfish__workspace`** - Workspace management and switching

## CRITICAL TESTING INFO
**After making code changes, user must restart Claude Code before testing MCP tools.**

## Core Development Principles
- Handle errors gracefully with helpful messages, never crash
- Use separate content blocks to prevent Claude Code output collapse
- TDD methodology for all bug fixes and feature development using NUnit

## Smart Parameter Usage

### TODO List Keywords
AI agents can use intuitive keywords for `listId` parameter:
- `"latest"` / `"recent"` / `"last"` - Most recently updated TODO list
- `"active"` / `"current"` - Most recent list with pending tasks
- Partial ID match - Use suffix of actual ID for easy identification

### Plan Keywords  
Similar keywords work for `planId` parameter:
- `"latest"` / `"active"` / `"current"` - Smart resolution to most relevant plan

### Action Inference
Tools automatically infer actions based on parameters:
- `checkpoint({ description: "..." })` automatically saves
- `todo({ title: "...", items: [...] })` automatically creates new list
- `plan({ title: "...", description: "..." })` automatically creates new plan

## AI Agent Workflow Patterns

### Session Management
1. **Start of session**: Use `mcp__goldfish__recall` or `mcp__goldfish__checkpoint` with `action="restore"`
2. **During work**: Save checkpoints after completing significant tasks
3. **End of session**: Always checkpoint current state before finishing

### Complex Feature Development
1. **Plan first**: Use `mcp__goldfish__plan` to design approach and identify requirements
2. **Generate TODOs**: Create task list from plan using `action="generate-todos"`
3. **Track progress**: Update TODOs as work progresses
4. **Record decisions**: Use `mcp__goldfish__chronicle` for important technical decisions

### Daily Workflow Integration
- **Morning**: `mcp__goldfish__recall` to restore context from previous session
- **Throughout day**: Update active TODO list with progress
- **End of day**: `mcp__goldfish__checkpoint` to save session state
- **Weekly**: `mcp__goldfish__standup` for progress reporting

## Key Development Reminders
- **Always use Debug builds** when MCP server is running - Release mode locks executables
- **NUnit for testing** (not XUnit) with proper async/await patterns
- **Entity Framework Core** with SQLite backend for all data persistence
- **Cross-workspace support** via `__global__` workspace identifier