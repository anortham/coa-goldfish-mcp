using NUnit.Framework;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using COA.Goldfish.McpServer.Services;
using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;

namespace COA.Goldfish.IntegrationTests;

[TestFixture]
public class SearchServiceFts5Tests
{
    private IServiceProvider _serviceProvider = null!;
    private ISearchService _searchService = null!;
    private GoldfishDbContext _context = null!;
    private string _testWorkspaceId = null!;

    [SetUp]
    public async Task SetUp()
    {
        _testWorkspaceId = "test-workspace-" + Guid.NewGuid().ToString("N")[..8];

        var services = new ServiceCollection();
        services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(LogLevel.Warning));
        
        // Add configuration (required by PathResolutionService)
        var testWorkspacePath = Path.Combine(Path.GetTempPath(), $"goldfish_test_{_testWorkspaceId}");
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Goldfish:PrimaryWorkspace"] = testWorkspacePath
            })
            .Build();
        services.AddSingleton<IConfiguration>(configuration);
        
        // Use file-based SQLite database for FTS5 support
        var testDbPath = Path.Combine(Path.GetTempPath(), $"fts5test_{_testWorkspaceId}.db");
        services.AddDbContext<GoldfishDbContext>(options =>
            options.UseSqlite($"Data Source={testDbPath}"));
            
        services.AddScoped<COA.Goldfish.McpServer.Services.IPathResolutionService, COA.Goldfish.McpServer.Services.PathResolutionService>();
        services.AddScoped<WorkspaceService>();
        services.AddScoped<ISearchService, TestSearchService>();
        services.AddScoped<DatabaseInitializer>();

        _serviceProvider = services.BuildServiceProvider();
        _context = _serviceProvider.GetRequiredService<GoldfishDbContext>();
        _searchService = _serviceProvider.GetRequiredService<ISearchService>();

        // Initialize database
        await _context.Database.EnsureCreatedAsync();
        
        // Seed test data
        await SeedTestDataAsync();
    }

    [TearDown]
    public async Task TearDown()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"fts5test_{_testWorkspaceId}.db");
        
        await _context.Database.EnsureDeletedAsync();
        await _context.DisposeAsync();
        if (_serviceProvider is IDisposable disposable)
        {
            disposable.Dispose();
        }
        
        // Clean up database file if it exists
        if (File.Exists(dbPath))
        {
            File.Delete(dbPath);
        }
    }

    private async Task SeedTestDataAsync()
    {
        var checkpoint = new Checkpoint
        {
            Id = "checkpoint-1",
            WorkspaceId = _testWorkspaceId,
            Description = "Implemented FTS5 search functionality",
            WorkContext = "Working on full-text search improvements",
            Highlights = new List<string> { "Added FTS5 support", "Improved performance" },
            CreatedAt = DateTime.UtcNow
        };

        var plan = new Plan
        {
            Id = "plan-1", 
            WorkspaceId = _testWorkspaceId,
            Title = "Search Performance Enhancement",
            Description = "Improve search capabilities with FTS5",
            Status = PlanStatus.Active,
            Items = new List<string> { "Implement FTS5", "Test performance" },
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var todoList = new TodoList
        {
            Id = "todo-1",
            WorkspaceId = _testWorkspaceId,
            Title = "FTS5 Implementation Tasks",
            Description = "Tasks related to full-text search implementation",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var chronicle = new ChronicleEntry
        {
            Id = "chronicle-1",
            WorkspaceId = _testWorkspaceId,
            Description = "Completed FTS5 migration successfully",
            Type = ChronicleEntryType.Milestone,
            Timestamp = DateTime.UtcNow
        };

        _context.Checkpoints.Add(checkpoint);
        _context.Plans.Add(plan);
        _context.TodoLists.Add(todoList);
        _context.ChronicleEntries.Add(chronicle);
        
        await _context.SaveChangesAsync();
    }
    
    private async Task SyncExistingDataToFtsAsync()
    {
        // For simple FTS5 tables, manually insert existing data with JSON serialized lists
        var checkpoints = await _context.Checkpoints.ToListAsync();
        foreach (var checkpoint in checkpoints)
        {
            await _context.Database.ExecuteSqlRawAsync(@"
                INSERT INTO CheckpointsFts(Id, WorkspaceId, Description, WorkContext, Highlights)
                VALUES ({0}, {1}, {2}, {3}, {4})",
                checkpoint.Id,
                checkpoint.WorkspaceId,
                checkpoint.Description,
                checkpoint.WorkContext ?? "",
                System.Text.Json.JsonSerializer.Serialize(checkpoint.Highlights));
        }
        
        var plans = await _context.Plans.ToListAsync();
        foreach (var plan in plans)
        {
            await _context.Database.ExecuteSqlRawAsync(@"
                INSERT INTO PlansFts(Id, WorkspaceId, Title, Description, Items, Discoveries) 
                VALUES ({0}, {1}, {2}, {3}, {4}, {5})",
                plan.Id,
                plan.WorkspaceId,
                plan.Title,
                plan.Description,
                System.Text.Json.JsonSerializer.Serialize(plan.Items),
                System.Text.Json.JsonSerializer.Serialize(plan.Discoveries));
        }
        
        var todoLists = await _context.TodoLists.ToListAsync();
        foreach (var todoList in todoLists)
        {
            await _context.Database.ExecuteSqlRawAsync(@"
                INSERT INTO TodoListsFts(Id, WorkspaceId, Title, Description)
                VALUES ({0}, {1}, {2}, {3})",
                todoList.Id,
                todoList.WorkspaceId,
                todoList.Title,
                todoList.Description ?? "");
        }
        
        var chronicleEntries = await _context.ChronicleEntries.ToListAsync();
        foreach (var entry in chronicleEntries)
        {
            await _context.Database.ExecuteSqlRawAsync(@"
                INSERT INTO ChronicleEntriesFts(Id, WorkspaceId, Description)
                VALUES ({0}, {1}, {2})",
                entry.Id,
                entry.WorkspaceId,
                entry.Description);
        }
    }

    [Test]
    public async Task SearchAsync_ShouldFindCheckpoints_UsingLikeSearch()
    {
        // Act
        var result = await _searchService.SearchAsync("FTS5", _testWorkspaceId, limit: 10);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Results, Is.Not.Empty);
        Assert.That(result.Results.Any(r => r.EntityType == "checkpoint"), Is.True);
        Assert.That(result.Results.Any(r => r.Title.Contains("FTS5") || r.Content.Contains("FTS5") || r.Snippet.Contains("FTS5")), Is.True);
    }

    public class CountResult
    {
        public int Count { get; set; }
    }

    [Test]
    public async Task SearchCheckpointsAsync_ShouldReturnRelevantResults()
    {
        // Act
        var result = await _searchService.SearchCheckpointsAsync("search functionality", _testWorkspaceId);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.EntityType, Is.EqualTo("checkpoint"));
        Assert.That(result.Results, Is.Not.Empty);
        Assert.That(result.Results[0].EntityType, Is.EqualTo("checkpoint"));
    }

    [Test]
    public async Task SearchPlansAsync_ShouldReturnRelevantResults()
    {
        // Act
        var result = await _searchService.SearchPlansAsync("enhancement", _testWorkspaceId);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.EntityType, Is.EqualTo("plan"));
        Assert.That(result.Results, Is.Not.Empty);
        Assert.That(result.Results[0].EntityType, Is.EqualTo("plan"));
    }

    [Test]
    public async Task SearchTodosAsync_ShouldReturnRelevantResults()
    {
        // Act
        var result = await _searchService.SearchTodosAsync("implementation", _testWorkspaceId);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.EntityType, Is.EqualTo("todo"));
        Assert.That(result.Results, Is.Not.Empty);
        Assert.That(result.Results[0].EntityType, Is.EqualTo("todo"));
    }

    [Test]
    public async Task SearchChronicleAsync_ShouldReturnRelevantResults()
    {
        // Act
        var result = await _searchService.SearchChronicleAsync("migration", _testWorkspaceId);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.EntityType, Is.EqualTo("chronicle"));
        Assert.That(result.Results, Is.Not.Empty);
        Assert.That(result.Results[0].EntityType, Is.EqualTo("chronicle"));
    }

    [Test]
    public async Task SearchAsync_ShouldHandleEmptyQuery_Gracefully()
    {
        // Act
        var result = await _searchService.SearchAsync("nonexistentterm", _testWorkspaceId);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Results, Is.Empty);
        Assert.That(result.TotalCount, Is.EqualTo(0));
        Assert.That(result.Error, Is.Null);
    }

    [Test]
    public async Task SearchAsync_ShouldRankResultsByRelevance()
    {
        // Act
        var result = await _searchService.SearchAsync("FTS5", _testWorkspaceId, limit: 10);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Results, Is.Not.Empty);
        
        // Results should be ordered by score (descending) and then by date
        for (int i = 0; i < result.Results.Count - 1; i++)
        {
            var current = result.Results[i];
            var next = result.Results[i + 1];
            Assert.That(current.Score >= next.Score || current.Timestamp >= next.Timestamp, Is.True, 
                $"Results should be ordered by score then timestamp. Item {i}: Score={current.Score}, Time={current.Timestamp}; Item {i+1}: Score={next.Score}, Time={next.Timestamp}");
        }
    }
}