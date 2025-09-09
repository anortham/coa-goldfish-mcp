using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using Microsoft.EntityFrameworkCore;

namespace COA.Goldfish.Migration;

/// <summary>
/// Migrates Goldfish data from TypeScript JSON files to .NET SQLite database
/// </summary>
public class JsonToSqliteMigrator
{
    private readonly ILogger<JsonToSqliteMigrator> _logger;
    private readonly string _jsonDataPath;
    private readonly string _sqliteConnectionString;

    public JsonToSqliteMigrator(ILogger<JsonToSqliteMigrator> logger, string jsonDataPath, string sqliteConnectionString)
    {
        _logger = logger;
        _jsonDataPath = jsonDataPath;
        _sqliteConnectionString = sqliteConnectionString;
    }

    /// <summary>
    /// Migrate all data from JSON to SQLite with full preservation
    /// </summary>
    public async Task<MigrationResult> MigrateAllAsync()
    {
        var result = new MigrationResult
        {
            StartTime = DateTime.UtcNow
        };

        try
        {
            _logger.LogInformation("Starting migration from {JsonPath} to SQLite", _jsonDataPath);

            // Validate source data exists
            if (!Directory.Exists(_jsonDataPath))
            {
                throw new DirectoryNotFoundException($"JSON data directory not found: {_jsonDataPath}");
            }

            // Create backup of existing SQLite database if it exists
            await CreateBackupAsync();

            // Initialize SQLite database
            var options = new DbContextOptionsBuilder<GoldfishDbContext>()
                .UseSqlite(_sqliteConnectionString)
                .Options;
            using var dbContext = new GoldfishDbContext(options);
            await dbContext.Database.EnsureCreatedAsync();

            // Migrate each data type in dependency order, saving after each to avoid conflicts
            result.CheckpointsMigrated = await MigrateCheckpointsAsync(dbContext);
            await dbContext.SaveChangesAsync();
            
            result.TodoListsMigrated = await MigrateTodoListsAsync(dbContext);
            await dbContext.SaveChangesAsync();
            
            result.PlansMigrated = await MigratePlansAsync(dbContext);
            await dbContext.SaveChangesAsync();
            
            result.MemoriesMigrated = await MigrateMemoriesToChronicleAsync(dbContext);
            await dbContext.SaveChangesAsync();
            
            result.WorkspacesMigrated = await MigrateWorkspaceStatesAsync(dbContext);
            await dbContext.SaveChangesAsync();

            // Validate migration integrity
            var validationResult = await ValidateMigrationIntegrityAsync(dbContext);
            result.ValidationErrors = validationResult.Errors;
            result.Success = validationResult.Success;

            result.EndTime = DateTime.UtcNow;
            result.Duration = result.EndTime.Value - result.StartTime;

            _logger.LogInformation("Migration completed successfully in {Duration}. " +
                "Migrated: {Checkpoints} checkpoints, {TodoLists} todo lists, {Plans} plans, {Memories} memories, {Workspaces} workspaces",
                result.Duration, result.CheckpointsMigrated, result.TodoListsMigrated, 
                result.PlansMigrated, result.MemoriesMigrated, result.WorkspacesMigrated);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Migration failed");
            result.Success = false;
            result.ErrorMessage = ex.Message;
            result.EndTime = DateTime.UtcNow;
            result.Duration = result.EndTime.Value - result.StartTime;
            return result;
        }
    }

    /// <summary>
    /// Rollback migration by restoring from backup
    /// </summary>
    public Task<bool> RollbackAsync()
    {
        try
        {
            var backupPath = GetBackupPath();
            if (!File.Exists(backupPath))
            {
                _logger.LogWarning("No backup found to rollback from");
                return Task.FromResult(false);
            }

            var dbPath = GetSqliteDatabasePath();
            
            // Replace current database with backup
            File.Copy(backupPath, dbPath, overwrite: true);
            
            _logger.LogInformation("Successfully rolled back migration");
            return Task.FromResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Rollback failed");
            return Task.FromResult(false);
        }
    }

    #region Private Migration Methods

