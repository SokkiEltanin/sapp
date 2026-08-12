import AsyncStorage from '@react-native-async-storage/async-storage';
import { isUserNonShop, setNonShopNames, loadNonShop, addNonShop, removeNonShop } from '@/utils/shopExclude';

// excluded to Set modułowy — setNonShopNames CAŁKOWICIE go zastępuje, więc używamy go na
// początku każdego testu żeby dać czysty stan bez potrzeby resetowania modułu.

describe('shopExclude — isUserNonShop / setNonShopNames', () => {
  test('nazwa spoza listy → false', () => {
    setNonShopNames(['Olesia']);
    expect(isUserNonShop('Lidl')).toBe(false);
  });
  test('nazwa z listy → true, niezależnie od wielkości liter i spacji', () => {
    setNonShopNames(['Olesia Nezhuha']);
    expect(isUserNonShop('  OLESIA nezhuha  ')).toBe(true);
  });
  test('brak nazwy (undefined) → false, nie crash', () => {
    setNonShopNames(['Olesia']);
    expect(isUserNonShop(undefined)).toBe(false);
  });
  test('puste/białoznakowe wpisy filtrowane przy ustawianiu listy', () => {
    setNonShopNames(['', '   ', 'Realna nazwa']);
    expect(isUserNonShop('')).toBe(false);
    expect(isUserNonShop('Realna nazwa')).toBe(true);
  });
});

describe('shopExclude — addNonShop / removeNonShop', () => {
  test('dodanie nazwy sprawia że isUserNonShop zaczyna zwracać true', async () => {
    setNonShopNames([]);
    await addNonShop('Przelew wychodzący');
    expect(isUserNonShop('przelew wychodzący')).toBe(true);
  });
  test('usunięcie nazwy sprawia że przestaje być wykluczona', async () => {
    setNonShopNames(['cashbill']);
    await removeNonShop('CashBill');
    expect(isUserNonShop('cashbill')).toBe(false);
  });
  test('usunięcie nazwy, której nigdy nie było, jest bezpiecznym no-opem', async () => {
    setNonShopNames(['jedna']);
    await removeNonShop('zupelnie inna nazwa');
    expect(isUserNonShop('jedna')).toBe(true); // reszta listy nietknięta
  });
  test('dodanie pustej nazwy jest ignorowane', async () => {
    setNonShopNames([]);
    await addNonShop('   ');
    expect(isUserNonShop('   ')).toBe(false);
  });
});

describe('shopExclude — loadNonShop (odczyt z AsyncStorage)', () => {
  test('wczytuje zapisaną listę i aktualizuje stan modułu', async () => {
    await AsyncStorage.setItem('user_nonshop_names_v1', JSON.stringify(['Wpłata gotówkowa']));
    const loaded = await loadNonShop();
    expect(loaded).toContain('wpłata gotówkowa'); // znormalizowane (lowercase)
    expect(isUserNonShop('WPŁATA GOTÓWKOWA')).toBe(true);
  });
  test('brak zapisanej listy → pusta tablica, nie crash', async () => {
    await AsyncStorage.removeItem('user_nonshop_names_v1');
    const loaded = await loadNonShop();
    expect(loaded).toEqual([]);
  });
});
