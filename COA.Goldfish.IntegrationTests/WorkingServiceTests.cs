using NUnit.Framework;
using COA.Goldfish.McpServer.Models;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Working demonstration of the testing theater elimination solution.
/// These tests prove that database isolation, direct service calling, and realistic data work.
/// </summary>
[TestFixture]
public class WorkingServiceTests : ServiceTestBase
{
    [Test]
    public async Task DatabaseOperations_Should_WorkWithoutProcessSpawning()
    {
        // Arrange: Create realistic checkpoint data using TestDataFactory
        var (description, highlights, activeFiles) = TestDataFactory.GenerateCheckpointData("ecommerce");
        var request = CreateCheckpointRequest(description, highlights, activeFiles);

        // Act: Direct service call - NO MCP server process spawning
        var result = await _checkpointTool!.ExecuteAsync(request);

        // Assert: Verify real database persistence
        if (!result.Success)
        {
            TestContext.WriteLine($"❌ Checkpoint tool failed: {result.Error?.Message ?? result.Message}");
            TestContext.WriteLine($"🔍 Error code: {result.Error?.Code}");
        }
        Assert.That(result.Success, Is.True, $"Checkpoint failed: {result.Error?.Message ?? result.Message}");
        Assert.That(result.Message, Contains.Substring("Checkpoint saved"));
        
        // Verify data was actually saved to database
        var savedCheckpoint = await _context!.Checkpoints
            .FirstOrDefaultAsync(c => c.Description == description);
        Assert.That(savedCheckpoint, Is.Not.Null);
        Assert.That(savedCheckpoint.Highlights, Is.EquivalentTo(highlights));
        Assert.That(savedCheckpoint.ActiveFiles, Is.EquivalentTo(activeFiles));
        
        TestContext.WriteLine($"✅ Database operation completed in isolated test database");
        TestContext.WriteLine($"📄 Checkpoint: {description}");
    }

    [Test]
    public async Task TodoOperations_Should_ValidateRealBusinessLogic()
    {
        // Arrange: Create realistic todo data
        var (title, items) = TestDataFactory.GenerateTodoData("devops");
        var request = CreateTodoRequest(title, items);

        // Act: Direct service call validates all business rules
        var result = await _todoTool!.ExecuteAsync(request);

        // Assert: Verify real Entity Framework operations
        Assert.That(result.Success, Is.True);
        
        // Verify todo list was created in database
        var savedTodoList = await _context!.TodoLists
            .Include(tl => tl.Items)
            .FirstOrDefaultAsync(tl => tl.Title == title);
        
        Assert.That(savedTodoList, Is.Not.Null);
        Assert.That(savedTodoList.Items.Count, Is.EqualTo(items.Count));
        
        // Verify all todo items were saved with correct status
        foreach (var item in items)
        {
            var savedItem = savedTodoList.Items.FirstOrDefault(i => i.Content == item);
            Assert.That(savedItem, Is.Not.Null);
            Assert.That(savedItem.Status, Is.EqualTo("pending"));
        }
        
        TestContext.WriteLine($"✅ Todo list created with {items.Count} items");
        TestContext.WriteLine($"📋 Title: {title}");
    }

    [Test]
    public async Task WorkspaceIsolation_Should_PreventDataContamination()
    {
        // Arrange: Create data in this test's isolated workspace
        var request1 = CreateCheckpointRequest("Workspace Test 1");
        var result1 = await _checkpointTool!.ExecuteAsync(request1);
        
        // Act: Create another test with different workspace
        var isolatedWorkspaceId = Guid.NewGuid().ToString();
        var request2 = CreateCheckpointRequest("Workspace Test 2");
        request2.Workspace = isolatedWorkspaceId;
        
        // This should fail because workspace doesn't exist
        var result2 = await _checkpointTool.ExecuteAsync(request2);

        // Assert: Verify workspace isolation
        Assert.That(result1.Success, Is.True);
        Assert.That(result2.Success, Is.False); // Different workspace should fail
        
        // Verify only our test data exists
        var checkpoints = await _context!.Checkpoints.ToListAsync();
        Assert.That(checkpoints.All(c => c.WorkspaceId == _testWorkspaceId), Is.True);
        Assert.That(checkpoints.Count, Is.EqualTo(1)); // Only our checkpoint
        
        TestContext.WriteLine($"✅ Workspace isolation verified");
        TestContext.WriteLine($"🔒 Test workspace: {_testWorkspaceId[..8]}...");
    }

