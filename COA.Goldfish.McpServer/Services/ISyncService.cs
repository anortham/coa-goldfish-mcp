namespace COA.Goldfish.McpServer.Services;

/// <summary>
/// Interface for synchronizing Goldfish data with external APIs
/// </summary>
public interface ISyncService
{
    /// <summary>
    /// Check if sync is enabled and configured
    /// </summary>
    bool IsEnabled { get; }

    /// <summary>
    /// Get current sync status
    /// </summary>
    Task<SyncStatus> GetStatusAsync();

    /// <summary>
    /// Sync all data for a workspace
    /// </summary>
    Task<SyncResult> SyncWorkspaceAsync(string workspaceId, SyncOptions? options = null);

    /// <summary>
    /// Sync specific entity types
    /// </summary>
    Task<SyncResult> SyncEntitiesAsync(string workspaceId, SyncEntityType entityTypes, SyncOptions? options = null);

    /// <summary>
    /// Queue data for offline sync when connection is restored
    /// </summary>
    Task QueueForSyncAsync(string workspaceId, SyncEntityType entityType, string entityId, SyncOperation operation);

    /// <summary>
    /// Process queued sync operations
    /// </summary>
    Task<SyncResult> ProcessQueueAsync();

    /// <summary>
    /// Configure sync settings
    /// </summary>
    Task ConfigureAsync(SyncConfiguration configuration);

    /// <summary>
    /// Test connection to sync endpoint
    /// </summary>
    Task<bool> TestConnectionAsync();

    /// <summary>
    /// Force a full resync of all data
    /// </summary>
    Task<SyncResult> ForceResyncAsync(string workspaceId);

    /// <summary>
    /// Get sync conflict resolution options
    /// </summary>
    Task<List<SyncConflict>> GetConflictsAsync(string workspaceId);

    /// <summary>
    /// Resolve sync conflicts
    /// </summary>
    Task<SyncResult> ResolveConflictsAsync(List<SyncConflictResolution> resolutions);
}

/// <summary>
/// Current sync status information
/// </summary>
public class SyncStatus
{
    public bool IsConnected { get; set; }
    public DateTime? LastSyncTime { get; set; }
    public int QueuedOperations { get; set; }
    public int PendingConflicts { get; set; }
    public string? LastError { get; set; }
    public SyncConfiguration? Configuration { get; set; }
}

/// <summary>
/// Result of sync operations
/// </summary>
public class SyncResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public int EntitiesSynced { get; set; }
    public int ConflictsDetected { get; set; }
    public TimeSpan Duration { get; set; }
    public List<SyncConflict> Conflicts { get; set; } = new();
}

/// <summary>
/// Sync configuration settings
/// </summary>
public class SyncConfiguration
{
    public string? ApiEndpoint { get; set; }
    public string? AuthenticationToken { get; set; }
    public string? AuthenticationType { get; set; } = "Bearer";
    public TimeSpan SyncInterval { get; set; } = TimeSpan.FromMinutes(15);
    public bool EnableOfflineQueue { get; set; } = true;
    public bool AutoResolveConflicts { get; set; } = false;
    public ConflictResolutionStrategy DefaultConflictResolution { get; set; } = ConflictResolutionStrategy.ServerWins;
    public int MaxRetries { get; set; } = 3;
    public TimeSpan RetryDelay { get; set; } = TimeSpan.FromSeconds(30);
}

/// <summary>
/// Options for sync operations
/// </summary>
public class SyncOptions
{
    public bool ForceSync { get; set; } = false;
    public bool SkipConflictCheck { get; set; } = false;
    public SyncDirection Direction { get; set; } = SyncDirection.Bidirectional;
    public DateTime? SyncSince { get; set; }
}

/// <summary>
/// Sync conflict information
/// </summary>
public class SyncConflict
{
    public string Id { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string WorkspaceId { get; set; } = string.Empty;
    public string LocalValue { get; set; } = string.Empty;
    public string ServerValue { get; set; } = string.Empty;
    public DateTime LocalModified { get; set; }
    public DateTime ServerModified { get; set; }
    public SyncConflictType ConflictType { get; set; }
}

/// <summary>
/// Sync conflict resolution
/// </summary>
public class SyncConflictResolution
{
    public string ConflictId { get; set; } = string.Empty;
    public ConflictResolutionStrategy Resolution { get; set; }
    public string? CustomValue { get; set; }
}

/// <summary>
/// Types of entities that can be synced
/// </summary>
[Flags]
public enum SyncEntityType
{
    None = 0,
    Checkpoints = 1,
    TodoLists = 2,
    Plans = 4,
    ChronicleEntries = 8,
    WorkspaceStates = 16,
    All = Checkpoints | TodoLists | Plans | ChronicleEntries | WorkspaceStates
}

/// <summary>
/// Sync operations
/// </summary>
public enum SyncOperation
{
    Create,
    Update,
    Delete
}

/// <summary>
/// Sync directions
/// </summary>
public enum SyncDirection
{
    Upload,
    Download,
    Bidirectional
}

/// <summary>
/// Types of sync conflicts
/// </summary>
public enum SyncConflictType
{
    ModifiedBoth,
    DeletedLocal,
    DeletedServer,
    CreatedBoth
}

/// <summary>
/// Conflict resolution strategies
/// </summary>
public enum ConflictResolutionStrategy
{
    LocalWins,
    ServerWins,
    Merge,
    Custom,
    Skip
}