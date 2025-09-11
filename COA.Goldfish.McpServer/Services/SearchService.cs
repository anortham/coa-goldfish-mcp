using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;

namespace COA.Goldfish.McpServer.Services;

// FTS result classes for raw SQL queries
public class CheckpointFtsResult
{
    public string Id { get; set; } = string.Empty;
    public string WorkspaceId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string WorkContext { get; set; } = string.Empty;
    public string Highlights { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public bool IsGlobal { get; set; }
    public string ActiveFiles { get; set; } = string.Empty;
    public string GitBranch { get; set; } = string.Empty;
}

public class PlanFtsResult
{
    public string Id { get; set; } = string.Empty;
    public string WorkspaceId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Items { get; set; } = string.Empty;
    public string Discoveries { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
}

public class TodoListFtsResult
{
    public string Id { get; set; } = string.Empty;
    public string WorkspaceId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
    public bool IsActive { get; set; }
    public string Tags { get; set; } = string.Empty;
}

public class ChronicleEntryFtsResult
{
    public string Id { get; set; } = string.Empty;
    public string WorkspaceId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string Type { get; set; } = string.Empty;
    public string RelatedPlanId { get; set; } = string.Empty;
    public string RelatedTodoId { get; set; } = string.Empty;
    public string RelatedCheckpointId { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
}

public interface ISearchService
{
    Task<SearchResult> SearchAsync(string query, string? workspaceId = null, int limit = 10, string? since = null);
    Task<SearchResult> SearchCheckpointsAsync(string query, string? workspaceId = null, int limit = 10);
    Task<SearchResult> SearchPlansAsync(string query, string? workspaceId = null, int limit = 10);
    Task<SearchResult> SearchTodosAsync(string query, string? workspaceId = null, int limit = 10);
    Task<SearchResult> SearchChronicleAsync(string query, string? workspaceId = null, int limit = 10);
}

public class SearchService : ISearchService
{
    private readonly GoldfishDbContext _context;
    private readonly ILogger<SearchService> _logger;
    private readonly WorkspaceService _workspaceService;

    public SearchService(GoldfishDbContext context, ILogger<SearchService> logger, WorkspaceService workspaceService)
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

            // Search across all entity types
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
        // Use FTS5 for full-text search directly (simple approach)
        object[] parameters = since.HasValue 
            ? new object[] { query, workspaceId, since.Value }
            : new object[] { query, workspaceId };
            
        var ftsResults = await _context.Database
            .SqlQueryRaw<CheckpointFtsResult>(@"
                SELECT fts.Id, fts.WorkspaceId, fts.Description, fts.WorkContext, fts.Highlights, 
                       c.CreatedAt, c.SessionId, c.IsGlobal, c.ActiveFiles, c.GitBranch
                FROM CheckpointsFts fts
                JOIN Checkpoints c ON fts.Id = c.Id
                WHERE fts MATCH {0} AND fts.WorkspaceId = {1}
                " + (since.HasValue ? " AND c.CreatedAt >= {2}" : "") + @"
                ORDER BY bm25(fts), c.CreatedAt DESC
                LIMIT {" + (since.HasValue ? "3" : "2") + "}", 
                parameters)
            .ToListAsync();

        var checkpoints = ftsResults.Select(r => new Checkpoint
        {
            Id = r.Id,
            WorkspaceId = r.WorkspaceId,
            Description = r.Description,
            WorkContext = r.WorkContext,
            Highlights = System.Text.Json.JsonSerializer.Deserialize<List<string>>(r.Highlights) ?? new List<string>(),
            CreatedAt = r.CreatedAt,
            SessionId = r.SessionId,
            IsGlobal = r.IsGlobal,
            ActiveFiles = System.Text.Json.JsonSerializer.Deserialize<List<string>>(r.ActiveFiles) ?? new List<string>(),
            GitBranch = r.GitBranch
        }).ToList();
            
        var results = checkpoints.Select(c => new SearchResultItem
        {
            Id = c.Id,
            EntityType = "checkpoint",
            Title = TruncateText(c.Description, 100),
            Content = c.WorkContext,
            Snippet = CreateSnippet(c.Description + " " + c.WorkContext, query, 200),
            Timestamp = c.CreatedAt,
            Score = CalculateRelevanceScore(c.Description + " " + c.WorkContext, query),
            Metadata = new Dictionary<string, object>
            {
                ["sessionId"] = c.SessionId,
                ["isGlobal"] = c.IsGlobal,
                ["activeFiles"] = c.ActiveFiles,
                ["highlights"] = c.Highlights
            }
        }).ToList();

        return results;
    }

