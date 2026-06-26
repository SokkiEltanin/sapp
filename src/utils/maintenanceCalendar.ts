import { Vehicle, MaintenanceItem, CalendarEvent } from '@/types';

// Derive read-only "service due" calendar events from vehicles + maintenance
// items, so upcoming oil changes / part replacements show up in the calendar.
// Ids are prefixed `maint:v:` / `maint:i:` so the screen can route taps to the
// right place (vehicles / items) instead of a non-existent /calendar/:id.

const COLOR = '#FBBF24';

function addMonths(iso: string, months: number): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return fmt(d);
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
    if (v.oilChangeDate && v.oilIntervalMonths) mk(`maint:v:${v.id}:oil`, `Wymiana oleju — ${v.name}`, addMonths(v.oilChangeDate, v.oilIntervalMonths));
    for (const m of v.maintenance ?? []) {
      if (m.intervalMonths && m.date) mk(`maint:v:${v.id}:${m.id}`, `${m.label} — ${v.name}`, addMonths(m.date, m.intervalMonths));
    }
  }
  for (const it of items) {
    if (it.intervalDays > 0 && it.lastChangedDate) mk(`maint:i:${it.id}`, `Wymiana: ${it.name}`, addDays(it.lastChangedDate, it.intervalDays));
  }
  return out;
}
