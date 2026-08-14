import { Boss, BossLoot } from '@/utils/bosses';

// CZWARTY tor walki (obok kampanii/raidu/wydarzeń) — MINIBOSSY, 2026-08-14. User: zamiast
// cichego "claimu" nagrody za wypicie wody / wybicie kroków, ten sam trigger (cel dnia
// osiągnięty) odblokowuje krótką, ŁATWĄ walkę z minibossem — ta sama pełna symulacja rundowa
// co kampania (simulateFight), ale niskie HP i skromne nagrody, bo to DODATKOWA warstwa nad
// istniejącymi questami pupila (quests.ts b_water/b_stepbeat/d_steps10 zostają nietknięte —
// usuwanie ich zostawiłoby dead-endy w dashboardzie/powiadomieniach, patrz CLAUDE.md #7).
//
// Dwa niezależne tory (obie osiągalne tego samego dnia, osobne claimy w petStore):
//  - 'water': pasek wody (nawyk kind==='water') dobija do dailyGoal
//  - 'steps': dzienne kroki dobijają do STEPS_MILESTONE
// Roster (assets/minibosses/, user wrzucił 8 grafik) podzielony tematycznie po połowie —
// arbitralny podział, nic mechanicznie od tego nie zależy.
//
// UWAGA: bez importu minibossIcons.ts tutaj (require() na obrazkach) — ten plik importują
// testy bezpośrednio, patrz identyczny komentarz w raid.ts/seasonalEvents.ts.

export interface MiniBoss {
  id: string;
  name: string;
  emoji: string;
  taunt: string;
}

export const WATER_MINIBOSSES: MiniBoss[] = [
  { id: 'mb_capybara', name: 'Kapibara Chillu', emoji: '🦫', taunt: 'Po co pić wodę, i tak jest się chill…' },
  { id: 'mb_duck', name: 'Kaczka Kałuży', emoji: '🦆', taunt: 'Ta kałuża w pełni wystarczy…' },
  { id: 'mb_shark', name: 'Rekinek Fali', emoji: '🦈', taunt: 'Woda? Ledwo mokro…' },
  { id: 'mb_whale', name: 'Wieloryb Głębin', emoji: '🐳', taunt: 'Jedna szklanka nic nie zmieni…' },
];

export const STEPS_MINIBOSSES: MiniBoss[] = [
  { id: 'mb_goat', name: 'Koza Uparta', emoji: '🐐', taunt: 'Po co iść dalej, tu jest wygodnie…' },
  { id: 'mb_harpy', name: 'Harpia Wichru', emoji: '🦅', taunt: 'Loty nie liczą się jako kroki…' },
  { id: 'mb_macaws', name: 'Ary Dżungli', emoji: '🦜', taunt: 'Zostań na gałęzi, tu jest bezpiecznie…' },
  { id: 'mb_snake', name: 'Wąż Ścieżki', emoji: '🐍', taunt: 'Po co chodzić, można się czołgać…' },
];

export type MinibossLane = 'water' | 'steps';

// Ile kroków dziennie odblokowuje walkę — te sama liczba co istniejący quest 'd_steps10'
// w quests.ts (10k to już ugruntowany w apce próg "dobry dzień kroków").
export const STEPS_MILESTONE = 10000;

function hashOf(s: string, mul: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * mul + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministyczny miniboss na dany dzień/tor (ten sam dzień → ten sam wynik, żeby UI
// pokazywało to samo zwierzę cały dzień, ale JUTRO już inne — świeżość jak w raidzie).
export function minibossForDay(dateISO: string, lane: MinibossLane): MiniBoss {
  const pool = lane === 'water' ? WATER_MINIBOSSES : STEPS_MINIBOSSES;
  return pool[hashOf(`${dateISO}:${lane}`, 31) % pool.length];
}

// HP/nagrody CELOWO dużo niżej niż wydarzenia (eventHpFor = 200+level×6) — "stosunkowo
// łatwy" miniboss, bo to DZIENNA, powtarzalna walka (potencjalnie DWIE dziennie: woda+kroki),
// nie rzadka bonusowa. Niskie HP samo w sobie trzyma kontratak (COUNTER_PCT × HP bossa)
// niegroźnym — nie trzeba osobno tłumić kontrataku.
export const minibossHpFor = (level: number) => 60 + Math.max(0, level) * 3;
export const minibossCoins = (level: number) => 6 + Math.max(0, level);
export const minibossXp = (level: number) => 15 + Math.max(0, level) * 3;

// Placeholder — jak w seasonalEvents.ts: Boss wymaga pola `loot`, ale miniboss nie daje
// przedmiotu (tylko coins/xp), więc nic go nigdy nie czyta.
const MINIBOSS_PLACEHOLDER_LOOT: BossLoot = { id: '', name: '', emoji: '', desc: '', bonus: {} };

// MiniBoss + aktualny poziom → Boss-kształtny obiekt gotowy do simulateFight(). `weakness`
// jest wymagane przez typ Boss, ale minibossy nie mają mechaniki osłabiania — wartość
// nieużywana.
export function minibossAsBoss(mb: MiniBoss, level: number): Boss {
  return {
    id: mb.id, name: mb.name, emoji: mb.emoji,
    order: 0, unlockLevel: 0, hp: minibossHpFor(level),
    weakness: 'habits', weaknessLabel: '',
    loot: MINIBOSS_PLACEHOLDER_LOOT, coins: 0, xp: 0, taunt: mb.taunt,
  };
}
