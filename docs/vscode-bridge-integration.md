# VS Code Bridge Integration for Goldfish MCP

## Overview
The @coa/mcp-vscode-bridge enables bi-directional communication between Goldfish MCP and VS Code, creating a seamless development experience where your coding context is automatically tracked and preserved.

## Integration Benefits

### 1. Automatic Context Tracking
- **Active File Monitoring**: Goldfish automatically knows which files you're working on
- **Save-triggered Checkpoints**: Create checkpoints when you save significant changes
- **Branch Awareness**: Automatically track git branch switches
- **Workspace Detection**: Know which VS Code workspace/folder is active

### 2. VS Code UI Integration
- **Status Bar Widget**: Show current Goldfish session and checkpoint count
- **Command Palette**: Quick access to Goldfish unified tools (checkpoint, todo, plan, standup)
- **Notifications**: Important memories or session restorations
- **CodeLens**: Inline hints about related memories in your code

### 3. Enhanced Memory Context
- **Editor State**: Remember cursor positions, open tabs, and panel layouts
- **Search History**: Track what you searched for in files
- **Terminal Commands**: Optionally capture terminal history
- **Debug Sessions**: Remember breakpoints and debug configurations

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   VS Code   │────▶│  MCP VS Code     │────▶│   Goldfish   │
│  Extension  │◀────│     Bridge       │◀────│  MCP Server  │
└─────────────┘     └──────────────────┘     └──────────────┘
      ▲                                              │
      │                                              ▼
      └──────────────── Events ──────────────▶ Memory Storage
                    (file saves, etc.)           (~/.coa/goldfish)
```

## Implementation Plan

### Phase 1: Basic Integration
```typescript
// src/vscode-bridge/index.ts
import { VSCodeBridge } from '@coa/mcp-vscode-bridge';
import { GoldfishServer } from '../index';

export class GoldfishVSCodeBridge {
  private bridge: VSCodeBridge;
  private goldfish: GoldfishServer;