    private async Task<int> MigrateCheckpointsAsync(GoldfishDbContext dbContext)
    {
        // Search for checkpoints directories across all workspace subdirectories
        var checkpointFiles = new List<string>();
        
        if (Directory.Exists(_jsonDataPath))
        {
            foreach (var workspaceDir in Directory.GetDirectories(_jsonDataPath))
            {
                var checkpointsPath = Path.Combine(workspaceDir, "checkpoints");
                if (Directory.Exists(checkpointsPath))
                {
                    var files = Directory.GetFiles(checkpointsPath, "*.json", SearchOption.AllDirectories);
                    checkpointFiles.AddRange(files);
                    _logger.LogInformation("Found {Count} checkpoint files in {Path}", files.Length, checkpointsPath);
                }
            }
        }
        
        if (checkpointFiles.Count == 0)
        {
            _logger.LogInformation("No checkpoint files found in any workspace directories");
            return 0;
        }
        
        var count = 0;

        foreach (var file in checkpointFiles)
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var typescriptCheckpoint = JsonSerializer.Deserialize<TypeScriptCheckpoint>(json);
                
                if (typescriptCheckpoint != null)
                {
                    var checkpoint = ConvertCheckpoint(typescriptCheckpoint);
                    
                    // Check if this ID already exists to avoid duplicate key errors
                    var existingCheckpoint = await dbContext.Checkpoints.FirstOrDefaultAsync(c => c.Id == checkpoint.Id);
                    if (existingCheckpoint == null)
                    {
                        dbContext.Checkpoints.Add(checkpoint);
                        count++;
                    }
                    else
                    {
                        _logger.LogWarning("Skipping duplicate checkpoint ID: {Id} from {File}", checkpoint.Id, file);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to migrate checkpoint file: {File}", file);
            }
        }

        _logger.LogInformation("Migrated {Count} checkpoints", count);
        return count;
    }

    private async Task<int> MigrateTodoListsAsync(GoldfishDbContext dbContext)
    {
        // Search for todos directories across all workspace subdirectories
        var todoFiles = new List<string>();
        
        if (Directory.Exists(_jsonDataPath))
        {
            foreach (var workspaceDir in Directory.GetDirectories(_jsonDataPath))
            {
                var todosPath = Path.Combine(workspaceDir, "todos");
                if (Directory.Exists(todosPath))
                {
                    var files = Directory.GetFiles(todosPath, "*.json", SearchOption.AllDirectories);
                    todoFiles.AddRange(files);
                    _logger.LogInformation("Found {Count} todo files in {Path}", files.Length, todosPath);
                }
            }
        }
        
        if (todoFiles.Count == 0)
        {
            _logger.LogInformation("No todo files found in any workspace directories");
            return 0;
        }
        
        var count = 0;

        foreach (var file in todoFiles)
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var typescriptTodos = JsonSerializer.Deserialize<TypeScriptTodoList>(json);
                
                if (typescriptTodos != null)
                {
                    var todoList = ConvertTodoList(typescriptTodos);
                    
                    // Check if this ID already exists to avoid duplicate key errors
                    var existingTodoList = await dbContext.TodoLists.FirstOrDefaultAsync(t => t.Id == todoList.Id);
                    if (existingTodoList == null)
                    {
                        dbContext.TodoLists.Add(todoList);
                        count++;
                    }
                    else
                    {
                        _logger.LogWarning("Skipping duplicate TODO list ID: {Id} from {File}", todoList.Id, file);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to migrate todo file: {File}", file);
            }
        }

        _logger.LogInformation("Migrated {Count} todo lists", count);
        return count;
    }

