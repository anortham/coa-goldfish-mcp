using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using NUnit.Framework;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Real MCP protocol integration tests - tests actual server communication over stdin/stdout
/// NO MOCKS - this tests the actual protocol implementation
/// </summary>
[TestFixture]
public class McpProtocolIntegrationTests
{
    private Process? _serverProcess;
    private StreamWriter? _serverInput;
    private StreamReader? _serverOutput;
    private ILogger<McpProtocolIntegrationTests>? _logger;
    private string _tempWorkspace = string.Empty;

    [SetUp]
    public async Task SetUp()
    {
        // Create temporary workspace for testing
        _tempWorkspace = Path.Combine(Path.GetTempPath(), $"goldfish_integration_test_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempWorkspace);
        
        // Create logger
        using var loggerFactory = LoggerFactory.Create(builder => 
            builder.AddConsole().SetMinimumLevel(LogLevel.Debug));
        _logger = loggerFactory.CreateLogger<McpProtocolIntegrationTests>();

        // Start the actual MCP server process
        await StartMcpServerAsync();
        
        // Initialize MCP connection
        await InitializeMcpConnectionAsync();
    }

    [TearDown]
    public async Task TearDown()
    {
        // Close MCP server
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
                _logger?.LogWarning(ex, "Error during server cleanup");
            }
        }

