using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Tools;

/// <summary>
/// Tool for chronicle operations - decision tracking
/// </summary>
public class ChronicleTool : GoldfishToolBase<ChronicleParameters, ChronicleResult>
{
    private readonly IStorageService _storage;
    private readonly ILogger<ChronicleTool> _logger;

    public ChronicleTool(IServiceProvider serviceProvider, ILogger<ChronicleTool> logger, IStorageService storage) 
        : base(serviceProvider, logger)
    {
        _storage = storage;
        _logger = logger;
    }

    public override string Name => "chronicle";
    public override string Description => "Decision and progress tracking";

    protected override async Task<ChronicleResult> ExecuteInternalAsync(
        ChronicleParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var workspaceId = parameters.Workspace ?? "default";
            var result = new ChronicleResult();

            switch (parameters.Action.ToLowerInvariant())
            {
                case "add":
                case "create":
                case "log":
                    if (string.IsNullOrEmpty(parameters.Description))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_DESCRIPTION",
                            Message = "Description is required for chronicle entry"
                        };
                        return result;
                    }

                    // Parse the type string to enum
                    if (!Enum.TryParse<ChronicleEntryType>(parameters.Type, true, out var entryType))
                    {
                        entryType = ChronicleEntryType.Note; // Default fallback
                    }

                    var entry = new ChronicleEntry
                    {
                        Id = Guid.NewGuid().ToString(),
                        WorkspaceId = workspaceId,
                        Description = parameters.Description,
                        Type = entryType,
                        Timestamp = DateTime.UtcNow
                    };

                    result.Entry = await _storage.SaveChronicleEntryAsync(entry);
                    result.Message = $"Logged {parameters.Type.ToLowerInvariant()} entry to chronicle";
                    break;

                case "list":
                case "view":
                    DateTime? sinceDate = null;
                    if (!string.IsNullOrEmpty(parameters.Since))
                    {
                        sinceDate = ParseTimeRange(parameters.Since);
                    }

                    result.Entries = await _storage.GetChronicleEntriesAsync(workspaceId, sinceDate, limit: 50);
                    result.Message = $"Found {result.Entries.Count} chronicle entries";
                    break;

                case "search":
                    if (string.IsNullOrEmpty(parameters.Description))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_SEARCH_QUERY",
                            Message = "Description field is used as search query for search action"
                        };
                        return result;
                    }

                    DateTime? searchSince = null;
                    if (!string.IsNullOrEmpty(parameters.Since))
                    {
                        searchSince = ParseTimeRange(parameters.Since);
                    }

                    result.Entries = await _storage.SearchChronicleEntriesAsync(workspaceId, parameters.Description, searchSince, limit: 50);
                    result.Message = $"Found {result.Entries.Count} entries matching '{parameters.Description}'";
                    break;

                case "auto":
                    // Auto-entry from other tools - this would be called programmatically
                    // by other tools to automatically log significant decisions/changes
                    if (string.IsNullOrEmpty(parameters.Description))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_DESCRIPTION",
                            Message = "Description is required for auto-entry"
                        };
                        return result;
                    }

                    var autoEntry = new ChronicleEntry
                    {
                        Id = Guid.NewGuid().ToString(),
                        WorkspaceId = workspaceId,
                        Description = parameters.Description,
                        Type = ChronicleEntryType.Note, // Auto entries are treated as notes
                        Timestamp = DateTime.UtcNow
                    };

                    result.Entry = await _storage.SaveChronicleEntryAsync(autoEntry);
                    result.Message = "Auto-logged entry to chronicle";
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
            _logger.LogError(ex, "Chronicle operation failed");
            return new ChronicleResult
            {
                Success = false,
                Error = new ErrorInfo
                {
                    Code = "CHRONICLE_ERROR",
                    Message = ex.Message
                }
            };
        }
    }

    /// <summary>
    /// Parse time range strings like "7d", "1w", "24h", "2025-01-15"
    /// </summary>
    private DateTime? ParseTimeRange(string timeRange)
    {
        if (string.IsNullOrEmpty(timeRange))
            return null;

        try
        {
            // Try parsing as absolute date first
            if (DateTime.TryParse(timeRange, out var absoluteDate))
            {
                return absoluteDate;
            }

            // Parse relative time ranges
            var now = DateTime.UtcNow;
            var lowerRange = timeRange.ToLowerInvariant();

            if (lowerRange.EndsWith('d'))
            {
                if (int.TryParse(lowerRange[..^1], out var days))
                    return now.AddDays(-days);
            }
            else if (lowerRange.EndsWith('h'))
            {
                if (int.TryParse(lowerRange[..^1], out var hours))
                    return now.AddHours(-hours);
            }
            else if (lowerRange.EndsWith('w'))
            {
                if (int.TryParse(lowerRange[..^1], out var weeks))
                    return now.AddDays(-weeks * 7);
            }

            // Handle common aliases
            return lowerRange switch
            {
                "today" => now.Date,
                "yesterday" => now.Date.AddDays(-1),
                "week" => now.AddDays(-7),
                "month" => now.AddDays(-30),
                _ => null
            };
        }
        catch
        {
            return null;
        }
    }
}