using COA.Goldfish.McpServer.Services.Storage;
using COA.Goldfish.McpServer.Models;
using COA.Mcp.Framework.Models;
using Microsoft.Extensions.Logging;

namespace COA.Goldfish.McpServer.Tools;

/// <summary>
/// Tool for plan operations - strategic planning
/// </summary>
public class PlanTool : GoldfishToolBase<PlanParameters, PlanResult>
{
    private readonly IStorageService _storage;
    private readonly ILogger<PlanTool> _logger;

    public PlanTool(IServiceProvider serviceProvider, ILogger<PlanTool> logger, IStorageService storage) 
        : base(serviceProvider, logger)
    {
        _storage = storage;
        _logger = logger;
    }

    public override string Name => "plan";
    public override string Description => @"Create strategic plans with structured methodology for complex features and architecture.

STRATEGIC PLANNING METHODOLOGY:
✅ ALWAYS plan before implementing complex features (3+ files, new patterns)
✅ Include problem statement, approach, risks, and success criteria
✅ Break into phases with concrete deliverables
✅ Generate todos automatically from plan items

PLANNING WORKFLOW:
1. Complex feature requested → create strategic plan first
2. Define problem clearly → research existing patterns
3. Design approach → identify risks and dependencies
4. Break into phases → generate concrete todos
5. Execute systematically → update plan with lessons learned

PLAN CATEGORIES:
- 'feature': New functionality development
- 'architecture': System design and refactoring
- 'research': Investigation and spike work
- 'bugfix': Complex bug resolution strategies

This tool prevents chaotic feature development through disciplined planning.";

