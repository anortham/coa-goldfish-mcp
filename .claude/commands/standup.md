---
allowed-tools: ["mcp__goldfish__standup"]
description: "Generate professional standup reports with progress summaries"
---

Generate a comprehensive standup report using the unified standup tool.

$ARGUMENTS

## Parse Arguments and Generate Report

Analyze arguments to determine the standup type and time range:

### For "daily" or no arguments:
Generate daily standup report (last 24 hours):
```
mcp__goldfish__standup({
  action: "daily"
})
```

### For "weekly":
Generate weekly standup report (last 7 days):
```
mcp__goldfish__standup({
  action: "weekly"
})
```

### For "project" or "month":
Generate project standup report (last 30 days):
```
mcp__goldfish__standup({
  action: "project"
})
```

### For custom time range:
Generate standup for specific time range:
```
mcp__goldfish__standup({
  action: "custom",
  since: "[parsed time range like '3d', '1w', '2025-01-01']"
})
```

## Parameter Details:
- **action**: "daily" (default), "weekly", "project", "custom"
- **since**: Time range override (e.g., '1d', '3d', '1w', '2025-01-15')
- **workspace**: Target workspace (optional)

## Time Range Examples:
- **'1d'** or **'24h'**: Last 24 hours
- **'3d'**: Last 3 days  
- **'1w'**: Last week
- **'2025-01-15'**: Since specific date

## What the Tool Provides:

The standup tool automatically aggregates:
- **Recent checkpoints**: What was accomplished and saved
- **Active todos**: Current tasks and their status
- **Active plans**: Strategic work in progress  
- **Chronicle entries**: Recent decisions and discoveries
- **Progress metrics**: Completion rates and velocity

## Report Format:
```
🔄 STANDUP REPORT - {timerange}
────────────────────────────────

✅ **COMPLETED WORK:**
   • {checkpoint highlights}
   • {completed todos}

🔄 **IN PROGRESS:**  
   • {active todos with IDs}
   • {current plan milestones}

⏳ **PLANNED:**
   • {pending high-priority todos}
   • {next plan phases}

🚧 **BLOCKERS:**
   • {stalled tasks}
   • {overdue items}

📊 **METRICS:**
   • {completion percentages}
   • {velocity trends}
```

The output is meeting-ready without additional formatting.