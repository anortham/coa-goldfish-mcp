using System.Reflection;
using System.Text;
using Microsoft.Extensions.Logging;
using Scriban;

namespace COA.Goldfish.McpServer.Providers;

/// <summary>
/// Provider for behavioral adoption templates using Scriban template engine
/// </summary>
public class TemplateProvider
{
    private readonly ILogger<TemplateProvider> _logger;
    private readonly Dictionary<string, Template> _compiledTemplates;

    public TemplateProvider(ILogger<TemplateProvider> logger)
    {
        _logger = logger;
        _compiledTemplates = new Dictionary<string, Template>();
        LoadTemplates();
    }

    /// <summary>
    /// Get list of available template names
    /// </summary>
    public List<string> GetAvailableTemplates()
    {
        return _compiledTemplates.Keys.ToList();
    }

    /// <summary>
    /// Render a template with the given parameters
    /// </summary>
    public async Task<string> RenderTemplateAsync(string templateName, object parameters)
    {
        try
        {
            if (!_compiledTemplates.TryGetValue(templateName, out var template))
            {
                _logger.LogWarning("Template '{TemplateName}' not found", templateName);
                return $"Template '{templateName}' not found";
            }

            var scriptObject = new Scriban.Runtime.ScriptObject();
            
            // Add parameters to template context
            if (parameters != null)
            {
                var properties = parameters.GetType().GetProperties();
                foreach (var property in properties)
                {
                    var value = property.GetValue(parameters);
                    scriptObject[property.Name.ToLowerInvariant()] = value;
                }
            }

            // Add default helper functions
            AddTemplateHelpers(scriptObject);

            var context = new TemplateContext();
            context.PushGlobal(scriptObject);

            var result = await template.RenderAsync(context);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to render template '{TemplateName}'", templateName);
            return $"Error rendering template: {ex.Message}";
        }
    }

    /// <summary>
    /// Get rendered behavioral guidance template
    /// </summary>
    public async Task<string> GetBehavioralGuidanceAsync(BehavioralGuidanceOptions? options = null)
    {
        options ??= new BehavioralGuidanceOptions();

        var templateData = new
        {
            has_tool = CreateHasToolFunction(options.AvailableTools),
            enforcement_level = options.EnforcementLevel.ToLowerInvariant(),
            workspace_name = options.WorkspaceName ?? "current",
            available_tools = options.AvailableTools
        };

        return await RenderTemplateAsync("goldfish-instructions", templateData);
    }

    /// <summary>
    /// Load embedded templates
    /// </summary>
    private void LoadTemplates()
    {
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            var resourceNames = assembly.GetManifestResourceNames()
                .Where(name => name.Contains("Templates") && name.EndsWith(".scriban"));

            foreach (var resourceName in resourceNames)
            {
                using var stream = assembly.GetManifestResourceStream(resourceName);
                if (stream == null)
                {
                    _logger.LogWarning("Could not load embedded resource: {ResourceName}", resourceName);
                    continue;
                }

                using var reader = new StreamReader(stream, Encoding.UTF8);
                var templateContent = reader.ReadToEnd();
                
                var template = Template.Parse(templateContent);
                if (template.HasErrors)
                {
                    _logger.LogError("Template parsing errors in {ResourceName}: {Errors}", 
                        resourceName, string.Join(", ", template.Messages.Select(m => m.Message)));
                    continue;
                }

                // Extract template name from resource name
                var templateName = ExtractTemplateName(resourceName);
                _compiledTemplates[templateName] = template;
                
                _logger.LogInformation("Loaded template: {TemplateName}", templateName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load templates");
        }
    }

    /// <summary>
    /// Extract template name from resource name
    /// </summary>
    private string ExtractTemplateName(string resourceName)
    {
        // Extract from COA.Goldfish.McpServer.Templates.goldfish-instructions.scriban
        var parts = resourceName.Split('.');
        if (parts.Length >= 2)
        {
            return parts[^2]; // Second to last part (before .scriban)
        }
        return resourceName;
    }

    /// <summary>
    /// Add helper functions to template context
    /// </summary>
    private void AddTemplateHelpers(Scriban.Runtime.ScriptObject scriptObject)
    {
        // Already handled by creating the has_tool function in template data
    }

    /// <summary>
    /// Create has_tool function for template
    /// </summary>
    private Func<string, bool> CreateHasToolFunction(List<string> availableTools)
    {
        return toolName => availableTools.Contains(toolName);
    }
}

/// <summary>
/// Options for behavioral guidance template rendering
/// </summary>
public class BehavioralGuidanceOptions
{
    public List<string> AvailableTools { get; set; } = new()
    {
        "mcp__goldfish__plan",
        "mcp__goldfish__todo", 
        "mcp__goldfish__checkpoint",
        "mcp__goldfish__recall",
        "mcp__goldfish__chronicle",
        "mcp__goldfish__standup",
        "mcp__goldfish__workspace"
    };

    public string EnforcementLevel { get; set; } = "guided"; // strict, guided, flexible
    public string? WorkspaceName { get; set; }
}