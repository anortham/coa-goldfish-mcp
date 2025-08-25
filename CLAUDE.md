# COA Goldfish MCP - Developer Instructions

## ⚠️ IMPORTANT: Testing Changes
**CRITICAL**: After making code changes, user must restart Claude Code before testing MCP tools. Changes to TypeScript files are not reflected in the running MCP server until restart.

## Core Architecture
- **TypeScript/Node.js** project with MCP SDK
- **JSON file storage** - no database overhead
- **Workspace-aware** - follows COA pattern like CodeSearch
- **Auto-expiration** - memories expire after 24h (configurable)

## Development Guidelines

### Testing Framework
- Use **Jest** for testing
- Use `npm test` to run tests
- Use `npm run dev` for development with live reload

### Build Process
```bash
# Development
npm run dev          # Run with tsx (live reload)

# Production  
npm run build        # TypeScript compilation
npm start           # Run built version

# Testing
npm test            # Run Jest tests
npm run lint        # ESLint checking
```

### Code Standards
- **TypeScript strict mode** enabled
- **ESM modules** - use import/export syntax
- **Error handling** - graceful failures, never crash
- **Workspace detection** - auto-detect from git root or directory name

### Storage Pattern
- **~/.coa/goldfish/memories/{workspace}/** - per-workspace storage
- **~/.coa/goldfish/memories/global/** - cross-project memories
- **JSON files** named with chronological IDs (YYYYMMDDHHMMSS-RANDOM)
- **Auto-cleanup** - max 50 memories per workspace

### MCP Tool Development
- All tools inherit from standard MCP patterns
- Tool descriptions optimized for **proactive AI agent usage**
- Include trigger words like "ALWAYS", "Proactively", "Immediately" 
- Clear parameter schemas with comprehensive validation
- Handle errors gracefully with user-friendly messages
- Extensive test coverage for all tool handlers

### Memory Management Rules
- **24h default TTL** - memories expire automatically
- **Workspace isolation** - each project gets own memory space
- **Cross-workspace queries** - support for standup-style reporting
- **Chronological sorting** - newest memories first

### Integration Points
- **ProjectKnowledge MCP** - for long-term knowledge storage via federation API
- **Custom Commands** - `/checkpoint` and `/resume` for structured workflows
- **Claude Code Integration** - seamless MCP tool usage with display fixes

### Claude Code Display Solutions
**Critical Fix**: MCP tool outputs were being collapsed in Claude Code CLI. Solution implemented:

#### Separate Content Blocks Strategy
```typescript
// Problem: Large text blocks get collapsed in Claude Code
// Solution: Return multiple separate content blocks

return {
  content: [
    { type: 'text', text: 'Header line' },
    { type: 'text', text: 'Item 1' },
    { type: 'text', text: 'Item 2' },
    // Each item as separate block prevents collapse
  ]
};
```

#### /resume Command Enhancement
- Added `hide-output: true` directive to prevent duplicate output display
- Tool responses hidden, only formatted output shown
- Eliminates confusion from raw tool output + formatted output

#### TODO System Display
- **Single-list focus**: Shows most recently updated list only
- **ID-based ordering**: Tasks display in numerical order (1,2,3,4,5...)
- **Separate content blocks**: Each todo item as individual content block
- **Clean status icons**: ✅ done, 🔄 active, ⏳ pending

### Workspace Resolution
Uses same pattern as ProjectKnowledge:
1. Try git root detection first
2. Fall back to current directory name
3. Normalize to lowercase-with-hyphens
4. Store per workspace like CodeSearch indexes

### Tool Usage Patterns

#### For Development Work
```typescript
// Store temporary context
remember("Working on MCP tool refactor - updated schema validation")

// Create structured TODO lists
create_todo_list({ 
  title: "Feature Implementation", 
  items: ["Add validation", "Write tests", "Update docs"] 
})

// Update tasks as you work
update_todo({ listId: "...", itemId: "1", status: "done" })

// Create checkpoints
checkpoint({ description: "Tool refactor complete" })
```

#### For Standups
```typescript
// See yesterday's work across all projects
timeline({ scope: "all", since: "24h" })

// Current project status
view_todos()  // See active todo list with clean display
```

#### For Session Continuity
```typescript
// Before ending session
checkpoint({ description: "End of day - completed tool schema, ready for testing" })

// Next session - use the /resume command
// This will automatically restore session + show todos + timeline
```

#### Enhanced TODO System
```typescript
// The TODO system now supports full CRUD operations with MULTI-LIST VISIBILITY:

// Create new lists
create_todo_list({ title: "Bug Fixes", items: ["Fix auth", "Update tests"] })

// View ALL active lists (FIXED: No more disappearing lists!)
view_todos()  // Shows ALL todo lists with summary and progress

// View specific list details
view_todos({ listId: "20250825-121102-401-190D" })  // Shows detailed view of specific list

// Update task descriptions
update_todo({ listId: "...", itemId: "2", newTask: "Updated task description" })

// Mark as active/done
update_todo({ listId: "...", itemId: "2", status: "active" })

// Delete unwanted tasks
update_todo({ listId: "...", itemId: "3", delete: true })
```

#### Multi-List Display Format
```
📋 Active TODO Lists (2 found)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ COA Goldfish MCP Codebase Audit - Critical Issues Found
   ID: 20250825-121102-401-190D
   📊 20% (2/10) • 8 pending tasks
   
2️⃣ TDD Security & Architecture Fixes  
   ID: 20250825-123218-389-6379
   📊 100% (10/10) • ✅ Complete

💡 Use view_todos({ listId: "..." }) to see specific list details
```

### Error Handling Philosophy
- **Never crash** - always return graceful error messages
- **Self-healing** - auto-remove corrupted files
- **Informative** - tell user what went wrong and how to fix
- **Workspace-aware** - show which workspace had the issue

### Performance Guidelines
- **Lazy loading** - only read files when needed
- **Smart filtering** - filter after loading for better UX
- **Async operations** - use proper async/await patterns
- **Memory limits** - enforce per-workspace limits

### Development Workflow
1. Make changes to TypeScript files
2. Test with `npm run dev`
3. Run tests with `npm test`
4. Build with `npm run build`
5. Test built version with `npm start`

### Integration Testing
Test with ProjectKnowledge MCP:
1. Start both MCP servers
2. Use hooks to trigger automatic memory storage
3. Verify cross-workspace queries work
4. Test standup scenarios

### Memory Types
- **general**: Default working memory
- **todo**: Task tracking
- **checkpoint**: Session snapshots
- **context**: Conversation context

### Deployment
- **Global installation**: `npm install -g .`
- **Local development**: `npm run dev`
- **Production**: `npm start`

## File Structure
```
COA Goldfish MCP/
├── src/
│   ├── core/                    # Core functionality modules
│   │   ├── storage.ts          # JSON file storage and workspace detection
│   │   ├── session-manager.ts  # Session state management
│   │   └── search.ts           # Memory search and filtering
│   ├── tools/                  # MCP tool implementations (one per file)
│   │   ├── checkpoint.ts       # Checkpoint and snapshot tools
│   │   ├── session.ts          # Session management tools
│   │   ├── search.ts           # Memory recall and search tools
│   │   ├── remember.ts         # Simple memory storage tool
│   │   ├── create-todo-list.ts # Create new TODO lists
│   │   ├── view-todos.ts       # View TODO lists (multi-list support)
│   │   └── update-todo.ts      # Update TODO list items
│   ├── types/                  # TypeScript type definitions
│   │   └── index.ts            # Shared interfaces and types
│   ├── __tests__/              # Comprehensive test suite
│   │   ├── core.test.ts        # Core functionality tests
│   │   ├── tools.test.ts       # Tool handler tests
│   │   ├── integration.test.ts # Integration workflows
│   │   └── edge-cases.test.ts  # Error handling tests
│   └── index.ts                # Main MCP server entry point
├── .claude/                    # Claude Code integration
│   ├── commands/               # Custom slash commands
│   │   ├── checkpoint.md       # /checkpoint command
│   │   └── resume.md          # /resume command (with hide-output)
│   ├── hooks/                  # Automation hooks (PS1 & Python)
│   │   ├── session_start.*    # Auto-restore on session start
│   │   ├── user_prompt_submit.*# Auto-checkpoint on prompts
│   │   ├── pre_compact.*      # Save before context clearing
│   │   └── post_commit.*      # Save after git commits
│   └── settings.local.json    # MCP server configuration
├── dist/                      # Compiled JavaScript output
├── package.json              # Dependencies and build scripts
├── tsconfig.json             # TypeScript configuration
├── jest.config.js            # Jest test configuration
├── eslint.config.js          # ESLint configuration
├── README.md                 # User documentation with AI agent patterns
└── AI_AGENT_GUIDE.md         # Proactive usage guide for AI agents
```

## Common Tasks

### Adding New Memory Types
1. Update the enum in tool schemas
2. Add appropriate icons in recall output
3. Update README examples
4. Add tests for new type

### Workspace Debugging
- Check `~/.coa/goldfish/memories/` for actual files
- Verify workspace detection with `process.cwd()` and git root
- Use scope: "all" to see cross-workspace memories

### Performance Optimization
- Monitor file counts per workspace (max 50)
- Check memory cleanup frequency
- Profile cross-workspace queries for large datasets

## Testing Checklist

### Core Functionality
- [x] Workspace detection works (git and non-git) - `core.test.ts`
- [x] Memory storage and retrieval - `core.test.ts` 
- [x] Cross-workspace queries - `integration.test.ts`
- [x] Auto-expiration and cleanup - `integration.test.ts`
- [x] Error handling for corrupted files - `edge-cases.test.ts`
- [x] Time filtering (since parameter) - `tools.test.ts`
- [x] Global vs workspace-specific memories - `integration.test.ts`
- [x] All 10 tool handlers - `tools.test.ts`
- [x] Session save/restore workflows - `integration.test.ts`
- [x] ProjectKnowledge promotion logic - `integration.test.ts`
- [x] Concurrent operations handling - `edge-cases.test.ts`
- [x] Network failure resilience - `edge-cases.test.ts`

### Enhanced TODO System Tests
- [x] Single-list display with most recently updated - `tools.test.ts`
- [x] ID-based sorting regardless of status - `tools.test.ts`
- [x] Separate content blocks format - `tools.test.ts`
- [x] Task description editing functionality - `tools.test.ts`
- [x] Delete task functionality - `tools.test.ts`
- [x] Simultaneous task + status updates - `tools.test.ts`
- [x] Update vs create prioritization logic - `tools.test.ts`
- [x] Change tracking for user feedback - `tools.test.ts`
- [x] Empty todo list handling - `tools.test.ts`
- [x] Long task description truncation - `tools.test.ts`
- [x] Status icon consistency - `tools.test.ts`

### Test Coverage Summary
- **51 total tests** (50 passing, 1 skipped)
- **4 test suites**: core, tools, integration, edge-cases
- **Zero failing tests** - all functionality validated
- **Comprehensive coverage** of all major features and edge cases

Run tests with: `npm test`