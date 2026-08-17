import { WeaknessKey, Boss, BossLoot, AttackKind } from '@/utils/bosses';

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
  attackKind?: AttackKind; // 2026-08-17 — patrz komentarz nad AttackKind w bosses.ts
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
  // ── 4 pory roku, mitologiczne portrety usera (2026-08-10, assets/ikonybosów/BOSS_*)
  // — wcześniej brakowało generycznej wiosny/jesieni/zimy (tylko święta konkretne). CELOWO
  // wąskie 2-tygodniowe okna, nie całe pory roku: pierwsza wersja pokrywała 100% roku, co
  // zabijało „nemesis miesiąca" na zawsze (activeSeasonalEvent nigdy nie zwracałoby null,
  // currentEventBoss nigdy nie sprawdzałby menace — patrz pickMenace/MENACE_POOL). Te okna
  // stoją bezpiecznie MIĘDZY istniejącymi świętami (nie dotykają Mikołaja/Wielkanocy/Wakacji
  // ani dat z __tests__/seasonalEvents.test.ts), więc menace ma nadal ~10 miesięcy okazji. ──
  {
    id: 'wiosna', name: 'Wiosenna Nike', emoji: '🏆', weakness: 'steps', weaknessLabel: 'kroki',
    taunt: 'Jeszcze jeden dzień na kanapie nikomu nie zaszkodzi…', trophyEmoji: '🌸', kind: 'seasonal', attackKind: 'magic',
    isActive: d => d.getMonth() === 4 && d.getDate() <= 14, // 1–14 maja
  },
  {
    id: 'jesien', name: 'Jesienna Demeter', emoji: '🌾', weakness: 'water', weaknessLabel: 'woda (cel dnia)',
    taunt: 'Jedna kawa zamiast wody nikomu nie zaszkodzi…', trophyEmoji: '🌾', kind: 'seasonal', attackKind: 'magic',
    isActive: d => d.getMonth() === 9 && d.getDate() <= 14, // 1–14 października
  },
  {
    id: 'zima', name: 'Zimowa Hera', emoji: '👑', weakness: 'sleep', weaknessLabel: 'sen (7h+)',
    taunt: 'Jeszcze jeden odcinek zamiast spać nikomu nie zaszkodzi…', trophyEmoji: '❄️', kind: 'seasonal', attackKind: 'magic',
    isActive: d => d.getMonth() === 1 && d.getDate() <= 14, // 1–14 lutego
  },
];

export function activeSeasonalEvent(d: Date): EventBoss | null {
  return SEASONAL.find(s => s.isActive(new Date(d))) ?? null;
}

