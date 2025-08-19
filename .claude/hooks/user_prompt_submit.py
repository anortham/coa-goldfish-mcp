#!/usr/bin/env python3
"""
UserPromptSubmit Hook for Automatic Knowledge Capture

This hook analyzes user prompts and automatically injects instructions
for Claude to save knowledge and checkpoints at appropriate times.

Key behaviors:
- Git commits -> auto-save as WorkNote
- Bug fixes -> save as TechnicalDebt  
- Feature implementation -> save checkpoint
- Architecture decisions -> save as ProjectInsight
- Session ending -> save checkpoint
"""

import json
import sys
import re
from datetime import datetime
from pathlib import Path


def detect_prompt_patterns(prompt: str) -> list[str]:
    """Detect patterns in user prompts that should trigger knowledge capture."""
    instructions = []
    prompt_lower = prompt.lower()
    
    # Git commit patterns
    if any(pattern in prompt_lower for pattern in ['git commit', 'commit the', 'commit these changes']):
        instructions.append(
            "IMPORTANT: After creating the git commit, immediately use remember "
            "to capture the commit details and store_knowledge with type='WorkNote' "
            "to preserve it long-term."
        )
    
    # Bug fix patterns
    if any(pattern in prompt_lower for pattern in ['fix', 'bug', 'error', 'issue', 'broken']):
        instructions.append(
            "After fixing this issue, use remember to capture the solution and "
            "store_knowledge with type='TechnicalDebt' for long-term reference."
        )
    
    # Feature implementation patterns
    if any(pattern in prompt_lower for pattern in ['implement', 'add feature', 'create', 'build']):
        instructions.append(
            "When you complete this implementation, use snapshot to preserve "
            "the session state with what was accomplished."
        )
    
    # Architecture/design decisions
    if any(pattern in prompt_lower for pattern in ['design', 'architecture', 'pattern', 'approach', 'strategy']):
        instructions.append(
            "If you make any architectural decisions, use remember for immediate "
            "context and store_knowledge with type='ProjectInsight' for long-term preservation."
        )
    
    # Refactoring patterns
    if any(pattern in prompt_lower for pattern in ['refactor', 'clean up', 'improve', 'optimize']):
        instructions.append(
            "After refactoring, use remember to capture what was changed and "
            "store_knowledge with type='ProjectInsight' to document improvements."
        )
    
    # Session ending patterns
    if any(pattern in prompt_lower for pattern in ['done', 'finished', 'complete', 'end', 'wrap up']):
        instructions.append(
            "Before ending, please use save_session to preserve the current session state "
            "including what was accomplished and any next steps."
        )
    
    # TODO/task management patterns
    if any(pattern in prompt_lower for pattern in ['todo', 'task', 'checklist', 'need to']):
        instructions.append(
            "Consider using create_todo_list if you're breaking down work into multiple tasks."
        )
    
    return instructions


def should_inject_general_reminder(prompt: str) -> bool:
    """Determine if we should inject a general knowledge capture reminder."""
    # Don't inject for simple questions or quick tasks
    simple_patterns = [
        'what is', 'how do', 'explain', 'show me', 'list', 'find', 'search',
        'read', 'look at', 'check', 'tell me'
    ]
    
    prompt_lower = prompt.lower()
    
    # If it's a simple question, don't inject
    if any(pattern in prompt_lower for pattern in simple_patterns):
        return False
    
    # If it's a complex task (contains action words), inject reminder
    action_patterns = [
        'modify', 'change', 'update', 'create', 'delete', 'add', 'remove',
        'implement', 'fix', 'build', 'develop', 'write', 'edit'
    ]
    
    return any(pattern in prompt_lower for pattern in action_patterns)


def main():
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Extract the user prompt
        prompt = input_data.get('prompt', '')
        session_id = input_data.get('session_id', 'unknown')
        
        # Detect specific patterns and generate targeted instructions
        specific_instructions = detect_prompt_patterns(prompt)
        
        # Build the context injection
        context_parts = []
        
        if specific_instructions:
            context_parts.append("📝 AUTOMATIC KNOWLEDGE CAPTURE INSTRUCTIONS:")
            for instruction in specific_instructions:
                context_parts.append(f"• {instruction}")
            context_parts.append("")  # Empty line for separation
        elif should_inject_general_reminder(prompt):
            context_parts.append(
                "💡 REMINDER: For significant work, consider using remember for immediate "
                "context and snapshot/store_knowledge to preserve insights and progress."
            )
            context_parts.append("")  # Empty line for separation
        
        # Add the original prompt
        context_parts.append(prompt)
        
        # Output the enhanced prompt (stdout gets added to Claude's context)
        print("\n".join(context_parts))
        
        # Success
        sys.exit(0)
        
    except json.JSONDecodeError:
        # If we can't parse JSON, just pass through silently
        print(input_data.get('prompt', ''), end='')
        sys.exit(0)
    except Exception:
        # For any other error, pass through silently
        print(input_data.get('prompt', ''), end='')
        sys.exit(0)


if __name__ == '__main__':
    main()