---
allowed-tools: ["mcp__goldfish__checkpoint", "mcp__goldfish__todo", "mcp__goldfish__plan", "mcp__goldfish__intel"]
hide-output: true
description: "Resume work from the most recent checkpoint with enhanced display"
---

Load the most recent checkpoint and continue work from where we left off.

$ARGUMENTS

## Resume Process:

### 1. Gather Session Data
```
checkpoint({ action: "restore", depth: "highlights" })
todo({ action: "view" })
plan({ action: "list", showCompleted: false })
intel({ action: "list" })
```

### 2. Format and Display Results Manually
**IMPORTANT**: Extract data from tool responses and format it yourself - DO NOT just show tool output.

Display format (prioritized information order):
```
═══════════════════════════════════════════════════════════
🔄 RESUMING WORK SESSION
═══════════════════════════════════════════════════════════

🧠 **PROJECT INTELLIGENCE** (if available)
═══════════════════════════════════════════════════════════

**⚠️ Permanent Rules** (critical project constraints)
  - {permanent rule 1}
  - {permanent rule 2}

**🔍 Active Investigations** (current discoveries)
  - {current investigation 1} 
  - {current investigation 2}

**📝 Resolved** (recently completed, if any)
  - {recent resolution 1}

═══════════════════════════════════════════════════════════
📐 ACTIVE PLANS ({count}) (if available)
═══════════════════════════════════════════════════════════

**📋 {plan_title}** - {status} ({progress}% if calculable)
   📊 Priority: {priority}
   🎯 Category: {category}
   📅 Created: {timeAgo}
   🔗 Linked TODOs: {linked_todo_count}
   
   **Next Items:**
   • {next_item_1}
   • {next_item_2}

═══════════════════════════════════════════════════════════
📍 CURRENT CHECKPOINT: {CHECKPOINT_ID} (if available)
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
📋 ACTIVE TODO LISTS ({count})
═══════════════════════════════════════════════════════════

📝 **{list_title}** - {progress}% ({completed}/{total})
   🔗 **Linked to Plan:** {plan_name} (if linked)
   📅 **Created:** {timeAgo}
   
   ✅ [1] {completed_task}
   🔄 [2] {active_task}
   ⏳ [3] {pending_task}
   ⏳ [4] {another_pending_task}
   ⏳ [5] {yet_another_task}

**🔓 Orphaned TODOs** (not linked to any plan, if any)
   📝 {orphaned_list_name}: {pending_count} tasks

═══════════════════════════════════════════════════════════
✅ Session restored successfully
📝 {total_pending_count} pending tasks across {list_count} lists
📐 {active_plan_count} active plans providing strategic context
🧠 {intel_sections_count} intelligence sections available
🚀 Ready to continue. What would you like to work on?
═══════════════════════════════════════════════════════════
```

### 3. Implementation Notes

**Key Pattern**: 
- Call tools to get data (checkpoint, todo, plan, intel)
- Parse the JSON responses to extract values
- Display formatted information in YOUR message (prioritized order)
- This prevents CLI collapse since it's your direct output

**Data Extraction & Prioritization**:

1. **Intel Data** (highest priority - critical project knowledge):
   - Parse intel response for permanent rules, active investigations, resolved items
   - Only show sections with content (skip empty sections)
   - Format with appropriate warning/info icons

2. **Plan Data** (strategic context):
   - Parse plan list response for active/draft plans
   - Extract: title, status, priority, category, creation time
   - Calculate progress from linked TODOs if available
   - Show next items/milestones

3. **Checkpoint Data** (current work state):
   - Parse checkpoint from `data[0].content`: description, workContext, gitBranch, activeFiles, highlights
   - Format session highlights with sparkle icons
   - Show file context and branch info

4. **TODO Data** (tactical tasks):
   - Parse todos from `data.items`: iterate through each item showing [id] task with status icon
   - Calculate pending count: total - completed
   - Map TODOs to plans using metadata/relationships
   - Identify orphaned TODOs (not linked to any plan)
   - Format with proper icons: ✅ (done) 🔄 (active) ⏳ (pending)

**Relationship Mapping**:
- Cross-reference TODO metadata for plan linkages
- Show plan progress based on linked TODO completion rates
- Highlight orphaned TODOs that need strategic alignment
- Display plan-todo dependency chains

**Specific Relationship Extraction Logic**:
1. **Checkpoint → Plans/TODOs**: 
   - Check `checkpoint.metadata.linkedPlans[]` and `checkpoint.metadata.linkedTodos[]`
   - These are auto-generated during checkpoint creation

2. **Plan → TODOs**:
   - Check `plan.relatedCheckpoints[]` for linked checkpoints
   - Look for TODOs with matching plan references in metadata
   - Calculate plan progress: `(completed_linked_todos / total_linked_todos) * 100`

