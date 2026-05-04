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

export const todayISO = (): string => new Date().toISOString().split('T')[0];

export const monthRange = (iso: string): { from: string; to: string } => {
  const d = parseISO(iso);
  return {
    from: startOfMonth(d).toISOString(),
    to: endOfMonth(d).toISOString(),
  };
};
