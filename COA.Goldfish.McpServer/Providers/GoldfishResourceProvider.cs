using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Providers;

/// <summary>
/// Simple service for serving Goldfish behavioral guidance templates
/// </summary>
public class GoldfishResourceProvider
{
    private readonly TemplateProvider _templateProvider;
    private readonly ILogger<GoldfishResourceProvider> _logger;

    public GoldfishResourceProvider(TemplateProvider templateProvider, ILogger<GoldfishResourceProvider> logger)
    {
        _templateProvider = templateProvider;
        _logger = logger;
    }

    /// <summary>
    /// Get behavioral guidance as markdown
    /// </summary>
    public async Task<string> GetBehavioralGuidanceAsync(BehavioralGuidanceOptions? options = null)
    {
        try
        {
            _logger.LogInformation("Generating behavioral guidance");
            return await _templateProvider.GetBehavioralGuidanceAsync(options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate behavioral guidance");
            return $"Error generating behavioral guidance: {ex.Message}";
        }
    }

    /// <summary>
    /// Get behavioral guidance with default options
    /// </summary>
    public async Task<string> GetDefaultBehavioralGuidanceAsync()
    {
        var options = new BehavioralGuidanceOptions
        {
            EnforcementLevel = "guided", // Balanced approach
            WorkspaceName = "current"
        };
        
        return await GetBehavioralGuidanceAsync(options);
    }
}