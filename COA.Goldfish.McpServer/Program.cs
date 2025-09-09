using COA.Mcp.Framework.Server;
using COA.Mcp.Framework.TokenOptimization;
using COA.Mcp.Framework.TokenOptimization.Caching;
using COA.Mcp.Framework.TokenOptimization.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Services;
using COA.Goldfish.McpServer.Tools;
using COA.Goldfish.McpServer.Providers;
using Serilog;
using System.IO;
using System.Reflection;

namespace COA.Goldfish.McpServer;

public class Program
{
    /// <summary>
    /// Configure shared services used by the MCP server
    /// </summary>
    private static void ConfigureSharedServices(IServiceCollection services, IConfiguration configuration)
    {
        // Register configuration
        services.AddSingleton<IConfiguration>(configuration);

        // Register Memory Cache for query caching
        services.AddMemoryCache();
        
        // Entity Framework Core
        var connectionString = configuration.GetConnectionString("DefaultConnection") 
                               ?? configuration["Goldfish:Database:ConnectionString"]
                               ?? GetDefaultConnectionString();
        
        // Replace {BasePath} placeholder if present
        if (connectionString.Contains("{BasePath}"))
        {
            var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            var goldFishDir = Path.Combine(userProfile, ".coa", "goldfish");
            Directory.CreateDirectory(goldFishDir);
            connectionString = connectionString.Replace("{BasePath}", goldFishDir);
        }
        
        services.AddDbContext<GoldfishDbContext>(options =>
        {
            options.UseSqlite(connectionString);
            options.EnableSensitiveDataLogging(false);
            options.EnableServiceProviderCaching(true);
        });
        
        // Core Goldfish services
        services.AddScoped<IStorageService, StorageService>();
        services.AddScoped<DatabaseInitializer>();
        services.AddScoped<IPathResolutionService, PathResolutionService>();
        services.AddScoped<WorkspaceService>();
        services.AddScoped<SearchService>();
        services.AddScoped<SessionService>();
        services.AddScoped<SyncService>();
        services.AddScoped<WorkflowSuggestionService>();
        
        // Token Optimization services
        services.AddSingleton<ITokenEstimator, DefaultTokenEstimator>();
        
        // Configure cache eviction policy - LRU with 50MB limit for Goldfish
        services.AddSingleton<ICacheEvictionPolicy>(sp => 
            new LruEvictionPolicy(maxMemoryBytes: 50_000_000, targetMemoryUsageRatio: 0.8));
        
        // Register caching services with eviction policy
        services.AddSingleton<IResponseCacheService, ResponseCacheService>();
        services.AddSingleton<IResourceStorageService, ResourceStorageService>();
        services.AddSingleton<ICacheKeyGenerator, CacheKeyGenerator>();
        
        // HTTP client for sync service
        services.AddHttpClient<SyncService>();
        
        // Behavioral adoption template services
        services.AddSingleton<TemplateProvider>();
        services.AddScoped<GoldfishResourceProvider>();
        services.AddScoped<ToolPriorityService>();
        services.AddScoped<WorkflowEnforcementService>();
    }
    
    /// <summary>
    /// Get default SQLite connection string with user profile location
    /// </summary>
    private static string GetDefaultConnectionString()
    {
        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var goldFishDir = Path.Combine(userProfile, ".coa", "goldfish");
        Directory.CreateDirectory(goldFishDir);
        var dbPath = Path.Combine(goldFishDir, "goldfish.db");
        return $"Data Source={dbPath}";
    }

