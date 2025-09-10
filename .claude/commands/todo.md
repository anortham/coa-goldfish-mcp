---
allowed-tools: ["mcp__goldfish__todo"]
description: "Quick todo management - add, complete, or view tasks"
---

Manage todo items quickly using the unified todo tool.

$ARGUMENTS

## Parse Arguments and Execute

Analyze the arguments to determine the appropriate action:

### For "add [task description]":
Add a new task to the latest todo list:
```
mcp__goldfish__todo({
  action: "update",
  listId: "latest",
  newTask: "[task description from arguments]"
})
```

### For "done [item_id]" or "complete [item_id]":
Mark the specified item as completed:
```
mcp__goldfish__todo({
  action: "update",
  listId: "latest", 
  itemId: "[item_id]",
  status: "Done"
})
```

### For "active [item_id]" or "working [item_id]":
Mark the specified item as currently active:
```
mcp__goldfish__todo({
  action: "update",
  listId: "latest",
  itemId: "[item_id]", 
  status: "Active"
})
```

### For "list" or no arguments:
Show current todo lists:
```
mcp__goldfish__todo({
  action: "view"
})
```

### For "all" or "lists":
Show all todo lists including completed:
```
mcp__goldfish__todo({
  action: "list"
})
```

## Parameter Details:
- **action**: "view" (default), "create", "update", "list"
- **listId**: Supports "latest", "active", "current", or specific list ID
- **itemId**: Specific item identifier within the list
- **newTask**: Task description when adding new items
- **status**: "Pending", "Active", "Done" for status updates
- **title**: Required for "create" action
- **items**: Array of tasks for "create" action

## Status Values:
- **Pending**: ⏳ Not started yet
- **Active**: 🔄 Currently working on
- **Done**: ✅ Completed

## Display Format:
After any change, show the updated todo list:
```
📋 {List Title} - {completion}% ({done}/{total})
   ✅ [id] {completed task}
   🔄 [id] {active task} 
   ⏳ [id] {pending task}
```

## Examples:
- `/todo add implement user authentication`
- `/todo done abc123` 
- `/todo active def456`
- `/todo list`