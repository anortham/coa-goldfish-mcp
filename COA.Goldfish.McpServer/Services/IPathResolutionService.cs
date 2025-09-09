namespace COA.Goldfish.McpServer.Services;

/// <summary>
/// Provides centralized path resolution for all Goldfish directory operations
/// </summary>
public interface IPathResolutionService
{
    /// <summary>
    /// Gets the base Goldfish directory path (e.g., "~/.coa/goldfish")
    /// </summary>
    string GetBasePath();
    
    /// <summary>
    /// Gets the primary workspace path (configured or current directory)
    /// </summary>
    /// <returns>The primary workspace path</returns>
    string GetPrimaryWorkspacePath();
    
    /// <summary>
    /// Computes a hash for the workspace path to use as directory name
    /// </summary>
    /// <param name="workspacePath">The workspace path to hash</param>
    /// <returns>8-character hash string</returns>
    string ComputeWorkspaceHash(string workspacePath);
    
    /// <summary>
    /// Ensures a directory exists, creating it if necessary
    /// </summary>
    /// <param name="path">The directory path to ensure exists</param>
    void EnsureDirectoryExists(string path);
    
    // Safe file system operations
    
    /// <summary>
    /// Safely checks if a directory exists
    /// </summary>
    /// <param name="path">The directory path to check</param>
    /// <returns>True if the directory exists, false otherwise</returns>
    bool DirectoryExists(string path);
    
    /// <summary>
    /// Safely checks if a file exists
    /// </summary>
    /// <param name="path">The file path to check</param>
    /// <returns>True if the file exists, false otherwise</returns>
    bool FileExists(string path);
    
    /// <summary>
    /// Safely gets the full path of a file or directory
    /// </summary>
    /// <param name="path">The path to normalize</param>
    /// <returns>The full path, or the original path if normalization fails</returns>
    string GetFullPath(string path);
    
    /// <summary>
    /// Safely gets the file name from a path
    /// </summary>
    /// <param name="path">The path to extract the filename from</param>
    /// <returns>The filename, or empty string if extraction fails</returns>
    string GetFileName(string path);
    
    /// <summary>
    /// Gets the workspace name from a workspace path
    /// </summary>
    /// <param name="workspacePath">The workspace path</param>
    /// <returns>The workspace name for database storage</returns>
    string GetWorkspaceName(string workspacePath);
}