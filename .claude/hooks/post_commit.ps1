#!/usr/bin/env pwsh
<#
.SYNOPSIS
PostCommit Hook for Auto-Checkpoint on Git Commits

.DESCRIPTION
This hook triggers after a git commit to automatically create a checkpoint
capturing the commit as a session highlight. Helps maintain session context
around important code changes.

Cross-platform PowerShell Core implementation.
#>

param()

try {
    # Check if we're in a git repository
    $gitDir = git rev-parse --git-dir 2>$null
    if (-not $gitDir) {
        exit 0  # Not a git repo, nothing to do
    }
    
    # Get the latest commit information
    try {
        $commitHash = git rev-parse HEAD 2>$null
        $commitMessage = git log -1 --pretty=format:"%s" 2>$null
        $commitAuthor = git log -1 --pretty=format:"%an" 2>$null
        $currentBranch = git branch --show-current 2>$null
        
        if (-not $commitMessage) {
            exit 0  # No commit info available
        }
    }
    catch {
        exit 0  # Git commands failed
    }
    
    # Get modified files (up to 10 for context)
    try {
        $modifiedFiles = @(git diff-tree --no-commit-id --name-only -r HEAD 2>$null | Select-Object -First 10)
    }
    catch {
        $modifiedFiles = @()
    }
    
    # Generate checkpoint instruction
    $shortHash = if ($commitHash) { $commitHash.Substring(0, 8) } else { "unknown" }
    $filesInfo = if ($modifiedFiles.Count -gt 0) { $modifiedFiles -join ", " } else { "unknown files" }
    
    $instructions = @"
🎯 GIT COMMIT DETECTED - Auto-checkpointing...

A git commit was just made:
📝 Message: $commitMessage
🔗 Hash: $shortHash
👤 Author: $commitAuthor
🌿 Branch: $currentBranch
📁 Files: $filesInfo

Use checkpoint to capture this milestone:
- Description: "Committed: $commitMessage"
- highlights: ["Committed: `"$commitMessage`"", "Hash: $shortHash"]
- activeFiles: The files you were working on
- gitBranch: $currentBranch (auto-detected)
- workContext: Brief context about what this commit accomplished

This helps maintain session continuity and creates searchable work history.
"@
    
    Write-Output $instructions
    exit 0
}
catch {
    # On any error, exit gracefully
    exit 0
}