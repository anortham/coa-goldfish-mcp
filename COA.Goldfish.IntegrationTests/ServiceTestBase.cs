using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using NUnit.Framework;
using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Services;
using COA.Goldfish.McpServer.Tools;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Base class for service-based testing that eliminates MCP server process spawning.
/// Provides direct access to all MCP tools and services with proper database isolation.
/// </summary>
public abstract class ServiceTestBase
{
    protected IServiceProvider? _serviceProvider;
    protected IServiceScope? _serviceScope;
    protected GoldfishDbContext? _context;
    
    // Direct access to all MCP tools - no process spawning required
    protected CheckpointTool? _checkpointTool;
    protected TodoTool? _todoTool;
    protected PlanTool? _planTool;
    protected StandupTool? _standupTool;
    protected ChronicleTool? _chronicleTool;
    protected WorkspaceTool? _workspaceTool;
    protected RecallTool? _recallTool;
    protected SearchTool? _searchTool;
    
    // Access to core services
    protected WorkspaceService? _workspaceService;
    protected COA.Goldfish.McpServer.Services.ISearchService? _searchService;
    protected COA.Goldfish.McpServer.Services.IPathResolutionService? _pathResolutionService;
    
    protected string _testWorkspacePath = "";
    protected string _testWorkspaceId = "";

    [SetUp]
    public virtual async Task SetUp()
    {
        await SetUpServicesAsync();
        await InitializeTestWorkspaceAsync();
    }

