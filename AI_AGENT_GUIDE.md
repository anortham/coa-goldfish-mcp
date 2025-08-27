# Goldfish MCP AI Agent Usage Guide v2.1

This guide explains how AI agents should use Goldfish MCP tools proactively and autonomously to provide the best experience for users.

## 🎯 Core Philosophy

**Goldfish is a short-term memory system that should work invisibly in the background.** AI agents should use these tools proactively without waiting for user requests, creating seamless continuity across sessions and conversations.

## 🌍 Workspace Flexibility (New in v2.1)

**All Goldfish tools now accept workspace parameters in any format:**

- **Full paths**: `"C:\\source\\My Project"`, `"/Users/dev/my-project"`
- **Simple names**: `"my-project"`, `"coa-goldfish-mcp"`
- **Any case**: `"MyProject"`, `"MYPROJECT"`, `"myproject"`
- **Mixed formats**: Tools automatically normalize to consistent storage

This ensures external AI agents (like GPT models) can use any workspace format without coordination issues. The system automatically maps different representations to the same underlying workspace.

## 🧠 Proactive Usage Patterns

### Session Start Behavior (CRITICAL)

**When a conversation begins, ALWAYS:**

1. **Check for existing session context**
   ```typescript
   recall({ scope: "current", limit: 5 })  // Check recent checkpoints in current workspace
   ```

2. **Look for session continuity**
   ```typescript 
   recall({ type: "checkpoint", limit: 1 })  // Find most recent checkpoint
   // If found, ask user: "I see you were working on X. Should I restore that session?"
   ```

3. **Check active work items**
   ```typescript
   view_todos()  // Show current TODO lists and progress
   ```

### During Work (ESSENTIAL)

**Store context immediately when:**
- User describes a problem or issue
- You discover something important
- User mentions multiple tasks or a plan
- You complete a significant piece of work
- User provides important information

```typescript
// ALWAYS store context - don't wait to be asked
checkpoint({ description: "User reported login timeout after JWT expiry - investigating AuthService.ts" })
checkpoint({ description: "Found bottleneck in database query - needs optimization in UserRepository.findActive()" })
checkpoint({ description: "Bug confirmed: session cleanup job not running on weekends" })
```

**Create TODO lists when users mention multiple tasks:**
```typescript
// User says: "I need to fix the login bug, update the docs, and add tests"
create_todo_list({
  title: "Login System Updates",
  items: ["Fix login timeout bug", "Update authentication documentation", "Add comprehensive auth tests"]
})
```

**Update task status as work progresses:**
```typescript
// As soon as you complete something
update_todo({ listId: "...", itemId: "...", status: "done" })
```

### Session End Behavior (MANDATORY)

**Before conversation ends or gets long, ALWAYS:**

1. **Create comprehensive checkpoint**
   ```typescript
   checkpoint({
     description: "Fixed JWT timeout issue, updated docs, tests still pending",
     sessionId: "auth-fixes-2025-01-19",  // Use descriptive, date-based IDs
     activeFiles: ["src/auth/AuthService.ts", "docs/auth.md"],
     workContext: "Authentication system improvements",
     highlights: ["JWT validation fixed", "Documentation updated"]
   })
   ```

2. **Ensure session continuity**
   ```typescript
   // The checkpoint above handles both session state AND progress capture
   // No separate save_session or snapshot calls needed
   ```

## 🔄 Decision Tree for Tool Usage

### When to use `checkpoint`?
- ✅ User describes any problem or issue
- ✅ You discover something noteworthy while working
- ✅ User provides important context or requirements
- ✅ You make a decision about approach or architecture
- ✅ You find a workaround or solution
- ✅ After completing a significant milestone
- ✅ Before switching to a different type of work
- ✅ When reaching a natural stopping point
- ✅ Before conversation is likely to end
- ✅ After fixing a major bug or issue
- ❌ For simple factual information that doesn't need persistence
- ❌ For minor code changes or simple fixes

### When to use `recall`?
- ✅ At the start of every conversation 
- ✅ When user asks "what was I working on?"
- ✅ When user asks about recent work or progress
- ✅ When you need context to answer a question
- ✅ For daily standup-type queries
- ❌ For general knowledge questions

### When to use `create_todo_list`?
- ✅ User lists multiple tasks (2 or more)
- ✅ User describes a multi-step plan
- ✅ User says "I need to..." with multiple items
- ✅ During project planning discussions
- ❌ For single, simple tasks

