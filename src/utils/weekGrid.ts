// Pomocnicze do widoku tygodnia planu zajęć (2026-09-22) — WYDZIELONE z app/class-schedule.tsx
// (importuje 'react-native', nietestowalny bezpośrednio w Jest, ten sam znany limit co
// streakTiers.ts) żeby matematyka dat (szczególnie przypadek niedzieli, `getDay()===0`) miała
// pokrycie testami — najbardziej podatne na błąd o jeden miejsce w całym ekranie.

const MONTH_NAMES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

function pad(n: number) { return String(n).padStart(2, '0'); }

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Poniedziałek tygodnia zawierającego `d` — `getDay()` zwraca 0 dla NIEDZIELI (nie 7), więc
// naiwne `1 - dow` cofnęłoby niedzielę o -6 zamiast do WCZEŚNIEJSZEGO poniedziałku (o 1 dzień
// wstecz, nie do przodu) bez specjalnego przypadku.
export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function fmtWeekRange(monday: Date): string {
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const a = `${monday.getDate()}${sameMonth ? '' : ` ${MONTH_NAMES[monday.getMonth()]}`}`;
  const b = `${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()]} ${sunday.getFullYear()}`;
  return `${a} – ${b}`;
}
