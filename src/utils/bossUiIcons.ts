import {
  Sword, Wind, Target, Zap, Crown,
  Waves, Mountain, Ghost, Candy, Flame, Droplets,
  Gift, Egg, Sun, Briefcase, Cookie, Trophy, LucideIcon,
} from 'lucide-react-native';
import { BossLoot } from '@/utils/bosses';

// Ikony dla raid.ts/seasonalEvents.ts/bosses.ts loot — WYDZIELONE z tamtych plików
// (2026-08-10, user: "nadal za dużo emotek, zrób z lucide") specjalnie dlatego, że
// lucide-react-native ciągnie za sobą react-native-svg, którego Jest nie potrafi
// sparsować z poziomu pliku importowanego bezpośrednio przez testy (raid.test.ts nie
// istnieje, ale bosses.test.ts/seasonalEvents.test.ts importują bosses.ts/
// seasonalEvents.ts wprost — stąd osobny plik, importowany TYLKO przez ekrany).

// ── Łupy bossów kampanii — dobrana z DOMINUJĄCEJ staty bonusu, nie tematycznie: ikona
// mówi CO item robi (bardziej przydatne niż niezwiązana z mechaniką emotka). 3+ staty
// naraz (legendarne, np. Korona Mistrza) → Crown niezależnie od tego, która dominuje. ──
export function lootIcon(loot: BossLoot): LucideIcon {
  const b = loot.bonus;
  const keys = (Object.keys(b) as (keyof typeof b)[]).filter(k => (b[k] ?? 0) > 0);
  if (keys.length >= 3) return Crown;
  const dominant = keys.reduce((a, k) => ((b[k] ?? 0) > (b[a] ?? 0) ? k : a), keys[0]);
  if (dominant === 'atk') return Sword;
  if (dominant === 'dodge') return Wind;
  if (dominant === 'crit') return Target;
  return Zap; // energyMult (albo brak staty w ogóle — nie powinno się zdarzyć, bezpieczny fallback)
}

// ── Raid tygodniowy — brak dedykowanego arta, więc ikona to JEDYNA tożsamość wizualna,
// dobrana tematycznie (nie z mechaniki, w przeciwieństwie do łupów powyżej). ──
export const RAID_ICON: Record<string, LucideIcon> = {
  kraken: Waves, golem: Mountain, phantom: Ghost, behemoth: Candy, wyrm: Flame, siren: Droplets,
};
export function raidIcon(id: string): LucideIcon { return RAID_ICON[id] ?? Trophy; }

// ── Wydarzenia sezonowe + nemesis miesiąca — sam powód co raid. ──
export const EVENT_ICON: Record<string, LucideIcon> = {
  mikolaj: Gift, wielkanoc: Egg, wakacje: Sun, overtime: Briefcase, sweettooth: Cookie,
};
export function eventIcon(id: string): LucideIcon { return EVENT_ICON[id] ?? Trophy; }
