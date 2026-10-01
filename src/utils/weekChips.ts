// Czysta logika zakresu tygodnia dla chipów terminu w formularzu zadania (app/tasks/add.tsx,
// 2026-10-01, §229) — wydzielona do osobnego pliku (bez importu 'react-native'), żeby dało
// się ją przetestować w Jest (ten sam powód co taskReward.ts/billTrends.ts: pliki importujące
// komponenty RN/expo-router padają w Jest na "Unexpected token 'export'").

function pad(n: number): string { return String(n).padStart(2, '0'); }

export function fmtDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Poniedziałek tygodnia zawierającego `d` (konwencja PL: tydzień zaczyna się w poniedziałek).
export function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Nd..6=Sb
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return m;
}

const MONTH_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
function fmtShortDate(d: Date): string { return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; }

// Zakres (pon–nd, czytelny do pokazania w nawiasie) i data niedzieli (koniec tygodnia =
// deadline "zrób to w tym/przyszłym tygodniu") dla tygodnia `weeksFromNow` tygodni od `now`.
// `now` jako parametr (domyślnie `new Date()`) zamiast odczytu wprost w ciele funkcji —
// ten sam wzorzec testowalności co `taskReward.ts`'s `completedAt: Date = new Date()`.
export function weekChipInfo(weeksFromNow: number, now: Date = new Date()): { range: string; sundayStr: string } {
  const monday = mondayOf(now);
  monday.setDate(monday.getDate() + weeksFromNow * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const range = monday.getMonth() === sunday.getMonth()
    ? `${monday.getDate()}–${sunday.getDate()} ${MONTH_SHORT[sunday.getMonth()]}`
    : `${fmtShortDate(monday)}–${fmtShortDate(sunday)}`;
  return { range, sundayStr: fmtDateStr(sunday) };
}
