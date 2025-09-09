using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using COA.Goldfish.Migration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NUnit.Framework;
using System.Text.Json;
using System.IO;
using System.Threading;
using System.Diagnostics;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Real-world error handling and failure scenario tests
/// Tests what happens when things go wrong in production scenarios
/// NO MOCKS - tests actual error conditions with real processes and data
/// </summary>
[TestFixture]
public class ErrorHandlingIntegrationTests
{
    private string _tempDirectory = string.Empty;
    private string _testDbPath = string.Empty;
    private ILogger<JsonToSqliteMigrator> _logger = null!;
    private JsonToSqliteMigrator _migrator = null!;
    private Process? _serverProcess;
    private StreamWriter? _serverInput;
    private StreamReader? _serverOutput;

    [SetUp]
    public void SetUp()
    {
        // Create temporary directory for test data
        _tempDirectory = Path.Combine(Path.GetTempPath(), $"goldfish_error_test_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDirectory);
        
        _testDbPath = Path.Combine(_tempDirectory, "error_test.db");
        
        // Create test logger
        using var loggerFactory = LoggerFactory.Create(builder => 
            builder.AddConsole().SetMinimumLevel(LogLevel.Debug));
        _logger = loggerFactory.CreateLogger<JsonToSqliteMigrator>();
        
        // Create migrator instance with connection string that forces immediate close
        var connectionString = $"Data Source={_testDbPath};Pooling=false;";
        _migrator = new JsonToSqliteMigrator(_logger, _tempDirectory, connectionString);
    }

    [TearDown]
    public void TearDown()
    {
        // Close MCP server if running
        if (_serverProcess != null && !_serverProcess.HasExited)
        {
            try
            {
                _serverInput?.Close();
                _serverOutput?.Close();
                
                if (!_serverProcess.WaitForExit(5000))
                {
                    _serverProcess.Kill();
                }
                
                _serverProcess.Dispose();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during server cleanup: {ex.Message}");
            }
        }

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
    public async Task MigrationWithCorruptedJSON_ShouldHandleGracefully()
    {
        // Arrange - Create various types of corrupted JSON files
        var todosDir = Path.Combine(_tempDirectory, "todos");
        Directory.CreateDirectory(todosDir);
        
        // Test 1: Invalid JSON syntax
        await File.WriteAllTextAsync(
            Path.Combine(todosDir, "invalid-syntax.json"), 
            "{ invalid json syntax missing quotes and brackets");
        
        // Test 2: Valid JSON but wrong structure
        await File.WriteAllTextAsync(
            Path.Combine(todosDir, "wrong-structure.json"),
            JsonSerializer.Serialize(new { randomField = "value", notTodoStructure = 123 }));
        
        // Test 3: Partially corrupted data
        await File.WriteAllTextAsync(
            Path.Combine(todosDir, "partial-corruption.json"),
            JsonSerializer.Serialize(new
            {
                id = "test-todo",
                title = "Partially Corrupted TODO",
                workspace = "test",
                items = new object[] 
                {
                    "this should be an object", // Invalid item structure
                    new { id = "valid", task = "valid item" }
                }
            }));

        // Act - Migration should not crash despite corrupted data
        var result = await _migrator.MigrateAllAsync();

        // Assert - Migration completes but logs warnings
        Assert.That(result.Success, Is.True, "Migration should complete despite corrupted files");
        Assert.That(result.TodoListsMigrated, Is.LessThan(3), "Should skip corrupted files");
    }

    [Test]
    public async Task MigrationWithPermissionErrors_ShouldReportClearly()
    {
        // Arrange - Create a file that will cause permission issues
        var checkpointsDir = Path.Combine(_tempDirectory, "checkpoints");
        Directory.CreateDirectory(checkpointsDir);
        
        var restrictedFile = Path.Combine(checkpointsDir, "restricted.json");
        await File.WriteAllTextAsync(restrictedFile, "{ \"id\": \"test\" }");
        
        // Make file read-only to simulate permission issues
        File.SetAttributes(restrictedFile, FileAttributes.ReadOnly);
        
        try
        {
            // Try to create a scenario where we can't write to database
            var readOnlyDbPath = Path.Combine(_tempDirectory, "readonly.db");
            File.Create(readOnlyDbPath).Dispose();
            File.SetAttributes(readOnlyDbPath, FileAttributes.ReadOnly);
            
            var restrictedMigrator = new JsonToSqliteMigrator(_logger, _tempDirectory, $"Data Source={readOnlyDbPath}");
            
            // Act
            var result = await restrictedMigrator.MigrateAllAsync();
            
            // Assert - Should fail gracefully with clear error message
            Assert.That(result.Success, Is.False, "Migration should fail when database is read-only");
            Assert.That(result.ErrorMessage, Is.Not.Null.And.Not.Empty, "Should provide clear error message");
        }
        finally
        {
            // Clean up read-only attributes
            try
            {
                File.SetAttributes(restrictedFile, FileAttributes.Normal);
                var readOnlyDbPath = Path.Combine(_tempDirectory, "readonly.db");
                if (File.Exists(readOnlyDbPath))
                {
                    File.SetAttributes(readOnlyDbPath, FileAttributes.Normal);
                }
            }
            catch { /* Ignore cleanup errors */ }
        }
    }

    [Test]
    public async Task McpServerCrashRecovery_ShouldHandleUnexpectedTermination()
    {
        // Arrange - Start MCP server
        await StartMcpServerAsync();
        await InitializeMcpConnectionAsync();
        
        // Verify server is running
        Assert.That(_serverProcess!.HasExited, Is.False, "Server should be running initially");
        
        // Act - Forcefully kill the server to simulate crash
        _serverProcess.Kill();
        await Task.Delay(100); // Give time for process to die
        
        // Try to send requests to crashed server
        bool exceptionThrown = false;
        try
        {
            var request = new
            {
                jsonrpc = "2.0",
                id = 1,
                method = "tools/call",
                @params = new
                {
                    name = "todo",
                    arguments = new { action = "view" }
                }
            };
            
            await SendMcpRequestAsync(request);
        }
        catch (Exception)
        {
            exceptionThrown = true;
        }
        
        // Assert - Should detect server crash and handle gracefully
        Assert.That(_serverProcess.HasExited, Is.True, "Server should be terminated");
        Assert.That(exceptionThrown, Is.True, "Should throw exception when server is dead");
    }

    [Test]
    public async Task DatabaseCorruption_ShouldDetectAndReport()
    {
        // Arrange - Create database then corrupt it
        var result = await _migrator.MigrateAllAsync(); // Create initial database
        Assert.That(result.Success, Is.True, "Initial migration should succeed");
        
        // Force garbage collection and clear SQLite connection pools
        GC.Collect();
        GC.WaitForPendingFinalizers();
        GC.Collect(); // Second collection to ensure finalizers have run
        
        // Clear SQLite connection pool explicitly
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        
        await Task.Delay(500); // Give time for any lingering connections to close
        
        try
        {
            // Corrupt the database file by overwriting with garbage
            await File.WriteAllTextAsync(_testDbPath, "This is not a SQLite database file!");
            
            // Act - Try to use corrupted database
            var newMigrator = new JsonToSqliteMigrator(_logger, _tempDirectory, $"Data Source={_testDbPath}");
            var corruptedResult = await newMigrator.MigrateAllAsync();
            
            // Assert - Should detect corruption and report error
            Assert.That(corruptedResult.Success, Is.False, "Should fail with corrupted database");
            Assert.That(corruptedResult.ErrorMessage, Is.Not.Null.And.Not.Empty, 
                "Should provide error message for corrupted database");
        }
        catch (IOException ex) when (ex.Message.Contains("being used by another process"))
        {
            // If we still can't access the file, this indicates a real database connection leak bug
            Assert.Fail($"Database connection leak detected: {ex.Message}");
        }
    }

    [Test]
    public async Task LargeDatasetMigration_ShouldHandleMemoryPressure()
    {
        // Arrange - Create a large dataset that could cause memory issues
        var todosDir = Path.Combine(_tempDirectory, "todos");
        Directory.CreateDirectory(todosDir);
        
        // Create 100 TODO lists with 100 items each (10,000 total items)
        for (int listIndex = 0; listIndex < 100; listIndex++)
        {
            var largeItemList = new List<object>();
            for (int itemIndex = 0; itemIndex < 100; itemIndex++)
            {
                largeItemList.Add(new
                {
                    id = $"item-{listIndex}-{itemIndex}",
                    task = $"Large dataset test item {itemIndex} in list {listIndex} - " + new string('x', 200), // Long content
                    status = "pending",
                    createdAt = DateTime.UtcNow.AddMinutes(-itemIndex).ToString("O")
                });
            }
            
            var largeTodoList = new
            {
                id = $"large-todo-list-{listIndex}",
                title = $"Large Test List {listIndex}",
                workspace = "large-data-test",
                items = largeItemList,
                createdAt = DateTime.UtcNow.AddHours(-listIndex).ToString("O"),
                updatedAt = DateTime.UtcNow.ToString("O")
            };
            
            await File.WriteAllTextAsync(
                Path.Combine(todosDir, $"large-list-{listIndex:D3}.json"),
                JsonSerializer.Serialize(largeTodoList, new JsonSerializerOptions { WriteIndented = false }));
        }
        
        // Act - Migration should handle large dataset without crashing
        var result = await _migrator.MigrateAllAsync();
        
        // Assert - Should complete successfully despite large dataset
        Assert.That(result.Success, Is.True, "Large dataset migration should succeed");
        Assert.That(result.TodoListsMigrated, Is.EqualTo(100), "Should migrate all 100 TODO lists");
        
        // Verify data integrity with sampling
        using var context = CreateDbContext(_testDbPath);
        var totalItems = await context.TodoItems.CountAsync();
        Assert.That(totalItems, Is.EqualTo(10000), "Should have migrated all 10,000 TODO items");
        
        // Include Items navigation property explicitly
        var sampleList = await context.TodoLists.Include(t => t.Items).FirstAsync();
        Assert.That(sampleList.Items, Has.Count.EqualTo(100), "Sample list should have 100 items");
    }

    [Test]
    public async Task ConcurrentMigrationAttempts_ShouldHandleSafely()
    {
        // Arrange - Create test data
        var todosDir = Path.Combine(_tempDirectory, "todos");
        Directory.CreateDirectory(todosDir);
        
        await File.WriteAllTextAsync(
            Path.Combine(todosDir, "concurrent-test.json"),
            JsonSerializer.Serialize(new
            {
                id = "concurrent-test",
                title = "Concurrency Test TODO",
                workspace = "test",
                items = new[] { new { id = "1", task = "Test concurrent access" } }
            }));

        // Act - Start multiple migrations simultaneously
        var migrator1 = new JsonToSqliteMigrator(_logger, _tempDirectory, $"Data Source={_testDbPath}");
        var migrator2 = new JsonToSqliteMigrator(_logger, _tempDirectory, $"Data Source={_testDbPath}");
        
        var task1 = migrator1.MigrateAllAsync();
        var task2 = migrator2.MigrateAllAsync();
        
        var results = await Task.WhenAll(task1, task2);
        
        // Assert - At least one should succeed, and no data corruption
        var successCount = results.Count(r => r.Success);
        Assert.That(successCount, Is.GreaterThanOrEqualTo(1), "At least one migration should succeed");
        
        // Verify database integrity
        using var context = CreateDbContext(_testDbPath);
        var todoLists = await context.TodoLists.Include(t => t.Items).ToListAsync();
        
        // Should have exactly one TODO list (not duplicated)
        Assert.That(todoLists, Has.Count.EqualTo(1), "Should not have duplicate data from concurrent migrations");
        Assert.That(todoLists.First().Items, Has.Count.EqualTo(1), "TODO items should not be duplicated");
    }

    #region Helper Methods

    private async Task StartMcpServerAsync()
    {
        var serverPath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "..", "..", "..", "COA.Goldfish.McpServer", "bin", "Debug", "net9.0",
            "COA.Goldfish.McpServer.exe");

        if (!File.Exists(serverPath))
        {
            Assert.Fail($"Could not find MCP server executable at: {serverPath}");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = serverPath,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = _tempDirectory,
            Environment = { ["GOLDFISH_WORKSPACE"] = _tempDirectory }
        };

        _serverProcess = Process.Start(startInfo);
        Assert.That(_serverProcess, Is.Not.Null, "Failed to start MCP server process");

        _serverInput = _serverProcess.StandardInput;
        _serverOutput = _serverProcess.StandardOutput;

        // Give the server a moment to start up
        await Task.Delay(1000);
        
        Assert.That(_serverProcess.HasExited, Is.False, "MCP server process should not exit immediately");
    }

    private async Task InitializeMcpConnectionAsync()
    {
        var initRequest = new
        {
            jsonrpc = "2.0",
            id = 0,
            method = "initialize",
            @params = new
            {
                protocolVersion = "2024-11-05",
                capabilities = new
                {
                    roots = new { listChanged = true },
                    sampling = new { }
                },
                clientInfo = new
                {
                    name = "Error Handling Tests",
                    version = "1.0.0"
                }
            }
        };

        var response = await SendMcpRequestAsync(initRequest);
        Assert.That(response, Is.Not.Null, "Should receive initialization response");

        // Send initialized notification
        var initializedNotification = new
        {
            jsonrpc = "2.0",
            method = "notifications/initialized"
        };

        await SendMcpNotificationAsync(initializedNotification);
    }

    private async Task<string> SendMcpRequestAsync(object request)
    {
        Assert.That(_serverInput, Is.Not.Null, "Server input stream not available");
        Assert.That(_serverOutput, Is.Not.Null, "Server output stream not available");

        var jsonRequest = JsonSerializer.Serialize(request, new JsonSerializerOptions { WriteIndented = false });
        
        await _serverInput!.WriteLineAsync(jsonRequest);
        await _serverInput.FlushAsync();

        var response = await _serverOutput!.ReadLineAsync();
        Assert.That(response, Is.Not.Null, "Should receive response from server");

        return response!;
    }

    private async Task SendMcpNotificationAsync(object notification)
    {
        Assert.That(_serverInput, Is.Not.Null, "Server input stream not available");

        var jsonNotification = JsonSerializer.Serialize(notification, new JsonSerializerOptions { WriteIndented = false });
        
        await _serverInput!.WriteLineAsync(jsonNotification);
        await _serverInput.FlushAsync();
    }

    private static GoldfishDbContext CreateDbContext(string dbPath)
    {
        var options = new DbContextOptionsBuilder<GoldfishDbContext>()
            .UseSqlite($"Data Source={dbPath};Pooling=false;") // Force immediate connection close
            .Options;
        
        return new GoldfishDbContext(options);
    }

    #endregion
}