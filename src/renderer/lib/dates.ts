/**
 * Gets the local wall-clock date as YYYY-MM-DD.
 * This is used for date comparisons and should not rely on UTC conversion.
 */
export function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Extracts the date part (YYYY-MM-DD) from a full datetime string.
 * @param due The due date string (could be date-only or datetime)
 * @returns The date part of the due date
 */
export function datePart(due: string): string {
  return due.substring(0, 10)
}

/**
 * Checks if a due date is overdue compared to today.
 * @param due The due date string (YYYY-MM-DD or YYYY-MM-DDTHH:MM:00)
 * @param today The today date string (YYYY-MM-DD)
 * @returns true if the due date is before today
 */
export function isOverdue(due: string, today: string): boolean {
  return datePart(due) < today
}

/**
 * Formats a due date for display in the UI.
 * @param due The due date string (YYYY-MM-DD or YYYY-MM-DDTHH:MM:00)
 * @param hasTime Whether the due date has time information
 * @returns A formatted display string
 */
export function formatDueDate(due: string | null, hasTime: number | null): string {
  if (due === null) return 'No date'
  
  const dateOnly = datePart(due)
  
  // If it's a date-only value (no time component), just return the date
  if (hasTime === 0 || hasTime === null) {
    return dateOnly
  }
  
  // If it has time, format as date and time
  const time = due.substring(11, 16) // Extract HH:MM part
  return `${dateOnly} ${time}`
}