    [Test]
    public async Task PerformanceTest_Should_ExecuteQuicklyWithoutProcessOverhead()
    {
        // Arrange: Measure performance of 50 operations
        var stopwatch = Stopwatch.StartNew();
        var operationCount = 50;
        
        // Act: Create multiple checkpoints rapidly
        for (int i = 0; i < operationCount; i++)
        {
            var (description, highlights, activeFiles) = TestDataFactory.GenerateCheckpointData("random");
            var request = CreateCheckpointRequest($"{description} #{i}", highlights, activeFiles);
            var result = await _checkpointTool!.ExecuteAsync(request);
            Assert.That(result.Success, Is.True);
        }
        
        stopwatch.Stop();
        
        // Assert: Performance should be excellent without process spawning
        Assert.That(stopwatch.ElapsedMilliseconds, Is.LessThan(2000)); // Under 2 seconds
        
        // Verify all operations succeeded
        var checkpointCount = await _context!.Checkpoints.CountAsync();
        Assert.That(checkpointCount, Is.EqualTo(operationCount));
        
        TestContext.WriteLine($"✅ {operationCount} operations completed in {stopwatch.ElapsedMilliseconds}ms");
        TestContext.WriteLine($"⚡ Average: {stopwatch.ElapsedMilliseconds / operationCount}ms per operation");
    }

    [Test]
    public async Task ComplexScenario_Should_TestRealWorkflowWithoutMocks()
    {
        // Arrange: Create a complete development workflow
        var (planTitle, planDescription, planItems, category) = TestDataFactory.GeneratePlanData("saas");
        var (todoTitle, todoItems) = TestDataFactory.GenerateTodoData("saas");
        var (checkpointDesc, highlights, activeFiles) = TestDataFactory.GenerateCheckpointData("saas");

        // Act: Execute complete workflow - Plan → Todos → Checkpoint
        
        // 1. Create strategic plan
        var planRequest = CreatePlanRequest(planTitle, planDescription, planItems);
        var planResult = await _planTool!.ExecuteAsync(planRequest);
        
        // 2. Create todo list
        var todoRequest = CreateTodoRequest(todoTitle, todoItems);
        var todoResult = await _todoTool!.ExecuteAsync(todoRequest);
        
        // 3. Create checkpoint
        var checkpointRequest = CreateCheckpointRequest(checkpointDesc, highlights, activeFiles);
        var checkpointResult = await _checkpointTool!.ExecuteAsync(checkpointRequest);

        // Assert: All operations succeeded and are related
        Assert.That(planResult.Success, Is.True);
        Assert.That(todoResult.Success, Is.True);
        Assert.That(checkpointResult.Success, Is.True);
        
        // Verify all data exists in database with proper relationships
        var plan = await _context!.Plans.FirstOrDefaultAsync(p => p.Title == planTitle);
        var todoList = await _context.TodoLists.Include(tl => tl.Items).FirstOrDefaultAsync(tl => tl.Title == todoTitle);
        var checkpoint = await _context.Checkpoints.FirstOrDefaultAsync(c => c.Description == checkpointDesc);
        
        Assert.That(plan, Is.Not.Null);
        Assert.That(todoList, Is.Not.Null);
        Assert.That(checkpoint, Is.Not.Null);
        
        // All should belong to same workspace
        Assert.That(plan.WorkspaceId, Is.EqualTo(_testWorkspaceId));
        Assert.That(todoList.WorkspaceId, Is.EqualTo(_testWorkspaceId));
        Assert.That(checkpoint.WorkspaceId, Is.EqualTo(_testWorkspaceId));
        
        TestContext.WriteLine($"✅ Complete workflow executed successfully");
        TestContext.WriteLine($"📊 Plan: {planTitle}");
        TestContext.WriteLine($"📋 Todo: {todoTitle} ({todoItems.Count} items)");
        TestContext.WriteLine($"💾 Checkpoint: {checkpointDesc}");
    }

