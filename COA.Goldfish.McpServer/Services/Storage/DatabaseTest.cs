using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using COA.Goldfish.McpServer.Models;

namespace COA.Goldfish.McpServer.Services.Storage;

/// <summary>
/// Simple test class for database operations (for development verification)
/// </summary>
public class DatabaseTest
{
    /// <summary>
    /// Test basic database operations with in-memory database
    /// </summary>
    public static async Task<bool> TestInMemoryOperationsAsync()
    {
        try
        {
            // Create in-memory database context
            var options = new DbContextOptionsBuilder<GoldfishDbContext>()
                .UseInMemoryDatabase(databaseName: "GoldfishTest")
                .Options;

            using var context = new GoldfishDbContext(options);

            // Test basic entity creation
            var workspace = new WorkspaceState
            {
                WorkspaceId = "test-workspace",
                ActivePlanId = null,
                ActiveTodoListId = null,
                LastActivity = DateTime.UtcNow
            };

            var plan = new Plan
            {
                Id = Guid.NewGuid().ToString(),
                WorkspaceId = "test-workspace",
                Title = "Test Plan",
                Description = "A test plan for database verification",
                Category = "test",
                Priority = "normal",
                Status = PlanStatus.Active,
                Items = new List<string> { "Item 1", "Item 2" }
            };

            var todoList = new TodoList
            {
                Id = Guid.NewGuid().ToString(),
                WorkspaceId = "test-workspace",
                Title = "Test TODO List",
                Description = "A test TODO list",
                IsActive = true,
                Items = new List<TodoItem>
                {
                    new TodoItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Content = "Test item 1",
                        Status = TodoItemStatus.Pending,
                        Priority = TodoItemPriority.Normal
                    }
                }
            };

            // Set navigation property
            todoList.Items[0].TodoListId = todoList.Id;
            todoList.Items[0].TodoList = todoList;

            // Add entities
            context.WorkspaceStates.Add(workspace);
            context.Plans.Add(plan);
            context.TodoLists.Add(todoList);

            await context.SaveChangesAsync();

            // Verify data was saved
            var savedWorkspace = await context.WorkspaceStates.FirstOrDefaultAsync(w => w.WorkspaceId == "test-workspace");
            var savedPlan = await context.Plans.FirstOrDefaultAsync(p => p.WorkspaceId == "test-workspace");
            var savedTodoList = await context.TodoLists
                .Include(t => t.Items)
                .FirstOrDefaultAsync(t => t.WorkspaceId == "test-workspace");

            if (savedWorkspace == null || savedPlan == null || savedTodoList == null)
                return false;

            // Verify relationships
            if (savedTodoList.Items.Count != 1)
                return false;

            // Verify JSON serialization
            if (savedPlan.Items == null || savedPlan.Items.Count != 2)
                return false;

            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }
}