using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Tools;

/// <summary>
/// Tool for workspace operations - work state management
/// </summary>
public class WorkspaceTool : GoldfishToolBase<WorkspaceParameters, WorkspaceResult>
{
    private readonly IStorageService _storage;
    private readonly ILogger<WorkspaceTool> _logger;

    public WorkspaceTool(IServiceProvider serviceProvider, ILogger<WorkspaceTool> logger, IStorageService storage) 
        : base(serviceProvider, logger)
    {
        _storage = storage;
        _logger = logger;
    }

    public override string Name => "workspace";
    public override string Description => "Active work state management";

    protected override async Task<WorkspaceResult> ExecuteInternalAsync(
        WorkspaceParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var result = new WorkspaceResult();

            switch (parameters.Action.ToLowerInvariant())
            {
                case "list":
                    result.Workspaces = await _storage.GetWorkspacesAsync();
                    result.Message = $"Found {result.Workspaces.Count} workspaces";
                    break;

                case "current":
                case "status":
                    var workspaceId = parameters.Workspace ?? "default";
                    result.WorkspaceState = await _storage.GetWorkspaceStateAsync(workspaceId);
                    result.Message = $"Retrieved state for workspace '{workspaceId}'";
                    break;

                case "switch":
                case "set":
                    if (string.IsNullOrEmpty(parameters.Workspace))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_WORKSPACE",
                            Message = "Workspace parameter is required for switch action"
                        };
                        return result;
                    }

                    // Ensure workspace exists by getting/creating its state
                    var workspaceState = await _storage.GetWorkspaceStateAsync(parameters.Workspace);
                    if (workspaceState.WorkspaceId != parameters.Workspace)
                    {
                        // Create new workspace state
                        workspaceState.WorkspaceId = parameters.Workspace;
                        workspaceState.LastActivity = DateTime.UtcNow;
                        await _storage.SaveWorkspaceStateAsync(workspaceState);
                    }

                    result.WorkspaceState = workspaceState;
                    result.Message = $"Switched to workspace '{parameters.Workspace}'";
                    break;

                case "clean":
                case "cleanup":
                    var cleanupWorkspaceId = parameters.Workspace ?? "default";
                    var cleanedCount = await _storage.CleanupWorkspaceAsync(cleanupWorkspaceId);
                    result.Message = $"Cleaned up {cleanedCount} expired items from workspace '{cleanupWorkspaceId}'";
                    break;

                case "info":
                case "summary":
                    var infoWorkspaceId = parameters.Workspace ?? "default";
                    
                    // Get workspace state and summary info
                    var state = await _storage.GetWorkspaceStateAsync(infoWorkspaceId);
                    var checkpointsCount = (await _storage.GetCheckpointsAsync(infoWorkspaceId, limit: 1000)).Count;
                    var plansCount = (await _storage.GetPlansAsync(infoWorkspaceId)).Count;
                    var todosCount = (await _storage.GetTodoListsAsync(infoWorkspaceId)).Count;
                    var chronicleCount = (await _storage.GetChronicleEntriesAsync(infoWorkspaceId, limit: 1000)).Count;

                    result.WorkspaceState = state;
                    result.Message = $"Workspace '{infoWorkspaceId}' contains: {checkpointsCount} checkpoints, " +
                                   $"{plansCount} plans, {todosCount} todo lists, {chronicleCount} chronicle entries. " +
                                   $"Last activity: {state.LastActivity:yyyy-MM-dd HH:mm}";
                    break;

                default:
                    result.Success = false;
                    result.Error = new ErrorInfo
                    {
                        Code = "INVALID_ACTION",
                        Message = $"Unknown action: {parameters.Action}"
                    };
                    break;
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Workspace operation failed");
            return new WorkspaceResult
            {
                Success = false,
                Error = new ErrorInfo
                {
                    Code = "WORKSPACE_ERROR",
                    Message = ex.Message
                }
            };
        }
    }
}