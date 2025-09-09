using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Services;

public class SessionService
{
    private readonly ILogger<SessionService> _logger;

    public SessionService(ILogger<SessionService> logger)
    {
        _logger = logger;
    }

    // TODO: Implement session management
}