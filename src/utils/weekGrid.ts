// Pomocnicze do widoków dzień/tydzień/miesiąc planu zajęć (2026-09-22, rozbudowane 2026-09-23
// — user: "domyślnie dzienna i można włączyć widok tygodniowy i miesięczny") — WYDZIELONE z
// app/class-schedule.tsx (importuje 'react-native', nietestowalny bezpośrednio w Jest, ten sam
// znany limit co streakTiers.ts) żeby matematyka dat (szczególnie przypadek niedzieli,
// `getDay()===0`, i granice miesięcy w siatce kalendarza) miała pokrycie testami.

const MONTH_NAMES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
// Dopełniacz ("23 WRZEŚNIA") — inna odmiana niż mianownik nagłówka miesiąca ("WRZESIEŃ 2026"),
// polski nie ma jednej wspólnej formy dla obu kontekstów.
const MONTH_GENITIVE = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const MONTH_NOMINATIVE = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const DAY_NAMES_FULL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']; // getDay(): 0=Nie..6=Sob

function pad(n: number) { return String(n).padStart(2, '0'); }

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
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

// "Środa, 23 września" — nagłówek widoku dziennego.
export function fmtDayLabel(d: Date): string {
  return `${DAY_NAMES_FULL[d.getDay()]}, ${d.getDate()} ${MONTH_GENITIVE[d.getMonth()]}`;
}

// "Wrzesień 2026" — nagłówek widoku miesięcznego.
export function fmtMonthLabel(d: Date): string {
  return `${MONTH_NOMINATIVE[d.getMonth()]} ${d.getFullYear()}`;
}

export interface MonthCell { ymd: string; inMonth: boolean; }

// Siatka kalendarza miesiąca, tygodniami Pon-Nie (jak widok tygodnia) — zaczyna od
// poniedziałku tygodnia zawierającego 1. dzień miesiąca, kończy na niedzieli tygodnia
// zawierającego OSTATNI dzień, więc zawsze pełne tygodnie (5 lub 6 rzędów, nigdy urwany).
// `inMonth=false` dla dni "doklejonych" z sąsiednich miesięcy (wyszarzone w UI, ale wciąż
// klikalne — user może mieć zajęcia w te dni widoczne z poprzedniego/następnego miesiąca).
export function monthGrid(anchor: Date): MonthCell[][] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const gridStart = mondayOf(firstOfMonth);
  const gridEnd = mondayOf(lastOfMonth); // poniedziałek OSTATNIEGO tygodnia — dociągamy do niedzieli niżej
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) + 7;

  const weeks: MonthCell[][] = [];
  let cursor = new Date(gridStart);
  for (let i = 0; i < totalDays; i++) {
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({ ymd: toYMD(cursor), inMonth: cursor.getMonth() === anchor.getMonth() });
    cursor = addDays(cursor, 1);
  }
  return weeks;
}