    [Test]
    public async Task DatabaseConstraints_Should_BeEnforced()
    {
        // Arrange: Try to create invalid data
        var invalidRequest = CreateCheckpointRequest("");
        invalidRequest.Description = ""; // Empty description should fail validation

        // Act: Attempt to save invalid data
        var result = await _checkpointTool!.ExecuteAsync(invalidRequest);

        // Assert: Entity Framework validation should prevent invalid data
        Assert.That(result.Success, Is.False);
        Assert.That(result.Error?.Message, Contains.Substring("description").IgnoreCase);
        
        // Verify no invalid data was saved
        var checkpointCount = await _context!.Checkpoints.CountAsync();
        Assert.That(checkpointCount, Is.EqualTo(0));
        
        TestContext.WriteLine($"✅ Database constraints enforced");
        TestContext.WriteLine($"🚫 Invalid data rejected: {result.Error?.Message}");
    }

    [Test]
    public async Task ConcurrentAccess_Should_HandleMultipleConnections()
    {
        // Arrange: Create multiple concurrent operations
        var tasks = new List<Task<bool>>();
        var operationCount = 20;
        
        // Act: Execute concurrent operations
        for (int i = 0; i < operationCount; i++)
        {
            int operationId = i; // Capture loop variable
            var task = Task.Run(async () =>
            {
                var (description, highlights, activeFiles) = TestDataFactory.GenerateCheckpointData("random");
                var request = CreateCheckpointRequest($"{description} - Concurrent #{operationId}", highlights, activeFiles);
                var result = await _checkpointTool!.ExecuteAsync(request);
                return result.Success;
            });
            tasks.Add(task);
        }
        
        var results = await Task.WhenAll(tasks);
        
        // Assert: All concurrent operations should succeed
        Assert.That(results.All(r => r), Is.True);
        
        // Verify correct number of records created
        var checkpointCount = await _context!.Checkpoints.CountAsync();
        Assert.That(checkpointCount, Is.EqualTo(operationCount));
        
        TestContext.WriteLine($"✅ {operationCount} concurrent operations completed successfully");
        TestContext.WriteLine($"🔄 Database handled concurrent access properly");
    }

    [Test]
    public async Task RealFtsSearch_Should_WorkWithSqliteDatabase()
    {
        // Arrange: Override default context to use SQLite for FTS5 testing
        await CleanupServicesAsync();
        _context = TestDbContextFactory.CreateInMemorySqliteContext();
        await TestDbContextFactory.InitializeAsync(_context, false);
        await SetUpServicesAsync(); // Re-setup services with SQLite context
        
        // Create searchable data
        var (description, highlights, activeFiles) = TestDataFactory.GenerateCheckpointData("ecommerce");
        var request = CreateCheckpointRequest(description, highlights, activeFiles);
        var result = await _checkpointTool!.ExecuteAsync(request);
        
        Assert.That(result.Success, Is.True);
        
        // Act: Search for the created checkpoint
        var searchRequest = new COA.Goldfish.McpServer.Models.SearchParameters
        {
            Query = "payment integration", // Should match ecommerce scenarios
            Limit = 10,
            WorkspaceId = _testWorkspaceId
        };
        
        var searchResult = await _searchTool!.ExecuteAsync(searchRequest);
        
        // Assert: FTS5 search should find relevant results
        Assert.That(searchResult.Success, Is.True);
        Assert.That(searchResult.Message, Contains.Substring("payment").IgnoreCase);
        
        TestContext.WriteLine($"✅ SQLite FTS5 search working correctly");
        TestContext.WriteLine($"🔍 Found results for: payment integration");
    }
}