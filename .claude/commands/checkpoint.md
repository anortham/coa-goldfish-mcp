---
allowed-tools: ["mcp__goldfish__save_session", "mcp__goldfish__snapshot", "mcp__goldfish__remember"]
description: "Create a checkpoint of current work session"
---

Create a quick checkpoint of current work session using goldfish memory.

$ARGUMENTS

## Steps:
1. Create structured session:
   - Use save_session without providing a sessionId (let it use the memory ID)
   - The tool will return the chronological ID as the sessionId
   - This becomes the single identifier for this session

2. Create related checkpoint:
   - Use snapshot with descriptive label 
   - Use the sessionId returned from save_session to link them
   - Use remember to store key context like active files or current focus

3. Display results:
   - Show: "✓ Checkpoint created: {label}"
   - Show: "Session ID: {sessionId}" (the chronological ID from save_session)
   - Show: "📌 Use /resume to continue from this checkpoint"