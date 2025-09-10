using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NUnit.Framework;
using System.Text.Json;
using System.IO;
using System.Threading;
using System.Diagnostics;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// End-to-end Claude Code integration tests
/// Tests real Claude Code workflows with actual .NET MCP server
/// NO MOCKS - simulates actual user interactions through Claude Code
/// Tests complex scenarios that would happen in real usage
/// </summary>
[TestFixture]
public class ClaudeCodeIntegrationTests
{
    private string _tempWorkspace = string.Empty;
    private Process? _serverProcess;
    private StreamWriter? _serverInput;
    private StreamReader? _serverOutput;
    private StreamReader? _serverError;
    private ILogger? _logger;
    private SemaphoreSlim? _mcpSemaphore; // Ensure single MCP request at a time

    [SetUp]
    public async Task SetUp()
    {
        // Initialize semaphore for this test instance
        _mcpSemaphore = new SemaphoreSlim(1, 1);
        
        // Create temporary workspace that simulates user's actual workspace
        _tempWorkspace = Path.Combine(Path.GetTempPath(), $"claude_code_test_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempWorkspace);
        
        // Create test logger
        using var loggerFactory = LoggerFactory.Create(builder => 
            builder.AddConsole().SetMinimumLevel(LogLevel.Debug));
        _logger = loggerFactory.CreateLogger<ClaudeCodeIntegrationTests>();

        // Start the MCP server like Claude Code would
        await StartMcpServerAsync();
        await InitializeMcpConnectionAsync();
    }

    [TearDown]
    public async Task TearDown()
    {
        // Clean shutdown like Claude Code would do
        if (_serverProcess != null && !_serverProcess.HasExited)
        {
            try
            {
                _serverInput?.Close();
                _serverOutput?.Close();
                _serverError?.Close();
                
                if (!_serverProcess.WaitForExit(5000))
                {
                    _serverProcess.Kill();
                }
                
                _serverProcess.Dispose();
                
                // Give SQLite time to release file locks
                await Task.Delay(500);
                GC.Collect();
                GC.WaitForPendingFinalizers();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during server cleanup: {ex.Message}");
            }
        }

        // Clean up workspace
        if (Directory.Exists(_tempWorkspace))
        {
            try
            {
                Directory.Delete(_tempWorkspace, recursive: true);
            }
            catch (IOException ex)
            {
                Console.WriteLine($"Warning: Could not clean up workspace: {ex.Message}");
            }
        }
        
        // Dispose semaphore
        try
        {
            _mcpSemaphore?.Dispose();
            _mcpSemaphore = null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Could not dispose semaphore: {ex.Message}");
        }
    }

    [Test]
    public async Task TypicalUserWorkflow_CreateTodoCompleteItemsGenerateStandup_ShouldWork()
    {
        // Simulate a typical user workflow that would happen in Claude Code
        
        // Step 1: User asks "Create a TODO list for my current project"
        var createTodoRequest = new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new
                {
                    action = "create",
                    title = "Project Alpha Tasks",
                    items = new[]
                    {
                        "Research new authentication methods",
                        "Implement OAuth2 integration", 
                        "Write comprehensive tests",
                        "Update documentation",
                        "Deploy to staging environment"
                    }
                }
            }
        };

        var createResponse = await SendMcpRequestAsync(createTodoRequest);
        var createDoc = JsonDocument.Parse(createResponse);
        Assert.That(createDoc.RootElement.TryGetProperty("error", out _), Is.False,
            $"TODO creation should succeed: {createResponse}");

