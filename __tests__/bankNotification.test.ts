import { parseBankNotification } from '@/utils/bankNotification';

// Realne treści pushy z Pekao (te same, na których parser był walidowany ręcznie).
const CARD = 'Zapłacono kwotę 10,18 PLN karta *8743 dnia 03-07-2026 godz. 06:37:30 w LIDL HETMANSKA LIDL HETMANSKA Rzeszow POL. Bank Pekao S.A.';
const INCOMING = 'Wpłynęło 37,00 PLN na konto *6332 od OLESIA NEZHUHA. Bank Pekao S.A.';
const SELF_OUT = 'Wykonano przelew 200,00 PLN z konta *6332 na konto *6284, odbiorca: Revolut. Bank Pekao S.A.';
// 2026-09-08, user: "czasami mi nie łapie z powiadomienia np tego ze wypłaty" — realny
// przykład z tytułem "Wpływ" (osobne pole notyfikacji, nie tylko treść jak w INCOMING wyżej).
// Zweryfikowane ręcznie przed dodaniem: parser POPRAWNIE łapie tę dokładną treść — problem
// leży gdzie indziej (najpewniej natywny nasłuch nie dostarczył powiadomienia, patrz
// diagnostyka w Ustawieniach), nie w regexach. Test zostaje jako trwała ochrona przed
// regresją, skoro to realny przypadek usera.
const INCOMING_WPLYW_TITLE = { title: 'Wpływ', text: 'Wpłynęło 3752,78 PLN na konto *6332 od MARKETING INVESTMENT GROUP SA. Bank Pekao S.A.' };

describe('parseBankNotification (Pekao)', () => {
  test('płatność kartą → wydatek (out), kwota + sklep + data z treści', () => {
    const tx = parseBankNotification('Pekao', CARD);
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBeCloseTo(10.18);
    expect(tx!.direction).toBe('out');
    expect(tx!.store.toLowerCase()).toContain('lidl');
    expect(tx!.dateISO.slice(0, 10)).toBe('2026-07-03');
  });

  test('przelew przychodzący → przychód (in) z nadawcą', () => {
    const tx = parseBankNotification('Pekao', INCOMING);
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBeCloseTo(37);
    expect(tx!.direction).toBe('in');
    expect(tx!.store.toLowerCase()).toContain('olesia');
  });

  test('przelew na WŁASNE konto → out + selfTransfer (nie liczy się jako przychód)', () => {
    const tx = parseBankNotification('Pekao', SELF_OUT);
    expect(tx).not.toBeNull();
    expect(tx!.direction).toBe('out');
    expect(tx!.selfTransfer).toBe(true);
  });

  test('nie-bankowa treść → null', () => {
    expect(parseBankNotification('Cokolwiek', 'Twój kod to 123456')).toBeNull();
  });

  test('przychód z tytułem "Wpływ" (osobne pole) i nadawcą wieloczłonowym (spółka) → in', () => {
    const tx = parseBankNotification(INCOMING_WPLYW_TITLE.title, INCOMING_WPLYW_TITLE.text);
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBeCloseTo(3752.78);
    expect(tx!.direction).toBe('in');
    expect(tx!.store).toBe('MARKETING INVESTMENT GROUP SA');
  });
});
