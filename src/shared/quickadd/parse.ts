import { Span, ParsedDue, ParsedRecur, ParseResult } from './types';

type Freq = 'hour' | 'day' | 'week' | 'month' | 'year';

interface Range {
  start: number;
  end: number;
}

interface Tok {
  text: string;
  start: number;
  end: number;
}

interface RecurBody {
  canonicalBody: string;
  freq: Freq;
  interval: number;
  byWeekday?: number[];
  at?: { hour: number; minute: number };
  ends?: string;
  consumedLen: number;
}

const WEEKDAY_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_FULL = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const WEEKDAY_PATTERN = `(?:${WEEKDAY_FULL.join('|')}|${WEEKDAY_ABBR.join('|')})`;
const MONTH_PATTERN = `(?:${MONTH_FULL.join('|')}|${MONTH_ABBR.join('|')})`;

const DATE_WORD_RE = new RegExp(
  `\\b(?:today|tomorrow|next\\s+${WEEKDAY_PATTERN}|${WEEKDAY_PATTERN}|${MONTH_PATTERN}\\s+\\d{1,2}(?:st|nd|rd|th)?)\\b`,
  'gi'
);

const TIME_SCAN_RE = /\b(?:noon|\d{1,2}(?::[0-5]\d)?\s?(?:am|pm)|(?:[01]?\d|2[0-3]):[0-5]\d)\b/gi;

const EVERY_RE = /\bevery(!)?\b/gi;

