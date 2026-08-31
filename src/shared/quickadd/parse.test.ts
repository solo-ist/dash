import { describe, it, expect } from 'vitest';
import { parse } from './parse';

const now = new Date(2026, 7, 6, 8, 0, 0); // Thursday 2026-08-06 local

describe('quickadd parser', () => {
  it('should parse basic recurrence', () => {
    const result = parse('standup every day', { now });
    expect(result).toEqual({
      content: 'standup',
      recur: {
        canonical: 'every day',
        freq: 'day',
        interval: 1,
        strict: false
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 8,
          end: 17,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse workday recurrence with time', () => {
    const result = parse('review every workday at 9am', { now });
    expect(result).toEqual({
      content: 'review',
      recur: {
        canonical: 'every workday at 9am',
        freq: 'week',
        interval: 1,
        byWeekday: [1, 2, 3, 4, 5],
        at: { hour: 9, minute: 0 },
        strict: false
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 7,
          end: 25,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse 3rd friday recurrence', () => {
    const result = parse('report every 3rd friday', { now });
    expect(result).toEqual({
      content: 'report',
      recur: {
        canonical: 'every 3rd friday',
        freq: 'month',
        interval: 1,
        strict: false
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 7,
          end: 21,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse strict recurrence', () => {
    const result = parse('sync every! 2 weeks', { now });
    expect(result).toEqual({
      content: 'sync',
      recur: {
        canonical: 'every! 2 weeks',
        freq: 'week',
        interval: 2,
        strict: true
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 5,
          end: 17,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse yearly recurrence', () => {
    const result = parse('taxes every jan 15', { now });
    expect(result).toEqual({
      content: 'taxes',
      recur: {
        canonical: 'every jan 15',
        freq: 'year',
        interval: 1,
        strict: false
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 6,
          end: 17,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse weekday list recurrence', () => {
    const result = parse('gym every mon, wed, fri at 8:30', { now });
    expect(result).toEqual({
      content: 'gym',
      recur: {
        canonical: 'every mon, wed, fri at 8:30',
        freq: 'week',
        interval: 1,
        byWeekday: [1, 3, 5],
        at: { hour: 8, minute: 30 },
        strict: false
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 4,
          end: 27,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse last day recurrence', () => {
    const result = parse('rent every last day', { now });
    expect(result).toEqual({
      content: 'rent',
      recur: {
        canonical: 'every last day',
        freq: 'month',
        interval: 1,
        strict: false
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 5,
          end: 18,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse recurrence with starting date', () => {
    const result = parse('invoice every 2 months starting aug 15', { now });
    expect(result).toEqual({
      content: 'invoice',
      recur: {
        canonical: 'every 2 months',
        freq: 'month',
        interval: 2,
        strict: false
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 8,
          end: 33,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse next weekday with time', () => {
    const result = parse('lunch next tuesday at noon', { now });
    expect(result).toEqual({
      content: 'lunch',
      due: {
        date: '2026-08-11T12:00:00',
        hasTime: true
      },
      recur: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 6,
          end: 24,
          kind: 'date'
        }
      ]
    });
  });

  it('should parse morning recurrence', () => {
    const result = parse('stretch every morning', { now });
    expect(result).toEqual({
      content: 'stretch',
      recur: {
        canonical: 'every day at 9am',
        freq: 'day',
        interval: 1,
        at: { hour: 9, minute: 0 },
        strict: false
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 8,
          end: 20,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse recurrence with ending date', () => {
    const result = parse('standup every day until sep 30', { now });
    expect(result).toEqual({
      content: 'standup',
      recur: {
        canonical: 'every day ending 2026-09-30',
        freq: 'day',
        interval: 1,
        strict: false,
        ends: '2026-09-30'
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 8,
          end: 28,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse hourly recurrence', () => {
    const result = parse('check logs every 6 hours', { now });
    expect(result).toEqual({
      content: 'check logs',
      recur: {
        canonical: 'every 6 hours',
        freq: 'hour',
        interval: 6,
        strict: false
      },
      due: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 11,
          end: 25,
          kind: 'recur'
        }
      ]
    });
  });

  it('should parse full combo', () => {
    const result = parse('buy milk tomorrow 5pm p1 #home @errands 30m', { now });
    expect(result).toEqual({
      content: 'buy milk',
      due: {
        date: '2026-08-07T17:00:00',
        hasTime: true
      },
      recur: undefined,
      priority: 1,
      projectRef: 'home',
      labelRefs: ['errands'],
      duration: 30,
      spans: [
        {
          start: 10,
          end: 18,
          kind: 'date'
        },
        {
          start: 19,
          end: 21,
          kind: 'priority'
        },
        {
          start: 22,
          end: 27,
          kind: 'project'
        },
        {
          start: 28,
          end: 35,
          kind: 'label'
        },
        {
          start: 36,
          end: 39,
          kind: 'duration'
        }
      ]
    });
  });

  it('should parse month and day', () => {
    const result = parse('aug 15', { now });
    expect(result).toEqual({
      content: '',
      due: {
        date: '2026-08-15',
        hasTime: false
      },
      recur: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: [
        {
          start: 0,
          end: 5,
          kind: 'date'
        }
      ]
    });
  });

  it('should handle plain input', () => {
    const result = parse('just a plain task', { now });
    expect(result).toEqual({
      content: 'just a plain task',
      due: undefined,
      recur: undefined,
      priority: undefined,
      projectRef: undefined,
      labelRefs: [],
      duration: undefined,
      spans: []
    });
  });

  it('should handle span offsets correctly', () => {
    const result = parse('water plants every day at 5pm', { now });
    expect(result.spans).toEqual([
      {
        start: 13,
        end: 30,
        kind: 'recur'
      }
    ]);
  });

  it('should capture multiple labels', () => {
    const result = parse('@a @b', { now });
    expect(result.labelRefs).toEqual(['a', 'b']);
    expect(result.spans).toEqual([
      {
        start: 0,
        end: 2,
        kind: 'label'
      },
      {
        start: 3,
        end: 5,
        kind: 'label'
      }
    ]);
  });

  it('should be case insensitive', () => {
    const result = parse('Tomorrow P2 EVERY DAY', { now });
    expect(result.due?.date).toEqual('2026-08-07');
    expect(result.priority).toBe(2);
    expect(result.recur).toEqual({
      canonical: 'every day',
      freq: 'day',
      interval: 1,
      strict: false
    });
  });
});