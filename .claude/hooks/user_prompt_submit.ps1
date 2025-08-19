#!/usr/bin/env pwsh
<#
.SYNOPSIS
UserPromptSubmit Hook for Automatic Knowledge Capture

.DESCRIPTION
This hook analyzes user prompts and automatically injects instructions
for Claude to save knowledge and checkpoints at appropriate times.

Cross-platform PowerShell Core implementation.
#>

param()

try {
    # Read JSON input from stdin
    $inputJson = [Console]::In.ReadToEnd()
    $inputData = $inputJson | ConvertFrom-Json
    
    # Extract the user prompt
    $prompt = $inputData.prompt
    $sessionId = $inputData.session_id
    
    if (-not $prompt) {
        Write-Output ""
        exit 0
    }
    
    $promptLower = $prompt.ToLower()
    $instructions = @()
    
    # Git commit patterns
    if ($promptLower -match "git commit|commit the|commit these changes") {
        $instructions += "IMPORTANT: After creating the git commit, immediately use remember to capture the commit details and store_knowledge with type='WorkNote' to preserve it long-term."
    }
    
    # Bug fix patterns
    if ($promptLower -match "fix|bug|error|issue|broken") {
        $instructions += "After fixing this issue, use remember to capture the solution and store_knowledge with type='TechnicalDebt' for long-term reference."
    }
    
    # Feature implementation patterns
    if ($promptLower -match "implement|add feature|create|build") {
        $instructions += "When you complete this implementation, use snapshot to preserve the session state with what was accomplished."
    }
    
    # Architecture/design decisions
    if ($promptLower -match "design|architecture|pattern|approach|strategy") {
        $instructions += "If you make any architectural decisions, use remember for immediate context and store_knowledge with type='ProjectInsight' for long-term preservation."
    }
    
    # Refactoring patterns
    if ($promptLower -match "refactor|clean up|improve|optimize") {
        $instructions += "After refactoring, use remember to capture what was changed and store_knowledge with type='ProjectInsight' to document improvements."
    }
    
    # Session ending patterns
    if ($promptLower -match "done|finished|complete|end|wrap up") {
        $instructions += "Before ending, use save_session to preserve the current session state including what was accomplished and any next steps."
    }
    
    # TODO/task management patterns
    if ($promptLower -match "todo|task|checklist|need to") {
        $instructions += "Consider using create_todo_list if you're breaking down work into multiple tasks."
    }
    
    # Build the output
    $output = @()
    
    if ($instructions.Count -gt 0) {
        $output += "📝 AUTOMATIC KNOWLEDGE CAPTURE INSTRUCTIONS:"
        foreach ($instruction in $instructions) {
            $output += "• $instruction"
        }
        $output += ""  # Empty line for separation
    }
    elseif ($promptLower -match "modify|change|update|create|delete|add|remove|implement|fix|build|develop|write|edit") {
        # General reminder for complex tasks
        $output += "💡 REMINDER: For significant work, consider using remember for immediate context and snapshot/store_knowledge to preserve insights and progress."
        $output += ""
    }
    
    # Add the original prompt
    $output += $prompt
    
    # Output the enhanced prompt (stdout gets added to Claude's context)
    Write-Output ($output -join "`n")
    
    exit 0
}
catch {
    # On any error, just pass through the original prompt
    Write-Output $prompt
    exit 0
}