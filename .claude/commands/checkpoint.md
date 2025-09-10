---
allowed-tools: ["mcp__goldfish__checkpoint"]
description: "Save current work session state as a checkpoint"
---

Create a checkpoint of current work session using the unified checkpoint tool.

$ARGUMENTS

## Usage:
Parse the arguments and save a checkpoint with the provided description and context.

### For basic checkpoint:
```
mcp__goldfish__checkpoint({
  action: "save",
  description: $ARGUMENTS,
  global: false
})
```

### For detailed checkpoint (if additional context detected):
```
mcp__goldfish__checkpoint({
  action: "save", 
  description: "Primary description here",
  workContext: "What's being worked on next",
  activeFiles: ["file1.cs", "file2.cs"],
  highlights: ["Key achievement 1", "Key decision 2"],
  global: false
})
```

## Parameter Details:
- **action**: Always "save" for this command
- **description**: Required - brief summary of current state (max 2000 chars)
- **workContext**: Optional - what you're working on or next steps
- **activeFiles**: Optional - list of files currently being worked on
- **highlights**: Optional - key achievements or decisions to remember
- **gitBranch**: Optional - auto-detected if not provided
- **sessionId**: Optional - auto-generated if not provided
- **global**: Optional - set to true for cross-workspace checkpoints (default: false)

## Display Results:
After successful checkpoint:
```
✅ Checkpoint saved: {description}
📍 Session ID: {sessionId}
🌿 Branch: {gitBranch}
📁 Active files: {activeFiles count}
✨ Highlights: {highlights count}

💡 Use `/recall` to restore from this checkpoint
```

## Benefits:
- Crash-safe development with persistent session state
- Context preservation across Claude Code sessions
- Searchable work history and decision tracking
- Resume capability after interruptions or /clear