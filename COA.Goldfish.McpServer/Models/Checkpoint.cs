using System.ComponentModel.DataAnnotations;

namespace COA.Goldfish.McpServer.Models;

public class Checkpoint
{
    [Key]
    public string Id { get; set; } = string.Empty;
    
    [Required]
    public string WorkspaceId { get; set; } = string.Empty;
    
    public string SessionId { get; set; } = string.Empty;
    
    [Required]
    public string Description { get; set; } = string.Empty;
    
    public string WorkContext { get; set; } = string.Empty;
    
    public List<string> ActiveFiles { get; set; } = new List<string>();
    
    public List<string> Highlights { get; set; } = new List<string>();
    
    public string GitBranch { get; set; } = string.Empty;
    
    public bool IsGlobal { get; set; } = false;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? TtlExpiry { get; set; }
}