import { CalendarEvent } from '@/types';

// Work shifts often live in Google Calendar where the calendar event's own
// start/end time is a recurring default (e.g. 09:00–17:00) while the REAL worked
// hours are written into the title, e.g. "[JD] 10:00 - 21:00. (11h)". So the
// title is the source of truth: we read the "HH:MM - HH:MM" range (or a "(Nh)"
// marker) and only fall back to the event's own times when the title has neither.

// "HH:MM - HH:MM" (also accepts "od HH:MM do HH:MM").
const TIME_RANGE_RE = /(\d{1,2})[:.](\d{2})\s*(?:[-–—]|do)\s*(\d{1,2})[:.](\d{2})/i;
// Hour-only range "10-21" / "10 - 21" / "od 10 do 21" (no minutes).
const HOUR_RANGE_RE = /(?:^|\s|\])\s*(?:od\s*)?(\d{1,2})\s*(?:[-–—]|do)\s*(\d{1,2})(?=\s|\.|$|\()/i;
const HOURS_PAREN_RE = /\(\s*(\d+(?:[.,]\d+)?)\s*h\s*\)/i;

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Clock range parsed from the title, in minutes-from-midnight. End is pushed past
// 24h for overnight shifts so duration stays positive.
export function titleTimeRange(title?: string): { startMin: number; endMin: number } | null {
  if (!title) return null;
  const m = title.match(TIME_RANGE_RE);
  if (m) {
    const s = (+m[1]) * 60 + (+m[2]);
    let e = (+m[3]) * 60 + (+m[4]);
    if (e <= s) e += 24 * 60;
    return { startMin: s, endMin: e };
  }
  // Fallback: hour-only range like "[JD] 10-21". Both must be plausible hours.
  const h = title.match(HOUR_RANGE_RE);
  if (h) {
    const sh = +h[1], eh = +h[2];
    if (sh <= 24 && eh <= 24 && sh !== eh) {
      let s = sh * 60; let e = eh * 60;
      if (e <= s) e += 24 * 60;
      return { startMin: s, endMin: e };
    }
  }
  return null;
}

// The shift's clock range (HH:MM strings) preferring the title, then event times.
export function shiftClockRange(ev: Pick<CalendarEvent, 'title' | 'startTime' | 'endTime'>): { start: string; end: string } | null {
  const tr = titleTimeRange(ev.title);
  if (tr) return { start: minToHHMM(tr.startMin), end: minToHHMM(tr.endMin) };
  if (ev.startTime && ev.endTime) return { start: ev.startTime, end: ev.endTime };
  return null;
}

// Duration in minutes — title range first, then a "(Nh)" marker, then event times.
export function shiftMinutes(ev: Pick<CalendarEvent, 'title' | 'startTime' | 'endTime'>): number {
  const tr = titleTimeRange(ev.title);
  if (tr) return tr.endMin - tr.startMin;
  if (ev.title) {
    const h = ev.title.match(HOURS_PAREN_RE);
    if (h) return Math.round(parseFloat(h[1].replace(',', '.')) * 60);
  }
  if (ev.startTime && ev.endTime) {
    let d = hhmmToMin(ev.endTime) - hhmmToMin(ev.startTime);
    if (d < 0) d += 24 * 60;
    return Math.max(0, d);
  }
  return 0;
}

export function shiftHours(ev: Pick<CalendarEvent, 'title' | 'startTime' | 'endTime'>): number {
  return shiftMinutes(ev) / 60;
}

// Does this calendar event count as a work shift for the given settings?
export function isWorkEvent(
  ev: Pick<CalendarEvent, 'title' | 'startTime' | 'endTime' | 'color'>,
  opts: { workColor?: string; workPrefix?: string },
): boolean {
  const wc = opts.workColor;
  const wp = opts.workPrefix?.trim().toLowerCase();
  // A title with an explicit range/(Nh) is enough even when the event has no times.
  const hasTimes = (!!ev.startTime && !!ev.endTime) || !!titleTimeRange(ev.title) || HOURS_PAREN_RE.test(ev.title ?? '');
  if (!hasTimes) return false;
  if (wc && ev.color === wc) return true;
  if (wp && (ev.title ?? '').toLowerCase().startsWith(wp)) return true;
  return false;
}
