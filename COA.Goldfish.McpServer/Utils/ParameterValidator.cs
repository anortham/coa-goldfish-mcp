using System.ComponentModel.DataAnnotations;
using COA.Mcp.Framework.Models;

namespace COA.Goldfish.McpServer.Utils;

/// <summary>
/// Utility class for validating tool parameters using data annotations
/// </summary>
public static class ParameterValidator
{
    /// <summary>
    /// Validates a parameter object using data annotations
    /// </summary>
    /// <param name="parameters">The parameter object to validate</param>
    /// <returns>ErrorInfo if validation fails, null if validation succeeds</returns>
    public static ErrorInfo? ValidateParameters<T>(T parameters) where T : class
    {
        var context = new ValidationContext(parameters);
        var results = new List<ValidationResult>();
        
        if (Validator.TryValidateObject(parameters, context, results, validateAllProperties: true))
        {
            return null; // Validation succeeded
        }

        // Combine all validation errors into a single message
        var errorMessages = results.Select(r => r.ErrorMessage).Where(m => !string.IsNullOrEmpty(m));
        var combinedMessage = string.Join("; ", errorMessages);

        return new ErrorInfo
        {
            Code = "VALIDATION_ERROR",
            Message = $"Parameter validation failed: {combinedMessage}"
        };
    }

    /// <summary>
    /// Validates that required parameters are provided for specific actions
    /// </summary>
    /// <param name="action">The action being performed</param>
    /// <param name="requiredParam">The parameter value that should not be null/empty</param>
    /// <param name="parameterName">The name of the parameter for error messages</param>
    /// <returns>ErrorInfo if validation fails, null if validation succeeds</returns>
    public static ErrorInfo? ValidateRequiredForAction(string action, string? requiredParam, string parameterName)
    {
        if (string.IsNullOrEmpty(requiredParam))
        {
            return new ErrorInfo
            {
                Code = $"MISSING_{parameterName.ToUpperInvariant()}",
                Message = $"{parameterName} is required for {action} action"
            };
        }
        return null;
    }

    /// <summary>
    /// Validates that a list parameter has items when required
    /// </summary>
    /// <param name="action">The action being performed</param>
    /// <param name="items">The list that should not be null or empty</param>
    /// <param name="parameterName">The name of the parameter for error messages</param>
    /// <returns>ErrorInfo if validation fails, null if validation succeeds</returns>
    public static ErrorInfo? ValidateRequiredList<T>(string action, List<T>? items, string parameterName)
    {
        if (items == null || items.Count == 0)
        {
            return new ErrorInfo
            {
                Code = $"MISSING_{parameterName.ToUpperInvariant()}",
                Message = $"{parameterName} list cannot be empty for {action} action"
            };
        }
        return null;
    }

    /// <summary>
    /// Validates that a string parameter meets minimum length requirements
    /// </summary>
    /// <param name="value">The string value to validate</param>
    /// <param name="minLength">The minimum required length</param>
    /// <param name="parameterName">The name of the parameter for error messages</param>
    /// <returns>ErrorInfo if validation fails, null if validation succeeds</returns>
    public static ErrorInfo? ValidateMinLength(string? value, int minLength, string parameterName)
    {
        if (!string.IsNullOrEmpty(value) && value.Length < minLength)
        {
            return new ErrorInfo
            {
                Code = "VALIDATION_ERROR",
                Message = $"{parameterName} must be at least {minLength} characters long"
            };
        }
        return null;
    }

    /// <summary>
    /// Validates that a string parameter is a valid action from a predefined set
    /// </summary>
    /// <param name="action">The action to validate</param>
    /// <param name="validActions">The set of valid actions</param>
    /// <returns>ErrorInfo if validation fails, null if validation succeeds</returns>
    public static ErrorInfo? ValidateAction(string action, params string[] validActions)
    {
        if (!validActions.Contains(action.ToLowerInvariant()))
        {
            return new ErrorInfo
            {
                Code = "INVALID_ACTION",
                Message = $"Unknown action: {action}. Valid actions are: {string.Join(", ", validActions)}"
            };
        }
        return null;
    }
}