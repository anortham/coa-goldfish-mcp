using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Services;
using COA.Goldfish.McpServer.Models;
using COA.Goldfish.McpServer.Utils;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Tools;

/// <summary>
/// Tool for todo operations - smart task management
/// </summary>
public class TodoTool : GoldfishToolBase<TodoParameters, TodoResult>
{
    private readonly IStorageService _storage;
    private readonly WorkspaceService _workspaceService;
    private readonly ILogger<TodoTool> _logger;

    public TodoTool(IServiceProvider serviceProvider, ILogger<TodoTool> logger, 
        IStorageService storage, WorkspaceService workspaceService) 
        : base(serviceProvider, logger)
    {
        _storage = storage;
        _workspaceService = workspaceService;
        _logger = logger;
    }

    public override string Name => "todo";
    public override string Description => "Manage tasks efficiently. Create lists, track progress, mark complete. Use keywords \"latest\" and \"active\" to reference lists quickly.";

    protected override async Task<TodoResult> ExecuteInternalAsync(
        TodoParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            // Validate parameters using data annotations
            var validationError = ParameterValidator.ValidateParameters(parameters);
            if (validationError != null)
            {
                return new TodoResult
                {
                    Success = false,
                    Error = validationError
                };
            }

            var workspaceId = _workspaceService.ResolveWorkspaceId(parameters.Workspace);
            var result = new TodoResult { Success = true };

            switch (parameters.Action.ToLowerInvariant())
            {
                case "create":
                    if (string.IsNullOrEmpty(parameters.Title))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_TITLE",
                            Message = "Title is required for create action"
                        };
                        return result;
                    }

                    if (parameters.Items == null || parameters.Items.Count == 0)
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_ITEMS",
                            Message = "Items are required for create action"
                        };
                        return result;
                    }

                    // Deactivate current active list
                    var currentActive = await _storage.GetActiveTodoListAsync(workspaceId);
                    if (currentActive != null)
                    {
                        currentActive.IsActive = false;
                        await _storage.SaveTodoListAsync(currentActive);
                    }

                    var todoList = new TodoList
                    {
                        Id = Guid.NewGuid().ToString(),
                        WorkspaceId = workspaceId,
                        Title = parameters.Title,
                        IsActive = true,
                        Items = parameters.Items.Select((item, index) => new TodoItem
                        {
                            Id = Guid.NewGuid().ToString(),
                            Content = item,
                            Status = TodoItemStatus.Pending,
                            Priority = TodoItemPriority.Normal
                        }).ToList()
                    };

                    // Set navigation properties
                    foreach (var item in todoList.Items)
                    {
                        item.TodoListId = todoList.Id;
                        item.TodoList = todoList;
                    }

                    result.TodoList = await _storage.SaveTodoListAsync(todoList);
                    result.Message = $"Created TODO list '{parameters.Title}' with {parameters.Items.Count} items";
                    break;

                case "view":
                case "list":
                    result.TodoLists = await _storage.GetTodoListsAsync(workspaceId, includeCompleted: true);
                    result.Message = $"Found {result.TodoLists.Count} TODO lists";
                    break;

                case "update":
                    if (string.IsNullOrEmpty(parameters.ListId))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_LIST_ID",
                            Message = "ListId is required for update action"
                        };
                        return result;
                    }

                    // Resolve smart keywords
                    TodoList? targetList = null;
                    if (parameters.ListId.ToLowerInvariant() is "latest" or "recent" or "last")
                    {
                        targetList = await _storage.GetLatestTodoListAsync(workspaceId);
                    }
                    else if (parameters.ListId.ToLowerInvariant() is "active" or "current")
                    {
                        targetList = await _storage.GetActiveTodoListAsync(workspaceId);
                    }
                    else
                    {
                        // Try direct lookup first, then keyword resolution
                        targetList = await _storage.GetTodoListAsync(parameters.ListId);
                        if (targetList == null)
                        {
                            targetList = await _storage.ResolveTodoListKeywordAsync(workspaceId, parameters.ListId);
                        }
                    }

                    if (targetList == null)
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "TODO_LIST_NOT_FOUND",
                            Message = $"TODO list '{parameters.ListId}' not found"
                        };
                        return result;
                    }

                    // Handle different update operations
                    if (!string.IsNullOrEmpty(parameters.NewTask))
                    {
                        var newItem = new TodoItem
                        {
                            Id = Guid.NewGuid().ToString(),
                            TodoListId = targetList.Id,
                            Content = parameters.NewTask,
                            Status = TodoItemStatus.Pending,
                            Priority = TodoItemPriority.Normal,
                            TodoList = targetList
                        };
                        
                        targetList.Items.Add(newItem);
                        await _storage.SaveTodoItemAsync(newItem);
                        result.Message = $"Added task '{parameters.NewTask}' to list '{targetList.Title}'";
                    }
                    else if (!string.IsNullOrEmpty(parameters.ItemId) && !string.IsNullOrEmpty(parameters.Status))
                    {
                        var item = targetList.Items.FirstOrDefault(i => i.Id == parameters.ItemId);
                        if (item == null)
                        {
                            result.Success = false;
                            result.Error = new ErrorInfo
                            {
                                Code = "ITEM_NOT_FOUND",
                                Message = $"Item '{parameters.ItemId}' not found in list"
                            };
                            return result;
                        }

                        if (Enum.TryParse<TodoItemStatus>(parameters.Status, true, out var status))
                        {
                            item.Status = status;
                            item.UpdatedAt = DateTime.UtcNow;
                            await _storage.SaveTodoItemAsync(item);
                            result.Message = $"Updated item status to '{status}'";
                        }
                        else
                        {
                            result.Success = false;
                            result.Error = new ErrorInfo
                            {
                                Code = "INVALID_STATUS",
                                Message = $"Invalid status '{parameters.Status}'. Valid values: Pending, Active, Done"
                            };
                            return result;
                        }
                    }

                    result.TodoList = targetList;
                    break;

                default:
                    result.Success = false;
                    result.Error = new ErrorInfo
                    {
                        Code = "INVALID_ACTION",
                        Message = $"Unknown action: {parameters.Action}"
                    };
                    break;
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TODO operation failed");
            return new TodoResult
            {
                Success = false,
                Error = new ErrorInfo
                {
                    Code = "TODO_ERROR",
                    Message = ex.Message
                }
            };
        }
    }
}