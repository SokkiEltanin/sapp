import { mapEvent, GCalEvent } from '@/utils/googleCalendarMap';

const gcalEvent = (o: Partial<GCalEvent>): GCalEvent => ({
  id: 'x', summary: 'Test', start: { date: '2026-09-20' }, end: { date: '2026-09-21' }, ...o,
});

// 2026-09-20, audyt logika/optymalizacja — `endDate` nigdy nie było ustawiane przy imporcie z
// Google, więc `eventCoversDay`/`isMultiDay` (types/index.ts) nie widziały żadnego dnia poza
// startem. Wielodniowy event utworzony wprost w Google Calendar (np. urlop 20→23.09) pokazywał
// się w tej apce TYLKO w dniu 20.09.
describe('mapEvent — wielodniowe eventy z Google (endDate)', () => {
  test('1-dniowy event całodniowy: Google end=start+1 (exclusive) → endDate NIE ustawione', () => {
    const e = mapEvent(gcalEvent({ start: { date: '2026-09-20' }, end: { date: '2026-09-21' } }));
    expect(e.date).toBe('2026-09-20');
    expect(e.endDate).toBeUndefined();
  });

  test('3-dniowy event całodniowy 20→23.09: Google end=24 (exclusive) → endDate=23 (inclusive)', () => {
    const e = mapEvent(gcalEvent({ start: { date: '2026-09-20' }, end: { date: '2026-09-24' } }));
    expect(e.date).toBe('2026-09-20');
    expect(e.endDate).toBe('2026-09-23');
  });

  test('event z godziną (nie całodniowy) trwający 2 dni → endDate = dzień końca, bez odejmowania', () => {
    const e = mapEvent(gcalEvent({
      start: { dateTime: '2026-09-20T22:00:00' },
      end: { dateTime: '2026-09-21T02:00:00' },
    }));
    expect(e.allDay).toBe(false);
    expect(e.date).toBe('2026-09-20');
    expect(e.endDate).toBe('2026-09-21');
  });

  test('event z godziną w obrębie jednego dnia → endDate NIE ustawione', () => {
    const e = mapEvent(gcalEvent({
      start: { dateTime: '2026-09-20T10:00:00' },
      end: { dateTime: '2026-09-20T11:00:00' },
    }));
    expect(e.endDate).toBeUndefined();
    expect(e.startTime).toBe('10:00');
    expect(e.endTime).toBe('11:00');
  });

  test('kolor mapowany z colorId, domyślny gdy brak', () => {
    expect(mapEvent(gcalEvent({ colorId: '2' })).color).toBe('#33B679');
    expect(mapEvent(gcalEvent({ colorId: undefined })).color).toBe('#039BE5');
  });

  test('id prefiksowane "gcal-", brak tytułu → placeholder', () => {
    const e = mapEvent(gcalEvent({ id: 'abc123', summary: undefined }));
    expect(e.id).toBe('gcal-abc123');
    expect(e.title).toBe('(bez tytułu)');
  });
});
