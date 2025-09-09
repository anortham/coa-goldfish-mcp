/**
 * Date utilities for consistent date handling across the Goldfish MCP
 * 
 * DESIGN DECISIONS:
 * - All dates are stored and processed as UTC ISO strings to avoid timezone issues
 * - Local timezone is only used for display formatting (Today/Yesterday/Weekday)
 * - Date keys are always in YYYY-MM-DD format in UTC
 */

/**
 * Extract UTC date string (YYYY-MM-DD) from a Date object
 * This is the canonical way to get date keys for grouping and storage
 */
export function getUTCDateKey(date: Date): string {
  try {
    const parts = date.toISOString().split('T');
    return parts[0] || 'unknown';
  } catch (error) {
    console.warn('Invalid date provided to getUTCDateKey:', date, error);
    return 'unknown';
  }
}

/**
 * Extract local date string (YYYY-MM-DD) from a Date object
 * This groups memories by local calendar date, which is more user-intuitive for timelines
 */
export function getLocalDateKey(date: Date): string {
  try {
    // Check if the date is valid first
    if (isNaN(date.getTime())) {
      return 'unknown';
    }
    
    // Use local date components to build YYYY-MM-DD string
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('Invalid date provided to getLocalDateKey:', date, error);
    return 'unknown';
  }
}

/**
 * Get today's UTC date key
 */
export function getTodayUTCDateKey(): string {
  return getUTCDateKey(new Date());
}

/**
 * Get today's local date key
 */
export function getTodayLocalDateKey(): string {
  return getLocalDateKey(new Date());
}

/**
 * Format a date key as a human-readable day name
 * Works with both UTC and local date keys for "Today"/"Yesterday" comparison
 */
export function formatDateName(dateKey: string): string {
  try {
    // Validate the date key format first
    if (!isValidUTCDateKey(dateKey)) {
      return dateKey; // Return as-is for invalid formats
    }
    
    // Get today and yesterday in local timezone for comparison
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Compare using local date keys for user-intuitive behavior
    const todayLocalKey = getLocalDateKey(today);
    const yesterdayLocalKey = getLocalDateKey(yesterday);

    if (dateKey === todayLocalKey) {
      return 'Today';
    } else if (dateKey === yesterdayLocalKey) {
      return 'Yesterday';
    } else {
      // Parse the date and use local timezone for weekday display
      const targetDate = new Date(dateKey + 'T12:00:00.000Z');
      
      // Double-check that the date is valid after parsing
      if (isNaN(targetDate.getTime())) {
        return dateKey;
      }
      
      return targetDate.toLocaleDateString('en-US', { weekday: 'long' });
    }
  } catch (error) {
    console.warn('Invalid date key provided to formatDateName:', dateKey, error);
    return dateKey; // Fallback to the raw date string
  }
}

/**
 * Check if two dates are on the same UTC day
 */
export function isSameUTCDay(date1: Date, date2: Date): boolean {
  return getUTCDateKey(date1) === getUTCDateKey(date2);
}

/**
 * Parse a date string and return a Date object, with fallback for invalid dates
 */
export function safeParseDate(dateString: string): Date {
  try {
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) {
      throw new Error('Invalid date');
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse date:', dateString, error);
    return new Date(); // Fallback to current date
  }
}

/**
 * Validate that a UTC date key is in the correct format (YYYY-MM-DD)
 */
export function isValidUTCDateKey(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}