export interface Span {
  start: number;
  end: number;
  kind: 'date' | 'recur' | 'priority' | 'project' | 'label' | 'duration';
}

export interface ParsedDue {
  date: string;
  hasTime: boolean;
}

export interface ParsedRecur {
  canonical: string;
  freq: 'hour' | 'day' | 'week' | 'month' | 'year';
  interval: number;
  byWeekday?: number[];
  at?: { hour: number; minute: number };
  strict: boolean;
  ends?: string;
}

export interface ParseResult {
  content: string;
  due?: ParsedDue;
  recur?: ParsedRecur;
  priority?: 1 | 2 | 3 | 4;
  projectRef?: string;
  labelRefs: string[];
  duration?: number;
  spans: Span[];
}