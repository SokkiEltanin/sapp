import { boxById, rollBox, LOOT_BOXES } from '@/utils/petBoxes';
import { gearById, gearValueRange } from '@/utils/gear';

// rollBox kaskaduje 2 niezależne progi (EKWIPUNEK → PERKI/monety) i czyta Math.random() bez
// wstrzykiwania. Sekwencja mockReturnValueOnce dla każdego testu odzwierciedla DOKŁADNĄ
// kolejność wywołań w źródle: (1) r decydujący o strefie, (2) drugi rzut WEWNĄTRZ ważonego
// losowania itemu ekwipunku (jeśli dotyczy) lub sprawdzenie jackpota (dla monet), (3) trzeci
// rzut na rzadkość ekwipunku lub kwotę monet (tylko gdy NIE jackpot).
//
// 2026-09-11, user: "ze skrzynek na rynku wywalmy zamrożenie serii oraz kolory i startupy,
// zostaje sam ekwipunek do dropnięcia oraz te ulepszenia ogólne" — kolor/startup/zamrożenie
// USUNIĘTE z puli dropów i z `rollBox()`'s sygnatury (nie bierze już `colors`/`ownedIds`).
// `gearChance` KAŻDEJ skrzynki podniesiona o dokładnie tyle, ile zabierały usunięte kategorie
// (patrz petBoxes.ts) — CAŁKOWITE progi "coś ciekawego" są identyczne jak przed zmianą, tylko
// jednolite: gearCut = gearChance, combatItemCut = gearCut + combatItemChance.
//
// Progi (2026-09-22, PO przebalansie ekonomii skrzynek — patrz komentarz przy
// BOX_MAX_GEAR_TIER w petBoxes.ts): sardine gearCut=0.40, combatItemCut=0.42 (bez zmian —
// nigdy nie było tu buga). iron gearCut=0.65, combatItemCut=0.70 (było 0.76/0.81). gold
// gearCut=0.70, combatItemCut=0.78 (było 0.96/1.04 — PRZEKRACZAŁO 1, prawdziwy bug, branch
// monet był matematycznie nieosiągalny). divine gearCut=0.65, combatItemCut=0.81 (było
// 0.92/1.08 — ten sam bug, drastyczniejszy).

describe('petBoxes — boxById', () => {
  test('znaleziona skrzynka po id', () => {
    expect(boxById('gold').id).toBe('gold');
  });
  test('nieznane id → fallback do pierwszej skrzynki, nie undefined', () => {
    expect(boxById('nonsense' as any).id).toBe(LOOT_BOXES[0].id);
  });
});

// 2026-09-08, user: "zostawiłeś skrzynkę dnia miała być ta nowa, DREWNIANA, ZELAZNA, ZLOTA,
// BOSKA" — dodany 4. płatny tier ("divine"), a "silver" przemianowany na "iron" (te same
// liczby, tylko nazwa/emoji/kolor). `BOX_RANK` zastąpiło twarde porównania `box.id === 'gold'`
// rozsiane po rollBox() — te testy pilnują, że "divine" faktycznie jest traktowana jako
// NAJLEPSZA (a nie przypadkiem gorsza niż gold przez literówkę w porównaniu rang).
describe('petBoxes — 4 tiery skrzyń (drewniana/żelazna/złota/boska, 2026-09-08)', () => {
  test('dokładnie 4 skrzynie, we właściwej kolejności', () => {
    expect(LOOT_BOXES.map(b => b.id)).toEqual(['sardine', 'iron', 'gold', 'divine']);
  });
  test('divine kosztuje więcej niż gold, gold więcej niż iron, iron więcej niż sardine', () => {
    const [sardine, iron, gold, divine] = LOOT_BOXES;
    expect(iron.cost).toBeGreaterThan(sardine.cost);
    expect(gold.cost).toBeGreaterThan(iron.cost);
    expect(divine.cost).toBeGreaterThan(gold.cost);
  });
  test('divine, tak jak gold, PREFERUJE ulepszenie posiadanego perku (nie tylko gold)', () => {
    const divine = boxById('divine');
    // divine: strefa perków [0.65, 0.81) po przebalansie (2026-09-22) — r=0.75 mieści się w środku.
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.75).mockReturnValueOnce(0);
    const reward = rollBox(divine, 1, { dodge: 1 });
    expect(reward).toEqual({ type: 'combatItem', itemId: 'dodge', name: 'Unik', level: 2, isUpgrade: true, rarity: 'legendary' });
    jest.restoreAllMocks();
  });
  test('monety divine mieszczą się w 50%-300% jej WŁASNEGO kosztu, jak reszta skrzyń', () => {
    const divine = boxById('divine');
    expect(divine.coins.min).toBe(Math.round(divine.cost * 0.5));
    expect(divine.coins.max).toBe(divine.cost * 3);
  });
});