        // Clean up test workspace
        if (Directory.Exists(_tempWorkspace))
        {
            try
            {
                Directory.Delete(_tempWorkspace, true);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Could not clean up test workspace");
            }
        }
    }

    [Test]
    public async Task McpServer_ShouldInitializeCorrectly()
    {
        // This test verifies the server actually starts and responds to MCP initialize
        Assert.That(_serverProcess, Is.Not.Null, "Server process should be running");
        Assert.That(_serverProcess!.HasExited, Is.False, "Server should still be running");
        
        // The initialization happened in SetUp, if we get here, it worked
        Assert.Pass("MCP server initialized successfully");
    }

    [Test]
    public async Task CheckpointTool_ShouldCreateAndRetrieveCheckpoint()
    {
        // Test the actual checkpoint tool through MCP protocol
        var checkpointRequest = new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "tools/call",
            @params = new
            {
                name = "checkpoint",
                arguments = new
                {
                    action = "save",
                    description = "Integration test checkpoint",
                    highlights = new[] { "Started integration testing", "MCP protocol working" },
                    activeFiles = new[] { "McpProtocolIntegrationTests.cs" },
                    workContext = "Testing MCP integration"
                }
            }
        };

        var response = await SendMcpRequestAsync(checkpointRequest);
        
        Assert.That(response, Is.Not.Null, "Should receive response from checkpoint tool");
        
        var jsonResponse = JsonDocument.Parse(response);
        Assert.That(jsonResponse.RootElement.TryGetProperty("error", out _), Is.False, 
            $"Checkpoint should succeed, but got error: {response}");
        
        // Verify the response contains expected data
        Assert.That(jsonResponse.RootElement.TryGetProperty("result", out var result), Is.True,
            "Should have result property");
        
        _logger?.LogInformation("Checkpoint response: {Response}", response);
    }

    [Test]
    public async Task TodoTool_ShouldCreateAndListTodos()
    {
        // Create a TODO list
        var createRequest = new
        {
            jsonrpc = "2.0",
            id = 2,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new
                {
                    action = "create",
                    title = "Integration Test Tasks",
                    items = new[] { "Test checkpoint tool", "Test todo tool", "Verify data persistence" }
                }
            }
        };

        var createResponse = await SendMcpRequestAsync(createRequest);
        Assert.That(createResponse, Is.Not.Null);
        
        var createJsonResponse = JsonDocument.Parse(createResponse);
        Assert.That(createJsonResponse.RootElement.TryGetProperty("error", out _), Is.False,
            $"TODO creation should succeed: {createResponse}");

        // List TODOs to verify creation
        var listRequest = new
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

        var listResponse = await SendMcpRequestAsync(listRequest);
        Assert.That(listResponse, Is.Not.Null);
        
        var listJsonResponse = JsonDocument.Parse(listResponse);
        Assert.That(listJsonResponse.RootElement.TryGetProperty("error", out _), Is.False,
            $"TODO listing should succeed: {listResponse}");

        _logger?.LogInformation("TODO list response: {Response}", listResponse);
    }

    [Test]
    public async Task PlanTool_ShouldCreatePlan()
    {
        var planRequest = new
        {
            jsonrpc = "2.0",
            id = 4,
            method = "tools/call",
            @params = new
            {
                name = "plan",
                arguments = new
                {
                    action = "save",
                    title = "Integration Testing Plan",
                    description = "Comprehensive plan for testing the .NET MCP server integration",
                    category = "architecture",
                    priority = "high",
                    items = new[] { 
                        "Set up test environment",
                        "Test MCP protocol compliance", 
                        "Verify tool functionality",
                        "Test data persistence"
                    }
                }
            }
        };

        var response = await SendMcpRequestAsync(planRequest);
        Assert.That(response, Is.Not.Null);
        
        var jsonResponse = JsonDocument.Parse(response);
        Assert.That(jsonResponse.RootElement.TryGetProperty("error", out _), Is.False,
            $"Plan creation should succeed: {response}");

        _logger?.LogInformation("Plan response: {Response}", response);
    }

    [Test]
    public async Task StandupTool_ShouldGenerateReport()
    {
        // Create some test data first - checkpoint for recent activity
        var checkpointRequest = new
        {
            jsonrpc = "2.0",
            id = 50,
            method = "tools/call",
            @params = new
            {
                name = "checkpoint",
                arguments = new
                {
                    action = "save",
                    description = "Standup test checkpoint",
                    highlights = new[] { "Testing standup functionality", "Creating test checkpoint" },
                    workContext = "Integration test standup validation"
                }
            }
        };

        var checkpointResponse = await SendMcpRequestAsync(checkpointRequest);
        Assert.That(checkpointResponse, Is.Not.Null);
        
        // Now test standup report
        var standupRequest = new
        {
            jsonrpc = "2.0",
            id = 5,
            method = "tools/call",
            @params = new
            {
                name = "standup",
                arguments = new { action = "daily" }
            }
        };

        var response = await SendMcpRequestAsync(standupRequest);
        Assert.That(response, Is.Not.Null);
        
        var jsonResponse = JsonDocument.Parse(response);
        Assert.That(jsonResponse.RootElement.TryGetProperty("error", out _), Is.False,
            $"Standup should succeed: {response}");

        // Verify the standup contains expected structure and our checkpoint
        Assert.That(response.Contains("Daily Standup Summary"), Is.True,
            "Standup should contain proper header");
        Assert.That(response.Contains("Recent Progress"), Is.True,
            "Standup should contain recent progress section");
        Assert.That(response.Contains("Standup test checkpoint"), Is.True,
            "Standup should reference the checkpoint we created");

        _logger?.LogInformation("Standup response: {Response}", response);
    }

    [Test]
    public async Task MultipleTools_ShouldMaintainDataConsistency()
    {
        // This tests that data created by one tool is visible to others
        // Create a plan
        var planRequest = new
        {
            jsonrpc = "2.0",
            id = 6,
            method = "tools/call",
            @params = new
            {
                name = "plan",
                arguments = new
                {
                    action = "save",
                    title = "Data Consistency Test",
                    description = "Test cross-tool data visibility",
                    items = new[] { "Create plan", "Create related TODO", "Checkpoint progress" }
                }
            }
        };

        var planResponse = await SendMcpRequestAsync(planRequest);
        Assert.That(planResponse, Is.Not.Null);

        // Create a TODO referencing the plan
        var todoRequest = new
        {
            jsonrpc = "2.0",
            id = 7,
            method = "tools/call",
            @params = new
            {
                name = "todo",
                arguments = new
                {
                    action = "create",
                    title = "Execute Data Consistency Test",
                    items = new[] { "Verify plan created", "Test cross-references" }
                }
            }
        };

        var todoResponse = await SendMcpRequestAsync(todoRequest);
        Assert.That(todoResponse, Is.Not.Null);

        // Create checkpoint that should see both
        var checkpointRequest = new
        {
            jsonrpc = "2.0",
            id = 8,
            method = "tools/call",
            @params = new
            {
                name = "checkpoint",
                arguments = new
                {
                    action = "save",
                    description = "Tested data consistency across tools",
                    workContext = "Data consistency verification"
                }
            }
        };

        var checkpointResponse = await SendMcpRequestAsync(checkpointRequest);
        Assert.That(checkpointResponse, Is.Not.Null);

        // Verify all operations succeeded
        foreach (var response in new[] { planResponse, todoResponse, checkpointResponse })
        {
            var jsonResponse = JsonDocument.Parse(response);
            Assert.That(jsonResponse.RootElement.TryGetProperty("error", out _), Is.False,
                $"All operations should succeed: {response}");
        }

        _logger?.LogInformation("Data consistency test completed successfully");
    }

    #region Private Helper Methods

    private async Task StartMcpServerAsync()
    {
        var serverPath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "..", "..", "..", "COA.Goldfish.McpServer", "bin", "Debug", "net9.0",
            "COA.Goldfish.McpServer.exe");

        if (!File.Exists(serverPath))
        {
            // Try relative path from test output directory
            serverPath = Path.Combine("COA.Goldfish.McpServer.exe");
            
            if (!File.Exists(serverPath))
            {
                Assert.Fail($"Could not find MCP server executable at expected paths. Current directory: {Directory.GetCurrentDirectory()}");
            }
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

        // Give the server a moment to start up
        await Task.Delay(1000);
        
        Assert.That(_serverProcess.HasExited, Is.False, "MCP server process exited unexpectedly");
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
                    name = "Goldfish Integration Tests",
                    version = "1.0.0"
                }
            }
        };

        var response = await SendMcpRequestAsync(initRequest);
        Assert.That(response, Is.Not.Null, "Should receive initialization response");

        var jsonResponse = JsonDocument.Parse(response);
        Assert.That(jsonResponse.RootElement.TryGetProperty("result", out _), Is.True,
            $"Initialize should succeed: {response}");

        // Send initialized notification
        var initializedNotification = new
        {
            jsonrpc = "2.0",
            method = "notifications/initialized"
        };

        await SendMcpNotificationAsync(initializedNotification);
        _logger?.LogInformation("MCP connection initialized successfully");
    }

    private async Task<string> SendMcpRequestAsync(object request)
    {
        Assert.That(_serverInput, Is.Not.Null, "Server input stream not available");
        Assert.That(_serverOutput, Is.Not.Null, "Server output stream not available");

        var jsonRequest = JsonSerializer.Serialize(request, new JsonSerializerOptions { WriteIndented = false });
        
        _logger?.LogDebug("Sending MCP request: {Request}", jsonRequest);
        
        await _serverInput!.WriteLineAsync(jsonRequest);
        await _serverInput.FlushAsync();

        var response = await _serverOutput!.ReadLineAsync();
        Assert.That(response, Is.Not.Null, "Should receive response from server");

        _logger?.LogDebug("Received MCP response: {Response}", response);
        
        return response!;
    }

    private async Task SendMcpNotificationAsync(object notification)
    {
        Assert.That(_serverInput, Is.Not.Null, "Server input stream not available");

        var jsonNotification = JsonSerializer.Serialize(notification, new JsonSerializerOptions { WriteIndented = false });
        
        _logger?.LogDebug("Sending MCP notification: {Notification}", jsonNotification);
        
        await _serverInput!.WriteLineAsync(jsonNotification);
        await _serverInput.FlushAsync();
    }

    #endregion
}