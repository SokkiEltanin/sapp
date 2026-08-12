import AsyncStorage from '@react-native-async-storage/async-storage';
import { activeFromSteps, dailyBurnFromHc, getHealthHistory, saveTodayWeight } from '@/utils/healthHistory';

beforeEach(async () => { await AsyncStorage.clear(); });

describe('healthHistory — activeFromSteps (ruch szacowany z kroków, wagą skalowany)', () => {
  test('10000 kroków @70kg → 350 kcal', () => {
    expect(activeFromSteps(10000, 70)).toBe(350);
  });
  test('0 kroków → 0', () => {
    expect(activeFromSteps(0, 70)).toBe(0);
  });
  test('brak wagi (0 lub ujemna) → pada na domyślne 70kg', () => {
    expect(activeFromSteps(10000, 0)).toBe(activeFromSteps(10000, 70));
  });
});

describe('healthHistory — dailyBurnFromHc (całodniowe spalanie)', () => {
  test('brak danych z zegarka, brak BMR → samo oszacowanie z kroków', () => {
    expect(dailyBurnFromHc(null, 0, 10000, 70, 0.45)).toBe(350);
  });
  test('brak danych z zegarka, jest BMR → BMR + max(kroki, podłoga aktywności)', () => {
    // podłoga(1600×0.45=720) > kroki(350) → wygrywa podłoga
    expect(dailyBurnFromHc(null, 1600, 10000, 70, 0.45)).toBe(2320);
  });

  test('total z zegarka WIARYGODNY (pełny dzień i wyższy niż szacunek) → ufamy totalowi', () => {
    expect(dailyBurnFromHc({ totalCalories: 2500, bmr: 1600, activeCalories: 400 }, 0, 10000, 70, 0.45)).toBe(2500);
  });

  test('total z zegarka NIŻSZY niż BMR (znany błąd Samsunga) → odrzucony, liczy z BMR+ruch mimo że total>=1200', () => {
    const result = dailyBurnFromHc({ totalCalories: 1252, bmr: 1670, activeCalories: 200 }, 0, 5000, 70, 0.45);
    expect(result).toBe(2422); // nie 1252
    expect(result).toBeGreaterThan(1252);
  });

  test('total < 1200 (ewidentnie niepełny dzień) → zawsze odrzucony, nawet gdyby był > est', () => {
    // est tutaj = max(active, stepsActive) bo brak bmr = 200 (bo steps=0<active=200)
    const result = dailyBurnFromHc({ totalCalories: 800, activeCalories: 200 }, 0, 0, 70, 0.45);
    expect(result).toBe(200);
  });

  test('ruch = MAX(zmierzony, z kroków, podłoga) — zmierzony wygrywa gdy jest największy', () => {
    // active=2000 (zdecydowanie największy z trójki) → est = bmr + active
    const result = dailyBurnFromHc({ bmr: 1600, activeCalories: 2000 }, 0, 100, 70, 0.45);
    expect(result).toBe(3600);
  });
});

describe('healthHistory — getHealthHistory (odczyt wielu dni jednym multiGet)', () => {
  const dayKey = (d: Date) => `health_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  test('dzień bez zapisanych danych w ogóle NIE pojawia się w wyniku', async () => {
    const hist = await getHealthHistory(3);
    expect(Object.keys(hist).length).toBe(0);
  });

  test('realne dane dnia (sen/kroki/waga) odczytane poprawnie', async () => {
    const today = new Date();
    await AsyncStorage.setItem(dayKey(today), JSON.stringify({ sleepH: 7, sleepM: 15, sleepQuality: 'good', steps: 8000, weight: 75 }));
    const hist = await getHealthHistory(1);
    const key = Object.keys(hist)[0];
    expect(hist[key].sleepMinutes).toBe(7 * 60 + 15);
    expect(hist[key].steps).toBe(8000);
    expect(hist[key].weight).toBe(75);
  });

  test('legacy fałszywy domyślny sen (7h30m BEZ jakości) traktowany jako BRAK danych, nie realny sen', async () => {
    const today = new Date();
    await AsyncStorage.setItem(dayKey(today), JSON.stringify({ sleepH: 7, sleepM: 30, steps: 5000 })); // brak sleepQuality
    const hist = await getHealthHistory(1);
    const key = Object.keys(hist)[0];
    expect(hist[key].sleepMinutes).toBe(0);
  });

  test('7h30m z realną jakością (nie legacy fałszywka) liczy się normalnie', async () => {
    const today = new Date();
    await AsyncStorage.setItem(dayKey(today), JSON.stringify({ sleepH: 7, sleepM: 30, sleepQuality: 'excellent', steps: 5000 }));
    const hist = await getHealthHistory(1);
    const key = Object.keys(hist)[0];
    expect(hist[key].sleepMinutes).toBe(450);
  });

  test('domyślna waga (defaultWeightKg) zasila TYLKO wyliczenie spalania, NIE pole weight (zostaje 0 gdy niezalogowane)', async () => {
    const today = new Date();
    await AsyncStorage.setItem(dayKey(today), JSON.stringify({ steps: 10000, hc: { bmr: 1600 } })); // brak weight
    const hist = await getHealthHistory(1, 0, 80); // defaultWeightKg=80
    const key = Object.keys(hist)[0];
    expect(hist[key].weight).toBe(0); // pole weight NIE dostaje fallbacku
    expect(hist[key].burn).toBeGreaterThan(0); // ale spalanie policzone (użyło 80kg wewnętrznie)
  });
});

describe('healthHistory — saveTodayWeight', () => {
  test('zapisuje wagę bez kasowania innych pól dnia (kroki, sen)', async () => {
    const today = new Date();
    const key = `health_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await AsyncStorage.setItem(key, JSON.stringify({ steps: 5000 }));
    await saveTodayWeight(72);
    const raw = await AsyncStorage.getItem(key);
    const obj = JSON.parse(raw!);
    expect(obj.weight).toBe(72);
    expect(obj.steps).toBe(5000); // przetrwało
  });

  test('nierealna waga (<=0) jest ignorowana, nic nie zapisuje', async () => {
    await saveTodayWeight(0);
    await saveTodayWeight(-5);
    const raw = await AsyncStorage.getItem('health_last_weight');
    expect(raw).toBeNull();
  });
});
