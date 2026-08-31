import { Span, ParsedDue, ParsedRecur, ParseResult } from './types';


const DURATION_REGEX = /^(\d+)([mh])$/;
const TIME_REGEX = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/;
const MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];
const WEEKDAY_NAMES = [
  'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'
];

function parseTime(timeStr: string): { hour: number; minute: number } | null {
  const match = timeStr.match(TIME_REGEX);
  if (!match) return null;
  
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toLowerCase();
  
  if (period === 'pm' && hour !== 12) {
    hour += 12;
  } else if (period === 'am' && hour === 12) {
    hour = 0;
  }
  
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  
  return { hour, minute };
}

function parseDuration(durationStr: string): number | null {
  const match = durationStr.match(DURATION_REGEX);
  if (!match) return null;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  if (unit === 'm') {
    return value;
  } else if (unit === 'h') {
    return value * 60;
  }
  
  return null;
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

function isWeekdayToken(token: string): boolean {
  return WEEKDAY_NAMES.includes(token.toLowerCase());
}

function getWeekdayIndex(token: string): number | null {
  const lowerToken = token.toLowerCase();
  const index = WEEKDAY_NAMES.indexOf(lowerToken);
  return index === -1 ? null : index + 1; // 1=Monday, 7=Sunday
}

function parseRecur(text: string, _now: Date): { parsed: ParsedRecur; consumed: string } | null {
  const lowerText = text.toLowerCase();
  
  // Check for strict recurrence prefix
  let strict = false;
  let remainingText = lowerText;
  
  if (lowerText.startsWith('every! ')) {
    strict = true;
    remainingText = lowerText.substring(5); // Remove 'every! '
  } else if (lowerText.startsWith('every ')) {
    remainingText = lowerText.substring(5); // Remove 'every '
  } else {
    return null;
  }
  
  const parts = remainingText.split(/\s+/);
  let consumed = '';
  let freq: 'hour' | 'day' | 'week' | 'month' | 'year' = 'day';
  let interval = 1;
  let byWeekday: number[] | undefined = undefined;
  let at: { hour: number; minute: number } | undefined = undefined;
  let ends: string | undefined = undefined;
  let canonical = strict ? 'every!' : 'every';
  
  // Parse interval and frequency
  const firstPart = parts[0];
  if (firstPart === 'morning') {
    // Special case: 'every morning' = 'every day at 9am'
    freq = 'day';
    at = { hour: 9, minute: 0 };
    canonical += ' day at 9am';
    consumed = 'morning';
  } else if (firstPart === 'weekday' || firstPart === 'workday') {
    // 'every weekday' = 'every week byWeekday [1,2,3,4,5]'
    freq = 'week';
    byWeekday = [1, 2, 3, 4, 5];
    canonical += ' workday';
    consumed = firstPart;
  } else if (firstPart === 'last' && parts[1] === 'day') {
    // 'every last day'
    freq = 'month';
    consumed = 'last day';
    canonical += ' last day';
  } else if (firstPart === '1st' || firstPart === '2nd' || firstPart === '3rd' || firstPart === '4th') {
    // 'every 1st monday'
    const ordinal = firstPart;
    const weekdayStr = parts[1];
    if (weekdayStr && isWeekdayToken(weekdayStr)) {
      const weekdayIndex = getWeekdayIndex(weekdayStr);
      if (weekdayIndex !== null) {
        freq = 'month';
        canonical += ` ${ordinal} ${weekdayStr}`;
        consumed = `${ordinal} ${weekdayStr}`;
      }
    }
  } else if (MONTH_NAMES.includes(firstPart)) {
    // 'every jan 15'
    if (parts[1] && /^\d+$/.test(parts[1])) {
      freq = 'year';
      canonical += ` ${firstPart} ${parts[1]}`;
      consumed = `${firstPart} ${parts[1]}`;
    }
  } else if (firstPart === 'hour' || firstPart === 'day' || firstPart === 'week' || firstPart === 'month' || firstPart === 'year') {
    freq = firstPart as 'hour' | 'day' | 'week' | 'month' | 'year';
    consumed = firstPart;
  } else if (/^\d+$/.test(firstPart) && parts[1] && (parts[1] === 'hour' || parts[1] === 'day' || parts[1] === 'week' || parts[1] === 'month' || parts[1] === 'year')) {
    // 'every 3 days'
    interval = parseInt(firstPart, 10);
    freq = parts[1] as 'hour' | 'day' | 'week' | 'month' | 'year';
    consumed = `${firstPart} ${parts[1]}`;
  } else if (isWeekdayToken(firstPart)) {
    // 'every monday'
    const weekdayIndex = getWeekdayIndex(firstPart);
    if (weekdayIndex !== null) {
      freq = 'week';
      byWeekday = [weekdayIndex];
      canonical += ` ${firstPart}`;
      consumed = firstPart;
    }
  } else {
    // Try to match a weekday list like 'mon, wed, fri'
    const weekdayMatches = firstPart.match(/^(mon|tue|wed|thu|fri|sat|sun)(?:,\s*(mon|tue|wed|thu|fri|sat|sun))*$/);
    if (weekdayMatches) {
      const weekdays = firstPart.split(/\s*,\s*/);
      const weekdayIndices = weekdays.map(w => getWeekdayIndex(w)).filter(i => i !== null) as number[];
      if (weekdayIndices.length > 0) {
        freq = 'week';
        byWeekday = weekdayIndices;
        canonical += ` ${firstPart}`;
        consumed = firstPart;
      }
    } else {
      // Default: every day
      freq = 'day';
      consumed = firstPart;
    }
  }
  
  // Parse additional components
  let i = 0;
  let atPart = '';
  let untilPart = '';
  
  while (i < parts.length) {
    const part = parts[i];
    
    if (part === 'at' && i + 1 < parts.length) {
      atPart = parts[i + 1];
      if (parseTime(atPart)) {
        const time = parseTime(atPart)!;
        at = time;
        canonical += ` at ${atPart}`;
        consumed += ` at ${atPart}`;
        i += 2;
        continue;
      }
    } else if ((part === 'until' || part === 'ending') && i + 1 < parts.length) {
      untilPart = parts[i + 1];
      // For simplicity, we'll just use the part as-is for now
      // In a more robust implementation, we'd parse the date
      canonical += ` ${part} ${untilPart}`;
      consumed += ` ${part} ${untilPart}`;
      i += 2;
      continue;
    } else if (part === 'starting' && i + 1 < parts.length) {
      // Consume but don't add to canonical
      consumed += ` starting ${parts[i + 1]}`;
      i += 2;
      continue;
    }
    
    i++;
  }
  
  // Handle 'until' date
  if (untilPart) {
    // Simplified handling - in a full implementation we'd parse the actual date
    ends = untilPart; // This would be converted to proper date format in a real implementation
  }
  
  return {
    parsed: {
      canonical,
      freq,
      interval,
      byWeekday,
      at,
      strict,
      ends
    },
    consumed
  };
}

function parseDate(dateStr: string, now: Date): { parsed: ParsedDue; date: Date } | null {
  const lowerDateStr = dateStr.toLowerCase();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  // Handle "today"
  if (lowerDateStr === 'today') {
    return {
      parsed: { date: formatDate(today, false), hasTime: false },
      date: today
    };
  }
  
  // Handle "tomorrow"
  if (lowerDateStr === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      parsed: { date: formatDate(tomorrow, false), hasTime: false },
      date: tomorrow
    };
  }
  
  // Handle weekday names
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const shortWeekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  
  const weekdayIndex = weekdays.indexOf(lowerDateStr);
  if (weekdayIndex !== -1) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + ((weekdayIndex + 7 - today.getDay()) % 7));
    if (targetDate <= today) {
      targetDate.setDate(targetDate.getDate() + 7);
    }
    return {
      parsed: { date: formatDate(targetDate, false), hasTime: false },
      date: targetDate
    };
  }
  
  const shortWeekdayIndex = shortWeekdays.indexOf(lowerDateStr);
  if (shortWeekdayIndex !== -1) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + ((shortWeekdayIndex + 7 - today.getDay()) % 7));
    if (targetDate <= today) {
      targetDate.setDate(targetDate.getDate() + 7);
    }
    return {
      parsed: { date: formatDate(targetDate, false), hasTime: false },
      date: targetDate
    };
  }
  
  // Handle "next <weekday>"
  if (lowerDateStr.startsWith('next ')) {
    const weekdayStr = lowerDateStr.substring(5);
    const targetIndex = weekdays.indexOf(weekdayStr);
    if (targetIndex !== -1) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + ((targetIndex + 7 - today.getDay()) % 7));
      if (targetDate <= today) {
        targetDate.setDate(targetDate.getDate() + 7);
      }
      return {
        parsed: { date: formatDate(targetDate, false), hasTime: false },
        date: targetDate
      };
    }
  }
  
  // Handle month name + day
  const monthDayRegex = /^([a-z]+)\s+(\d+)$/;
  const monthDayMatch = lowerDateStr.match(monthDayRegex);
  
  if (monthDayMatch) {
    const monthName = monthDayMatch[1];
    const day = parseInt(monthDayMatch[2], 10);
    
    const monthIndex = MONTH_NAMES.indexOf(monthName);
    if (monthIndex !== -1) {
      const targetDate = new Date(today.getFullYear(), monthIndex, day);
      
      // If the date has already passed this year, move to next year
      if (targetDate <= today) {
        targetDate.setFullYear(today.getFullYear() + 1);
      }
      
      return {
        parsed: { date: formatDate(targetDate, false), hasTime: false },
        date: targetDate
      };
    }
  }
  
  // Handle time as part of the date (like "5pm")
  const time = parseTime(lowerDateStr);
  if (time) {
    const timeDate = new Date(today);
    timeDate.setHours(time.hour, time.minute, 0, 0);
    return {
      parsed: { date: formatDate(timeDate, true), hasTime: true },
      date: timeDate
    };
  }
  
  return null;
}