    /// <summary>
    /// Configure Serilog with file logging only (no console to avoid breaking STDIO)
    /// </summary>
    private static void ConfigureSerilog(IConfiguration configuration, string[]? args = null)
    {
        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var logsPath = Path.Combine(userProfile, ".coa", "goldfish", "logs");
        Directory.CreateDirectory(logsPath);
        
        var logFile = Path.Combine(logsPath, "goldfish-.log");
        
        // Determine process mode for logging context
        var processMode = "STDIO";
        if (args?.Contains("--mode") == true && args?.Contains("http") == true)
        {
            processMode = "HTTP";
        }
        else if (args?.Contains("--service") == true)
        {
            processMode = "SERVICE";
        }

        Log.Logger = new LoggerConfiguration()
            .ReadFrom.Configuration(configuration)
            .Enrich.WithProperty("ProcessMode", processMode)
            .WriteTo.File(
                logFile,
                rollingInterval: RollingInterval.Day,
                rollOnFileSizeLimit: true,
                fileSizeLimitBytes: 10 * 1024 * 1024, // 10MB
                retainedFileCountLimit: 7, // Keep 7 days of logs
                shared: true, // Allow multiple processes to write to same file
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] [{ProcessMode}] {SourceContext} {Message:lj}{NewLine}{Exception}"
            )
            .CreateLogger();
    }

    public static async Task Main(string[] args)
    {
        // Load configuration early for logging setup
        var configuration = new ConfigurationBuilder()
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddEnvironmentVariables()
            .Build();

        // Configure Serilog early - FILE ONLY (no console to avoid breaking STDIO)
        ConfigureSerilog(configuration, args);

        try
        {
            Log.Information("Starting Goldfish MCP Server");
            
            // Use framework's builder
            var builder = new McpServerBuilder()
                .WithServerInfo("Goldfish", "1.0.0")
                .ConfigureLogging(logging =>
                {
                    logging.ClearProviders();
                    logging.AddSerilog(); // Use Serilog for all logging
                });

            // Configure shared services
            ConfigureSharedServices(builder.Services, configuration);
            
            // Register tools in DI first (required for constructor dependencies)
            builder.Services.AddScoped<CheckpointTool>();
            builder.Services.AddScoped<TodoTool>();
            builder.Services.AddScoped<PlanTool>();
            builder.Services.AddScoped<RecallTool>();
            builder.Services.AddScoped<ChronicleTool>();
            builder.Services.AddScoped<StandupTool>();
            builder.Services.AddScoped<WorkspaceTool>();

            // Discover and register all tools from assembly
            builder.DiscoverTools(typeof(Program).Assembly);

            // Configure behavioral adoption using Framework features
            var templateVariables = new COA.Mcp.Framework.Services.TemplateVariables
            {
                AvailableTools = new[] { "checkpoint", "todo", "plan", "recall", "chronicle", "standup", "workspace" },
                ToolPriorities = new Dictionary<string, int>
                {
                    {"checkpoint", 100},
                    {"todo", 95}, 
                    {"plan", 90},
                    {"standup", 85},
                    {"recall", 80},
                    {"chronicle", 75},
                    {"workspace", 70}
                },
                EnforcementLevel = COA.Mcp.Framework.Configuration.WorkflowEnforcement.StronglyUrge,
                ToolComparisons = new Dictionary<string, COA.Mcp.Framework.Configuration.ToolComparison>
                {
                    ["Session management"] = new COA.Mcp.Framework.Configuration.ToolComparison
                    {
                        Task = "Session management",
                        ServerTool = "mcp__goldfish__checkpoint",
                        Advantage = "SQLite-backed session state with automatic workspace detection",
                        BuiltInTool = "Manual note-taking",
                        Limitation = "No persistent state, session context lost between conversations",
                        PerformanceMetric = "Persistent state vs ephemeral sessions"
                    },
                    ["Task tracking"] = new COA.Mcp.Framework.Configuration.ToolComparison
                    {
                        Task = "Task tracking", 
                        ServerTool = "mcp__goldfish__todo",
                        Advantage = "Smart TODO management with active list concept and keyword resolution",
                        BuiltInTool = "Manual task lists",
                        Limitation = "No persistence, no progress tracking, easy to lose tasks",
                        PerformanceMetric = "Structured task management vs ad-hoc notes"
                    },
                    ["Strategic planning"] = new COA.Mcp.Framework.Configuration.ToolComparison
                    {
                        Task = "Strategic planning",
                        ServerTool = "mcp__goldfish__plan", 
                        Advantage = "Comprehensive planning with discovery accumulation and automatic TODO generation",
                        BuiltInTool = "Conversation notes",
                        Limitation = "No structured planning, no progress tracking, plans get lost",
                        PerformanceMetric = "Structured planning workflow vs informal discussions"
                    },
                    ["Systematic development workflow"] = new COA.Mcp.Framework.Configuration.ToolComparison
                    {
                        Task = "Systematic development workflow",
                        ServerTool = "checkpoint + plan + todo workflow",
                        Advantage = "Structured, recoverable development with persistent state",
                        BuiltInTool = "Ad-hoc development",
                        Limitation = "No persistence, no structure, work gets lost",
                        PerformanceMetric = "Recoverable workflows vs starting from scratch after crashes"
                    },
                    ["Complex feature development"] = new COA.Mcp.Framework.Configuration.ToolComparison
                    {
                        Task = "Complex feature development",
                        ServerTool = "plan → todo → checkpoint cycle",
                        Advantage = "Strategic planning breaks complexity into manageable pieces",
                        BuiltInTool = "Diving straight into code",
                        Limitation = "No structure, easy to get lost, missing requirements",
                        PerformanceMetric = "Structured completion vs chaotic development"
                    },
                    ["Cross-session continuity"] = new COA.Mcp.Framework.Configuration.ToolComparison
                    {
                        Task = "Maintaining context across sessions",
                        ServerTool = "checkpoint + recall workflow",
                        Advantage = "Perfect memory of what was working on and why",
                        BuiltInTool = "Starting fresh each session",
                        Limitation = "Lost context, repeated questions, forgotten decisions",
                        PerformanceMetric = "Instant context restoration vs 15+ minutes orientation"
                    }
                },
                CustomVariables = new Dictionary<string, object>
                {
                    ["has_tool"] = true,
                    ["enforcement_level"] = "strongly_urge",
                    ["behavioral_adoption"] = true,
                    ["database_backend"] = "SQLite with Entity Framework Core"
                }
            };
            
            // Load comprehensive behavioral methodology template
            string templateContent;
            var assembly = typeof(Program).Assembly;
            var resourceName = "COA.Goldfish.McpServer.Templates.goldfish-methodology.scriban";
            
            Log.Information("Loading comprehensive behavioral adoption template: {ResourceName}", resourceName);
            
            using (var stream = assembly.GetManifestResourceStream(resourceName))
            {
                if (stream == null)
                {
                    Log.Error("Critical: Comprehensive behavioral adoption template not found: {ResourceName}", resourceName);
                    throw new InvalidOperationException($"Required template resource not found: {resourceName}");
                }
                
                using (var reader = new StreamReader(stream))
                {
                    templateContent = await reader.ReadToEndAsync();
                    Log.Information("Loaded comprehensive behavioral adoption template ({Length} chars)", templateContent.Length);
                }
            }
            
            // Configure template instructions
            builder.WithTemplateInstructions(options =>
            {
                options.EnableTemplateInstructions = true;
                options.CustomTemplate = templateContent;
                options.TemplateContext = "goldfish";
                
                options.CustomTemplateVariables = new Dictionary<string, object>
                {
                    ["available_tools"] = templateVariables.AvailableTools,
                    ["tool_priorities"] = templateVariables.ToolPriorities,
                    ["enforcement_level"] = templateVariables.EnforcementLevel.ToString().ToLower(),
                    ["tool_comparisons"] = templateVariables.ToolComparisons.Values.ToList(),
                    ["has_tool"] = true
                };
            });

            // Use STDIO transport with proper stdin/stdout streams for MCP protocol compliance
            // This prevents stream concurrency issues by using raw streams instead of Console.In/Out
            builder.UseStdioTransport(options =>
            {
                options.Input = new StreamReader(Console.OpenStandardInput());
                options.Output = new StreamWriter(Console.OpenStandardOutput()) { AutoFlush = true };
            });
            
            // Ensure database is initialized
            using (var scope = builder.Services.BuildServiceProvider().CreateScope())
            {
                var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
                await initializer.InitializeAsync();
                Log.Information("Database initialized successfully");
            }
            
            await builder.RunAsync();
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "Goldfish startup failed");
            throw;
        }
        finally
        {
            Log.CloseAndFlush();
        }
    }
}