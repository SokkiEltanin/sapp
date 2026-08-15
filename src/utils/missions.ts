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

// Nagroda BAZOWA wyraźnie wyższa niż typowy daily quest (2-6 monet/5-15 xp) — user: "trochę
// więcej xp i coinow jak za daily questa". Skaluje się z levelem TYM SAMYM mnożnikiem co
// reszta questów (`questRewardMult` z quests.ts) — jedno źródło prawdy dla całej ekonomii,
// nie osobno zgadywana krzywa.
const MISSION_BASE_COINS = 4;
const MISSION_BASE_XP = 10;
export function missionRewardFor(level: number): { coins: number; xp: number } {
  const mult = questRewardMult(level);
  return { coins: Math.round(MISSION_BASE_COINS * mult), xp: Math.round(MISSION_BASE_XP * mult) };
}

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
