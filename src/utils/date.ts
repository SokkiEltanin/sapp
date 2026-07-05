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
