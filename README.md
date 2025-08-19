# COA Goldfish MCP

> Short-term memory MCP server for AI agents - named after goldfish for their famously short attention spans!

## 🐠 What is Goldfish?

Goldfish is a simple, lightweight MCP server designed specifically for short-term memory storage for AI agents. Unlike heavy-duty knowledge management systems, Goldfish:

- **Expires automatically** - Memories disappear after 24 hours (configurable)
- **Zero overhead** - Just JSON files, no database
- **Simple & fast** - 10 focused tools covering all short-term memory needs
- **Cross-session** - Can bridge multiple conversation sessions
- **Self-cleaning** - Automatically removes old memories

## 🛠 Tools

### Core Memory Tools
- **`remember`** - ALWAYS store working context when starting tasks, discovering issues, or making decisions
- **`recall`** - Proactively restore context at session start and check recent memories 
- **`forget`** - Remove specific memories or clear memory types
- **`snapshot`** - Create checkpoints automatically after completing significant work

### Session Management
- **`save_session`** - ALWAYS save session state before ending work or switching tasks
- **`restore_session`** - IMMEDIATELY use at conversation start if resuming previous work

### Task Tracking  
- **`create_todo_list`** - Proactively create when users mention multiple tasks or work planning
- **`view_todos`** - Check automatically at session start for current work status
- **`update_todo`** - Update task status immediately upon completion or progress

### Quick Reference
```typescript
// Proactive AI agent usage patterns
remember("Working on auth refactor - changed JWT validation logic") // Store context immediately
recall({ scope: "all", since: "24h" }) // Check recent work at session start
snapshot({ label: "Auth refactor complete" }) // Create checkpoint after milestones
save_session({ sessionId: "auth-work-2025-01-19", description: "JWT implementation done" })
create_todo_list({ title: "API Updates", items: ["Update docs", "Add tests"] }) // When user lists tasks
```

## 🏗 Architecture

### Workspace-Aware Storage (like CodeSearch pattern)
```
~/.coa/goldfish/
├── memories/
│   ├── coa-projectknowledge-mcp/    # Per-workspace like CodeSearch
│   │   ├── 20250118143022-ABC123.json
│   │   └── 20250118144530-DEF456.json
│   ├── coa-sql-mcp/
│   │   └── 20250118150000-GHI789.json
│   ├── my-web-app/
│   │   └── 20250118151500-JKL012.json
│   └── global/                      # Cross-project memories
│       └── 20250118153000-MNO345.json
└── config/
    └── settings.json
```

Each memory is a simple JSON file with workspace context:
```json
{
  "id": "20250118143022-ABC123",
  "timestamp": "2025-01-18T14:30:22.000Z",
  "workspace": "coa-projectknowledge-mcp",
  "type": "todo",
  "content": "Update API documentation",
  "ttlHours": 24,
  "tags": ["documentation", "api"],
  "sessionId": "session-123"
}
```

## 📦 Installation

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Run built version
npm start
```

## 🔧 Configuration

Add to Claude Code `.claude/settings.json`:

```json
{
  "mcp": {
    "servers": {
      "goldfish": {
        "command": "node",
        "args": ["C:/source/COA Goldfish MCP/dist/index.js"],
        "disabled": false
      }
    }
  }
}
```

## 🤖 AI Agent Integration

Goldfish is optimized for **proactive AI agent usage**:

### Autonomous Behavior Triggers
Tool descriptions include specific trigger words to encourage AI agents to use tools without prompting:
- **"ALWAYS"** - For critical actions like storing context and saving sessions
- **"Proactively"** - For beneficial actions like checking recent work
- **"Immediately"** - For urgent actions like session restoration
- **"Automatically"** - For routine maintenance actions

### Smart Auto-promotion to ProjectKnowledge
Important memories automatically get promoted to long-term storage:
- Session checkpoints older than 12 hours
- Memories tagged as "important", "decision", "architecture", or "bug-fix" 
- Long context (200+ characters) that may contain valuable insights

### Custom Commands (Included)
This project includes two powerful custom commands that provide structured workflows:

- **`/checkpoint`** - Creates structured session snapshots 
  - Uses `snapshot` + `save_session` + `remember` tools
  - Captures accomplished work, current state, next steps, and blockers
  - Perfect for end-of-day or milestone checkpoints

- **`/resume`** - Restores session context seamlessly
  - Uses `restore_session` + `recall` + `view_todos` tools  
  - Shows recent activity timeline and active work items
  - Perfect for morning startup or continuing previous work

**Command Location**: `~/.claude/commands/` (installed with project setup)

## 💡 Use Cases & AI Agent Patterns

### Proactive Context Preservation
```typescript
// AI agents will automatically store context when working
remember("Currently debugging login issue - JWT validation logic needs update")
remember("Found performance bottleneck in UserService.authenticate() method")
```

### Autonomous Session Management
```typescript
// AI agents will check for previous work at conversation start
recall({ scope: "current" })  // Check current project context
restore_session({ sessionId: "auth-work-2025-01-19" })  // Continue previous session

// AI agents will save progress automatically
save_session({ 
  sessionId: "auth-work-2025-01-19", 
  description: "JWT implementation complete, ready for testing",
  activeFiles: ["src/auth/AuthService.ts", "tests/auth.test.ts"] 
})
```

### Intelligent Task Tracking
```typescript
// AI agents will create TODOs when users mention multiple tasks
create_todo_list({ 
  title: "API Security Updates", 
  items: ["Implement JWT refresh", "Add rate limiting", "Update documentation"] 
})

// AI agents will update status as work progresses  
update_todo({ listId: "...", itemId: "...", status: "done" })  // Mark completed immediately
```

### Cross-Project Awareness
```typescript
// Perfect for daily standups - AI agents can proactively check recent work
recall({ scope: "all", since: "24h", type: "checkpoint" })
// Returns work across all projects:
// 🏗️ coa-projectknowledge-mcp: Enhanced hook system with better error handling
// 🐠 coa-goldfish-mcp: Added proactive tool descriptions for AI agents
// 📊 hospital-dashboard: Fixed patient data query performance issue
```

### Smart Checkpointing
```typescript
// AI agents will create checkpoints after completing significant work
snapshot({ label: "Authentication system complete" })
snapshot({ label: "Bug fix deployed", description: "Login timeout resolved in production" })
```

## 🔄 Integration with ProjectKnowledge

Goldfish complements ProjectKnowledge MCP:

- **Goldfish**: Short-term, working memory, auto-expires
- **ProjectKnowledge**: Long-term, searchable, permanent

The hook system automatically promotes important Goldfish memories to ProjectKnowledge for permanent storage.

## 🎯 Philosophy

> "A goldfish's memory isn't actually 3 seconds - it's about 3 months. But for AI agents working on code, 3 days is plenty for short-term context."

Goldfish embraces the concept of forgetting as a feature, not a bug. By automatically cleaning up old memories, it keeps the working context fresh and relevant.

## 📄 License

MIT License - COA Internal Use