import { Boss, BOSSES } from '@/utils/bosses';

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
// bo `counterDamage()` liczy % od `boss.hp` wprost (bosses.ts, od 2026-08-20 zawsze STAŁY
// procent maksimum, nie malejący — patrz komentarz przy COUNTER_PCT), a hp bossa rośnie z
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

// PRZEBUDOWANE NAGRODY (2026-08-22) — user po zobaczeniu logu walk: "mad bossy mają być
// nagrody z nich kontynuacja jak po ostatnim busie kampanii". Stary `MAD_REWARD_MULT` (×3 na
// WŁASNĄ, oryginalną nagrodę bazowego bossa) dawał absurdalnie mało dla wczesnych bossów
// kampanii — np. MAD Cukrowy Potwór (boss #2, coins:12/xp:100 bazowo) dawał tylko 36 monet/
// 300 XP, mimo że PO przebudowie na stałe hp×10 + counterMult×3 wyżej jest teraz trudniejszy
// niż nawet finałowy boss kampanii. Zapytany wprost (AskUserQuestion) o dokładny kształt
// wzrostu — dosłowna kontynuacja krzywej kampanii (~1.48× na krok, ekstrapolowana z 22
// istniejących wartości `coins`) dałaby przy MAD order 22 ~88 MILIONÓW monet za jedną walkę,
// user wybrał zamiast tego "start od końca kampanii, łagodny wzrost": KAŻDY MAD boss startuje
// od nagrody OSTATNIEGO bossa kampanii (`BOSSES` posortowane po `order`, ostatni = Iluzja
// Kontroli, floor niezależny od tego jak mało dawał WŁASNY bazowy boss), rosnąc liniowo +15%
// tej bazy za każdy krok WŁASNEGO order MAD-a (order1 = dokładnie finał kampanii, order22 =
// ~4.15× tego — wyraźnie więcej niż finał, ale bez wykładniczej eksplozji).
const MAD_REWARD_GROWTH_PER_ORDER = 0.15;
function madRewardMultFor(order: number): number {
  return 1 + Math.max(0, order - 1) * MAD_REWARD_GROWTH_PER_ORDER;
}

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
// PRZEBUDOWANE Z DYNAMICZNEGO NA STAŁE, "POJEBANE" HP (2026-08-21) — user po zrozumieniu że
// powyższy model (hp z AKTUALNEJ mocy gracza) oznacza "im wyższy level, tym większe hp MAD
// bossa": "Czekaj, ty zrobiles ze im większy level tym większe HP mad bossów?????" →
// wyjaśnione że to ZAWSZE tak działało (od 2026-08-15, patrz komentarz wyżej, nietknięte w
// dzisiejszej rekalibracji trudności kampanii) — user świadomie zdecydował się to ODWRÓCIĆ:
// "nie chce stałe ale pojebanae wartości tak zeby mad bossy byly 10x silniejsze od
// kampanijnych odzwierciedleń ale stałe, i z większym o wiele atakiem". Zamiast liczyć hp z
// `atkPower(level)` (rosło z KAŻDYM levelem gracza, nigdy nie "zamrożone"), MAD hp jest teraz
// WPROST 10× hp odpowiadającego bossa kampanii z `BOSSES` (te same, już rekalibrowane
// hp×√2/√3 wartości z dzisiejszej sesji) — STAŁE, nie zależy od poziomu/statów gracza w
// momencie walki, dokładnie jak zwykli bossowie kampanii (zamrożone raz, nie przeliczane).
// DODATKOWO kontratak MAD dostaje własny mnożnik `counterMult` (bosses.ts, nowe pole na
// `Boss`) PONAD to co już naturalnie wynika z 10× hp — user chciał "z większym o wiele
// atakiem" jako OSOBNY lever, nie tylko efekt uboczny większego hp. Świadomie EKSTREMALNE —
// user explicite poprosił o "pojebane" wartości, to celowy superboss/prestiżowy tor, nie
// coś kalibrowane pod normalną wygrywalność jak reszta trybów walki w tej sesji.
export const MAD_HP_MULT = 10;      // MAD hp = boss.hp (kampania) × 10, STAŁE
export const MAD_COUNTER_MULT = 3;  // dodatkowy mnożnik kontrataku PONAD naturalny wzrost z 10× hp

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
export function madBossFor(boss: Boss): Boss {
  const finale = BOSSES[BOSSES.length - 1];
  const mult = madRewardMultFor(boss.order);
  return {
    ...boss,
    id: madBossId(boss.id),
    name: `${boss.name} (Oszalały)`,
    hp: boss.hp * MAD_HP_MULT,
    counterMult: MAD_COUNTER_MULT,
    coins: Math.round(finale.coins * mult),
    xp: Math.round(finale.xp * mult),
    unlockLevel: MAD_UNLOCK_LEVEL,
    guard: undefined,
    regenPct: undefined,
  };
}