### When to use `search_history`?
- ✅ When user asks about past work with specific keywords
- ✅ For "Did we fix the auth bug?" type questions
- ✅ When you need to find context from previous sessions
- ✅ For researching similar problems solved before
- ❌ For recent work (use recall instead)

### When to use `timeline`?
- ✅ For standup meetings and progress reports
- ✅ When user asks "what did I work on this week?"
- ✅ For cross-project activity summaries
- ✅ When resuming work after time away
- ❌ For detailed task tracking (use view_todos instead)

### When to use `list_workspaces`?
- ✅ When user asks about available projects or workspaces
- ✅ When external agents need to discover workspace names
- ✅ During workspace switching or project navigation
- ✅ For debugging workspace-related issues
- ❌ For routine operations (workspace auto-detected from context)

## 📋 Autonomous Patterns by Scenario

### Scenario: User Reports a Bug

```typescript
// Immediately create checkpoint with bug report
checkpoint({ description: "User reported: login fails after 1 hour with JWT validation error" })

// If this creates multiple tasks, make a TODO list
create_todo_list({
  title: "Login Bug Investigation", 
  items: ["Reproduce the issue", "Check JWT expiry logic", "Test session timeout", "Deploy fix"]
})

// As you investigate, keep adding context
checkpoint({ 
  description: "Found issue in AuthService.validateToken() - not checking expiry correctly",
  activeFiles: ["src/auth/AuthService.ts"]
})

// When you fix it
update_todo({ listId: "...", itemId: "...", status: "done" })  // Mark investigation complete
checkpoint({ 
  description: "Login timeout bug fixed - JWT validation corrected",
  highlights: ["Fixed JWT expiry validation in AuthService.ts:45"],
  activeFiles: ["src/auth/AuthService.ts"],
  workContext: "Bug fix ready for testing"
})
```

### Scenario: Planning Session

```typescript
// User says: "Let's plan the new user management feature"
checkpoint({ 
  description: "Planning user management feature - needs CRUD operations, role-based permissions, audit logging",
  workContext: "Feature planning and architecture design"
})

// As requirements emerge, create structured TODO
create_todo_list({
  title: "User Management Feature",
  items: [
    "Design user model with role hierarchy",
    "Create user CRUD operations", 
    "Implement role-based permissions middleware",
    "Add audit logging for user actions",
    "Create admin dashboard for user management",
    "Write comprehensive tests"
  ]
})

// Save comprehensive planning checkpoint
checkpoint({
  description: "Completed planning for user management feature",
  sessionId: "user-mgmt-planning-2025-01-19",
  highlights: ["Defined role hierarchy", "Created implementation roadmap", "Identified 6 major tasks"],
  workContext: "Feature planning complete - ready for implementation"
})
```

### Scenario: Daily Standup

```typescript
// User asks: "What did I work on yesterday?"
timeline({ scope: "all", since: "24h" })  // Show work across all projects

// For more detailed search if needed
search_history({ query: "completed OR fixed OR implemented", since: "24h" })

// Show active TODO items  
view_todos({ scope: "all" })
```

### Scenario: Resuming Work

```typescript
// At conversation start, proactively check
recall({ type: "checkpoint", limit: 1 })

// If session found, offer to restore
// "I see you were working on the authentication system. Should I restore that session?"

// If user agrees, restore full context
restore_session({ sessionId: "auth-fixes-2025-01-18", depth: "highlights" })

// Show current todos
view_todos()

// Provide summary: "You were fixing JWT timeout issues. The investigation is done, but tests are still pending."
```

### Scenario: Workspace Discovery

```typescript
// When user asks about projects or workspaces
list_workspaces()  // Returns: ["coa-goldfish-mcp", "my-api-project", "mobile-app"]

// Show work across specific workspace using any format
timeline({ workspace: "my-api-project", since: "7d" })        // Simple name
timeline({ workspace: "C:\\source\\My API Project", since: "7d" })  // Full path
timeline({ workspace: "MyAPIProject", since: "7d" })         // Any case

// All these map to the same normalized workspace: "my-api-project"
```

## ⚠️ Common Mistakes to Avoid

### DON'T wait for user requests
```typescript
// ❌ Bad - waiting for user to ask
// User: "I fixed the bug"
// AI: "Great! Would you like me to remember that?"

// ✅ Good - proactive storage
// User: "I fixed the bug"
// AI: *automatically calls checkpoint()* "Excellent! I've stored that fix. What was the root cause?"
```

