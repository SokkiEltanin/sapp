// Potki czasowe (2026-09-08) — user planuje przebudowę Rynku: górne 4 sloty tablicy mają
// zawierać Zamrożenie serii + 3 potki (HP/ATK/XP na 24h) zamiast skrzynki dnia + 3 loot-boxów
// (patrz ARCHITECTURE.md §47). W odróżnieniu od `ownedGear`/`ownedCombatItems` (TRWAŁE,
// posiadanie na zawsze) potka to jednorazowy zakup → natychmiastowa konsumpcja → efekt
// wygasający po `durationHours` — najbliższy istniejący wzorzec to `missionEndsAt`/
// `energyRegenAt` w petStore.ts (ISO timestamp + leniwe sprawdzenie `Date.now() > endsAt`
// przy odczycie, bez osobnego tickera czyszczącego stan w tle).
//
// Tylko JEDNA potka aktywna naraz (`PetState.activePotion`, nie mapa per-typ) — kupienie
// nowej PODMIENIA poprzednią (bez zwrotu monet za niewykorzystany czas) — najprostszy model,
// do skorygowania jeśli user zechce stackować 3 naraz.
export type PotionKind = 'hp' | 'atk' | 'xp';

export interface PotionDef {
  kind: PotionKind;
  name: string;
  desc: string;
  cost: number;
  durationHours: number;
  color: string;       // tag koloru do UI (pigułka w sklepie, badge na /pet) — te same barwy co
                        // istniejące etykiety ATK/HP na ekranie Siła bojowa (app/pet.tsx)
  hpBonus?: number;     // flat max-HP, stackuje się jak `gearFlatHp` (nie %, żeby nie przeliczać
                        // procentu z ruchomej podstawy przy każdym odczycie)
  atkBonus?: number;    // ułamkowy dodatek do `bonuses.atk` walki — stackuje się DOKŁADNIE tak
                        // samo jak loot/gear (addytywnie), patrz `atkMultiplier` w bosses.ts
  xpMult?: number;      // mnożnik XP z KAŻDEGO źródła (questy/walki/careTick) dopóki aktywna
}

export interface ActivePotion { kind: PotionKind; endsAt: string }

// Umiarkowany balans (2026-09-08) — wybrany świadomie zamiast zgadywania w ciemno: wystarczająco
// odczuwalny na 24h, ale nie psujący trudności bossów (COUNTER_PCT itd. liczone bez uwzględnienia
// potek). Do skorygowania po realnym teście na urządzeniu — user może poprosić o inne liczby.
export const POTIONS: Record<PotionKind, PotionDef> = {
  hp:  { kind: 'hp',  name: 'Eliksir Wytrzymałości', desc: '+20 max HP na 24h',          cost: 60, durationHours: 24, color: '#2AC68F', hpBonus: 20 },
  atk: { kind: 'atk', name: 'Eliksir Furii',         desc: '+15% ataku na 24h',          cost: 60, durationHours: 24, color: '#F87171', atkBonus: 0.15 },
  xp:  { kind: 'xp',  name: 'Eliksir Mądrości',      desc: '+25% zdobywanego XP na 24h', cost: 60, durationHours: 24, color: '#A78BFA', xpMult: 1.25 },
};

export function isPotionActive(p: ActivePotion | null | undefined, kind?: PotionKind): boolean {
  if (!p) return false;
  if (kind && p.kind !== kind) return false;
  return new Date(p.endsAt).getTime() > Date.now();
}

export function potionFlatHp(p: ActivePotion | null | undefined): number {
  return isPotionActive(p, 'hp') ? (POTIONS.hp.hpBonus ?? 0) : 0;
}

export function potionAtkBonus(p: ActivePotion | null | undefined): number {
  return isPotionActive(p, 'atk') ? (POTIONS.atk.atkBonus ?? 0) : 0;
}

export function potionXpMult(p: ActivePotion | null | undefined): number {
  return isPotionActive(p, 'xp') ? (POTIONS.xp.xpMult ?? 1) : 1;
}

// "3h 42min" / "48min" — ten sam format co fmtShopRefresh (pet-shop.tsx) — godziny+minuty,
// bez sekund (user i tak nie patrzy w czasie rzeczywistym co sekundę).
export function fmtPotionCountdown(endsAt: string): string {
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}
