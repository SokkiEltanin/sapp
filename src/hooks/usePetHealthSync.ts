import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { getHealthHistory } from '@/utils/healthHistory';
import { getHealthGoals } from '@/utils/healthGoals';
import { getBudgets } from '@/utils/budgets';
import { getWaterGlasses } from '@/utils/habits';
import { weekKeyOf } from '@/utils/quests';

const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => ymdOf(new Date());

export interface PetHealth {
  steps: number; sleep: number; bestStepDay: number; stepTarget: number;
  stepsThisMonth: number; stepsThisWeek: number; cyclingMinutesToday: number;
}

export interface RecentDay { date: string; steps: number; sleep: number; water: number }

// Ile dni wstecz (nie licząc dziś) sprawdzamy pod kątem zaległych questów dziennych
// (2026-08-27, user: "problem z odbiorem questów nieodebranych z dnia wcześniejszego") —
// dawniej TYLKO wczoraj (`yData` = jeden dzień), więc przerwa dłuższa niż doba w otwieraniu
// apki bezpowrotnie gubiła nagrody za dni starsze niż wczoraj. 6 dni = tydzień razem z
// dzisiaj, rozsądny bufor bez nieograniczonego wstecznego przeliczania.
const RECENT_DAYS_BACK = 6;

// Wyciągnięte z app/pet.tsx (2026-08-19, restrukturyzacja nawigacji — questy dostały
// własną zakładkę `/pet-quests`, ale ICH questCtx potrzebuje DOKŁADNIE tych samych
// health/water/budget danych co status kotka na `/pet`). Zamiast duplikować całą tę
// (delikatną, z 3 udokumentowanymi fixami odświeżania) logikę w dwóch plikach, każdy
// ekran woła ten sam hook niezależnie — lekko podwaja odczyt przy przełączaniu zakładek,
// ale to nic w porównaniu z ryzykiem rozjazdu dwóch kopii tego samego kodu.
export function usePetHealthSync() {
  const [health, setHealth] = useState<PetHealth>({ steps: 0, sleep: 0, bestStepDay: 0, stepTarget: 0, stepsThisMonth: 0, stepsThisWeek: 0, cyclingMinutesToday: 0 });
  const [stepGoal, setStepGoal] = useState(10000);
  const [waterGoal, setWaterGoal] = useState(8);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [waterToday, setWaterToday] = useState(0);
  // Ostatnich `RECENT_DAYS_BACK` dni (nie licząc dziś), żeby nagrody wypracowane w dni gdy
  // apka nie była otwarta dało się odebrać z opóźnieniem (patrz `missed` w usePetQuests.ts).
  const [recentDays, setRecentDays] = useState<RecentDay[]>([]);
  const [cardsCollected, setCardsCollected] = useState(0);

  const readHealth = useCallback(() => {
    const t = todayISO();
    const month = t.slice(0, 7);
    getHealthHistory(200).then(h => {
      const steps = h[t]?.steps ?? 0;
      // TODAY's sleep only — patrz komentarz historyczny w pet.tsx: fallback na poprzedni
      // dzień myląco zaliczał sen sprzed dwóch nocy do dzisiejszego questu.
      const sleep = h[t]?.sleepMinutes ?? 0;
      const bestStepDay = Object.values(h).reduce((m, d) => Math.max(m, d.steps ?? 0), 0);
      const stepsThisMonth = Object.entries(h).filter(([d]) => d.startsWith(month)).reduce((m, [, v]) => m + (v.steps ?? 0), 0);
      const wk = weekKeyOf();
      const stepsThisWeek = Object.entries(h).filter(([d]) => d >= wk).reduce((m, [, v]) => m + (v.steps ?? 0), 0);
      const recent = Object.values(h).map(d => d.steps).filter(x => x > 0).slice(0, 14);
      const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      const stepTarget = avg > 0 ? Math.max(8000, Math.ceil(avg * 1.1 / 500) * 500) : 0;
      const cyclingMinutesToday = h[t]?.cyclingMinutes ?? 0;
      setHealth({ steps, sleep, bestStepDay, stepTarget, stepsThisMonth, stepsThisWeek, cyclingMinutesToday });
      const days: string[] = [];
      for (let i = 1; i <= RECENT_DAYS_BACK; i++) {
        const d = new Date(); d.setDate(d.getDate() - i); days.push(ymdOf(d));
      }
      Promise.all(days.map(d => getWaterGlasses(d).catch(() => 0)))
        .then(waters => setRecentDays(days.map((d, i) => ({ date: d, steps: h[d]?.steps ?? 0, sleep: h[d]?.sleepMinutes ?? 0, water: waters[i] }))))
        .catch(() => {});
    }).catch(() => {});
    getHealthGoals().then(g => { setStepGoal(g.stepGoal || 10000); setWaterGoal(g.waterGoal || 8); }).catch(() => {});
    getBudgets().then(b => setBudgets(b as Record<string, number>)).catch(() => {});
    getWaterGlasses(t).then(g => setWaterToday(g)).catch(() => {});
    AsyncStorage.getItem('skin_progress').then(raw => { if (raw) setCardsCollected(JSON.parse(raw).cards ?? 0); }).catch(() => {});
  }, []);

  const reload = useCallback(() => {
    readHealth(); // show cache immediately…
    import('@/services/healthAutoSync')
      .then(({ autoSyncHealth }) => autoSyncHealth(7, true))
      .then(() => readHealth())
      .catch(() => {});
  }, [readHealth]);

  useFocusEffect(reload);
  // useFocusEffect ŁAPIE TYLKO nawigację — NIE łapie powrotu z tła gdy ekran był już
  // aktywny kiedy telefon zasnął. Patrz historyczny komentarz w pet.tsx (2026-08-12).
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') reload(); });
    return () => sub.remove();
  }, [reload]);
  // Trzecia dziura: północ mijająca podczas gdy ekran stał cały czas aktywny (telefon na
  // ładowarce). Patrz historyczny komentarz w pet.tsx (2026-08-15).
  const lastReloadDay = useRef(todayISO());
  useEffect(() => {
    const iv = setInterval(() => {
      const t = todayISO();
      if (t !== lastReloadDay.current) { lastReloadDay.current = t; reload(); }
    }, 60000);
    return () => clearInterval(iv);
  }, [reload]);

  return { health, stepGoal, waterGoal, budgets, waterToday, recentDays, cardsCollected, reload };
}
