# Goldfish MCP Storage Architecture Redesign - August 2025

## Problem Statement

During analysis of outstanding todos (17 lists showing but 78 files in storage), we discovered significant scope creep and architectural issues in the storage system.

### Current Issues Identified

1. **File Explosion**: 78 files in `/todos/` directory but only 17 actual TodoLists
2. **Mixed Storage**: Same directory contains:
   - TodoList objects (structured task lists) 
   - Memory objects type "general" (quick notes)
   - Memory objects type "todo" (confusing - NOT TodoLists!)
   - Memory objects type "context" (agent handoffs)
3. **No Expiration**: TodoLists never expire, accumulating forever
4. **Scope Creep**: Started with 2 clean types, now has 4+ with unclear boundaries
5. **Search Complexity**: Fuse.js must handle multiple document types with different structures
6. **Test Pollution**: Test runs created 40+ permanent handoff files in production storage

### Original Clean Vision

The project started with **event sourcing principles**:
- **Checkpoints** - Important session snapshots for recreating state
- **TodoLists** - Structured task tracking for developer organization

Simple, clear, focused.

## New Simplified Architecture

### Core Types (Only 2!)

1. **Checkpoints** - Event sourcing snapshots (keep as-is)
   - Stored in date folders: `/checkpoints/YYYY-MM-DD/`
   - 72-hour TTL
   - Structured session data with highlights

2. **TodoLists** - Enhanced structured task lists
   - Stored as individual files: `/todos/{id}.json`
   - Optional TTL with lifecycle management
   - Enhanced with metadata and description fields

### Enhanced TodoList Interface

```typescript
interface TodoList {
  id: string;                    // Existing
  title: string;                 // Existing
  description?: string;          // NEW - For context/handoff data
  metadata?: Record<string, any>; // NEW - Flexible data storage
  workspace: string;             // Existing
  items: TodoItem[];             // Existing
  createdAt: Date;               // Existing
  updatedAt: Date;               // Existing
  completedAt?: Date;            // NEW - When marked complete
  status?: 'active' | 'completed' | 'archived';  // NEW - Lifecycle
  ttlHours?: number;             // NEW - Optional expiration
  sessionId?: string;            // Existing
  tags?: string[];               // Existing
}
```

### Storage Structure

```
~/.coa/goldfish/
├── global/
│   ├── checkpoints/YYYY-MM-DD/     # Cross-project milestones
│   └── todos/                      # Cross-project TodoLists
└── {workspace}/
    ├── checkpoints/YYYY-MM-DD/     # Project snapshots  
    └── todos/                      # Project TodoLists only
```

### What Gets Eliminated

- **Memory type "general"** - Use TodoList with single item instead
- **Memory type "todo"** - Confusing, just use actual TodoLists
- **Memory type "context"** - Use TodoList metadata field
- **Special inbox lists** - Users create what they need
- **Daily lists** - Sounds neat, creates cleanup burden
- **Mixed storage** - Clean separation

## Use Cases Covered by New Design

### Agent Handoffs
Instead of context memories:
```typescript
{
  title: "TDD Handoff: test-designer → test-implementer",
  description: "Fix failing date handling tests",
  metadata: {
    fromAgent: "test-designer",
    toAgent: "test-implementer", 
    testResults: {...},
    suggestedFixes: [...]
  },
  items: [
    { task: "Fix timezone bug in getLocalDateKey", status: "pending" },
    { task: "Update tests to use new date utilities", status: "pending" }
  ],
  ttlHours: 24  // Auto-cleanup
}
```

### Quick Notes
Instead of general memories:
```typescript
{
  title: "Quick Notes - Aug 26",
  items: [
    { task: "Remember to review PR #123", status: "pending" },
    { task: "Ask team about API breaking changes", status: "pending" }
  ],
  ttlHours: 168  // Week expiration
}
```

### Cross-Project Reminders
```typescript
// In global workspace
{
  title: "Framework Updates",
  description: "Keep all MCP projects in sync",
  items: [
    { task: "Update COA CodeNav to v2.1", status: "done" },
    { task: "Update COA Goldfish to v2.1", status: "pending" }
  ]
}
```

## Search Benefits

### Simplified Fuse.js Configuration
Only 2 document types instead of 5+:
- **Checkpoints** - Search for "what did I accomplish?"
- **TodoLists** - Search for "what needs doing?"

### Cleaner Relevance Scoring
```typescript
// Checkpoints: weight description + highlights
// TodoLists: weight title + description + item tasks
```

### Scope Management
```typescript
// Current workspace active work
view_todos({ scope: 'current', status: 'active' })

// Cross-workspace search  
search_history({ scope: 'all', query: 'API changes' })
```

## Migration Strategy

### Phase 1: Stop the Bleeding
1. **Test Isolation** - Prevent future test pollution
2. **Clean existing files** - Remove test artifacts
3. **Add new fields** - Extend TodoList interface

### Phase 2: Enhance TodoLists
1. **Add lifecycle management** - status, completedAt, ttlHours
2. **Add metadata support** - description, metadata fields
3. **Implement auto-completion** - When all items done

### Phase 3: Remove Memory Types
1. **Migrate existing memories** - Convert to TodoLists where valuable
2. **Remove memory tools** - Eliminate remember() tool
3. **Simplify storage** - Remove memory handling code

### Phase 4: Cleanup Tools
1. **Auto-archive completed** - TodoLists after 30 days
2. **Stale detection** - Warn about lists with no updates
3. **Bulk operations** - Delete old archived lists

## Lifecycle Management

### Auto-Completion
```typescript
// Mark complete when all items done
if (todolist.items.every(item => item.status === 'done')) {
  todolist.status = 'completed';
  todolist.completedAt = new Date();
}
```

### Cleanup Rules
- **Active lists**: No expiration unless ttlHours set
- **Completed lists**: Archive after 30 days, delete after 90 days
- **Agent handoffs**: 24-48 hour TTL
- **Temporary notes**: 7-day TTL

## Expected Outcomes

1. **Reduced Complexity** - 2 types instead of 4+
2. **Cleaner Storage** - 17 TodoLists instead of 78 mixed files
3. **Better Search** - Focused document types, better relevance
4. **Easier Maintenance** - Clear lifecycle rules
5. **Flexible Extension** - Metadata field handles edge cases
6. **True Event Sourcing** - Back to original clean vision

## Decision Record

**Date**: August 26, 2025
**Participants**: User analysis and architecture review
**Decision**: Simplify to 2-type architecture (Checkpoints + TodoLists)
**Rationale**: Scope creep created confusion, mixed storage, and search complexity
**Next Steps**: Implement enhanced TodoList interface and migration strategy

---

*This document preserves our architectural decisions and reasoning for the storage system simplification.*