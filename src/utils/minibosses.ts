import { Boss, BossLoot, Bonuses, atkPower } from '@/utils/bosses';

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
}

export const MINIBOSSES: MiniBoss[] = [
  { id: 'mb_capybara', name: 'Kapibara Chillu', emoji: '🦫', taunt: 'Po co się wysilać, i tak jest się chill…' },
  { id: 'mb_duck', name: 'Kaczka Kałuży', emoji: '🦆', taunt: 'Ta kałuża w pełni wystarczy…' },
  { id: 'mb_shark', name: 'Rekinek Fali', emoji: '🦈', taunt: 'Ledwo mokro, po co ten wysiłek…' },
  { id: 'mb_whale', name: 'Wieloryb Głębin', emoji: '🐳', taunt: 'Jedna rzecz nic nie zmieni…' },
  { id: 'mb_goat', name: 'Koza Uparta', emoji: '🐐', taunt: 'Po co iść dalej, tu jest wygodnie…' },
  { id: 'mb_harpy', name: 'Harpia Wichru', emoji: '🦅', taunt: 'To się nie liczy jako osiągnięcie…' },
  { id: 'mb_macaws', name: 'Ary Dżungli', emoji: '🦜', taunt: 'Zostań na gałęzi, tu jest bezpiecznie…' },
  { id: 'mb_snake', name: 'Wąż Ścieżki', emoji: '🐍', taunt: 'Po co się starać, można się czołgać…' },
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
  };
}
