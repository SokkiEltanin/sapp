import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveMerchant, recordMerchantAccept, merchantFor, loadMerchantMemory,
  merchantIsAuto, setMerchantAuto, guessCategory, AUTO_THRESHOLD,
} from '@/utils/merchantMemory';

// Mock jest-resetuje się między testami w tym samym pliku, więc bez tego druga
// pozycja "widziałaby" merchantów zapisanych przez pierwszą (sprawdzone smoke-testem
// przed napisaniem właściwych testów — realny leak, nie teoria).
beforeEach(async () => { await AsyncStorage.clear(); });

describe('merchantMemory — guessCategory (pierwsza zgadywanka przed nauczeniem się)', () => {
  test('rozpoznaje sklepy po kilku kategoriach, bez rozróżniania wielkości liter', () => {
    expect(guessCategory('LIDL Hetmańska')).toBe('groceries');
    expect(guessCategory('orlen stacja 123')).toBe('transport');
    expect(guessCategory('McDonald\'s Rzeszów')).toBe('entertainment');
    expect(guessCategory('Rossmann')).toBe('health');
    expect(guessCategory('Zara')).toBe('clothing');
    expect(guessCategory('IKEA Kraków')).toBe('other');
  });
  test('polskie i beznakreślkowe warianty tej samej sieci trafiają w to samo (żabka/zabka)', () => {
    expect(guessCategory('Żabka Nano')).toBe('groceries');
    expect(guessCategory('Zabka Express')).toBe('groceries');
  });
  test('nierozpoznany sklep → fallback "groceries" (nie null/undefined)', () => {
    expect(guessCategory('Zupełnie nieznany sklep xyz')).toBe('groceries');
  });
  test('"dino" (spożywczak) nie koliduje z "kino" (rozrywka) mimo wspólnego podciągu liter', () => {
    expect(guessCategory('Dino Polska')).toBe('groceries');
  });
});

describe('merchantMemory — saveMerchant (zapis BEZ ruszania liczników zaufania)', () => {
  test('pierwszy zapis tworzy wpis z kategorią', async () => {
    await saveMerchant('Lidl', { category: 'groceries' });
    const mem = await loadMerchantMemory();
    expect(mem['lidl'].category).toBe('groceries');
  });
  test('storeKey normalizowany (trim + lowercase) tak samo przy zapisie i przy odczycie', async () => {
    await saveMerchant('  Lidl  ', { category: 'groceries' });
    const mem = await loadMerchantMemory();
    expect(mem['lidl']).toBeDefined();
    expect(merchantFor('LIDL', mem)).toBeDefined();
    expect(merchantFor('  lidl  ', mem)).toBeDefined(); // ta sama norm() po obu stronach
  });
  test('nadpisanie kategorii NIE zeruje wcześniej nabytych cleanAccepts', async () => {
    await recordMerchantAccept('Lidl', { category: 'groceries', corrected: false });
    await recordMerchantAccept('Lidl', { category: 'groceries', corrected: false });
    await saveMerchant('Lidl', { category: 'other' }); // np. ręczna zmiana kategorii z ustawień
    const mem = await loadMerchantMemory();
    expect(mem['lidl'].category).toBe('other');
    expect(mem['lidl'].cleanAccepts).toBe(2);
  });
});

describe('merchantMemory — recordMerchantAccept (stopniowe zaufanie do auto-księgowania)', () => {
  test('pierwsza akceptacja (brak historii) → cleanAccepts=1, jeszcze nie auto', async () => {
    const info = await recordMerchantAccept('Lidl', { category: 'groceries', corrected: false });
    expect(info?.cleanAccepts).toBe(1);
    expect(info?.auto).toBeFalsy();
  });

  test(`dokładnie AUTO_THRESHOLD(${AUTO_THRESHOLD}) czystych akceptacji z rzędu → graduacja do auto`, async () => {
    let info;
    for (let i = 0; i < AUTO_THRESHOLD - 1; i++) {
      info = await recordMerchantAccept('Lidl', { category: 'groceries', corrected: false });
    }
    // o jedną akceptację ZA WCZEŚNIE — jeszcze nie powinno być auto (łapie ewentualny off-by-one)
    expect(info?.cleanAccepts).toBe(AUTO_THRESHOLD - 1);
    expect(info?.auto).toBeFalsy();

    info = await recordMerchantAccept('Lidl', { category: 'groceries', corrected: false });
    expect(info?.cleanAccepts).toBe(AUTO_THRESHOLD);
    expect(info?.auto).toBe(true);
  });

  test('korekta kategorii ZERUJE licznik i cofa auto — musi zasłużyć na zaufanie od nowa', async () => {
    for (let i = 0; i < AUTO_THRESHOLD; i++) {
      await recordMerchantAccept('Lidl', { category: 'groceries', corrected: false });
    }
    let mem = await loadMerchantMemory();
    expect(mem['lidl'].auto).toBe(true);

    const info = await recordMerchantAccept('Lidl', { category: 'other', corrected: true });
    expect(info?.cleanAccepts).toBe(0);
    expect(info?.auto).toBe(false);
    expect(info?.category).toBe('other'); // korekta i tak zapisuje nową kategorię
  });

  test('pusty storeKey → undefined, nic nie zapisuje', async () => {
    const info = await recordMerchantAccept('   ', { category: 'groceries', corrected: false });
    expect(info).toBeUndefined();
    const mem = await loadMerchantMemory();
    expect(Object.keys(mem).length).toBe(0);
  });
});

describe('merchantMemory — merchantIsAuto / setMerchantAuto', () => {
  test('nieznany sklep → nie auto', async () => {
    expect(await merchantIsAuto('Nieznany')).toBe(false);
  });

  test('ręczne włączenie auto NIE rusza cleanAccepts', async () => {
    await recordMerchantAccept('Lidl', { category: 'groceries', corrected: false }); // cleanAccepts=1
    await setMerchantAuto('Lidl', true);
    const mem = await loadMerchantMemory();
    expect(mem['lidl'].auto).toBe(true);
    expect(mem['lidl'].cleanAccepts).toBe(1);
  });

  test('ręczne wyłączenie auto ZERUJE cleanAccepts (musi zasłużyć od nowa, spójne z korektą)', async () => {
    for (let i = 0; i < AUTO_THRESHOLD; i++) {
      await recordMerchantAccept('Lidl', { category: 'groceries', corrected: false });
    }
    await setMerchantAuto('Lidl', false);
    const mem = await loadMerchantMemory();
    expect(mem['lidl'].auto).toBe(false);
    expect(mem['lidl'].cleanAccepts).toBe(0);
  });

  test('włączenie auto dla NIEISTNIEJĄCEGO merchanta jest no-opem (nie tworzy wpisu znikąd)', async () => {
    await setMerchantAuto('Widmo', true);
    const mem = await loadMerchantMemory();
    expect(mem['widmo']).toBeUndefined();
  });
});
