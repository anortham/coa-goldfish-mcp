# COA Goldfish MCP - Developer Instructions

## Core Architecture
- **TypeScript/Node.js** project with MCP SDK
- **JSON file storage** - no database overhead
- **Workspace-aware** - follows COA pattern like CodeSearch
- **Auto-expiration** - memories expire after 24h (configurable)

## Development Guidelines

### Testing Framework
- Use **Jest** for testing
- Use `npm test` to run tests
- Use `npm run dev` for development with live reload

### Build Process
```bash
# Development
npm run dev          # Run with tsx (live reload)

# Production  
npm run build        # TypeScript compilation
npm start           # Run built version

# Testing
npm test            # Run Jest tests
npm run lint        # ESLint checking
```

### Code Standards
- **TypeScript strict mode** enabled
- **ESM modules** - use import/export syntax
- **Error handling** - graceful failures, never crash
- **Workspace detection** - auto-detect from git root or directory name

### Storage Pattern
- **~/.coa/goldfish/memories/{workspace}/** - per-workspace storage
- **~/.coa/goldfish/memories/global/** - cross-project memories
- **JSON files** named with chronological IDs (YYYYMMDDHHMMSS-RANDOM)
- **Auto-cleanup** - max 50 memories per workspace

### MCP Tool Development
- All tools inherit from standard MCP patterns
- Tool descriptions optimized for **proactive AI agent usage**
- Include trigger words like "ALWAYS", "Proactively", "Immediately" 
- Clear parameter schemas with comprehensive validation
- Handle errors gracefully with user-friendly messages
- Extensive test coverage for all tool handlers

### Memory Management Rules
- **24h default TTL** - memories expire automatically
- **Workspace isolation** - each project gets own memory space
- **Cross-workspace queries** - support for standup-style reporting
- **Chronological sorting** - newest memories first

### Integration Points
- **ProjectKnowledge MCP** - for long-term knowledge storage via federation API
- **Custom Commands** - `/checkpoint` and `/resume` for structured workflows
- **Claude Code Integration** - seamless MCP tool usage

### Workspace Resolution
Uses same pattern as ProjectKnowledge:
1. Try git root detection first
2. Fall back to current directory name
3. Normalize to lowercase-with-hyphens
4. Store per workspace like CodeSearch indexes

### Tool Usage Patterns

#### For Development Work
```typescript
// Store temporary context
remember("Working on MCP tool refactor - updated schema validation")

// Mark TODOs
remember("TODO: Add better error messages", { type: "todo" })

// Create checkpoints
snapshot({ label: "Tool refactor complete" })
```

#### For Standups
```typescript
// See yesterday's work across all projects
recall({ scope: "all", since: "24h", type: "checkpoint" })

// Current project status
recall({ type: "todo" })  // Pending tasks
```

#### For Session Continuity
```typescript
// Before ending session
snapshot({ label: "End of day", description: "Completed tool schema, ready for testing" })

// Next session
recall({ type: "checkpoint", limit: 1 })  // Get latest checkpoint
```

### Error Handling Philosophy
- **Never crash** - always return graceful error messages
- **Self-healing** - auto-remove corrupted files
- **Informative** - tell user what went wrong and how to fix
- **Workspace-aware** - show which workspace had the issue

### Performance Guidelines
- **Lazy loading** - only read files when needed
- **Smart filtering** - filter after loading for better UX
- **Async operations** - use proper async/await patterns
- **Memory limits** - enforce per-workspace limits

### Development Workflow
1. Make changes to TypeScript files
2. Test with `npm run dev`
3. Run tests with `npm test`
4. Build with `npm run build`
5. Test built version with `npm start`

### Integration Testing
Test with ProjectKnowledge MCP:
1. Start both MCP servers
2. Use hooks to trigger automatic memory storage
3. Verify cross-workspace queries work
4. Test standup scenarios

### Memory Types
- **general**: Default working memory
- **todo**: Task tracking
- **checkpoint**: Session snapshots
- **context**: Conversation context

### Deployment
- **Global installation**: `npm install -g .`
- **Local development**: `npm run dev`
- **Production**: `npm start`

## File Structure
```
src/
├── index.ts           # Main MCP server with all 10 tool implementations
└── tests/            # Jest test suite
    ├── core.test.ts           # Core functionality tests
    ├── tools.test.ts          # Tool handler tests  
    ├── integration.test.ts    # Integration and workflow tests
    └── edge-cases.test.ts     # Edge cases and error handling tests

commands/             # Custom Claude Code commands (owned by this project)
├── checkpoint.md     # /checkpoint command - structured session snapshots
└── resume.md        # /resume command - session restoration workflow

dist/                 # Compiled JavaScript
package.json          # Dependencies and scripts with test scripts
tsconfig.json         # TypeScript configuration
jest.config.js        # Jest test configuration
eslint.config.js      # ESLint configuration
README.md            # User documentation with AI agent patterns
AI_AGENT_GUIDE.md    # Proactive usage guide for AI agents
```

## Common Tasks

### Adding New Memory Types
1. Update the enum in tool schemas
2. Add appropriate icons in recall output
3. Update README examples
4. Add tests for new type

### Workspace Debugging
- Check `~/.coa/goldfish/memories/` for actual files
- Verify workspace detection with `process.cwd()` and git root
- Use scope: "all" to see cross-workspace memories

### Performance Optimization
- Monitor file counts per workspace (max 50)
- Check memory cleanup frequency
- Profile cross-workspace queries for large datasets

## Testing Checklist
- [x] Workspace detection works (git and non-git) - `core.test.ts`
- [x] Memory storage and retrieval - `core.test.ts` 
- [x] Cross-workspace queries - `integration.test.ts`
- [x] Auto-expiration and cleanup - `integration.test.ts`
- [x] Error handling for corrupted files - `edge-cases.test.ts`
- [x] Time filtering (since parameter) - `tools.test.ts`
- [x] Global vs workspace-specific memories - `integration.test.ts`
- [x] All 10 tool handlers - `tools.test.ts`
- [x] Session save/restore workflows - `integration.test.ts`
- [x] TODO list lifecycle - `integration.test.ts` 
- [x] ProjectKnowledge promotion logic - `integration.test.ts`
- [x] Concurrent operations handling - `edge-cases.test.ts`
- [x] Network failure resilience - `edge-cases.test.ts`

Run tests with: `npm test`