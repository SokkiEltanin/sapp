import { WeaknessKey } from '@/utils/bosses';

// RAID TYGODNIOWY — jeden gruby boss na cały tydzień, inny co tydzień (świeżość). Bijesz go
// całotygodniową dbałością o siebie (energia banked jak w kampanii). Pokonanie = kolekcjonerski
// medal (rośnie ściana trofeów) + monety/XP. Reset w poniedziałek (weekKeyOf z quests).
//
// UWAGA: ten plik NIE importuje lucide-react-native mimo że UI teraz renderuje raidy jako
// ikony — lucide-react-native ciągnie za sobą react-native-svg, którego Jest nie potrafi
// sparsować z poziomu czystego pliku logiki (raid.ts jest importowany bezpośrednio przez
// testy). Mapowanie id→ikona żyje osobno w src/utils/bossUiIcons.ts (mirror bossIcons.ts),
// importowane TYLKO przez ekrany (bosses.tsx), nigdy przez testy. Ten sam wzorzec dla
// seasonalEvents.ts i lootIcon() z bosses.ts.

export interface Raid {
  id: string;
  name: string;
  emoji: string;
  weakness: WeaknessKey;
  weaknessLabel: string;
  taunt: string;
  trophyEmoji: string;
}

export const RAID_POOL: Raid[] = [
  { id: 'kraken',   name: 'Kraken Chaosu',      emoji: '🦑', weakness: 'habits',    weaknessLabel: 'nawyki',          taunt: 'Ten tydzień i tak Ci ucieknie…', trophyEmoji: '🏆' },
  { id: 'golem',    name: 'Golem Lenistwa',     emoji: '🗿', weakness: 'steps',     weaknessLabel: 'kroki',           taunt: 'Zostań w łóżku cały tydzień…',   trophyEmoji: '🥇' },
  { id: 'phantom',  name: 'Fantom Smutku',      emoji: '👻', weakness: 'mood',      weaknessLabel: 'wpisy nastroju',  taunt: 'Nie zaglądaj w siebie…',         trophyEmoji: '🎖️' },
  { id: 'behemoth', name: 'Behemot Cukru',      emoji: '🍭', weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',taunt: 'Słodki tydzień, co?',            trophyEmoji: '🏅' },
  { id: 'wyrm',     name: 'Żmij Bezsenności',   emoji: '🐉', weakness: 'sleep',     weaknessLabel: 'sen (7h+)',       taunt: 'Po co spać w weekend…',          trophyEmoji: '💠' },
  { id: 'siren',    name: 'Syrena Pragnienia',  emoji: '🌊', weakness: 'water',     weaknessLabel: 'woda (cel dnia)', taunt: 'Woda jest nudna…',               trophyEmoji: '🔱' },
];

function hashOf(s: string, mul: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * mul + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministyczny raid dla danego tygodnia (ten sam klucz → ten sam boss).
export function raidForWeek(weekKey: string): Raid {
  return RAID_POOL[hashOf(weekKey, 31) % RAID_POOL.length];
}

// HP raidu — rośnie z poziomem (zawsze wyzwanie) + lekka wariacja tygodniowa.
// Skalibrowane pod realny tygodniowy output: energia banked ~raz/dzień (attackAtak zeruje
// pulę, syncRaidEnergy nie dobija ponad dzisiejszy próg) = maks ~350×(1+energyMult) dziennie,
// × atkMultiplier(level) × weaknessMult(~1.15 śr.) × drobny bonus z critów. Stary base
// (8000 + level×900) dawał raid killowalny w ~20-30% w tydzień — im wyższy poziom, tym
// GORZEJ (HP rosło ×900/lvl, output tylko ~×0.03/lvl) = odwrotność zamierzonego. Nowy
// base trzyma się blisko realnego tygodniowego dmg na każdym poziomie (do ubicia przy
// codziennym graniu, ciasno gdy odpuścisz dzień-dwa).
export function raidHpFor(level: number, weekKey: string): number {
  const base = 2000 + Math.max(0, level) * 220;
  const variance = 100 + (hashOf(weekKey, 17) % 20);   // 100..119%
  return Math.round(base * variance / 100 / 100) * 100;
}

export const raidCoins = (level: number) => 60 + Math.max(0, level) * 6;
export const raidXp = (level: number) => 400 + Math.max(0, level) * 40;
