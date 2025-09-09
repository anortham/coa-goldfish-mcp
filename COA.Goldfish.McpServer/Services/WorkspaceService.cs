using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Services;

public class WorkspaceService
{
    private readonly ILogger<WorkspaceService> _logger;
    private readonly IPathResolutionService _pathResolution;
    
    /// <summary>
    /// Reserved workspace ID for cross-project global items
    /// </summary>
    public const string GlobalWorkspaceId = "__global__";
    
    /// <summary>
    /// Default workspace when none is specified
    /// </summary>
    public const string DefaultWorkspaceId = "default";

    public WorkspaceService(ILogger<WorkspaceService> logger, IPathResolutionService pathResolution)
    {
        _logger = logger;
        _pathResolution = pathResolution;
    }

    /// <summary>
    /// Get current workspace with proper path resolution
    /// </summary>
    public string GetCurrentWorkspace()
    {
        try
        {
            // Use the path resolution service to get workspace name
            var primaryWorkspacePath = _pathResolution.GetPrimaryWorkspacePath();
            var workspaceName = _pathResolution.GetWorkspaceName(primaryWorkspacePath);
            
            _logger.LogDebug("Detected workspace: {WorkspaceName} from path: {WorkspacePath}", workspaceName, primaryWorkspacePath);
            return workspaceName;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to detect workspace, using default");
            return DefaultWorkspaceId;
        }
    }

    /// <summary>
    /// Check if a workspace ID is the global workspace
    /// </summary>
    public bool IsGlobalWorkspace(string workspaceId)
    {
        return string.Equals(workspaceId, GlobalWorkspaceId, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Get workspace display name for UI/logging
    /// </summary>
    public string GetWorkspaceDisplayName(string workspaceId)
    {
        if (IsGlobalWorkspace(workspaceId))
        {
            return "Global (Cross-Project)";
        }

        if (workspaceId == DefaultWorkspaceId)
        {
            return "Default Workspace";
        }

        return workspaceId;
    }

    /// <summary>
    /// Resolve workspace ID with fallback logic
    /// </summary>
    public string ResolveWorkspaceId(string? requestedWorkspace)
    {
        if (!string.IsNullOrEmpty(requestedWorkspace))
        {
            // Handle special keywords
            if (requestedWorkspace.Equals("global", StringComparison.OrdinalIgnoreCase))
            {
                return GlobalWorkspaceId;
            }
            
            return requestedWorkspace;
        }

        return GetCurrentWorkspace();
    }

}