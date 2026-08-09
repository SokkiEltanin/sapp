// Boss battles (etap 4). You beat bosses by taking care of yourself: self-care
// banks "energia", you tap FIGHT to unleash it. Bosses unlock with the pet's level
// and can be fought once. Each is weak to one healthy habit (bonus damage) and
// drops a trophy with a passive combat bonus that helps against tougher bosses —
// so difficulty scales up (boss HP) while YOU scale up (pet level + loot).

import {
  CombatItemId, HEADSHOT_CHANCE, HEAL_ONCE_PCT, dodgeChanceAt, reflectPctAt,
  executeThresholdAt, fireProcChanceAt, FIRE_DOT_PCT, MIND_CONTROL_CHANCE,
  SHIELD_REDUCTION_PCT, THORN_PCT,
} from '@/utils/combatItems';

export type WeaknessKey = 'steps' | 'sweetless' | 'habits' | 'mood' | 'sleep' | 'water';

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
  // ── mechaniki (opcjonalne) ──
  guard?: 'sweets' | 'poorSleep';  // OSŁONA: jeśli DZIŚ zrobiłeś tę złą rzecz → Twój cios ×0.5
  regenPct?: number;               // REGENERACJA: jeśli DZIŚ zaniedbałeś jego słabość → leczy ten % max HP przy ciosie
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
    coins: 12, xp: 100, taunt: 'Zjedz jeszcze jednego batonika…', guard: 'sweets',
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
    coins: 30, xp: 300, taunt: 'Nie zapisuj dziś nastroju…', regenPct: 0.03,
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
    coins: 80, xp: 800, taunt: 'Dorzuć duże frytki…', guard: 'sweets',
  },
  {
    id: 'burnout', name: 'Pustka Wypalenia', emoji: '🌑', order: 8, unlockLevel: 22, hp: 6500,
    weakness: 'steps', weaknessLabel: 'kroki',
    loot: { id: 'loot_spark', name: 'Iskra Życia', emoji: '⭐', desc: '+5% atak, +5% unik, +5% energii', bonus: { atk: 0.05, dodge: 0.05, energyMult: 0.05 } },
    coins: 120, xp: 1200, taunt: 'Nic już nie ma sensu…', regenPct: 0.03,
  },
  // ── endgame (dłuższy cel; łup coraz mocniejszy, żeby dało się dogonić rosnące HP) ──
  {
    id: 'insomnia', name: 'Zmora Bezsenności', emoji: '🌙', order: 9, unlockLevel: 26, hp: 9000,
    weakness: 'sleep', weaknessLabel: 'sen (7h+)',
    loot: { id: 'loot_moon', name: 'Amulet Księżyca', emoji: '🌙', desc: '+8% energii z dbania o siebie', bonus: { energyMult: 0.08 } },
    coins: 150, xp: 1500, taunt: 'Jeszcze tylko jeden odcinek o 2 w nocy…', guard: 'poorSleep', regenPct: 0.03,
  },
  {
    id: 'compare', name: 'Widmo Porównań', emoji: '👻', order: 10, unlockLevel: 30, hp: 12000,
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_mirror', name: 'Lustro Prawdy', emoji: '🪞', desc: '+7% uniku, +3% atak', bonus: { dodge: 0.07, atk: 0.03 } },
    coins: 200, xp: 2000, taunt: 'Zobacz, o ile innym lepiej…', regenPct: 0.03,
  },
  {
    id: 'drought', name: 'Hydra Odwodnienia', emoji: '🐙', order: 11, unlockLevel: 35, hp: 16000,
    weakness: 'water', weaknessLabel: 'woda (cel dnia)',
    loot: { id: 'loot_spring', name: 'Fiolka Źródła', emoji: '💧', desc: '+6% atak, +4% kryt', bonus: { atk: 0.06, crit: 0.04 } },
    coins: 280, xp: 2800, taunt: 'Kawa liczy się jako woda, nie?', regenPct: 0.03,
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
    coins: 550, xp: 5500, taunt: 'I tak ci się nie uda…', regenPct: 0.04,
  },
  {
    id: 'devourer', name: 'Pożeracz Nawyków', emoji: '👹', order: 14, unlockLevel: 52, hp: 42000,
    weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    loot: { id: 'loot_crown', name: 'Korona Mistrza', emoji: '👑', desc: '+10% atak, +8% uniku, +8% energii, +5% kryt', bonus: { atk: 0.10, dodge: 0.08, energyMult: 0.08, crit: 0.05 } },
    coins: 900, xp: 9000, taunt: 'Wróć do starych nawyków, będzie łatwiej…', guard: 'sweets', regenPct: 0.04,
  },
];

