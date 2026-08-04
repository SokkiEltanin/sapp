// Boss battles (etap 4). You beat bosses by taking care of yourself: self-care
// banks "energia", you tap FIGHT to unleash it. Bosses unlock with the pet's level
// and can be fought once. Each is weak to one healthy habit (bonus damage) and
// drops a trophy with a passive combat bonus that helps against tougher bosses —
// so difficulty scales up (boss HP) while YOU scale up (pet level + loot).

export type WeaknessKey = 'steps' | 'sweetless' | 'habits' | 'mood';

export interface BossLoot {
  id: string;
  name: string;
  emoji: string;
  desc: string;                 // what the bonus does, in words
  bonus: Partial<{ atk: number; dodge: number; crit: number; energyMult: number }>;
}

export interface Boss {
  id: string;
  name: string;
  emoji: string;
  order: number;
  unlockLevel: number;
  hp: number;
  weakness: WeaknessKey;
  weaknessLabel: string;
  loot: BossLoot;
  coins: number;
  xp: number;
  taunt: string;
}

export const BOSSES: Boss[] = [
  {
    id: 'sloth', name: 'Kanapowy Leniwiec', emoji: '🦥', order: 1, unlockLevel: 2, hp: 300,
    weakness: 'steps', weaknessLabel: 'kroki',
    loot: { id: 'loot_pillow', name: 'Poduszka Leniwca', emoji: '🛏️', desc: '+6% energii z dbania o siebie', bonus: { energyMult: 0.06 } },
    coins: 8, xp: 60, taunt: 'Po co dziś wstawać…',
  },
  {
    id: 'sugar', name: 'Cukrowy Potwór', emoji: '🍬', order: 2, unlockLevel: 4, hp: 520,
    weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    loot: { id: 'loot_sugarcrystal', name: 'Kryształ Cukru', emoji: '💎', desc: '+3% siły ataku', bonus: { atk: 0.03 } },
    coins: 12, xp: 100, taunt: 'Zjedz jeszcze jednego batonika…',
  },
  {
    id: 'snake', name: 'Wąż Kusiciel', emoji: '🐍', order: 3, unlockLevel: 6, hp: 820,
    weakness: 'habits', weaknessLabel: 'nawyki',
    loot: { id: 'loot_snakefig', name: 'Figurka Węża', emoji: '🐍', desc: '+5% szansy na cios krytyczny', bonus: { crit: 0.05 } },
    coins: 18, xp: 160, taunt: 'Odpuść dziś nawyki…',
  },
  {
    id: 'dragon', name: 'Smok Chaosu', emoji: '🐲', order: 4, unlockLevel: 9, hp: 1400,
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_dragon', name: 'Trofeum Smoka', emoji: '🐲', desc: '+5% uniku, +3% siły ataku', bonus: { dodge: 0.05, atk: 0.03 } },
    coins: 30, xp: 300, taunt: 'Nie zapisuj dziś nastroju…',
  },
  {
    id: 'scroll', name: 'Złodziej Czasu', emoji: '📱', order: 5, unlockLevel: 12, hp: 2200,
    weakness: 'habits', weaknessLabel: 'nawyki',
    loot: { id: 'loot_hourglass', name: 'Klepsydra Skupienia', emoji: '⏳', desc: '+7% energii z dbania o siebie', bonus: { energyMult: 0.07 } },
    coins: 45, xp: 450, taunt: 'Jeszcze tylko jeden filmik…',
  },
  {
    id: 'stress', name: 'Potwór Stresu', emoji: '😰', order: 6, unlockLevel: 15, hp: 3200,
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_calm', name: 'Amulet Spokoju', emoji: '🧿', desc: '+6% uniku', bonus: { dodge: 0.06 } },
    coins: 60, xp: 600, taunt: 'Martw się wszystkim naraz…',
  },
  {
    id: 'junk', name: 'Król Fast Foodu', emoji: '🍔', order: 7, unlockLevel: 18, hp: 4500,
    weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    loot: { id: 'loot_veg', name: 'Korona Warzyw', emoji: '🥦', desc: '+5% siły ataku, +2% kryt', bonus: { atk: 0.05, crit: 0.02 } },
    coins: 80, xp: 800, taunt: 'Dorzuć duże frytki…',
  },
  {
    id: 'burnout', name: 'Pustka Wypalenia', emoji: '🌑', order: 8, unlockLevel: 22, hp: 6500,
    weakness: 'steps', weaknessLabel: 'kroki',
    loot: { id: 'loot_spark', name: 'Iskra Życia', emoji: '⭐', desc: '+5% atak, +5% unik, +5% energii', bonus: { atk: 0.05, dodge: 0.05, energyMult: 0.05 } },
    coins: 120, xp: 1200, taunt: 'Nic już nie ma sensu…',
  },
  // ── endgame (dłuższy cel; łup coraz mocniejszy, żeby dało się dogonić rosnące HP) ──
  {
    id: 'insomnia', name: 'Zmora Bezsenności', emoji: '🌙', order: 9, unlockLevel: 26, hp: 9000,
    weakness: 'habits', weaknessLabel: 'nawyki',
    loot: { id: 'loot_moon', name: 'Amulet Księżyca', emoji: '🌙', desc: '+8% energii z dbania o siebie', bonus: { energyMult: 0.08 } },
    coins: 150, xp: 1500, taunt: 'Jeszcze tylko jeden odcinek o 2 w nocy…',
  },
  {
    id: 'compare', name: 'Widmo Porównań', emoji: '👻', order: 10, unlockLevel: 30, hp: 12000,
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_mirror', name: 'Lustro Prawdy', emoji: '🪞', desc: '+7% uniku, +3% atak', bonus: { dodge: 0.07, atk: 0.03 } },
    coins: 200, xp: 2000, taunt: 'Zobacz, o ile innym lepiej…',
  },
  {
    id: 'drought', name: 'Hydra Odwodnienia', emoji: '🐙', order: 11, unlockLevel: 35, hp: 16000,
    weakness: 'habits', weaknessLabel: 'nawyki (woda)',
    loot: { id: 'loot_spring', name: 'Fiolka Źródła', emoji: '💧', desc: '+6% atak, +4% kryt', bonus: { atk: 0.06, crit: 0.04 } },
    coins: 280, xp: 2800, taunt: 'Kawa liczy się jako woda, nie?',
  },
  {
    id: 'procrast', name: 'Tytan Prokrastynacji', emoji: '⏳', order: 12, unlockLevel: 40, hp: 22000,
    weakness: 'habits', weaknessLabel: 'nawyki',
    loot: { id: 'loot_gear', name: 'Mechanizm Czasu', emoji: '⚙️', desc: '+9% energii, +3% atak', bonus: { energyMult: 0.09, atk: 0.03 } },
    coins: 380, xp: 3800, taunt: 'Zrobisz to jutro… na pewno…',
  },
  {
    id: 'doubt', name: 'Cień Zwątpienia', emoji: '🌫️', order: 13, unlockLevel: 46, hp: 30000,
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_lantern', name: 'Latarnia Wiary', emoji: '🏮', desc: '+8% atak, +6% uniku', bonus: { atk: 0.08, dodge: 0.06 } },
    coins: 550, xp: 5500, taunt: 'I tak ci się nie uda…',
  },
  {
    id: 'devourer', name: 'Pożeracz Nawyków', emoji: '👹', order: 14, unlockLevel: 52, hp: 42000,
    weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    loot: { id: 'loot_crown', name: 'Korona Mistrza', emoji: '👑', desc: '+10% atak, +8% uniku, +8% energii, +5% kryt', bonus: { atk: 0.10, dodge: 0.08, energyMult: 0.08, crit: 0.05 } },
    coins: 900, xp: 9000, taunt: 'Wróć do starych nawyków, będzie łatwiej…',
  },
];

