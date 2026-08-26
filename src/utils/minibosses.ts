import { Boss, BossLoot, Bonuses, atkPower, AttackKind } from '@/utils/bosses';

// MINIBOSSY v2 (2026-08-14) — user sprecyzował że pierwsza wersja (osobny ekran, tory
// woda/kroki, płaska łatwa walka DODANA nad questami) była źle zrozumiana. Poprawny
// kształt: KAŻDY quest dzienny/bonusowy (quests.ts) po wykonaniu pokazuje przycisk
// "Walcz" ZAMIAST zwykłego "Odbierz" — pełna walka (simulateFight, jak kampania) z
// minibossem przypisanym do TEGO questu na TEN dzień. Standardowe monety za same questy
// ZNIKAJĄ — jedyna droga do nagrody to wygrana. Trudność (HP) rośnie z poziomem kotka;
// nagroda (coins/xp) to bazowa stawka questu (już przeliczona przez questRewardMult w
// quests.ts) × FIGHT_BONUS — więcej niż dawał zwykły claim, żeby opłacało się walczyć.
//
// UWAGA: bez importu minibossIcons.ts tutaj (require() na obrazkach) — ten plik importują
// testy bezpośrednio, patrz identyczny komentarz w raid.ts/seasonalEvents.ts.

export interface MiniBoss {
  id: string;
  name: string;
  emoji: string;
  taunt: string;
  attackKind?: AttackKind; // 2026-08-17 — patrz komentarz nad AttackKind w bosses.ts
  // Nazwa MIEJSCA gdzie pupil podróżuje w misji (utils/missions.ts, 2026-08-20, user: "musimy
  // im nazwy dać miejsc w które podróżuje i dopasować bosy z którym walczy pupil" — miejsce
  // dopasowane tematycznie do zwierzaka, żeby "Wysyła kotka do Leniwego Bajora" pasowało do
  // tego KTO tam czeka (`minibossForMission` już deterministycznie łączy jedno z drugim, to
  // pole tylko dodaje nazwę widoczną NA scenie w trakcie podróży, patrz `app/pet.tsx`).
  // Nieużywane przez dzienne questy (`minibossForQuest`) — tam nie ma pojęcia "podróży".
  destination: string;
}

// Tylko zwierzęta z jednoznacznym pazur/szpon w charakterze dostają `attackKind: 'claw'`
// (harpia szpony, wilk/grizzly/ary/wąż — 2026-08-26, user: "ta pięść jest zdecydowanie za
// często... ara bo ma pazury... wąż możemy też pazury") — reszta rosteru zostaje na fallback
// pięści, ta sama zasada co w bosses.ts/raid.ts.
//
// 2026-08-26 (user: "chciałem ich jako bossów więcej do questów żeby nie były takie stałe że
// koza jest, koza wywalamy, wieloryba też chyba") — koza (`mb_goat`) i wieloryb (`mb_whale`)
// USUNIĘTE (za często losowani, user chciał świeżości w rotacji), zastąpione wilkiem, grizzly
// i osą — user dostarczył WŁASNY art (`BOSS_atakpazury_wilk.png`/`BOSS_atakpazury_grizly.png`,
// ta sama konwencja co pazurzaste bossy kampanii). Osa dostała plik bez jednoznacznego typu
// ataku w nazwie (`osa_BOSSYuntitled.png`) — user nie sprecyzował attackKind, więc zgodnie z
// domyślną zasadą (niejednoznaczny atak = pięść) zostaje bez wpisu, tak jak reszta rosteru.
export const MINIBOSSES: MiniBoss[] = [
  { id: 'mb_capybara', name: 'Kapibara Chillu', emoji: '🦫', taunt: 'Po co się wysilać, i tak jest się chill…', destination: 'Leniwe Bajoro' },
  { id: 'mb_duck', name: 'Kaczka Kałuży', emoji: '🦆', taunt: 'Ta kałuża w pełni wystarczy…', destination: 'Kałuża za Płotem' },
  { id: 'mb_shark', name: 'Rekinek Fali', emoji: '🦈', taunt: 'Ledwo mokro, po co ten wysiłek…', destination: 'Rafa Przypływu' },
  { id: 'mb_harpy', name: 'Harpia Wichru', emoji: '🦅', taunt: 'To się nie liczy jako osiągnięcie…', attackKind: 'claw', destination: 'Wichrowy Szczyt' },
  { id: 'mb_macaws', name: 'Ary Dżungli', emoji: '🦜', taunt: 'Zostań na gałęzi, tu jest bezpiecznie…', attackKind: 'claw', destination: 'Szmaragdowa Dżungla' },
  { id: 'mb_snake', name: 'Wąż Ścieżki', emoji: '🐍', taunt: 'Po co się starać, można się czołgać…', attackKind: 'claw', destination: 'Piaszczysta Ścieżka' },
  { id: 'mb_wilk', name: 'Wilk Głodu', emoji: '🐺', taunt: 'Zjesz jutro, dziś odpuść…', attackKind: 'claw', destination: 'Mroźna Ostoja' },
  { id: 'mb_grizzly', name: 'Grizzly Ospałości', emoji: '🐻', taunt: 'Prześpij to, nic się nie stanie…', attackKind: 'claw', destination: 'Niedźwiedzia Gawra' },
  { id: 'mb_osa', name: 'Osa Rozproszenia', emoji: '🐝', taunt: 'Ciągle coś Cię rozprasza, i tak dobrze…', destination: 'Osie Gniazdo' },
];

