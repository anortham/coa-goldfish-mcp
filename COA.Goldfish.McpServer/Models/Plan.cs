using System.ComponentModel.DataAnnotations;

namespace COA.Goldfish.McpServer.Models;

public enum PlanStatus
{
    Draft,
    Active,
    Complete,
    Abandoned
}

public class Plan
{
    [Key]
    public string Id { get; set; } = string.Empty;
    
    [Required]
    public string WorkspaceId { get; set; } = string.Empty;
    
    [Required]
    public string Title { get; set; } = string.Empty;
    
    public string Description { get; set; } = string.Empty;
    
    public PlanStatus Status { get; set; } = PlanStatus.Draft;
    
    public List<string> Items { get; set; } = new List<string>();
    
    public List<string> Discoveries { get; set; } = new List<string>();
    
    public string Category { get; set; } = string.Empty;
    
    public string Priority { get; set; } = "normal";
    
    public List<string> Tags { get; set; } = new List<string>();
    
    public string? EstimatedEffort { get; set; }
    
    public string? ActualEffort { get; set; }
    
    public List<string> Blockers { get; set; } = new List<string>();
    
    public List<string> Outcomes { get; set; } = new List<string>();
    
    public List<string> Lessons { get; set; } = new List<string>();
    
    public List<string> NextSteps { get; set; } = new List<string>();
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? TtlExpiry { get; set; }
}