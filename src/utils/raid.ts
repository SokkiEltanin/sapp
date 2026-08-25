import { WeaknessKey, AttackKind, Boss, BossLoot, Bonuses, atkPower } from '@/utils/bosses';

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
  attackKind?: AttackKind; // 2026-08-17 — patrz komentarz nad AttackKind w bosses.ts
}

// attackKind: kraken=claw (macki/szpony), phantom=magic (zjawa) — te dwa mają jednoznaczny
// motyw z 3 kategorii. golem/behemoth/wyrm/siren zostają bez wpisu → fallback pięść, tak samo
// jak sugar/drought/dragon w kampanii dzielące ten sam motyw (fizyczny cios, nie pazur/miecz/
// magia).
export const RAID_POOL: Raid[] = [
  { id: 'kraken',   name: 'Kraken Chaosu',      emoji: '🦑', weakness: 'habits',    weaknessLabel: 'nawyki',          taunt: 'Ten tydzień i tak Ci ucieknie…', trophyEmoji: '🏆', attackKind: 'claw' },
  { id: 'golem',    name: 'Golem Lenistwa',     emoji: '🗿', weakness: 'steps',     weaknessLabel: 'kroki',           taunt: 'Zostań w łóżku cały tydzień…',   trophyEmoji: '🥇' },
  { id: 'phantom',  name: 'Fantom Smutku',      emoji: '👻', weakness: 'mood',      weaknessLabel: 'wpisy nastroju',  taunt: 'Nie zaglądaj w siebie…',         trophyEmoji: '🎖️', attackKind: 'magic' },
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
//
// PRZEKALIBROWANE (2026-08-14, balance audit #2, patrz memory boss_design.md) — poprzedni
// base (2000+level×220) był NIEUKOŃCZALNY przez pierwsze ~25-30 poziomów (symulacja w pełni
// zaangażowanego gracza: 34-60% HP zabitego w tydzień na Lv3-20), mimo że raid odblokowuje
// się już na Lv3. Nowy, niższy base robi z raidu coś realnie kończalnego blisko odblokowania,
// nie dopiero po miesiącach.
//
// UWAGA — świadomie NIEROZWIĄZANE: to samo audytowanie pokazało, że output gracza rośnie
// SZYBCIEJ niż jakikolwiek gładki wielomian od `level` potrafi nadążyć w górnych poziomach —
// bo output zależy nie tylko od poziomu, ale i od tego ILE bossów kampanii już pokonanych
// (kumulujący się % atk/dodge/energyMult z łupu, patrz bossBonuses w bosses.ts), a to DRUGA,
// niezależna oś progresji. Formuła licząca tylko `level` z natury nie może dokładnie trafić
// wszędzie — po ~Lv30-40 raid będzie stawał się coraz łatwiejszy (nadwyżka rosnąca do kilkuset
// %), to znany, zaakceptowany kompromis, nie przeoczenie. Właściwa naprawa endgame wymagałaby
// policzenia HP też od `defeatedBosses.length` (osobny parametr), nie tylko poziomu — większa
// zmiana, odłożona (patrz NEXT_STEPS.md).
export function raidHpFor(level: number, weekKey: string): number {
  const base = 1000 + Math.max(0, level) * 210;
  const variance = 100 + (hashOf(weekKey, 17) % 20);   // 100..119%
  return Math.round(base * variance / 100 / 100) * 100;
}

export const raidCoins = (level: number) => 60 + Math.max(0, level) * 6;
export const raidXp = (level: number) => 400 + Math.max(0, level) * 40;

// 2 zamiast 1 (2026-08-25, user: "zmieńmy licznik czerwonej energii na 2 zamiast 1") — teraz
// że raid to prawdziwa, pełna walka (nie krótka sesja), kosztuje więcej niż zwykły event.
export const RAID_ENERGY_COST = 2;

// HISTORIA (2026-08-17 → 2026-08-25) — pierwsza wersja "pełnej walki rundowej" (user: "miała
// być zwykła [walka], tylko taka która nie restartuje jego HP jak z tym drugim [event]")
// walczyła wobec MAŁEJ, sesyjnej "podstawki" (`raidSessionHpFor`, ~RAID_SESSION_HITS ciosów),
// NIE wobec surowej `raidHpFor` — bo `counterDamage()` liczy % wprost od `boss.hp` (patrz
// COUNTER_PCT w bosses.ts), więc hp rzędu tysięcy zabijałoby kotka jednym kontratakiem.
// Realny postęp sesji dopisywał się do trwałej puli PO zakończeniu małej sesji.
//
// PROBLEM (2026-08-25, user zagrał realnie: "mimo połowy ponad HP przerwało") — sesja
// KOŃCZYŁA SIĘ po ~6 ciosach niezależnie od tego ile REALNIE zostało bossowi (pasek rajdu
// ledwo drgał), co wyglądało jak przerwana walka, nie normalne starcie. Doprecyzowanie usera:
// "kotek walczy do końca, tyle ile mu zostawi tyle zostawi, ale kotek nawet jak przegra to HP
// bossa zostaje tyle ile po ostatnim ciosie" — czyli PRAWDZIWA, ciągła walka wobec REALNEJ,
// pozostałej puli (nie sesja-proxy), idąca aż ktoś padnie, z realnym stanem porażki — ALE
// nawet przegrana bankuje faktycznie zadane obrażenia (nie zeruje/nie cofa postępu jak w
// kampanii). Rozwiązanie problemu z counterDamage() BEZ powrotu do sesji-proxy: `Boss.
// counterHp` (bosses.ts, nowe pole) — ODDZIELNE źródło % kontrataku od `boss.hp`. `boss.hp`
// = PRAWDZIWA, pozostała pula (`raidRemaining` w boss-fight.tsx) — walka faktycznie ją zbija
// i pasek w arenie pokazuje ją WPROST, bez żadnego przeliczania sesja→realna skala. `boss.
// counterHp` = ta sama, bezpiecznie skalowana wartość co dawna "sesja" (`atkPower × stała`,
// nazwa zmieniona żeby nie sugerować już sesji) — kontratak zostaje rozsądny NIEZALEŻNIE od
// tego jak wielka jest realna pula. Efekt: kotek realnie "wytrzymuje" mniej więcej tyle rund
// ile dawniej trwała sesja, ale KAŻDA runda zbija PRAWDZIWE HP bossa, więc pasek realnie się
// rusza, a przegrana i tak zostawia trwały ślad zamiast znikać bez śladu.
export const RAID_COUNTER_HITS = 6;
export function raidCounterHpFor(atkStatBonus: number, level: number, bonuses: Bonuses): number {
  return Math.round(atkPower(atkStatBonus, Math.max(0, level), bonuses) * RAID_COUNTER_HITS);
}

const RAID_PLACEHOLDER_LOOT: BossLoot = { id: 'raid_placeholder', name: '', emoji: '', desc: '', bonus: {} };
export function raidAsBoss(raid: Raid, hp: number, counterHp: number): Boss {
  return {
    id: raid.id, name: raid.name, emoji: raid.emoji,
    order: 0, unlockLevel: 0, hp, counterHp,
    weakness: raid.weakness, weaknessLabel: raid.weaknessLabel,
    loot: RAID_PLACEHOLDER_LOOT, coins: 0, xp: 0, taunt: raid.taunt,
    attackKind: raid.attackKind,
  };
}
