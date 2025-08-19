---
allowed-tools: ["mcp__goldfish__recall", "mcp__goldfish__restore_session", "mcp__goldfish__view_todos"]
description: "Resume work from the most recent checkpoint"
---

Resume work from the most recent checkpoint using goldfish memory.

$ARGUMENTS

## Resume Process:

### 1. Find the Latest Session
If a sessionId is provided:
- Use restore_session with that sessionId

Otherwise:
- Use recall to find recent session memories: `recall({ type: "checkpoint", limit: 5 })`
- Look for memories with metadata.isSession = true (these are session memories)
- Use the sessionId field from the most recent session memory
- This sessionId is now the same as the memory's chronological ID

### 2. Display Session Information
Show the restored session details including:
- Session ID and timestamp
- Work context and description
- Active files if available

### 3. Check Active Work Items
- Use view_todos to show current TODO lists and their status
- Display completion progress for active work

### 4. Show Recent Context
- Use recall to show recent memories and context

### 5. Ready Message
End with: "✅ Session restored. Ready to continue!"

### 6. Fallback (No Session)
If no session found:
- Use recall to show recent memories
- Suggest creating a checkpoint with /checkpoint

## Example Flow:
1. `recall({ type: "checkpoint", limit: 5 })` returns memories
2. Find session memory with metadata.isSession = true
3. Get sessionId field: `"sessionId": "20250819153827-DB43D8C3"` (now same as memory ID)
4. Call `restore_session({ sessionId: "20250819153827-DB43D8C3" })`
5. Session restoration works because sessionId matches the memory's chronological ID