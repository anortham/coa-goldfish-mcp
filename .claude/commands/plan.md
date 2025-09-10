---
allowed-tools: ["mcp__goldfish__plan"]
description: "Create and manage strategic plans for complex features and projects"
---

Create and manage strategic plans using structured planning methodology for complex development work.

$ARGUMENTS

## Parse Arguments and Execute Plan Action

Analyze the arguments to determine the plan action and parameters:

### For creating new plans:
Parse arguments for title and create structured plan:
```
mcp__goldfish__plan({
  action: "save",
  title: "[parsed title from arguments]",
  description: "[detailed plan description in markdown]",
  category: "[inferred category: feature/architecture/research/bugfix]",
  priority: "normal",
  items: [
    "Phase 1: Research and design",
    "Phase 2: Core implementation", 
    "Phase 3: Testing and refinement",
    "Phase 4: Documentation and deployment"
  ]
})
```

### For listing existing plans:
```
mcp__goldfish__plan({
  action: "list"
})
```

### For updating existing plans:
```
mcp__goldfish__plan({
  action: "update",
  planId: "latest",
  discoveries: ["New learning or insight from arguments"]
})
```

### For completing plans:
```
mcp__goldfish__plan({
  action: "complete",
  planId: "latest"
})
```

## Parameter Details:
- **action**: "list" (default), "save", "update", "complete"
- **title**: Plan title (required for save, max 200 chars)
- **description**: Full markdown plan description (required for save, max 10000 chars)
- **items**: High-level plan items/milestones array
- **planId**: Plan identifier (supports "latest", "active", "current", or specific ID)
- **category**: Plan category ("feature", "architecture", "research", "bugfix")
- **priority**: Priority level ("low", "normal", "high", "critical")
- **discoveries**: Strategic discoveries and learnings array
- **workspace**: Target workspace (optional)

## Plan Categories:
- **feature**: New functionality development
- **architecture**: System design and refactoring  
- **research**: Investigation and spike work
- **bugfix**: Complex bug resolution strategies

## Strategic Planning Methodology:

**When to Create Plans:**
✅ Complex features requiring 3+ files or new patterns
✅ Major refactoring or architecture changes
✅ Research spikes and investigation work
✅ Complex bug fixes with multiple components

**Planning Workflow:**
1. **Define Problem**: Clear problem statement and success criteria
2. **Research Phase**: Investigate existing patterns and solutions
3. **Design Approach**: Outline technical approach and architecture
4. **Break into Phases**: Create concrete deliverable milestones
5. **Execute Systematically**: Work through phases methodically
6. **Capture Learnings**: Update plan with discoveries and insights

## Display Format:

After plan operations, show structured output:

```
📋 STRATEGIC PLAN: {title}
────────────────────────────────────────

🏷️ **Category:** {category} | **Priority:** {priority}
📅 **Created:** {created_date} | **Updated:** {updated_date}

📄 **Description:**
{description}

🎯 **Milestones:**
  1. {item1}
  2. {item2}
  3. {item3}

💡 **Discoveries:** ({discovery_count})
  • {discovery1}
  • {discovery2}

📊 **Status:** {status} | **Progress:** {estimated_progress}%

💡 Use `/plan update latest` to add discoveries
🎯 Use `/todo` to create implementation tasks
```

## Usage Examples:
- `/plan Implement OAuth2 authentication system`
- `/plan list` - Show all plans
- `/plan update latest discovered performance bottleneck in token validation`
- `/plan complete latest` - Mark current plan as finished

## Integration with Other Tools:
- **Checkpoint**: Plans are included in checkpoint restoration
- **TODO**: Create task lists from plan milestones  
- **Chronicle**: Plans can reference chronicle decisions
- **Standup**: Plans appear in progress reports