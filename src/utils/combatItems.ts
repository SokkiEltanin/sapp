import { ImageSourcePropType } from 'react-native';

// Katalog itemów bojowych (v4.1 — patrz memory boss_design.md „ITEMY BOJOWE"). Ikony
// w assets/itemybossy/ (user dodał 2026-08-06). CZYSTO DEKLARATYWNY plik — nic z tego
// jeszcze nie działa w walce (simulateFight), to osobny, kolejny krok integracji:
// (1) ekwipunek w petStore (co gracz posiada/ma założone), (2) drop ze skrzynek,
// (3) wpięcie efektów w pętlę rund. Na razie same dane + formuły, testowalne.

export type CombatItemId =
  | 'headshot' | 'heal' | 'dodge' | 'fire' | 'execute' | 'reflect' | 'mindcontrol' | 'shield' | 'thorn';

export interface CombatItemDef {
  id: CombatItemId;
  name: string;
  desc: string;                    // krótki opis mechaniki
  maxLevel: number;
  icons: ImageSourcePropType[];    // icons[0] = poziom 1
}

export const COMBAT_ITEMS: Record<CombatItemId, CombatItemDef> = {
  headshot: {
    id: 'headshot', name: 'Strzał w Łeb', desc: '0,5% szansy/rundę na cios ×2', maxLevel: 1,
    icons: [require('../../assets/itemybossy/headshot.png')],
  },
  heal: {
    id: 'heal', name: 'Uzdrowienie', desc: 'Pierwszy raz HP kotka <50% w walce → lecz 5%', maxLevel: 1,
    icons: [require('../../assets/itemybossy/heal.png')],
  },
  dodge: {
    id: 'dodge', name: 'Unik', desc: 'Szansa na całkowity unik kontrataku bossa', maxLevel: 4,
    icons: [
      require('../../assets/itemybossy/LVL1DODGE_wind.png'),
      require('../../assets/itemybossy/LVL2DODGE_wind (1).png'),
      require('../../assets/itemybossy/LVL3DODGE_tornado.png'),
      require('../../assets/itemybossy/LVL4DODGE_storm.png'),
    ],
  },
  fire: {
    id: 'fire', name: 'Podpalenie', desc: 'Szansa na DoT — dodatkowe obrażenia w kolejnych rundach', maxLevel: 3,
    icons: [
      require('../../assets/itemybossy/LVL1FIRE_fire.png'),
      require('../../assets/itemybossy/LVL2FIRE_ghost.png'),
      require('../../assets/itemybossy/LVL3FIRE_warlock.png'),
    ],
  },
  execute: {
    id: 'execute', name: 'Egzekucja', desc: 'HP bossa poniżej progu → instakill', maxLevel: 3,
    icons: [
      require('../../assets/itemybossy/LVL1ISTADEATH_necromancer.png'),
      require('../../assets/itemybossy/LVL2ISTADEATH_knives.png'),
      require('../../assets/itemybossy/LVL3ISTADEATH_axe.png'),
    ],
  },
  reflect: {
    id: 'reflect', name: 'Odbicie', desc: 'Szansa na odbicie części obrażeń z powrotem na bossa', maxLevel: 4,
    icons: [
      require('../../assets/itemybossy/LVL1STUN_ice (1).png'),
      require('../../assets/itemybossy/LVL2STUN_ice.png'),
      require('../../assets/itemybossy/LVL3STUN_ice (2).png'),
      require('../../assets/itemybossy/LVL4STUN_freeze.png'),
    ],
  },
  mindcontrol: {
    id: 'mindcontrol', name: 'Kontrola Umysłu', desc: 'Szansa, że boss pominie kontratak tej rundy', maxLevel: 1,
    icons: [require('../../assets/itemybossy/mind-control.png')],
  },
  shield: {
    id: 'shield', name: 'Tarcza', desc: 'Stała redukcja wszystkich obrażeń przychodzących', maxLevel: 1,
    icons: [require('../../assets/itemybossy/shield.png')],
  },
  thorn: {
    id: 'thorn', name: 'Cierń', desc: 'Gwarantowane małe odbicie obrażeń co rundę (bez szansy — zawsze trochę)', maxLevel: 1,
    icons: [require('../../assets/itemybossy/thorn.png')],
  },
};

// ── Formuły efektów per poziom ──────────────────────────────────────────────────
// headshot/heal/fire(lvl2)/execute(lvl2)/reflect(zakres) mają DOKŁADNE liczby z opisu
// usera — reszta (dodge/mindcontrol/shield/thorn) to moje rozsądne robocze wartości,
// user nie podał liczb dla nich — do wyregulowania, gdy dojdzie do balansu.

export const HEADSHOT_CHANCE = 0.005;   // 0,5%/rundę, trafienie ×2
export const HEAL_ONCE_PCT = 0.05;      // +5% jednorazowo, gdy HP kotka pierwszy raz <50%

// TODO-balance (brak liczb od usera): 5/9/13/17% na poziomach 1-4.
export function dodgeChanceAt(level: number): number {
  return 0.05 + Math.max(0, level - 1) * 0.04;
}

// Z opisu: „1-5% zależnie od poziomu" na 4 poziomach.
const REFLECT_PCT_BY_LEVEL = [0.01, 0.02, 0.035, 0.05];
export function reflectPctAt(level: number): number {
  return REFLECT_PCT_BY_LEVEL[Math.min(Math.max(1, level), 4) - 1];
}

// Z opisu: poziom 2 (knives) = 3% → współczynnik 0,015/poziom.
export function executeThresholdAt(level: number): number {
  return level * 0.015;
}

// Z opisu: poziom 2 (ghost) = 4% szansy → współczynnik 0,02/poziom.
export function fireProcChanceAt(level: number): number {
  return level * 0.02;
}
export const FIRE_DOT_PCT = 0.02; // +2% dmg/rundę po podpaleniu, jak opisano

// TODO-balance (brak liczb od usera).
export const MIND_CONTROL_CHANCE = 0.03;   // 3% szansy, że boss nie kontratakuje tej rundy
export const SHIELD_REDUCTION_PCT = 0.05;  // -5% wszystkich obrażeń przychodzących
export const THORN_PCT = 0.02;             // gwarantowane -2% hp bossa co rundę (mały, pewny odzew)

export function itemById(id: CombatItemId): CombatItemDef { return COMBAT_ITEMS[id]; }

// Ulepszanie itemów bojowych za monety (UI w app/pet-stats.tsx) — taniej niż HP/ATK w
// sklepie, bo te itemy trzeba NAJPIERW wylosować ze skrzynki (COMBAT_ITEM_DROP_CHANCE_BY_TIER
// w crates.ts), więc samo posiadanie już jest rzadkie. DRUGI, RÓWNOLEGŁY tor ulepszania
// (2026-08-18) — epic/legendary skrzynki mogą ZAMIAST nowego itemu dać darmowy +1 poziom
// już posiadanemu (patrz openCrate() w petStore.ts) — coiny i drop to dwie NIEZALEŻNE ścieżki
// do tego samego capu (maxLevel), nie trzeba wybierać jednej. TODO-balance: brak danych z
// playtestów.
export const combatItemUpgradeCost = (currentLevel: number) => 25 + (currentLevel - 1) * 20;
