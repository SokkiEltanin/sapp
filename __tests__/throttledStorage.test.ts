import AsyncStorage from '@react-native-async-storage/async-storage';
import { throttledAsyncStorage, flushThrottledStorage } from '@/utils/throttledStorage';

// 2026-08-25 (perf pass, "zapisz wszystko i wszystko rob"): zustand `persist` writes to
// AsyncStorage on EVERY state change — throttled now so rapid writes to the SAME key coalesce
// into one real disk write. These tests pin the coalescing/flush contract since it's easy to
// get subtly wrong (losing a write entirely, or writing stale data instead of the latest).

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useFakeTimers();
});

afterEach(async () => {
  // drain anything still pending in the module-level map so tests don't leak into each other
  await flushThrottledStorage();
  jest.useRealTimers();
});

describe('throttledAsyncStorage — koalescencja zapisów do TEGO SAMEGO klucza', () => {
  test('kilka szybkich setItem przed upływem opóźnienia → jeden realny zapis, z OSTATNIĄ wartością', async () => {
    const storage = throttledAsyncStorage(600);
    await storage.setItem('k1', 'a');
    await storage.setItem('k1', 'b');
    await storage.setItem('k1', 'c');
    // przed upływem opóźnienia nic jeszcze nie trafiło na "dysk"
    expect(await AsyncStorage.getItem('k1')).toBeNull();

    await jest.advanceTimersByTimeAsync(600);
    expect(await AsyncStorage.getItem('k1')).toBe('c');
  });

  test('zapis DOPIERO po upływie opóźnienia od poprzedniego → osobny, kolejny zapis (nie zjada się)', async () => {
    const storage = throttledAsyncStorage(600);
    await storage.setItem('k2', 'first');
    await jest.advanceTimersByTimeAsync(600);
    expect(await AsyncStorage.getItem('k2')).toBe('first');

    await storage.setItem('k2', 'second');
    await jest.advanceTimersByTimeAsync(600);
    expect(await AsyncStorage.getItem('k2')).toBe('second');
  });

  test('różne klucze throttlują NIEZALEŻNIE od siebie', async () => {
    const storage = throttledAsyncStorage(600);
    await storage.setItem('a', '1');
    await jest.advanceTimersByTimeAsync(300);
    await storage.setItem('b', '2'); // nowy timer dla 'b', 'a' już w połowie swojego

    await jest.advanceTimersByTimeAsync(300); // 'a' powinno się zapisać teraz (600 od startu)
    expect(await AsyncStorage.getItem('a')).toBe('1');
    expect(await AsyncStorage.getItem('b')).toBeNull(); // 'b' ma jeszcze 300ms

    await jest.advanceTimersByTimeAsync(300);
    expect(await AsyncStorage.getItem('b')).toBe('2');
  });
});

describe('throttledAsyncStorage — getItem/removeItem', () => {
  test('getItem czyta bezpośrednio z realnego storage (bez throttlingu odczytu)', async () => {
    const storage = throttledAsyncStorage(600);
    await AsyncStorage.setItem('direct', 'x');
    expect(await storage.getItem('direct')).toBe('x');
  });

  test('removeItem anuluje oczekujący throttlowany zapis dla tego klucza', async () => {
    const storage = throttledAsyncStorage(600);
    await storage.setItem('gone', 'pending-value');
    await storage.removeItem('gone');
    await jest.advanceTimersByTimeAsync(600);
    // gdyby removeItem NIE anulował timera, "pending-value" wylądowałoby na dysku mimo removeItem
    expect(await AsyncStorage.getItem('gone')).toBeNull();
  });
});

describe('flushThrottledStorage — wymusza natychmiastowy zapis wszystkich oczekujących', () => {
  test('po flush wartość jest na dysku BEZ czekania na timer', async () => {
    const storage = throttledAsyncStorage(600);
    await storage.setItem('flush-me', 'now');
    expect(await AsyncStorage.getItem('flush-me')).toBeNull(); // jeszcze nie, timer nie minął
    await flushThrottledStorage();
    expect(await AsyncStorage.getItem('flush-me')).toBe('now');
  });

  test('flush opróżnia WSZYSTKIE oczekujące klucze naraz', async () => {
    const storage = throttledAsyncStorage(600);
    await storage.setItem('m1', 'v1');
    await storage.setItem('m2', 'v2');
    await flushThrottledStorage();
    expect(await AsyncStorage.getItem('m1')).toBe('v1');
    expect(await AsyncStorage.getItem('m2')).toBe('v2');
  });

  test('flush bez żadnych oczekujących zapisów jest no-opem (nie rzuca)', async () => {
    await expect(flushThrottledStorage()).resolves.toBeUndefined();
  });
});
