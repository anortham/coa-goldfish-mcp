---
allowed-tools: ["mcp__goldfish__restore_session", "mcp__goldfish__view_todos", "mcp__goldfish__timeline", "mcp__goldfish__recall"]
description: "Resume work from the most recent checkpoint with progressive depth"
---

Resume work from checkpoints with smart depth control for different scenarios.

$ARGUMENTS

## Resume Process:

### 1. Default Resume (Post-/clear)
For continuing after /clear:
```
restore_session()  # or restore_session({ depth: "highlights" })
```
- Shows last checkpoint + accumulated session highlights
- ~500-1000 tokens - perfect for continuing work
- Preserves benefits of context clearing

### 2. Deep Resume (Back from Break)
For returning after days away:
```
restore_session({ depth: "full" })
```
- Shows complete session with all checkpoints
- Full context for major context switches
- Use when you need to understand everything that happened

### 3. Specific Session Resume
For restoring particular session:
```
restore_session({ sessionId: "specific-session-id" })
```

### 4. Quick Status Check
```
timeline({ since: "1d" })  # See recent work across projects
view_todos()              # Check active tasks
```

### 5. Display Results
Show restored session with:
- Session summary and key highlights
- Active TODOs and progress
- Git branch and active files (if available)
- Timeline of recent work (if requested)

### 6. Ready Message
End with: "✅ Session restored. Ready to continue!"

## Progressive Depth Strategy:
- **minimal**: Just last checkpoint
- **highlights**: Last checkpoint + session highlights (DEFAULT)
- **full**: Entire session history

## Use Cases:
- After `/clear`: Default depth (highlights)
- After reboot/crash: Full depth for complete context
- Cross-project standup: `timeline({ scope: "all" })`
- Specific debugging: `restore_session({ sessionId: "target-session" })`

## Fallback (No Session):
If no checkpoints found:
- Show recent memories with `recall()`
- Suggest creating first checkpoint with `/checkpoint`