using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using COA.Goldfish.McpServer.Services;

namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Unit tests for workspace detection logic
/// Tests PathResolutionService and WorkspaceService to ensure reliable workspace detection
/// </summary>
[TestFixture]
public class WorkspaceDetectionTests
{
    private IConfiguration _config;
    private PathResolutionService _pathResolution;
    private WorkspaceService _workspaceService;

    [SetUp]
    public void Setup()
    {
        // Create minimal config
        var configData = new Dictionary<string, string>();
        _config = new ConfigurationBuilder()
            .AddInMemoryCollection(configData!)
            .Build();
        
        _pathResolution = new PathResolutionService(_config, NullLogger<PathResolutionService>.Instance);
        _workspaceService = new WorkspaceService(NullLogger<WorkspaceService>.Instance, _pathResolution);
    }

    [Test]
    public void GetWorkspaceName_ValidPath_ReturnsNormalizedName()
    {
        // Arrange
        var testPath = @"C:\source\COA Goldfish MCP";
        
        // Act
        var workspaceName = _pathResolution.GetWorkspaceName(testPath);
        
        // Assert
        Assert.That(workspaceName, Is.EqualTo("coa-goldfish-mcp"));
    }

    [Test]
    public void GetWorkspaceName_PathWithSpaces_ReplacesWithDashes()
    {
        // Arrange
        var testPath = @"C:\source\My Project Name";
        
        // Act
        var workspaceName = _pathResolution.GetWorkspaceName(testPath);
        
        // Assert
        Assert.That(workspaceName, Is.EqualTo("my-project-name"));
    }

    [Test]
    public void GetWorkspaceName_PathWithDots_ReplacesWithDashes()
    {
        // Arrange
        var testPath = @"C:\source\App.Web.Client";
        
        // Act
        var workspaceName = _pathResolution.GetWorkspaceName(testPath);
        
        // Assert
        Assert.That(workspaceName, Is.EqualTo("app-web-client"));
    }

    [Test]
    public void GetWorkspaceName_PathWithSpecialChars_NormalizesToDashes()
    {
        // Arrange
        var testPath = @"C:\source\My@Project#Name$Test";
        
        // Act
        var workspaceName = _pathResolution.GetWorkspaceName(testPath);
        
        // Assert
        Assert.That(workspaceName, Is.EqualTo("my-project-name-test"));
    }

    [Test]
    public void GetWorkspaceName_PathWithNumbers_PreservesNumbers()
    {
        // Arrange
        var testPath = @"C:\source\Project123Version2";
        
        // Act
        var workspaceName = _pathResolution.GetWorkspaceName(testPath);
        
        // Assert
        Assert.That(workspaceName, Is.EqualTo("project123version2"));
    }

    [Test]
    public void GetWorkspaceName_MixedCase_ConvertsToLowercase()
    {
        // Arrange
        var testPath = @"C:\source\MyProjectNAME";
        
        // Act
        var workspaceName = _pathResolution.GetWorkspaceName(testPath);
        
        // Assert
        Assert.That(workspaceName, Is.EqualTo("myprojectname"));
    }

    [Test]
    public void GetWorkspaceName_VeryLongPath_TruncatesCorrectly()
    {
        // Arrange - create a path longer than MaxSafeWorkspaceName (30)
        var longName = new string('a', 50);
        var testPath = $@"C:\source\{longName}";
        
        // Act
        var workspaceName = _pathResolution.GetWorkspaceName(testPath);
        
        // Assert
        Assert.That(workspaceName.Length, Is.LessThanOrEqualTo(30));
        Assert.That(workspaceName, Is.EqualTo(new string('a', 30)));
    }

    [Test]
    public void GetWorkspaceName_EmptyDirectoryName_ReturnsRoot()
    {
        // Arrange - simulate root drive scenario
        var testPath = @"C:\";
        
        // Act
        var workspaceName = _pathResolution.GetWorkspaceName(testPath);
        
        // Assert
        Assert.That(workspaceName, Is.EqualTo("root"));
    }

    [Test]
    public void GetCurrentWorkspace_DefaultConfig_ReturnsNormalizedDirectoryName()
    {
        // Act
        var workspace = _workspaceService.GetCurrentWorkspace();
        
        // Assert
        Assert.That(workspace, Is.Not.Null);
        Assert.That(workspace, Is.Not.Empty);
        // Should be the current directory normalized
        Assert.That(workspace, Does.Match(@"^[a-z0-9-]+$"));
    }

    [Test]
    public void ResolveWorkspaceId_WithExplicitWorkspace_ReturnsExact()
    {
        // Arrange
        var explicitWorkspace = "my-custom-workspace";
        
        // Act
        var resolved = _workspaceService.ResolveWorkspaceId(explicitWorkspace);
        
        // Assert
        Assert.That(resolved, Is.EqualTo(explicitWorkspace));
    }

    [Test]
    public void ResolveWorkspaceId_WithNull_ReturnsDetectedWorkspace()
    {
        // Act
        var resolved = _workspaceService.ResolveWorkspaceId(null);
        
        // Assert
        Assert.That(resolved, Is.Not.Null);
        Assert.That(resolved, Is.Not.Empty);
        Assert.That(resolved, Does.Match(@"^[a-z0-9-]+$"));
    }

    [Test]
    public void ResolveWorkspaceId_WithGlobalKeyword_ReturnsGlobalWorkspace()
    {
        // Act
        var resolved = _workspaceService.ResolveWorkspaceId("global");
        
        // Assert
        Assert.That(resolved, Is.EqualTo("__global__"));
    }

    [Test]
    public void GetWorkspaceDisplayName_WithGlobal_ReturnsReadableName()
    {
        // Act
        var displayName = _workspaceService.GetWorkspaceDisplayName("__global__");
        
        // Assert
        Assert.That(displayName, Is.EqualTo("Global (Cross-Project)"));
    }

    [Test]
    public void GetWorkspaceDisplayName_WithDefault_ReturnsReadableName()
    {
        // Act
        var displayName = _workspaceService.GetWorkspaceDisplayName("default");
        
        // Assert
        Assert.That(displayName, Is.EqualTo("Default Workspace"));
    }

    [Test]
    public void GetWorkspaceDisplayName_WithCustom_ReturnsAsIs()
    {
        // Arrange
        var customWorkspace = "my-project";
        
        // Act
        var displayName = _workspaceService.GetWorkspaceDisplayName(customWorkspace);
        
        // Assert
        Assert.That(displayName, Is.EqualTo(customWorkspace));
    }

    [Test]
    public void WorkspaceDetection_IsConsistent()
    {
        // Act - call multiple times
        var workspace1 = _workspaceService.GetCurrentWorkspace();
        var workspace2 = _workspaceService.GetCurrentWorkspace();
        var workspace3 = _workspaceService.GetCurrentWorkspace();
        
        // Assert - should always return the same value
        Assert.That(workspace1, Is.EqualTo(workspace2));
        Assert.That(workspace2, Is.EqualTo(workspace3));
    }

    [Test]
    public void PathResolution_GetPrimaryWorkspacePath_ReturnsCurrentDirectory()
    {
        // Act
        var primaryPath = _pathResolution.GetPrimaryWorkspacePath();
        
        // Assert
        Assert.That(primaryPath, Is.EqualTo(Environment.CurrentDirectory));
    }

    [Test]
    public void PathResolution_GetBasePath_ContainsGoldfishDirectory()
    {
        // Act
        var basePath = _pathResolution.GetBasePath();
        
        // Assert
        Assert.That(basePath, Does.Contain(".coa"));
        Assert.That(basePath, Does.Contain("goldfish"));
    }
}