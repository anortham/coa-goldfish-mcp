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
- **`mcp__goldfish__search_history`** - Find past work with `query` parameter
- **`mcp__goldfish__timeline`** - Chronological view with `since` parameter
- **`mcp__goldfish__recall`** - Quick context restoration (no parameters needed)
- **`mcp__goldfish__list_workspaces`** - Show available workspaces

## CRITICAL TESTING INFO
**After making code changes, user must restart Claude Code before testing MCP tools.**

## Architecture Overview
- TypeScript/Node.js MCP server with workspace-aware JSON storage
- Automatic memory expiration (24h quick notes, 3d checkpoints)
- Cross-workspace querying for comprehensive reporting  
- Smart output modes (plain/emoji/json/dual) with environment detection
- All 274 tests passing across 23 test suites

## Core Development Principles
- Handle errors gracefully with helpful messages, never crash
- Use separate content blocks to prevent Claude Code output collapse
- Tool descriptions optimized for proactive AI agent usage
- TDD methodology for all bug fixes and feature development

## Claude Code Display Fix
Use separate content blocks to prevent output collapse:
```typescript
return {
  content: [
    { type: 'text', text: 'Header line' },
    { type: 'text', text: 'Item 1' },
    { type: 'text', text: 'Item 2' }
  ]
};
```

## Unified Tool Patterns (CURRENT ARCHITECTURE)

### Smart Parameter Defaults
All unified tools use intelligent defaults and action inference:
- **Action inference**: `checkpoint({ description: "..." })` automatically saves
- **Smart keywords**: `listId: "latest"`, `planId: "active"`, `since: "yesterday"`  
- **Auto-completion**: Most parameters are optional with sensible defaults
- **Environment adaptation**: Output format auto-detects CI/test/terminal environments

### Example Usage Patterns
```javascript
// Checkpoint (save/restore)
checkpoint({ description: "Fixed authentication bug" })  // auto-saves
checkpoint({ action: "restore" })  // restores latest

// TODO management
todo({ title: "Bug Fixes", items: ["Fix login", "Test API"] })  // auto-creates
todo({ listId: "latest", itemId: "1", status: "done" })  // updates
todo({ listId: "active", newTask: "Urgent fix" })  // adds to active list

// Planning
plan({ title: "User Auth", description: "OAuth2 implementation...", items: [...] })  // auto-saves
plan({ planId: "latest", action: "generate-todos" })  // creates TODO list

// Daily summaries  
standup({ action: "daily" })  // today's work
standup({ action: "weekly", scope: "all" })  // cross-workspace weekly
```

### Legacy Tools (DEPRECATED - Use unified tools above)
- ~~`remember()`~~ → Use `checkpoint()` for session state
- ~~`create_todo_list()`~~ → Use `todo()` with title/items
- ~~`update_todo()`~~ → Use `todo()` with listId/itemId  
- ~~`view_todos()`~~ → Use `todo()` with action="view"

### Memory Types
- **general**: Default working memory
- **todo**: Task tracking  
- **checkpoint**: Session snapshots
- **context**: Conversation context (used for agent handoffs)

### TODO List Special Keywords (NEW)
AI agents can use intuitive keywords instead of exact IDs when working with TODO lists:

**Supported Keywords for `listId` parameter:**
- `"latest"` / `"recent"` / `"last"` - Most recently updated TODO list
- `"active"` / `"current"` - Most recent list with pending tasks
- Partial ID match - Use suffix of actual ID (e.g., "5228" matches "20250831-171240-122-05E0-5228")

**Example Usage:**
```javascript
// Instead of finding exact ID
update_todo({ listId: "latest", itemId: "1", status: "done" })
view_todos({ listId: "latest" })

// Get the active list with pending work
update_todo({ listId: "active", newTask: "New urgent task" })
```

This feature reduces "TODO list not found" errors when AI agents make reasonable assumptions about which list to use.

## Agent Handoff System (Updated)

TDD agents use standardized tag patterns for reliable handoff between phases.

