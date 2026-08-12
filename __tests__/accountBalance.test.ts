import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getBalanceOffset, setBalanceOffset, getCashOffset, setCashOffset,
  migrateBalanceModel, updateCardBalancePeak,
} from '@/utils/accountBalance';

// Mock AsyncStorage przecieka stan między testami w tym pliku (patrz [[testing]]) —
// bez tego druga karta widziałaby offset/peak zapisany przez pierwszą.
beforeEach(async () => { await AsyncStorage.clear(); });

describe('accountBalance — getBalanceOffset / setBalanceOffset (i analogicznie cash)', () => {
  test('brak zapisanej wartości → domyślnie 0', async () => {
    expect(await getBalanceOffset()).toBe(0);
    expect(await getCashOffset()).toBe(0);
  });
  test('round-trip: co zapisane, to odczytane', async () => {
    await setBalanceOffset(123.45);
    expect(await getBalanceOffset()).toBe(123.45);
    await setCashOffset(-50);
    expect(await getCashOffset()).toBe(-50);
  });
  test('NaN/Infinity odrzucone po cichu — nie nadpisuje poprzedniej wartości śmieciem', async () => {
    await setBalanceOffset(200);
    await setBalanceOffset(NaN);
    await setBalanceOffset(Infinity);
    expect(await getBalanceOffset()).toBe(200);
  });
});

describe('accountBalance — migrateBalanceModel (jednorazowa konwersja total→card offset)', () => {
  test('cardOffset = stary total offset − cash offset', async () => {
    await setBalanceOffset(1000); // stary model: to był TOTAL offset
    await setCashOffset(300);
    await migrateBalanceModel();
    expect(await getBalanceOffset()).toBe(700); // 1000 - 300
    expect(await getCashOffset()).toBe(300); // cash się nie zmienia
  });
  test('idempotentne — drugie wywołanie nic nie zmienia (już zmigrowane)', async () => {
    await setBalanceOffset(1000);
    await setCashOffset(300);
    await migrateBalanceModel();
    await migrateBalanceModel(); // gdyby odpaliło się drugi raz, przeliczyłoby 700-300=400 (źle)
    expect(await getBalanceOffset()).toBe(700);
  });
});

describe('accountBalance — updateCardBalancePeak (prawdziwy historyczny szczyt, nie tylko obecny stan)', () => {
  test('szczyt ZE ŚRODKA historii przetrwa mimo że saldo później spadło (to jest cały sens tej funkcji)', async () => {
    const peak = await updateCardBalancePeak([
      { type: 'income', amount: 500, paymentMethod: 'card', date: '2026-01-01' },
      { type: 'expense', amount: 400, paymentMethod: 'card', date: '2026-02-01' },
    ]);
    // saldo końcowe to 100, ale w trakcie sięgnęło 500 — peak MUSI być 500, nie 100
    expect(peak).toBe(500);
  });

  test('transakcje gotówkowe nie liczą się do salda KARTY', async () => {
    const peak = await updateCardBalancePeak([
      { type: 'income', amount: 100, paymentMethod: 'card', date: '2026-01-01' },
      { type: 'income', amount: 10000, paymentMethod: 'cash', date: '2026-01-02' },
    ]);
    expect(peak).toBe(100);
  });

  test('transakcje spoza kolejności dat i tak są sortowane przed przeliczeniem szczytu', async () => {
    const peak = await updateCardBalancePeak([
      { type: 'expense', amount: 400, paymentMethod: 'card', date: '2026-02-01' }, // podane PIERWSZE w tablicy
      { type: 'income', amount: 500, paymentMethod: 'card', date: '2026-01-01' },  // ale chronologicznie wcześniejsze
    ]);
    expect(peak).toBe(500); // gdyby liczyło w podanej kolejności (nie posortowanej), wyszłoby 0
  });

  test('zapisany szczyt NIGDY nie spada — kolejne wywołanie z niższym przebiegiem zwraca stary rekord', async () => {
    await updateCardBalancePeak([
      { type: 'income', amount: 500, paymentMethod: 'card', date: '2026-01-01' },
    ]);
    const peak = await updateCardBalancePeak([
      { type: 'expense', amount: 400, paymentMethod: 'card', date: '2026-01-02' },
    ]);
    expect(peak).toBe(500); // stary rekord (500) wygrywa nad nowym przebiegiem (100)
  });

  test('szczyt nigdy nie jest ujemny nawet gdy cały przebieg jest na minusie', async () => {
    await setBalanceOffset(-500);
    const peak = await updateCardBalancePeak([]);
    expect(peak).toBe(0);
  });

  test('szczyt przetrwa między wywołaniami (persystencja przez AsyncStorage)', async () => {
    await updateCardBalancePeak([{ type: 'income', amount: 777, paymentMethod: 'card', date: '2026-01-01' }]);
    const peak = await updateCardBalancePeak([]); // bez nowych transakcji
    expect(peak).toBe(777);
  });
});
