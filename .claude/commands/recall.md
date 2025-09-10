---
allowed-tools: ["mcp__goldfish__recall", "mcp__goldfish__checkpoint"]
description: "Resume work from recent activity and context"
---

Load recent work context and continue from where you left off.

$ARGUMENTS

## Parse Arguments and Restore Context

Analyze the arguments to determine the recall scope and time range:

### For basic recall (no arguments):
Show recent activity from all sources:
```
mcp__goldfish__recall({
  limit: 10
})
```

### For specific search query:
Search for specific topics or keywords:
```
mcp__goldfish__recall({
  query: "[search terms from arguments]",
  since: "7d",
  limit: 10
})
```

### For specific time range:
Recall activity from specific period:
```
mcp__goldfish__recall({
  since: "[parsed time range like '1d', '3d', '1w']",
  limit: 15
})
```

### If recall finds a recent checkpoint, also restore it:
```
mcp__goldfish__checkpoint({
  action: "restore"
})
```

## Parameter Details:
- **query**: Optional search terms to find specific topics
- **since**: Time range (default: '7d') - '1d', '3d', '1w', '30d', etc.
- **limit**: Maximum results to return (default: 10)
- **workspace**: Target workspace (optional)

## What Recall Provides:

The recall tool aggregates recent activity from:
- **Recent checkpoints**: Saved session states and progress
- **Active todos**: Current tasks and their status
- **Active plans**: Strategic work in progress  
- **Chronicle entries**: Recent decisions and discoveries

## Display Format:

Format the recall results into a structured resume:

```
🔄 RESUMING WORK SESSION
────────────────────────────────────────────────────────

📍 **Recent Checkpoint:** {latest_checkpoint_description}
🎯 **Context:** {work_context}
🌿 **Branch:** {git_branch}
📁 **Active Files:** {active_files}

✨ **Recent Highlights:**
  • {highlight1}
  • {highlight2}

📋 **Active TODOs:** ({pending_count} pending)
  🔄 [id] {active_task}
  ⏳ [id] {pending_task1}
  ⏳ [id] {pending_task2}

📐 **Active Plans:** (if any)
  🎯 {plan_title} - {progress}%

📝 **Recent Chronicle Entries:**
  • {recent_decision}
  • {recent_discovery}

────────────────────────────────────────────────────────
🚀 Ready to continue. What would you like to work on?
```

## Fallback (No Recent Activity):
If no recent activity found:
```
⚠️ No recent activity found for the specified time range.

💡 **Getting Started:**
  • Use `/checkpoint` to save your current progress
  • Use `/todo` to create task lists
  • Use `/chronicle` to capture decisions and discoveries
```

## Usage Examples:
- `/recall` - Show all recent activity
- `/recall authentication bug` - Find work related to auth bugs  
- `/recall 3d` - Show last 3 days of activity