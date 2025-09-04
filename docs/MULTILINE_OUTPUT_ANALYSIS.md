# Multi-Line Output Collapse: Root Cause Analysis & Solution

**Date:** August 20, 2025  
**Projects Analyzed:** COA ProjectKnowledge MCP (.NET) vs COA Goldfish MCP (TypeScript)  
**Issue:** Multi-line tool outputs collapse to single lines in Goldfish, display correctly in ProjectKnowledge

---

## Executive Summary

After deep investigation of both MCP implementations, the root cause of multi-line output collapse in Goldfish has been identified as a **response format structural difference**. ProjectKnowledge uses the COA MCP Framework which serializes entire structured objects as single JSON strings, preserving newlines. Goldfish uses the standard MCP protocol format with fragmented content arrays, causing AI agents to collapse multi-line text.

**Impact:** Timeline displays, session restore output, and todo lists become unreadable  
**Solution:** Restructure Goldfish responses to match ProjectKnowledge's pattern  
**Effort:** Medium - requires updating 3-4 key tools but follows clear pattern

---

## Root Cause Analysis

### The Critical Difference

**ProjectKnowledge (.NET) - ✅ WORKS:**
```json
{
  "content": [
    {
      "type": "text", 
      "text": "{\"formattedTimeline\":\"# Timeline\\n*8 items found*\\n\\n## Today\\n\\n### [WorkNote] 12 hours ago\\nUpdated hooks...\"}"
    }
  ]
}
```

**Goldfish (TypeScript) - ❌ COLLAPSES:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "📍 RESUMING FROM CHECKPOINT\n═══════════════════════════════\n\n🌟 Session Highlights:\n   ✨ Fixed authentication\n   ✨ Added validation"
    }
  ]
}
```

### Why ProjectKnowledge Works

1. **Structured Object Serialization**: The entire result object gets JSON-serialized as a single string
2. **Framework Handling**: `McpToolRegistry.CreateSuccessResult()` calls `JsonSerializer.Serialize(result, _jsonOptions)`
3. **AI Agent Processing**: Agents parse the JSON, extract specific properties like `formattedTimeline`, and display with preserved formatting

### Why Goldfish Fails

1. **Direct String Return**: Multi-line strings returned directly in MCP `content.text` format
2. **No Structure**: AI agents receive plain text without parsing hints
3. **Collapse Behavior**: AI display systems collapse multi-line plain text by default

---

## Framework Architecture Comparison

### COA MCP Framework (.NET) - ProjectKnowledge

**Tool Execution Flow:**
```
GetTimelineTool.ExecuteInternalAsync() 
  → Returns GetTimelineResult { FormattedTimeline: "multi\nline\ntext", ... }
  → McpServer.HandleCallToolAsync()
  → McpToolRegistry.CallToolAsync() 
  → CreateSuccessResult(result) 
  → JsonSerializer.Serialize(result) // ← KEY: Entire object serialized
  → Wraps as MCP content[].text
```

**Key Code Path (McpToolRegistry.cs:349):**
```csharp
content = JsonSerializer.Serialize(result, _jsonOptions);
```

**Result Structure:**
```csharp
public class GetTimelineResult : ToolResultBase 
{
    public string FormattedTimeline { get; set; } = string.Empty; // ← Dedicated formatted field
    public List<TimelineEntry> Timeline { get; set; } = new();     // Raw data
    public int TotalCount { get; set; }
    // ...
}
```

### Standard MCP Protocol - Goldfish

**Tool Execution Flow:**
```
SessionTools.restoreSession() 
  → Builds output array: ["line1", "line2", "line3"]
  → output.join('\n') 
  → Returns { content: [{ type: 'text', text: joinedString }] } // ← Direct string