describe('petBoxes — rollBox (kaskada stref prawdopodobieństwa)', () => {
  afterEach(() => jest.restoreAllMocks());
  const sardine = boxById('sardine');
  const gold = boxById('gold');

  test('strefa ekwipunku: r w zakresie gearChance → nagroda typu gear, item wg poziomu odblokowania', () => {
    // sardine: [0, 0.40). Drugi rzut=0 → floor(0*N)=0 → pierwszy odblokowany item
    // (helm_slomiany, T1/Lv1 — GEAR_SLOTS zaczyna się od 'helm'). Trzeci rzut=0 → pierwsza
    // rzadkość z niezerową wagą w gearRarityWeight (common, insertion order). Czwarty rzut=0
    // (2026-08-31, rollGearValue) → dolna granica przedziału (min z gearValueRange, ×0.7 od
    // środka balansu — patrz GEAR_ROLL_SPREAD w gear.ts).
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.30).mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0);
    const reward = rollBox(sardine, 1);
    const [minVal] = gearValueRange(gearById('helm_slomiany')!, 'common');
    expect(reward).toEqual({ type: 'gear', itemId: 'helm_slomiany', name: 'Słomiany Kapelusz', slot: 'helm', rarity: 'common', value: minVal });
  });
  test('strefa ekwipunku: item niedostępny na niskim poziomie nie może wypaść (pula filtrowana wg unlockLevel)', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.30).mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0);
    const reward = rollBox(sardine, 1);
    expect(reward.type).toBe('gear');
    if (reward.type === 'gear') expect(reward.itemId).not.toBe('helm_koronaBurzy'); // unlockLevel=90
  });

  test('strefa monet (bez jackpota): kwota w zakresie [min,max] skrzynki', () => {
    // r=0.9 poza wszystkimi wcześniejszymi strefami (w tym combatItemCut=0.42 dla sardine);
    // drugi rzut (jackpot check) wysoki → NIE jackpot; trzeci rzut (kwota) = 0 → dolna granica
    // zakresu (min dla sardine)
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.99).mockReturnValueOnce(0);
    const reward = rollBox(sardine, 1);
    expect(reward).toEqual({ type: 'coins', coins: sardine.coins.min, rarity: 'basic' });
  });

  test('jackpot: drugi rzut trafia w jackpotChance → stała kwota jackpota, rzadkość legendary, TRZECI rzut w ogóle nie następuje', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0); // 0 < każdy dodatni jackpotChance
    const reward = rollBox(sardine, 1);
    expect(reward).toEqual({ type: 'coins', coins: sardine.coins.jackpot, rarity: 'legendary' });
    expect(spy).toHaveBeenCalledTimes(2); // nie 3 — ternary pomija rzut o kwotę przy jackpocie
  });
});

