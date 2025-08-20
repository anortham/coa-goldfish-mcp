# COA Goldfish MCP

> Your development session's "flight recorder" - keeps your work context safe from crashes, restarts, and forgetful moments

## 🐠 What is Goldfish?

Goldfish is a **crash-safe developer's work journal** that acts like a persistent memory for your coding sessions. Just like a goldfish that remembers more than you think, it helps you:

- **Never lose your work** - Automatic checkpoints survive crashes, power outages, and terminal closures
- **Pick up where you left off** - Smart session restoration after `/clear` or breaks
- **Track what you've done** - "What did I work on yesterday?" becomes easy to answer
- **Manage active tasks** - TODO lists that persist between sessions
- **Keep temporary notes** - Quick thoughts and reminders that auto-expire

## 🚀 How You'll Use It

### Daily Workflow Examples

**📍 Creating Checkpoints** - Save your progress naturally:
> "I just finished implementing the JWT authentication system with token refresh"

Goldfish automatically captures this as a checkpoint with context about what files you were working on.

**🔄 Resuming Work** - Get back to work quickly:
> After a crash or `/clear`: "What was I working on?"

Use `/resume` to see your last checkpoint, active TODOs, and recent progress.

**📅 Daily Standups** - Remember what you accomplished:
> "What did I work on yesterday across all my projects?"

Use `/standup` to get a complete overview of yesterday's achievements.

**🔍 Finding Past Work** - Search your work history:
> "Did I work on any JWT stuff last week?"
> "When did I fix that database connection issue?"

Just ask naturally - Goldfish will search your work history.

### Common Questions Goldfish Answers

- **"What was I doing before lunch?"** → Shows your recent checkpoints and context
- **"Did I already fix the login bug?"** → Searches your work history for "login bug"  
- **"What are my current TODOs?"** → Shows active task lists with progress
- **"What did the team accomplish this week?"** → Timeline across all projects
- **"Where did I leave that API documentation task?"** → Finds your work context

## 🛠 Available Commands

### Custom Slash Commands (Available in .claude/commands/)
- **`/checkpoint`** - Save your current progress with context
- **`/resume`** - Restore your session after breaks or crashes  
- **`/standup`** - Generate daily standup report
- **`/todo`** - Manage your active task lists

### Natural Language Queries
Just ask Goldfish naturally:

- **"Show me yesterday's work"** - Timeline of your recent accomplishments
- **"What JWT tasks am I working on?"** - Search for specific topics
- **"Summarize this week's progress"** - High-level summary of your achievements  
- **"What are my pending tasks?"** - View active TODOs with status
- **"Remember: Need to update the API docs"** - Store quick reminders

## 📦 Installation

### Method 1: NPM Global Install (Recommended)
```bash
# Install globally
npm install -g coa-goldfish-mcp

# Add to Claude Code (automatic)
claude mcp add coa-goldfish-mcp
```

### Method 2: Local Development Setup
```bash
# Clone and build
git clone [repository-url]
cd "COA Goldfish MCP" 
npm install
npm run build

# Add to Claude Code manually
# Edit your ~/.claude/settings.json:
```

```json
{
  "mcpServers": {
    "goldfish": {
      "type": "stdio",
      "command": "C:/source/COA Goldfish MCP/dist/index.js",
      "args": [],
      "env": {}
    }
  }
}
```

### Custom Commands Setup
The custom slash commands (`/checkpoint`, `/resume`, `/standup`, `/todo`) are included in the `.claude/commands/` folder and become available when you use this project's Claude Code integration.

## 🎯 Memory Management

Goldfish uses a two-tier memory system:

### 📝 Quick Notes (24 hours)
- **"Remember: API rate limit is 1000/hour"** - Stores temporary reminders
- **"Note: Database migration needs rollback plan"** - Quick context notes
- Auto-expires after 24 hours to keep things fresh

