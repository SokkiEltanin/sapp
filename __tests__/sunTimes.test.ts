import AsyncStorage from '@react-native-async-storage/async-storage';
import { isoToDecimalHour, setSunTimes, getSunTimes, hydrateSunTimes } from '@/utils/sunTimes';

describe('sunTimes — isoToDecimalHour (parsowanie godziny na ułamek dziesiętny)', () => {
  test('pełny ISO z T i czas sam w sobie dają ten sam wynik', () => {
    expect(isoToDecimalHour('2026-06-01T04:51')).toBeCloseTo(4.85);
    expect(isoToDecimalHour('04:51')).toBeCloseTo(4.85);
  });
  test('sekundy (jeśli obecne) są ignorowane, nie psują parsowania', () => {
    expect(isoToDecimalHour('04:51:30')).toBeCloseTo(4.85);
  });
  test('północ → 0', () => {
    expect(isoToDecimalHour('00:00')).toBe(0);
  });
  test('śmieciowy/pusty input → 0, nie NaN (nie wywala reszty obliczeń)', () => {
    expect(isoToDecimalHour('')).toBe(0);
  });
});

describe('sunTimes — setSunTimes / getSunTimes (cache modułu, persystencja)', () => {
  test('round-trip: co ustawione, to odczytane', async () => {
    await setSunTimes(5.5, 20.25);
    expect(getSunTimes()).toEqual({ sunrise: 5.5, sunset: 20.25 });
  });

  test('nieskończone/NaN wartości odrzucone — cache zostaje przy poprzedniej wartości', async () => {
    await setSunTimes(6, 21);
    await setSunTimes(NaN, 21);
    await setSunTimes(6, Infinity);
    expect(getSunTimes()).toEqual({ sunrise: 6, sunset: 21 });
  });

  test('hydrateSunTimes wczytuje z AsyncStorage i aktualizuje cache', async () => {
    await AsyncStorage.setItem('sun_times_v1', JSON.stringify({ sunrise: 4.5, sunset: 22.5 }));
    await hydrateSunTimes();
    expect(getSunTimes()).toEqual({ sunrise: 4.5, sunset: 22.5 });
  });
});
