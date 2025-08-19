#!/usr/bin/env pwsh
<#
.SYNOPSIS
SessionStart Hook for Automatic Context Restoration

.DESCRIPTION
This hook triggers when Claude Code starts a new session or resumes an existing one.
It prompts Claude to restore relevant context from previous sessions.

Cross-platform PowerShell Core implementation.
#>

param()

try {
    # Read JSON input from stdin
    $inputJson = [Console]::In.ReadToEnd()
    $inputData = $inputJson | ConvertFrom-Json
    
    # Extract fields
    $sessionId = $inputData.session_id
    $matcher = $inputData.matcher  # "startup", "resume", or "clear"
    
    # Get git context
    $gitContext = @{}
    try {
        # Get current branch
        $branch = git rev-parse --abbrev-ref HEAD 2>$null
        if ($LASTEXITCODE -eq 0) {
            $gitContext.branch = $branch.Trim()
        }
        
        # Get uncommitted changes count
        $status = git status --porcelain 2>$null
        if ($LASTEXITCODE -eq 0) {
            $changes = $status | Where-Object { $_.Trim() -ne "" }
            $gitContext.uncommittedCount = $changes.Count
        }
        
        # Get recent commits
        $recentCommits = git log --oneline -3 2>$null
        if ($LASTEXITCODE -eq 0) {
            $gitContext.recentCommits = $recentCommits -join "`n"
        }
    }
    catch {
        # Git commands failed, continue without git context
    }
    
    # Build instructions
    $instructions = @()
    
    # Header
    switch ($matcher) {
        "resume" { $instructions += "🔄 RESUMING SESSION - Restoring Context" }
        "startup" { $instructions += "🚀 CLAUDE CODE STARTUP - Welcome Back" }
        default { $instructions += "✨ NEW SESSION - Fresh Start" }
    }
    
    $instructions += ""  # Empty line
    
    # Git context
    if ($gitContext.branch) {
        $instructions += "📂 Git Branch: $($gitContext.branch)"
        if ($gitContext.uncommittedCount -gt 0) {
            $instructions += "⚠️  $($gitContext.uncommittedCount) uncommitted changes"
        }
        if ($gitContext.recentCommits) {
            $instructions += "📝 Recent commits:"
            $instructions += $gitContext.recentCommits
        }
        $instructions += ""
    }
    
    # Core restoration tasks
    if ($matcher -in @("resume", "startup")) {
        $instructions += "Please immediately perform these restoration steps:"
        $instructions += ""
        $instructions += "1. 🧠 Use recall to check recent memories and context"
        $instructions += "2. 💾 Use restore_session to restore the latest session state"
        $instructions += "3. ✅ Use view_todos to see any pending tasks"
        $instructions += "4. 📋 Use show_activity to see recent project work if needed"
        $instructions += ""
        $instructions += "After completing these steps, summarize:"
        $instructions += "- What was being worked on"
        $instructions += "- Current status and progress"
        $instructions += "- Next steps or pending items"
        $instructions += ""
        $instructions += "Then ask how I'd like to continue."
    }
    else {
        # New/clear session
        $instructions += "Starting fresh! Consider:"
        $instructions += "- Use recall to check if there's relevant context"
        $instructions += "- Use show_activity if you want to see recent project work"
        $instructions += "- Use discover_projects to see what projects have knowledge"
        $instructions += ""
        $instructions += "Ready for your first task!"
    }
    
    # Output instructions to Claude (stdout gets added to context for SessionStart)
    Write-Output ($instructions -join "`n")
    
    exit 0
}
catch {
    # On any error, provide basic welcome
    Write-Output "🚀 Claude Code session started. Ready to help!"
    exit 0
}