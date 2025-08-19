#!/usr/bin/env python3
"""
PreCompact Hook for Preventing Context Loss

This hook triggers before Claude compacts the conversation context.
It prompts Claude to save important information before it gets lost.

Behaviors:
- Auto compaction: Forces Claude to save checkpoint before losing context
- Manual compaction: Reminds to save if desired
- Creates transcript backup for reference
"""

import json
import sys
import os
import shutil
from datetime import datetime
from pathlib import Path


def create_transcript_backup(transcript_path: str, trigger: str, session_id: str) -> str:
    """Create a backup of the transcript before compaction."""
    try:
        if not os.path.exists(transcript_path):
            return None
        
        # Create backup directory
        backup_dir = Path("~/.coa/knowledge/transcript_backups").expanduser()
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate backup filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_short = session_id[:8] if session_id != 'unknown' else 'unknown'
        backup_name = f"{session_short}_pre_compact_{trigger}_{timestamp}.jsonl"
        backup_path = backup_dir / backup_name
        
        # Copy transcript to backup
        shutil.copy2(transcript_path, backup_path)
        
        return str(backup_path)
    except Exception as e:
        return None


def should_force_save(trigger: str) -> bool:
    """Determine if we should force Claude to save before compaction."""
    # Always force save on auto compaction (context window full)
    return trigger == "auto"


def get_save_instructions(trigger: str, session_id: str) -> str:
    """Generate appropriate save instructions based on trigger type."""
    
    if trigger == "auto":
        return """🚨 CONTEXT COMPACTION IMMINENT - SAVE NOW!

The context window is full and will be automatically compacted. You MUST immediately:

1. Use save_session to preserve the current session state
   - Include what has been accomplished this session
   - Note any pending tasks or next steps
   - Record any important insights or decisions

2. Use remember to capture immediate working context that would be lost

3. Use store_knowledge for any critical findings:
   - Technical debt or bugs discovered (type='TechnicalDebt')
   - Architectural decisions made (type='ProjectInsight') 
   - Important work notes (type='WorkNote')

4. If there are incomplete TODOs, use create_todo_list to preserve them

DO THESE FOUR THINGS NOW before context is lost!

After saving, you may proceed with the user's request."""
    
    else:  # manual compaction
        return """💡 Manual compaction requested. Consider saving important context:

Before compacting, you might want to:
- Use save_session if significant work was done
- Use remember to capture immediate working context
- Use store_knowledge for any insights worth preserving
- Use create_todo_list for any pending tasks

Then proceed with compaction as requested."""


def main():
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Extract fields
        session_id = input_data.get('session_id', 'unknown')
        transcript_path = input_data.get('transcript_path', '')
        trigger = input_data.get('trigger', 'unknown')  # "manual" or "auto"
        
        # Create transcript backup
        backup_path = None
        if transcript_path:
            backup_path = create_transcript_backup(transcript_path, trigger, session_id)
        
        # For auto compaction, we MUST force Claude to save first
        if should_force_save(trigger):
            # Output save instructions to Claude (stdout gets added to context)
            save_instructions = get_save_instructions(trigger, session_id)
            print(save_instructions)
            
            # Success - Claude will see the instructions and save before compacting
            sys.exit(0)
        
        else:
            # Manual compaction - just provide a gentle reminder
            reminder = get_save_instructions(trigger, session_id)
            print(reminder)
            sys.exit(0)
        
    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Handle any other errors gracefully  
        sys.exit(0)


if __name__ == '__main__':
    main()