function overlaps(ranges: Range[], start: number, end: number): boolean {
  return ranges.some((r) => start < r.end && end > r.start);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function formatDate(date: Date, hasTime: boolean): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (hasTime) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:00`;
  }
  return `${year}-${month}-${day}`;
}

function monthIndex(word: string): number | null {
  const w = word.toLowerCase();
  let idx = MONTH_FULL.indexOf(w);
  if (idx !== -1) return idx;
  idx = MONTH_ABBR.indexOf(w);
  return idx !== -1 ? idx : null;
}

function weekdayIndexJS(word: string): number | null {
  const w = word.toLowerCase();
  let idx = WEEKDAY_FULL.indexOf(w);
  if (idx !== -1) return idx;
  idx = WEEKDAY_ABBR.indexOf(w);
  return idx !== -1 ? idx : null;
}

function jsToIso(jsIdx: number): number {
  return jsIdx === 0 ? 7 : jsIdx;
}

function stripComma(tok: string): string {
  return tok.replace(/,$/, '');
}

function unitFreq(word: string): Freq | null {
  const w = word.toLowerCase().replace(/s$/, '');
  if (w === 'hour' || w === 'day' || w === 'week' || w === 'month' || w === 'year') return w;
  return null;
}

function resolveWeekday(token: string, today: Date): Date | null {
  const targetIdx = weekdayIndexJS(token);
  if (targetIdx === null) return null;
  const todayIdx = today.getDay();
  let diff = (targetIdx - todayIdx + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(today, diff);
}

function resolveMonthDay(monthToken: string, dayToken: string, now: Date): Date | null {
  const idx = monthIndex(monthToken);
  if (idx === null) return null;
  const day = parseInt(dayToken.replace(/(st|nd|rd|th)$/i, ''), 10);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  const today = startOfDay(now);
  let candidate = new Date(today.getFullYear(), idx, day);
  if (candidate.getTime() <= today.getTime()) {
    candidate = new Date(today.getFullYear() + 1, idx, day);
  }
  return candidate;
}

function resolveDateWord(word: string, now: Date): Date | null {
  const w = word.toLowerCase().trim();
  const today = startOfDay(now);
  if (w === 'today') return today;
  if (w === 'tomorrow') return addDays(today, 1);
  if (w.startsWith('next ')) {
    return resolveWeekday(w.slice(5).trim(), today);
  }
  const monthDayMatch = /^([a-z]+)\s+(\d{1,2}(?:st|nd|rd|th)?)$/.exec(w);
  if (monthDayMatch) {
    return resolveMonthDay(monthDayMatch[1], monthDayMatch[2], now);
  }
  return resolveWeekday(w, today);
}

function matchTimeAtStart(s: string): { len: number; hour: number; minute: number } | null {
  const noonMatch = /^noon\b/i.exec(s);
  if (noonMatch) return { len: noonMatch[0].length, hour: 12, minute: 0 };

  const withColonPeriod = /^(\d{1,2}):([0-5]\d)\s*(am|pm)\b/i.exec(s);
  if (withColonPeriod) {
    let hour = parseInt(withColonPeriod[1], 10);
    const minute = parseInt(withColonPeriod[2], 10);
    const period = withColonPeriod[3].toLowerCase();
    if (hour < 1 || hour > 12) return null;
    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    return { len: withColonPeriod[0].length, hour, minute };
  }

  const withPeriod = /^(\d{1,2})\s?(am|pm)\b/i.exec(s);
  if (withPeriod) {
    let hour = parseInt(withPeriod[1], 10);
    const period = withPeriod[2].toLowerCase();
    if (hour < 1 || hour > 12) return null;
    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    return { len: withPeriod[0].length, hour, minute: 0 };
  }

  const twentyFourHour = /^([01]?\d|2[0-3]):([0-5]\d)\b/.exec(s);
  if (twentyFourHour) {
    return { len: twentyFourHour[0].length, hour: parseInt(twentyFourHour[1], 10), minute: parseInt(twentyFourHour[2], 10) };
  }

  return null;
}

function parseTimeToken(word: string): { hour: number; minute: number } | null {
  const m = matchTimeAtStart(word);
  if (m && m.len === word.length) return { hour: m.hour, minute: m.minute };
  return null;
}

function tokenize(s: string): Tok[] {
  const re = /\S+/g;
  const toks: Tok[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    toks.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return toks;
}

function parseDateTokens(toks: Tok[], idx: number, now: Date): { date: Date; nextIndex: number } | null {
  const first = toks[idx];
  if (!first) return null;
  const w0 = first.text.toLowerCase();
  const next = toks[idx + 1];
  if (next && monthIndex(w0) !== null && /^\d{1,2}(st|nd|rd|th)?$/i.test(next.text)) {
    const date = resolveMonthDay(w0, next.text, now);
    if (date) return { date, nextIndex: idx + 2 };
  }
  if (w0 === 'today') return { date: startOfDay(now), nextIndex: idx + 1 };
  if (w0 === 'tomorrow') return { date: addDays(startOfDay(now), 1), nextIndex: idx + 1 };
  if (weekdayIndexJS(w0) !== null) {
    const date = resolveWeekday(w0, startOfDay(now));
    if (date) return { date, nextIndex: idx + 1 };
  }
  return null;
}

function parseRecurBody(tail: string, now: Date): RecurBody | null {
  const toks = tokenize(tail);
  if (toks.length === 0) return null;

  let i: number;
  let freq: Freq;
  let interval = 1;
  let byWeekday: number[] | undefined;
  let at: { hour: number; minute: number } | undefined;
  let canonicalBody: string;

  const t0 = toks[0].text.toLowerCase();
  const t1 = toks[1] ? toks[1].text.toLowerCase() : undefined;

  if (t0 === 'morning') {
    freq = 'day';
    at = { hour: 9, minute: 0 };
    canonicalBody = 'day 9am';
    i = 1;
  } else if (t0 === 'weekday' || t0 === 'workday') {
    freq = 'week';
    byWeekday = [1, 2, 3, 4, 5];
    canonicalBody = t0;
    i = 1;
  } else if (t0 === 'last' && t1 === 'day') {
    freq = 'month';
    canonicalBody = 'last day';
    i = 2;
  } else if (/^\d+(st|nd|rd|th)$/.test(t0) && t1 !== undefined && weekdayIndexJS(t1) !== null) {
    freq = 'month';
    canonicalBody = `${t0} ${t1}`;
    i = 2;
  } else if (monthIndex(t0) !== null && t1 !== undefined && /^\d{1,2}$/.test(t1)) {
    freq = 'year';
    canonicalBody = `${t0} ${t1}`;
    i = 2;
  } else if (/^\d+$/.test(t0) && t1 !== undefined && unitFreq(t1) !== null) {
    interval = parseInt(t0, 10);
    freq = unitFreq(t1) as Freq;
    canonicalBody = `${t0} ${t1}`;
    i = 2;
  } else if (weekdayIndexJS(stripComma(t0)) !== null) {
    const weekdays: number[] = [];
    const parts: string[] = [];
    let j = 0;
    for (;;) {
      const tok = toks[j];
      if (!tok) break;
      const clean = stripComma(tok.text.toLowerCase());
      const wIdx = weekdayIndexJS(clean);
      if (wIdx === null) break;
      weekdays.push(jsToIso(wIdx));
      parts.push(tok.text.toLowerCase());
      const hadComma = /,$/.test(tok.text);
      j++;
      if (!hadComma) break;
    }
    if (weekdays.length === 0) return null;
    freq = 'week';
    byWeekday = weekdays;
    canonicalBody = parts.join(' ');
    i = j;
  } else if (unitFreq(t0) !== null) {
    freq = unitFreq(t0) as Freq;
    canonicalBody = t0;
    i = 1;
  } else {
    return null;
  }

  let ends: string | undefined;

  for (;;) {
    const tok = toks[i];
    if (!tok) break;
    const w = tok.text.toLowerCase();
    const nextTok = toks[i + 1];

    if (w === 'at' && nextTok) {
      const timeTok = parseTimeToken(nextTok.text);
      if (timeTok) {
        at = timeTok;
        canonicalBody += ` at ${nextTok.text.toLowerCase()}`;
        i += 2;
        continue;
      }
      break;
    }

    if (w === 'starting' && nextTok) {
      const result = parseDateTokens(toks, i + 1, now);
      if (result) {
        i = result.nextIndex;
        continue;
      }
      break;
    }

    if ((w === 'until' || w === 'ending') && nextTok) {
      const result = parseDateTokens(toks, i + 1, now);
      if (result) {
        ends = formatDate(result.date, false);
        canonicalBody += ` ending ${ends}`;
        i = result.nextIndex;
        continue;
      }
      break;
    }

    break;
  }

  const consumedLen = toks[i - 1].end;
  return { canonicalBody, freq, interval, byWeekday, at, ends, consumedLen };
}

function findRecurrence(text: string, claimed: Range[], now: Date): { span: Span; recur: ParsedRecur } | null {
  EVERY_RE.lastIndex = 0;
  let em: RegExpExecArray | null;
  while ((em = EVERY_RE.exec(text))) {
    const start = em.index;
    const triggerEnd = em.index + em[0].length;
    if (overlaps(claimed, start, triggerEnd)) continue;

    const afterMatch = /^\s+/.exec(text.slice(triggerEnd));
    if (!afterMatch) continue;

    const tailStart = triggerEnd + afterMatch[0].length;
    const tail = text.slice(tailStart);
    const strict = !!em[1];
    const parsed = parseRecurBody(tail, now);
    if (!parsed) continue;

    const end = tailStart + parsed.consumedLen;
    const canonical = `every${strict ? '!' : ''} ${parsed.canonicalBody}`;

    return {
      span: { start, end, kind: 'recur' },
      recur: {
        canonical,
        freq: parsed.freq,
        interval: parsed.interval,
        byWeekday: parsed.byWeekday,
        at: parsed.at,
        strict,
        ends: parsed.ends,
      },
    };
  }
  return null;
}

function findDue(text: string, claimed: Range[], now: Date): { span: Span; due: ParsedDue } | null {
  DATE_WORD_RE.lastIndex = 0;
  let dm: RegExpExecArray | null;
  while ((dm = DATE_WORD_RE.exec(text))) {
    const start = dm.index;
    let end = start + dm[0].length;
    if (overlaps(claimed, start, end)) continue;

    const base = resolveDateWord(dm[0], now);
    if (!base) continue;

    let hasTime = false;
    let finalDate = base;
    const rest = text.slice(end);
    const prefixMatch = /^\s+(?:at\s+)?/i.exec(rest);
    if (prefixMatch) {
      const afterPrefix = rest.slice(prefixMatch[0].length);
      const timeTok = matchTimeAtStart(afterPrefix);
      const timeStart = end + prefixMatch[0].length;
      const timeEnd = timeStart + (timeTok?.len ?? 0);
      if (timeTok && !overlaps(claimed, timeStart, timeEnd)) {
        hasTime = true;
        finalDate = new Date(base);
        finalDate.setHours(timeTok.hour, timeTok.minute, 0, 0);
        end = timeEnd;
      }
    }

    return {
      span: { start, end, kind: 'date' },
      due: { date: formatDate(finalDate, hasTime), hasTime },
    };
  }

  TIME_SCAN_RE.lastIndex = 0;
  let tm: RegExpExecArray | null;
  while ((tm = TIME_SCAN_RE.exec(text))) {
    const start = tm.index;
    const end = start + tm[0].length;
    if (overlaps(claimed, start, end)) continue;
    const timeTok = matchTimeAtStart(tm[0]);
    if (!timeTok || timeTok.len !== tm[0].length) continue;
    const base = startOfDay(now);
    base.setHours(timeTok.hour, timeTok.minute, 0, 0);
    return {
      span: { start, end, kind: 'date' },
      due: { date: formatDate(base, true), hasTime: true },
    };
  }

  return null;
}

function buildContent(text: string, spans: Span[]): string {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let result = '';
  let cursor = 0;
  for (const s of sorted) {
    result += text.slice(cursor, s.start);
    cursor = Math.max(cursor, s.end);
  }
  result += text.slice(cursor);
  return result.replace(/\s+/g, ' ').trim();
}

export function parse(text: string, opts?: { now?: Date }): ParseResult {
  const now = opts?.now ?? new Date();
  const claimed: Range[] = [];
  const spans: Span[] = [];
  const labelRefs: string[] = [];
  let projectRef: string | undefined;
  let priority: 1 | 2 | 3 | 4 | undefined;
  let duration: number | undefined;
  let due: ParsedDue | undefined;
  let recur: ParsedRecur | undefined;

  const priorityRe = /\bp([1-4])\b/i;
  const pm = priorityRe.exec(text);
  if (pm) {
    priority = parseInt(pm[1], 10) as 1 | 2 | 3 | 4;
    const span: Span = { start: pm.index, end: pm.index + pm[0].length, kind: 'priority' };
    spans.push(span);
    claimed.push(span);
  }

  const labelRe = /@(\S+)/g;
  let lm: RegExpExecArray | null;
  while ((lm = labelRe.exec(text))) {
    labelRefs.push(lm[1]);
    const span: Span = { start: lm.index, end: lm.index + lm[0].length, kind: 'label' };
    spans.push(span);
    claimed.push(span);
  }

  const projectRe = /#(\S+)/;
  const prm = projectRe.exec(text);
  if (prm) {
    projectRef = prm[1];
    const span: Span = { start: prm.index, end: prm.index + prm[0].length, kind: 'project' };
    spans.push(span);
    claimed.push(span);
  }

  const durationRe = /\b(\d+)([mh])\b/gi;
  let drm: RegExpExecArray | null;
  while ((drm = durationRe.exec(text))) {
    const start = drm.index;
    const end = start + drm[0].length;
    if (overlaps(claimed, start, end)) continue;
    const value = parseInt(drm[1], 10);
    duration = drm[2].toLowerCase() === 'h' ? value * 60 : value;
    const span: Span = { start, end, kind: 'duration' };
    spans.push(span);
    claimed.push(span);
    break;
  }

  const recurResult = findRecurrence(text, claimed, now);
  if (recurResult) {
    recur = recurResult.recur;
    spans.push(recurResult.span);
    claimed.push(recurResult.span);
  }

  const dueResult = findDue(text, claimed, now);
  if (dueResult) {
    due = dueResult.due;
    spans.push(dueResult.span);
    claimed.push(dueResult.span);
  }

  const content = buildContent(text, spans);
  spans.sort((a, b) => a.start - b.start);

  return { content, due, recur, priority, projectRef, labelRefs, duration, spans };
}