// 2026-08-29, user: "te itemy bossów... to są bardziej UMIEJĘTNOŚCI... BASIC ITEMY > STREAK
// FREEZE > COINY 50-300% > TE ITEMY BOSSÓW" — najrzadsza strefa `combatItemChance`.
// Progi (2026-09-22, PO przebalansie): sardine combatItemCut=0.42 (gearCut 0.40 + 0.02, bez
// zmian). gold combatItemCut=0.78 (gearCut 0.70 + 0.08) — dawniej 1.04, PRZEKRACZAŁO 1
// (prawdziwy bug: branch monet matematycznie nieosiągalny, potwierdzone realnymi
// statystykami usera — 0% monet z boskiej skrzynki na 40 otwarć).
describe('petBoxes — rollBox strefa PERKÓW BOSSÓW (combatItemChance, 2026-08-29)', () => {
  afterEach(() => jest.restoreAllMocks());
  const sardine = boxById('sardine');
  const gold = boxById('gold');

  test('sardine/iron (preferUpgrade=false): zawsze NOWY nieposiadany perk na poziomie 1', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.41).mockReturnValueOnce(0); // sardine: [0.40, 0.42)
    const reward = rollBox(sardine, 1, {});
    expect(reward).toEqual({ type: 'combatItem', itemId: 'headshot', name: 'Strzał w Łeb', level: 1, isUpgrade: false, rarity: 'rare' });
  });

  test('gold (preferUpgrade=true): PREFERUJE ulepszenie już posiadanego nieMAXowanego perku', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.75).mockReturnValueOnce(0); // gold: [0.70, 0.78)
    const reward = rollBox(gold, 1, { dodge: 1 }); // dodge maxLevel=4, więc jest upgradowalny
    expect(reward).toEqual({ type: 'combatItem', itemId: 'dodge', name: 'Unik', level: 2, isUpgrade: true, rarity: 'legendary' });
  });

  test('gold, brak upgradowalnych (jedyny posiadany już na maksie) → fallback do NOWEGO nieposiadanego perku', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.75).mockReturnValueOnce(0);
    const reward = rollBox(gold, 1, { headshot: 1 }); // headshot maxLevel=1 — nic do ulepszenia
    expect(reward).toEqual({ type: 'combatItem', itemId: 'heal', name: 'Uzdrowienie', level: 1, isUpgrade: false, rarity: 'legendary' });
  });

  test('wszystko posiadane NA MAKSIE → strefa nic nie daje, spada do monet (jak strefa ekwipunku w analogicznej sytuacji)', () => {
    const allMaxed = { headshot: 1, heal: 1, dodge: 4, fire: 3, execute: 3, reflect: 4, mindcontrol: 1, shield: 1, thorn: 1 };
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.41).mockReturnValueOnce(0.99).mockReturnValueOnce(0); // sardine: strefa perków, potem coins (bez jackpota, min)
    const reward = rollBox(sardine, 1, allMaxed);
    expect(reward).toEqual({ type: 'coins', coins: sardine.coins.min, rarity: 'basic' });
  });

  test('brak przekazanego ownedCombatItems (domyślne {}) — działa tak samo jak pusty obiekt', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.41).mockReturnValueOnce(0);
    const reward = rollBox(sardine, 1); // 3. argument pominięty
    expect(reward.type).toBe('combatItem');
  });
});

// 2026-09-22 — przebalans ekonomii skrzynek: user przysłał realne statystyki pokazujące dwa
// problemy naraz (patrz komentarz przy BOX_MAX_GEAR_TIER w petBoxes.ts): (1) gearChance +
// combatItemChance PRZEKRACZAŁO 100% dla gold/divine → branch monet matematycznie
// nieosiągalny; (2) pula itemów w rollBox() była capowana WYŁĄCZNIE poziomem gracza, nie
// tierem skrzynki, więc drewniana miała przy wysokim poziomie ten sam dostęp co boska.
describe('petBoxes — przebalans ekonomii (2026-09-22): fix przepełnienia + box-tier cap', () => {
  afterEach(() => jest.restoreAllMocks());

  test('gearChance + combatItemChance < 1 dla KAŻDEJ skrzynki (monety zawsze realnie osiągalne)', () => {
    for (const box of LOOT_BOXES) {
      expect(box.gearChance + (box.combatItemChance ?? 0)).toBeLessThan(1);
    }
  });

  test('drewniana (sardine) NIE MOŻE wylosować itemu z tieru powyżej unlockLevel=20, nawet przy bardzo wysokim poziomie pupila', () => {
    const sardine = boxById('sardine');
    // r1=0.30 → strefa ekwipunku; r2=0.99 → OSTATNI item w (capowanej) puli; r3/r4=0.
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.30).mockReturnValueOnce(0.99).mockReturnValueOnce(0).mockReturnValueOnce(0);
    const reward = rollBox(sardine, 999);
    expect(reward.type).toBe('gear');
    if (reward.type === 'gear') {
      expect(reward.itemId).toBe('kolczyki_miedziane'); // unlockLevel=20 — ostatni w capowanej puli
      expect(reward.itemId).not.toBe('kolczyki_krezus'); // unlockLevel=90 — poza capem sardine
    }
  });

  test('boska (divine) MA dostęp do pełnego katalogu (cap = 90) przy wysokim poziomie pupila', () => {
    const divine = boxById('divine');
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.30).mockReturnValueOnce(0.99).mockReturnValueOnce(0).mockReturnValueOnce(0);
    const reward = rollBox(divine, 999);
    expect(reward.type).toBe('gear');
    if (reward.type === 'gear') expect(reward.itemId).toBe('kolczyki_krezus'); // unlockLevel=90 — szczyt katalogu
  });
});