```

**Current Goldfish Pattern:**
```typescript
// session.ts:133-140
return {
  content: [
    {
      type: 'text',
      text: output.join('\n')  // ← Plain multi-line string
    }
  ]
};
```

---

## Impact Analysis on Goldfish Tools

### Affected Tools

1. **SessionTools.restoreSession()** - Complex formatted output with headers, highlights, and structure
2. **SessionTools.summarizeSession()** - Multi-line timeline summaries  
3. **Future Timeline Tool** - If implemented, would suffer same issue
4. **Any tool returning structured lists or formatted output**

### Example Problem in session.ts

**Current Implementation (lines 78-140):**
```typescript
const output = [
  '═══════════════════════════════════════════════════════════',
  '📍 RESUMING FROM CHECKPOINT', 
  '═══════════════════════════════════════════════════════════',
  // ...more lines
];

return {
  content: [
    {
      type: 'text',
      text: output.join('\n')  // ← This collapses in AI agents
    }
  ]
};
```

**What AI Agents Receive:**
- Plain string with `\n` characters
- No structural parsing hints
- Gets collapsed to single line in display

---

## Solution Strategy

### Option 1: Match ProjectKnowledge Pattern ⭐ **RECOMMENDED**

Restructure Goldfish tool responses to return structured objects that get JSON-serialized, following ProjectKnowledge's successful pattern.

### Option 2: Port to COA MCP Framework

Convert Goldfish from TypeScript to .NET using COA MCP Framework. More work but guaranteed compatibility.

---

## Implementation Plan for Option 1

### Step 1: Create Response Interfaces

**File: `src/types/responses.ts`** (new file)
```typescript
export interface FormattedResponse {
  success: boolean;
  operation: string;
  formattedOutput?: string;  // ← Key: dedicated formatted text
  data?: any;
  meta?: {
    mode: string;
    tokens?: number;
  };
}

export interface SessionRestoreResponse extends FormattedResponse {
  operation: 'session-restore';
  sessionId?: string;
  depth: string;
  checkpointsFound: number;
}
```

### Step 2: Update SessionTools.restoreSession()

**File: `src/tools/session.ts`** - Replace return at line 133:

```typescript
// OLD - Direct string return
return {
  content: [
    {
      type: 'text',
      text: output.join('\n')
    }
  ]
};

// NEW - Structured object return  
const response: SessionRestoreResponse = {
  success: true,
  operation: 'session-restore',
  formattedOutput: output.join('\n'),  // ← Preserve as structured field
  sessionId: sessionId || 'latest',
  depth,
  checkpointsFound: targetMemories.length,
  data: targetMemories.slice(0, 3), // Sample data
  meta: {
    mode: 'formatted'
  }
};

return {
  content: [
    {
      type: 'text', 
      text: JSON.stringify(response, null, 2)  // ← Serialize entire object
    }
  ]
};
```

### Step 3: Update SessionTools.summarizeSession()

Similar pattern for `summarizeSession()` method around line 189.

### Step 4: Update Future Timeline Tools

Apply same pattern to any timeline or multi-line output tools.

### Step 5: Verification Strategy

1. **Test Multi-line Preservation**: Verify `\n` characters preserved in JSON
2. **AI Agent Testing**: Confirm agents can parse and display formatted output
3. **Compare with ProjectKnowledge**: Ensure similar display behavior

---

## Code Examples

### Before Fix (Current Goldfish)

```typescript
// Direct string return - COLLAPSES
const summaryLines = [
  '📊 Session Summary',
  '════════════════',
  '',
  '🎯 Key Achievements:',
  '  ✅ Fixed authentication bug',
  '  ✅ Added input validation',
  '  ✅ Updated documentation',
  '',
  '📝 Next Steps:',
  '  🔲 Deploy to staging',
  '  🔲 Run integration tests'
];

return {
  content: [{
    type: 'text', 
    text: summaryLines.join('\n')  // ← Gets collapsed
  }]
};
```

### After Fix (Structured Response)

```typescript
// Structured object return - PRESERVES FORMATTING
const summaryLines = [
  '📊 Session Summary',
  '════════════════',
  // ... same content
];