export function bossById(id: string): Boss | undefined { return BOSSES.find(b => b.id === id); }

// Ranga bossa kampanii — DERYWOWANA z unlockLevel, nie osobne pole do ręcznego tagowania
// (mniej okazji do pomyłki, nowe bossy klasyfikują się same). Granica 26 = już istniejący
// komentarz „endgame" przy insomnia niżej. Podstawa pod przyszłą pasywkę „blokuj % ataków
// common bossów" — raid/wydarzenia mają OSOBNE typy (Raid/EventBoss), więc są „event" z
// definicji, bez potrzeby dodatkowego pola.
export type BossTier = 'common' | 'elite';
export function bossTier(boss: Boss): BossTier {
  return boss.unlockLevel >= 26 ? 'elite' : 'common';
}

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
  boughtSweetToday: boolean;
  sleepMinutes: number;     // dziś (0 = brak danych)
  waterRatio: number;       // 0..1 (szklanki dziś / cel)
}

// Bonus damage multiplier for hitting a boss's weakness with the right habit.
export function weaknessMult(boss: Boss, c: WeaknessCtx): number {
  switch (boss.weakness) {
    case 'steps':     return 1 + Math.min(1.5, c.stepsToday / 10000) * 0.2;
    case 'sweetless': return 1 + Math.min(30, c.sweetlessDays) * 0.02;
    case 'habits':    return 1 + c.habitsRatio * 0.3;
    case 'mood':      return 1 + (c.moodLoggedToday ? 0.25 : 0);
    case 'sleep':     return 1 + Math.min(1, c.sleepMinutes / 420) * 0.25;   // 7h+ = pełny bonus
    case 'water':     return 1 + Math.min(1, c.waterRatio) * 0.25;
  }
}

// OSŁONA: dziś zrobiłeś złą rzecz, na którą boss „żeruje" → Twój cios jest słabszy.
export function bossGuarded(boss: Boss, c: WeaknessCtx): boolean {
  if (boss.guard === 'sweets') return c.boughtSweetToday;
  if (boss.guard === 'poorSleep') return c.sleepMinutes > 0 && c.sleepMinutes < 360; // <6h
  return false;
}

// Czy DZIŚ spełniłeś zdrowe zachowanie tego bossa (jeśli NIE → regeneruje się).
export function weaknessMet(boss: Boss, c: WeaknessCtx): boolean {
  switch (boss.weakness) {
    case 'steps':     return c.stepsToday >= 6000;
    case 'sweetless': return !c.boughtSweetToday;
    case 'habits':    return c.habitsRatio >= 0.5;
    case 'mood':      return c.moodLoggedToday;
    case 'sleep':     return c.sleepMinutes >= 360;
    case 'water':     return c.waterRatio >= 0.5;
  }
}

export function atkMultiplier(level: number, bonuses: Bonuses): number {
  return 1 + level * 0.03 + bonuses.atk;
}

