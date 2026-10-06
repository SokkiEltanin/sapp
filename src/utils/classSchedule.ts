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
import { CalendarEvent } from '@/types';

function pad2(n: number) { return String(n).padStart(2, '0'); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

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

// "Podświetl aktualny" (2026-10-06, user: "jak jestem to pokazuje podświetla aktualny") —
// czy DOKŁADNIE TERAZ trwa to zajęcie: ten sam dzień + `now`'s HH:mm mieści się w
// [startTime, endTime). Eventy bez godzin (allDay czy brak start/end) nigdy nie "trwają".
export function isHappeningNow(ev: CalendarEvent, now: Date): boolean {
  if (ev.date !== ymd(now)) return false;
  if (!ev.startTime || !ev.endTime) return false;
  const nowHM = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return nowHM >= ev.startTime && nowHM < ev.endTime;
}

// "Zadania powiązane z zajęciami... przypomina przed zajęciami" (2026-10-06) — data/godzina
// przypomnienia liczona wstecz od startu DANEGO wystąpienia zajęć. Zwraca null gdy event nie
// ma godziny startu (nie da się policzyć "przed czym"). Reużywa dokładnie te same pola
// (`reminderDate`/`reminderTime`) co zwykłe ręczne przypomnienia w Task — zero nowej ścieżki
// powiadomień, tylko inny sposób wyliczenia WARTOŚCI tych pól.
export function computeClassReminder(ev: CalendarEvent, minutesBefore: number): { date: string; time: string } | null {
  if (!ev.startTime) return null;
  const [h, m] = ev.startTime.split(':').map(Number);
  const dt = new Date(`${ev.date}T${pad2(h)}:${pad2(m)}:00`);
  dt.setMinutes(dt.getMinutes() - minutesBefore);
  return { date: ymd(dt), time: `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}` };
}

// Etykieta do wyświetlenia/cache'owania przy linkowaniu zadania do zajęć (np. "Pon 12.10 ·
// 8:00 · Cięcie wiązką elektronową i laserową") — zapisywana na Task jako `classEventLabel`,
// żeby plan wciąż był czytelny nawet gdy źródłowy event zniknie z Kalendarza Google.
export function fmtClassEventLabel(ev: CalendarEvent, prefix: string): string {
  const parsed = parseClassEvent(ev.title, prefix);
  const [y, m, d] = ev.date.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayPart = `${DAY_SHORT[date.getDay()]} ${pad2(d)}.${pad2(m)}`;
  const timePart = ev.startTime ? ` · ${ev.startTime}` : '';
  const subjectPart = parsed?.subject ? ` · ${parsed.subject}` : '';
  return `${dayPart}${timePart}${subjectPart}`;
}