const response = {
  success: true,
  operation: 'session-summary',
  formattedOutput: summaryLines.join('\n'), // ← Structured field
  data: {
    achievements: ['Fixed auth', 'Added validation', 'Updated docs'],
    nextSteps: ['Deploy staging', 'Run tests'],
    sessionDuration: '2.5 hours'
  },
  meta: { mode: 'formatted', lines: summaryLines.length }
};

return {
  content: [{
    type: 'text',
    text: JSON.stringify(response, null, 2)  // ← AI agent parses this
  }]
};
```

---

## Technical Deep Dive

### MCP Protocol JSON Structure

Both implementations return MCP `CallToolResult`:
```json
{
  "content": [
    {
      "type": "text",
      "text": "..." // ← Difference is in what goes here
    }
  ]
}
```

### ProjectKnowledge Advantage

**Serialized Object in `text` field:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"success\":true,\"formattedTimeline\":\"# Timeline\\n## Today\\n### Item 1\\n### Item 2\"}"
    }
  ]
}
```

**AI Agent Processing:**
1. Parses JSON from `text` field
2. Extracts `formattedTimeline` property  
3. Displays with preserved `\n` → proper formatting

### Current Goldfish Limitation

**Plain String in `text` field:**
```json
{
  "content": [
    {
      "type": "text", 
      "text": "# Timeline\n## Today\n### Item 1\n### Item 2"
    }
  ]
}
```

**AI Agent Processing:**
1. Receives plain string
2. No parsing hints
3. Default collapse behavior → single line display

---

## Testing & Validation

### Test Cases

1. **Newline Preservation**: Verify `\n` characters in JSON strings
2. **Object Structure**: Confirm JSON parsing works correctly  
3. **AI Agent Display**: Test with actual AI agents for proper formatting
4. **Backwards Compatibility**: Ensure existing functionality works

### Validation Commands

```bash
# Test session restore with different depths
echo '{"method": "tools/call", "params": {"name": "restore_session", "arguments": {"depth": "full"}}}' | node dist/index.js

# Verify JSON structure
node -e "console.log(JSON.stringify({formattedOutput: 'line1\nline2\nline3'}, null, 2))"
```

---

## Risk Assessment

### Low Risk
- **Minimal Code Changes**: Only affects return statements
- **No Breaking Changes**: Same MCP protocol compliance
- **Reversible**: Easy to rollback if issues arise

### Mitigation Strategies
- **Staged Rollout**: Test one tool at a time
- **Feature Flag**: Add option to use old vs new format
- **Comprehensive Testing**: Both unit and integration tests

---

## Timeline & Effort

### Phase 1: Core Implementation (4-6 hours)
- [ ] Create response interfaces
- [ ] Update SessionTools methods
- [ ] Basic testing

### Phase 2: Testing & Refinement (2-4 hours)  
- [ ] AI agent testing
- [ ] Edge case handling
- [ ] Documentation updates

### Phase 3: Additional Tools (as needed)
- [ ] Apply pattern to other multi-line tools
- [ ] Timeline tool (if/when implemented)

**Total Effort:** 1-2 days for complete fix

---

## Success Criteria

1. **✅ Multi-line Displays**: Session restore shows proper formatting with headers, sections, and indentation
2. **✅ AI Agent Compatibility**: Works correctly with Claude Code and other AI agents  
3. **✅ JSON Parsing**: Agents can extract and display `formattedOutput` fields correctly
4. **✅ No Regressions**: Existing functionality continues to work
5. **✅ Consistent Pattern**: All multi-line tools use same structured response format

---

## Conclusion

The multi-line output collapse in Goldfish is caused by a fundamental difference in response structure compared to the successful COA MCP Framework pattern. By restructuring tool responses to return serialized objects with dedicated formatted fields, Goldfish can achieve the same reliable multi-line display behavior as ProjectKnowledge.

This fix requires minimal code changes, carries low risk, and provides immediate benefits for tool usability. The solution follows proven patterns from the working .NET implementation and maintains full MCP protocol compliance.

**Recommendation:** Implement Option 1 (structured response pattern) for immediate resolution with minimal effort and maximum compatibility.