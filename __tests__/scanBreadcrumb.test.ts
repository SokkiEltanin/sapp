import AsyncStorage from '@react-native-async-storage/async-storage';
import { beginScanSave, markScanStep, clearScanSave, takeDanglingScanSave } from '@/utils/scanBreadcrumb';

const KEY = 'scan_save_pending';
// beginScanSave/markScanStep/clearScanSave są celowo fire-and-forget (żeby wołanie ich w
// prawdziwym flow zapisu paragonu nigdy nie blokowało/nie mogło samo wywalić się na froncie)
// — nie zwracają Promise. markScanStep ma DWUPOZIOMOWY łańcuch (getItem().then(→setItem())),
// więc pojedynczy mikrotick nie wystarcza (zmierzone smoke-testem: dawał `step: undefined`) —
// setImmediate odkłada się PO wszystkich zaległych mikrotaskach, co niezawodnie działa dla
// obu głębokości.
const flush = () => new Promise(r => setImmediate(r));

beforeEach(async () => { await AsyncStorage.clear(); });

describe('scanBreadcrumb — beginScanSave / clearScanSave', () => {
  test('beginScanSave zapisuje znacznik z metą i timestampem', async () => {
    beginScanSave('paragon-lidl');
    await flush();
    const raw = await AsyncStorage.getItem(KEY);
    const d = JSON.parse(raw!);
    expect(d.meta).toBe('paragon-lidl');
    expect(typeof d.at).toBe('number');
  });

  test('clearScanSave usuwa znacznik (udany zapis sprząta po sobie)', async () => {
    beginScanSave('x');
    await flush();
    clearScanSave();
    await flush();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

describe('scanBreadcrumb — markScanStep', () => {
  test('aktualizuje pole step na istniejącym znaczniku, zachowując resztę', async () => {
    beginScanSave('paragon-lidl');
    await flush();
    markScanStep('built');
    await flush();
    const d = JSON.parse((await AsyncStorage.getItem(KEY))!);
    expect(d.step).toBe('built');
    expect(d.meta).toBe('paragon-lidl'); // nie nadpisane
  });

  test('brak znacznika (nic nie trwa) → bezpieczny no-op, nie tworzy znikąd nowego wpisu', async () => {
    markScanStep('built');
    await flush();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

describe('scanBreadcrumb — takeDanglingScanSave (diagnostyka po zwisie/force-close)', () => {
  test('zawieszony zapis (znacznik nie wyczyszczony) jest odczytany i skonsumowany JEDNORAZOWO', async () => {
    beginScanSave('paragon-lidl');
    await flush();
    markScanStep('persisted');
    await flush();

    const dangling = await takeDanglingScanSave();
    expect(dangling?.meta).toBe('paragon-lidl');
    expect(dangling?.step).toBe('persisted');

    // drugie wywołanie nic już nie znajduje — znacznik skonsumowany za pierwszym razem
    expect(await takeDanglingScanSave()).toBeNull();
  });

  test('brak zawieszonego zapisu (poprzedni zakończył się czysto) → null', async () => {
    beginScanSave('x');
    await flush();
    clearScanSave();
    await flush();
    expect(await takeDanglingScanSave()).toBeNull();
  });

  test('uszkodzony JSON w znaczniku → traktowany jak brak, nie wywala diagnostyki', async () => {
    await AsyncStorage.setItem(KEY, 'to nie jest json {{{');
    expect(await takeDanglingScanSave()).toBeNull();
  });
});
