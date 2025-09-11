using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using COA.Goldfish.McpServer.Services;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Test-specific SearchService that uses LIKE queries instead of FTS5 
/// to avoid complex FTS5 setup in tests while maintaining same interface
/// </summary>
public class TestSearchService : ISearchService
{
    private readonly GoldfishDbContext _context;
    private readonly ILogger<TestSearchService> _logger;
    private readonly WorkspaceService _workspaceService;

    public TestSearchService(GoldfishDbContext context, ILogger<TestSearchService> logger, WorkspaceService workspaceService)
    {
        _context = context;
        _logger = logger;
        _workspaceService = workspaceService;
    }

    public async Task<SearchResult> SearchAsync(string query, string? workspaceId = null, int limit = 10, string? since = null)
    {
        try
        {
            var resolvedWorkspaceId = workspaceId ?? _workspaceService.GetCurrentWorkspace();
            var sinceDate = ParseSinceParameter(since);

            _logger.LogDebug("Starting comprehensive search for query '{Query}' in workspace '{WorkspaceId}'", query, resolvedWorkspaceId);

            // Search across all entity types using LIKE queries
            var checkpointResults = await SearchCheckpointsInternalAsync(query, resolvedWorkspaceId, limit / 4 + 1, sinceDate);
            var planResults = await SearchPlansInternalAsync(query, resolvedWorkspaceId, limit / 4 + 1, sinceDate);
            var todoResults = await SearchTodosInternalAsync(query, resolvedWorkspaceId, limit / 4 + 1, sinceDate);
            var chronicleResults = await SearchChronicleInternalAsync(query, resolvedWorkspaceId, limit / 4 + 1, sinceDate);

            // Combine and rank results
            var allResults = new List<SearchResultItem>();
            allResults.AddRange(checkpointResults);
            allResults.AddRange(planResults);
            allResults.AddRange(todoResults);
            allResults.AddRange(chronicleResults);

            // Sort by relevance (higher scores first) and then by date (newer first)
            var rankedResults = allResults
                .OrderByDescending(r => r.Score)
                .ThenByDescending(r => r.Timestamp)
                .Take(limit)
                .ToList();

            return new SearchResult
            {
                Query = query,
                WorkspaceId = resolvedWorkspaceId,
                Results = rankedResults,
                TotalCount = allResults.Count,
                LimitedCount = rankedResults.Count
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during comprehensive search for query '{Query}'", query);
            return new SearchResult
            {
                Query = query,
                WorkspaceId = workspaceId ?? "unknown",
                Results = new List<SearchResultItem>(),
                TotalCount = 0,
                LimitedCount = 0,
                Error = ex.Message
            };
        }
    }

    public async Task<SearchResult> SearchCheckpointsAsync(string query, string? workspaceId = null, int limit = 10)
    {
        try
        {
            var resolvedWorkspaceId = workspaceId ?? _workspaceService.GetCurrentWorkspace();
            var results = await SearchCheckpointsInternalAsync(query, resolvedWorkspaceId, limit);

            return new SearchResult
            {
                Query = query,
                WorkspaceId = resolvedWorkspaceId,
                Results = results,
                TotalCount = results.Count,
                LimitedCount = results.Count,
                EntityType = "checkpoint"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching checkpoints for query '{Query}'", query);
            return new SearchResult
            {
                Query = query,
                WorkspaceId = workspaceId ?? "unknown",
                Results = new List<SearchResultItem>(),
                Error = ex.Message
            };
        }
    }

    public async Task<SearchResult> SearchPlansAsync(string query, string? workspaceId = null, int limit = 10)
    {
        try
        {
            var resolvedWorkspaceId = workspaceId ?? _workspaceService.GetCurrentWorkspace();
            var results = await SearchPlansInternalAsync(query, resolvedWorkspaceId, limit);

            return new SearchResult
            {
                Query = query,
                WorkspaceId = resolvedWorkspaceId,
                Results = results,
                TotalCount = results.Count,
                LimitedCount = results.Count,
                EntityType = "plan"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching plans for query '{Query}'", query);
            return new SearchResult
            {
                Query = query,
                WorkspaceId = workspaceId ?? "unknown",
                Results = new List<SearchResultItem>(),
                Error = ex.Message
            };
        }
    }

    public async Task<SearchResult> SearchTodosAsync(string query, string? workspaceId = null, int limit = 10)
    {
        try
        {
            var resolvedWorkspaceId = workspaceId ?? _workspaceService.GetCurrentWorkspace();
            var results = await SearchTodosInternalAsync(query, resolvedWorkspaceId, limit);

            return new SearchResult
            {
                Query = query,
                WorkspaceId = resolvedWorkspaceId,
                Results = results,
                TotalCount = results.Count,
                LimitedCount = results.Count,
                EntityType = "todo"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching todos for query '{Query}'", query);
            return new SearchResult
            {
                Query = query,
                WorkspaceId = workspaceId ?? "unknown",
                Results = new List<SearchResultItem>(),
                Error = ex.Message
            };
        }
    }

    public async Task<SearchResult> SearchChronicleAsync(string query, string? workspaceId = null, int limit = 10)
    {
        try
        {
            var resolvedWorkspaceId = workspaceId ?? _workspaceService.GetCurrentWorkspace();
            var results = await SearchChronicleInternalAsync(query, resolvedWorkspaceId, limit);

            return new SearchResult
            {
                Query = query,
                WorkspaceId = resolvedWorkspaceId,
                Results = results,
                TotalCount = results.Count,
                LimitedCount = results.Count,
                EntityType = "chronicle"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching chronicle for query '{Query}'", query);
            return new SearchResult
            {
                Query = query,
                WorkspaceId = workspaceId ?? "unknown",
                Results = new List<SearchResultItem>(),
                Error = ex.Message
            };
        }
    }

    private async Task<List<SearchResultItem>> SearchCheckpointsInternalAsync(string query, string workspaceId, int limit, DateTime? since = null)
    {
        var checkpointsQuery = _context.Checkpoints
            .Where(c => c.WorkspaceId == workspaceId)
            .Where(c => c.Description.ToLower().Contains(query.ToLower()) || (c.WorkContext != null && c.WorkContext.ToLower().Contains(query.ToLower())));

        if (since.HasValue)
            checkpointsQuery = checkpointsQuery.Where(c => c.CreatedAt >= since.Value);

        var checkpoints = await checkpointsQuery
            .OrderByDescending(c => c.CreatedAt)
            .Take(limit)
            .ToListAsync();
            
        var results = checkpoints.Select(c => new SearchResultItem
        {
            Id = c.Id,
            EntityType = "checkpoint",
            Title = TruncateText(c.Description, 100),
            Content = c.WorkContext ?? "",
            Snippet = CreateSnippet(c.Description + " " + (c.WorkContext ?? ""), query, 200),
            Timestamp = c.CreatedAt,
            Score = CalculateRelevanceScore(c.Description + " " + (c.WorkContext ?? ""), query),
            Metadata = new Dictionary<string, object>
            {
                ["sessionId"] = c.SessionId ?? "",
                ["isGlobal"] = c.IsGlobal,
                ["activeFiles"] = c.ActiveFiles,
                ["highlights"] = c.Highlights
            }
        }).ToList();

        return results;
    }

    private async Task<List<SearchResultItem>> SearchPlansInternalAsync(string query, string workspaceId, int limit, DateTime? since = null)
    {
        var plansQuery = _context.Plans
            .Where(p => p.WorkspaceId == workspaceId)
            .Where(p => p.Title.ToLower().Contains(query.ToLower()) || p.Description.ToLower().Contains(query.ToLower()));

        if (since.HasValue)
            plansQuery = plansQuery.Where(p => p.CreatedAt >= since.Value);

        var plans = await plansQuery
            .OrderByDescending(p => p.UpdatedAt)
            .Take(limit)
            .ToListAsync();
            
        var results = plans.Select(p => new SearchResultItem
        {
            Id = p.Id,
            EntityType = "plan",
            Title = p.Title,
            Content = p.Description,
            Snippet = CreateSnippet(p.Title + " " + p.Description, query, 200),
            Timestamp = p.UpdatedAt,
            Score = CalculateRelevanceScore(p.Title + " " + p.Description, query),
            Metadata = new Dictionary<string, object>
            {
                ["status"] = p.Status,
                ["category"] = p.Category ?? "",
                ["priority"] = p.Priority ?? "",
                ["items"] = p.Items,
                ["discoveries"] = p.Discoveries
            }
        }).ToList();

        return results;
    }

    private async Task<List<SearchResultItem>> SearchTodosInternalAsync(string query, string workspaceId, int limit, DateTime? since = null)
    {
        var todoListsQuery = _context.TodoLists
            .Where(tl => tl.WorkspaceId == workspaceId)
            .Where(tl => tl.Title.ToLower().Contains(query.ToLower()) || (tl.Description != null && tl.Description.ToLower().Contains(query.ToLower())));

        if (since.HasValue)
            todoListsQuery = todoListsQuery.Where(tl => tl.CreatedAt >= since.Value);

        var todoLists = await todoListsQuery
            .Include(tl => tl.Items)
            .OrderByDescending(tl => tl.UpdatedAt)
            .Take(limit)
            .ToListAsync();
            
        var results = todoLists.Select(tl => new SearchResultItem
        {
            Id = tl.Id,
            EntityType = "todo",
            Title = tl.Title,
            Content = tl.Description ?? "",
            Snippet = CreateSnippet(tl.Title + " " + (tl.Description ?? ""), query, 200),
            Timestamp = tl.UpdatedAt,
            Score = CalculateRelevanceScore(tl.Title + " " + (tl.Description ?? ""), query),
            Metadata = new Dictionary<string, object>
            {
                ["isActive"] = tl.IsActive,
                ["itemCount"] = tl.Items.Count,
                ["pendingCount"] = tl.Items.Count(i => i.Status == TodoItemStatus.Pending),
                ["completedCount"] = tl.Items.Count(i => i.Status == TodoItemStatus.Done),
                ["tags"] = tl.Tags
            }
        }).ToList();

        return results;
    }

    private async Task<List<SearchResultItem>> SearchChronicleInternalAsync(string query, string workspaceId, int limit, DateTime? since = null)
    {
        var chronicleQuery = _context.ChronicleEntries
            .Where(ce => ce.WorkspaceId == workspaceId)
            .Where(ce => ce.Description.ToLower().Contains(query.ToLower()));

        if (since.HasValue)
            chronicleQuery = chronicleQuery.Where(ce => ce.Timestamp >= since.Value);

        var chronicleEntries = await chronicleQuery
            .OrderByDescending(ce => ce.Timestamp)
            .Take(limit)
            .ToListAsync();
            
        var results = chronicleEntries.Select(ce => new SearchResultItem
        {
            Id = ce.Id,
            EntityType = "chronicle",
            Title = TruncateText(ce.Description, 100),
            Content = ce.Description,
            Snippet = CreateSnippet(ce.Description, query, 200),
            Timestamp = ce.Timestamp,
            Score = CalculateRelevanceScore(ce.Description, query),
            Metadata = new Dictionary<string, object>
            {
                ["type"] = ce.Type,
                ["relatedPlanId"] = ce.RelatedPlanId ?? "",
                ["relatedTodoId"] = ce.RelatedTodoId ?? "",
                ["relatedCheckpointId"] = ce.RelatedCheckpointId ?? "",
                ["tags"] = ce.Tags
            }
        }).ToList();

        return results;
    }

    private static DateTime? ParseSinceParameter(string? since)
    {
        if (string.IsNullOrWhiteSpace(since))
            return null;

        var now = DateTime.UtcNow;

        return since.ToLowerInvariant() switch
        {
            "1h" or "hour" => now.AddHours(-1),
            "1d" or "day" or "today" => now.AddDays(-1),
            "3d" => now.AddDays(-3),
            "1w" or "week" => now.AddDays(-7),
            "2w" => now.AddDays(-14),
            "1m" or "month" => now.AddDays(-30),
            _ when DateTime.TryParse(since, out var parsed) => parsed,
            _ => null
        };
    }

    private static double CalculateRelevanceScore(string text, string query)
    {
        if (string.IsNullOrWhiteSpace(text) || string.IsNullOrWhiteSpace(query))
            return 0.0;

        var lowerText = text.ToLowerInvariant();
        var lowerQuery = query.ToLowerInvariant();
        var queryTerms = lowerQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        double score = 0.0;

        foreach (var term in queryTerms)
        {
            // Exact match gets highest score
            if (lowerText.Contains(term))
            {
                score += 1.0;
                
                // Bonus for word boundary matches
                if (lowerText.Contains(" " + term + " ") || lowerText.StartsWith(term + " ") || lowerText.EndsWith(" " + term))
                {
                    score += 0.5;
                }
            }
        }

        // Normalize by query term count
        return queryTerms.Length > 0 ? score / queryTerms.Length : 0.0;
    }

    private static string CreateSnippet(string text, string query, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(text))
            return "";

        var lowerText = text.ToLowerInvariant();
        var lowerQuery = query.ToLowerInvariant();
        
        // Try to find the query in the text
        var index = lowerText.IndexOf(lowerQuery);
        
        if (index == -1)
        {
            // If exact query not found, look for first query term
            var queryTerms = lowerQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (queryTerms.Length > 0)
            {
                index = lowerText.IndexOf(queryTerms[0]);
            }
        }

        if (index == -1)
        {
            // No match found, return beginning of text
            return TruncateText(text, maxLength);
        }

        // Create snippet around the match
        var start = Math.Max(0, index - maxLength / 3);
        var length = Math.Min(maxLength, text.Length - start);
        
        var snippet = text.Substring(start, length);
        
        if (start > 0)
            snippet = "..." + snippet;
        if (start + length < text.Length)
            snippet = snippet + "...";
            
        return snippet;
    }

    private static string TruncateText(string text, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Length <= maxLength)
            return text ?? "";

        return text.Substring(0, maxLength) + "...";
    }
}