using COA.Goldfish.McpServer.Services;
using COA.Goldfish.McpServer.Models;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace COA.Goldfish.McpServer.Tools;

/// <summary>
/// Tool for comprehensive search operations across all Goldfish entities
/// </summary>
public class SearchTool : GoldfishToolBase<SearchParameters, SearchToolResult>
{
    private readonly ISearchService _searchService;
    private readonly ILogger<SearchTool> _logger;

    public SearchTool(IServiceProvider serviceProvider, ILogger<SearchTool> logger, ISearchService searchService) 
        : base(serviceProvider, logger)
    {
        _searchService = searchService;
        _logger = logger;
    }

    public override string Name => "search";
    public override string Description => "Search across all Goldfish data (checkpoints, plans, todos, chronicle) with ranking and relevance scoring";

    protected override async Task<SearchToolResult> ExecuteInternalAsync(
        SearchParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            _logger.LogDebug("Executing search for query '{Query}' with limit {Limit}", parameters.Query, parameters.Limit);

            var searchResult = await _searchService.SearchAsync(
                parameters.Query, 
                parameters.WorkspaceId, 
                parameters.Limit ?? 10,
                parameters.Since);

            var result = new SearchToolResult
            {
                Success = string.IsNullOrEmpty(searchResult.Error),
                Message = string.IsNullOrEmpty(searchResult.Error) 
                    ? $"Found {searchResult.LimitedCount} results (of {searchResult.TotalCount} total matches)"
                    : $"Search failed: {searchResult.Error}",
                SearchResult = searchResult
            };
            
            if (!string.IsNullOrEmpty(searchResult.Error))
            {
                result.Error = new COA.Mcp.Framework.Models.ErrorInfo
                {
                    Code = "SEARCH_ERROR",
                    Message = searchResult.Error
                };
            }
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during search operation for query '{Query}'", parameters.Query);
            return new SearchToolResult
            {
                Success = false,
                Message = "Search operation failed",
                Error = new COA.Mcp.Framework.Models.ErrorInfo
                {
                    Code = "SEARCH_EXCEPTION",
                    Message = ex.Message
                }
            };
        }
    }
}

/// <summary>
/// Tool for searching checkpoints specifically
/// </summary>
public class SearchCheckpointsTool : GoldfishToolBase<SearchParameters, SearchToolResult>
{
    private readonly ISearchService _searchService;
    private readonly ILogger<SearchCheckpointsTool> _logger;

    public SearchCheckpointsTool(IServiceProvider serviceProvider, ILogger<SearchCheckpointsTool> logger, ISearchService searchService) 
        : base(serviceProvider, logger)
    {
        _searchService = searchService;
        _logger = logger;
    }

    public override string Name => "search_checkpoints";
    public override string Description => "Search checkpoints specifically with relevance ranking";

    protected override async Task<SearchToolResult> ExecuteInternalAsync(
        SearchParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var searchResult = await _searchService.SearchCheckpointsAsync(
                parameters.Query, 
                parameters.WorkspaceId, 
                parameters.Limit ?? 10);

            var result = new SearchToolResult
            {
                Success = string.IsNullOrEmpty(searchResult.Error),
                Message = string.IsNullOrEmpty(searchResult.Error) 
                    ? $"Found {searchResult.LimitedCount} checkpoint results"
                    : $"Checkpoint search failed: {searchResult.Error}",
                SearchResult = searchResult
            };
            
            if (!string.IsNullOrEmpty(searchResult.Error))
            {
                result.Error = new COA.Mcp.Framework.Models.ErrorInfo
                {
                    Code = "SEARCH_CHECKPOINTS_ERROR",
                    Message = searchResult.Error
                };
            }
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during checkpoint search for query '{Query}'", parameters.Query);
            return new SearchToolResult
            {
                Success = false,
                Message = "Checkpoint search operation failed",
                Error = new COA.Mcp.Framework.Models.ErrorInfo
                {
                    Code = "SEARCH_CHECKPOINTS_EXCEPTION",
                    Message = ex.Message
                }
            };
        }
    }
}

/// <summary>
/// Tool for searching plans specifically
/// </summary>
public class SearchPlansTool : GoldfishToolBase<SearchParameters, SearchToolResult>
{
    private readonly ISearchService _searchService;
    private readonly ILogger<SearchPlansTool> _logger;

    public SearchPlansTool(IServiceProvider serviceProvider, ILogger<SearchPlansTool> logger, ISearchService searchService) 
        : base(serviceProvider, logger)
    {
        _searchService = searchService;
        _logger = logger;
    }

    public override string Name => "search_plans";
    public override string Description => "Search plans specifically with relevance ranking";