    private async Task<List<SearchResultItem>> SearchPlansInternalAsync(string query, string workspaceId, int limit, DateTime? since = null)
    {
        // Use FTS5 for full-text search
        object[] parameters = since.HasValue 
            ? new object[] { query, workspaceId, since.Value }
            : new object[] { query, workspaceId };
            
        var ftsResults = await _context.Database
            .SqlQueryRaw<PlanFtsResult>(@"
                SELECT p.Id, p.WorkspaceId, p.Title, p.Description, p.Items, p.Discoveries, p.UpdatedAt,
                       p.Status, p.Category, p.Priority
                FROM PlansFts fts
                JOIN Plans p ON fts.Id = p.Id
                WHERE fts MATCH {0} AND p.WorkspaceId = {1}
                " + (since.HasValue ? " AND p.CreatedAt >= {2}" : "") + @"
                ORDER BY bm25(fts), p.UpdatedAt DESC
                LIMIT {" + (since.HasValue ? "3" : "2") + "}", 
                parameters)
            .ToListAsync();

        var plans = ftsResults.Select(r => new Plan
        {
            Id = r.Id,
            WorkspaceId = r.WorkspaceId,
            Title = r.Title,
            Description = r.Description,
            Items = System.Text.Json.JsonSerializer.Deserialize<List<string>>(r.Items) ?? new List<string>(),
            Discoveries = System.Text.Json.JsonSerializer.Deserialize<List<string>>(r.Discoveries) ?? new List<string>(),
            UpdatedAt = r.UpdatedAt,
            Status = Enum.TryParse<PlanStatus>(r.Status, out var planStatus) ? planStatus : PlanStatus.Draft,
            Category = r.Category,
            Priority = r.Priority
        }).ToList();
            
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
        // Use FTS5 for full-text search
        object[] parameters = since.HasValue 
            ? new object[] { query, workspaceId, since.Value }
            : new object[] { query, workspaceId };
            
        var ftsResults = await _context.Database
            .SqlQueryRaw<TodoListFtsResult>(@"
                SELECT tl.Id, tl.WorkspaceId, tl.Title, tl.Description, tl.UpdatedAt, tl.IsActive, tl.Tags
                FROM TodoListsFts fts
                JOIN TodoLists tl ON fts.Id = tl.Id
                WHERE fts MATCH {0} AND tl.WorkspaceId = {1}
                " + (since.HasValue ? " AND tl.CreatedAt >= {2}" : "") + @"
                ORDER BY bm25(fts), tl.UpdatedAt DESC
                LIMIT {" + (since.HasValue ? "3" : "2") + "}", 
                parameters)
            .ToListAsync();

        var todoIds = ftsResults.Select(r => r.Id).ToList();
        var todoLists = await _context.TodoLists
            .Include(tl => tl.Items)
            .Where(tl => todoIds.Contains(tl.Id))
            .OrderByDescending(tl => tl.UpdatedAt)
            .ToListAsync();
            
        var results = todoLists.Select(tl => new SearchResultItem
        {
            Id = tl.Id,
            EntityType = "todo",
            Title = tl.Title,
            Content = tl.Description,
            Snippet = CreateSnippet(tl.Title + " " + tl.Description, query, 200),
            Timestamp = tl.UpdatedAt,
            Score = CalculateRelevanceScore(tl.Title + " " + tl.Description, query),
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
        // Use FTS5 for full-text search
        object[] parameters = since.HasValue 
            ? new object[] { query, workspaceId, since.Value }
            : new object[] { query, workspaceId };
            
        var ftsResults = await _context.Database
            .SqlQueryRaw<ChronicleEntryFtsResult>(@"
                SELECT ce.Id, ce.WorkspaceId, ce.Description, ce.Timestamp, ce.Type,
                       ce.RelatedPlanId, ce.RelatedTodoId, ce.RelatedCheckpointId, ce.Tags
                FROM ChronicleEntriesFts fts
                JOIN ChronicleEntries ce ON fts.Id = ce.Id
                WHERE fts MATCH {0} AND ce.WorkspaceId = {1}
                " + (since.HasValue ? " AND ce.Timestamp >= {2}" : "") + @"
                ORDER BY bm25(fts), ce.Timestamp DESC
                LIMIT {" + (since.HasValue ? "3" : "2") + "}", 
                parameters)
            .ToListAsync();

        var chronicleEntries = ftsResults.Select(r => new ChronicleEntry
        {
            Id = r.Id,
            WorkspaceId = r.WorkspaceId,
            Description = r.Description,
            Timestamp = r.Timestamp,
            Type = Enum.TryParse<ChronicleEntryType>(r.Type, out var entryType) ? entryType : ChronicleEntryType.Note,
            RelatedPlanId = r.RelatedPlanId,
            RelatedTodoId = r.RelatedTodoId,
            RelatedCheckpointId = r.RelatedCheckpointId,
            Tags = System.Text.Json.JsonSerializer.Deserialize<List<string>>(r.Tags) ?? new List<string>()
        }).ToList();
            
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

public class SearchResult
{
    public string Query { get; set; } = string.Empty;
    public string WorkspaceId { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public List<SearchResultItem> Results { get; set; } = new List<SearchResultItem>();
    public int TotalCount { get; set; }
    public int LimitedCount { get; set; }
    public string? Error { get; set; }
}

public class SearchResultItem
{
    public string Id { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Snippet { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public double Score { get; set; }
    public Dictionary<string, object> Metadata { get; set; } = new Dictionary<string, object>();
}