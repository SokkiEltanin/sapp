import { MiniBoss, MINIBOSSES } from '@/utils/minibosses';

// Misja pupila (2026-08-15) — user: "będzie można wysłać pupila na misję... idzie np 5h, i
// wtedy za to jak dojdzie można zawalczyć i zdobywa się trochę więcej xp i coinow jak za
// daily questa". Doprecyzowane (2 pytania): można wysyłać w kółko, BEZ dziennego limitu —
// jedyny hamulec to czas trwania samej misji ("niech zacznie się od 10 min a im większy lvl
// pupila tym dłużej i więcej xp i coinow z pokonania"). Naturalny balans bez sztucznego capu:
// wysoki poziom = rzadsze wysyłki (długi czas), ale każda daje proporcjonalnie więcej.
//
// SKRÓCONE + PRZELICZONE NA WPROST-LINIOWĄ NAGRODĘ (2026-08-21, user: "misje wyprawy sa
// absurdalnie długie i dają mało... co level zmieniaj dodając +1minuta, +1coin, +1xp") — przy
// starym MISSION_MIN_PER_LEVEL=6 misja na Lv67 trwała 406 min (6h46m), a nagroda rosła przez
// questRewardMult (ta sama krzywa co zwykłe questy, ~+0.045×poziom na mnożniku) — czyli
// WOLNIEJ niż rosło samo czekanie, więc wartość-za-minutę-czekania malała właśnie w
// środkowej fazie gry (Lv30-150) zanim znów zaczynała rosnąć bliżej sufitu 480 min. Teraz
// WSZYSTKIE TRZY (minuty/monety/XP) rosną DOKŁADNIE +1 za każdy poziom — te same jednostki,
// zablokowane w parze, więc czas i nagroda rosną zawsze RÓWNO, żadnego zapadania się w
// środku. Lv67: 406min→76min (1h16m), 16 monet/40 XP→70 monet/76 XP.
export const MISSION_BASE_MIN = 10;      // lvl 1 — krótka, częsta pętla na start
export const MISSION_MIN_PER_LEVEL = 1;  // było 6 — misje rosły absurdalnie długo
export const MISSION_MAX_MIN = 480;      // 8h twardy sufit — teraz osiągany dopiero ~Lv470

export function missionMinutesFor(level: number): number {
  return Math.min(MISSION_MAX_MIN, MISSION_BASE_MIN + Math.max(0, level - 1) * MISSION_MIN_PER_LEVEL);
}

// Format "Xh Ymin"/"Ymin" — wspólne dla ekranu Pupila (pasek w trakcie misji) i ekranu walki
// (popup "pupil w trakcie podróży", 2026-08-20) — jedno źródło prawdy zamiast dwóch kopii tej
// samej funkcji w app/pet.tsx i app/boss-fight.tsx.
export function fmtMissionDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60), m = total % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

// Precyzyjny licznik M:SS (lub H:MM:SS) — dla żywego countdownu na pasku misji
// (2026-08-26, user: "zamiast niego w pasku będzie dokładny czas w minutach i sekundach").
// `fmtMissionDuration` wyżej celowo zaokrągla do minut (dobre dla statycznych statów), ale nie
// nadaje się do licznika, który ma faktycznie tykać co sekundę.
export function fmtMissionCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Nagroda BAZOWA wyraźnie wyższa niż typowy daily quest (2-6 monet/5-15 xp) — user: "trochę
// więcej xp i coinow jak za daily questa".
//
// PRZEPISANE Z questRewardMult NA WPROST-LINIOWY WZROST (2026-08-21) — patrz komentarz nad
// MISSION_MIN_PER_LEVEL wyżej. `questRewardMult` (reszta questów) rośnie ~+0.045×poziom na
// MNOŻNIKU, czyli w praktyce ułamek moneta/XP za poziom — dużo wolniej niż same minuty
// (dawniej +6/poziom, teraz +1/poziom). Misja dostaje TERAZ WŁASNY, prostszy wzór: +1 moneta
// i +1 XP za KAŻDY poziom, dokładnie w parze z +1 minutą wyżej — nagroda i czas oczekiwania
// rosną tym samym tempem, więc "opłacalność za minutę" nigdy nie maleje w środku gry.
const MISSION_BASE_COINS = 4;
const MISSION_BASE_XP = 10;
const MISSION_COIN_PER_LEVEL = 1;
const MISSION_XP_PER_LEVEL = 1;

// Wybór profilu misji (2026-08-18, user: "trzeba zrobić że mam jak w sfgame że mogę wybrać
// misję czy pod złoto czy pod XP że jedna ma trochę więcej gold a druga XP i mogą być 3 do
// wyboru") — S&F-style trade-off: TA SAMA długość (`missionMinutesFor` bez zmian, user nie
// prosił o różny czas), tylko przesunięcie coins↔xp. Świadomie NIE jeden profil strictly
// lepszy od innych — `balanced` to dokładnie stare wartości (nikt kto już wysyłał misje nie
// dostaje nagle gorszej nagrody przy domyślnym wyborze), `gold`/`xp` to ten sam SUMARYCZNY
// "budżet" przesunięty w jedną stronę (+50% jednego, -40% drugiego — nie ±50/±50, żeby suma
// nie była identyczna co ułatwiłoby uznanie wyboru za czysto kosmetyczny).
export type MissionProfile = 'balanced' | 'gold' | 'xp';
const MISSION_PROFILE_MULT: Record<MissionProfile, { coins: number; xp: number }> = {
  balanced: { coins: 1, xp: 1 },
  gold: { coins: 1.5, xp: 0.6 },
  xp: { coins: 0.6, xp: 1.5 },
};
export function missionRewardFor(level: number, profile: MissionProfile = 'balanced'): { coins: number; xp: number } {
  const lvlBonus = Math.max(0, level - 1);
  const pm = MISSION_PROFILE_MULT[profile];
  return {
    coins: Math.round((MISSION_BASE_COINS + lvlBonus * MISSION_COIN_PER_LEVEL) * pm.coins),
    xp: Math.round((MISSION_BASE_XP + lvlBonus * MISSION_XP_PER_LEVEL) * pm.xp),
  };
}

// Etykieta + kolejność wyświetlania (ekran Pupila renderuje 3 wybieralne wiersze w tej
// kolejności) — jedno źródło prawdy, żeby ekran nie zgadywał kolejności/nazw osobno.
export const MISSION_PROFILE_ORDER: MissionProfile[] = ['balanced', 'gold', 'xp'];
export const MISSION_PROFILE_LABEL: Record<MissionProfile, string> = {
  balanced: 'Zbalansowana',
  gold: 'Więcej złota',
  xp: 'Więcej XP',
};

function hashOf(s: string, mul: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * mul + s.charCodeAt(i)) >>> 0;
  return h;
}

// Seedowane DOKŁADNYM znacznikiem czasu wysłania (nie datą jak minibossForQuest) — misje mogą
// lecieć kilka razy dziennie, data dałaby tego samego zwierzaka za każdym razem tego dnia.
export function minibossForMission(startedAtIso: string): MiniBoss {
  return MINIBOSSES[hashOf(startedAtIso, 37) % MINIBOSSES.length];
}
