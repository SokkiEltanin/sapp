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
// 2026-09-13, user: "trzeba dodać kategorie przelew własny jak jest do Wiktor Rudziński...
// to znaczy ze to przelew wewnętrzny do mnie samego" — przelew na DRUGIE WŁASNE konto, bez
// żadnego słowa-klucza typu "Revolut"/"oszczędności", rozpoznawany WYŁĄCZNIE po dopasowaniu
// `odbiorca` do zadeklarowanego w Ustawieniach imienia+nazwiska (3. argument parsera).
const SELF_OUT_BY_NAME = 'Wykonano przelew 150,00 PLN z konta *6332 na konto *9911, odbiorca: Wiktor Rudziński. Bank Pekao S.A.';
// 2026-09-16, user: "a czy takie złapie dobrze ze to płatność kartą (bo BLik) i ze to
// z decathlon?" — realny przykład. BLIK push'e Pekao mówią "z konta *XXXX" (obciążone
// konto), TAK SAMO jak prawdziwe przelewy — `isTransferOut` kiedyś łapał tę samą frazę i
// błędnie kwalifikował TĘ notyfikację jako "Przelew wychodzący" zamiast płatności BLIK w
// Decathlonie (sklep i method gubione). Naprawione (patrz komentarz w bankNotification.ts).
const BLIK_DECATHLON = 'Zapłacono BLIK-iem na kwotę 59,98 PLN z konta *6332 w DECATHLON SP. Z O.O.. Bank Pekao S.A.';

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

  test('przelew do innej osoby o Twoim imieniu/nazwisku, bez ownName → zwykły wydatek (nie selfTransfer)', () => {
    const tx = parseBankNotification('Pekao', SELF_OUT_BY_NAME);
    expect(tx).not.toBeNull();
    expect(tx!.direction).toBe('out');
    expect(tx!.selfTransfer).toBeFalsy();
  });

  test('przelew na WŁASNE konto rozpoznany po imieniu+nazwisku z Ustawień → selfTransfer', () => {
    const tx = parseBankNotification('Pekao', SELF_OUT_BY_NAME, 'Wiktor Rudziński');
    expect(tx).not.toBeNull();
    expect(tx!.direction).toBe('out');
    expect(tx!.selfTransfer).toBe(true);
  });

  test('niepasujące ownName → nie selfTransfer (nie zgaduje na siłę)', () => {
    const tx = parseBankNotification('Pekao', SELF_OUT_BY_NAME, 'Jan Kowalski');
    expect(tx).not.toBeNull();
    expect(tx!.selfTransfer).toBeFalsy();
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

  test('płatność BLIK ("z konta *X" jak prawdziwy przelew) → wydatek, method blik, sklep z treści (nie "Przelew wychodzący")', () => {
    const tx = parseBankNotification('Wykonano operację BLIK', BLIK_DECATHLON);
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBeCloseTo(59.98);
    expect(tx!.direction).toBe('out');
    expect(tx!.method).toBe('blik');
    expect(tx!.store.toLowerCase()).toContain('decathlon');
    expect(tx!.storeKey).toBe('decathlon');
  });
});
