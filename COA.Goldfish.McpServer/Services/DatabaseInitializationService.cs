using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using COA.Goldfish.McpServer.Services.Storage;

namespace COA.Goldfish.McpServer.Services;

/// <summary>
/// Hosted service to handle database initialization on startup
/// </summary>
public class DatabaseInitializationService : IHostedService
{
    private readonly DatabaseInitializer _databaseInitializer;
    private readonly ILogger<DatabaseInitializationService> _logger;

    public DatabaseInitializationService(
        DatabaseInitializer databaseInitializer,
        ILogger<DatabaseInitializationService> logger)
    {
        _databaseInitializer = databaseInitializer;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _databaseInitializer.InitializeAsync();
            _logger.LogInformation("Database initialized successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize database");
            throw;
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}