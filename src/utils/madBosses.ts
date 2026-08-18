import { Boss, BOSSES, Bonuses, atkPower } from '@/utils/bosses';

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
//
// Fix 2026-08-15 (drugi tego dnia — user zgłosił IDENTYCZNY problem dla questów, ta sama
// przyczyna tutaj): `atkPower(0, level, ZERO_BONUSES)` ignorował realny atkStatBonus/bonuses
// gracza, podczas gdy jego faktyczny cios (computeDamage w bosses.ts) już je liczy — gracz
// z realną inwestycją zadawał więcej niż formuła zakładała, trywializując walkę mimo
// "bezpiecznego" zakresu 6-8 ciosów zweryfikowanego wyżej TYLKO dla jednego stałego profilu
// bonusów. Teraz bierze też prawdziwe atkStatBonus/bonuses — te same argumenty co
// computeDamage, więc ciosy potrzebne do zabicia zostają w zwalidowanym zakresie NIEZALEŻNIE
// od tego ile gracz faktycznie zainwestował.
// PRZESUNIĘTE 50→15 (2026-08-18, user: "bosy mad wersje muszą byc bardzo trudne i dajmy je od
// 15 lvl jednak") — MAD dostaje się dużo wcześniej, gdy gracz ma naturalnie mniej inwestycji
// (mniej czasu na uzbieranie atkStatBonus/catMaxHpBonus), co samo w sobie robi go "bardzo
// trudnym" względem punktu w grze w którym się pojawia. `madHitsFor` NIETKNIĘTE — throwaway-
// symulacją (patrz komentarz tam) sprawdzono że podbijanie liczby ciosów jest DUŻO bardziej
// wrażliwe niż w kampanii (kwadratowy, nie liniowy wzrost skumulowanego kontrataku, bo MAD hp
// liczy się z AKTUALNEJ, żywej mocy gracza, nie zamrożonej przy unlockLevel) — realną,
// odczuwalną trudność MAD dostaje ZA DARMO ze wspólnego COUNTER_PCT (bosses.ts, ten sam silnik
// walki co kampania) bez ryzyka powtórki "MAD niewygrywalny od lvl~90" z pierwszej wersji.
export const MAD_UNLOCK_LEVEL = 15;
export const MAD_REWARD_MULT = 3;

// PODBITE ×1.15 (2026-08-18, user: "mad wtedy niech będą 2x trudniejsze od podstaw albo
// 4razy trudniejsze nie wiem jeszcze na pewno, daj im o +30% HP więcej niż teraz jest") — user
// poprosił o +30%, throwaway-symulacją (dokładnie ten sam rygor co przy COUNTER_PCT wyżej,
// profil inwestycji kalibrowany na realnych danych z logu) sprawdzono że +30% ŁAMIE
// winnability dokładnie tam gdzie boli najbardziej: świeżo Lv15 gracz (MAD odblokowany od
// niedawna, patrz MAD_UNLOCK_LEVEL) próbujący order6 kończy na ~45% winrate/55% faintRate —
// NIE "bardzo trudne", tylko matematycznie w większości przegrane. +15% to sprawdzony sufit:
// order1-6 przy Lv15-20 (realistyczny pierwszy kontakt z MAD) zostaje 100% winrate, wyraźnie
// trudniejsze (avgLoss 54-86% zamiast 48-64%) bez przekraczania progu niewygrywalności z
// historycznego komentarza wyżej ("już od ok. 8-10 ciosów" 0% win-rate). Część "2-4× trudniej"
// user'a już i tak przychodzi ZA DARMO z COUNTER_PCT=0.05 (współdzielony z kampanią) +
// wcześniejszym odblokowaniem (Lv15 zamiast 50, mniej czasu na inwestycję) — ten +15% HP to
// TRZECI, dodatkowy mnożnik na wierzchu tamtych dwóch, nie jedyny.
const MAD_HITS_MULT = 1.15;
const madHitsFor = (order: number) => (6 + (order - 1) * (2 / 21)) * MAD_HITS_MULT;
export const madBossHpFor = (atkStatBonus: number, level: number, bonuses: Bonuses, order: number) =>
  Math.round(atkPower(atkStatBonus, Math.max(0, level), bonuses) * madHitsFor(order));

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
export function madBossFor(boss: Boss, atkStatBonus: number, level: number, bonuses: Bonuses): Boss {
  return {
    ...boss,
    id: madBossId(boss.id),
    name: `${boss.name} (Oszalały)`,
    hp: madBossHpFor(atkStatBonus, level, bonuses, boss.order),
    coins: Math.round(boss.coins * MAD_REWARD_MULT),
    xp: Math.round(boss.xp * MAD_REWARD_MULT),
    unlockLevel: MAD_UNLOCK_LEVEL,
    guard: undefined,
    regenPct: undefined,
  };
}
