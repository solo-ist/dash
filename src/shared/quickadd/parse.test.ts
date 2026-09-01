import { describe, it, expect } from 'vitest';
import { parse } from './parse';
import type { Span } from './types';

// Thursday 2026-08-06, fixed so every test is deterministic.
const now = new Date(2026, 7, 6, 8, 0, 0);

function spanText(input: string, span: Span): string {
  return input.slice(span.start, span.end);
}

function spansByKind(spans: Span[]): Partial<Record<Span['kind'], Span>> {
  const map: Partial<Record<Span['kind'], Span>> = {};
  for (const s of spans) map[s.kind] = s;
  return map;
}

describe('quick-add parser', () => {
  describe('recurrence grammar probe table (docs/research/mcp-ground-truth.md)', () => {
    it('every day', () => {
      const input = 'every day';
      const r = parse(input, { now });
      expect(r.recur).toEqual({
        canonical: 'every day',
        freq: 'day',
        interval: 1,
        byWeekday: undefined,
        at: undefined,
        strict: false,
        ends: undefined,
      });
      expect(r.due).toBeUndefined();
      expect(r.spans).toHaveLength(1);
      expect(r.spans[0].kind).toBe('recur');
      expect(spanText(input, r.spans[0])).toBe('every day');
      expect(r.content).toBe('');
    });

    it('every workday at 9am', () => {
      const input = 'every workday at 9am';
      const r = parse(input, { now });
      expect(r.recur?.canonical).toBe('every workday at 9am');
      expect(r.recur?.freq).toBe('week');
      expect(r.recur?.byWeekday).toEqual([1, 2, 3, 4, 5]);
      expect(r.recur?.at).toEqual({ hour: 9, minute: 0 });
      expect(r.recur?.strict).toBe(false);
      expect(spanText(input, r.spans[0])).toBe('every workday at 9am');
      expect(r.content).toBe('');
    });

    it('every 3rd friday', () => {
      const input = 'every 3rd friday';
      const r = parse(input, { now });
      expect(r.recur?.canonical).toBe('every 3rd friday');
      expect(r.recur?.freq).toBe('month');
      expect(r.recur?.interval).toBe(1);
      expect(spanText(input, r.spans[0])).toBe('every 3rd friday');
      expect(r.content).toBe('');
    });

    it('every! 2 weeks (strict)', () => {
      const input = 'every! 2 weeks';
      const r = parse(input, { now });
      expect(r.recur?.canonical).toBe('every! 2 weeks');
      expect(r.recur?.freq).toBe('week');
      expect(r.recur?.interval).toBe(2);
      expect(r.recur?.strict).toBe(true);
      expect(spanText(input, r.spans[0])).toBe('every! 2 weeks');
      expect(r.content).toBe('');
    });

    it('every jan 15', () => {
      const input = 'every jan 15';
      const r = parse(input, { now });
      expect(r.recur?.canonical).toBe('every jan 15');
      expect(r.recur?.freq).toBe('year');
      expect(r.recur?.interval).toBe(1);
      expect(spanText(input, r.spans[0])).toBe('every jan 15');
      expect(r.content).toBe('');
    });

    it('every mon, wed, fri at 8:30', () => {
      const input = 'every mon, wed, fri at 8:30';
      const r = parse(input, { now });
      expect(r.recur?.canonical).toBe('every mon, wed, fri at 8:30');
      expect(r.recur?.freq).toBe('week');
      expect(r.recur?.byWeekday).toEqual([1, 3, 5]);
      expect(r.recur?.at).toEqual({ hour: 8, minute: 30 });
      expect(spanText(input, r.spans[0])).toBe('every mon, wed, fri at 8:30');
      expect(r.content).toBe('');
    });

    it('every last day', () => {
      const input = 'every last day';
      const r = parse(input, { now });
      expect(r.recur?.canonical).toBe('every last day');
      expect(r.recur?.freq).toBe('month');
      expect(spanText(input, r.spans[0])).toBe('every last day');
      expect(r.content).toBe('');
    });

    it('every 2 months starting aug 15 (start-anchor folded out of canonical)', () => {
      const input = 'every 2 months starting aug 15';
      const r = parse(input, { now });
      expect(r.recur?.canonical).toBe('every 2 months');
      expect(r.recur?.freq).toBe('month');
      expect(r.recur?.interval).toBe(2);
      expect(r.due).toBeUndefined();
      expect(spanText(input, r.spans[0])).toBe(input);
      expect(r.content).toBe('');
    });

    it('next tuesday at noon (NL one-shot date, not a recurrence)', () => {
      const input = 'next tuesday at noon';
      const r = parse(input, { now });
      expect(r.recur).toBeUndefined();
      expect(r.due).toEqual({ date: '2026-08-11T12:00:00', hasTime: true });
      expect(r.spans[0].kind).toBe('date');
      expect(spanText(input, r.spans[0])).toBe(input);
      expect(r.content).toBe('');
    });

    it('every morning (alias canonicalizes to every day 9am)', () => {
      const input = 'every morning';
      const r = parse(input, { now });
      expect(r.recur?.canonical).toBe('every day 9am');
      expect(r.recur?.freq).toBe('day');
      expect(r.recur?.interval).toBe(1);
      expect(r.recur?.at).toEqual({ hour: 9, minute: 0 });
      expect(spanText(input, r.spans[0])).toBe('every morning');
      expect(r.content).toBe('');
    });

    it('every day until sep 30 (end bound canonicalized into the string)', () => {
      const input = 'every day until sep 30';
      const r = parse(input, { now });
      expect(r.recur?.canonical).toBe('every day ending 2026-09-30');
      expect(r.recur?.freq).toBe('day');
      expect(r.recur?.ends).toBe('2026-09-30');
      expect(r.due).toBeUndefined();
      expect(spanText(input, r.spans[0])).toBe(input);
      expect(r.content).toBe('');
    });

    it('every 6 hours (sub-daily)', () => {
      const input = 'every 6 hours';
      const r = parse(input, { now });
      expect(r.recur?.canonical).toBe('every 6 hours');
      expect(r.recur?.freq).toBe('hour');
      expect(r.recur?.interval).toBe(6);
      expect(spanText(input, r.spans[0])).toBe(input);
      expect(r.content).toBe('');
    });
  });

  describe('one-shot dates', () => {
    it('today', () => {
      const input = 'water plants today';
      const r = parse(input, { now });
      expect(r.due).toEqual({ date: '2026-08-06', hasTime: false });
      expect(r.content).toBe('water plants');
    });

    it('tomorrow', () => {
      const input = 'call mom tomorrow';
      const r = parse(input, { now });
      expect(r.due).toEqual({ date: '2026-08-07', hasTime: false });
      expect(r.content).toBe('call mom');
    });

    it('bare short weekday (fri)', () => {
      const input = 'send report fri';
      const r = parse(input, { now });
      expect(r.due).toEqual({ date: '2026-08-07', hasTime: false });
      expect(r.content).toBe('send report');
    });

    it('next tuesday at noon', () => {
      const input = 'dentist next tuesday at noon';
      const r = parse(input, { now });
      expect(r.due).toEqual({ date: '2026-08-11T12:00:00', hasTime: true });
      expect(r.content).toBe('dentist');
    });

    it('month + day (aug 15) within the current year', () => {
      const input = 'renew passport aug 15';
      const r = parse(input, { now });
      expect(r.due).toEqual({ date: '2026-08-15', hasTime: false });
      expect(r.content).toBe('renew passport');
    });

    it('month + day rolls to next year once the date has passed', () => {
      const input = 'anniversary jan 15';
      const r = parse(input, { now });
      expect(r.due).toEqual({ date: '2027-01-15', hasTime: false });
      expect(r.content).toBe('anniversary');
    });

    it('tomorrow 5pm (date + time combo)', () => {
      const input = 'standup tomorrow 5pm';
      const r = parse(input, { now });
      expect(r.due).toEqual({ date: '2026-08-07T17:00:00', hasTime: true });
      const dateSpan = r.spans.find((s) => s.kind === 'date')!;
      expect(spanText(input, dateSpan)).toBe('tomorrow 5pm');
      expect(r.content).toBe('standup');
    });
  });

  describe('other tokens', () => {
    it('priorities p1-p4 are case-insensitive and word-bounded', () => {
      expect(parse('fix bug p1', { now }).priority).toBe(1);
      expect(parse('cleanup P4', { now }).priority).toBe(4);
    });

    it('project ref (#project)', () => {
      const input = 'write report #work';
      const r = parse(input, { now });
      expect(r.projectRef).toBe('work');
      expect(r.content).toBe('write report');
    });

    it('multiple labels (@label)', () => {
      const input = 'plan trip @travel @errands @home';
      const r = parse(input, { now });
      expect(r.labelRefs).toEqual(['travel', 'errands', 'home']);
      expect(r.content).toBe('plan trip');
    });

    it('durations (30m, 2h)', () => {
      expect(parse('workout 30m', { now }).duration).toBe(30);
      expect(parse('deep work 2h', { now }).duration).toBe(120);
    });
  });

  it('full combo: buy milk tomorrow 5pm p1 #home @errands 30m', () => {
    const input = 'buy milk tomorrow 5pm p1 #home @errands 30m';
    const r = parse(input, { now });
    expect(r.content).toBe('buy milk');
    expect(r.due).toEqual({ date: '2026-08-07T17:00:00', hasTime: true });
    expect(r.priority).toBe(1);
    expect(r.projectRef).toBe('home');
    expect(r.labelRefs).toEqual(['errands']);
    expect(r.duration).toBe(30);

    expect(r.spans).toHaveLength(5);
    const byKind = spansByKind(r.spans);
    expect(spanText(input, byKind.date!)).toBe('tomorrow 5pm');
    expect(spanText(input, byKind.priority!)).toBe('p1');
    expect(spanText(input, byKind.project!)).toBe('#home');
    expect(spanText(input, byKind.label!)).toBe('@errands');
    expect(spanText(input, byKind.duration!)).toBe('30m');
  });

  it('plain input with no recognized tokens', () => {
    const input = 'just a plain task with no tokens';
    const r = parse(input, { now });
    expect(r.content).toBe(input);
    expect(r.spans).toEqual([]);
    expect(r.due).toBeUndefined();
    expect(r.recur).toBeUndefined();
    expect(r.priority).toBeUndefined();
    expect(r.projectRef).toBeUndefined();
    expect(r.labelRefs).toEqual([]);
    expect(r.duration).toBeUndefined();
  });

  it('is case-insensitive, and a one-shot date can coexist with a separate recurrence', () => {
    const input = 'Tomorrow P2 EVERY DAY';
    const r = parse(input, { now });
    expect(r.priority).toBe(2);
    expect(r.due).toEqual({ date: '2026-08-07', hasTime: false });
    expect(r.recur?.canonical).toBe('every day');
    expect(r.recur?.freq).toBe('day');
    expect(r.content).toBe('');
  });

  describe('span exactness', () => {
    it('every span points at exactly its recognized substring, nothing more or less', () => {
      const input = 'ship release p3 #dash @backend @urgent tomorrow 45m';
      const r = parse(input, { now });

      for (const span of r.spans) {
        expect(span.start).toBeGreaterThanOrEqual(0);
        expect(span.end).toBeLessThanOrEqual(input.length);
        expect(span.start).toBeLessThan(span.end);
      }

      const byKind = spansByKind(r.spans);
      expect(spanText(input, byKind.priority!)).toBe('p3');
      expect(spanText(input, byKind.project!)).toBe('#dash');
      expect(spanText(input, byKind.date!)).toBe('tomorrow');
      expect(spanText(input, byKind.duration!)).toBe('45m');
      expect(byKind.priority!.start).toBe(input.indexOf('p3'));
      expect(byKind.project!.start).toBe(input.indexOf('#dash'));
      expect(byKind.date!.start).toBe(input.indexOf('tomorrow'));
      expect(byKind.duration!.start).toBe(input.indexOf('45m'));
      expect(r.content).toBe('ship release');
    });

    it('a recurrence phrase mid-string spans exactly the phrase, leaving surrounding text as content', () => {
      const input = 'water the plants every 2 days at 8am please';
      const r = parse(input, { now });
      const recurSpan = r.spans.find((s) => s.kind === 'recur')!;
      expect(recurSpan.start).toBe(input.indexOf('every 2 days at 8am'));
      expect(spanText(input, recurSpan)).toBe('every 2 days at 8am');
      expect(r.recur?.canonical).toBe('every 2 days at 8am');
      expect(r.recur?.freq).toBe('day');
      expect(r.recur?.interval).toBe(2);
      expect(r.recur?.at).toEqual({ hour: 8, minute: 0 });
      expect(r.content).toBe('water the plants please');
    });
  });
});