function hashOf(s: string, mul: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * mul + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministyczny miniboss na dany dzień/quest (ten sam dzień+quest → ten sam wynik, więc
// UI pokazuje to samo zwierzę cały dzień; jutro/inny quest → inne, świeżość jak w raidzie).
export function minibossForQuest(dateISO: string, questId: string): MiniBoss {
  return MINIBOSSES[hashOf(`${dateISO}:${questId}`, 31) % MINIBOSSES.length];
}

// HP przywiązane do REALNEJ mocy ataku kotka (atkPower z bosses.ts), nie do osobnej liniowej
// krzywej. Fix 2026-08-15 #1: user — "dają 1hp dmg dla mnie a ja ich wale na 2 hity" — stara
// stała krzywa (50 + level×5) rosła WOLNIEJ niż atkMultiplier(level), więc quest-bossy
// stawały się trywialne w mid-game.
//
// Fix 2026-08-15 #2 (ten sam dzień, user zgłosił ponownie): pierwsza wersja tego fixu liczyła
// hp z atkPower(0, level, ZERO_BONUSES) — czyli mocy ataku BEZ zakupionego atkStatBonus i BEZ
// bonusów z łupu (ownedItems). Ale realny cios gracza w walce liczy się z computeDamage
// (bosses.ts), które BIERZE pod uwagę oba te źródła mocy — więc gracz z realną inwestycją
// (np. atkStatBonus kupiony za monety) zadawał 100+ dmg bossowi wyliczonemu na "vanilla" moc
// ataku, zabijając go w 1-2 ciosy, a kontratak (procent z już mikroskopijnego pozostałego hp)
// zdejmował ledwie 1% zdrowia kotka. Teraz `questBossHpFor` bierze TE SAME argumenty co
// `computeDamage` (atkStatBonus, bonuses) — trudność skaluje się z CAŁĄ realną mocą gracza,
// nie tylko z poziomem, więc inwestycja w staty przestaje trywializować te walki na stałe.
const QUEST_BOSS_TARGET_HITS = 4;
export const questBossHpFor = (atkStatBonus: number, level: number, bonuses: Bonuses) =>
  Math.round(atkPower(atkStatBonus, Math.max(0, level), bonuses) * QUEST_BOSS_TARGET_HITS);

// Nagroda = bazowa stawka questu (już po questRewardMult w quests.ts) × bonus za walkę —
// user: "przez to dają więcej monet i więcej XP" niż dawał zwykły claim. 1.6 = +60%.
export const FIGHT_BONUS = 1.6;
export const questFightCoins = (baseCoins: number) => Math.round(baseCoins * FIGHT_BONUS);
export const questFightXp = (baseXp: number) => Math.round(baseXp * FIGHT_BONUS);

// Placeholder — jak w seasonalEvents.ts: Boss wymaga pola `loot`, ale miniboss questowy nie
// daje przedmiotu (tylko coins/xp), więc nic go nigdy nie czyta.
const MINIBOSS_PLACEHOLDER_LOOT: BossLoot = { id: '', name: '', emoji: '', desc: '', bonus: {} };

// MiniBoss + aktualna moc gracza → Boss-kształtny obiekt gotowy do simulateFight(). `weakness`
// jest wymagane przez typ Boss, ale minibossy questowe nie mają mechaniki osłabiania —
// wartość nieużywana.
export function minibossAsBoss(mb: MiniBoss, atkStatBonus: number, level: number, bonuses: Bonuses): Boss {
  return {
    id: mb.id, name: mb.name, emoji: mb.emoji,
    order: 0, unlockLevel: 0, hp: questBossHpFor(atkStatBonus, level, bonuses),
    weakness: 'habits', weaknessLabel: '',
    loot: MINIBOSS_PLACEHOLDER_LOOT, coins: 0, xp: 0, taunt: mb.taunt,
    attackKind: mb.attackKind,
  };
}