    /// <summary>
    /// Sets up the complete service dependency injection container with all MCP tools.
    /// This replaces MCP server process spawning with direct service calls.
    /// </summary>
    protected virtual async Task SetUpServicesAsync()
    {
        // Create isolated test database
        _context = CreateTestContext();
        await TestDbContextFactory.InitializeAsync(_context, false);

        // Set up dependency injection container
        var services = new ServiceCollection();
        
        // Add logging
        services.AddLogging(builder => 
            builder.AddConsole()
                   .SetMinimumLevel(LogLevel.Information));
        
        // Register specific loggers for tools
        services.AddSingleton(typeof(ILogger<>), typeof(Logger<>));

        // Add configuration (required by PathResolutionService)
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Goldfish:PrimaryWorkspace"] = _testWorkspacePath
            })
            .Build();
        services.AddSingleton<IConfiguration>(configuration);

        // Add database context factory for proper threading isolation
        // Each scope gets its own context, but sharing the same database connection for SQLite
        services.AddScoped<GoldfishDbContext>(_ => {
            if (_context!.Database.IsSqlite())
            {
                // For SQLite, create new context with same connection
                var connection = _context.Database.GetDbConnection();
                var options = new DbContextOptionsBuilder<GoldfishDbContext>()
                    .UseSqlite(connection)
                    .EnableSensitiveDataLogging()
                    .EnableDetailedErrors()
                    .Options;
                return new GoldfishDbContext(options);
            }
            else
            {
                // For InMemory EF, return the shared instance
                return _context;
            }
        });

        // Add core services (matching main application)
        services.AddScoped<COA.Goldfish.McpServer.Services.Storage.IStorageService, COA.Goldfish.McpServer.Services.Storage.StorageService>();
        services.AddScoped<DatabaseInitializer>();
        services.AddScoped<COA.Goldfish.McpServer.Services.IPathResolutionService, PathResolutionService>();
        services.AddScoped<WorkspaceService>();
        services.AddScoped<COA.Goldfish.McpServer.Services.ISearchService, SearchService>();

        // Add all MCP tools (matching main application)
        services.AddScoped<CheckpointTool>();
        services.AddScoped<TodoTool>();
        services.AddScoped<PlanTool>();
        services.AddScoped<StandupTool>();
        services.AddScoped<ChronicleTool>();
        services.AddScoped<WorkspaceTool>();
        services.AddScoped<RecallTool>();
        services.AddScoped<SearchTool>();

        // Build service provider
        _serviceProvider = services.BuildServiceProvider();

        // Create a scope for scoped services - store for proper disposal
        _serviceScope = _serviceProvider.CreateScope();
        var scopedProvider = _serviceScope.ServiceProvider;

        // Get tool instances from scoped provider
        _checkpointTool = scopedProvider.GetRequiredService<CheckpointTool>();
        _todoTool = scopedProvider.GetRequiredService<TodoTool>();
        _planTool = scopedProvider.GetRequiredService<PlanTool>();
        _standupTool = scopedProvider.GetRequiredService<StandupTool>();
        _chronicleTool = scopedProvider.GetRequiredService<ChronicleTool>();
        _workspaceTool = scopedProvider.GetRequiredService<WorkspaceTool>();
        _recallTool = scopedProvider.GetRequiredService<RecallTool>();
        _searchTool = scopedProvider.GetRequiredService<SearchTool>();

        // Get service instances from scoped provider
        _workspaceService = scopedProvider.GetRequiredService<WorkspaceService>();
        _searchService = scopedProvider.GetRequiredService<COA.Goldfish.McpServer.Services.ISearchService>();
        _pathResolutionService = scopedProvider.GetRequiredService<COA.Goldfish.McpServer.Services.IPathResolutionService>();
    }

    /// <summary>
    /// Creates the appropriate test database context.
    /// Override this method to customize database type for specific test scenarios.
    /// </summary>
    protected virtual GoldfishDbContext CreateTestContext()
    {
        // Default to in-memory EF database for speed
        // Override in derived classes for SQLite FTS5 testing
        return TestDbContextFactory.CreateInMemoryContext();
    }

    /// <summary>
    /// Initializes an isolated test workspace for this test session.
    /// </summary>
    protected virtual async Task InitializeTestWorkspaceAsync()
    {
        _testWorkspaceId = Guid.NewGuid().ToString();
        _testWorkspacePath = Path.Combine(Path.GetTempPath(), $"goldfish_test_workspace_{_testWorkspaceId}");
        
        // Create workspace directory if using file-based testing
        Directory.CreateDirectory(_testWorkspacePath);

        // Add workspace to database
        var workspace = new COA.Goldfish.McpServer.Models.WorkspaceState
        {
            WorkspaceId = _testWorkspaceId,
            LastActivity = DateTime.UtcNow
        };

        _context!.WorkspaceStates.Add(workspace);
        await _context.SaveChangesAsync();
    }

    [TearDown]
    public virtual async Task TearDown()
    {
        await CleanupServicesAsync();
        await CleanupTestWorkspaceAsync();
    }

    /// <summary>
    /// Properly disposes all services and cleans up database resources.
    /// Critical for preventing file locks and memory leaks.
    /// </summary>
    protected virtual async Task CleanupServicesAsync()
    {
        // Dispose service scope first
        _serviceScope?.Dispose();
        _serviceScope = null;

        // Dispose service provider
        if (_serviceProvider is IDisposable disposableServiceProvider)
        {
            disposableServiceProvider.Dispose();
        }
        _serviceProvider = null;

        // Clean up database context
        if (_context != null)
        {
            await TestDbContextFactory.CleanupAsync(_context);
            _context = null;
        }

        // Clear SQLite connection pools to prevent file locks
        SqliteConnection.ClearAllPools();
        
        // Force garbage collection to ensure all connections are disposed
        GC.Collect();
        GC.WaitForPendingFinalizers();
    }

    /// <summary>
    /// Cleans up the test workspace directory and associated resources.
    /// </summary>
    protected virtual async Task CleanupTestWorkspaceAsync()
    {
        await Task.Delay(1); // Ensure async context
        
        try
        {
            if (Directory.Exists(_testWorkspacePath))
            {
                Directory.Delete(_testWorkspacePath, recursive: true);
            }
        }
        catch (Exception)
        {
            // Ignore cleanup errors - they don't affect test results
        }
    }

    /// <summary>
    /// Helper method to create realistic checkpoint data for testing.
    /// </summary>
    protected virtual COA.Goldfish.McpServer.Models.CheckpointParameters CreateCheckpointRequest(
        string description = "Test checkpoint",
        List<string>? highlights = null,
        List<string>? activeFiles = null)
    {
        return new COA.Goldfish.McpServer.Models.CheckpointParameters
        {
            Action = "save",
            Description = description,
            Highlights = highlights ?? new List<string> { "Test highlight" },
            ActiveFiles = activeFiles ?? new List<string> { "TestFile.cs" },
            WorkContext = "Test work context",
            Workspace = _testWorkspaceId,
            Global = false
        };
    }

    /// <summary>
    /// Helper method to create todo list request for testing.
    /// </summary>
    protected virtual COA.Goldfish.McpServer.Models.TodoParameters CreateTodoRequest(
        string title = "Test Todo List",
        List<string>? items = null)
    {
        return new COA.Goldfish.McpServer.Models.TodoParameters
        {
            Action = "create",
            Title = title,
            Items = items ?? new List<string> { "Test todo item" },
            Workspace = _testWorkspaceId
        };
    }

    /// <summary>
    /// Helper method to create plan request for testing.
    /// </summary>
    protected virtual COA.Goldfish.McpServer.Models.PlanParameters CreatePlanRequest(
        string title = "Test Plan",
        string description = "Test plan description",
        List<string>? items = null)
    {
        return new COA.Goldfish.McpServer.Models.PlanParameters
        {
            Action = "save",
            Title = title,
            Description = description,
            Items = items ?? new List<string> { "Test plan item" },
            Category = "test",
            Priority = "medium",
            Workspace = _testWorkspaceId
        };
    }

    /// <summary>
    /// Helper method to verify that a database operation succeeded.
    /// </summary>
    protected virtual async Task<T?> GetEntityByIdAsync<T>(string id) where T : class
    {
        return await _context!.Set<T>().FindAsync(id);
    }

    /// <summary>
    /// Helper method to count entities of a specific type in the test database.
    /// </summary>
    protected virtual async Task<int> CountEntitiesAsync<T>() where T : class
    {
        return await Task.FromResult(_context!.Set<T>().Count());
    }

    /// <summary>
    /// Helper method to verify workspace isolation.
    /// </summary>
    protected virtual async Task<bool> IsWorkspaceIsolatedAsync()
    {
        var workspaces = _context!.WorkspaceStates.ToList();
        return await Task.FromResult(workspaces.All(w => w.WorkspaceId == _testWorkspaceId));
    }
}