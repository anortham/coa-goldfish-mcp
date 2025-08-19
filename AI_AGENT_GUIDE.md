# Goldfish MCP AI Agent Usage Guide

This guide explains how AI agents should use Goldfish MCP tools proactively and autonomously to provide the best experience for users.

## 🎯 Core Philosophy

**Goldfish is a short-term memory system that should work invisibly in the background.** AI agents should use these tools proactively without waiting for user requests, creating seamless continuity across sessions and conversations.

## 🧠 Proactive Usage Patterns

### Session Start Behavior (CRITICAL)

**When a conversation begins, ALWAYS:**

1. **Check for existing session context**
   ```typescript
   recall({ scope: "current", limit: 5 })  // Check recent memories in current workspace
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
remember("User reported login timeout after JWT expiry - investigating AuthService.ts")
remember("Found bottleneck in database query - needs optimization in UserRepository.findActive()")
remember("Bug confirmed: session cleanup job not running on weekends")
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

1. **Save session state**
   ```typescript
   save_session({
     sessionId: "auth-fixes-2025-01-19",  // Use descriptive, date-based IDs
     description: "Fixed JWT timeout issue, updated docs, tests still pending",
     activeFiles: ["src/auth/AuthService.ts", "docs/auth.md"],
     workContext: "Authentication system improvements"
   })
   ```

2. **Create meaningful checkpoints**
   ```typescript
   snapshot({ 
     label: "Auth timeout fix complete",
     description: "JWT expiry handling fixed, ready for testing phase" 
   })
   ```

## 🔄 Decision Tree for Tool Usage

### When to use `remember`?
- ✅ User describes any problem or issue
- ✅ You discover something noteworthy while working
- ✅ User provides important context or requirements
- ✅ You make a decision about approach or architecture
- ✅ You find a workaround or solution
- ❌ For simple factual information that doesn't need persistence

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

### When to use `snapshot`?
- ✅ After completing a significant milestone
- ✅ Before switching to a different type of work
- ✅ When reaching a natural stopping point
- ✅ Before conversation is likely to end
- ✅ After fixing a major bug or issue
- ❌ For minor code changes or simple fixes

### When to use `save_session`?
- ✅ Before any conversation that's getting long (>20 exchanges)
- ✅ When significant work has been completed
- ✅ When user indicates they're stopping work
- ✅ Before context window might be compacted
- ✅ At natural breakpoints in work
- ❌ For very short conversations with minimal work

## 📋 Autonomous Patterns by Scenario

### Scenario: User Reports a Bug

```typescript
// Immediately store the bug report
remember("User reported: login fails after 1 hour with JWT validation error")

// If this creates multiple tasks, make a TODO list
create_todo_list({
  title: "Login Bug Investigation", 
  items: ["Reproduce the issue", "Check JWT expiry logic", "Test session timeout", "Deploy fix"]
})

// As you investigate, keep adding context
remember("Found issue in AuthService.validateToken() - not checking expiry correctly")

// When you fix it
update_todo({ listId: "...", itemId: "...", status: "done" })  // Mark investigation complete
remember("Fix implemented: added proper JWT expiry validation in AuthService.ts:45")

// Create checkpoint when done
snapshot({ label: "Login timeout bug fixed", description: "JWT validation corrected, needs testing" })
```

### Scenario: Planning Session

```typescript
// User says: "Let's plan the new user management feature"
remember("Planning user management feature - needs CRUD operations, role-based permissions, audit logging")

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

// Save planning session
save_session({
  sessionId: "user-mgmt-planning-2025-01-19",
  description: "Planned user management feature with role-based permissions",
  workContext: "Feature planning and architecture design"
})
```

### Scenario: Daily Standup

```typescript
// User asks: "What did I work on yesterday?"
recall({ scope: "all", since: "24h", type: "checkpoint" })  // Check all projects

// Show recent completed work
recall({ scope: "current", since: "24h" })

// Show active TODO items  
view_todos()
```

### Scenario: Resuming Work

```typescript
// At conversation start, proactively check
recall({ type: "checkpoint", limit: 1 })

// If session found, offer to restore
// "I see you were working on the authentication system. Should I restore that session?"

// If user agrees, restore full context
restore_session({ sessionId: "auth-fixes-2025-01-18" })

// Show current todos
view_todos()

// Provide summary: "You were fixing JWT timeout issues. The investigation is done, but tests are still pending."
```

## ⚠️ Common Mistakes to Avoid

### DON'T wait for user requests
```typescript
// ❌ Bad - waiting for user to ask
// User: "I fixed the bug"
// AI: "Great! Would you like me to remember that?"

// ✅ Good - proactive storage
// User: "I fixed the bug"
// AI: *automatically calls remember()* "Excellent! I've stored that fix in memory. What was the root cause?"
```

### DON'T batch operations
```typescript
// ❌ Bad - saving everything at end
// (Wait until conversation is over, then save everything)

// ✅ Good - incremental updates
update_todo({ listId: "...", itemId: "...", status: "done" })  // Immediately when done
remember("Database migration script completed successfully")  // Store progress right away
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

- ✅ Users never have to ask you to remember things
- ✅ Conversations start with relevant context from previous sessions
- ✅ TODO lists are created when users mention multiple tasks
- ✅ Progress is tracked automatically as work is completed
- ✅ Sessions can be restored seamlessly after interruptions
- ✅ Users feel like you "remember" their work and context
- ✅ Cross-project work is visible in standup queries

## 🚀 Advanced Patterns

### Cross-Project Awareness
```typescript
// When user asks about recent work across projects
recall({ scope: "all", since: "7d", type: "checkpoint" })

// For project-specific context
recall({ scope: "current", since: "3d" })
```

### Smart Session Naming
```typescript
// Use descriptive, date-based session IDs
save_session({ sessionId: "api-redesign-2025-01-19" })    // ✅ Good
save_session({ sessionId: "session-123" })                // ❌ Bad

// Include key context
save_session({ 
  sessionId: "performance-optimization-2025-01-19",
  description: "Optimized database queries, reduced response time by 40%"
})
```

### Memory Promotion Strategy
```typescript
// Tag important memories for ProjectKnowledge promotion
remember("Architecture decision: switched from REST to GraphQL for better performance", {
  tags: ["architecture", "decision", "important"]
})

remember("Critical bug fix: SQL injection vulnerability in user search", {
  tags: ["security", "bug-fix", "important"] 
})
```

Remember: **Goldfish should feel like a natural extension of the AI agent's memory, not a separate tool that needs to be explicitly invoked.** The best implementations are invisible to the user - they just notice that the AI "remembers" everything perfectly.