    private async Task<int> MigratePlansAsync(GoldfishDbContext dbContext)
    {
        // Search for plans directories across all workspace subdirectories
        var planFiles = new List<string>();
        
        if (Directory.Exists(_jsonDataPath))
        {
            foreach (var workspaceDir in Directory.GetDirectories(_jsonDataPath))
            {
                var plansPath = Path.Combine(workspaceDir, "plans");
                if (Directory.Exists(plansPath))
                {
                    var files = Directory.GetFiles(plansPath, "*.json", SearchOption.AllDirectories);
                    planFiles.AddRange(files);
                    _logger.LogInformation("Found {Count} plan files in {Path}", files.Length, plansPath);
                }
            }
        }
        
        if (planFiles.Count == 0)
        {
            _logger.LogInformation("No plan files found in any workspace directories");
            return 0;
        }
        
        var count = 0;

        foreach (var file in planFiles)
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var typescriptPlan = JsonSerializer.Deserialize<TypeScriptPlan>(json);
                
                if (typescriptPlan != null)
                {
                    var plan = ConvertPlan(typescriptPlan);
                    
                    // Check if this ID already exists to avoid duplicate key errors
                    var existingPlan = await dbContext.Plans.FirstOrDefaultAsync(p => p.Id == plan.Id);
                    if (existingPlan == null)
                    {
                        dbContext.Plans.Add(plan);
                        count++;
                    }
                    else
                    {
                        _logger.LogWarning("Skipping duplicate plan ID: {Id} from {File}", plan.Id, file);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to migrate plan file: {File}", file);
            }
        }

        _logger.LogInformation("Migrated {Count} plans", count);
        return count;
    }

    private async Task<int> MigrateMemoriesToChronicleAsync(GoldfishDbContext dbContext)
    {
        // Search for memories directories across all workspace subdirectories
        var memoryFiles = new List<string>();
        
        if (Directory.Exists(_jsonDataPath))
        {
            foreach (var workspaceDir in Directory.GetDirectories(_jsonDataPath))
            {
                var memoriesPath = Path.Combine(workspaceDir, "memories");
                if (Directory.Exists(memoriesPath))
                {
                    var files = Directory.GetFiles(memoriesPath, "*.json", SearchOption.AllDirectories);
                    memoryFiles.AddRange(files);
                    _logger.LogInformation("Found {Count} memory files in {Path}", files.Length, memoriesPath);
                }
            }
        }
        
        if (memoryFiles.Count == 0)
        {
            _logger.LogInformation("No memory files found in any workspace directories");
            return 0;
        }
        
        var count = 0;

        foreach (var file in memoryFiles)
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var typescriptMemory = JsonSerializer.Deserialize<TypeScriptMemory>(json);
                
                if (typescriptMemory != null)
                {
                    var chronicleEntry = ConvertMemoryToChronicle(typescriptMemory);
                    dbContext.ChronicleEntries.Add(chronicleEntry);
                    count++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to migrate memory file: {File}", file);
            }
        }

