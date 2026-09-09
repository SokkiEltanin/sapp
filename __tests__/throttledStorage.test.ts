import AsyncStorage from '@react-native-async-storage/async-storage';
import { throttledPersistStorage, flushThrottledStorage } from '@/utils/throttledStorage';

// 2026-08-25 (perf pass, "zapisz wszystko i wszystko rob"): zustand `persist` writes to
// AsyncStorage on EVERY state change — throttled so rapid writes to the SAME key coalesce
// into one real disk write. These tests pin the coalescing/flush contract since it's easy to
// get subtly wrong (losing a write entirely, or writing stale data instead of the latest).
//
// 2026-09-09 (perf pass, "okiem specjalisty co byś jeszcze zoptymalizował?"): rewritten for
// `throttledPersistStorage` — implements zustand's `PersistStorage<S>` directly (raw
// `{state, version}` objects) instead of being wrapped by `createJSONStorage`, so
// `JSON.stringify` now happens INSIDE the debounced timer below instead of synchronously on
// every `set()`. `getItem` now parses JSON (it used to pass strings straight through), so
// these tests read back real, stringified AsyncStorage contents.

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useFakeTimers();
});

afterEach(async () => {
  // drain anything still pending in the module-level map so tests don't leak into each other
  await flushThrottledStorage();
  jest.useRealTimers();
});

const sv = (n: number) => ({ state: { n }, version: 0 });

describe('throttledPersistStorage — koalescencja zapisów do TEGO SAMEGO klucza', () => {
  test('kilka szybkich setItem przed upływem opóźnienia → jeden realny zapis, z OSTATNIĄ wartością', async () => {
    const storage = throttledPersistStorage(600);
    await storage.setItem('k1', sv(1));
    await storage.setItem('k1', sv(2));
    await storage.setItem('k1', sv(3));
    // przed upływem opóźnienia nic jeszcze nie trafiło na "dysk"
    expect(await AsyncStorage.getItem('k1')).toBeNull();

    await jest.advanceTimersByTimeAsync(600);
    expect(await AsyncStorage.getItem('k1')).toBe(JSON.stringify(sv(3)));
  });

  test('zapis DOPIERO po upływie opóźnienia od poprzedniego → osobny, kolejny zapis (nie zjada się)', async () => {
    const storage = throttledPersistStorage(600);
    await storage.setItem('k2', sv(1));
    await jest.advanceTimersByTimeAsync(600);
    expect(await AsyncStorage.getItem('k2')).toBe(JSON.stringify(sv(1)));

    await storage.setItem('k2', sv(2));
    await jest.advanceTimersByTimeAsync(600);
    expect(await AsyncStorage.getItem('k2')).toBe(JSON.stringify(sv(2)));
  });

  test('różne klucze throttlują NIEZALEŻNIE od siebie', async () => {
    const storage = throttledPersistStorage(600);
    await storage.setItem('a', sv(1));
    await jest.advanceTimersByTimeAsync(300);
    await storage.setItem('b', sv(2)); // nowy timer dla 'b', 'a' już w połowie swojego

    await jest.advanceTimersByTimeAsync(300); // 'a' powinno się zapisać teraz (600 od startu)
    expect(await AsyncStorage.getItem('a')).toBe(JSON.stringify(sv(1)));
    expect(await AsyncStorage.getItem('b')).toBeNull(); // 'b' ma jeszcze 300ms

    await jest.advanceTimersByTimeAsync(300);
    expect(await AsyncStorage.getItem('b')).toBe(JSON.stringify(sv(2)));
  });

  // Realny powód tej zmiany (nie tylko refaktor): dawniej `JSON.stringify` leciał raz PER
  // `setItem`, synchronicznie, ZANIM throttling w ogóle wchodził w grę (`createJSONStorage`
  // stringifyował przed wywołaniem naszego `setItem`). Teraz stringify jest wewnątrz timera —
  // seria szybkich `set()` (np. kilka zmian HP/coinów w jednej rundzie walki bossa) kosztuje
  // JEDEN `JSON.stringify`, nie jeden na każdą zmianę. Nie da się tego zmierzyć w jednostkowym
  // teście bez podglądania wnętrza (nie ma po co szpiegować `JSON.stringify` globalnie), więc
  // to po prostu zachowanie gwarantowane przez „ostatnia wartość wygrywa" testy wyżej.
});

describe('throttledPersistStorage — getItem/removeItem', () => {
  test('getItem parsuje JSON zapisany bezpośrednio w realnym storage (bez throttlingu odczytu)', async () => {
    const storage = throttledPersistStorage(600);
    await AsyncStorage.setItem('direct', JSON.stringify(sv(7)));
    expect(await storage.getItem('direct')).toEqual(sv(7));
  });

  test('getItem dla nieistniejącego klucza → null', async () => {
    const storage = throttledPersistStorage(600);
    expect(await storage.getItem('missing')).toBeNull();
  });

  test('getItem na uszkodzonym JSON → null (nie rzuca)', async () => {
    const storage = throttledPersistStorage(600);
    await AsyncStorage.setItem('corrupt', '{not json');
    expect(await storage.getItem('corrupt')).toBeNull();
  });

  test('removeItem anuluje oczekujący throttlowany zapis dla tego klucza', async () => {
    const storage = throttledPersistStorage(600);
    await storage.setItem('gone', sv(1));
    await storage.removeItem('gone');
    await jest.advanceTimersByTimeAsync(600);
    // gdyby removeItem NIE anulował timera, wartość wylądowałaby na dysku mimo removeItem
    expect(await AsyncStorage.getItem('gone')).toBeNull();
  });
});

describe('flushThrottledStorage — wymusza natychmiastowy zapis wszystkich oczekujących', () => {
  test('po flush wartość jest na dysku BEZ czekania na timer', async () => {
    const storage = throttledPersistStorage(600);
    await storage.setItem('flush-me', sv(1));
    expect(await AsyncStorage.getItem('flush-me')).toBeNull(); // jeszcze nie, timer nie minął
    await flushThrottledStorage();
    expect(await AsyncStorage.getItem('flush-me')).toBe(JSON.stringify(sv(1)));
  });

  test('flush opróżnia WSZYSTKIE oczekujące klucze naraz', async () => {
    const storage = throttledPersistStorage(600);
    await storage.setItem('m1', sv(1));
    await storage.setItem('m2', sv(2));
    await flushThrottledStorage();
    expect(await AsyncStorage.getItem('m1')).toBe(JSON.stringify(sv(1)));
    expect(await AsyncStorage.getItem('m2')).toBe(JSON.stringify(sv(2)));
  });

  test('flush bez żadnych oczekujących zapisów jest no-opem (nie rzuca)', async () => {
    await expect(flushThrottledStorage()).resolves.toBeUndefined();
  });
});
