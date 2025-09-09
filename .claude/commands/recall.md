---
allowed-tools: ["mcp__goldfish__checkpoint", "mcp__goldfish__todo", "mcp__goldfish__plan", "mcp__goldfish__intel"]
hide-output: true
description: "Resume work from the most recent checkpoint with enhanced display"
---

Load the most recent checkpoint and continue work from where we left off.

$ARGUMENTS

## Resume Process:

### 1. Gather Session Data (Balanced)
```
checkpoint({ action: "restore", depth: "highlights" })
todo({ action: "view" })
plan({ action: "list", showCompleted: false })  // Optional - only if plans exist
intel({ action: "list" })  // Optional - only if intel exists
```

### 2. Format and Display Results Manually
**IMPORTANT**: Extract data from tool responses and format it yourself - DO NOT just show tool output.

**BALANCED APPROACH**: Show useful context without overwhelming:
- Latest checkpoint (description + context + highlights + files)
- Active TODO lists with all pending tasks  
- Intel (only if critical rules/discoveries exist)
- Plans (only active ones, with brief status)

Balanced display format (~20-25 lines max):
```
🔄 RESUMING WORK SESSION
────────────────────────────────────────────────────────

📍 **Last Work:** {description}
🎯 **Context:** {work_context} 
🌿 **Branch:** {git_branch}
📁 **Files:** {active_files}

✨ **Recent Highlights:** (max 3)
  • {highlight1}
  • {highlight2}

🧠 **Active Investigations:** (only if current investigations exist)
  🔬 {active_investigation1}
  🔬 {active_investigation2}

📐 **Active Plan:** (only if exists)
  🎯 {plan_title} - {progress}%

📋 **Active TODOs:** ({pending_count} pending)
  🔄 [id] {current_active_task}
  ⏳ [id] {pending_task1} 
  ⏳ [id] {pending_task2}
  ... and {more_count} more (if >5 tasks)

────────────────────────────────────────────────────────
🚀 Ready to continue. What would you like to work on?
```

### 3. Implementation Notes

**Key Pattern**: 
- Call all tools but display selectively
- Parse JSON responses and show relevant sections
- Keep intel/plans optional (only show if they have useful content)
- Target ~20-25 lines total output

**Data Extraction (Balanced)**:

1. **Checkpoint Data** (restore useful context):
   - Include: description, workContext, gitBranch, activeFiles
   - Show: top 3 highlights (most recent accomplishments)
   - Skip: extensive metadata

2. **TODO Data** (actionable with context):
   - Show active task + all pending tasks (up to 5)
   - Include pending count summary
   - Format: 🔄 (active) ⏳ (pending)

3. **Intel Data** (show current work context):
   - Show active investigations only (permanent rules load in background)
   - Max 3-4 recent investigations to show current work context
   
4. **Plan Data** (brief status only):
   - Show only active plans with progress %
   - One line per plan maximum

**Important Formatting Rules**:
- ALWAYS show todo item IDs in brackets: [1], [2], [3], etc.
- Show ALL todo items up to limit, not just examples
- Use the exact ID from the item, don't renumber
- Keep task descriptions on one line (truncate if > 70 chars)

### 4. Example TODO Display
When displaying todos, show them exactly like this:
```
📋 **Active TODOs:** (3 pending)
  🔄 [3] Debug memory leak in session handler
  ⏳ [4] Fix CSS layout issue on mobile
  ⏳ [5] Patch XSS vulnerability in comment form
```

### 5. Intel Display Rules
**For Active Investigations only:**
- Extract lines from "Active Investigations" section only
- Skip "Permanent Rules" (agent gets these in background)  
- Show max 3-4 most relevant current discoveries
- Format as: 🔬 {investigation_text}

### 6. Fallback (No Checkpoint)
If no checkpoint found:
```
⚠️ No recent checkpoint found. Showing recent activity:

[Use recall({ since: "7d" }) and format the results manually]

💡 **Tip:** Create your first checkpoint with `/checkpoint`
```