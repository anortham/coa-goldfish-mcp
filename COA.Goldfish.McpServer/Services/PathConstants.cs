namespace COA.Goldfish.McpServer.Services;

/// <summary>
/// Centralized constants for all path-related operations
/// </summary>
public static class PathConstants
{
    // Root directory names
    public const string BaseDirectoryName = ".coa";
    public const string GoldfishDirectoryName = "goldfish";
    
    // File names
    public const string WorkspaceMetadataFileName = "workspace_metadata.json";
    
    // Configuration keys
    public const string BasePathConfigKey = "Goldfish:BasePath";
    
    // Default paths
    public static readonly string DefaultBasePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), BaseDirectoryName, GoldfishDirectoryName);
    
    // Hash settings
    public const int WorkspaceHashLength = 8;
    public const int MaxSafeWorkspaceName = 30;
}