import { describe, it, expect } from 'vitest'
import { todayLocalDate, datePart, isOverdue, formatDueDate } from './dates'

describe('dates', () => {
  describe('todayLocalDate', () => {
    it('returns today\'s date in YYYY-MM-DD format', () => {
      const today = todayLocalDate()
      // Should be in YYYY-MM-DD format
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      
      // Should be a valid date
      const date = new Date(today)
      expect(date instanceof Date).toBe(true)
      expect(isNaN(date.getTime())).toBe(false)
    })
  })

  describe('datePart', () => {
    it('extracts date part from datetime string', () => {
      expect(datePart('2023-10-15T14:30:00')).toBe('2023-10-15')
      expect(datePart('2023-10-15')).toBe('2023-10-15')
      expect(datePart('2023-12-31T23:59:59')).toBe('2023-12-31')
    })
  })

  describe('isOverdue', () => {
    it('correctly identifies overdue dates', () => {
      const today = '2023-10-15'
      
      // Before today should be overdue
      expect(isOverdue('2023-10-14T12:00:00', today)).toBe(true)
      expect(isOverdue('2023-10-14', today)).toBe(true)
      
      // On today should not be overdue
      expect(isOverdue('2023-10-15T12:00:00', today)).toBe(false)
      expect(isOverdue('2023-10-15', today)).toBe(false)
      
      // After today should not be overdue
      expect(isOverdue('2023-10-16T12:00:00', today)).toBe(false)
      expect(isOverdue('2023-10-16', today)).toBe(false)
    })
  })

  describe('formatDueDate', () => {
    it('formats dates correctly with time', () => {
      expect(formatDueDate('2023-10-15T14:30:00', 1)).toBe('2023-10-15 14:30')
      expect(formatDueDate('2023-10-15T09:15:00', 1)).toBe('2023-10-15 09:15')
    })

    it('formats dates correctly without time', () => {
      expect(formatDueDate('2023-10-15', 0)).toBe('2023-10-15')
      expect(formatDueDate('2023-10-15T00:00:00', 0)).toBe('2023-10-15')
    })

    it('handles null values', () => {
      expect(formatDueDate(null, null)).toBe('No date')
      expect(formatDueDate(null, 1)).toBe('No date')
      expect(formatDueDate(null, 0)).toBe('No date')
    })
  })
})