export function bossById(id: string): Boss | undefined { return BOSSES.find(b => b.id === id); }

export interface EnergyCtx {
  stepsToday: number;
  habitsDone: number;
  moodLoggedToday: boolean;
  boughtSweetToday: boolean;
}

// Today's earned attack energy from self-care (capped so it can't run away).
export function energyFromData(c: EnergyCtx): number {
  const e = Math.floor(c.stepsToday / 1000) * 10
    + c.habitsDone * 8
    + (c.moodLoggedToday ? 10 : 0)
    + (c.boughtSweetToday ? 0 : 12);
  return Math.min(350, Math.max(0, e));
}

export interface Bonuses { atk: number; dodge: number; crit: number; energyMult: number }

export function bossBonuses(ownedItems: string[]): Bonuses {
  const b: Bonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };
  for (const boss of BOSSES) {
    if (!ownedItems.includes(boss.loot.id)) continue;
    const { atk, dodge, crit, energyMult } = boss.loot.bonus;
    b.atk += atk ?? 0; b.dodge += dodge ?? 0; b.crit += crit ?? 0; b.energyMult += energyMult ?? 0;
  }
  return b;
}

export interface WeaknessCtx {
  stepsToday: number;
  sweetlessDays: number;
  habitsRatio: number;      // 0..1 (done/total today)
  moodLoggedToday: boolean;
}

// Bonus damage multiplier for hitting a boss's weakness with the right habit.
export function weaknessMult(boss: Boss, c: WeaknessCtx): number {
  switch (boss.weakness) {
    case 'steps':     return 1 + Math.min(1.5, c.stepsToday / 10000) * 0.2;
    case 'sweetless': return 1 + Math.min(30, c.sweetlessDays) * 0.02;
    case 'habits':    return 1 + c.habitsRatio * 0.3;
    case 'mood':      return 1 + (c.moodLoggedToday ? 0.25 : 0);
  }
}

export function atkMultiplier(level: number, bonuses: Bonuses): number {
  return 1 + level * 0.03 + bonuses.atk;
}

// One attack: spends all banked energy into a hit (crit doubles it).
export function computeDamage(energy: number, level: number, bonuses: Bonuses, boss: Boss, wc: WeaknessCtx): { damage: number; crit: boolean } {
  const base = energy * atkMultiplier(level, bonuses) * weaknessMult(boss, wc);
  const crit = Math.random() < bonuses.crit;
  return { damage: Math.round(base * (crit ? 2 : 1)), crit };
}

export type BossStatus = 'locked' | 'active' | 'defeated';
export function bossStatus(boss: Boss, level: number, defeated: string[]): BossStatus {
  if (defeated.includes(boss.id)) return 'defeated';
  if (level < boss.unlockLevel) return 'locked';
  return 'active';
}

// Remaining HP for a boss (full until damaged).
export function bossRemaining(boss: Boss, bossHp: Record<string, number>): number {
  return bossHp[boss.id] ?? boss.hp;
}
