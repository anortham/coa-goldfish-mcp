# COA Goldfish MCP - AI Agent Instructions

## Testing Requirements
**CRITICAL**: After making code changes, user must restart Claude Code before testing MCP tools.

## Architecture Overview
- TypeScript/Node.js MCP server with JSON file storage
- Workspace-aware memory system (~/.coa/goldfish/memories/{workspace}/)
- 24h auto-expiration with max 50 memories per workspace
- Tag-based search with exact filtering support
- Centralized date utilities for timezone-safe operations

## Core Development Principles
- Handle errors gracefully, never crash
- Use separate content blocks to prevent Claude Code output collapse
- Optimize tool descriptions for proactive AI agent usage
- Support cross-workspace queries for standup-style reporting
- Use TDD methodology for all bug fixes and feature development

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

## Tool Usage for AI Agents

### Essential Tools
- `remember()` - Store temporary context with tags
- `create_todo_list()` - Structure tasks
- `update_todo()` - Track progress (supports "latest" keyword for listId)
- `checkpoint()` - Save session state
- `recall()` - Retrieve memories with tag filtering
- `view_todos()` - See active tasks (supports "latest" keyword for listId)
- `timeline()` - Cross-workspace reporting
- `search_history()` - Fuzzy search across checkpoints

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
npm test            # Run all tests (should show 187+ passing)
npm run build       # TypeScript compilation
npm run lint        # ESLint checking
```

## Key Fixes Applied
- **Handoff Mechanism**: Tag-based search resolves agent communication issues
- **Date Handling**: Centralized utilities prevent timezone bugs in timeline
- **Test Isolation**: Storage constructor supports custom workspace/basePath
- **Comprehensive Testing**: 14 handoff tests + 21 date utility tests

## Common Patterns

### Creating Tests with Isolation
```typescript
// Use custom workspace for test isolation
const storage = new Storage('test-workspace-name', '/tmp/test-goldfish');
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