3. **TODO → Plans**:
   - Check TODO list metadata for plan associations
   - Show "🔗 Linked to Plan: {plan_name}" if association exists
   - Mark as "🔓 Orphaned" if no plan association found

4. **Progress Calculation**:
   ```
   Plan Progress = Math.round((completed_todos_in_plan / total_todos_in_plan) * 100)
   ```

5. **Orphaned TODO Detection**:
   - TODO lists without plan metadata associations
   - Show count: "🔓 Orphaned TODOs: {list_name} ({pending_count} tasks)"

**Important Formatting Rules**:
- ALWAYS show todo item IDs in brackets: [1], [2], [3], etc.
- Show ALL todo items, not just examples
- Use the exact ID from the item, don't renumber
- Keep task descriptions on one line (truncate if > 70 chars)

### 4. Example TODO Display
When displaying todos, show them exactly like this:
```
📝 **Bug Fixes** - 40% (2/5)
   ✅ [1] Fix authentication error on login
   ✅ [2] Resolve database connection timeout
   🔄 [3] Debug memory leak in session handler
   ⏳ [4] Fix CSS layout issue on mobile
   ⏳ [5] Patch XSS vulnerability in comment form
```

Notice:
- Each item shows its ID in brackets [1], [2], etc.
- Status icons come before the ID
- Items are sorted by ID number, not by status
- All items are shown, not just a subset

### 5. Conditional Display Logic
**Show sections only if they have content:**

- **Intelligence**: Only show if intel file exists and has content
- **Plans**: Only show if there are active/draft plans
- **Checkpoint**: Show if available, otherwise show fallback message
- **TODOs**: Always attempt to show, but indicate if none found

**Empty State Fallbacks**:

```
🧠 **PROJECT INTELLIGENCE**
═══════════════════════════════════════════════════════════
ℹ️ No project intelligence captured yet. Use `/intel` to capture discoveries!
```

```
📐 **ACTIVE PLANS**
═══════════════════════════════════════════════════════════
💡 No active plans found. Use `/plan` to create strategic roadmaps!
```

```
📍 **CURRENT CHECKPOINT**
═══════════════════════════════════════════════════════════
⚠️ No recent checkpoint found. Showing recent activity:

[Use recall({ since: "7d" }) and format the results manually]

💡 **Tip:** Create your first checkpoint with `/checkpoint`
```

**Smart Summarization (Critical - Prevent Context Flooding)**:
- **Intel**: Max 3 permanent rules + 2 active investigations + 1 resolved item
- **Plans**: Max 2 most recent active plans with next 2 items each
- **TODOs**: Max 3 items per list, show "... and X more" if truncated
- **Highlights**: Max 5 most recent session highlights
- **Files**: Max 3 active files, show "... and X more" if truncated

**Adaptive Display Based on Content Volume**:
```javascript
// Progressive truncation based on total content
if (totalSections > 4) {
  // Compact mode: Show only non-empty sections with minimal details
  intelRules = 2, investigations = 1, resolved = 0
  plans = 1, planItems = 1
  todos = 2 per list
  highlights = 3
} else if (totalSections > 2) {
  // Balanced mode: Standard limits
  // Use the limits above
} else {
  // Full mode: Show more detail when less content
  // Increase limits by 50%
}
```

**Priority-Based Truncation Order**:
1. **Always show**: Intel permanent rules (max 3)
2. **High priority**: Current checkpoint core info, active plan names
3. **Medium priority**: TODO summaries, active investigations
4. **Low priority**: Resolved intel, old highlights, file lists

**Compact Display Options**:
- Use `📊 Summary:` lines instead of full item lists
- Group similar items: `📝 3 active TODOs across 2 lists`
- Use progress bars: `████░░░░░░ 40%` instead of detailed breakdowns

**Length Management (Target: ~50 lines max)**:
- If total output > 60 lines, switch to ultra-compact mode
- Ultra-compact shows only: 1-line intel summary, 1 active plan, 1 TODO list, checkpoint description
- Always end with clear "Use `/standup` for detailed progress report" hint
- Consider showing section count: `💡 More details in 3 additional sections - use /standup for full view`

**Example Ultra-Compact Fallback**:
```
🔄 RESUMING WORK SESSION
═══════════════════════════════════════════════════════════
🧠 📍 2 permanent rules, 1 active investigation
📐 🎯 "User Authentication" plan - 40% complete
📝 💼 "Bug Fixes" - 2/5 tasks complete, [3] Debug memory leak in progress  
📍 💾 Last checkpoint: "Fixed login validation" (2h ago)
═══════════════════════════════════════════════════════════
💡 Full context available with /standup • 12 total items across 4 sections
```