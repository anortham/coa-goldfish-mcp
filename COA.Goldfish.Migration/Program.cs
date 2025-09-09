using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using COA.Goldfish.Migration;

namespace COA.Goldfish.Migration;

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("=== Goldfish Data Migration Tool ===");
        Console.WriteLine();

        // Get source and destination paths
        var jsonDataPath = args.Length > 0 ? args[0] : @"C:\Users\CHS300372\.coa\goldfish";
        var sqliteConnectionString = args.Length > 1 ? args[1] : GetDefaultConnectionString();

        Console.WriteLine($"Source JSON Path: {jsonDataPath}");
        Console.WriteLine($"SQLite Connection: {sqliteConnectionString}");
        Console.WriteLine();

        // Setup logging
        using var host = Host.CreateDefaultBuilder()
            .ConfigureServices(services =>
            {
                services.AddLogging(logging =>
                {
                    logging.AddConsole();
                    logging.SetMinimumLevel(LogLevel.Information);
                });
            })
            .Build();

        var logger = host.Services.GetRequiredService<ILogger<JsonToSqliteMigrator>>();

        // Create and run migrator
        var migrator = new JsonToSqliteMigrator(logger, jsonDataPath, sqliteConnectionString);

        try
        {
            Console.WriteLine("Starting migration...");
            var result = await migrator.MigrateAllAsync();

            if (result.Success)
            {
                Console.WriteLine();
                Console.WriteLine("✅ Migration completed successfully!");
                Console.WriteLine($"Duration: {result.Duration}");
                Console.WriteLine($"Checkpoints migrated: {result.CheckpointsMigrated}");
                Console.WriteLine($"TODO lists migrated: {result.TodoListsMigrated}");
                Console.WriteLine($"Plans migrated: {result.PlansMigrated}");
                Console.WriteLine($"Memories migrated: {result.MemoriesMigrated}");
                Console.WriteLine($"Workspaces created: {result.WorkspacesMigrated}");
                
                if (result.ValidationErrors.Count > 0)
                {
                    Console.WriteLine();
                    Console.WriteLine("⚠️  Validation warnings:");
                    foreach (var error in result.ValidationErrors)
                    {
                        Console.WriteLine($"  - {error}");
                    }
                }
            }
            else
            {
                Console.WriteLine();
                Console.WriteLine("❌ Migration failed!");
                Console.WriteLine($"Error: {result.ErrorMessage}");
                Environment.Exit(1);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine();
            Console.WriteLine("❌ Migration failed with exception!");
            Console.WriteLine($"Error: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            Environment.Exit(1);
        }

        Console.WriteLine();
        Console.WriteLine("Migration complete.");
    }

    private static string GetDefaultConnectionString()
    {
        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var goldFishDir = Path.Combine(userProfile, ".coa", "goldfish");
        var dbPath = Path.Combine(goldFishDir, "goldfish.db");
        return $"Data Source={dbPath}";
    }
}