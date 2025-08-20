---
allowed-tools: ["mcp__goldfish__timeline", "mcp__goldfish__view_todos", "mcp__goldfish__recall"]
description: "Generate daily standup report with yesterday's work, today's todos, and blockers"
---

Generate a daily standup report with what was done yesterday, what's planned for today, and any blockers.

$ARGUMENTS

## Standup Process:

### 1. Gather Data
```
timeline({ since: "24h", scope: "all" })
view_todos()
recall({ since: "24h" })
```

### 2. Format Standup Report

Display a formatted standup report:

```
═══════════════════════════════════════════════════════════
📅 DAILY STANDUP - {TODAY'S DATE}
═══════════════════════════════════════════════════════════

📍 **YESTERDAY** - What I accomplished:
   • {checkpoint/commit from timeline}
   • {another accomplishment}
   • {key work done}

🎯 **TODAY** - What I'm working on:
   • [1] {active todo item}
   • [2] {pending todo item}  
   • [3] {another pending item}

🚧 **BLOCKERS** - Issues or concerns:
   • {any blocking issues from todos or context}
   • {dependencies or questions}

═══════════════════════════════════════════════════════════
💡 Ready to discuss in standup!
═══════════════════════════════════════════════════════════
```

### 3. Implementation Notes

**Data Extraction**:
- Parse timeline for yesterday's checkpoints and commits
- Extract todo items with IDs and status
- Look for any items marked as blockers or high priority

**Formatting Rules**:
- Group yesterday's work by project/workspace
- Show todo IDs for easy reference
- Highlight any overdue or blocked items
- Keep concise - one line per item