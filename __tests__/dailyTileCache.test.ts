import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyCached, setDailyCached } from '@/utils/dailyTileCache';

beforeEach(async () => { await AsyncStorage.clear(); });

describe('dailyTileCache — cache raz-na-dzień dla ciężkich, nieistotnych widgetów', () => {
  test('brak wpisu → cache miss (undefined)', async () => {
    expect(await getDailyCached('nope')).toBeUndefined();
  });

  test('zapis dziś → odczyt dziś trafia w cache', async () => {
    await setDailyCached('pixels:t1:2026', { '2026-01-01': 5 });
    expect(await getDailyCached('pixels:t1:2026')).toEqual({ '2026-01-01': 5 });
  });

  test('wpis z WCZORAJ (inna data w zapisanym JSON) → cache miss, nie zwraca stale danych', async () => {
    const stale = { date: '2020-01-01', value: { '2020-01-01': 999 } };
    await AsyncStorage.setItem('daily_tile_cache_v1:pixels:t1:2026', JSON.stringify(stale));
    expect(await getDailyCached('pixels:t1:2026')).toBeUndefined();
  });

  test('różne klucze nie kolidują ze sobą', async () => {
    await setDailyCached('a', { x: 1 });
    await setDailyCached('b', { x: 2 });
    expect(await getDailyCached('a')).toEqual({ x: 1 });
    expect(await getDailyCached('b')).toEqual({ x: 2 });
  });

  test('zepsuty JSON w AsyncStorage → cache miss zamiast rzuconego wyjątku', async () => {
    await AsyncStorage.setItem('daily_tile_cache_v1:broken', '{not json');
    expect(await getDailyCached('broken')).toBeUndefined();
  });
});
