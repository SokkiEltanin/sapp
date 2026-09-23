// Plan zajęć (2026-09-22) — rozpoznawanie `[PUR]`-prefiksowanych `gcalEvents` + wyciąganie
// typu/sali z tytułu. DOKŁADNIE ten sam kierunek co `isWorkEvent()` w `workEvents.ts`, ale
// PROŚCIEJ: zero parsera godzin z tytułu (zmiany pracy mają realne godziny WPISANE w tytuł
// przy stałym czasie eventu; zajęcia to zwykłe w pełni czasowe eventy Google Kalendarza —
// start/koniec liczy się z WŁASNYCH czasów `CalendarEvent`, patrz `startTime`/`endTime`, nie
// z tekstu).
//
// Format tytułu ustalony przez usera (student UR): "[PUR] W - Komp. model. struktur i wł.
// mat. - 203 B3" — prefiks + spacja + JEDNA litera typu + " - " + nazwa przedmiotu + " - " +
// sala. Cztery typy w realnym planie usera: W(ykład)/Ć(wiczenia, kod C)/L(aboratorium)/
// P(rojekt) — "P" dodane 2026-09-22 dla sesji oznaczonych w planie jako "pr." (np.
// "KMSiWM-pr"), nie mieściło się w oryginalnym trio W/C/L.

import { plPlural } from './plural';

export type ClassType = 'W' | 'C' | 'L' | 'P';
const CLASS_TYPES: ClassType[] = ['W', 'C', 'L', 'P'];

export const CLASS_TYPE_LABEL: Record<ClassType, string> = {
  W: 'Wykład', C: 'Ćwiczenia', L: 'Laboratorium', P: 'Projekt',
};

// Czy ten tytuł eventu zaczyna się od prefiksu planu zajęć (case-insensitive, jak workPrefix).
export function isClassEvent(title: string | undefined, prefix: string): boolean {
  const p = prefix.trim();
  if (!p) return false;
  return (title ?? '').trim().toLowerCase().startsWith(p.toLowerCase());
}

export interface ParsedClassEvent {
  type: ClassType | null;   // null gdy tytuł nie ma rozpoznanej litery typu (fallback, wciąż pokazywane)
  subject: string;
  room: string | null;
}

// Rozbija "[PUR] W - Nazwa - Sala" na {type, subject, room}. Odporne na format bez litery
// typu (2 segmenty → subject+room, brak type) i na sam prefiks bez reszty (fallback: cały
// pozostały tekst jako subject, room null) — nigdy nie zwraca null dla eventu który PRZESZEDŁ
// `isClassEvent`, żeby nierozpoznany, ale prefiksowany event i tak było widać, nie ginął po cichu.
export function parseClassEvent(title: string | undefined, prefix: string): ParsedClassEvent | null {
  if (!isClassEvent(title, prefix)) return null;
  const rest = (title ?? '').trim().slice(prefix.trim().length).trim();
  const parts = rest.split(' - ').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3 && CLASS_TYPES.includes(parts[0] as ClassType)) {
    return { type: parts[0] as ClassType, subject: parts.slice(1, -1).join(' - '), room: parts[parts.length - 1] };
  }
  if (parts.length === 2) {
    return { type: null, subject: parts[0], room: parts[1] };
  }
  return { type: null, subject: rest, room: null };
}

// Etykieta "Śr 24 wrz · za 2 dni" dla dashboardowego kafelka (2026-09-23, user: gdy dziś/jutro
// puste — weekend, przerwa międzysemestralna, dzień wolny z zarządzenia Rektora UR — kafelek
// znikał całkowicie zamiast pokazać NAJBLIŻSZY dzień z zajęciami). Ręczne tablice dni/miesięcy
// zamiast `toLocaleDateString('pl-PL', ...)` — TEN SAM wzorzec co `weekGrid.ts`'s
// `fmtWeekRange()` (locale ICU niepewne pod Jest/Hermes, a to ma być testowalne bez zgadywania).
const DAY_SHORT = ['Nie', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob']; // Date.getDay(): 0=Nie..6=Sob
const MONTH_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export function fmtNextClassLabel(dateYMD: string, daysAway: number): string {
  const [y, m, d] = dateYMD.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const nice = `${DAY_SHORT[date.getDay()]} ${d} ${MONTH_SHORT[m - 1]}`;
  return `${nice} · za ${daysAway} ${plPlural(daysAway, 'dzień', 'dni', 'dni')}`;
}
