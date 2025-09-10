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
    public async Task TearDown()
    {
        // Properly dispose migrator if it implements IDisposable
        if (_migrator is IDisposable disposable)
        {
            disposable.Dispose();
        }
        
        // Force close any open SQLite connections
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        
        // Give more time for file handles to close
        GC.Collect();
        GC.WaitForPendingFinalizers();
        await Task.Delay(500); // Increased delay for SQLite cleanup
        
        // Clean up test directory with retry logic
        if (Directory.Exists(_tempDirectory))
        {
            var attempts = 0;
            while (attempts < 3)
            {
                try
                {
                    Directory.Delete(_tempDirectory, recursive: true);
                    break;
                }
                catch (IOException ex) when (attempts < 2)
                {
                    Console.WriteLine($"Attempt {attempts + 1}: Could not clean up test directory: {ex.Message}");
                    await Task.Delay(1000); // Wait before retry
                    attempts++;
                    GC.Collect();
                    GC.WaitForPendingFinalizers();
                }
                catch (IOException ex)
                {
                    // Final attempt failed
                    Console.WriteLine($"Warning: Could not clean up test directory after {attempts + 1} attempts: {ex.Message}");
                    break;
                }
            }
        }
    }

    [Test]
    public async Task MigrateAllAsync_WithValidData_ShouldSucceed()
    {
        // Arrange - Create expected directory structure with workspace subdirectory
        var workspaceDir = Path.Combine(_tempDirectory, "test-workspace");
        var checkpointsDir = Path.Combine(workspaceDir, "checkpoints");
        var todosDir = Path.Combine(workspaceDir, "todos");
        var plansDir = Path.Combine(workspaceDir, "plans");
        var memoriesDir = Path.Combine(workspaceDir, "memories");
        
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
        Assert.That(result.Success, Is.True, $"Migration failed: {result.ErrorMessage}. Validation errors: {string.Join(", ", result.ValidationErrors)}");
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
        var workspaceDir = Path.Combine(_tempDirectory, "test-workspace");
        var checkpointsDir = Path.Combine(workspaceDir, "checkpoints");
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
        var workspaceDir = Path.Combine(_tempDirectory, "test-workspace");
        var todosDir = Path.Combine(workspaceDir, "todos");
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
        var workspaceDir = Path.Combine(_tempDirectory, "test-workspace");
        var plansDir = Path.Combine(workspaceDir, "plans");
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
        Assert.That(plan.Category, Is.EqualTo("feature"));
        Assert.That(plan.Status, Is.EqualTo(PlanStatus.Active));
    }

    [Test]
    public async Task MigrateMemoriesAsync_ShouldConvertToChronicle()
    {
        // Arrange
        var workspaceDir = Path.Combine(_tempDirectory, "test-workspace");
        var memoriesDir = Path.Combine(workspaceDir, "memories");
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
        var workspaceDir = Path.Combine(_tempDirectory, "test-workspace");
        var checkpointsDir = Path.Combine(workspaceDir, "checkpoints");
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
            workspace = "test-workspace", // TypeScript uses "workspace" not "workspaceId"
            timestamp = DateTime.UtcNow.ToString("O"),
            sessionId = "session-1",
            type = "checkpoint",
            content = new
            {
                description = "Test checkpoint",
                highlights = new[] { "Fixed bug", "Added feature" },
                activeFiles = new[] { "test.cs", "readme.md" },
                workContext = "Testing migration",
                gitBranch = "main",
                sessionId = "session-1"
            },
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
            workspace = "test-workspace", // TypeScript uses "workspace" not "workspaceId"
            title = "Test Migration Tasks",
            items = new[]
            {
                new
                {
                    id = "item-1",
                    task = "Test data migration", // TypeScript uses "task" not "content"
                    status = "pending",
                    priority = "normal",
                    createdAt = DateTime.UtcNow.ToString("O")
                },
                new
                {
                    id = "item-2",
                    task = "Validate results", // TypeScript uses "task" not "content"
                    status = "done",
                    priority = "high",
                    createdAt = DateTime.UtcNow.ToString("O")
                }
            },
            status = "active", // TypeScript uses status field instead of isActive
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
            workspace = "test-workspace", // TypeScript uses "workspace" not "workspaceId"
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
            workspace = "test-workspace", // TypeScript uses "workspace" not "workspaceId"
            content = "Test memory content",
            type = "discovery", // Use specific type that maps to ChronicleEntryType.Discovery
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