---
allowed-tools: ["mcp__goldfish__intel"]
description: "Capture and manage project intelligence and discoveries"
---

Capture critical project discoveries and knowledge using the Intel tool for persistent project intelligence.

$ARGUMENTS

## Intel Management

Parse the arguments to determine the action and use the intel tool:

### For capturing discoveries (most common):

**Quick capture** - Just provide the discovery:
```
intel("Generic < breaks parser at line 234")
```

**Structured capture** - With detailed context:
```
intel({ 
  insight: {
    what: "SearchEngine.ParseQuery() is just a stub",
    where: "search.ts:145", 
    why: "Implementation was never completed"
  }
})
```

### For permanent rules and constraints:
```
intel({
  capture: "Never build in release mode - files are locked",
  permanent: true
})
```

### For viewing current intelligence:
```
intel({ action: "list" })
```

### For organization by sections:
```
intel({
  capture: "Memory leak fixed in UserService",
  section: "resolved"
})
```

## Usage Patterns:

- **Bug discoveries**: `intel("< symbol breaks tokenizer at parser.ts:234")`
- **Project rules**: `intel({ capture: "Always use ConfigureAwait(false)", permanent: true })`
- **Workarounds**: `intel("Skip flaky test X until fixed")`
- **Architecture notes**: `intel("Database uses connection pooling with 10 max connections")`
- **Performance findings**: `intel("Query optimization reduced response time from 2s to 200ms")`

## Why Use Intel?

The Intel tool prevents knowledge loss by:
- **Persisting discoveries** across multiple Claude Code sessions
- **Auto-injecting intelligence** during checkpoint restore
- **Preventing repeated investigations** of the same issues
- **Maintaining project-specific rules** that Claude tends to forget
- **Capturing hard-won insights** that would otherwise be lost in context window compaction

## Integration:

Intel content is automatically displayed when you:
- Use `/recall` to restore from checkpoints
- Restore checkpoints with `checkpoint({ action: "restore" })`
- This ensures critical knowledge is always available when resuming work

## File Location:

Intelligence is stored in `INTEL.md` files in each workspace, making it:
- **Human readable** - You can edit the markdown files directly if needed
- **Git-friendly** - Files can be version controlled
- **Workspace-specific** - Each project has its own intelligence
- **Searchable** - Easy to grep through discoveries