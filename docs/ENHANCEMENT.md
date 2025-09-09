# Goldfish MCP Enhancement Strategy

> From memory tool to development workflow orchestrator

## Executive Summary

Goldfish MCP has solid architecture and partial behavioral adoption implementation, but it's not fully leveraging its unique position as the **workflow orchestrator** of the development ecosystem. While it provides persistent memory and session management, it should actively teach Claude **checkpoint-driven development** and **structured planning methodology**.

**Key Insight:** Goldfish is perfectly positioned to be the tool that teaches Claude how to work in structured, organized patterns that persist across sessions and crashes.

## Current State Assessment

### What's Already Implemented ✅

1. **Framework Integration** - Using COA MCP Framework properly
2. **Behavioral Template Variables** - Configured with tool comparisons
3. **Enforcement Level** - Set to StronglyUrge 
4. **Tool Priorities** - Logical ordering of tool importance
5. **Workspace Detection** - SQLite-backed persistent storage
6. **Cross-Platform Support** - Works on Windows, macOS, Linux

### What Needs Enhancement ⚠️

1. **Generic Tool Descriptions** - No methodology teaching in individual tools
2. **Minimal Template** - Fallback template lacks depth
3. **No Checkpoint Discipline** - Doesn't enforce when to checkpoint
4. **No Planning Methodology** - Plan tool doesn't teach planning practices
5. **No Workflow Patterns** - Doesn't guide structured development approaches

## Goldfish's Role in the Ecosystem

### The Workflow Orchestrator

Goldfish should be the tool that teaches Claude **how to work systematically**:

- **CodeSearch/CodeNav** teach technical practices (search first, verify types)
- **TestStatus** teaches quality practices (test-first, real testing)
- **Goldfish** teaches workflow practices (plan, checkpoint, structure)

### Core Methodology: Checkpoint-Driven Development

**The Philosophy:**
Instead of ad-hoc development, Goldfish should promote systematic, recoverable workflows:

1. **Plan Before Code** - Always start with a plan
2. **Checkpoint After Progress** - Save state after meaningful work
3. **Structure Tasks** - Break work into manageable todos
4. **Review Progress** - Regular standups and retrospectives
5. **Learn from History** - Search past work to avoid repeated mistakes

## Enhancement Plan

### Phase 1: Strengthen Tool Descriptions (High Priority - 3 days)

#### 1.1 CheckpointTool Enhancement

**Current Description:**
```csharp
public override string Description => "Save and restore session state with workspace detection";
```

**Enhanced Description:**
```csharp
[ToolDescription(@"Save and restore session state following checkpoint-driven development methodology.

CHECKPOINT DISCIPLINE - MANDATORY PRACTICES:
✅ Checkpoint after completing meaningful work (feature, bug fix, refactor)
✅ Checkpoint before risky changes (major refactors, architecture changes)
✅ Checkpoint before breaks/end of session to maintain context
✅ Always include description that captures WHAT was accomplished and WHY

CHECKPOINT WORKFLOW:
1. Completed significant work → checkpoint with clear description
2. About to make risky changes → checkpoint current stable state
3. Session ending → checkpoint progress and next steps
4. Resuming work → restore to understand context

DISCIPLINE ENFORCEMENT:
- Never leave work without checkpointing
- Always describe the business value accomplished  
- Include active files and current branch context
- Link to related todos and plans

This tool builds persistent development habits that survive crashes and context switches.")]
```

#### 1.2 TodoTool Enhancement

**Enhanced Description:**
```csharp
[ToolDescription(@"Manage tasks with structured todo methodology for systematic development.

TODO-DRIVEN DEVELOPMENT:
✅ Break large features into concrete, actionable tasks
✅ Use 'active' and 'latest' keywords for quick access
✅ Mark tasks complete IMMEDIATELY when finished
✅ Create new lists for major features or bug investigations

TASK STRUCTURING PRINCIPLES:
- Each task should be completable in 2-4 hours max
- Tasks should be verifiable (clear done criteria)
- High-priority tasks go to 'active' list
- Related tasks should be grouped in same list

WORKFLOW INTEGRATION:
- Start feature → create todo list → work systematically
- Bug found → create investigation todo list
- Daily standup → review active tasks and progress

This tool enforces systematic task management over chaotic development.")]
```

#### 1.3 PlanTool Enhancement

**Enhanced Description:**
```csharp
[ToolDescription(@"Create strategic plans with structured methodology for complex features and architecture.

STRATEGIC PLANNING METHODOLOGY:
✅ ALWAYS plan before implementing complex features (3+ files, new patterns)
✅ Include problem statement, approach, risks, and success criteria
✅ Break into phases with concrete deliverables
✅ Generate todos automatically from plan items

PLANNING WORKFLOW:
1. Complex feature requested → create strategic plan first
2. Define problem clearly → research existing patterns
3. Design approach → identify risks and dependencies
4. Break into phases → generate concrete todos
5. Execute systematically → update plan with lessons learned

PLAN CATEGORIES:
- 'feature': New functionality development
- 'architecture': System design and refactoring
- 'research': Investigation and spike work
- 'bugfix': Complex bug resolution strategies

This tool prevents chaotic feature development through disciplined planning.")]
```