    protected override async Task<PlanResult> ExecuteInternalAsync(
        PlanParameters parameters, 
        CancellationToken cancellationToken)
    {
        try
        {
            var workspaceId = parameters.Workspace ?? "default";
            var result = new PlanResult();

            switch (parameters.Action.ToLowerInvariant())
            {
                case "save":
                case "create":
                    if (string.IsNullOrEmpty(parameters.Title))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_TITLE",
                            Message = "Title is required for save action"
                        };
                        return result;
                    }

                    if (string.IsNullOrEmpty(parameters.Description))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_DESCRIPTION",
                            Message = "Description is required for save action"
                        };
                        return result;
                    }

                    // Deactivate current active plan
                    var currentActive = await _storage.GetActivePlanAsync(workspaceId);
                    if (currentActive != null)
                    {
                        currentActive.Status = PlanStatus.Complete;
                        await _storage.SavePlanAsync(currentActive);
                    }

                    var plan = new Plan
                    {
                        Id = Guid.NewGuid().ToString(),
                        WorkspaceId = workspaceId,
                        Title = parameters.Title,
                        Description = parameters.Description,
                        Category = parameters.Category ?? "general",
                        Priority = parameters.Priority,
                        Status = PlanStatus.Active,
                        Items = parameters.Items ?? new List<string>()
                    };

                    result.Plan = await _storage.SavePlanAsync(plan);
                    result.Message = $"Created plan '{parameters.Title}' with {plan.Items.Count} items";
                    break;

                case "list":
                    result.Plans = await _storage.GetPlansAsync(workspaceId, includeCompleted: true);
                    result.Message = $"Found {result.Plans.Count} plans";
                    break;

                case "update":
                    if (string.IsNullOrEmpty(parameters.PlanId))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_PLAN_ID",
                            Message = "PlanId is required for update action"
                        };
                        return result;
                    }

                    // Resolve smart keywords for plans
                    Plan? targetPlan = null;
                    if (parameters.PlanId.ToLowerInvariant() is "latest" or "recent" or "last")
                    {
                        var recentPlans = await _storage.GetPlansAsync(workspaceId, includeCompleted: true);
                        targetPlan = recentPlans.OrderByDescending(p => p.UpdatedAt).FirstOrDefault();
                    }
                    else if (parameters.PlanId.ToLowerInvariant() is "active" or "current")
                    {
                        targetPlan = await _storage.GetActivePlanAsync(workspaceId);
                    }
                    else
                    {
                        // Try direct lookup first, then keyword resolution
                        targetPlan = await _storage.GetPlanAsync(parameters.PlanId);
                        if (targetPlan == null)
                        {
                            targetPlan = await _storage.ResolvePlanKeywordAsync(workspaceId, parameters.PlanId);
                        }
                    }

                    if (targetPlan == null)
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "PLAN_NOT_FOUND",
                            Message = $"Plan '{parameters.PlanId}' not found"
                        };
                        return result;
                    }

                    // Update plan fields as provided
                    if (!string.IsNullOrEmpty(parameters.Title))
                        targetPlan.Title = parameters.Title;
                    if (!string.IsNullOrEmpty(parameters.Description))
                        targetPlan.Description = parameters.Description;
                    if (!string.IsNullOrEmpty(parameters.Category))
                        targetPlan.Category = parameters.Category;
                    if (!string.IsNullOrEmpty(parameters.Priority))
                        targetPlan.Priority = parameters.Priority;
                    if (parameters.Items != null)
                        targetPlan.Items = parameters.Items;
                    if (parameters.Discoveries != null)
                        targetPlan.Discoveries = parameters.Discoveries;

                    targetPlan.UpdatedAt = DateTime.UtcNow;
                    result.Plan = await _storage.SavePlanAsync(targetPlan);
                    result.Message = $"Updated plan '{targetPlan.Title}'";
                    break;

                case "complete":
                    if (string.IsNullOrEmpty(parameters.PlanId))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_PLAN_ID",
                            Message = "PlanId is required for complete action"
                        };
                        return result;
                    }

                    var planToComplete = await ResolvePlanAsync(workspaceId, parameters.PlanId);
                    if (planToComplete == null)
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "PLAN_NOT_FOUND",
                            Message = $"Plan '{parameters.PlanId}' not found"
                        };
                        return result;
                    }

                    planToComplete.Status = PlanStatus.Complete;
                    planToComplete.UpdatedAt = DateTime.UtcNow;
                    result.Plan = await _storage.SavePlanAsync(planToComplete);
                    result.Message = $"Completed plan '{planToComplete.Title}'";
                    break;

                case "generate-todos":
                    if (string.IsNullOrEmpty(parameters.PlanId))
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "MISSING_PLAN_ID",
                            Message = "PlanId is required for generate-todos action"
                        };
                        return result;
                    }

                    var sourcePlan = await ResolvePlanAsync(workspaceId, parameters.PlanId);
                    if (sourcePlan == null)
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "PLAN_NOT_FOUND",
                            Message = $"Plan '{parameters.PlanId}' not found"
                        };
                        return result;
                    }

                    if (sourcePlan.Items.Count == 0)
                    {
                        result.Success = false;
                        result.Error = new ErrorInfo
                        {
                            Code = "NO_ITEMS",
                            Message = "Plan has no items to generate TODOs from"
                        };
                        return result;
                    }

                    // Deactivate current active TODO list
                    var currentActiveTodos = await _storage.GetActiveTodoListAsync(workspaceId);
                    if (currentActiveTodos != null)
                    {
                        currentActiveTodos.IsActive = false;
                        await _storage.SaveTodoListAsync(currentActiveTodos);
                    }

                    // Create TODO list from plan items
                    var todoList = new TodoList
                    {
                        Id = Guid.NewGuid().ToString(),
                        WorkspaceId = workspaceId,
                        Title = $"Tasks for: {sourcePlan.Title}",
                        Description = $"Generated from plan '{sourcePlan.Title}'",
                        IsActive = true,
                        Items = sourcePlan.Items.Select(item => new TodoItem
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

                    result.GeneratedTodos = await _storage.SaveTodoListAsync(todoList);
                    result.Message = $"Generated TODO list with {sourcePlan.Items.Count} tasks from plan '{sourcePlan.Title}'";
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
            _logger.LogError(ex, "Plan operation failed");
            return new PlanResult
            {
                Success = false,
                Error = new ErrorInfo
                {
                    Code = "PLAN_ERROR",
                    Message = ex.Message
                }
            };
        }
    }

    private async Task<Plan?> ResolvePlanAsync(string workspaceId, string planId)
    {
        if (planId.ToLowerInvariant() is "latest" or "recent" or "last")
        {
            var recentPlans = await _storage.GetPlansAsync(workspaceId, includeCompleted: true);
            return recentPlans.OrderByDescending(p => p.UpdatedAt).FirstOrDefault();
        }
        else if (planId.ToLowerInvariant() is "active" or "current")
        {
            return await _storage.GetActivePlanAsync(workspaceId);
        }
        else
        {
            var plan = await _storage.GetPlanAsync(planId);
            if (plan == null)
            {
                plan = await _storage.ResolvePlanKeywordAsync(workspaceId, planId);
            }
            return plan;
        }
    }
}