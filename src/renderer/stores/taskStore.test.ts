import { describe, it, expect } from 'vitest'
import { todayLocalDate } from '../lib/dates'

describe('taskStore', () => {
  describe('todayLocalDate', () => {
    it('should return a valid YYYY-MM-DD formatted date string', () => {
      const result = todayLocalDate()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      
      // Should be a valid date
      const date = new Date(result)
      expect(date instanceof Date).toBe(true)
      expect(isNaN(date.getTime())).toBe(false)
    })
  })
})