### Current Tag Pattern (FIXED)
**Store Handoff:**
```javascript
remember({
  content: JSON.stringify({
    fromAgent: 'test-designer',
    toAgent: 'test-implementer', 
    testSpecs: { /* technical details */ },
    summary: 'Brief human summary'
  }),
  type: 'context',
  tags: ['handoff', 'from-test-designer', 'to-test-implementer', 'tdd-workflow']
})
```

**Retrieve Handoff:**
```javascript
// Primary: Tag-based search (exact matching)
recall({
  type: 'context',
  tags: ['handoff', 'to-test-implementer'],
  limit: 5
})

// Fallback: Query-based search
recall({
  query: 'handoff test-designer',
  type: 'context',
  since: '24h'
})
```

### TDD Agent Chain
1. **test-designer** → stores with `['handoff', 'from-test-designer', 'to-test-implementer']`
2. **test-implementer** → retrieves with `['handoff', 'to-test-implementer']` → stores with `['handoff', 'from-test-implementer', 'to-refactoring-expert']`
3. **refactoring-expert** → retrieves with `['handoff', 'to-refactoring-expert']` → stores with `['handoff', 'from-refactoring-expert', 'to-test-reviewer']`
4. **test-reviewer** → retrieves with `['handoff', 'to-test-reviewer']`

## File Structure (Key Files)
```
src/
├── core/
│   ├── storage.ts          # Storage with test isolation support
│   ├── search.ts           # Search engine with tag filtering
│   └── session-manager.ts  # Session state management
├── tools/
│   ├── remember.ts         # Memory storage with tags
│   ├── search.ts           # Recall/search tools
│   ├── checkpoint.ts       # Session checkpoints
│   └── [todo tools]        # Task management
├── utils/
│   └── date-utils.ts       # Timezone-safe date utilities
├── types/
│   └── index.ts            # Type definitions with SearchOptions.tags[]
└── __tests__/
    ├── handoff-mechanism.test.ts  # 14 comprehensive handoff tests
    ├── date-utils.test.ts         # Date utility tests
    └── [other test suites]
```

## Development Commands
```bash
npm run dev          # Development with live reload
npm test            # Run all tests (should show 274+ passing)
npm run build       # TypeScript compilation
npm run lint        # ESLint checking
```

## Key Fixes Applied
- **Handoff Mechanism**: Tag-based search resolves agent communication issues
- **Date Handling**: Centralized utilities prevent timezone bugs in timeline
- **Test Isolation**: Storage constructor supports custom workspace/basePath
- **Storage Fallback**: Graceful handling of permission issues and test environments
- **TODO Keywords**: Intuitive "latest", "active" keywords reduce ID lookup errors
- **Smart Output Modes**: Environment-aware formatting (CI=plain, test=json, etc.)
- **Comprehensive Testing**: 23 test suites with 274 tests covering all scenarios

## Common Patterns

### Creating Tests with Isolation
```typescript
// Use custom workspace for test isolation
const storage = new Storage('test-workspace-name', '/tmp/test-goldfish');
```

### Storage Initialization Patterns
```typescript
// Production use - automatic fallback handling
const storage = new Storage();  // Uses workspace detection + home directory

// Custom workspace
const storage = new Storage('my-project');

// Full control for testing
const storage = new Storage('test-workspace', '/tmp/test-storage');

// Environment variable support
// Set COA_GOLDFISH_BASE_PATH="/custom/path" for global override
```

### Tag-Based Memory Search
```typescript
// Exact tag matching (all tags must be present)
const memories = await searchEngine.searchMemories({
  tags: ['handoff', 'to-specific-agent'],
  type: 'context'
});
```

### Error-Safe Date Operations
```typescript
import { getLocalDateKey, formatDateName } from '../utils/date-utils.js';

const dateKey = getLocalDateKey(timestamp); // "YYYY-MM-DD"
const displayName = formatDateName(new Date()); // "Today", "Yesterday", "Monday"
```

## Critical Notes
- Always use tag-based handoff patterns for TDD agents
- Test changes require Claude Code restart to reflect in MCP server
- Use centralized date utilities to prevent timezone bugs
- All tests should use isolated storage to prevent cross-test contamination
- Maintain backward compatibility - existing memories should continue to work