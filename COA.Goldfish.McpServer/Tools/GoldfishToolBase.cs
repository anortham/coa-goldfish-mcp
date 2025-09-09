using COA.Mcp.Framework.Base;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Tools;

/// <summary>
/// Base class for Goldfish MCP tools
/// </summary>
/// <typeparam name="TParams">The type of the tool's input parameters</typeparam>
/// <typeparam name="TResult">The type of the tool's result</typeparam>
public abstract class GoldfishToolBase<TParams, TResult> : McpToolBase<TParams, TResult>
    where TParams : class
{
    /// <summary>
    /// Initializes a new instance of the GoldfishToolBase class
    /// </summary>
    /// <param name="serviceProvider">Service provider for dependency injection</param>
    /// <param name="logger">Optional logger for the tool</param>
    protected GoldfishToolBase(IServiceProvider? serviceProvider = null, ILogger? logger = null) 
        : base(serviceProvider, logger)
    {
    }

    /// <summary>
    /// Goldfish tools use Data Annotations validation
    /// </summary>
    protected override bool ShouldValidateDataAnnotations => true;
}