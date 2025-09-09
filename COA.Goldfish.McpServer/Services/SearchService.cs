using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Services;

public class SearchService
{
    private readonly ILogger<SearchService> _logger;

    public SearchService(ILogger<SearchService> logger)
    {
        _logger = logger;
    }

    // TODO: Implement search functionality
}