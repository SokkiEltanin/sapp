import { WeaknessKey } from '@/utils/bosses';

// TRZECI tor walki (obok kampanii bossów i cotygodniowego raidu) — WYDARZENIA:
// świąteczne/sezonowe bossy (data w kalendarzu decyduje) i „nemesis miesiąca" (Twoje
// najbardziej zaniedbane dane TEGO miesiąca stają się bossem — za dużo nadgodzin, za
// dużo słodyczy). Sezonowy ZAWSZE wygrywa z nemesis, gdy oba pasują — święta są rzadsze
// i bardziej „wydarzeniowe" niż zwykłe miesięczne zaniedbanie.
//
// UWAGA: bez lucide-react-native tutaj — patrz komentarz w raid.ts (ten sam powód: Jest
// nie parsuje react-native-svg z poziomu pliku importowanego bezpośrednio przez testy).
// Mapowanie id→ikona w src/utils/bossUiIcons.ts, importowane tylko przez bosses.tsx.

export interface EventBoss {
  id: string;
  name: string;
  emoji: string;
  weakness: WeaknessKey;
  weaknessLabel: string;
  taunt: string;
  trophyEmoji: string;
  kind: 'seasonal' | 'menace';
}

interface SeasonalDef extends EventBoss {
  isActive: (d: Date) => boolean;
}

// ── Wielkanoc — ruchoma data (algorytm computusa, Gregoriański) ──────────────────
export function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzec, 4 = kwiecień
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Wielki Czwartek → Poniedziałek Wielkanocny (okno wokół Wielkanocy).
function isEasterWindow(d: Date): boolean {
  const easter = easterSunday(d.getFullYear());
  const start = new Date(easter); start.setDate(start.getDate() - 4);
  const end = new Date(easter); end.setDate(end.getDate() + 1);
  const t = d.setHours(12, 0, 0, 0), s = start.setHours(0, 0, 0, 0), e = end.setHours(23, 59, 59, 999);
  return t >= s && t <= e;
}

const SEASONAL: SeasonalDef[] = [
  {
    id: 'mikolaj', name: 'Zły Mikołaj', emoji: '🎅', weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    taunt: 'Jeszcze jeden piernik nikomu nie zaszkodzi…', trophyEmoji: '🎄', kind: 'seasonal',
    isActive: d => d.getMonth() === 11 && d.getDate() <= 26,   // 1–26 grudnia
  },
  {
    id: 'wielkanoc', name: 'Czekoladowy Zajączek', emoji: '🐰', weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    taunt: 'Jeszcze jedno jajko z zajączka…', trophyEmoji: '🥚', kind: 'seasonal',
    isActive: d => isEasterWindow(new Date(d)),
  },
  {
    id: 'wakacje', name: 'Wakacyjny Leń', emoji: '🏖️', weakness: 'habits', weaknessLabel: 'nawyki',
    taunt: 'Wakacje — olej dziś wszystko…', trophyEmoji: '🌴', kind: 'seasonal',
    isActive: d => (d.getMonth() === 5 && d.getDate() >= 15) || d.getMonth() === 6 || d.getMonth() === 7, // 15 cze – 31 sie
  },
];

export function activeSeasonalEvent(d: Date): EventBoss | null {
  return SEASONAL.find(s => s.isActive(new Date(d))) ?? null;
}

// ── Nemesis miesiąca — dane-triggered, nie data-triggered ───────────────────────
export const MENACE_POOL = {
  overtime: {
    id: 'overtime', name: 'Widmo Nadgodzin', emoji: '💼', weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    taunt: 'Jeszcze jedna zmiana nikogo nie zabiła…', trophyEmoji: '⏱️', kind: 'menace',
  } as EventBoss,
  sweettooth: {
    id: 'sweettooth', name: 'Demon Słodyczy', emoji: '🍩', weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    taunt: 'Ten miesiąc i tak już przepadł…', trophyEmoji: '🍬', kind: 'menace',
  } as EventBoss,
};

export interface MenaceCtx {
  workHoursThisMonth: number;
  workHoursAvg: number;     // średnia z poprzednich miesięcy (0 = brak danych → nie wyzwalaj)
  sweetsThisMonth: number;  // zł
  sweetsAvg: number;        // zł, średnia z poprzednich miesięcy
}

const MENACE_THRESHOLD = 1.15; // 15% ponad Twoją własną średnią, zanim uznamy to za „przesadziłeś"

// Nemesis miesiąca — który wskaźnik najbardziej odstaje OD TWOJEJ WŁASNEJ średniej.
// Zwraca null, gdy nic szczególnie nie odstaje (brak danych LUB w normie).
export function pickMenace(ctx: MenaceCtx): EventBoss | null {
  const overtimeRatio = ctx.workHoursAvg > 0 ? ctx.workHoursThisMonth / ctx.workHoursAvg : 0;
  const sweetsRatio = ctx.sweetsAvg > 0 ? ctx.sweetsThisMonth / ctx.sweetsAvg : 0;
  if (overtimeRatio < MENACE_THRESHOLD && sweetsRatio < MENACE_THRESHOLD) return null;
  return overtimeRatio >= sweetsRatio ? MENACE_POOL.overtime : MENACE_POOL.sweettooth;
}

// Sezonowy ZAWSZE wygrywa (rzadszy, bardziej „wydarzeniowy"); inaczej nemesis miesiąca.
export function currentEventBoss(d: Date, menaceCtx: MenaceCtx): EventBoss | null {
  return activeSeasonalEvent(d) ?? pickMenace(menaceCtx);
}

// Klucz okresu dla claimu/HP — sezonowy wraca co ROK (klucz z rokiem), nemesis co MIESIĄC.
export function eventPeriodKey(boss: EventBoss, d: Date): string {
  if (boss.kind === 'seasonal') return `${boss.id}-${d.getFullYear()}`;
  return `${boss.id}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Wszystkie EventBoss (sezonowe + nemesis) — do wyszukania po id, np. przy renderowaniu
// ściany medali z zapisanych eventKeys ("<id>-<rok>[-<miesiąc>]").
export const ALL_EVENT_BOSSES: EventBoss[] = [...SEASONAL, ...Object.values(MENACE_POOL)];
export function eventBossFromKey(eventKey: string): EventBoss | undefined {
  return ALL_EVENT_BOSSES.find(b => eventKey.startsWith(`${b.id}-`));
}

// HP/nagrody skalują z poziomem — lżej niż raid (to bonusowa, sezonowa walka, nie główny grind).
export const eventHpFor = (level: number) => 5000 + Math.max(0, level) * 500;
export const eventCoins = (level: number) => 40 + Math.max(0, level) * 4;
export const eventXp   = (level: number) => 250 + Math.max(0, level) * 25;
