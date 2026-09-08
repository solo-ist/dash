import { describe, it, expect } from 'vitest'
import { isOverdue, datePart, formatDueDate } from '../../lib/dates'

describe('TodayView wall-time logic', () => {
  it('classifies a task due before today as overdue', () => {
    expect(isOverdue('2023-10-10T10:00:00', '2023-10-15')).toBe(true)
  })

  it('does not classify a task due today as overdue', () => {
    expect(isOverdue('2023-10-15T14:00:00', '2023-10-15')).toBe(false)
  })

  it('does not classify a future task as overdue', () => {
    expect(isOverdue('2023-10-16', '2023-10-15')).toBe(false)
  })

  it('extracts the date part from a datetime string', () => {
    expect(datePart('2023-10-15T14:00:00')).toBe('2023-10-15')
    expect(datePart('2023-10-15')).toBe('2023-10-15')
  })

  it('formats due dates for display', () => {
    expect(formatDueDate(null, null)).toBe('No date')
    expect(formatDueDate('2023-10-15', 0)).toBe('2023-10-15')
    expect(formatDueDate('2023-10-15T14:30:00', 1)).toBe('2023-10-15 14:30')
  })
})