### Phase 2: Behavioral Template Enhancement (Medium Priority - 2 days)

#### 2.1 Create Comprehensive Template

Replace the minimal fallback with a robust behavioral adoption template:

```scriban
# Goldfish MCP - Checkpoint-Driven Development Orchestrator

## Development Workflow Methodology

Goldfish teaches Claude systematic development practices that persist across sessions:

### MANDATORY Checkpoint Discipline ({{enforcement_level}})

**When to Checkpoint:**
- ✅ After completing meaningful work (feature implementation, bug fix)
- ✅ Before risky changes (major refactors, architecture modifications)
- ✅ Before breaks or end of session
- ✅ When context switches between projects

**Checkpoint Quality Standards:**
- Always include business value description
- Capture active files and current branch
- Link to related todos and plans
- Include next steps for resumption

### Structured Planning Protocol

**For Complex Features (3+ files, new patterns):**
1. Create strategic plan BEFORE coding
2. Define problem, approach, risks, success criteria
3. Break into concrete phases with deliverables
4. Generate actionable todos from plan
5. Execute systematically with regular plan updates

### Task Management Discipline

**Todo-Driven Development:**
- Break large work into 2-4 hour tasks
- Use descriptive, actionable task descriptions
- Mark complete IMMEDIATELY when finished
- Group related tasks in themed lists
- Use 'active' and 'latest' keywords for efficiency

### Workflow Integration with Other Tools

{{#each tool_comparisons}}
**{{task}}:**
- Use {{server_tool}} for {{advantage}}
- Avoids limitations of {{built_in_tool}}: {{limitation}}
- Performance benefit: {{performance_metric}}
{{/each}}

### Cross-Session Continuity

Goldfish ensures work survives:
- ✅ Application crashes and restarts
- ✅ Context switches and interruptions  
- ✅ Multi-day development sessions
- ✅ Team handoffs and collaboration

## Professional Development Patterns

### Bug Investigation Pattern
1. Bug discovered → create investigation plan
2. Generate todo list for reproduction steps
3. Checkpoint findings at each step
4. Final checkpoint with solution and lessons

### Feature Development Pattern  
1. Feature request → strategic plan creation
2. Plan generates implementation todos
3. Systematic execution with regular checkpoints
4. Completion checkpoint with retrospective

### Refactoring Pattern
1. Identify refactoring need → create refactoring plan
2. Checkpoint stable state before changes
3. Incremental refactoring with frequent checkpoints
4. Final checkpoint with before/after comparison

This systematic approach prevents chaotic development and builds maintainable habits.
```

#### 2.2 Template Resource Integration

Ensure the template is properly embedded and loaded:

```csharp
// In Program.cs, improve template loading
var resourceName = "COA.Goldfish.McpServer.Templates.goldfish-methodology.scriban";

using (var stream = assembly.GetManifestResourceStream(resourceName))
{
    if (stream == null)
    {
        Log.Error("Critical: Behavioral adoption template not found: {ResourceName}", resourceName);
        throw new InvalidOperationException($"Required template resource not found: {resourceName}");
    }
    
    using (var reader = new StreamReader(stream))
    {
        templateContent = await reader.ReadToEndAsync();
        Log.Information("Loaded comprehensive behavioral adoption template ({Length} chars)", templateContent.Length);
    }
}
```

### Phase 3: Workflow Pattern Enhancement (Low Priority - 2 days)

#### 3.1 Add Workflow Guidance Tools

**StandupTool Enhancement:**
```csharp
[ToolDescription(@"Generate professional development progress reports with structured methodology.

STANDUP METHODOLOGY:
- Daily: What was accomplished yesterday, what's planned today, any blockers
- Weekly: Major achievements, key decisions, lessons learned across projects
- Project: Comprehensive retrospective with metrics and insights

PROFESSIONAL REPORTING:
✅ Focus on business value delivered, not just tasks completed
✅ Identify patterns in productivity and blockers
✅ Track technical debt and quality improvements
✅ Measure progress against strategic plans

This tool creates accountability and continuous improvement in development practices.")]
```

#### 3.2 Proactive Workflow Suggestions

Add logic to suggest workflow improvements:

