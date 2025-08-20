# COA Goldfish MCP

> Short-term memory MCP server for AI agents - named after goldfish for their famously short attention spans!

## 🐠 What is Goldfish?

Goldfish is a simple, lightweight MCP server designed specifically for short-term memory storage for AI agents. Unlike heavy-duty knowledge management systems, Goldfish:

- **Expires automatically** - Memories disappear after 24 hours (configurable)
- **Zero overhead** - Just JSON files, no database
- **Simple & fast** - 10 focused tools covering all short-term memory needs
- **Cross-session** - Can bridge multiple conversation sessions
- **Self-cleaning** - Automatically removes old memories

## 🛠 Tools (10 Total)

### Core Memory Tools
- **`remember`** - ALWAYS store working context when starting tasks, discovering issues, or making decisions
- **`recall`** - Enhanced memory recall with fuzzy search - check recent work proactively at session start
- **`search_history`** - Search work history across all projects with fuzzy matching
- **`timeline`** - Show chronological timeline of work sessions for standups and activity review

### Session Management  
- **`checkpoint`** - Create crash-safe checkpoints to save current progress (required: description only)
- **`restore_session`** - IMMEDIATELY restore session state after /clear or long breaks
- **`summarize_session`** - AI-condensed summary of session or recent work

### Task Tracking
- **`create_todo_list`** - Create TODO lists tied to current session when users mention multiple tasks
- **`view_todos`** - View active TODO lists with markdown table display (no collapse issues)
- **`update_todo`** - Update task status or add new tasks to existing lists

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

### Project Structure
```
COA Goldfish MCP/
├── src/
│   ├── core/                    # Core functionality modules
│   │   ├── storage.ts          # JSON file storage and workspace detection
│   │   ├── session-manager.ts  # Session state management
│   │   └── search.ts           # Memory search and filtering
│   ├── tools/                  # MCP tool implementations
│   │   ├── checkpoint.ts       # Checkpoint and snapshot tools
│   │   ├── session.ts          # Session management tools
│   │   └── search.ts           # Memory recall and search tools
│   ├── types/                  # TypeScript type definitions
│   │   └── index.ts            # Shared interfaces and types
│   ├── __tests__/              # Comprehensive test suite
│   │   ├── core.test.test.ts   # Core functionality tests
│   │   ├── tools.test.test.ts  # Tool handler tests
│   │   ├── integration.test.test.ts # Integration workflows
│   │   └── edge-cases.test.test.ts  # Error handling tests
│   └── index.ts                # Main MCP server entry point
├── .claude/                    # Claude Code integration
│   ├── commands/               # Custom slash commands
│   │   ├── checkpoint.md       # /checkpoint command
│   │   └── resume.md          # /resume command
│   ├── hooks/                  # Automation hooks (PS1 & Python)
│   │   ├── session_start.*    # Auto-restore on session start
│   │   ├── user_prompt_submit.*# Auto-checkpoint on prompts
│   │   ├── pre_compact.*      # Save before context clearing
│   │   └── post_commit.*      # Save after git commits
│   └── settings.local.json    # MCP server configuration
├── dist/                      # Compiled JavaScript output
└── package.json              # Dependencies and build scripts
```

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

### Basic Setup
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development (with live reload)
npm run dev

# Run built version
npm start

# Run tests
npm test
```

### Claude Code Integration
The project includes full Claude Code integration with:

1. **MCP Server Configuration** - Add to your `.claude/settings.json`:
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

2. **Custom Commands** - Copy commands to your global Claude directory:
```bash
# Copy custom commands (optional - for global use)
cp .claude/commands/* ~/.claude/commands/
```

3. **Hooks Integration** - The `.claude/hooks/` folder contains automation scripts that:
   - Auto-restore sessions on startup
   - Auto-checkpoint on user prompts  
   - Save state before context clearing
   - Capture git commits automatically

## 🧪 Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test -- --coverage

# Run specific test files
npm test core.test.test.ts
npm test tools.test.test.ts
npm test integration.test.test.ts
npm test edge-cases.test.test.ts
```

**Test Categories:**
- **Core Tests** - Storage, workspace detection, memory management
- **Tool Tests** - All 10 MCP tool implementations
- **Integration Tests** - Cross-workspace queries, session workflows
- **Edge Case Tests** - Error handling, concurrent operations, corrupted files

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
The `.claude/commands/` folder contains powerful structured workflows:

- **`/checkpoint`** - Creates structured session snapshots 
  - Uses `checkpoint` + `restore_session` + `remember` tools
  - Captures accomplished work, current state, next steps, and blockers
  - Perfect for end-of-day or milestone checkpoints

- **`/resume`** - Restores session context seamlessly  
  - Uses `restore_session` + `view_todos` + `timeline` + `recall` tools
  - Shows recent activity timeline and active work items
  - Enhanced display with `hide-output: true` to prevent tool output duplication
  - Perfect for morning startup or continuing previous work

**Commands auto-install** when using this project's `.claude/` integration

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