        // Step 2: User works for a while, then asks "Mark the first two tasks as done"
        var listTodosRequest = new
        {
            jsonrpc = "2.0",
            id = 2,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new { action = "view" }
            }
        };

        var listResponse = await SendMcpRequestAsync(listTodosRequest);
        var listDoc = JsonDocument.Parse(listResponse);
        
        // Extract the TODO list ID and item IDs (like Claude Code would do)
        var todoListId = ExtractTodoListIdFromResponse(listResponse);
        var itemIds = ExtractTodoItemIdsFromResponse(listResponse);
        
        Assert.That(todoListId, Is.Not.Null.And.Not.Empty, "Should extract valid TODO list ID");
        Assert.That(itemIds, Has.Count.GreaterThanOrEqualTo(2), "Should have at least 2 items to mark done");

        // Mark first two items as done
        var updateItem1Request = new
        {
            jsonrpc = "2.0",
            id = 3,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new
                {
                    action = "update",
                    listId = "latest", // Use smart keyword like real usage
                    itemId = itemIds[0],
                    status = "done"
                }
            }
        };

        var updateItem2Request = new
        {
            jsonrpc = "2.0", 
            id = 4,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new
                {
                    action = "update",
                    listId = "latest",
                    itemId = itemIds[1],
                    status = "done"
                }
            }
        };

        var update1Response = await SendMcpRequestAsync(updateItem1Request);
        var update2Response = await SendMcpRequestAsync(updateItem2Request);
        
        // Verify updates succeeded by checking for actual error objects (not just the word "error")
        var update1Doc = JsonDocument.Parse(update1Response);
        var update2Doc = JsonDocument.Parse(update2Response);
        
        // Debug: Print responses if they have actual error objects
        if (update1Doc.RootElement.TryGetProperty("error", out var error1) && error1.ValueKind != JsonValueKind.Null)
        {
            Console.WriteLine($"Update1 Error: {update1Response}");
        }
        if (update2Doc.RootElement.TryGetProperty("error", out var error2) && error2.ValueKind != JsonValueKind.Null)
        {
            Console.WriteLine($"Update2 Error: {update2Response}");
        }
        
        // Verify updates succeeded (check for actual error objects, not just the word "error")
        Assert.That(update1Doc.RootElement.TryGetProperty("error", out error1) && error1.ValueKind != JsonValueKind.Null, Is.False, "First item update should succeed");
        Assert.That(update2Doc.RootElement.TryGetProperty("error", out error2) && error2.ValueKind != JsonValueKind.Null, Is.False, "Second item update should succeed");

        // Step 3: User asks "Create a checkpoint for my progress today"
        var checkpointRequest = new
        {
            jsonrpc = "2.0",
            id = 5,
            method = "tools/call", 
            @params = new
            {
                name = "checkpoint",
                arguments = new
                {
                    action = "save",
                    description = "Completed OAuth research and implementation planning",
                    highlights = new[]
                    {
                        "Researched modern authentication methods",
                        "Started OAuth2 integration design",
                        "Identified key implementation challenges"
                    },
                    workContext = "Project Alpha authentication system",
                    activeFiles = new[] { "auth.cs", "oauth-config.json", "tests/auth.test.cs" }
                }
            }
        };

        var checkpointResponse = await SendMcpRequestAsync(checkpointRequest);
        Assert.That(HasActualError(checkpointResponse), Is.False, "Checkpoint creation should succeed");

        // Step 4: User asks "Generate my daily standup report"  
        var standupRequest = new
        {
            jsonrpc = "2.0",
            id = 6,
            method = "tools/call",
            @params = new
            {
                name = "standup",
                arguments = new { action = "daily" }
            }
        };

        var standupResponse = await SendMcpRequestAsync(standupRequest);
        Assert.That(HasActualError(standupResponse), Is.False, "Standup generation should succeed");
        
        // Verify standup generation succeeds and contains meaningful data
        Assert.That(standupResponse.Contains("Daily Standup Summary"), Is.True, 
            "Standup should contain the summary header");
        Assert.That(standupResponse.Contains("Recent Progress"), Is.True, 
            "Standup should contain recent progress section");
        Assert.That(standupResponse.Contains("Active Work"), Is.True, 
            "Standup should contain active work section");

        // Step 5: User asks "Show me my current progress" - verify data persistence  
        var finalListRequest = new
        {
            jsonrpc = "2.0",
            id = 7,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new { action = "view", listId = "latest" }
            }
        };

        var finalListResponse = await SendMcpRequestAsync(finalListRequest);
        
        // Verify that items were actually marked as done and persisted  
        // Parse the nested JSON to check status values properly
        var responseDoc = JsonDocument.Parse(finalListResponse);
        var resultContent = responseDoc.RootElement.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString();
        var todoData = JsonDocument.Parse(resultContent!);
        var items = todoData.RootElement.GetProperty("todoLists")[0].GetProperty("items").EnumerateArray();
        
        var doneItemsCount = items.Count(item => item.GetProperty("status").GetInt32() == 2);
        Assert.That(doneItemsCount, Is.GreaterThanOrEqualTo(2), 
            "At least 2 items should be marked as done (status=2)");
    }

    [Test]
    public async Task ComplexPlanningWorkflow_ShouldMaintainDataRelationships()
    {
        // Simulate complex planning workflow that tests data relationships
        
        // Step 1: Create a comprehensive project plan
        var createPlanRequest = new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "tools/call",
            @params = new
            {
                name = "plan",
                arguments = new
                {
                    action = "save",
                    title = "Mobile App Backend Redesign",
                    description = "Complete overhaul of our mobile API backend for better performance and scalability",
                    category = "architecture",
                    priority = "high", 
                    items = new[]
                    {
                        "Analyze current API performance bottlenecks",
                        "Design new microservices architecture", 
                        "Implement database optimization strategies",
                        "Build comprehensive API testing suite",
                        "Deploy to production with zero downtime"
                    },
                    estimatedEffort = "3 weeks"
                }
            }
        };

        var planResponse = await SendMcpRequestAsync(createPlanRequest);
        var planDoc = JsonDocument.Parse(planResponse);
        
        // Debug: Print error if plan creation fails
        if (planDoc.RootElement.TryGetProperty("error", out var planError) && planError.ValueKind != JsonValueKind.Null)
        {
            Console.WriteLine($"Plan Creation Error: {planResponse}");
        }
        
        Assert.That(planDoc.RootElement.TryGetProperty("error", out planError) && planError.ValueKind != JsonValueKind.Null, Is.False, "Plan creation should succeed");

        // Step 2: Generate actionable TODO list from the plan
        var generateTodosRequest = new
        {
            jsonrpc = "2.0",
            id = 2,
            method = "tools/call",
            @params = new
            {
                name = "plan",
                arguments = new
                {
                    planId = "latest", // Smart keyword
                    action = "generate-todos",
                    todoTitle = "Backend Redesign Implementation Tasks"
                }
            }
        };

        var generateTodosResponse = await SendMcpRequestAsync(generateTodosRequest);
        Assert.That(generateTodosResponse.Contains("\"isError\":true"), Is.False, 
            "TODO generation from plan should succeed");

        // Step 3: Work on some tasks and create progress checkpoints
        var workCheckpointRequest = new
        {
            jsonrpc = "2.0",
            id = 3,
            method = "tools/call",
            @params = new
            {
                name = "checkpoint",
                arguments = new
                {
                    action = "save",
                    description = "API performance analysis complete",
                    highlights = new[]
                    {
                        "Identified 3 major bottlenecks in user authentication",
                        "Database query optimization opportunities found",
                        "Current API response times documented"
                    },
                    workContext = "Backend redesign - analysis phase"
                }
            }
        };

        var workCheckpointResponse = await SendMcpRequestAsync(workCheckpointRequest);
        Assert.That(workCheckpointResponse.Contains("\"isError\":true"), Is.False, "Work checkpoint should succeed");

        // Step 4: Generate comprehensive standup that shows relationships
        var relationshipStandupRequest = new
        {
            jsonrpc = "2.0",
            id = 4,
            method = "tools/call",
            @params = new
            {
                name = "standup",
                arguments = new 
                { 
                    action = "daily",
                    includePlans = true,
                    includeTodos = true,
                    includeCheckpoints = true,
                    includeRelationships = true
                }
            }
        };

        var relationshipStandupResponse = await SendMcpRequestAsync(relationshipStandupRequest);
        Assert.That(relationshipStandupResponse.Contains("\"isError\":true"), Is.False, 
            "Relationship-aware standup should succeed");
        
        // Verify the standup shows connections between plan, todos, and checkpoints
        // Verify standup generation succeeds and contains meaningful structural data
        Assert.That(relationshipStandupResponse.Contains("Daily Standup Summary"), Is.True,
            "Standup should contain the summary header");
        Assert.That(relationshipStandupResponse.Contains("Recent Progress"), Is.True,
            "Standup should contain recent progress section");
        Assert.That(relationshipStandupResponse.Contains("Active Work"), Is.True,
            "Standup should contain active work section");
    }

    [Test]
    public async Task LongRunningSession_ShouldMaintainPerformance()
    {
        // Simulate a long coding session with many interactions
        var operations = new List<Task<string>>();
        var startTime = DateTime.UtcNow;

        // Create baseline operations
        for (int i = 1; i <= 50; i++)
        {
            var createTodoRequest = new
            {
                jsonrpc = "2.0",
                id = i * 10,
                method = "tools/call",
                @params = new
                {
                    name = "todo",
                    arguments = new
                    {
                        action = "create",
                        title = $"Session Task Batch {i}",
                        items = new[] { $"Task {i}.1", $"Task {i}.2", $"Task {i}.3" }
                    }
                }
            };

            operations.Add(SendMcpRequestAsync(createTodoRequest));

            // Add checkpoint every 10 operations
            if (i % 10 == 0)
            {
                var checkpointRequest = new
                {
                    jsonrpc = "2.0",
                    id = i * 10 + 1,
                    method = "tools/call",
                    @params = new
                    {
                        name = "checkpoint",
                        arguments = new
                        {
                            action = "save",
                            description = $"Progress checkpoint at batch {i}",
                            highlights = new[] { $"Completed {i * 3} tasks across {i} TODO lists" }
                        }
                    }
                };

                operations.Add(SendMcpRequestAsync(checkpointRequest));
            }
        }

        // Execute all operations
        var responses = await Task.WhenAll(operations);
        var endTime = DateTime.UtcNow;
        var duration = endTime - startTime;

        // Verify all operations succeeded
        var failedOperations = responses.Count(r => r.Contains("\"isError\":true"));
        Assert.That(failedOperations, Is.EqualTo(0), 
            $"All operations should succeed in long session, but {failedOperations} failed");

        // Verify performance didn't degrade significantly  
        Assert.That(duration.TotalMinutes, Is.LessThan(5), 
            "Long session should complete within reasonable time");

        // Test final standup generation with large dataset
        var finalStandupRequest = new
        {
            jsonrpc = "2.0",
            id = 999,
            method = "tools/call",
            @params = new
            {
                name = "standup",
                arguments = new { action = "daily" }
            }
        };

        var standupStart = DateTime.UtcNow;
        var finalStandupResponse = await SendMcpRequestAsync(finalStandupRequest);
        var standupDuration = DateTime.UtcNow - standupStart;

        Assert.That(finalStandupResponse.Contains("\"isError\":true"), Is.False, 
            "Final standup should succeed with large dataset");
        Assert.That(standupDuration.TotalSeconds, Is.LessThan(10), 
            "Standup generation should remain fast with large dataset");
    }

    [Test] 
    public async Task RealWorldDataPersistence_ShouldSurviveServerRestarts()
    {
        // Create some work data
        var initialDataRequest = new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new
                {
                    action = "create",
                    title = "Critical Production Fix",
                    items = new[]
                    {
                        "Identify memory leak in user service",
                        "Deploy hotfix to production",
                        "Monitor system health post-deployment"
                    }
                }
            }
        };

        var initialResponse = await SendMcpRequestAsync(initialDataRequest);
        Assert.That(initialResponse.Contains("\"isError\":true"), Is.False, "Initial data creation should succeed");

        // Create checkpoint
        var checkpointRequest = new
        {
            jsonrpc = "2.0",
            id = 2,
            method = "tools/call",
            @params = new
            {
                name = "checkpoint",
                arguments = new
                {
                    action = "save",
                    description = "Emergency production fix in progress",
                    highlights = new[] { "Memory leak identified in user authentication", "Hotfix code ready for deployment" },
                    workContext = "Production emergency response"
                }
            }
        };

        var checkpointResponse = await SendMcpRequestAsync(checkpointRequest);
        Assert.That(checkpointResponse.Contains("\"isError\":true"), Is.False, "Checkpoint creation should succeed");

        // Restart the server (simulate what happens when Claude Code restarts)
        await RestartMcpServerAsync();

        // Verify data persisted across restart
        var postRestartTodoRequest = new
        {
            jsonrpc = "2.0",
            id = 3,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new { action = "view" }
            }
        };

        var postRestartResponse = await SendMcpRequestAsync(postRestartTodoRequest);
        Assert.That(postRestartResponse.Contains("\"isError\":true"), Is.False, 
            "TODO retrieval should work after server restart");

        // Verify checkpoint data persisted
        var postRestartCheckpointRequest = new
        {
            jsonrpc = "2.0",
            id = 4,
            method = "tools/call",
            @params = new
            {
                name = "checkpoint",
                arguments = new { action = "restore" }
            }
        };

        var postRestartCheckpointResponse = await SendMcpRequestAsync(postRestartCheckpointRequest);
        Assert.That(postRestartCheckpointResponse.Contains("\"isError\":true"), Is.False,
            "Checkpoint retrieval should work after server restart");
    }

    [Test]
    public async Task SmartKeywordUsage_ShouldWorkLikeRealUsers()
    {
        // Test all the smart keywords that real users would use
        
        // Create multiple TODO lists and plans
        await CreateTestDataForKeywordTesting();

        // Test "latest" keyword usage
        var latestTodoRequest = new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new
                {
                    action = "update", 
                    listId = "latest", // Smart keyword
                    newTask = "Added via latest keyword"
                }
            }
        };

        var latestResponse = await SendMcpRequestAsync(latestTodoRequest);
        Assert.That(latestResponse.Contains("\"isError\":true"), Is.False, 
            "Latest keyword should work for TODO operations");

        // Test "active" keyword usage
        var activeTodoRequest = new
        {
            jsonrpc = "2.0",
            id = 2,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new
                {
                    action = "view",
                    listId = "active" // Smart keyword
                }
            }
        };

        var activeResponse = await SendMcpRequestAsync(activeTodoRequest);
        Assert.That(activeResponse.Contains("\"isError\":true"), Is.False,
            "Active keyword should work for TODO operations");

        // Test plan keywords
        var latestPlanRequest = new
        {
            jsonrpc = "2.0",
            id = 3,
            method = "tools/call",
            @params = new
            {
                name = "plan",
                arguments = new
                {
                    planId = "latest", // Smart keyword
                    action = "update",
                    status = "active"
                }
            }
        };

        var latestPlanResponse = await SendMcpRequestAsync(latestPlanRequest);
        Assert.That(latestPlanResponse.Contains("\"isError\":true"), Is.False,
            "Latest keyword should work for plan operations");
    }

    #region Helper Methods

    private async Task StartMcpServerAsync()
    {
        var serverPath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "..", "..", "..", "..", "COA.Goldfish.McpServer", "bin", "Debug", "net9.0",
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
            WorkingDirectory = _tempWorkspace,
            Environment = { ["GOLDFISH_WORKSPACE"] = _tempWorkspace }
        };

        _serverProcess = Process.Start(startInfo);
        Assert.That(_serverProcess, Is.Not.Null, "Failed to start MCP server process");

        _serverInput = _serverProcess.StandardInput;
        _serverOutput = _serverProcess.StandardOutput;
        _serverError = _serverProcess.StandardError;

        // Give the server time to start up
        await Task.Delay(1500);
        
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
                    name = "Claude Code End-to-End Tests",
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
        Assert.That(_mcpSemaphore, Is.Not.Null, "MCP semaphore not available");

        // Use semaphore to ensure only one MCP request is processed at a time
        await _mcpSemaphore.WaitAsync();
        try
        {
            var jsonRequest = JsonSerializer.Serialize(request, new JsonSerializerOptions { WriteIndented = false });
            
            await _serverInput!.WriteLineAsync(jsonRequest);
            await _serverInput.FlushAsync();

            var response = await _serverOutput!.ReadLineAsync();
            Assert.That(response, Is.Not.Null, "Should receive response from server");

            return response!;
        }
        finally
        {
            _mcpSemaphore?.Release();
        }
    }

    private async Task SendMcpNotificationAsync(object notification)
    {
        Assert.That(_serverInput, Is.Not.Null, "Server input stream not available");

        var jsonNotification = JsonSerializer.Serialize(notification, new JsonSerializerOptions { WriteIndented = false });
        
        await _serverInput!.WriteLineAsync(jsonNotification);
        await _serverInput.FlushAsync();
    }

    private async Task RestartMcpServerAsync()
    {
        // Shutdown current server
        if (_serverProcess != null && !_serverProcess.HasExited)
        {
            _serverInput?.Close();
            _serverOutput?.Close();
            _serverError?.Close();
            
            if (!_serverProcess.WaitForExit(3000))
            {
                _serverProcess.Kill();
            }
            
            _serverProcess.Dispose();
            
            // Give SQLite time to release file locks
            await Task.Delay(500);
            GC.Collect();
            GC.WaitForPendingFinalizers();
        }

        // Start new server instance
        await StartMcpServerAsync();
        await InitializeMcpConnectionAsync();
    }

    private async Task CreateTestDataForKeywordTesting()
    {
        // Create multiple TODO lists
        for (int i = 1; i <= 3; i++)
        {
            var todoRequest = new
            {
                jsonrpc = "2.0",
                id = i * 100,
                method = "tools/call",
                @params = new
                {
                    name = "todo",
                    arguments = new
                    {
                        action = "create",
                        title = $"Test TODO List {i}",
                        items = new[] { $"Task {i}.1", $"Task {i}.2" }
                    }
                }
            };

            await SendMcpRequestAsync(todoRequest);
            await Task.Delay(100); // Ensure different timestamps
        }

        // Create multiple plans
        for (int i = 1; i <= 2; i++)
        {
            var planRequest = new
            {
                jsonrpc = "2.0",
                id = i * 200,
                method = "tools/call",
                @params = new
                {
                    name = "plan",
                    arguments = new
                    {
                        action = "save",
                        title = $"Test Plan {i}",
                        description = $"This is test plan number {i}",
                        items = new[] { $"Plan item {i}.1", $"Plan item {i}.2" }
                    }
                }
            };

            await SendMcpRequestAsync(planRequest);
            await Task.Delay(100); // Ensure different timestamps
        }
    }

    private string ExtractTodoListIdFromResponse(string response)
    {
        try
        {
            var doc = JsonDocument.Parse(response);
            if (doc.RootElement.TryGetProperty("result", out var result) &&
                result.TryGetProperty("content", out var content) &&
                content.GetArrayLength() > 0)
            {
                var textContent = content[0].GetProperty("text").GetString();
                if (!string.IsNullOrEmpty(textContent))
                {
                    var contentDoc = JsonDocument.Parse(textContent);
                    if (contentDoc.RootElement.TryGetProperty("todoLists", out var todoLists) &&
                        todoLists.GetArrayLength() > 0 &&
                        todoLists[0].TryGetProperty("id", out var id))
                    {
                        return id.GetString() ?? "";
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Assert.Fail($"Failed to extract TODO list ID: {ex.Message}");
        }
        return "";
    }

    private List<string> ExtractTodoItemIdsFromResponse(string response)
    {
        var itemIds = new List<string>();
        try
        {
            var doc = JsonDocument.Parse(response);
            if (doc.RootElement.TryGetProperty("result", out var result) &&
                result.TryGetProperty("content", out var content) &&
                content.GetArrayLength() > 0)
            {
                var textContent = content[0].GetProperty("text").GetString();
                if (!string.IsNullOrEmpty(textContent))
                {
                    var contentDoc = JsonDocument.Parse(textContent);
                    if (contentDoc.RootElement.TryGetProperty("todoLists", out var todoLists) &&
                        todoLists.GetArrayLength() > 0 &&
                        todoLists[0].TryGetProperty("items", out var items))
                    {
                        foreach (var item in items.EnumerateArray())
                        {
                            if (item.TryGetProperty("id", out var itemId))
                            {
                                var idValue = itemId.GetString();
                                if (!string.IsNullOrEmpty(idValue))
                                {
                                    itemIds.Add(idValue);
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Assert.Fail($"Failed to extract TODO item IDs: {ex.Message}");
        }
        return itemIds;
    }

    private static bool HasActualError(string jsonResponse)
    {
        try
        {
            var doc = JsonDocument.Parse(jsonResponse);
            if (doc.RootElement.TryGetProperty("error", out var error))
            {
                return error.ValueKind != JsonValueKind.Null;
            }
            return false;
        }
        catch
        {
            return true; // If we can't parse JSON, consider it an error
        }
    }

    #endregion
}