```csharp
public class WorkflowSuggestionService
{
    public static List<string> GetWorkflowSuggestions(SessionContext context)
    {
        var suggestions = new List<string>();
        
        // Check checkpoint discipline
        if (context.TimeSinceLastCheckpoint > TimeSpan.FromHours(2))
        {
            suggestions.Add("⚠️ Consider creating a checkpoint - you've been working for 2+ hours without saving progress");
        }
        
        // Check planning discipline
        if (context.HasActiveCodeChanges && !context.HasActivePlan)
        {
            suggestions.Add("📋 Complex changes detected - consider creating a strategic plan first");
        }
        
        // Check todo management
        if (context.ActiveTodos.Count == 0 && context.HasActiveWork)
        {
            suggestions.Add("✅ No active todos - consider breaking current work into manageable tasks");
        }
        
        return suggestions;
    }
}
```

## Tool Integration Priorities

### Current Tool Priorities (Good)
```csharp
ToolPriorities = new Dictionary<string, int>
{
    {"checkpoint", 100},    // Highest - fundamental discipline
    {"todo", 95},          // Task management  
    {"plan", 90},          // Strategic thinking
    {"standup", 85},       // Progress tracking
    {"recall", 80},        // Context restoration
    {"chronicle", 75},     // Decision tracking
    {"workspace", 70}      // Environment management
}
```

### Enhanced Tool Comparisons

Add more comprehensive comparisons to strengthen behavioral adoption:

```csharp
ToolComparisons = new Dictionary<string, ToolComparison>
{
    ["Systematic development"] = new ToolComparison
    {
        Task = "Systematic development workflow",
        ServerTool = "checkpoint + plan + todo workflow",
        Advantage = "Structured, recoverable development with persistent state",
        BuiltInTool = "Ad-hoc development",
        Limitation = "No persistence, no structure, work gets lost",
        PerformanceMetric = "Recoverable workflows vs starting from scratch after crashes"
    },
    
    ["Complex feature development"] = new ToolComparison
    {
        Task = "Complex feature development",
        ServerTool = "plan → todo → checkpoint cycle",
        Advantage = "Strategic planning breaks complexity into manageable pieces",
        BuiltInTool = "Diving straight into code",
        Limitation = "No structure, easy to get lost, missing requirements",
        PerformanceMetric = "Structured completion vs chaotic development"
    },
    
    ["Cross-session continuity"] = new ToolComparison
    {
        Task = "Maintaining context across sessions",
        ServerTool = "checkpoint + recall workflow",
        Advantage = "Perfect memory of what was working on and why",
        BuiltInTool = "Starting fresh each session",
        Limitation = "Lost context, repeated questions, forgotten decisions",
        PerformanceMetric = "Instant context restoration vs 15+ minutes orientation"
    }
}
```

## Success Metrics

### Behavioral Changes in Claude
- **Planning First:** Claude creates plans before complex features
- **Regular Checkpointing:** Saves progress after meaningful work
- **Structured Tasks:** Breaks work into manageable todos
- **Context Preservation:** Uses checkpoints to maintain session continuity
- **Progress Tracking:** Regular standups and retrospectives

### Quantitative Metrics
- **Checkpoint Frequency:** Should increase to every 2-4 hours of work
- **Plan Usage:** Complex features (3+ files) should start with plans
- **Todo Completion Rate:** Tasks should be completed and marked done
- **Session Recovery Speed:** Faster startup after crashes/breaks

## Implementation Priority

### Immediate (This Week)
1. ✅ **Enhanced Tool Descriptions** - Biggest behavioral impact
2. ✅ **Template Enhancement** - Foundation for methodology teaching
3. ✅ **Workflow Integration** - Better tool comparisons

### Next Phase (Optional)
1. **Proactive Suggestions** - Smart workflow recommendations
2. **Pattern Templates** - Common workflow patterns
3. **Metrics Dashboard** - Track methodology adoption

## Why Goldfish is Critical

### Unique Position in Ecosystem

Goldfish is the only tool that can:
- **Persist across crashes** - Never lose work or context
- **Coordinate workflows** - Orchestrate structured development
- **Build habits** - Reinforce disciplined practices
- **Bridge sessions** - Maintain continuity across time

### Workflow Orchestration

While other tools focus on specific practices:
- **CodeSearch/CodeNav:** Technical execution
- **TestStatus:** Quality assurance  
- **Goldfish:** Workflow discipline and structure

### The Compound Effect

Good workflow habits compound:
- Better planning → fewer mistakes → less debugging
- Regular checkpointing → faster recovery → more productivity  
- Structured tasks → clearer progress → better estimation
- Historical context → learned lessons → improved decisions

## Conclusion

Goldfish has the architectural foundation for behavioral adoption but needs stronger methodology teaching. By enhancing tool descriptions and templates, it can become the **workflow orchestrator** that teaches Claude disciplined development practices.

The goal is not just session persistence, but **development discipline persistence** - teaching Claude to work in structured, recoverable patterns that improve over time.

**Next Action:** Begin Phase 1 - enhance tool descriptions with checkpoint-driven development methodology and structured planning practices.

---

*Created: 2025-09-09*  
*Status: Enhancement Plan*  
*Priority: HIGH - Foundation for systematic development workflows*  
*Estimated Effort: 1 week for comprehensive enhancement*