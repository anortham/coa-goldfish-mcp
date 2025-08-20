---
allowed-tools: ["mcp__goldfish__restore_session", "mcp__goldfish__view_todos", "mcp__goldfish__timeline", "mcp__goldfish__recall"]
hide-output: true
description: "Resume work from the most recent checkpoint with enhanced display"
---

Load the most recent checkpoint and continue work from where we left off.

$ARGUMENTS

## Resume Process:

### 1. Gather Session Data
```
restore_session({ depth: "highlights" })
view_todos()
```

### 2. Format and Display Results Manually
**IMPORTANT**: Extract data from tool responses and format it yourself - DO NOT just show tool output.

Display format:
```
═══════════════════════════════════════════════════════════
📍 RESUMING FROM CHECKPOINT: {CHECKPOINT_ID}
═══════════════════════════════════════════════════════════

📝 **Last Work:** {description}
🎯 **Context:** {work_context}
🌿 **Branch:** {git_branch}
📁 **Files:** {active_files}

🌟 **Session Highlights:**
   ✨ {highlight1}
   ✨ {highlight2}
   ✨ {highlight3}

═══════════════════════════════════════════════════════════
📋 ACTIVE TODO LISTS
═══════════════════════════════════════════════════════════

📝 **{list_title}** - {progress}% ({completed}/{total})
   ✅ {completed_task}
   🔄 {active_task}
   ⏳ {pending_task}

═══════════════════════════════════════════════════════════
✅ Session restored successfully
📝 {todo_count} pending tasks ready
🚀 Ready to continue. What would you like to work on?
═══════════════════════════════════════════════════════════
```

### 3. Implementation Notes

**Key Pattern**: 
- Call tools to get data
- Parse the responses 
- Display formatted information in YOUR message
- This prevents CLI collapse since it's your direct output

**Data Extraction**:
- Parse checkpoint: description, context, branch, files, highlights
- Parse todos: list titles, progress stats, individual items with status
- Format with proper icons: ✅ ⏳ 🔄

### 4. Fallback (No Checkpoint)
If no checkpoint found:
```
⚠️ No recent checkpoint found. Showing recent activity:

[Use recall() and format the results manually]

💡 **Tip:** Create your first checkpoint with `/checkpoint`
```