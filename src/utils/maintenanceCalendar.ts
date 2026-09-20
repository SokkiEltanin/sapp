import { addMonths } from 'date-fns';
import { Vehicle, MaintenanceItem, CalendarEvent } from '@/types';

// Derive read-only "service due" calendar events from vehicles + maintenance
// items, so upcoming oil changes / part replacements show up in the calendar.
// Ids are prefixed `maint:v:` / `maint:i:` so the screen can route taps to the
// right place (vehicles / items) instead of a non-existent /calendar/:id.

const COLOR = '#FBBF24';

// 2026-09-20, audyt logika/optymalizacja (konsolidacja duplikatów) — ta funkcja miała
// WŁASNĄ, ręczną kopię `setMonth` bez przycięcia (ten sam bug co §138/140, TRZECI niezależny
// plik z logiką terminów pojazdów obok `vehicleMatch.ts`/`recurringBills.ts`) — serwis/wymiana
// oleju z datą 29-31 dnia miesiąca dawała wydarzenie w kalendarzu kilka dni PO właściwym
// terminie. Teraz `date-fns`'s `addMonths` (poprawnie przycina), zaimportowane wprost —
// lokalna nazwa `addMonthsIso` żeby nie kolidować z importem.
function addMonthsIso(iso: string, months: number): string {
  return fmt(addMonths(new Date(iso.slice(0, 10) + 'T00:00:00'), months));
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return fmt(d);
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function maintenanceDueEvents(vehicles: Vehicle[], items: MaintenanceItem[]): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const mk = (id: string, title: string, date: string) =>
    out.push({ id, title, date, allDay: true, priority: 'normal', color: COLOR, createdAt: '' });

  for (const v of vehicles) {
    if (v.oilChangeDate && v.oilIntervalMonths) mk(`maint:v:${v.id}:oil`, `Wymiana oleju — ${v.name}`, addMonthsIso(v.oilChangeDate, v.oilIntervalMonths));
    for (const m of v.maintenance ?? []) {
      if (m.intervalMonths && m.date) mk(`maint:v:${v.id}:${m.id}`, `${m.label} — ${v.name}`, addMonthsIso(m.date, m.intervalMonths));
    }
  }
  for (const it of items) {
    if (it.intervalDays > 0 && it.lastChangedDate) mk(`maint:i:${it.id}`, `Wymiana: ${it.name}`, addDays(it.lastChangedDate, it.intervalDays));
  }
  return out;
}
