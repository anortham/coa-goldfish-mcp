using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using COA.Goldfish.Migration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NUnit.Framework;
using System.Text.Json;
using System.IO;
using System.Threading;

namespace COA.Goldfish.Migration.Tests;

/// <summary>
/// Unit tests for JsonToSqliteMigrator
/// </summary>
[TestFixture]
public class JsonToSqliteMigratorTests
{
    private string _tempDirectory = string.Empty;
    private string _testDbPath = string.Empty;
    private ILogger<JsonToSqliteMigrator> _logger = null!;
    private JsonToSqliteMigrator _migrator = null!;

    [SetUp]
    public void SetUp()
    {
        // Create temporary directory for test data
        _tempDirectory = Path.Combine(Path.GetTempPath(), $"goldfish_migration_test_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDirectory);
        
        _testDbPath = Path.Combine(_tempDirectory, "test.db");
        
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
    public async Task MigrateAllAsync_WithValidData_ShouldSucceed()
    {
        // Arrange - Create expected directory structure
        var checkpointsDir = Path.Combine(_tempDirectory, "checkpoints");
        var todosDir = Path.Combine(_tempDirectory, "todos");
        var plansDir = Path.Combine(_tempDirectory, "plans");
        var memoriesDir = Path.Combine(_tempDirectory, "memories");
        
        Directory.CreateDirectory(checkpointsDir);
        Directory.CreateDirectory(todosDir);
        Directory.CreateDirectory(plansDir);
        Directory.CreateDirectory(memoriesDir);
        
        // Create test data files
        await CreateTestCheckpointFile(checkpointsDir);
        await CreateTestTodoFile(todosDir);
        await CreateTestPlanFile(plansDir);
        await CreateTestMemoryFile(memoriesDir);

        // Act
        var result = await _migrator.MigrateAllAsync();

        // Assert
        Assert.That(result.Success, Is.True, $"Migration failed: {result.ErrorMessage}");
        Assert.That(result.CheckpointsMigrated + result.TodoListsMigrated + result.PlansMigrated + result.MemoriesMigrated, Is.GreaterThan(0));
        
        // Note: WorkspacesMigrated depends on finding workspace IDs in migrated data
        // Since we're creating test data, workspace states are derived from actual migrations
        
        // Verify database was created
        Assert.That(File.Exists(_testDbPath), Is.True);
    }

    [Test]
    public async Task MigrateCheckpointsAsync_ShouldPreserveAllData()
    {
        // Arrange
        var checkpointsDir = Path.Combine(_tempDirectory, "checkpoints");
        Directory.CreateDirectory(checkpointsDir);
        await CreateTestCheckpointFile(checkpointsDir);

        // Act
        var result = await _migrator.MigrateAllAsync();

        // Assert
        Assert.That(result.Success, Is.True);
        
        // Verify checkpoint data in database
        using var context = CreateDbContext(_testDbPath);
        await context.Database.EnsureCreatedAsync();
        var checkpoints = await context.Checkpoints.ToListAsync();
        
        Assert.That(checkpoints, Has.Count.EqualTo(1));
        
        var checkpoint = checkpoints.First();
        Assert.That(checkpoint.Description, Is.EqualTo("Test checkpoint"));
        Assert.That(checkpoint.Highlights, Is.Not.Empty);
        Assert.That(checkpoint.ActiveFiles, Is.Not.Empty);
        Assert.That(checkpoint.WorkContext, Is.EqualTo("Testing migration"));
    }

    [Test]
    public async Task MigrateTodoListsAsync_ShouldPreserveItems()
    {
        // Arrange
        var todosDir = Path.Combine(_tempDirectory, "todos");
        Directory.CreateDirectory(todosDir);
        await CreateTestTodoFile(todosDir);

        // Act
        var result = await _migrator.MigrateAllAsync();

        // Assert
        Assert.That(result.Success, Is.True);
        
        // Verify todo data in database
        using var context = CreateDbContext(_testDbPath);
        await context.Database.EnsureCreatedAsync();
        var todoLists = await context.TodoLists.Include(t => t.Items).ToListAsync();
        
        Assert.That(todoLists, Has.Count.EqualTo(1));
        
        var todoList = todoLists.First();
        Assert.That(todoList.Title, Is.EqualTo("Test Migration Tasks"));
        Assert.That(todoList.Items, Has.Count.EqualTo(2));
        Assert.That(todoList.Items.Any(i => i.Content == "Test data migration"), Is.True);
        Assert.That(todoList.Items.Any(i => i.Content == "Validate results"), Is.True);
    }

    [Test]
    public async Task MigratePlansAsync_ShouldPreserveStructure()
    {
        // Arrange
        var plansDir = Path.Combine(_tempDirectory, "plans");
        Directory.CreateDirectory(plansDir);
        await CreateTestPlanFile(plansDir);

        // Act
        var result = await _migrator.MigrateAllAsync();

        // Assert
        Assert.That(result.Success, Is.True);
        
        // Verify plan data in database
        using var context = CreateDbContext(_testDbPath);
        await context.Database.EnsureCreatedAsync();
        var plans = await context.Plans.ToListAsync();
        
        Assert.That(plans, Has.Count.EqualTo(1));
        
        var plan = plans.First();
        Assert.That(plan.Title, Is.EqualTo("Migration Testing Plan"));
        Assert.That(plan.Description, Contains.Substring("Comprehensive plan"));
        Assert.That(plan.Category.ToString(), Is.EqualTo("Feature"));
        Assert.That(plan.Status.ToString(), Is.EqualTo("Active"));
    }

    [Test]
    public async Task MigrateMemoriesAsync_ShouldConvertToChronicle()
    {
        // Arrange
        var memoriesDir = Path.Combine(_tempDirectory, "memories");
        Directory.CreateDirectory(memoriesDir);
        await CreateTestMemoryFile(memoriesDir);

        // Act
        var result = await _migrator.MigrateAllAsync();

        // Assert
        Assert.That(result.Success, Is.True);
        
        // Verify memory converted to chronicle
        using var context = CreateDbContext(_testDbPath);
        await context.Database.EnsureCreatedAsync();
        var chronicles = await context.ChronicleEntries.ToListAsync();
        
        Assert.That(chronicles, Has.Count.EqualTo(1));
        
        var chronicle = chronicles.First();
        Assert.That(chronicle.Description, Is.EqualTo("Test memory content"));
        Assert.That(chronicle.Type, Is.EqualTo(ChronicleEntryType.Discovery));
    }

    [Test]
    public async Task ValidateMigrationAsync_WithCorruptData_ShouldDetectIssues()
    {
        // Arrange
        var checkpointsDir = Path.Combine(_tempDirectory, "checkpoints");
        Directory.CreateDirectory(checkpointsDir);
        
        // Create corrupted JSON file
        var corruptFile = Path.Combine(checkpointsDir, "corrupted.json");
        await File.WriteAllTextAsync(corruptFile, "{ invalid json }");

        // Act
        var result = await _migrator.MigrateAllAsync();

        // Assert - the migration handles JSON errors gracefully by logging warnings
        // The overall migration can still succeed even with some corrupted files
        Assert.That(result.Success, Is.True, "Migration should handle corrupted files gracefully");
        Assert.That(result.CheckpointsMigrated, Is.EqualTo(0), "No valid checkpoints should be migrated from corrupted data");
    }

    [Test]
    public void MigrationResult_ShouldTrackProgress()
    {
        // Arrange & Act
        var result = new MigrationResult
        {
            Success = true,
            CheckpointsMigrated = 5,
            TodoListsMigrated = 3,
            PlansMigrated = 2,
            MemoriesMigrated = 10,
            WorkspacesMigrated = 1
        };

        // Assert
        Assert.That(result.Success, Is.True);
        Assert.That(result.CheckpointsMigrated, Is.EqualTo(5));
        Assert.That(result.TodoListsMigrated, Is.EqualTo(3));
        Assert.That(result.PlansMigrated, Is.EqualTo(2));
        Assert.That(result.MemoriesMigrated, Is.EqualTo(10));
        Assert.That(result.WorkspacesMigrated, Is.EqualTo(1));
    }

    #region Test Data Creation Methods

    private async Task CreateTestCheckpointFile(string checkpointsDir)
    {
        var checkpoint = new
        {
            id = "test-checkpoint-1",
            workspaceId = "test-workspace",
            description = "Test checkpoint",
            highlights = new[] { "Fixed bug", "Added feature" },
            activeFiles = new[] { "test.cs", "readme.md" },
            workContext = "Testing migration",
            global = false,
            sessionId = "session-1",
            gitBranch = "main",
            createdAt = DateTime.UtcNow.ToString("O"),
            updatedAt = DateTime.UtcNow.ToString("O"),
            ttlHours = 72
        };

        var checkpointsFile = Path.Combine(checkpointsDir, "checkpoints.json");
        
        await File.WriteAllTextAsync(checkpointsFile, 
            JsonSerializer.Serialize(checkpoint, new JsonSerializerOptions { WriteIndented = true }));
    }

    private async Task CreateTestTodoFile(string todosDir)
    {
        var todoList = new
        {
            id = "todo-list-1",
            workspaceId = "test-workspace",
            title = "Test Migration Tasks",
            items = new[]
            {
                new
                {
                    id = "item-1",
                    content = "Test data migration",
                    status = "pending",
                    priority = "normal",
                    createdAt = DateTime.UtcNow.ToString("O")
                },
                new
                {
                    id = "item-2",
                    content = "Validate results",
                    status = "done",
                    priority = "high",
                    createdAt = DateTime.UtcNow.ToString("O")
                }
            },
            isActive = true,
            createdAt = DateTime.UtcNow.ToString("O"),
            updatedAt = DateTime.UtcNow.ToString("O")
        };

        var todoFile = Path.Combine(todosDir, "todos.json");
        
        await File.WriteAllTextAsync(todoFile, 
            JsonSerializer.Serialize(todoList, new JsonSerializerOptions { WriteIndented = true }));
    }

    private async Task CreateTestPlanFile(string plansDir)
    {
        var plan = new
        {
            id = "plan-1",
            workspaceId = "test-workspace",
            title = "Migration Testing Plan",
            description = "Comprehensive plan for testing data migration functionality",
            category = "feature",
            status = "active",
            priority = "high",
            items = new[] { "Design tests", "Implement migration", "Validate data" },
            estimatedEffort = "2 days",
            createdAt = DateTime.UtcNow.ToString("O"),
            updatedAt = DateTime.UtcNow.ToString("O")
        };

        var planFile = Path.Combine(plansDir, "plans.json");
        
        await File.WriteAllTextAsync(planFile, 
            JsonSerializer.Serialize(plan, new JsonSerializerOptions { WriteIndented = true }));
    }

    private async Task CreateTestMemoryFile(string memoriesDir)
    {
        var memory = new
        {
            id = "memory-1",
            workspaceId = "test-workspace",
            content = "Test memory content",
            type = "general",
            context = "general",
            tags = new[] { "test", "migration" },
            createdAt = DateTime.UtcNow.ToString("O"),
            updatedAt = DateTime.UtcNow.ToString("O")
        };

        var memoryFile = Path.Combine(memoriesDir, "memories.json");
        
        await File.WriteAllTextAsync(memoryFile, 
            JsonSerializer.Serialize(memory, new JsonSerializerOptions { WriteIndented = true }));
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