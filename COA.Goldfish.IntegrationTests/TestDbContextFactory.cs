using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using COA.Goldfish.McpServer.Services.Storage;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Factory for creating isolated test database contexts.
/// Eliminates database contamination and ensures proper test isolation.
/// </summary>
public static class TestDbContextFactory
{
    /// <summary>
    /// Creates an in-memory Entity Framework database context for fast testing.
    /// Perfect for tests that don't require SQLite FTS5 features.
    /// </summary>
    public static GoldfishDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<GoldfishDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .EnableSensitiveDataLogging()
            .EnableDetailedErrors()
            .Options;

        return new GoldfishDbContext(options);
    }

    /// <summary>
    /// Creates an in-memory SQLite database context for testing SQLite-specific features like FTS5.
    /// Uses SQLite in-memory database which supports all SQLite features.
    /// </summary>
    public static GoldfishDbContext CreateInMemorySqliteContext()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var options = new DbContextOptionsBuilder<GoldfishDbContext>()
            .UseSqlite(connection)
            .EnableSensitiveDataLogging()
            .EnableDetailedErrors()
            .Options;

        var context = new GoldfishDbContext(options);
        
        // Keep the connection alive for the lifetime of the context
        context.Database.SetDbConnection(connection);
        
        return context;
    }

    /// <summary>
    /// Creates a temporary file-based SQLite database for tests that need persistent storage.
    /// Automatically cleans up the file after test completion.
    /// </summary>
    public static GoldfishDbContext CreateTempFileContext(out string tempFilePath)
    {
        tempFilePath = Path.Combine(Path.GetTempPath(), $"goldfish_test_{Guid.NewGuid()}.db");

        var connectionString = $"DataSource={tempFilePath}";
        var options = new DbContextOptionsBuilder<GoldfishDbContext>()
            .UseSqlite(connectionString)
            .EnableSensitiveDataLogging()
            .EnableDetailedErrors()
            .Options;

        return new GoldfishDbContext(options);
    }

    /// <summary>
    /// Initializes the database with proper schema and optionally seeds test data.
    /// </summary>
    /// <param name="context">Database context to initialize</param>
    /// <param name="seedData">Whether to add sample test data</param>
    public static async Task InitializeAsync(GoldfishDbContext context, bool seedData = false)
    {
        // Ensure database is created with proper schema
        await context.Database.EnsureCreatedAsync();

        // Initialize FTS5 tables if using SQLite
        if (context.Database.IsSqlite())
        {
            await context.CreateFtsTablesAsync();
        }

        if (seedData)
        {
            await SeedTestDataAsync(context);
        }
    }

    /// <summary>
    /// Seeds the database with realistic test data for comprehensive testing.
    /// </summary>
    private static async Task SeedTestDataAsync(GoldfishDbContext context)
    {
        // Add sample workspace
        var workspace = new COA.Goldfish.McpServer.Models.WorkspaceState
        {
            WorkspaceId = Guid.NewGuid().ToString(),
            LastActivity = DateTime.UtcNow
        };
        context.WorkspaceStates.Add(workspace);

        // Add sample checkpoint
        var checkpoint = new COA.Goldfish.McpServer.Models.Checkpoint
        {
            Id = Guid.NewGuid().ToString(),
            WorkspaceId = workspace.WorkspaceId,
            Description = "Test checkpoint for integration testing",
            WorkContext = "Testing database isolation",
            ActiveFiles = new List<string> { "TestFile.cs", "DatabaseTest.cs" },
            Highlights = new List<string> { "Fixed database isolation", "Added comprehensive tests" },
            CreatedAt = DateTime.UtcNow
        };
        context.Checkpoints.Add(checkpoint);

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Properly cleans up database resources to prevent file locks and memory leaks.
    /// </summary>
    public static async Task CleanupAsync(GoldfishDbContext context)
    {
        if (context == null) return;

        try
        {
            // Close connections before disposal
            if (context.Database.GetDbConnection() is SqliteConnection sqliteConnection)
            {
                if (sqliteConnection.State != System.Data.ConnectionState.Closed)
                {
                    await sqliteConnection.CloseAsync();
                }
            }

            // Dispose context
            await context.DisposeAsync();
        }
        catch (Exception)
        {
            // Ignore cleanup errors to prevent test failures
        }
    }

    /// <summary>
    /// Cleans up temporary file and all associated resources.
    /// </summary>
    public static async Task CleanupTempFileAsync(GoldfishDbContext context, string tempFilePath)
    {
        await CleanupAsync(context);

        try
        {
            if (File.Exists(tempFilePath))
            {
                // Clear SQLite connection pools to release file locks
                SqliteConnection.ClearAllPools();
                
                // Force garbage collection to ensure all connections are disposed
                GC.Collect();
                GC.WaitForPendingFinalizers();
                
                File.Delete(tempFilePath);
            }
        }
        catch (Exception)
        {
            // Ignore file cleanup errors - they don't affect test results
        }
    }
}