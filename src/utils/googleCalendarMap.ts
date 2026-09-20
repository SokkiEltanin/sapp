// Wydzielone z googleCalendarService.ts (2026-09-20, audyt logika/optymalizacja) dla
// testowalności — ten plik importuje `@react-native-google-signin/google-signin`, natywny
// ESM moduł którego node-environment (jest.config.js's `testEnvironment: 'node'`) nie potrafi
// sparsować bez natywnego mocka (którego nie ma) — ten sam problem co `expo-notifications` w
// useHabits.ts/useTasks.ts. `mapEvent` jest czystą funkcją (dane → dane), więc żyje tu.
import { CalendarEvent } from '@/types';
import { ymd } from '@/utils/date';

export interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
  colorId?: string;
  status?: string;
}

const GCAL_COLORS: Record<string, string> = {
  '1': '#7986CB', '2': '#33B679', '3': '#8E24AA', '4': '#E67C73',
  '5': '#F6BF26', '6': '#F4511E', '7': '#039BE5', '8': '#616161',
  '9': '#3F51B5', '10': '#0B8043', '11': '#D50000',
};

// `endDate` (CalendarEvent, types/index.ts, "ostatni dzień wielodniowego eventu") nigdy nie
// było ustawiane przy imporcie z Google, więc `eventCoversDay`/`isMultiDay` nie widziały
// żadnego dnia poza startem — wielodniowy event utworzony wprost w Google Calendar (np.
// urlop 20→23.09) pokazywał się w tej apce TYLKO w dniu 20.09. Google's `end.date` dla
// eventów całodniowych jest EXCLUSIVE (1-dniowy event ma end=start+1, 3-dniowy 20→23 ma
// end=24) — nasze `endDate` jest INCLUSIVE (ostatni realny dzień), więc trzeba odjąć 1 dzień
// — dokładnie odwrotność tego co `createEvent`/`updateEvent` w googleCalendarService.ts już
// poprawnie ROBIĄ (+1 dzień) przy zapisie w drugą stronę. Dla eventów z godziną (nie
// całodniowych) `end.dateTime` jest już precyzyjnym momentem, nie exclusive-markerem — bez
// odejmowania.
export function mapEvent(e: GCalEvent): CalendarEvent {
  const allDay = !e.start.dateTime;
  const startIso = e.start.dateTime ?? (e.start.date! + 'T00:00:00');
  const endIso   = e.end.dateTime   ?? (e.end.date!   + 'T00:00:00');
  const startDay = startIso.slice(0, 10);

  let endDate: string | undefined;
  if (allDay) {
    const d = new Date(`${e.end.date!}T00:00:00`);
    d.setDate(d.getDate() - 1);
    const inclusiveEnd = ymd(d);
    if (inclusiveEnd > startDay) endDate = inclusiveEnd;
  } else {
    const endDay = endIso.slice(0, 10);
    if (endDay > startDay) endDate = endDay;
  }

  return {
    id: `gcal-${e.id}`,
    title: e.summary ?? '(bez tytułu)',
    description: e.description,
    date: startDay,
    endDate,
    startTime: allDay ? undefined : startIso.slice(11, 16),
    endTime:   allDay ? undefined : endIso.slice(11, 16),
    allDay,
    priority: 'normal',
    color: e.colorId ? GCAL_COLORS[e.colorId] : '#039BE5',
    createdAt: new Date().toISOString(),
  };
}
