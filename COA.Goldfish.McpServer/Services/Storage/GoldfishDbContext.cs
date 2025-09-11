using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using System.Text.Json;
using COA.Goldfish.McpServer.Models;

namespace COA.Goldfish.McpServer.Services.Storage;

public class GoldfishDbContext : DbContext
{
    public GoldfishDbContext(DbContextOptions<GoldfishDbContext> options) : base(options)
    {
    }

    public DbSet<WorkspaceState> WorkspaceStates { get; set; } = null!;
    public DbSet<Plan> Plans { get; set; } = null!;
    public DbSet<TodoList> TodoLists { get; set; } = null!;
    public DbSet<TodoItem> TodoItems { get; set; } = null!;
    public DbSet<Checkpoint> Checkpoints { get; set; } = null!;
    public DbSet<ChronicleEntry> ChronicleEntries { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure WorkspaceState
        modelBuilder.Entity<WorkspaceState>(entity =>
        {
            entity.HasKey(e => e.WorkspaceId);
            entity.Property(e => e.WorkspaceId).IsRequired().HasMaxLength(255);
            entity.Property(e => e.ActivePlanId).HasMaxLength(255);
            entity.Property(e => e.ActiveTodoListId).HasMaxLength(255);
            
            // Add index for performance
            entity.HasIndex(e => e.LastActivity);
        });

        // Configure Plan
        modelBuilder.Entity<Plan>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).IsRequired().HasMaxLength(255);
            entity.Property(e => e.WorkspaceId).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Description).HasMaxLength(10000);
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.Priority).HasMaxLength(50);
            entity.Property(e => e.EstimatedEffort).HasMaxLength(100);
            entity.Property(e => e.ActualEffort).HasMaxLength(100);
            
            // Configure JSON columns for lists
            entity.Property(e => e.Items)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));
                    
            entity.Property(e => e.Discoveries)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));
                    
            entity.Property(e => e.Tags)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));
                    
            entity.Property(e => e.Blockers)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));
                    
            entity.Property(e => e.Outcomes)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));
                    
            entity.Property(e => e.Lessons)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));
                    
            entity.Property(e => e.NextSteps)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));

            // Indexes
            entity.HasIndex(e => e.WorkspaceId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.UpdatedAt);
            entity.HasIndex(e => e.TtlExpiry); // For cleanup operations
        });

        // Configure TodoList
        modelBuilder.Entity<TodoList>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).IsRequired().HasMaxLength(255);
            entity.Property(e => e.WorkspaceId).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Description).HasMaxLength(10000);
            
            // Configure JSON columns
            entity.Property(e => e.Tags)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));
                    
            entity.Property(e => e.Metadata)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<Dictionary<string, object>>(v, (JsonSerializerOptions?)null) ?? new Dictionary<string, object>())
                .Metadata.SetValueComparer(new ValueComparer<Dictionary<string, object>>(
                    (c1, c2) => c1!.Keys.OrderBy(k => k).SequenceEqual(c2!.Keys.OrderBy(k => k)) && 
                                c1.Keys.All(k => c1[k].Equals(c2[k])),
                    c => c.Keys.OrderBy(k => k).Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode(), c[v].GetHashCode())),
                    c => new Dictionary<string, object>(c)));

            // Indexes
            entity.HasIndex(e => e.WorkspaceId);
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.UpdatedAt);
            entity.HasIndex(e => e.TtlExpiry); // For cleanup operations
        });

        // Configure TodoItem
        modelBuilder.Entity<TodoItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).IsRequired().HasMaxLength(255);
            entity.Property(e => e.TodoListId).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Content).IsRequired().HasMaxLength(2000);
            
            // Configure relationship
            entity.HasOne(e => e.TodoList)
                .WithMany(e => e.Items)
                .HasForeignKey(e => e.TodoListId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            entity.HasIndex(e => e.TodoListId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
        });

        // Configure Checkpoint
        modelBuilder.Entity<Checkpoint>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).IsRequired().HasMaxLength(255);
            entity.Property(e => e.WorkspaceId).IsRequired().HasMaxLength(255);
            entity.Property(e => e.SessionId).HasMaxLength(255);
            entity.Property(e => e.Description).IsRequired().HasMaxLength(2000);
            entity.Property(e => e.WorkContext).HasMaxLength(5000);
            entity.Property(e => e.GitBranch).HasMaxLength(255);
            
            // Configure JSON columns
            entity.Property(e => e.ActiveFiles)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));
                    
            entity.Property(e => e.Highlights)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));

            // Indexes
            entity.HasIndex(e => e.WorkspaceId);
            entity.HasIndex(e => e.SessionId);
            entity.HasIndex(e => e.IsGlobal);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.TtlExpiry); // For cleanup operations
        });

        // Configure ChronicleEntry
        modelBuilder.Entity<ChronicleEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).IsRequired().HasMaxLength(255);
            entity.Property(e => e.WorkspaceId).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Description).IsRequired().HasMaxLength(5000);
            entity.Property(e => e.RelatedPlanId).HasMaxLength(255);
            entity.Property(e => e.RelatedTodoId).HasMaxLength(255);
            entity.Property(e => e.RelatedCheckpointId).HasMaxLength(255);
            
            // Configure JSON columns
            entity.Property(e => e.Tags)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));
                    
            entity.Property(e => e.Metadata)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<Dictionary<string, object>>(v, (JsonSerializerOptions?)null) ?? new Dictionary<string, object>())
                .Metadata.SetValueComparer(new ValueComparer<Dictionary<string, object>>(
                    (c1, c2) => c1!.Keys.OrderBy(k => k).SequenceEqual(c2!.Keys.OrderBy(k => k)) && 
                                c1.Keys.All(k => c1[k].Equals(c2[k])),
                    c => c.Keys.OrderBy(k => k).Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode(), c[v].GetHashCode())),
                    c => new Dictionary<string, object>(c)));

            // Indexes
            entity.HasIndex(e => e.WorkspaceId);
            entity.HasIndex(e => e.Type);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => e.RelatedPlanId);
            entity.HasIndex(e => e.RelatedTodoId);
            entity.HasIndex(e => e.TtlExpiry); // For cleanup operations
        });
        
        // FTS5 virtual tables are created via CreateFtsTablesAsync() during database initialization
    }

    /// <summary>
    /// Execute SQL commands to create FTS5 virtual tables
    /// This should be called after database creation/migration
    /// </summary>
    public async Task CreateFtsTablesAsync()
    {
        try
        {
            // Create FTS5 virtual table for checkpoints (simple table, not content-based)
            await Database.ExecuteSqlRawAsync(@"
                CREATE VIRTUAL TABLE IF NOT EXISTS CheckpointsFts USING fts5(
                    Id, 
                    WorkspaceId, 
                    Description, 
                    WorkContext, 
                    Highlights
                );
            ");

            // Create FTS5 virtual table for plans (simple table, not content-based)
            await Database.ExecuteSqlRawAsync(@"
                CREATE VIRTUAL TABLE IF NOT EXISTS PlansFts USING fts5(
                    Id,
                    WorkspaceId,
                    Title,
                    Description,
                    Items,
                    Discoveries
                );
            ");

            // Create FTS5 virtual table for todo lists (simple table, not content-based)
            await Database.ExecuteSqlRawAsync(@"
                CREATE VIRTUAL TABLE IF NOT EXISTS TodoListsFts USING fts5(
                    Id,
                    WorkspaceId, 
                    Title,
                    Description
                );
            ");

            // Create FTS5 virtual table for chronicle entries (simple table, not content-based)
            await Database.ExecuteSqlRawAsync(@"
                CREATE VIRTUAL TABLE IF NOT EXISTS ChronicleEntriesFts USING fts5(
                    Id,
                    WorkspaceId,
                    Description
                );
            ");

            // Create triggers to keep FTS tables in sync
            await CreateFtsSyncTriggersAsync();
        }
        catch (Exception ex)
        {
            // Log error but don't fail - FTS is optional enhancement
            Console.WriteLine($"Warning: Could not create FTS5 tables: {ex.Message}");
        }
    }

    private async Task CreateFtsSyncTriggersAsync()
    {
        // Checkpoint triggers
        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS checkpoints_fts_insert AFTER INSERT ON Checkpoints BEGIN
                INSERT INTO CheckpointsFts(Id, WorkspaceId, Description, WorkContext, Highlights)
                VALUES (new.Id, new.WorkspaceId, new.Description, new.WorkContext, new.Highlights);
            END;
        ");

        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS checkpoints_fts_update AFTER UPDATE ON Checkpoints BEGIN
                UPDATE CheckpointsFts SET 
                    WorkspaceId = new.WorkspaceId,
                    Description = new.Description, 
                    WorkContext = new.WorkContext,
                    Highlights = new.Highlights
                WHERE Id = new.Id;
            END;
        ");

        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS checkpoints_fts_delete AFTER DELETE ON Checkpoints BEGIN
                DELETE FROM CheckpointsFts WHERE Id = old.Id;
            END;
        ");

        // Plan triggers  
        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS plans_fts_insert AFTER INSERT ON Plans BEGIN
                INSERT INTO PlansFts(Id, WorkspaceId, Title, Description, Items, Discoveries)
                VALUES (new.Id, new.WorkspaceId, new.Title, new.Description, new.Items, new.Discoveries);
            END;
        ");

        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS plans_fts_update AFTER UPDATE ON Plans BEGIN
                UPDATE PlansFts SET
                    WorkspaceId = new.WorkspaceId,
                    Title = new.Title,
                    Description = new.Description,
                    Items = new.Items,
                    Discoveries = new.Discoveries
                WHERE Id = new.Id;
            END;
        ");

        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS plans_fts_delete AFTER DELETE ON Plans BEGIN
                DELETE FROM PlansFts WHERE Id = old.Id;
            END;
        ");

        // TodoList triggers
        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS todolists_fts_insert AFTER INSERT ON TodoLists BEGIN
                INSERT INTO TodoListsFts(Id, WorkspaceId, Title, Description)
                VALUES (new.Id, new.WorkspaceId, new.Title, new.Description);
            END;
        ");

        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS todolists_fts_update AFTER UPDATE ON TodoLists BEGIN
                UPDATE TodoListsFts SET
                    WorkspaceId = new.WorkspaceId,
                    Title = new.Title,
                    Description = new.Description
                WHERE Id = new.Id;
            END;
        ");

        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS todolists_fts_delete AFTER DELETE ON TodoLists BEGIN
                DELETE FROM TodoListsFts WHERE Id = old.Id;
            END;
        ");

        // ChronicleEntry triggers
        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS chronicleentries_fts_insert AFTER INSERT ON ChronicleEntries BEGIN
                INSERT INTO ChronicleEntriesFts(Id, WorkspaceId, Description)
                VALUES (new.Id, new.WorkspaceId, new.Description);
            END;
        ");

        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS chronicleentries_fts_update AFTER UPDATE ON ChronicleEntries BEGIN
                UPDATE ChronicleEntriesFts SET
                    WorkspaceId = new.WorkspaceId,
                    Description = new.Description
                WHERE Id = new.Id;
            END;
        ");

        await Database.ExecuteSqlRawAsync(@"
            CREATE TRIGGER IF NOT EXISTS chronicleentries_fts_delete AFTER DELETE ON ChronicleEntries BEGIN
                DELETE FROM ChronicleEntriesFts WHERE Id = old.Id;
            END;
        ");
    }
}