// ── Nemesis miesiąca — dane-triggered, nie data-triggered ───────────────────────
export const MENACE_POOL = {
  overtime: {
    id: 'overtime', name: 'Widmo Nadgodzin', emoji: '💼', weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    taunt: 'Jeszcze jedna zmiana nikogo nie zabiła…', trophyEmoji: '⏱️', kind: 'menace', attackKind: 'magic',
  } as EventBoss,
  sweettooth: {
    id: 'sweettooth', name: 'Demon Słodyczy', emoji: '🍩', weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    taunt: 'Ten miesiąc i tak już przepadł…', trophyEmoji: '🍬', kind: 'menace', attackKind: 'claw',
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

// Koniec BIEŻĄCEGO okna aktywności (2026-08-16, user: "dodajmy terminy z odliczaniem za ile
// kończy się event boss, żeby realnie móc go wygrać") — walka eventowa ma co najmniej
// 1 próbę/dzień (`eventDailyAttempts` w bosses.ts, do 3 przy wysokim energyMult z łupu —
// patrz komentarz przy tej funkcji, 2026-08-17), więc "ile dni zostało" to DOLNA GRANICA
// "ile jeszcze podejść dostanę" zanim boss zniknie na dobre (realnie może być więcej).
// `isActive` per-definicja wyżej sprawdza TYLKO
// przynależność (true/false), nie ma gdzie wyciągnąć samej granicy — stąd osobna funkcja,
// lustrzana per-id (te same okna co isActive, jawnie jako Date). Nemesis miesiąca (`menace`)
// nie ma stałego okna dat — jego "koniec" to koniec BIEŻĄCEGO miesiąca kalendarzowego (wtedy
// `pickMenace` przelicza się od nowa na nowych, zerowych statystykach miesiąca).
export function eventEndsAt(boss: EventBoss, now: Date): Date {
  const y = now.getFullYear();
  const endOfDay = (year: number, month: number, day: number) => new Date(year, month, day, 23, 59, 59, 999);
  if (boss.kind === 'menace') return endOfDay(y, now.getMonth() + 1, 0); // ostatni dzień TEGO miesiąca
  switch (boss.id) {
    case 'mikolaj': return endOfDay(y, 11, 26);       // 1–26 grudnia
    case 'wielkanoc': {
      const end = new Date(easterSunday(y));
      end.setDate(end.getDate() + 1);                  // Poniedziałek Wielkanocny
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'wakacje': return endOfDay(y, 7, 31);          // 15 czerwca – 31 sierpnia
    case 'wiosna':  return endOfDay(y, 4, 14);          // 1–14 maja
    case 'jesien':  return endOfDay(y, 9, 14);          // 1–14 października
    case 'zima':    return endOfDay(y, 1, 14);          // 1–14 lutego
    default:        return endOfDay(y, now.getMonth() + 1, 0); // bezpieczny fallback
  }
}

// Pełne dni pozostałe (zaokrąglone W GÓRĘ — "kończy się za 1 dzień" oznacza że jeszcze DZIŚ
// jest do wygrania, nie że już przepadło). Minimum 0 — nigdy ujemne w UI.
export function eventDaysLeft(boss: EventBoss, now: Date): number {
  const ms = eventEndsAt(boss, now).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
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
//
// PRZEBALANSOWANE (2026-08-12) — walki eventowe teraz IDENTYCZNE jak kampania (prawdziwy
// kontratak, realna walka do 0 HP, można przegrać — patrz eventAsBoss niżej), zamiast
// dawnego "jedno uderzenie/próbę w trwały bank HP rozłożony na cały okres wydarzenia" (stąd
// user: "tylko wtedy trzeba ich zoptymalizować HP i DMG pod to że tylko raz mam podejście").
// Stara wartość (5000+level×500) była skalibrowana pod TAMTEN model — całe okno wydarzenia
// (np. 26 dni Mikołaja) miało na nią pracować po trochu. W nowym modelu to jedna PRAWDZIWA
// walka dziennie, więc HP musi być w skali pojedynczego starcia kampanijnego: przy bazowych
// statach (atkStatBonus=0) to ~5-6 ciosów do zabicia na każdym poziomie (dopasowane do
// atkPower(0,level) rosnącego liniowo z poziomem), tak żeby kontratak (COUNTER_PCT × ta HP)
// nie zabijał kotka w 1-2 rundy przy bazowym max HP=100 — patrz counterDamage w bosses.ts.
export const eventHpFor = (level: number) => 200 + Math.max(0, level) * 6;
export const eventCoins = (level: number) => 40 + Math.max(0, level) * 4;
export const eventXp   = (level: number) => 250 + Math.max(0, level) * 25;

// Placeholder loot — wygrana wydarzenia daje MEDAL (kolekcjonerski), nie przedmiot z bonusem
// jak kampania; simulateFight()/Boss wymaga pola `loot`, ale boss-fight.tsx dla kind='event'
// nigdy go nie czyta (victory modal ma osobny fallback "Medal wydarzenia").
const EVENT_PLACEHOLDER_LOOT: BossLoot = { id: '', name: '', emoji: '', desc: '', bonus: {} };

// EventBoss + aktualny poziom → Boss-kształtny obiekt gotowy do simulateFight(). Brak
// guard/regenPct (żaden event boss ich dziś nie ma — czysta różnorodność HP/motywu na razie).
export function eventAsBoss(eventBoss: EventBoss, level: number): Boss {
  return {
    id: eventBoss.id, name: eventBoss.name, emoji: eventBoss.emoji,
    order: 0, unlockLevel: 0, hp: eventHpFor(level),
    weakness: eventBoss.weakness, weaknessLabel: eventBoss.weaknessLabel,
    loot: EVENT_PLACEHOLDER_LOOT, coins: 0, xp: 0, taunt: eventBoss.taunt,
    attackKind: eventBoss.attackKind,
  };
}