        _logger.LogInformation("Migrated {Count} memories to chronicle entries", count);
        return count;
    }

    private Task<int> MigrateWorkspaceStatesAsync(GoldfishDbContext dbContext)
    {
        // Workspace states might be implicit in TypeScript version
        // Create default workspace states for discovered workspaces
        var workspaces = new HashSet<string>();

        // Find all workspace IDs from existing data
        foreach (var checkpoint in dbContext.Checkpoints)
        {
            workspaces.Add(checkpoint.WorkspaceId);
        }
        foreach (var todoList in dbContext.TodoLists)
        {
            workspaces.Add(todoList.WorkspaceId);
        }
        foreach (var plan in dbContext.Plans)
        {
            workspaces.Add(plan.WorkspaceId);
        }

        var count = 0;
        foreach (var workspaceId in workspaces)
        {
            if (!dbContext.WorkspaceStates.Any(ws => ws.WorkspaceId == workspaceId))
            {
                var workspaceState = new WorkspaceState
                {
                    WorkspaceId = workspaceId,
                    LastActivity = DateTime.UtcNow
                };
                
                // Try to find active plan and todo
                var activePlan = dbContext.Plans
                    .Where(p => p.WorkspaceId == workspaceId && p.Status == PlanStatus.Active)
                    .FirstOrDefault();
                if (activePlan != null)
                {
                    workspaceState.ActivePlanId = activePlan.Id;
                }

                var activeTodo = dbContext.TodoLists
                    .Where(t => t.WorkspaceId == workspaceId && t.IsActive)
                    .FirstOrDefault();
                if (activeTodo != null)
                {
                    workspaceState.ActiveTodoListId = activeTodo.Id;
                }

                dbContext.WorkspaceStates.Add(workspaceState);
                count++;
            }
        }

        _logger.LogInformation("Created {Count} workspace states", count);
        return Task.FromResult(count);
    }

    #endregion

    #region Conversion Methods

    private Checkpoint ConvertCheckpoint(TypeScriptCheckpoint ts)
    {
        // Handle TypeScript nested content structure
        var content = ts.Content;
        
        return new Checkpoint
        {
            Id = ts.Id,
            WorkspaceId = ts.Workspace, // TypeScript uses "workspace"
            Description = content?.Description ?? "",
            WorkContext = content?.WorkContext ?? "",
            ActiveFiles = content?.ActiveFiles ?? new List<string>(),
            Highlights = content?.Highlights ?? new List<string>(),
            GitBranch = content?.GitBranch ?? "",
            SessionId = ts.SessionId ?? content?.SessionId ?? "default-session", // Handle null SessionId
            CreatedAt = ParseDateTime(ts.Timestamp) ?? DateTime.UtcNow,
            // UpdatedAt is automatically managed by EF Core
        };
    }

    private TodoList ConvertTodoList(TypeScriptTodoList ts)
    {
        var todoList = new TodoList
        {
            Id = ts.Id,
            WorkspaceId = ts.Workspace, // TypeScript uses "workspace"
            Title = ts.Title,
            Description = "", // TypeScript doesn't have description field
            IsActive = ts.Status != "archived", // TypeScript uses different status values
            CreatedAt = ParseDateTime(ts.CreatedAt) ?? DateTime.UtcNow,
            // UpdatedAt is automatically managed by EF Core,
            Items = new List<TodoItem>()
        };

        if (ts.Items != null)
        {
            foreach (var tsItem in ts.Items)
            {
                var item = new TodoItem
                {
                    Id = tsItem.Id,
                    TodoListId = todoList.Id,
                    Content = tsItem.Task, // TypeScript uses "task" not "content"
                    Status = ConvertTodoStatus(tsItem.Status),
                    Priority = ConvertTodoPriority(tsItem.Priority ?? "normal"),
                    CreatedAt = ParseDateTime(tsItem.CreatedAt) ?? DateTime.UtcNow,
                    // UpdatedAt is automatically managed by EF Core
                };
                todoList.Items.Add(item);
            }
        }

        return todoList;
    }

    private Plan ConvertPlan(TypeScriptPlan ts)
    {
        return new Plan
        {
            Id = ts.Id,
            WorkspaceId = ts.Workspace, // TypeScript uses "workspace"
            Title = ts.Title,
            Description = ts.Description,
            Category = ConvertPlanCategory(ts.Category),
            Priority = ConvertPlanPriority(ts.Priority),
            Status = ConvertPlanStatus(ts.Status),
            Items = ts.Items,
            EstimatedEffort = ts.EstimatedEffort,
            CreatedAt = ParseDateTime(ts.CreatedAt) ?? DateTime.UtcNow,
            // UpdatedAt is automatically managed by EF Core
        };
    }

    private ChronicleEntry ConvertMemoryToChronicle(TypeScriptMemory ts)
    {
        return new ChronicleEntry
        {
            Id = ts.Id,
            WorkspaceId = ts.Workspace, // TypeScript uses "workspace"
            Type = ConvertMemoryType(ts.Type),
            Description = ts.Content,
            Timestamp = ParseDateTime(ts.CreatedAt) ?? DateTime.UtcNow,
            // RelatedPlanId and RelatedTodoId not in TypeScript model
        };
    }

    private TodoItemStatus ConvertTodoStatus(string? status)
    {
        return status?.ToLowerInvariant() switch
        {
            "done" or "completed" => TodoItemStatus.Done,
            "in_progress" or "active" => TodoItemStatus.Active,
            _ => TodoItemStatus.Pending
        };
    }

    private TodoItemPriority ConvertTodoPriority(string? priority)
    {
        return priority?.ToLowerInvariant() switch
        {
            "high" or "urgent" => TodoItemPriority.High,
            "low" => TodoItemPriority.Low,
            _ => TodoItemPriority.Normal
        };
    }

    private PlanStatus ConvertPlanStatus(string? status)
    {
        return status?.ToLowerInvariant() switch
        {
            "complete" or "completed" => PlanStatus.Complete,
            "abandoned" => PlanStatus.Abandoned,
            "active" => PlanStatus.Active,
            _ => PlanStatus.Draft
        };
    }

    private ChronicleEntryType ConvertMemoryType(string? type)
    {
        return type?.ToLowerInvariant() switch
        {
            "decision" => ChronicleEntryType.Decision,
            "milestone" => ChronicleEntryType.Milestone,
            "issue" => ChronicleEntryType.Issue,
            "resolution" => ChronicleEntryType.Resolution,
            "discovery" => ChronicleEntryType.Discovery,
            _ => ChronicleEntryType.Note
        };
    }

    private string ConvertPlanCategory(string? category)
    {
        return category?.ToLowerInvariant() switch
        {
            "feature" => "feature",
            "refactor" => "refactor", 
            "research" => "research",
            "architecture" => "architecture",
            "bugfix" => "bugfix",
            "testing" => "maintenance",
            _ => "feature"
        };
    }

    private string ConvertPlanPriority(string? priority)
    {
        return priority?.ToLowerInvariant() switch
        {
            "high" or "urgent" => "high",
            "critical" => "critical",
            "low" => "low",
            _ => "normal"
        };
    }

    private DateTime? ParseDateTime(string? dateString)
    {
        if (string.IsNullOrEmpty(dateString))
            return null;

        if (DateTime.TryParse(dateString, out var dateTime))
            return dateTime;

        // Handle TypeScript ISO 8601 format specifically
        if (DateTimeOffset.TryParse(dateString, out var dateTimeOffset))
            return dateTimeOffset.DateTime;

        return null;
    }

    #endregion

    #region Validation and Backup Methods

    private Task CreateBackupAsync()
    {
        var dbPath = GetSqliteDatabasePath();
        if (File.Exists(dbPath))
        {
            var backupPath = GetBackupPath();
            File.Copy(dbPath, backupPath, overwrite: true);
            _logger.LogInformation("Created database backup at: {BackupPath}", backupPath);
        }
        return Task.CompletedTask;
    }

    private Task<ValidationResult> ValidateMigrationIntegrityAsync(GoldfishDbContext dbContext)
    {
        var result = new ValidationResult();

        // Validate referential integrity
        var orphanedTodoItems = dbContext.TodoItems
            .Where(ti => !dbContext.TodoLists.Any(tl => tl.Id == ti.TodoListId))
            .Count();

        if (orphanedTodoItems > 0)
        {
            result.Errors.Add($"Found {orphanedTodoItems} orphaned TODO items");
        }

        // Validate required fields
        var checkpointsWithoutWorkspace = dbContext.Checkpoints
            .Where(c => string.IsNullOrEmpty(c.WorkspaceId))
            .Count();

        if (checkpointsWithoutWorkspace > 0)
        {
            result.Errors.Add($"Found {checkpointsWithoutWorkspace} checkpoints without workspace ID");
        }

        result.Success = result.Errors.Count == 0;
        return Task.FromResult(result);
    }

    private string GetSqliteDatabasePath()
    {
        // Extract database path from connection string
        if (_sqliteConnectionString.Contains("Data Source="))
        {
            return _sqliteConnectionString.Split("Data Source=")[1].Split(';')[0];
        }
        return "goldfish.db";
    }

    private string GetBackupPath()
    {
        var dbPath = GetSqliteDatabasePath();
        var directory = Path.GetDirectoryName(dbPath) ?? "";
        var filename = Path.GetFileNameWithoutExtension(dbPath);
        var extension = Path.GetExtension(dbPath);
        return Path.Combine(directory, $"{filename}_backup_{DateTime.UtcNow:yyyyMMdd_HHmmss}{extension}");
    }

    #endregion
}

