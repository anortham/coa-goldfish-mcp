using System.ComponentModel.DataAnnotations;

namespace COA.Goldfish.McpServer.Models;

public enum ChronicleEntryType
{
    Decision,
    Milestone,
    Issue,
    Resolution,
    Discovery,
    Note
}

public class ChronicleEntry
{
    [Key]
    public string Id { get; set; } = string.Empty;
    
    [Required]
    public string WorkspaceId { get; set; } = string.Empty;
    
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    
    public ChronicleEntryType Type { get; set; } = ChronicleEntryType.Note;
    
    [Required]
    public string Description { get; set; } = string.Empty;
    
    public string? RelatedPlanId { get; set; }
    
    public string? RelatedTodoId { get; set; }
    
    public string? RelatedCheckpointId { get; set; }
    
    public List<string> Tags { get; set; } = new List<string>();
    
    public Dictionary<string, object> Metadata { get; set; } = new Dictionary<string, object>();
    
    public DateTime? TtlExpiry { get; set; }
}