### DON'T batch operations
```typescript
// ❌ Bad - saving everything at end
// (Wait until conversation is over, then save everything)

// ✅ Good - incremental updates
update_todo({ listId: "...", itemId: "...", status: "done" })  // Immediately when done
checkpoint({ description: "Database migration script completed successfully" })  // Store progress right away
```

### DON'T ignore session continuity
```typescript
// ❌ Bad - starting fresh every time
// User: "Let's continue working"
// AI: "What would you like to work on?"

// ✅ Good - check for previous context
recall({ type: "checkpoint", limit: 1 })
view_todos()
// AI: "I see you were working on the authentication system. Your TODO list shows tests are still pending. Should we continue with that?"
```

## 🎯 Success Metrics

You're using Goldfish correctly when:

- ✅ Users never have to ask you to create checkpoints
- ✅ Conversations start with relevant context from previous sessions
- ✅ TODO lists are created when users mention multiple tasks
- ✅ Progress is tracked automatically as work is completed
- ✅ Sessions can be restored seamlessly after interruptions
- ✅ Users feel like you "remember" their work and context
- ✅ Cross-project work is visible in timeline queries

## 🚀 Advanced Patterns

### Cross-Project Awareness
```typescript
// When user asks about recent work across projects
timeline({ scope: "all", since: "7d" })

// For detailed cross-project search
search_history({ query: "completed OR implemented", scope: "all", since: "7d" })

// For project-specific context
recall({ scope: "current", since: "3d" })

// For specific workspace context (workspace parameter accepts any format)
recall({ workspace: "my-api-project", since: "3d" })          // Simple name
recall({ workspace: "C:\\source\\My Project", since: "3d" })   // Full path
recall({ workspace: "MyProject", since: "3d" })               // Any case

// List available workspaces for user
list_workspaces()  // Shows all normalized workspace names
```

### Smart Session Naming
```typescript
// Use descriptive, date-based session IDs
checkpoint({ sessionId: "api-redesign-2025-01-19", description: "..." })    // ✅ Good
checkpoint({ sessionId: "session-123", description: "..." })                // ❌ Bad

// Include key context
checkpoint({ 
  sessionId: "performance-optimization-2025-01-19",
  description: "Optimized database queries, reduced response time by 40%",
  highlights: ["Database optimization complete", "40% performance improvement"]
})
```

### Comprehensive Checkpoints
```typescript
// Capture rich context in checkpoints
checkpoint({
  description: "Architecture decision: switched from REST to GraphQL for better performance",
  highlights: ["GraphQL migration complete", "Performance improved significantly"],
  activeFiles: ["src/api/graphql/schema.ts", "docs/api-migration.md"],
  workContext: "API architecture redesign"
})

checkpoint({
  description: "Critical security fix: SQL injection vulnerability in user search",
  highlights: ["Security vulnerability patched", "User search sanitized"],
  activeFiles: ["src/search/UserSearchService.ts"],
  workContext: "Security patch - high priority"
})
```

## 📝 Tool Reference Quick Guide

### Core Tools
- `checkpoint()` - Save progress with rich context (replaces old remember/save_session/snapshot)
- `create_todo_list()` - Structure tasks
- `update_todo()` - Track progress
- `view_todos()` - See active tasks
- `recall()` - Retrieve memories with tag filtering
- `search_history()` - Fuzzy search across checkpoints
- `timeline()` - Cross-workspace reporting
- `restore_session()` - Restore session state
- `summarize_session()` - AI-condensed summaries
- `list_workspaces()` - Discover available workspaces for external agents

### Essential Parameters
- `checkpoint()`: `description` (required), `highlights[]`, `activeFiles[]`, `sessionId`, `workContext`, `workspace`
- `recall()`: `query`, `since`, `scope`, `type`, `tags[]`, `limit`, `workspace`
- `timeline()`: `since`, `scope`, `workspace`
- `search_history()`: `query` (required), `since`, `scope`, `limit`, `workspace`
- `create_todo_list()`: `title` (required), `items[]` (required), `workspace`
- `update_todo()`: `listId`, `itemId`, `status`, `newTask`, `workspace`
- `view_todos()`: `listId`, `scope`, `workspace`
- `list_workspaces()`: (no parameters - returns all available workspaces)

**Note**: All `workspace` parameters accept any format - full paths, simple names, or mixed case. The system automatically normalizes them for consistent storage.

Remember: **Goldfish should feel like a natural extension of the AI agent's memory, not a separate tool that needs to be explicitly invoked.** The best implementations are invisible to the user - they just notice that the AI "remembers" everything perfectly.