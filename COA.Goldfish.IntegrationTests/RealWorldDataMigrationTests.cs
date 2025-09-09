using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using COA.Goldfish.Migration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NUnit.Framework;
using System.Text.Json;
using System.IO;
using System.Threading;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Real-world data migration tests using actual TypeScript Goldfish JSON files
/// These tests verify that migration handles actual production data patterns correctly
/// NO MOCKS - tests real data migration with authentic file structures
/// </summary>
[TestFixture]
public class RealWorldDataMigrationTests
{
    private string _tempDirectory = string.Empty;
    private string _testDbPath = string.Empty;
    private ILogger<JsonToSqliteMigrator> _logger = null!;
    private JsonToSqliteMigrator _migrator = null!;

    [SetUp]
    public void SetUp()
    {
        // Create temporary directory for test data
        _tempDirectory = Path.Combine(Path.GetTempPath(), $"goldfish_real_migration_test_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDirectory);
        
        _testDbPath = Path.Combine(_tempDirectory, "real_test.db");
        
        // Create test logger
        using var loggerFactory = LoggerFactory.Create(builder => 
            builder.AddConsole().SetMinimumLevel(LogLevel.Debug));
        _logger = loggerFactory.CreateLogger<JsonToSqliteMigrator>();
        
        // Create migrator instance
        _migrator = new JsonToSqliteMigrator(_logger, _tempDirectory, $"Data Source={_testDbPath}");
    }

    [TearDown]
    public void TearDown()
    {
        // Dispose any resources and wait a bit for database cleanup
        GC.Collect();
        GC.WaitForPendingFinalizers();
        Thread.Sleep(100); // Give time for file handles to close
        
        // Clean up test directory
        if (Directory.Exists(_tempDirectory))
        {
            try
            {
                Directory.Delete(_tempDirectory, recursive: true);
            }
            catch (IOException ex)
            {
                // Log but don't fail the test
                Console.WriteLine($"Warning: Could not clean up test directory: {ex.Message}");
            }
        }
    }

    [Test]
    public async Task MigrateRealTodoData_ShouldHandleActualTypeScriptStructure()
    {
        // Arrange - Create real TypeScript TODO structure based on actual production data
        var todosDir = Path.Combine(_tempDirectory, "todos");
        Directory.CreateDirectory(todosDir);
        
        var realTypeScriptTodo = new
        {
            id = "20250827-111942-202-775C-4070",
            title = "Things to do to get Goldfish working with Github Copilot",
            workspace = "coa-goldfish-mcp",
            items = new[]
            {
                new
                {
                    id = "1",
                    task = "debug workspace normalization", // TypeScript uses "task" not "content"
                    status = "pending",
                    createdAt = "2025-08-27T16:19:42.205Z"
                },
                new
                {
                    id = "2",
                    task = "investigate if a list_workspaces tool is needed",
                    status = "pending",
                    createdAt = "2025-08-27T16:19:42.205Z"
                }
            },
            createdAt = "2025-08-27T16:19:42.205Z",
            updatedAt = "2025-09-04T13:43:59.717Z",
            status = "archived", // TypeScript TODO status
            archivedAt = "2025-09-04T13:43:59.717Z" // Field that doesn't exist in .NET
        };

        var todoFile = Path.Combine(todosDir, "real-todo.json");
        await File.WriteAllTextAsync(todoFile, 
            JsonSerializer.Serialize(realTypeScriptTodo, new JsonSerializerOptions { WriteIndented = true }));

        // Act
        var result = await _migrator.MigrateAllAsync();

        // Assert
        Assert.That(result.Success, Is.True, $"Migration should handle real TypeScript TODO data: {result.ErrorMessage}");
        Assert.That(result.TodoListsMigrated, Is.EqualTo(1), "Should migrate the TODO list");

        // Verify the migrated data preserves the original information
        using var context = CreateDbContext(_testDbPath);
        await context.Database.EnsureCreatedAsync();
        var todoLists = await context.TodoLists.Include(t => t.Items).ToListAsync();
        
        Assert.That(todoLists, Has.Count.EqualTo(1), "Should have migrated one TODO list");
        
        var migratedTodo = todoLists.First();
        Assert.That(migratedTodo.Title, Is.EqualTo("Things to do to get Goldfish working with Github Copilot"));
        Assert.That(migratedTodo.WorkspaceId, Is.EqualTo("coa-goldfish-mcp"));
        Assert.That(migratedTodo.Items, Has.Count.EqualTo(2), "Should migrate both TODO items");
        
        // Verify TypeScript "task" field mapped to .NET "Content" field
        var firstItem = migratedTodo.Items.First(i => i.Content == "debug workspace normalization");
        Assert.That(firstItem, Is.Not.Null, "Should find item with migrated content");
        Assert.That(firstItem.Status, Is.EqualTo(TodoItemStatus.Pending), "Should handle TypeScript status conversion");
        
        // Verify second item
        var secondItem = migratedTodo.Items.First(i => i.Content == "investigate if a list_workspaces tool is needed");
        Assert.That(secondItem, Is.Not.Null, "Should find second migrated item");
    }

    [Test]
    public async Task MigrateRealCheckpointData_ShouldHandleNestedContentStructure()
    {
        // Arrange - Create real TypeScript checkpoint structure based on actual production data
        var checkpointsDir = Path.Combine(_tempDirectory, "checkpoints");
        Directory.CreateDirectory(checkpointsDir);
        
        var realTypeScriptCheckpoint = new
        {
            id = "20250826-122912-130-A438-B1A0",
            timestamp = "2025-08-26T17:29:12.130Z",
            workspace = "coa-claude-config",
            sessionId = "2025-08-26-checkpoint",
            type = "checkpoint",
            content = new // TypeScript uses nested content object
            {
                description = "Committed: Update configuration files",
                highlights = new[] { "Enhanced .gitignore and simplified install.ps1 script" },
                gitBranch = "master",
                sessionId = "2025-08-26-checkpoint"
            },
            ttlHours = 72,
            tags = new[] { "checkpoint" },
            metadata = new
            {
                isCheckpoint = true,
                dateDir = "C:\\Users\\CHS300372\\.coa\\goldfish\\coa-claude-config\\checkpoints\\2025-08-26",
                global = false
            }
        };

        var checkpointFile = Path.Combine(checkpointsDir, "real-checkpoint.json");
        await File.WriteAllTextAsync(checkpointFile, 
            JsonSerializer.Serialize(realTypeScriptCheckpoint, new JsonSerializerOptions { WriteIndented = true }));

        // Act
        var result = await _migrator.MigrateAllAsync();

        // Assert
        Assert.That(result.Success, Is.True, $"Migration should handle real TypeScript checkpoint data: {result.ErrorMessage}");
        Assert.That(result.CheckpointsMigrated, Is.EqualTo(1), "Should migrate the checkpoint");

        // Verify the migrated data flattens nested structure correctly
        using var context = CreateDbContext(_testDbPath);
        await context.Database.EnsureCreatedAsync();
        var checkpoints = await context.Checkpoints.ToListAsync();
        
        Assert.That(checkpoints, Has.Count.EqualTo(1), "Should have migrated one checkpoint");
        
        var migratedCheckpoint = checkpoints.First();
        Assert.That(migratedCheckpoint.Description, Is.EqualTo("Committed: Update configuration files"),
            "Should extract description from nested content object");
        Assert.That(migratedCheckpoint.WorkspaceId, Is.EqualTo("coa-claude-config"));
        Assert.That(migratedCheckpoint.SessionId, Is.EqualTo("2025-08-26-checkpoint"));
        Assert.That(migratedCheckpoint.GitBranch, Is.EqualTo("master"),
            "Should extract gitBranch from nested content object");
        
        // Verify highlights array was preserved
        Assert.That(migratedCheckpoint.Highlights, Is.Not.Empty, "Should preserve highlights");
        Assert.That(migratedCheckpoint.Highlights.First(), 
            Is.EqualTo("Enhanced .gitignore and simplified install.ps1 script"));
    }

    [Test]
    public async Task MigrateWithIncompleteData_ShouldHandleGracefully()
    {
        // Arrange - Create TypeScript data with missing/incomplete fields (common in real data)
        var todosDir = Path.Combine(_tempDirectory, "todos");
        Directory.CreateDirectory(todosDir);
        
        var incompleteTypeScriptTodo = new
        {
            id = "incomplete-todo-123",
            title = "Incomplete TODO for testing",
            workspace = "test-workspace",
            items = new object[] // Explicitly type as object array to handle different shapes
            {
                new
                {
                    id = "1",
                    task = "item without status field" 
                    // Missing status, createdAt fields - should use defaults
                },
                new
                {
                    id = "2",
                    task = "item with unknown status",
                    status = "unknown-status", // Status not in enum
                    createdAt = "invalid-date" // Invalid date format
                }
            },
            createdAt = "2025-08-27T16:19:42.205Z"
            // Missing updatedAt, status, archivedAt fields
        };

        var todoFile = Path.Combine(todosDir, "incomplete-todo.json");
        await File.WriteAllTextAsync(todoFile, 
            JsonSerializer.Serialize(incompleteTypeScriptTodo, new JsonSerializerOptions { WriteIndented = true }));

        // Act
        var result = await _migrator.MigrateAllAsync();

        // Assert - Migration should succeed even with incomplete data
        Assert.That(result.Success, Is.True, $"Migration should handle incomplete data gracefully: {result.ErrorMessage}");
        Assert.That(result.TodoListsMigrated, Is.EqualTo(1), "Should still migrate incomplete TODO");

        // Verify graceful handling of missing/invalid data
        using var context = CreateDbContext(_testDbPath);
        await context.Database.EnsureCreatedAsync();
        var todoLists = await context.TodoLists.Include(t => t.Items).ToListAsync();
        
        var migratedTodo = todoLists.First();
        Assert.That(migratedTodo.Items, Has.Count.EqualTo(2), "Should migrate both items despite missing data");
        
        // Verify defaults are applied for missing fields
        var firstItem = migratedTodo.Items.First(i => i.Content == "item without status field");
        Assert.That(firstItem.Status, Is.EqualTo(TodoItemStatus.Pending), "Should default to Pending for missing status");
        
        var secondItem = migratedTodo.Items.First(i => i.Content == "item with unknown status");
        Assert.That(secondItem.Status, Is.EqualTo(TodoItemStatus.Pending), "Should default to Pending for unknown status");
    }

    [Test]
    public async Task MigrateMultipleRealFiles_ShouldPreserveDataRelationships()
    {
        // Arrange - Create multiple related files like real TypeScript usage
        var checkpointsDir = Path.Combine(_tempDirectory, "checkpoints");
        var todosDir = Path.Combine(_tempDirectory, "todos");
        var plansDir = Path.Combine(_tempDirectory, "plans");
        
        Directory.CreateDirectory(checkpointsDir);
        Directory.CreateDirectory(todosDir);
        Directory.CreateDirectory(plansDir);

        // Related data from same workspace (simulating real usage patterns)
        var workspaceId = "coa-goldfish-mcp";
        
        await CreateRealCheckpointFile(checkpointsDir, workspaceId);
        await CreateRealTodoFile(todosDir, workspaceId);
        await CreateRealPlanFile(plansDir, workspaceId);

        // Act
        var result = await _migrator.MigrateAllAsync();

        // Assert
        Assert.That(result.Success, Is.True, $"Migration should handle multiple real files: {result.ErrorMessage}");
        Assert.That(result.CheckpointsMigrated + result.TodoListsMigrated + result.PlansMigrated, 
            Is.EqualTo(3), "Should migrate all three files");

        // Verify workspace relationships are preserved
        using var context = CreateDbContext(_testDbPath);
        await context.Database.EnsureCreatedAsync();
        
        var checkpoints = await context.Checkpoints.Where(c => c.WorkspaceId == workspaceId).ToListAsync();
        var todoLists = await context.TodoLists.Where(t => t.WorkspaceId == workspaceId).ToListAsync();
        var plans = await context.Plans.Where(p => p.WorkspaceId == workspaceId).ToListAsync();
        
        Assert.That(checkpoints, Has.Count.EqualTo(1), "Should have checkpoint for workspace");
        Assert.That(todoLists, Has.Count.EqualTo(1), "Should have TODO list for workspace");
        Assert.That(plans, Has.Count.EqualTo(1), "Should have plan for workspace");
        
        // Verify they all belong to the same workspace
        Assert.That(checkpoints.First().WorkspaceId, Is.EqualTo(workspaceId));
        Assert.That(todoLists.First().WorkspaceId, Is.EqualTo(workspaceId));
        Assert.That(plans.First().WorkspaceId, Is.EqualTo(workspaceId));
    }

    #region Real Data Creation Helpers

    private async Task CreateRealCheckpointFile(string checkpointsDir, string workspaceId)
    {
        var realCheckpoint = new
        {
            id = $"real-checkpoint-{Guid.NewGuid():N}",
            timestamp = DateTime.UtcNow.AddMinutes(-30).ToString("O"),
            workspace = workspaceId,
            sessionId = "real-session-123",
            type = "checkpoint",
            content = new
            {
                description = "Real checkpoint: Implemented migration tests",
                highlights = new[] { "Added real data migration tests", "Fixed TypeScript compatibility" },
                gitBranch = "main",
                sessionId = "real-session-123",
                activeFiles = new[] { "MigrationTests.cs", "JsonToSqliteMigrator.cs" }
            },
            ttlHours = 72,
            tags = new[] { "checkpoint", "migration" }
        };

        var file = Path.Combine(checkpointsDir, "real-checkpoint.json");
        await File.WriteAllTextAsync(file, JsonSerializer.Serialize(realCheckpoint, new JsonSerializerOptions { WriteIndented = true }));
    }

    private async Task CreateRealTodoFile(string todosDir, string workspaceId)
    {
        var realTodo = new
        {
            id = $"real-todo-{Guid.NewGuid():N}",
            title = "Migration Testing Tasks",
            workspace = workspaceId,
            items = new[]
            {
                new
                {
                    id = "1",
                    task = "Test TypeScript data migration",
                    status = "done",
                    createdAt = DateTime.UtcNow.AddHours(-2).ToString("O")
                },
                new
                {
                    id = "2",
                    task = "Verify data relationships preserved",
                    status = "pending",
                    createdAt = DateTime.UtcNow.AddMinutes(-30).ToString("O")
                }
            },
            createdAt = DateTime.UtcNow.AddHours(-3).ToString("O"),
            updatedAt = DateTime.UtcNow.AddMinutes(-30).ToString("O"),
            status = "active"
        };

        var file = Path.Combine(todosDir, "real-todo.json");
        await File.WriteAllTextAsync(file, JsonSerializer.Serialize(realTodo, new JsonSerializerOptions { WriteIndented = true }));
    }

    private async Task CreateRealPlanFile(string plansDir, string workspaceId)
    {
        var realPlan = new
        {
            id = $"real-plan-{Guid.NewGuid():N}",
            workspace = workspaceId,
            title = "Real Migration Testing Plan",
            description = "Plan for testing real-world data migration scenarios",
            category = "testing",
            status = "active",
            priority = "high",
            items = new[] { "Create real data tests", "Test TypeScript compatibility", "Verify relationships" },
            estimatedEffort = "1 day",
            createdAt = DateTime.UtcNow.AddDays(-1).ToString("O"),
            updatedAt = DateTime.UtcNow.AddMinutes(-30).ToString("O")
        };

        var file = Path.Combine(plansDir, "real-plan.json");
        await File.WriteAllTextAsync(file, JsonSerializer.Serialize(realPlan, new JsonSerializerOptions { WriteIndented = true }));
    }

    private static GoldfishDbContext CreateDbContext(string dbPath)
    {
        var options = new DbContextOptionsBuilder<GoldfishDbContext>()
            .UseSqlite($"Data Source={dbPath}")
            .Options;
        
        return new GoldfishDbContext(options);
    }

    #endregion
}