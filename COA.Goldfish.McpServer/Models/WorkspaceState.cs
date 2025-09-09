namespace COA.Goldfish.McpServer.Models;

public class WorkspaceState
{
    public string WorkspaceId { get; set; } = string.Empty;
    public string? ActivePlanId { get; set; }
    public string? ActiveTodoListId { get; set; }
    public DateTime LastActivity { get; set; } = DateTime.UtcNow;
}