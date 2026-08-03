import { format, isToday, isYesterday, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { pl } from 'date-fns/locale';

export const formatDate = (iso: string): string => {
  const d = parseISO(iso);
  if (isToday(d)) return 'Dzisiaj';
  if (isYesterday(d)) return 'Wczoraj';
  return format(d, 'd MMM yyyy', { locale: pl });
};

export const formatShortDate = (iso: string): string =>
  format(parseISO(iso), 'd MMM', { locale: pl });

export const formatTime = (iso: string): string =>
  format(parseISO(iso), 'HH:mm');

export const formatMonthYear = (iso: string): string =>
  format(parseISO(iso), 'LLLL yyyy', { locale: pl });

// LOCAL calendar date (YYYY-MM-DD). Never use toISOString() for this — it's UTC and
// rolls the date over near local midnight (Poland is UTC+1/+2), so an entry made at
// ~1 AM would be dated the previous day.
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayISO = (): string => ymd(new Date());

// LOCAL wall-clock ISO (YYYY-MM-DDTHH:mm:ss, NO trailing Z). Use this — not
// toISOString() — for any stored timestamp whose first 10 chars must equal the LOCAL
// calendar day, because the whole app buckets days via `.slice(0, 10)`. toISOString() is
// UTC, so near local midnight (Poland UTC+1/+2) it rolls the date over → an entry made at
// 00:30 gets dated "yesterday" ("północ to nie północ"). parseISO() reads the no-Z string
// as local, so time-of-day display stays correct too.
export const localISO = (d: Date = new Date()): string =>
  `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

// LOCAL year-month (YYYY-MM).
export const monthISO = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const monthRange = (iso: string): { from: string; to: string } => {
  const d = parseISO(iso);
  return {
    from: startOfMonth(d).toISOString(),
    to: endOfMonth(d).toISOString(),
  };
};