    protected override async Task<SearchToolResult> ExecuteInternalAsync(
        SearchParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var searchResult = await _searchService.SearchPlansAsync(
                parameters.Query, 
                parameters.WorkspaceId, 
                parameters.Limit ?? 10);

            var result = new SearchToolResult
            {
                Success = string.IsNullOrEmpty(searchResult.Error),
                Message = string.IsNullOrEmpty(searchResult.Error) 
                    ? $"Found {searchResult.LimitedCount} plan results"
                    : $"Plan search failed: {searchResult.Error}",
                SearchResult = searchResult
            };
            
            if (!string.IsNullOrEmpty(searchResult.Error))
            {
                result.Error = new COA.Mcp.Framework.Models.ErrorInfo
                {
                    Code = "SEARCH_PLANS_ERROR",
                    Message = searchResult.Error
                };
            }
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during plan search for query '{Query}'", parameters.Query);
            return new SearchToolResult
            {
                Success = false,
                Message = "Plan search operation failed",
                Error = new COA.Mcp.Framework.Models.ErrorInfo
                {
                    Code = "SEARCH_PLANS_EXCEPTION",
                    Message = ex.Message
                }
            };
        }
    }
}

/// <summary>
/// Tool for searching todos specifically
/// </summary>
public class SearchTodosTool : GoldfishToolBase<SearchParameters, SearchToolResult>
{
    private readonly ISearchService _searchService;
    private readonly ILogger<SearchTodosTool> _logger;

    public SearchTodosTool(IServiceProvider serviceProvider, ILogger<SearchTodosTool> logger, ISearchService searchService) 
        : base(serviceProvider, logger)
    {
        _searchService = searchService;
        _logger = logger;
    }

    public override string Name => "search_todos";
    public override string Description => "Search todos specifically with relevance ranking";

    protected override async Task<SearchToolResult> ExecuteInternalAsync(
        SearchParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var searchResult = await _searchService.SearchTodosAsync(
                parameters.Query, 
                parameters.WorkspaceId, 
                parameters.Limit ?? 10);

            var result = new SearchToolResult
            {
                Success = string.IsNullOrEmpty(searchResult.Error),
                Message = string.IsNullOrEmpty(searchResult.Error) 
                    ? $"Found {searchResult.LimitedCount} todo results"
                    : $"Todo search failed: {searchResult.Error}",
                SearchResult = searchResult
            };
            
            if (!string.IsNullOrEmpty(searchResult.Error))
            {
                result.Error = new COA.Mcp.Framework.Models.ErrorInfo
                {
                    Code = "SEARCH_TODOS_ERROR",
                    Message = searchResult.Error
                };
            }
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during todo search for query '{Query}'", parameters.Query);
            return new SearchToolResult
            {
                Success = false,
                Message = "Todo search operation failed",
                Error = new COA.Mcp.Framework.Models.ErrorInfo
                {
                    Code = "SEARCH_TODOS_EXCEPTION",
                    Message = ex.Message
                }
            };
        }
    }
}

/// <summary>
/// Tool for searching chronicle entries specifically
/// </summary>
public class SearchChronicleTool : GoldfishToolBase<SearchParameters, SearchToolResult>
{
    private readonly ISearchService _searchService;
    private readonly ILogger<SearchChronicleTool> _logger;

    public SearchChronicleTool(IServiceProvider serviceProvider, ILogger<SearchChronicleTool> logger, ISearchService searchService) 
        : base(serviceProvider, logger)
    {
        _searchService = searchService;
        _logger = logger;
    }

    public override string Name => "search_chronicle";
    public override string Description => "Search chronicle entries specifically with relevance ranking";

    protected override async Task<SearchToolResult> ExecuteInternalAsync(
        SearchParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var searchResult = await _searchService.SearchChronicleAsync(
                parameters.Query, 
                parameters.WorkspaceId, 
                parameters.Limit ?? 10);

            var result = new SearchToolResult
            {
                Success = string.IsNullOrEmpty(searchResult.Error),
                Message = string.IsNullOrEmpty(searchResult.Error) 
                    ? $"Found {searchResult.LimitedCount} chronicle results"
                    : $"Chronicle search failed: {searchResult.Error}",
                SearchResult = searchResult
            };
            
            if (!string.IsNullOrEmpty(searchResult.Error))
            {
                result.Error = new COA.Mcp.Framework.Models.ErrorInfo
                {
                    Code = "SEARCH_CHRONICLE_ERROR",
                    Message = searchResult.Error
                };
            }
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during chronicle search for query '{Query}'", parameters.Query);
            return new SearchToolResult
            {
                Success = false,
                Message = "Chronicle search operation failed",
                Error = new COA.Mcp.Framework.Models.ErrorInfo
                {
                    Code = "SEARCH_CHRONICLE_EXCEPTION",
                    Message = ex.Message
                }
            };
        }
    }
}