// ── Kontratak bossa (v4 redesign, fundament — patrz memory boss_design.md) ────────
// Czysta funkcja, NIC jeszcze jej nie wywołuje w grze — bezpieczny krok przygotowawczy.
// Skaluje z HP bossa (większy boss = mocniejszy kontratak), nie z poziomem gracza —
// tak jak walka z bossem samym w sobie już skaluje trudność. `dodge` z Bonuses redukuje
// obrażenia (0 = pełny cios, 0.9 = maks. redukcja — ten sam cap co przy regen bossa).
const COUNTER_PCT = 0.04; // ułamek max HP bossa zadawany kotkowi na kontratak
export function counterDamage(boss: Boss, dodge: number): number {
  const base = boss.hp * COUNTER_PCT;
  return Math.round(base * (1 - Math.min(0.9, Math.max(0, dodge))));
}

// One attack: spends all banked energy into a hit (crit doubles it).
export function computeDamage(energy: number, level: number, bonuses: Bonuses, boss: Boss, wc: WeaknessCtx): { damage: number; crit: boolean } {
  const base = energy * atkMultiplier(level, bonuses) * weaknessMult(boss, wc);
  const crit = Math.random() < bonuses.crit;
  return { damage: Math.round(base * (crit ? 2 : 1)), crit };
}

// ── Symulacja walki 1v1 (v4 redesign, S&F-style — patrz memory boss_design.md) ────
// Czysta funkcja, NIC jeszcze jej nie wywołuje w grze (bezpieczny krok przygotowawczy,
// jak counterDamage wyżej). Cała walka rozstrzyga się w jednym wywołaniu — kilka RUND
// wymiany ciosów, nie jeden cios: energia dzielona równo między rundy, każda runda =
// Twój cios (z szansą kryt) → jeśli boss przeżył → jego kontratak na kotka. Walka
// kończy się NATYCHMIAST gdy któraś strona spadnie do 0 HP (reszta rund się nie
// dogrywa) — trafienie w bossa zawsze rozstrzyga się PRZED jego kontratakiem, więc
// nie ma martwego remisu „oboje padli w tej samej rundzie".
// PRZEGRANA (catHp=0) LUB wyczerpanie rund bez zabicia = to samo dla bossa kampanii:
// jego HP resetuje się do pełna na następną próbę (karczma S&F) — `won` to jedyny
// wynik, który się liczy trwale; `catFainted` jest tylko do komunikatu w UI.
export const FIGHT_ROUNDS = 3;

export interface FightRound {
  playerDmg: number;
  playerCrit: boolean;
  bossHpAfter: number;
  healed: number;       // REGENERACJA bossa tej rundy (0 = brak)
  counterDmg: number;
  catHealed: number;    // item „heal" zadziałał tej rundy (0 = brak)
  catHpAfter: number;
}

export interface FightResult {
  rounds: FightRound[];
  won: boolean;         // HP bossa spadło do 0
  catFainted: boolean;  // HP kotka spadło do 0 (walka przegrana, nie wygrana)
  guarded: boolean;      // OSŁONA aktywna cały ten fight (dziś zrobiłeś złą rzecz — Twoje ciosy ×0.5)
  bossHpLeft: number;
  catHpLeft: number;
}

export interface EquippedItem { id: CombatItemId; level: number }

