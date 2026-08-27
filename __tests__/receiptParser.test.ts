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

// 2026-08-27 — user wkleił tekst z ekranu Kaufland app "Receipt copy" (paragon → "..." →
// "Receipt copy"), byte-exact, nie OCR ze zdjęcia — inny layout niż stary `parseKaufland`
// obsługiwał (tam: NAZWA w jednej linii, CENA w następnej). Tu: nagłówki kategorii
// ("Beauty / Zdrowie / Dziecko") przeplatają się z pozycjami, każda pozycja to
// "NAZWA ... CENA LITERA" w jednej linii albo NAZWA osobno + "ilość * cena ... suma LITERA"
// (multi-buy) / "waga KG ... suma LITERA" (towar luzem) w następnej. Promocje na kasie
// ("Kup 2 płać za 1 -11,97" + "Pozycje:3,4") dotyczą kilku pozycji naraz przez referencje
// indeksów — zbyt kruche żeby mapować na konkretny produkt, więc lądują tylko w
// `totalDiscount` (Suma cząstkowa 197,94 − 37,97 rabatów = Suma/Płatność kartą 159,97).
const KAUFLAND_RECEIPT_COPY = `
&1Kaufland Polska Markety Sp.z o.o.Sp.j.
&8Al.Armii Krajowej 47, 50-541 Wrocław&8
Nr BDO 000013346
&5ul. Rejtana&5 &640&6
&235-959&2  &3Rzeszów&3 5464
Cena PLN
Beauty / Zdrowie / Dziecko
BevolaPomadkaRose4,8g             4,99 A
Czas wolny/Do czytania/aktywny wypocz.
Papier ksero                     19,99 A
teczka a4 pastel
 4 * 3,99                        15,96 A
Teczka A4        2 * 3,99         7,98 A
Drogeria/Gosp.dom/Karmy dla zwierz/Tytoń
VizirProszekDoPrania3,465kg      49,99 A
Somat Kaps.DoZmyw.60             44,99 A
CifSpray435ml                    19,99 B
CifSprayTłuszcz750ml             19,99 A
Lada z obsługą
MakrelaWędz.luz.
 0,204 KG                         6,10 C
Owoce/Warzywa/Kwiaty
Kiwi szt         4 * 1,99         7,96 C
Suma cząstkowa        197,94

----------------Promocja---------------
Cena z kartą                    -12,00
Pozycje:7,8
Kup 2 płać za 1                 -11,97
Pozycje:3,4
Kupon XTRA                       -2,00
Pozycje:10
Rabat                           -12,00
Pozycje:2
Suma                            159,97
Płatność kartą                  159,97
Reszta                            0,00

Vat %       Brutto     Netto       VAT
A=23,00%    133,92    108,88     25,04
B=8,00%      13,99     12,95      1,04
C=5,00%      12,06     11,49      0,57
`;

describe('parseReceiptText — Kaufland app "Receipt copy" (2026-08-27)', () => {
  test('sklep i finalna, po-rabatowa kwota', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    expect(r.storeName).toBe('Kaufland');
    expect(r.total).toBe(159.97);
  });

  test('subtotal (Suma cząstkowa) i totalDiscount zgadzają się z total', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    expect(r.subtotal).toBe(197.94);
    expect(r.totalDiscount).toBeCloseTo(37.97, 2);
    expect(r.subtotal - r.totalDiscount).toBeCloseTo(r.total, 2);
  });

  test('łapie wszystkie 10 pozycji, pomijając nagłówki kategorii ("Lada z obsługą" itd.)', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    expect(r.products).toHaveLength(10);
    expect(r.products.some(p => /lada z obs/i.test(p.name) || /beauty/i.test(p.name) || /owoce/i.test(p.name))).toBe(false);
  });

  test('multi-buy na dwóch liniach ("teczka a4 pastel" + "4 * 3,99 ... 15,96")', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    const p = r.products.find(x => /teczka a4 pastel/i.test(x.name));
    expect(p).toBeDefined();
    expect(p!.quantity).toBe(4);
    expect(p!.unitPrice).toBe(3.99);
    expect(p!.finalPrice).toBe(15.96);
  });

  test('multi-buy w jednej linii ("Teczka A4        2 * 3,99         7,98 A")', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    const p = r.products.find(x => /^Teczka a4$/i.test(x.name));
    expect(p).toBeDefined();
    expect(p!.quantity).toBe(2);
    expect(p!.finalPrice).toBe(7.98);
  });

  test('towar luzem na wagę ("MakrelaWędz.luz." + "0,204 KG ... 6,10")', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    const p = r.products.find(x => /makrela/i.test(x.name));
    expect(p).toBeDefined();
    expect(p!.quantity).toBeCloseTo(0.204, 3);
    expect(p!.finalPrice).toBe(6.10);
  });

  test('proste pozycje "nazwa ... cena litera" w jednej linii', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    expect(r.products.find(p => /papier ksero/i.test(p.name))?.finalPrice).toBe(19.99);
    expect(r.products.find(p => /cifspray435/i.test(p.name))?.finalPrice).toBe(19.99);
  });
});

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
