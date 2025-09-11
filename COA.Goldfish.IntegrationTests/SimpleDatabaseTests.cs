using NUnit.Framework;
using COA.Goldfish.McpServer.Models;
using COA.Goldfish.McpServer.Services.Storage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Simple database isolation test that proves the core testing infrastructure works.
/// This test validates database isolation without complex MCP tool dependencies.
/// </summary>
[TestFixture]
public class SimpleDatabaseTests
{
    private GoldfishDbContext? _context;
    private IStorageService? _storage;
    private string _testWorkspaceId = "";

    [SetUp]
    public async Task SetUp()
    {
        // Create isolated test database (in-memory EF Core)
        _context = TestDbContextFactory.CreateInMemoryContext();
        await TestDbContextFactory.InitializeAsync(_context, false);

        // Create minimal logger for StorageService
        var services = new ServiceCollection();
        services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(LogLevel.Information));
        var serviceProvider = services.BuildServiceProvider();
        var logger = serviceProvider.GetRequiredService<ILogger<StorageService>>();

        // Create storage service with the isolated context
        _storage = new StorageService(_context, logger);

        // Create test workspace
        _testWorkspaceId = Guid.NewGuid().ToString();
    }

    [TearDown]
    public async Task TearDown()
    {
        if (_context != null)
        {
            await TestDbContextFactory.CleanupAsync(_context);
            _context = null;
        }
    }

    [Test]
    public async Task DatabaseIsolation_Should_WorkWithInMemoryDatabase()
    {
        // Arrange: Create realistic checkpoint data using TestDataFactory
        var (description, highlights, activeFiles) = TestDataFactory.GenerateCheckpointData("saas");
        
        var checkpoint = new Checkpoint
        {
            Id = Guid.NewGuid().ToString(),
            WorkspaceId = _testWorkspaceId,
            Description = description,
            WorkContext = "Integration testing with database isolation",
            Highlights = highlights,
            ActiveFiles = activeFiles,
            SessionId = Guid.NewGuid().ToString(),
            IsGlobal = false
        };

        // Act: Save directly to storage service (no MCP server process spawning)
        var savedCheckpoint = await _storage!.SaveCheckpointAsync(checkpoint);

        // Assert: Verify data was saved correctly in isolated database
        Assert.That(savedCheckpoint.Id, Is.EqualTo(checkpoint.Id));
        Assert.That(savedCheckpoint.Description, Is.EqualTo(description));
        Assert.That(savedCheckpoint.WorkspaceId, Is.EqualTo(_testWorkspaceId));
        Assert.That(savedCheckpoint.Highlights, Is.EquivalentTo(highlights));
        Assert.That(savedCheckpoint.ActiveFiles, Is.EquivalentTo(activeFiles));

        // Verify data persistence by querying again
        var retrievedCheckpoint = await _storage.GetCheckpointAsync(checkpoint.Id);
        Assert.That(retrievedCheckpoint, Is.Not.Null);
        Assert.That(retrievedCheckpoint.Description, Is.EqualTo(description));
        
        TestContext.WriteLine($"✅ Database isolation test completed successfully");
        TestContext.WriteLine($"📄 Checkpoint saved: {description}");
        TestContext.WriteLine($"🔒 Workspace isolated: {_testWorkspaceId}");
    }

    [Test]
    public async Task WorkspaceIsolation_Should_PreventCrossWorkspaceDataLeaks()
    {
        // Arrange: Create two separate workspaces
        var workspace1Id = Guid.NewGuid().ToString();
        var workspace2Id = Guid.NewGuid().ToString();

        var checkpoint1 = new Checkpoint
        {
            Id = Guid.NewGuid().ToString(),
            WorkspaceId = workspace1Id,
            Description = "Checkpoint in workspace 1",
            SessionId = Guid.NewGuid().ToString()
        };

        var checkpoint2 = new Checkpoint
        {
            Id = Guid.NewGuid().ToString(),
            WorkspaceId = workspace2Id,
            Description = "Checkpoint in workspace 2",
            SessionId = Guid.NewGuid().ToString()
        };

        // Act: Save checkpoints to different workspaces
        await _storage!.SaveCheckpointAsync(checkpoint1);
        await _storage.SaveCheckpointAsync(checkpoint2);

        // Assert: Verify workspace isolation
        var workspace1Checkpoints = await _storage.GetCheckpointsAsync(workspace1Id);
        var workspace2Checkpoints = await _storage.GetCheckpointsAsync(workspace2Id);

        Assert.That(workspace1Checkpoints.Count, Is.EqualTo(1));
        Assert.That(workspace2Checkpoints.Count, Is.EqualTo(1));
        Assert.That(workspace1Checkpoints[0].Description, Is.EqualTo("Checkpoint in workspace 1"));
        Assert.That(workspace2Checkpoints[0].Description, Is.EqualTo("Checkpoint in workspace 2"));

        TestContext.WriteLine($"✅ Workspace isolation verified");
        TestContext.WriteLine($"🏢 Workspace 1: {workspace1Checkpoints.Count} checkpoints");
        TestContext.WriteLine($"🏢 Workspace 2: {workspace2Checkpoints.Count} checkpoints");
    }

    [Test]
    public async Task TestDataFactory_Should_GenerateRealisticData()
    {
        await Task.Delay(1); // Ensure async context
        // Act: Generate test data for different scenarios
        var (ecommerceDesc, ecommerceHighlights, ecommerceFiles) = TestDataFactory.GenerateCheckpointData("ecommerce");
        var (devopsDesc, devopsHighlights, devopsFiles) = TestDataFactory.GenerateCheckpointData("devops");
        var (saasDesc, saasHighlights, saasFiles) = TestDataFactory.GenerateCheckpointData("saas");

        // Assert: Verify data is realistic and different for each scenario
        Assert.That(ecommerceDesc, Is.Not.Null.And.Not.Empty);
        Assert.That(devopsDesc, Is.Not.Null.And.Not.Empty);
        Assert.That(saasDesc, Is.Not.Null.And.Not.Empty);
        
        // Descriptions should be different for different scenarios
        Assert.That(ecommerceDesc, Is.Not.EqualTo(devopsDesc));
        Assert.That(devopsDesc, Is.Not.EqualTo(saasDesc));
        
        // Each scenario should have appropriate highlights and files
        Assert.That(ecommerceHighlights.Count, Is.GreaterThan(0));
        Assert.That(devopsHighlights.Count, Is.GreaterThan(0));
        Assert.That(saasHighlights.Count, Is.GreaterThan(0));
        
        Assert.That(ecommerceFiles.Count, Is.GreaterThan(0));
        Assert.That(devopsFiles.Count, Is.GreaterThan(0));
        Assert.That(saasFiles.Count, Is.GreaterThan(0));

        TestContext.WriteLine($"✅ Test data factory generates realistic scenarios");
        TestContext.WriteLine($"🛍️  E-commerce: {ecommerceDesc.Substring(0, 50)}...");
        TestContext.WriteLine($"🔧 DevOps: {devopsDesc.Substring(0, 50)}...");
        TestContext.WriteLine($"☁️  SaaS: {saasDesc.Substring(0, 50)}...");
    }

    [Test]
    public async Task DatabaseOperations_Should_RunFastWithoutProcessSpawning()
    {
        // Arrange: Create test data
        var (description, highlights, activeFiles) = TestDataFactory.GenerateCheckpointData("ml");
        
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        // Act: Perform multiple database operations
        for (int i = 0; i < 10; i++)
        {
            var checkpoint = new Checkpoint
            {
                Id = Guid.NewGuid().ToString(),
                WorkspaceId = _testWorkspaceId,
                Description = $"{description} - Iteration {i}",
                SessionId = Guid.NewGuid().ToString()
            };

            await _storage!.SaveCheckpointAsync(checkpoint);
        }

        stopwatch.Stop();

        // Assert: Operations should be fast (under 500ms for 10 operations)
        Assert.That(stopwatch.ElapsedMilliseconds, Is.LessThan(500), 
            $"Database operations took too long: {stopwatch.ElapsedMilliseconds}ms");

        // Verify all checkpoints were saved
        var allCheckpoints = await _storage!.GetCheckpointsAsync(_testWorkspaceId);
        Assert.That(allCheckpoints.Count, Is.EqualTo(10));

        TestContext.WriteLine($"✅ Fast database operations: {stopwatch.ElapsedMilliseconds}ms for 10 operations");
        TestContext.WriteLine($"📊 Average: {stopwatch.ElapsedMilliseconds / 10.0:F1}ms per operation");
        TestContext.WriteLine($"🚫 No MCP server processes spawned");
    }
}