using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Services.Storage;

/// <summary>
/// Service for initializing the database and ensuring schema exists
/// </summary>
public class DatabaseInitializer
{
    private readonly GoldfishDbContext _context;
    private readonly ILogger<DatabaseInitializer> _logger;

    public DatabaseInitializer(GoldfishDbContext context, ILogger<DatabaseInitializer> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Initialize the database, creating tables if they don't exist
    /// </summary>
    public async Task InitializeAsync()
    {
        try
        {
            // Ensure database is created (this will create the file if using SQLite)
            await _context.Database.EnsureCreatedAsync();
            _logger.LogInformation("Database initialization completed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database initialization failed");
            throw;
        }
    }

    /// <summary>
    /// Check if the database exists and has the required tables
    /// </summary>
    public async Task<bool> IsDatabaseInitializedAsync()
    {
        try
        {
            // Try to query a simple table to verify schema exists
            await _context.WorkspaceStates.FirstOrDefaultAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }
}