import { Boss, BOSSES, atkPower } from '@/utils/bosses';

// MAD bossy (2026-08-15) — user: "trzeba przemyśleć hp bossów" → zamiast rozciągać jedną
// krzywą HP w nieskończoność (dokładnie ten problem audyt 14.08 znalazł w raidzie: output
// gracza rośnie szybciej niż jakikolwiek gładki wzór od samego poziomu potrafi nadążyć),
// dodajemy DRUGĄ, dużo silniejszą falę tych samych 22 bossów kampanii jako trwały cel dla
// wysokich poziomów. User explicite wybrał: zwykła kampania BEZ zmian (unlockLevel 2→116
// zostaje), MAD to dodatkowa warstwa odblokowywana hurtem na lvl 50 — i TYLKO per-boss po
// pokonaniu jego zwykłej wersji (nie da się przeskoczyć kampanii).
//
// Wybór "aktualnego" MAD celu lustrzanie kopiuje campaignBoss w boss-fight.tsx
// (`BOSSES.find(b => !defeatedBosses.includes(b.id))`) — jeden wspólny cel po kolejności
// `order`, nie lista do wyboru. Stąd `?kind=mad` bez żadnego dodatkowego parametru id.
//
// HP liczone z REALNEJ, AKTUALNEJ mocy ataku gracza (jak questBossHpFor w minibosses.ts,
// fix z tej samej sesji) — NIE ze statycznej wartości zapisanej przy `unlockLevel` jak
// zwykłe bossy kampanii (patrz komentarz nad BOSSES w bosses.ts: ich hp jest zamrożone na
// atkPower(unlockLevel)). Dynamiczne liczenie oznacza że MAD NIGDY nie robi się przestarzały
// jak level rośnie dalej — bossy kampanii mogą (bo mierzone raz, przy odblokowaniu), raid ma
// ten sam problem w endgame (audyt 14.08, ŚWIADOMIE nierozwiązany) — MAD jest zaprojektowany
// żeby TEGO uniknąć od początku.
//
// UWAGA (sprawdzone throwaway-symulacją z realistycznym profilem inwestycji gracza, nie
// zgadywane): pierwsza wersja celowała w 14-25 ciosów (start od GÓRY zakresu kampanii) —
// symulacja pokazała że to matematycznie NIEWYGRYWALNE (0% win-rate) już od ok. 8-10 ciosów,
// bo `counterDamage()` liczy % od AKTUALNEGO hp bossa (bosses.ts), a hp bossa rośnie z
// atkPower(level) podczas gdy pula HP kotka NIE rośnie automatycznie z levelem (tylko z
// zakupionym catMaxHpBonus) — więcej ciosów = kwadratowo więcej skumulowanych kontrataków,
// nie liniowo. Bezpieczny, wciąż wyraźnie trudniejszy niż quest (4 ciosy) zakres: 6→8 ciosów
// (order 1→22), stabilne 100% win-rate do lvl~150 przy umiarkowanej inwestycji w symulacji.
export const MAD_UNLOCK_LEVEL = 50;
export const MAD_REWARD_MULT = 3;

const madHitsFor = (order: number) => 6 + (order - 1) * (2 / 21);
export const madBossHpFor = (level: number, order: number) =>
  Math.round(atkPower(0, Math.max(0, level), { atk: 0, dodge: 0, crit: 0, energyMult: 0 }) * madHitsFor(order));

export function madBossId(baseId: string): string { return `mad_${baseId}`; }

// Pierwszy pokonany-normalnie-ale-nie-MAD boss, po kolejności kampanii — null gdy jeszcze
// żaden boss nie padł, albo gdy wszystkie dotąd pokonane mają już MAD ukończone.
export function madCandidate(defeatedBosses: string[], defeatedMadBosses: string[]): Boss | null {
  return BOSSES.find(b => defeatedBosses.includes(b.id) && !defeatedMadBosses.includes(b.id)) ?? null;
}

// `guard`/`regenPct` NIE są dziedziczone (2026-08-15, znalezione symulacją) — kilku bossów
// kampanii (np. sugar, wizard) ma wrodzone `guard: true` (Twoje ciosy ×0.5), co w połączeniu
// z guard boss'a już wliczonym w JEGO WŁASNE, oryginalne hp/hits, ale NIE w mój współdzielony
// `madHitsFor` (ten sam dla całego rosteru) — MAD Wizard z odziedziczonym guard efektywnie
// potrzebował 2× ciosów względem reszty roster'u, co zawyżało skumulowany kontratak poza
// bezpieczny zakres (0% win-rate w symulacji od lvl 100 wzwyż). "Oszalały" to nowy, osobno
// wyważony tryb — nie musi kopiować każdej mechaniki oryginału, żeby czuć się jak ten sam
// boss (art+nazwa+weakness wystarczą).
export function madBossFor(boss: Boss, level: number): Boss {
  return {
    ...boss,
    id: madBossId(boss.id),
    name: `${boss.name} (Oszalały)`,
    hp: madBossHpFor(level, boss.order),
    coins: Math.round(boss.coins * MAD_REWARD_MULT),
    xp: Math.round(boss.xp * MAD_REWARD_MULT),
    unlockLevel: MAD_UNLOCK_LEVEL,
    guard: undefined,
    regenPct: undefined,
  };
}
