#!/usr/bin/env python3
"""
SessionStart Hook for Automatic Context Restoration

This hook triggers when Claude Code starts a new session or resumes an existing one.
It prompts Claude to restore relevant context from previous sessions.

Behaviors:
- Session resume: Load checkpoint and show recent activity
- New session: Show recent project activity
- Startup: Welcome message with context restoration
"""

import json
import sys
import subprocess
from datetime import datetime, timedelta
from pathlib import Path


def get_git_context() -> dict:
    """Get current git repository context."""
    try:
        # Get current branch
        branch_result = subprocess.run(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
            capture_output=True,
            text=True,
            timeout=5
        )
        current_branch = branch_result.stdout.strip() if branch_result.returncode == 0 else None
        
        # Get uncommitted changes
        status_result = subprocess.run(
            ['git', 'status', '--porcelain'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if status_result.returncode == 0:
            changes = status_result.stdout.strip().split('\n') if status_result.stdout.strip() else []
            uncommitted_count = len(changes)
        else:
            uncommitted_count = 0
        
        # Get recent commits (last 3)
        log_result = subprocess.run(
            ['git', 'log', '--oneline', '-3'],
            capture_output=True,
            text=True,
            timeout=5
        )
        recent_commits = log_result.stdout.strip() if log_result.returncode == 0 else None
        
        return {
            'branch': current_branch,
            'uncommitted_count': uncommitted_count,
            'recent_commits': recent_commits
        }
    except Exception:
        return {}


def check_mcp_server_running() -> bool:
    """Check if ProjectKnowledge MCP server is running (simple check)."""
    try:
        # Try to reach the HTTP endpoint if it exists
        import urllib.request
        import urllib.error
        
        try:
            response = urllib.request.urlopen('http://localhost:5100/api/knowledge/health', timeout=2)
            return response.status == 200
        except (urllib.error.URLError, ConnectionError):
            return False
    except ImportError:
        # If urllib not available, assume we should try anyway
        return True


def get_session_instructions(matcher: str, session_id: str, git_context: dict) -> str:
    """Generate session start instructions based on the matcher type."""
    
    instructions = []
    
    # Header
    if matcher == "resume":
        instructions.append("🔄 RESUMING SESSION - Restoring Context")
    elif matcher == "startup":
        instructions.append("🚀 CLAUDE CODE STARTUP - Welcome Back")
    else:  # clear or other
        instructions.append("✨ NEW SESSION - Fresh Start")
    
    instructions.append("")  # Empty line
    
    # Git context
    if git_context.get('branch'):
        instructions.append(f"📂 Git Branch: {git_context['branch']}")
        if git_context.get('uncommitted_count', 0) > 0:
            instructions.append(f"⚠️  {git_context['uncommitted_count']} uncommitted changes")
        if git_context.get('recent_commits'):
            instructions.append(f"📝 Recent commits:\n{git_context['recent_commits']}")
        instructions.append("")
    
    # Core restoration tasks
    if matcher in ["resume", "startup"]:
        instructions.append("Please immediately perform these restoration steps:")
        instructions.append("")
        instructions.append("1. 🧠 Use recall to check recent memories and context")
        instructions.append("2. 💾 Use restore_session to restore the latest session state") 
        instructions.append("3. ✅ Use view_todos to see any pending tasks")
        instructions.append("4. 📋 Use show_activity to see recent project work if needed")
        instructions.append("")
        instructions.append("After completing these steps, summarize:")
        instructions.append("- What was being worked on")
        instructions.append("- Current status and progress")
        instructions.append("- Next steps or pending items")
        instructions.append("")
        instructions.append("Then ask how I'd like to continue.")
    else:
        # New/clear session
        instructions.append("Starting fresh! Consider:")
        instructions.append("- Use recall to check if there's relevant context")
        instructions.append("- Use show_activity if you want to see recent project work")
        instructions.append("- Use discover_projects to see what projects have knowledge")
        instructions.append("")
        instructions.append("Ready for your first task!")
    
    return "\n".join(instructions)


def main():
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Extract fields
        session_id = input_data.get('session_id', 'unknown')
        matcher = input_data.get('matcher', 'startup')  # "startup", "resume", or "clear"
        
        # Get current git context
        git_context = get_git_context()
        
        # Check if we can reach MCP services
        mcp_available = check_mcp_server_running()
        
        # Generate appropriate instructions
        if mcp_available:
            instructions = get_session_instructions(matcher, session_id, git_context)
        else:
            # Fallback if MCP not available
            instructions = f"""🚀 CLAUDE CODE SESSION STARTED

Git Branch: {git_context.get('branch', 'unknown')}
Session Type: {matcher}

Note: ProjectKnowledge MCP server may not be running.
You can still use built-in tools for development tasks.

Ready to help!"""
        
        # Output instructions to Claude (stdout gets added to context for SessionStart)
        print(instructions)
        
        # Success
        sys.exit(0)
        
    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        print("🚀 Claude Code session started. Ready to help!")
        sys.exit(0)
    except Exception:
        # Handle any other errors gracefully
        print("🚀 Claude Code session started. Ready to help!")
        sys.exit(0)


if __name__ == '__main__':
    main()