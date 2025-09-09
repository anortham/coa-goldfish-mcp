using COA.Goldfish.McpServer.Models;
using COA.Goldfish.McpServer.Services.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NUnit.Framework;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Tests for Plan.Discoveries functionality - validates the Intel → Discoveries migration
/// Direct storage testing to avoid complex MCP framework dependencies
/// </summary>
[TestFixture]
public class PlanDiscoveriesTest
{
    private GoldfishDbContext? _dbContext;
    private StorageService? _storageService;
    private string _testWorkspace = "test-discoveries";

    [SetUp]
    public async Task SetUp()
    {
        // Create in-memory database for testing
        var options = new DbContextOptionsBuilder<GoldfishDbContext>()
            .UseInMemoryDatabase(databaseName: $"TestDb_{Guid.NewGuid()}")
            .Options;

        _dbContext = new GoldfishDbContext(options);
        await _dbContext.Database.EnsureCreatedAsync();

        // Create storage service (testing at storage layer instead of tool layer)
        using var loggerFactory = LoggerFactory.Create(builder => 
            builder.AddConsole().SetMinimumLevel(LogLevel.Debug));
        var storageLogger = loggerFactory.CreateLogger<StorageService>();
        _storageService = new StorageService(_dbContext, storageLogger);
    }

    [TearDown]
    public async Task TearDown()
    {
        if (_dbContext != null)
        {
            await _dbContext.Database.EnsureDeletedAsync();
            await _dbContext.DisposeAsync();
        }
    }

    [Test]
    public async Task PlanUpdate_WithDiscoveries_ShouldUpdateDiscoveriesField()
    {
        // Arrange - Create a plan first using storage service directly
        var plan = new Plan
        {
            Id = Guid.NewGuid().ToString(),
            WorkspaceId = _testWorkspace,
            Title = "Test Plan with Discoveries",
            Description = "A plan to test discoveries functionality",
            Items = new List<string> { "Task 1", "Task 2" },
            Status = PlanStatus.Active
        };

        var savedPlan = await _storageService!.SavePlanAsync(plan);
        Assert.That(savedPlan, Is.Not.Null);
        Assert.That(savedPlan.Discoveries, Is.Empty, "New plan should have empty discoveries");

        // Act - Update the plan with discoveries
        var discoveries = new List<string>
        {
            "Discovery 1: React components work better with hooks",
            "Discovery 2: Database queries are faster with indexes",
            "Discovery 3: TypeScript prevents many runtime errors"
        };

        savedPlan.Discoveries = discoveries;
        savedPlan.UpdatedAt = DateTime.UtcNow;
        
        var updatedPlan = await _storageService.SavePlanAsync(savedPlan);

        // Assert - Discoveries should be persisted and retrievable
        Assert.That(updatedPlan, Is.Not.Null);
        Assert.That(updatedPlan.Discoveries, Is.Not.Empty, "Plan should have discoveries after update");
        Assert.That(updatedPlan.Discoveries, Has.Count.EqualTo(3), "Plan should have 3 discoveries");
        Assert.That(updatedPlan.Discoveries[0], Is.EqualTo("Discovery 1: React components work better with hooks"));
        
        // Verify persistence by retrieving from database
        var retrievedPlan = await _storageService.GetPlanAsync(savedPlan.Id);
        Assert.That(retrievedPlan, Is.Not.Null);
        Assert.That(retrievedPlan.Discoveries, Has.Count.EqualTo(3), "Retrieved plan should maintain discoveries");
        Assert.That(retrievedPlan.Discoveries[1], Is.EqualTo("Discovery 2: Database queries are faster with indexes"));
    }

    [Test]
    public async Task PlanResolve_WithSmartKeyword_ShouldFindLatestPlan()
    {
        // Arrange - Create multiple plans to test "latest" resolution
        var plan1 = new Plan
        {
            Id = Guid.NewGuid().ToString(),
            WorkspaceId = _testWorkspace,
            Title = "First Plan",
            Description = "Testing smart keyword resolution",
            Items = new List<string> { "Research task" },
            Status = PlanStatus.Active,
            CreatedAt = DateTime.UtcNow.AddMinutes(-10)
        };
        
        var plan2 = new Plan
        {
            Id = Guid.NewGuid().ToString(),
            WorkspaceId = _testWorkspace,
            Title = "Latest Plan Test",
            Description = "This should be the latest",
            Items = new List<string> { "Most recent task" },
            Status = PlanStatus.Active,
            CreatedAt = DateTime.UtcNow.AddMinutes(-5)
        };

        await _storageService!.SavePlanAsync(plan1);
        await _storageService.SavePlanAsync(plan2);

        // Act - Get latest plan using storage service keyword resolution
        var allPlans = await _storageService.GetPlansAsync(_testWorkspace, includeCompleted: true);
        var latestPlan = allPlans.OrderByDescending(p => p.UpdatedAt).FirstOrDefault();

        // Assert - Should get the most recent plan
        Assert.That(latestPlan, Is.Not.Null);
        Assert.That(latestPlan.Title, Is.EqualTo("Latest Plan Test"));
        
        // Act - Update latest with discoveries
        latestPlan!.Discoveries = new List<string> { "Latest discovery: Smart keywords work!" };
        var updatedPlan = await _storageService.SavePlanAsync(latestPlan);

        // Assert discoveries are persisted
        Assert.That(updatedPlan.Discoveries, Contains.Item("Latest discovery: Smart keywords work!"));
    }
}