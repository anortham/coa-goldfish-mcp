using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Services;
using COA.Goldfish.McpServer.Models;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Tools;

/// <summary>
/// Tool for checkpoint operations - save and restore session state
/// </summary>
public class CheckpointTool : GoldfishToolBase<CheckpointParameters, CheckpointResult>
{
    private readonly IStorageService _storage;
    private readonly WorkspaceService _workspaceService;
    private readonly ILogger<CheckpointTool> _logger;

    public CheckpointTool(IServiceProvider serviceProvider, ILogger<CheckpointTool> logger, IStorageService storage, WorkspaceService workspaceService) 
        : base(serviceProvider, logger)
    {
        _storage = storage;
        _workspaceService = workspaceService;
        _logger = logger;
    }

    public override string Name => "checkpoint";
    public override string Description => @"Save and restore session state following checkpoint-driven development methodology.

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

This tool builds persistent development habits that survive crashes and context switches.";

    protected override async Task<CheckpointResult> ExecuteInternalAsync(
        CheckpointParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var result = new CheckpointResult();
            
            switch (parameters.Action.ToLowerInvariant())
            {
                case "save":
                    if (string.IsNullOrEmpty(parameters.Description))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_DESCRIPTION",
                            Message = "Description is required for save action"
                        };
                        return result;
                    }

                    var checkpoint = new Checkpoint
                    {
                        Id = Guid.NewGuid().ToString(),
                        WorkspaceId = parameters.Workspace ?? _workspaceService.GetCurrentWorkspace(),
                        SessionId = parameters.SessionId ?? Guid.NewGuid().ToString(),
                        Description = parameters.Description,
                        WorkContext = parameters.WorkContext ?? "",
                        ActiveFiles = parameters.ActiveFiles ?? new List<string>(),
                        Highlights = parameters.Highlights ?? new List<string>(),
                        GitBranch = parameters.GitBranch ?? "",
                        IsGlobal = parameters.Global
                    };

                    result.Checkpoint = await _storage.SaveCheckpointAsync(checkpoint);
                    result.Message = "Checkpoint saved successfully";
                    break;

                case "restore":
                    if (!string.IsNullOrEmpty(parameters.CheckpointId))
                    {
                        result.Checkpoint = await _storage.GetCheckpointAsync(parameters.CheckpointId);
                    }
                    else
                    {
                        result.Checkpoint = await _storage.GetLatestCheckpointAsync(parameters.Workspace ?? _workspaceService.GetCurrentWorkspace());
                    }

                    if (result.Checkpoint != null)
                    {
                        result.Message = "Checkpoint restored successfully";
                    }
                    else
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "CHECKPOINT_NOT_FOUND",
                            Message = "No checkpoint found"
                        };
                    }
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
            _logger.LogError(ex, "Checkpoint operation failed");
            return new CheckpointResult
            {
                Success = false,
                Error = new ErrorInfo
                {
                    Code = "CHECKPOINT_ERROR",
                    Message = ex.Message
                }
            };
        }
    }
}