---
allowed-tools: ["mcp__goldfish__chronicle"]
description: "Capture project decisions, discoveries, and important notes"
---

Capture critical project decisions and discoveries using the Chronicle tool for persistent project intelligence.

$ARGUMENTS

## Parse Arguments and Chronicle Entry

Analyze the arguments to determine the action and entry type:

### For capturing discoveries/decisions (most common):
Quick capture with description:
```
mcp__goldfish__chronicle({
  action: "add",
  description: $ARGUMENTS,
  type: "Note"
})
```

### For specific entry types:
Parse the arguments to determine appropriate type and description:

**Bug Discovery:**
```
mcp__goldfish__chronicle({
  action: "add", 
  description: "< symbol breaks parser at line 234",
  type: "Bug"
})
```

**Decision Record:**
```
mcp__goldfish__chronicle({
  action: "add",
  description: "Switched to Entity Framework Core for better performance",
  type: "Decision"
})
```

**Workaround:**
```
mcp__goldfish__chronicle({
  action: "add",
  description: "Skip flaky test TestUserAuth until fixed",
  type: "Workaround"
})
```

### For viewing chronicle entries:
```
mcp__goldfish__chronicle({
  action: "list"
})
```

### For searching past entries:
```
mcp__goldfish__chronicle({
  action: "search",
  description: "[search query from arguments]",
  since: "30d"
})
```

## Parameter Details:
- **action**: "add" (default), "list", "search", "auto"
- **description**: Entry content (required for add/search)
- **type**: "Note" (default), "Bug", "Decision", "Workaround", "Performance", "Architecture"
- **since**: Time range for list/search (e.g., '7d', '1w', '30d')

## Entry Types:
- **Note**: General observations and discoveries
- **Bug**: Bug reports and issues found
- **Decision**: Technical decisions and rationale
- **Workaround**: Temporary fixes and workarounds
- **Performance**: Performance findings and optimizations
- **Architecture**: Architectural decisions and patterns

## Usage Patterns:
- **Bug discoveries**: `/chronicle < symbol breaks tokenizer`
- **Project rules**: `/chronicle Always use ConfigureAwait(false)`
- **Workarounds**: `/chronicle Skip flaky test until fixed`
- **Architecture notes**: `/chronicle Database uses connection pooling`
- **Performance findings**: `/chronicle Query optimization reduced response time`

## Why Use Chronicle?

Chronicle prevents knowledge loss by:
- **Persisting discoveries** across multiple Claude Code sessions
- **Searchable history** of project decisions and findings
- **Preventing repeated investigations** of the same issues
- **Maintaining project-specific knowledge** that Claude tends to forget
- **Capturing hard-won insights** that would otherwise be lost

## Display Format:
```
📝 CHRONICLE ENTRY ADDED
────────────────────────
🏷️ Type: {entry_type}
📅 Time: {timestamp}
📄 Description: {description}

💡 Use `/chronicle` to view all entries
🔍 Use `/chronicle search [term]` to find specific entries
```