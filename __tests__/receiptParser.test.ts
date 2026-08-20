import { getFoodTags, parseReceiptText } from '@/utils/receiptParser';

// Klasyfikacja słodyczy — po tym apka liczy „Słodycze vs jedzenie", kalendarz bez słodyczy itd.
describe('getFoodTags — wykrywanie słodyczy', () => {
  test('klasyki oznaczone jako "słodycze"', () => {
    expect(getFoodTags('Czekolada Milka mleczna')).toContain('słodycze');
    expect(getFoodTags('Baton Snickers 50g')).toContain('słodycze');
    expect(getFoodTags('Ptasie Mleczko waniliowe')).toContain('słodycze');
    expect(getFoodTags('Kinder Bueno')).toContain('słodycze');
  });

  test('zwykłe produkty NIE są słodyczą', () => {
    expect(getFoodTags('Mleko 2%')).not.toContain('słodycze');
    expect(getFoodTags('Chleb razowy')).not.toContain('słodycze');
    expect(getFoodTags('Pierś z kurczaka')).not.toContain('słodycze');
  });

  test('pieczywo trafia do "pieczywo", nie "słodycze"', () => {
    const tags = getFoodTags('Bułka kajzerka');
    expect(tags).toContain('pieczywo');
    expect(tags).not.toContain('słodycze');
  });
});

// 2026-08-20 — user przesłał realny paragon Lidl ze zwrotem kaucji za butelki: "SUMA PLN"
// (29,66) to suma towarów PRZED odjęciem zwrotu kaucji (-6,00), a finalna, realnie zapłacona
// kwota (23,66, ta sama co "Płatność Karta płatnicza") jest OSOBNĄ, PÓŹNIEJSZĄ linijką "Suma".
// Parser łapał "SUMA PLN" jako pierwsze dopasowanie w tekście, więc "Razem" na ekranie pokazywał
// 29,66 zamiast 23,66 — user: "zobacz jak teraz naliczają kaucję i problem ze tam -6 pln bierze
// za zwrot butelek uwzględnij napraw". Fix: `detectPaymentTotal()` (linijka "Płatność ...
// <kwota>", zawsze finalna, po-korektowa kwota) sprawdzane PRZED resztą wzorców.
const LIDL_RECEIPT_WITH_DEPOSIT = `
Adres siedziby: Poznańska 48, Jankowice
             62-080 Tarnowo
Podgórne nr rej: BDO 000002265 Lidl sp.
             z o. o. sp. k.
84-120 Władysławowo, ul. Starowiejska 25
2026-08-20

Kinder Crispy 5-pak
                     1 * 15.99 15.99 C
   RABAT 50%                   -8,00
Lay's Chipsy Oven B.
                       1 * 9.49 9.49 C
   RABAT 50%                   -4,75
Przekąska kebab drob
                       2 * 3.47 6.94 C
APAP tabletki
                       1 * 9.99 9.99 B
PTU B                             9,99
Kwota B 8,00%                     0,74
PTU C                            19,67
Kwota C 5,00%                     0,94
Suma                              1,68
Suma PLN            29,66
86 1403      nr:   109457        11:35
Opakowania zwrotne przyjęcia
   Zwrot kaucji           1 * 6.0 -6.0
Opakowania zwrotne suma          -6,00
Suma                    23,66
Płatność         Karta płatnicza 23,66
`;

describe('parseReceiptText — Lidl paragon ze zwrotem kaucji (2026-08-20)', () => {
  test('"Razem" to finalna, po-kaucyjna kwota (23,66), nie "SUMA PLN" sprzed zwrotu (29,66)', () => {
    const r = parseReceiptText(LIDL_RECEIPT_WITH_DEPOSIT);
    expect(r.total).toBe(23.66);
  });

  test('zwrot kaucji trafia do produktów jako pozycja "deposit" z ujemną ceną', () => {
    const r = parseReceiptText(LIDL_RECEIPT_WITH_DEPOSIT);
    const deposit = r.products.find(p => p.kind === 'deposit');
    expect(deposit).toBeDefined();
    expect(deposit!.finalPrice).toBe(-6);
  });

  test('suma pozycji (subtotal) zgadza się z realnie zapłaconą kwotą (total)', () => {
    const r = parseReceiptText(LIDL_RECEIPT_WITH_DEPOSIT);
    expect(r.subtotal).toBeCloseTo(r.total, 2);
  });
});
