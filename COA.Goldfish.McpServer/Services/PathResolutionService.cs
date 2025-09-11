using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Services;

/// <summary>
/// Path resolution service for Goldfish directory operations
/// Uses current directory as primary workspace with proper normalization
/// </summary>
public class PathResolutionService : IPathResolutionService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<PathResolutionService> _logger;
    private readonly string _primaryWorkspacePath;
    
    public PathResolutionService(IConfiguration configuration, ILogger<PathResolutionService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _primaryWorkspacePath = InitializePrimaryWorkspace();
    }
    
    private string InitializePrimaryWorkspace()
    {
        // First check if explicitly configured
        var configuredWorkspace = _configuration["Goldfish:PrimaryWorkspace"];
        
        if (!string.IsNullOrWhiteSpace(configuredWorkspace))
        {
            try
            {
                var fullPath = Path.GetFullPath(configuredWorkspace);
                _logger.LogInformation("Using configured primary workspace: {Workspace}", fullPath);
                return fullPath;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to resolve configured primary workspace: {Workspace}", configuredWorkspace);
            }
        }
        
        // Smart workspace detection: use current directory
        var currentDir = Environment.CurrentDirectory;
        _logger.LogInformation("Using current directory as primary workspace: {Workspace}", currentDir);
        return currentDir;
    }
    
    public string GetBasePath()
    {
        // Return the .coa/goldfish directory in the primary workspace
        return Path.Combine(_primaryWorkspacePath, PathConstants.BaseDirectoryName, PathConstants.GoldfishDirectoryName);
    }
    
    public string GetPrimaryWorkspacePath()
    {
        return _primaryWorkspacePath;
    }
    
    public string ComputeWorkspaceHash(string workspacePath)
    {
        // Normalize path for consistent hashing - use safe wrapper
        var fullPath = GetFullPath(workspacePath);
        var normalizedPath = fullPath
            .Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            .ToLowerInvariant();
        
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(normalizedPath));
        var hashString = BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();
        
        // Return truncated hash for directory name
        return hashString.Substring(0, PathConstants.WorkspaceHashLength);
    }
    
    public string GetWorkspaceName(string workspacePath)
    {
        // Get the safe workspace name for database storage
        var workspaceName = GetSafeWorkspaceName(workspacePath);
        return workspaceName;
    }
    
    private string GetSafeWorkspaceName(string workspacePath)
    {
        // Get the last directory name from the path - use safe wrappers
        var fullPath = GetFullPath(workspacePath);
        var workspaceName = GetFileName(fullPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        
        // If empty (e.g., root drive), use "root"
        if (string.IsNullOrWhiteSpace(workspaceName))
        {
            workspaceName = "root";
        }
        
        // Match original TypeScript normalization: replace(/[^a-z0-9]/g, '-')
        var normalizedChars = new char[workspaceName.Length];
        for (int i = 0; i < workspaceName.Length; i++)
        {
            var c = char.ToLowerInvariant(workspaceName[i]);
            normalizedChars[i] = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ? c : '-';
        }
        workspaceName = new string(normalizedChars);
        
        // Truncate if too long (leave room for hash and underscore)
        if (workspaceName.Length > PathConstants.MaxSafeWorkspaceName)
        {
            workspaceName = workspaceName.Substring(0, PathConstants.MaxSafeWorkspaceName);
        }
        
        // Already lowercased above, just return
        return workspaceName;
    }
    
    public void EnsureDirectoryExists(string path)
    {
        if (!Directory.Exists(path))
        {
            Directory.CreateDirectory(path);
        }
    }
    
    // Safe file system operations implementation
    
    public bool DirectoryExists(string path)
    {
        return ExecuteExistenceCheck(nameof(DirectoryExists), path, () => Directory.Exists(path));
    }
    
    public bool FileExists(string path)
    {
        return ExecuteExistenceCheck(nameof(FileExists), path, () => File.Exists(path));
    }
    
    public string GetFullPath(string path)
    {
        return ExecutePathOperation(nameof(GetFullPath), path, () => Path.GetFullPath(path), path);
    }
    
    public string GetFileName(string path)
    {
        return ExecutePathOperation(nameof(GetFileName), path, () => Path.GetFileName(path) ?? string.Empty, string.Empty);
    }
    
    // Error handling helper methods
    
    /// <summary>
    /// Executes a file system existence check safely, returning a boolean result with consistent error handling
    /// </summary>
    private bool ExecuteExistenceCheck(string operationName, string path, Func<bool> operation)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            _logger.LogWarning("{Operation} called with null or empty path", operationName);
            return false;
        }

        try
        {
            return operation();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to {Operation} for path: {Path}", operationName.ToLowerInvariant(), path);
            return false;
        }
    }
    
    /// <summary>
    /// Executes a path manipulation operation safely, returning string result with consistent error handling
    /// </summary>
    private string ExecutePathOperation(string operationName, string path, Func<string> operation, string fallbackValue)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            _logger.LogWarning("{Operation} called with null or empty path", operationName);
            return fallbackValue;
        }

        try
        {
            return operation() ?? fallbackValue;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to {Operation} for path: {Path}", operationName.ToLowerInvariant(), path);
            return fallbackValue;
        }
    }
}