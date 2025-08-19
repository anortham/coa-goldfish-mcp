#!/usr/bin/env pwsh
<#
.SYNOPSIS
PreCompact Hook for Preventing Context Loss

.DESCRIPTION
This hook triggers before Claude compacts the conversation context.
It prompts Claude to save important information before it gets lost.

Cross-platform PowerShell Core implementation.
#>

param()

try {
    # Read JSON input from stdin
    $inputJson = [Console]::In.ReadToEnd()
    $inputData = $inputJson | ConvertFrom-Json
    
    # Extract fields
    $sessionId = $inputData.session_id
    $transcriptPath = $inputData.transcript_path
    $trigger = $inputData.trigger  # "manual" or "auto"
    
    # Create transcript backup if path provided
    if ($transcriptPath -and (Test-Path $transcriptPath)) {
        try {
            $backupDir = "$env:USERPROFILE\.coa\knowledge\transcript_backups"
            if (-not (Test-Path $backupDir)) {
                New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
            }
            
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            $sessionShort = if ($sessionId -ne "unknown") { $sessionId } else { "unknown" }
            $backupName = "${sessionShort}_pre_compact_${trigger}_${timestamp}.jsonl"
            $backupPath = Join-Path $backupDir $backupName
            
            Copy-Item -Path $transcriptPath -Destination $backupPath -Force
        }
        catch {
            # Backup failed, continue anyway
        }
    }
    
    # Generate appropriate instructions based on trigger type
    if ($trigger -eq "auto") {
        # Auto compaction - force save
        $instructions = @"
🚨 CONTEXT COMPACTION IMMINENT - SAVE NOW!

The context window is full and will be automatically compacted. You MUST immediately:

1. Use checkpoint to preserve the current session state
   - Include what has been accomplished this session
   - Add highlights of important achievements or decisions
   - Record any pending tasks or next steps
   - Note current work context

2. Use remember for any immediate working thoughts that would be lost

3. Use store_knowledge for any critical findings:
   - Technical debt or bugs discovered (type='TechnicalDebt')
   - Architectural decisions made (type='ProjectInsight') 
   - Important work notes (type='WorkNote')

4. If there are incomplete TODOs, use create_todo_list to preserve them

DO THESE FOUR THINGS NOW before context is lost!

After saving, you may proceed with the user's request. Use /resume later to restore context.
"@
    }
    else {
        # Manual compaction - gentle reminder
        $instructions = @"
💡 Manual compaction requested. Consider saving important context:

Before compacting, you might want to:
- Use checkpoint if significant work was done
- Use remember to capture immediate working context
- Use store_knowledge for any insights worth preserving
- Use create_todo_list for any pending tasks

Then proceed with compaction as requested. Use /resume later to restore context.
"@
    }
    
    Write-Output $instructions
    exit 0
}
catch {
    # On any error, exit gracefully
    exit 0
}