#region TypeScript Data Models (for deserialization)

public class TypeScriptCheckpoint
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    
    [JsonPropertyName("workspace")]
    public string Workspace { get; set; } = string.Empty; // TypeScript uses "workspace"
    
    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = string.Empty;
    
    [JsonPropertyName("sessionId")]
    public string? SessionId { get; set; }
    
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;
    
    [JsonPropertyName("content")] // Nested object in TypeScript
    public TypeScriptCheckpointContent? Content { get; set; }
    
    [JsonPropertyName("ttlHours")]
    public int? TtlHours { get; set; }
    
    [JsonPropertyName("tags")]
    public List<string> Tags { get; set; } = new();
    
    [JsonPropertyName("metadata")]
    public Dictionary<string, object>? Metadata { get; set; }
}

public class TypeScriptCheckpointContent
{
    [JsonPropertyName("description")]
    public string? Description { get; set; }
    
    [JsonPropertyName("highlights")]
    public List<string> Highlights { get; set; } = new();
    
    [JsonPropertyName("gitBranch")]
    public string? GitBranch { get; set; }
    
    [JsonPropertyName("sessionId")]
    public string? SessionId { get; set; }
    
    [JsonPropertyName("activeFiles")]
    public List<string> ActiveFiles { get; set; } = new();
    
