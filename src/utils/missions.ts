import { MiniBoss, MINIBOSSES } from '@/utils/minibosses';
import { questRewardMult } from '@/utils/quests';

// Misja pupila (2026-08-15) — user: "będzie można wysłać pupila na misję... idzie np 5h, i
// wtedy za to jak dojdzie można zawalczyć i zdobywa się trochę więcej xp i coinow jak za
// daily questa". Doprecyzowane (2 pytania): można wysyłać w kółko, BEZ dziennego limitu —
// jedyny hamulec to czas trwania samej misji ("niech zacznie się od 10 min a im większy lvl
// pupila tym dłużej i więcej xp i coinow z pokonania"). Naturalny balans bez sztucznego capu:
// wysoki poziom = rzadsze wysyłki (długi czas), ale każda daje proporcjonalnie więcej.
export const MISSION_BASE_MIN = 10;      // lvl 1 — krótka, częsta pętla na start
export const MISSION_MIN_PER_LEVEL = 6;  // liniowy wzrost — trafia user's own przykład (5h=300min) ok. lvl 50
export const MISSION_MAX_MIN = 480;      // 8h twardy sufit — inaczej przy bardzo wysokim levelu misja trwałaby dniami

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

// Nagroda BAZOWA wyraźnie wyższa niż typowy daily quest (2-6 monet/5-15 xp) — user: "trochę
// więcej xp i coinow jak za daily questa". Skaluje się z levelem TYM SAMYM mnożnikiem co
// reszta questów (`questRewardMult` z quests.ts) — jedno źródło prawdy dla całej ekonomii,
// nie osobno zgadywana krzywa.
const MISSION_BASE_COINS = 4;
const MISSION_BASE_XP = 10;

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
  const mult = questRewardMult(level);
  const pm = MISSION_PROFILE_MULT[profile];
  return { coins: Math.round(MISSION_BASE_COINS * mult * pm.coins), xp: Math.round(MISSION_BASE_XP * mult * pm.xp) };
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
