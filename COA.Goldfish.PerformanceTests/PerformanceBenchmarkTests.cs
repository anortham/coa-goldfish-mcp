using System.Diagnostics;
using System.Text;
using System.Text.Json;
using NUnit.Framework;

namespace COA.Goldfish.PerformanceTests;

/// <summary>
/// Performance benchmarks comparing .NET MCP server against real-world usage patterns
/// Tests actual MCP protocol performance - NOT mocked operations
/// </summary>
[TestFixture]
public class PerformanceBenchmarkTests
{
    private Process? _serverProcess;
    private StreamWriter? _serverInput;
    private StreamReader? _serverOutput;
    private string _tempWorkspace = string.Empty;
    private readonly string _serverPath = Path.Combine(
        Directory.GetCurrentDirectory(), 
        "..", "..", "..", 
        "COA.Goldfish.McpServer", "bin", "Debug", "net9.0", 
        "COA.Goldfish.McpServer.exe");
    private int _requestId = 1;

    [SetUp]
    public async Task Setup()
    {
        _tempWorkspace = Path.Combine(Path.GetTempPath(), $"goldfish-perf-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempWorkspace);
        
        // Build server first
        await BuildServerAsync();
        
        // Start MCP server
        await StartMcpServerAsync();
        
        // Initialize protocol
        await InitializeProtocolAsync();
    }

    [TearDown]
    public async Task TearDown()
    {
        try
        {
            _serverInput?.Close();
            _serverOutput?.Close();
            
            if (_serverProcess is { HasExited: false })
            {
                _serverProcess.Kill();
                await _serverProcess.WaitForExitAsync();
            }
            
            _serverProcess?.Dispose();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Cleanup warning: {ex.Message}");
        }
        
        // Apply SQLite connection leak fix from error handling tests
        await CleanupDatabaseConnectionsAsync();
        
        if (Directory.Exists(_tempWorkspace))
        {
            try 
            {
                Directory.Delete(_tempWorkspace, true);
            }
            catch 
            {
                // Best effort cleanup - may still be locked by database connections
            }
        }
    }

    /// <summary>
    /// Comprehensive database connection cleanup to prevent file handle leaks
    /// Based on successful pattern from ErrorHandlingIntegrationTests
    /// </summary>
    private static async Task CleanupDatabaseConnectionsAsync()
    {
        // Force garbage collection and clear SQLite connection pools
        GC.Collect();
        GC.WaitForPendingFinalizers();
        GC.Collect(); // Second collection to ensure finalizers have run
        
        // Clear SQLite connection pool explicitly
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        
        // Give time for any lingering connections to close
        await Task.Delay(200);
    }

    private async Task BuildServerAsync()
    {
        var buildProcess = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "dotnet",
                Arguments = "build --configuration Debug",
                WorkingDirectory = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "COA.Goldfish.McpServer"),
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false
            }
        };
        
        buildProcess.Start();
        await buildProcess.WaitForExitAsync();
        
        if (buildProcess.ExitCode != 0)
        {
            var error = await buildProcess.StandardError.ReadToEndAsync();
            throw new Exception($"Build failed: {error}");
        }
    }

    private async Task StartMcpServerAsync()
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _serverPath,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = _tempWorkspace
        };
        
        startInfo.Environment["GOLDFISH_WORKSPACE"] = _tempWorkspace;
        
        _serverProcess = Process.Start(startInfo) ?? throw new Exception("Failed to start server process");
        _serverInput = _serverProcess.StandardInput;
        _serverOutput = _serverProcess.StandardOutput;
        
        // Wait for server to start
        await Task.Delay(1000);
    }

    private async Task InitializeProtocolAsync()
    {
        // Send initialize request
        var initRequest = new
        {
            jsonrpc = "2.0",
            id = _requestId++,
            method = "initialize",
            @params = new
            {
                protocolVersion = "2024-11-05",
                capabilities = new { },
                clientInfo = new { name = "PerformanceTests", version = "1.0.0" }
            }
        };
        
        await SendRequestAsync(initRequest);
        var response = await ReadResponseAsync();
        
        if (!IsSuccessResponse(response))
        {
            throw new Exception($"Initialize failed: {response}");
        }
    }

    private async Task SendRequestAsync(object request)
    {
        var json = JsonSerializer.Serialize(request, new JsonSerializerOptions { WriteIndented = false });
        await _serverInput!.WriteLineAsync(json);
        await _serverInput.FlushAsync();
    }

    private async Task<string> ReadResponseAsync()
    {
        return await _serverOutput!.ReadLineAsync() ?? string.Empty;
    }

    private static bool IsSuccessResponse(string jsonResponse)
    {
        try
        {
            using var doc = JsonDocument.Parse(jsonResponse);
            return !doc.RootElement.TryGetProperty("error", out var error) || error.ValueKind == JsonValueKind.Null;
        }
        catch
        {
            return false;
        }
    }

    [Test, Explicit("Performance test - run manually only")]
    public async Task BenchmarkMemoryOperations_HighVolume()
    {
        Console.WriteLine("🔬 PERFORMANCE BENCHMARK: High-Volume Memory Operations");
        Console.WriteLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const int operationCount = 100; // Reduced for faster sequential testing
        var stopwatch = new Stopwatch();
        
        // Benchmark memory creation via MCP protocol (sequential for accurate MCP testing)
        stopwatch.Start();
        
        // MCP protocol is request-response over stdin/stdout, so operations must be sequential
        for (int i = 0; i < operationCount; i++)
        {
            await CreateMemoryAsync($"Performance test memory {i:D4} with realistic content length for benchmarking purposes");
        }
        stopwatch.Stop();
        
        var totalTime = stopwatch.ElapsedMilliseconds;
        var avgTime = totalTime / (double)operationCount;
        var throughput = operationCount / (totalTime / 1000.0);
        
        Console.WriteLine($"📊 Created {operationCount:N0} memories in {totalTime:N0}ms");
        Console.WriteLine($"⚡ Average: {avgTime:F2}ms per memory");
        Console.WriteLine($"🚀 Throughput: {throughput:F0} operations/second");
        
        // Performance assertion - should handle at least 10 ops/sec
        Assert.That(throughput, Is.GreaterThan(10), "Should achieve at least 10 memories/second");
        Assert.That(avgTime, Is.LessThan(500), "Average memory creation should be under 500ms");
        
        // Now benchmark recall performance
        stopwatch.Restart();
        
        var recallRequest = new
        {
            jsonrpc = "2.0",
            id = _requestId++,
            method = "tools/call",
            @params = new
            {
                name = "mcp__goldfish__recall",
                arguments = new { limit = operationCount }
            }
        };
        
        await SendRequestAsync(recallRequest);
        var recallResponse = await ReadResponseAsync();
        
        stopwatch.Stop();
        var recallTime = stopwatch.ElapsedMilliseconds;
        
        Console.WriteLine($"🔍 Recalled {operationCount:N0} memories in {recallTime:N0}ms");
        Console.WriteLine($"📈 Recall throughput: {operationCount / (recallTime / 1000.0):F0} items/second");
        
        Assert.That(IsSuccessResponse(recallResponse), "Recall should succeed");
        Assert.That(recallTime, Is.LessThan(5000), "Bulk recall should complete within 5 seconds");
    }

    private async Task CreateMemoryAsync(string content)
    {
        var request = new
        {
            jsonrpc = "2.0",
            id = _requestId++,
            method = "tools/call",
            @params = new
            {
                name = "mcp__goldfish__checkpoint",
                arguments = new 
                { 
                    action = "save",
                    description = content,
                    sessionId = "perf-test"
                }
            }
        };
        
        await SendRequestAsync(request);
        var response = await ReadResponseAsync();
        
        if (!IsSuccessResponse(response))
        {
            throw new Exception($"Memory creation failed: {response}");
        }
    }

    [Test, Explicit("Performance test - run manually only")]
    public async Task BenchmarkTodoListPerformance_LargeScale()
    {
        Console.WriteLine("🔬 PERFORMANCE BENCHMARK: Large-Scale TODO Operations");
        Console.WriteLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const int itemCount = 500;
        var stopwatch = new Stopwatch();
        
        // Create large TODO list
        var items = Enumerable.Range(1, itemCount)
            .Select(i => $"Performance test task {i:D4} - realistic task description")
            .ToArray();
        
        stopwatch.Start();
        
        var createRequest = new
        {
            jsonrpc = "2.0",
            id = _requestId++,
            method = "tools/call",
            @params = new
            {
                name = "mcp__goldfish__todo",
                arguments = new
                {
                    action = "create",
                    title = "Performance Test TODO List",
                    items = items
                }
            }
        };
        
        await SendRequestAsync(createRequest);
        var createResponse = await ReadResponseAsync();
        
        stopwatch.Stop();
        var createTime = stopwatch.ElapsedMilliseconds;
        
        Console.WriteLine($"📋 Created TODO with {itemCount:N0} items in {createTime:N0}ms");
        Console.WriteLine($"⚡ Creation rate: {itemCount / (createTime / 1000.0):F0} items/second");
        
        Assert.That(IsSuccessResponse(createResponse), "TODO creation should succeed");
        Assert.That(createTime, Is.LessThan(10000), "TODO creation should complete within 10 seconds");
        
        // Test viewing performance
        stopwatch.Restart();
        
        var viewRequest = new
        {
            jsonrpc = "2.0",
            id = _requestId++,
            method = "tools/call",
            @params = new
            {
                name = "mcp__goldfish__todo",
                arguments = new { action = "view", listId = "latest" }
            }
        };
        
        await SendRequestAsync(viewRequest);
        var viewResponse = await ReadResponseAsync();
        
        stopwatch.Stop();
        var viewTime = stopwatch.ElapsedMilliseconds;
        
        Console.WriteLine($"👀 Viewed {itemCount:N0} item list in {viewTime:N0}ms");
        Console.WriteLine($"📊 View throughput: {itemCount / (viewTime / 1000.0):F0} items/second");
        
        Assert.That(IsSuccessResponse(viewResponse), "TODO viewing should succeed");
        Assert.That(viewTime, Is.LessThan(2000), "TODO viewing should complete within 2 seconds");
    }

    [Test, Explicit("Performance test - run manually only")]
    public async Task BenchmarkMixedOperationThroughput()
    {
        Console.WriteLine("🔬 PERFORMANCE BENCHMARK: Mixed Operation Throughput");
        Console.WriteLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const int totalOps = 50;
        var stopwatch = new Stopwatch();
        
        stopwatch.Start();
        
        // Execute different operation types sequentially (proper MCP protocol)
        int operationCount = 0;
        
        // Memory operations
        for (int i = 0; i < totalOps / 2; i++)
        {
            await CreateMemoryAsync($"Mixed memory {i}");
            operationCount++;
        }
        
        // TODO operations  
        for (int i = 0; i < totalOps / 5; i++)
        {
            await CreateTodoAsync($"Mixed TODO {i}", new[] { $"Task {i}.1", $"Task {i}.2" });
            operationCount++;
        }
        
        // Recall operations
        for (int i = 0; i < totalOps / 10; i++)
        {
            await RecallAsync(10);
            operationCount++;
        }
        
        stopwatch.Stop();
        var totalTime = stopwatch.ElapsedMilliseconds;
        var actualOps = operationCount;
        var throughput = actualOps / (totalTime / 1000.0);
        
        Console.WriteLine($"⚡ Completed {actualOps} mixed operations in {totalTime:N0}ms");
        Console.WriteLine($"🚀 Sequential throughput: {throughput:F0} operations/second");
        
        Assert.That(totalTime, Is.LessThan(30000), "Mixed operations should complete within 30 seconds");
        Assert.That(throughput, Is.GreaterThan(5), "Should achieve at least 5 ops/second");
    }

    private async Task CreateTodoAsync(string title, string[] items)
    {
        var request = new
        {
            jsonrpc = "2.0",
            id = _requestId++,
            method = "tools/call",
            @params = new
            {
                name = "mcp__goldfish__todo",
                arguments = new
                {
                    action = "create",
                    title = title,
                    items = items
                }
            }
        };
        
        await SendRequestAsync(request);
        var response = await ReadResponseAsync();
        
        if (!IsSuccessResponse(response))
        {
            throw new Exception($"TODO creation failed: {response}");
        }
    }

    private async Task RecallAsync(int limit)
    {
        var request = new
        {
            jsonrpc = "2.0",
            id = _requestId++,
            method = "tools/call",
            @params = new
            {
                name = "mcp__goldfish__recall",
                arguments = new { limit = limit }
            }
        };
        
        await SendRequestAsync(request);
        var response = await ReadResponseAsync();
        
        if (!IsSuccessResponse(response))
        {
            throw new Exception($"Recall failed: {response}");
        }
    }

    [Test, Explicit("Performance test - run manually only")]
    public async Task BenchmarkStartupTime()
    {
        Console.WriteLine("🔬 PERFORMANCE BENCHMARK: Server Startup Time");
        Console.WriteLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        var measurements = new List<long>();
        
        // Tear down current server
        await TearDown();
        
        // Measure multiple cold starts
        for (int i = 0; i < 5; i++)
        {
            var tempWorkspace = Path.Combine(Path.GetTempPath(), $"startup-test-{Guid.NewGuid():N}");
            Directory.CreateDirectory(tempWorkspace);
            
            var stopwatch = Stopwatch.StartNew();
            
            // Start server
            var startInfo = new ProcessStartInfo
            {
                FileName = _serverPath,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = tempWorkspace
            };
            
            startInfo.Environment["GOLDFISH_WORKSPACE"] = tempWorkspace;
            
            var process = Process.Start(startInfo);
            var input = process!.StandardInput;
            var output = process.StandardOutput;
            
            // Test first operation (initialization + first request)
            var initRequest = new
            {
                jsonrpc = "2.0",
                id = 1,
                method = "initialize",
                @params = new
                {
                    protocolVersion = "2024-11-05",
                    capabilities = new { },
                    clientInfo = new { name = "StartupTest", version = "1.0.0" }
                }
            };
            
            var json = JsonSerializer.Serialize(initRequest);
            await input.WriteLineAsync(json);
            await input.FlushAsync();
            
            await output.ReadLineAsync(); // Read response
            
            stopwatch.Stop();
            measurements.Add(stopwatch.ElapsedMilliseconds);
            
            // Cleanup with database connection leak prevention
            input.Close();
            output.Close();
            process.Kill();
            await process.WaitForExitAsync();
            process.Dispose();
            
            // Apply database connection cleanup before deleting directory
            await CleanupDatabaseConnectionsAsync();
            
            Directory.Delete(tempWorkspace, true);
        }
        
        var avgStartup = measurements.Average();
        var minStartup = measurements.Min();
        var maxStartup = measurements.Max();
        
        Console.WriteLine($"⏱️  Average Startup: {avgStartup:F1}ms");
        Console.WriteLine($"🚀 Best Startup: {minStartup}ms");
        Console.WriteLine($"🐌 Worst Startup: {maxStartup}ms");
        Console.WriteLine($"📊 Consistency: ±{(maxStartup - minStartup) / 2.0:F1}ms variance");
        
        Assert.That(avgStartup, Is.LessThan(3000), "Average startup should be under 3 seconds");
        Assert.That(maxStartup, Is.LessThan(5000), "Worst-case startup should be under 5 seconds");
        
        // Restart our test server
        await Setup();
    }
}