// `guarded`/regen czytane RAZ na starcie fightu z dzisiejszego wc (nie zmieniają się
// w trakcie walki — to wciąż te same mechaniki co attackBoss/healBoss, tylko przeniesione
// na skalę „jedna próba" zamiast „wiele dni" teraz gdy boss resetuje HP co próbę.
// `items` DOMYŚLNIE PUSTA — dopóki nie ma UI do zakładania (ekwipunek w petStore już
// istnieje, ale nic go jeszcze nie ustawia), każde dotychczasowe wywołanie zachowuje
// się DOKŁADNIE jak przed tym commitem. Zero ryzyka dla żywej gry.
export function simulateFight(
  energy: number, level: number, bonuses: Bonuses, boss: Boss, wc: WeaknessCtx,
  catHpStart: number, roundCount: number = FIGHT_ROUNDS, items: EquippedItem[] = [],
): FightResult {
  const perRoundEnergy = energy / Math.max(1, roundCount);
  const guarded = bossGuarded(boss, wc);
  const willRegen = !!boss.regenPct && !weaknessMet(boss, wc);
  const levelOf = (id: CombatItemId) => items.find(it => it.id === id)?.level ?? 0;
  const has = (id: CombatItemId) => levelOf(id) > 0;

  let bossHp = boss.hp;
  let catHp = catHpStart;
  let ignited = false;   // item 'fire' — raz podpalony, DoT do końca walki
  let healUsed = false;  // item 'heal' — jednorazowe w całej walce
  const rounds: FightRound[] = [];

  for (let i = 0; i < roundCount; i++) {
    if (bossHp <= 0 || catHp <= 0) break;
    let { damage, crit } = computeDamage(perRoundEnergy, level, bonuses, boss, wc);
    if (guarded) damage = Math.round(damage * 0.5);
    if (has('headshot') && Math.random() < HEADSHOT_CHANCE) damage = Math.round(damage * 2);
    bossHp = Math.max(0, bossHp - damage);

    // 'fire' — szansa na podpalenie (raz), potem gwarantowany DoT co rundę do końca walki
    if (has('fire') && !ignited && bossHp > 0 && Math.random() < fireProcChanceAt(levelOf('fire'))) ignited = true;
    if (ignited && bossHp > 0) bossHp = Math.max(0, bossHp - Math.round(boss.hp * FIRE_DOT_PCT));

    let counterDmg = 0;
    let healed = 0;
    if (bossHp > 0) {
      // 'execute' — HP bossa poniżej progu → instakill (sprawdzone PRZED regeneracją,
      // żeby regen nie mógł "uratować" bossa z progu egzekucji tej samej rundy)
      if (has('execute') && bossHp / boss.hp < executeThresholdAt(levelOf('execute'))) {
        bossHp = 0;
      } else {
        if (willRegen) {
          healed = Math.round(boss.hp * boss.regenPct!);
          bossHp = Math.min(boss.hp, bossHp + healed);
        }
        // 'mindcontrol' — szansa, że boss w ogóle nie kontratakuje tej rundy
        const controlled = has('mindcontrol') && Math.random() < MIND_CONTROL_CHANCE;
        if (!controlled) {
          counterDmg = counterDamage(boss, bonuses.dodge);
          // 'dodge' — całkowity unik kontrataku
          if (counterDmg > 0 && has('dodge') && Math.random() < dodgeChanceAt(levelOf('dodge'))) counterDmg = 0;
          // 'reflect' — szansa odbić kontratak na bossa zamiast na kotka
          if (counterDmg > 0 && has('reflect') && Math.random() < reflectPctAt(levelOf('reflect'))) {
            bossHp = Math.max(0, bossHp - counterDmg);
            counterDmg = 0;
          }
          // 'shield' — stała redukcja tego co faktycznie dolatuje do kotka
          if (counterDmg > 0 && has('shield')) counterDmg = Math.round(counterDmg * (1 - SHIELD_REDUCTION_PCT));
          if (counterDmg > 0) catHp = Math.max(0, catHp - counterDmg);
          // 'thorn' — gwarantowane małe odbicie, bez szansy, niezależnie od 'reflect'
          if (has('thorn') && bossHp > 0) bossHp = Math.max(0, bossHp - Math.round(boss.hp * THORN_PCT));
        }
      }
    }

    // 'heal' — pierwszy raz w tej walce, gdy HP kotka spadnie <50%
    let catHealed = 0;
    if (has('heal') && !healUsed && catHp > 0 && catHp / catHpStart < 0.5) {
      catHealed = Math.round(catHpStart * HEAL_ONCE_PCT);
      catHp = Math.min(catHpStart, catHp + catHealed);
      healUsed = true;
    }

    rounds.push({ playerDmg: damage, playerCrit: crit, bossHpAfter: bossHp, healed, counterDmg, catHealed, catHpAfter: catHp });
  }
  return { rounds, won: bossHp <= 0, catFainted: catHp <= 0 && bossHp > 0, guarded, bossHpLeft: bossHp, catHpLeft: catHp };
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