### 💾 Checkpoints (3 days)  
- **"Completed user authentication with OAuth2 integration"** - Major progress markers
- **"Fixed critical bug in payment processing"** - Important milestones
- Kept for 3 days, then archived (but searchable)

### 🔄 Why This Works
- **Short-term memory** (24h) for immediate context and quick thoughts
- **Recent work** (72h) prioritized in searches and timelines  
- **All history** remains searchable but doesn't clutter daily views

## 💡 Real Usage Examples

### Morning Startup
```
You: "What was I working on yesterday?"
Goldfish: Shows timeline with:
- Completed JWT implementation  
- Started API documentation
- Fixed 3 unit tests
- TODO: Review security audit
```

### Mid-Day Check-in  
```
You: "What's my progress on the authentication system?"
Goldfish: Searches and finds:
- "JWT token validation complete" (2 days ago)
- "OAuth2 integration in progress" (yesterday) 
- "Need to add refresh token logic" (TODO item)
```

### End of Day
```
You: "/checkpoint Finished OAuth2 integration, all tests passing"
Goldfish: Saves checkpoint with:
- Your description
- Files you were editing
- Current git branch
- Links to related TODOs
```

### Weekly Review
```
You: "Summarize what I accomplished this week"
Goldfish: Creates AI summary:
- 15 checkpoints across 3 projects
- Key areas: authentication, API design, testing
- Major achievements: OAuth2 system, security audit
- Files involved: AuthService.ts, api-routes.js, etc.
```

## 🔄 Integration with Other Tools

### ProjectKnowledge MCP
- **Goldfish**: Short-term working memory (hours/days)
- **ProjectKnowledge**: Long-term knowledge base (weeks/months)
- Important Goldfish memories automatically promote to ProjectKnowledge

### CodeSearch MCP  
- **CodeSearch**: Find code and analyze structure
- **Goldfish**: Track what you worked on and why
- Perfect combination for understanding both "what" and "when"

### Claude Code Integration
- **Automatic session restoration** on startup
- **Custom slash commands** for common workflows
- **Natural language processing** - just ask questions
- **Context-aware checkpointing** after significant work

## 🏗 How It Works (Technical Overview)

### Event-Source Architecture
Every action is stored as an immutable event:
```
~/.coa/goldfish/{workspace}/
├── checkpoints/2025-01-20/
│   ├── 20250120-143022-456-A1B2.json
│   └── 20250120-150815-123-C3D4.json  
├── todos/active-lists.json
└── memories/quick-notes.json
```

### Workspace-Aware Storage
Each project gets its own memory space, but you can query across all projects for standups and reviews.

### Smart Search & Timeline
- **Fuzzy search** finds relevant work even with typos
- **Time-based filtering** focuses on recent work
- **Cross-project queries** for comprehensive overviews
- **Natural language processing** understands your questions

## 🧪 Testing & Development

```bash
# Run all tests
npm test

# Test specific components  
npm test tools.test.ts
npm test integration.test.ts
npm test date-handling.test.ts

# Development with live reload
npm run dev
```

**Test Coverage**: 51 tests covering all major functionality including edge cases, concurrent operations, and error handling.

## 🤖 AI Agent Optimization

Goldfish is designed to work seamlessly with AI coding assistants:

- **Proactive checkpointing** - AI agents automatically save progress
- **Context restoration** - Agents can resume work intelligently  
- **Task tracking** - Automatic TODO management during coding sessions
- **Cross-session memory** - Agents remember work across conversations

## 🎯 Philosophy

> "A goldfish's memory is actually about 3 months, not 3 seconds. For developers, 3 days of working memory is perfect - enough context to be useful, short enough to stay relevant."

Goldfish embraces forgetting as a feature. By automatically expiring old memories, it keeps your working context fresh and focused on what matters now.

## 📄 License

MIT License - Feel free to adapt for your workflow!

---

**Questions?** Just ask Goldfish naturally - it's designed to understand what you need and help you stay productive.