    [JsonPropertyName("workContext")]
    public string? WorkContext { get; set; }
}

public class TypeScriptTodoList
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;
    
    [JsonPropertyName("workspace")]
    public string Workspace { get; set; } = string.Empty; // TypeScript uses "workspace"
    
    [JsonPropertyName("items")]
    public List<TypeScriptTodoItem> Items { get; set; } = new();
    
    [JsonPropertyName("createdAt")]
    public string? CreatedAt { get; set; }
    
    [JsonPropertyName("updatedAt")]
    public string? UpdatedAt { get; set; }
    
    [JsonPropertyName("status")]
    public string? Status { get; set; } // "active", "archived", etc.
    
    [JsonPropertyName("archivedAt")]
    public string? ArchivedAt { get; set; }
}

public class TypeScriptTodoItem
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    
    [JsonPropertyName("task")] // TypeScript uses "task" not "content"
    public string Task { get; set; } = string.Empty;
    
    [JsonPropertyName("status")]
    public string Status { get; set; } = "pending";
    
    [JsonPropertyName("createdAt")]
    public string? CreatedAt { get; set; }
    
    [JsonPropertyName("priority")]
    public string? Priority { get; set; }
}

public class TypeScriptPlan
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    
    [JsonPropertyName("workspace")]
    public string Workspace { get; set; } = string.Empty; // TypeScript uses "workspace"
    
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;
    
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
    
    [JsonPropertyName("category")]
    public string Category { get; set; } = string.Empty;
    
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;
    
    [JsonPropertyName("priority")]
    public string Priority { get; set; } = string.Empty;
    
    [JsonPropertyName("items")]
    public List<string> Items { get; set; } = new();
    
    [JsonPropertyName("estimatedEffort")]
    public string? EstimatedEffort { get; set; }
    
    [JsonPropertyName("createdAt")]
    public string? CreatedAt { get; set; }
    
    [JsonPropertyName("updatedAt")]
    public string? UpdatedAt { get; set; }
}

public class TypeScriptMemory
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    
    [JsonPropertyName("workspace")]
    public string Workspace { get; set; } = string.Empty; // TypeScript uses "workspace"
    
    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;
    
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;
    
    [JsonPropertyName("context")]
    public string? Context { get; set; }
    
    [JsonPropertyName("tags")]
    public List<string> Tags { get; set; } = new();
    
    [JsonPropertyName("createdAt")]
    public string? CreatedAt { get; set; }
    
    [JsonPropertyName("updatedAt")]
    public string? UpdatedAt { get; set; }
}

#endregion

#region Result Models

public class MigrationResult
{
    public bool Success { get; set; } = true;
    public string? ErrorMessage { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public TimeSpan? Duration { get; set; }
    
    public int CheckpointsMigrated { get; set; }
    public int TodoListsMigrated { get; set; }
    public int PlansMigrated { get; set; }
    public int MemoriesMigrated { get; set; }
    public int WorkspacesMigrated { get; set; }
    
    public List<string> ValidationErrors { get; set; } = new();
}

public class ValidationResult
{
    public bool Success { get; set; } = true;
    public List<string> Errors { get; set; } = new();
}

#endregion