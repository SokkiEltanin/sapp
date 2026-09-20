import { maintenanceDueEvents } from '@/utils/maintenanceCalendar';
import { Vehicle, MaintenanceItem } from '@/types';

const vehicle = (o: Partial<Vehicle>): Vehicle => ({
  id: 'v1', name: 'Octavia', kind: 'car', tag: 'octavia', color: '#000',
  createdAt: '', updatedAt: '', ...o,
} as Vehicle);

const item = (o: Partial<MaintenanceItem>): MaintenanceItem => ({
  id: 'i1', name: 'Filtr', color: '#000', lastChangedDate: '2026-01-01', intervalDays: 30,
  createdAt: '', updatedAt: '', ...o,
} as MaintenanceItem);

// 2026-09-20, audyt logika/optymalizacja (konsolidacja duplikatów) — ta funkcja miała WŁASNĄ
// ręczną kopię "dodaj miesiące" bez przycięcia dnia (setMonth day-overflow), trzeci niezależny
// plik z tym samym bugiem co nextDeadline (useTasks.ts) i advanceNextBillingDate
// (recurringBills.ts). Naprawione date-fns's addMonths.
describe('maintenanceCalendar — maintenanceDueEvents nie gubi miesiąca przy dniu 29-31', () => {
  test('wymiana oleju: 31.08 + 6 mies. → 28.02 (przycięte), NIE 3.03 (przewinięte)', () => {
    const v = vehicle({ oilChangeDate: '2026-08-31', oilIntervalMonths: 6 });
    const events = maintenanceDueEvents([v], []);
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2027-02-28');
    expect(events[0].id).toBe('maint:v:v1:oil');
  });

  test('wpis serwisowy (VehicleMaintenance): 31.03 + 1 mies. → 30.04, NIE 1.05', () => {
    const v = vehicle({
      maintenance: [{ id: 'm1', vehicleId: 'v1', label: 'Wymiana opon', date: '2026-03-31', intervalMonths: 1, createdAt: '' } as any],
    });
    const events = maintenanceDueEvents([v], []);
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2026-04-30');
    expect(events[0].title).toBe('Wymiana opon — Octavia');
  });

  test('przedmiot domowy (dni, nie miesiące) — bez zmian, sumuje się wprost', () => {
    const it = item({ lastChangedDate: '2026-01-01', intervalDays: 30 });
    const events = maintenanceDueEvents([], [it]);
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2026-01-31');
    expect(events[0].id).toBe('maint:i:i1');
  });

  test('brak interwału/daty → brak wydarzenia dla tej pozycji', () => {
    const v = vehicle({ oilChangeDate: undefined, oilIntervalMonths: undefined });
    expect(maintenanceDueEvents([v], [])).toEqual([]);
  });
});