  constructor() {
    this.bridge = new VSCodeBridge({
      serverId: '@coa/goldfish-mcp',
      displayName: 'Goldfish Memory'
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Auto-checkpoint on file save
    this.bridge.on('fileSaved', async (event) => {
      if (this.isSignificantFile(event.filePath)) {
        await this.goldfish.checkpoint({
          description: `Saved ${path.basename(event.filePath)}`,
          activeFiles: [event.filePath],
          workContext: event.documentContent?.substring(0, 200)
        });
      }
    });

    // Track active file changes
    this.bridge.on('activeEditorChanged', async (event) => {
      await this.goldfish.updateContext({
        currentFile: event.filePath,
        cursorPosition: event.position
      });
    });

    // Handle workspace changes
    this.bridge.on('workspaceChanged', async (event) => {
      await this.goldfish.switchWorkspace(event.workspacePath);
    });
  }

  private isSignificantFile(filePath: string): boolean {
    // Skip auto-save for config files, node_modules, etc.
    const ignoredPatterns = [
      /node_modules/,
      /\.git/,
      /package-lock\.json/,
      /\.log$/
    ];
    
    return !ignoredPatterns.some(pattern => pattern.test(filePath));
  }
}
```

### Phase 2: Status Bar Integration
```typescript
// Show current session info in VS Code status bar
this.bridge.setStatusBar({
  text: `$(database) Goldfish: ${checkpointCount} checkpoints`,
  tooltip: `Current session: ${sessionId}\nLast checkpoint: ${lastCheckpointTime}`,
  command: 'goldfish.showMenu'
});

// Update on checkpoint creation
this.goldfish.on('checkpointCreated', () => {
  this.updateStatusBar();
});
```

### Phase 3: Command Palette Integration
```typescript
// Register VS Code commands
this.bridge.registerCommand('goldfish.checkpoint', async () => {
  const description = await this.bridge.showInputBox({
    prompt: 'Checkpoint description',
    placeholder: 'What did you just complete?'
  });
  
  if (description) {
    await this.goldfish.checkpoint({ description });
    this.bridge.showInformationMessage('✅ Checkpoint saved!');
  }
});

this.bridge.registerCommand('goldfish.checkpoint', async () => {
  const session = await this.goldfish.checkpoint({ action: 'restore' });
  const quickPick = memories.map(m => ({
    label: m.content,
    description: new Date(m.timestamp).toLocaleString(),
    detail: m.workspace
  }));
  
  const selected = await this.bridge.showQuickPick(quickPick, {
    placeHolder: 'Recent memories'
  });
  
  if (selected) {
    // Navigate to related file or show details
  }
});
```

### Phase 4: Advanced Features

#### CodeLens Integration
```typescript
// Show inline hints about related memories
this.bridge.registerCodeLensProvider({
  provideCodeLenses: async (document) => {
    const memories = await this.goldfish.searchHistory({
      query: document.fileName,
      limit: 3
    });
    
    return memories.map(memory => ({
      range: new Range(0, 0, 0, 0),
      command: {
        title: `📝 ${memory.content}`,
        command: 'goldfish.showMemory',
        arguments: [memory.id]
      }
    }));
  }
});
```

#### Automatic Session Detection
```typescript
// Detect coding sessions based on activity
let lastActivity = Date.now();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

this.bridge.on('userActivity', () => {
  const now = Date.now();
  
  if (now - lastActivity > SESSION_TIMEOUT) {
    // New session detected
    this.goldfish.startNewSession();
    this.bridge.showInformationMessage(
      '🐠 Welcome back! Starting new Goldfish session.'
    );
  }
  
  lastActivity = now;
});
```

## Configuration Options

```json
{
  "goldfish.autoCheckpoint": {
    "enabled": true,
    "minInterval": 300000,  // 5 minutes minimum between auto-checkpoints
    "significantFiles": ["*.ts", "*.js", "*.py", "*.cs"],
    "excludePatterns": ["*.test.*", "*.spec.*"]
  },
  "goldfish.statusBar": {
    "enabled": true,
    "showSessionId": false,
    "showCheckpointCount": true
  },
  "goldfish.notifications": {
    "onCheckpoint": true,
    "onSessionRestore": true,
    "onMemoryLimit": true
  }
}
```

## Use Cases

### 1. Automatic Work Journal
Every time you save a significant file, Goldfish creates a checkpoint with context about what you were working on. No manual intervention needed.

### 2. Crash Recovery
If VS Code crashes or you need to restart, Goldfish can restore your exact context including open files, cursor positions, and recent work.

### 3. Daily Standup Helper
Quick command to generate standup notes from yesterday's checkpoints:
```
Cmd+Shift+P → "Goldfish: Generate Standup Notes"
```

### 4. Context Switching
When switching between projects or branches, Goldfish automatically saves and restores the appropriate context.

### 5. Pair Programming
Share your Goldfish session ID with a teammate so they can see your recent work context and checkpoints.

## Security Considerations

1. **File Content**: Only store file paths and minimal context, not full file contents
2. **Sensitive Data**: Exclude files matching .gitignore patterns by default
3. **Workspace Isolation**: Keep memories isolated per workspace
4. **User Consent**: Ask before enabling automatic tracking features

## Future Enhancements

1. **VS Code Settings Sync**: Sync Goldfish memories across devices
2. **Team Sharing**: Share checkpoints with team members
3. **AI Suggestions**: Use memories to provide coding suggestions
4. **Time Tracking**: Automatic time tracking per file/feature
5. **Visual Timeline**: Graphical view of your work history in VS Code

## Verified Functionality (2025-08-31)

✅ **Timeline Visualization**: Successfully displays rich activity data with highlights, checkpoints, and cross-workspace reporting  
✅ **Search Results**: Proper formatting with relevance scoring and comprehensive result display  
✅ **TODO Lists**: Data grid visualization with progress tracking, completion percentages, and task management  
✅ **Bridge Stability**: Robust connection handling with responsive data flow and error recovery  
✅ **Data Transmission**: All three visualization types tested and working flawlessly

### Testing Results
- **Connection Stability**: Excellent - bridge responds quickly and handles data flow seamlessly
- **Timeline Display**: Rich activity data with 14+ checkpoints showing clear work progression
- **Search Functionality**: Returns properly formatted results with relevance scoring (0.48, 0.17 range)
- **TODO Integration**: Comprehensive data grid showing 8 active lists with detailed progress tracking
- **Error Handling**: Graceful fallback when bridge unavailable, no crashes or data loss

## Getting Started

1. Install the VS Code Goldfish extension (when available)
2. Configure your preferences in VS Code settings
3. Start coding - Goldfish automatically tracks your work
4. Use Command Palette for manual checkpoints and session restoration

## API Reference

The bridge will expose these methods to VS Code:

- `checkpoint(description: string, context?: object): Promise<void>`
- `checkpoint(args: CheckpointArgs): Promise<CheckpointResponse>`
- `timeline(since?: string): Promise<TimelineData>`
- `switchWorkspace(path: string): Promise<void>`
- `getCurrentSession(): Promise<SessionInfo>`