export function parse(text: string, opts?: { now?: Date }): ParseResult {
  const now = opts?.now || new Date();
  const spans: Span[] = [];
  const labelRefs: string[] = [];
  let projectRef: string | undefined = undefined;
  let priority: 1 | 2 | 3 | 4 | undefined = undefined;
  let duration: number | undefined = undefined;
  let due: ParsedDue | undefined = undefined;
  let recur: ParsedRecur | undefined = undefined;
  
  // First pass: extract tokens
  const tokens: { text: string; start: number; end: number; kind: string }[] = [];
  let remainingText = text;
  let offset = 0;
  
  // Parse priorities (p1-p4)
  const priorityRegex = /\b(p[1-4])\b/i;
  const priorityMatch = priorityRegex.exec(remainingText);
  if (priorityMatch) {
    const priorityValue = parseInt(priorityMatch[1][1], 10) as 1 | 2 | 3 | 4;
    priority = priorityValue;
    tokens.push({
      text: priorityMatch[0],
      start: offset + priorityMatch.index,
      end: offset + priorityMatch.index + priorityMatch[0].length,
      kind: 'priority'
    });
    remainingText = remainingText.substring(0, priorityMatch.index) + remainingText.substring(priorityMatch.index + priorityMatch[0].length);
    offset += priorityMatch.index;
  }
  
  // Parse labels (@label)
  const labelRegex = /@([^\s]+)/g;
  let labelMatch;
  while ((labelMatch = labelRegex.exec(remainingText)) !== null) {
    const label = labelMatch[1];
    labelRefs.push(label);
    tokens.push({
      text: labelMatch[0],
      start: offset + labelMatch.index,
      end: offset + labelMatch.index + labelMatch[0].length,
      kind: 'label'
    });
    remainingText = remainingText.substring(0, labelMatch.index) + remainingText.substring(labelMatch.index + labelMatch[0].length);
    offset += labelMatch.index;
  }
  
  // Parse project (#project)
  const projectRegex = /#([^\s]+)/;
  const projectMatch = projectRegex.exec(remainingText);
  if (projectMatch) {
    projectRef = projectMatch[1];
    tokens.push({
      text: projectMatch[0],
      start: offset + projectMatch.index,
      end: offset + projectMatch.index + projectMatch[0].length,
      kind: 'project'
    });
    remainingText = remainingText.substring(0, projectMatch.index) + remainingText.substring(projectMatch.index + projectMatch[0].length);
    offset += projectMatch.index;
  }
  
  // Parse duration (30m, 2h)
  const durationRegex = /\b(\d+[mh])\b/;
  const durationMatch = durationRegex.exec(remainingText);
  if (durationMatch) {
    const durationValue = parseDuration(durationMatch[1]);
    if (durationValue !== null) {
      duration = durationValue;
      tokens.push({
        text: durationMatch[0],
        start: offset + durationMatch.index,
        end: offset + durationMatch.index + durationMatch[0].length,
        kind: 'duration'
      });
      remainingText = remainingText.substring(0, durationMatch.index) + remainingText.substring(durationMatch.index + durationMatch[0].length);
      offset += durationMatch.index;
    }
  }
  
  // Parse recurrence
  const recurMatch = parseRecur(remainingText, now);
  if (recurMatch) {
    recur = recurMatch.parsed;
    tokens.push({
      text: recurMatch.consumed,
      start: offset,
      end: offset + recurMatch.consumed.length,
      kind: 'recur'
    });
    remainingText = remainingText.substring(recurMatch.consumed.length);
  }
  
  // Parse remaining as due date if not already parsed as recurrence
  if (!recur) {
    const dateMatch = parseDate(remainingText, now);
    if (dateMatch) {
      due = dateMatch.parsed;
      tokens.push({
        text: remainingText.substring(0, dateMatch.parsed.date.length),
        start: offset,
        end: offset + dateMatch.parsed.date.length,
        kind: 'date'
      });
      remainingText = '';
    }
  }
  
  // Add remaining text as content
  const content = remainingText.trim().replace(/\s+/g, ' ');
  
  // Build spans array from tokens
  spans.push(...tokens.map(token => ({
    start: token.start,
    end: token.end,
    kind: token.kind as Span['kind']
  })));
  
  // Sort spans by start position
  spans.sort((a, b) => a.start - b.start);
  
  return {
    content,
    due,
    recur,
    priority,
    projectRef,
    labelRefs,
    duration,
    spans
  };
}