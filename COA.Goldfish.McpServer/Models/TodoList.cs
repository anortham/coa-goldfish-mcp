using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace COA.Goldfish.McpServer.Models;

public class TodoList
{
    [Key]
    public string Id { get; set; } = string.Empty;
    
    [Required]
    public string WorkspaceId { get; set; } = string.Empty;
    
    [Required]
    public string Title { get; set; } = string.Empty;
    
    public string Description { get; set; } = string.Empty;
    
    public bool IsActive { get; set; } = false;
    
    public List<TodoItem> Items { get; set; } = new List<TodoItem>();
    
    public List<string> Tags { get; set; } = new List<string>();
    
    public Dictionary<string, object> Metadata { get; set; } = new Dictionary<string, object>();
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? TtlExpiry { get; set; }
}

public enum TodoItemStatus
{
    Pending,
    Active,
    Done
}

public enum TodoItemPriority
{
    Low,
    Normal,
    High
}

public class TodoItem
{
    [Key]
    public string Id { get; set; } = string.Empty;
    
    [Required]
    public string TodoListId { get; set; } = string.Empty;
    
    [Required]
    public string Content { get; set; } = string.Empty;
    
    public TodoItemStatus Status { get; set; } = TodoItemStatus.Pending;
    
    public TodoItemPriority Priority { get; set; } = TodoItemPriority.Normal;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation property - JsonIgnore to prevent circular reference during serialization
    [JsonIgnore]
    public TodoList? TodoList { get; set; }
}