import { boxById, rollBox, LOOT_BOXES } from '@/utils/petBoxes';
import { ShopColor } from '@/utils/petShop';

// rollBox kaskaduje kilka niezależnych progów (kolor → startup → zamrożenie → EKWIPUNEK →
// monety) i czyta Math.random() bez wstrzykiwania. Sekwencja mockReturnValueOnce dla
// każdego testu odzwierciedla DOKŁADNĄ kolejność wywołań w źródle: (1) r decydujący o
// strefie, (2) drugi rzut WEWNĄTRZ ważonego losowania koloru/startupu/itemu ekwipunku
// (jeśli dotyczy) lub sprawdzenie jackpota (dla monet), (3) trzeci rzut na rzadkość
// ekwipunku lub kwotę monet (tylko gdy NIE jackpot — ternary go pomija przy jackpocie, co
// też jest tu sprawdzone).
//
// Progi (2026-08-19, po dodaniu gearChance — patrz petBoxes.ts):
// sardine: colorCut=0.20, startupCut=0.20 (brak startupChance), freezeCut=0.25, gearCut=0.40
// gold:    colorCut=0.32, startupCut=0.48, freezeCut=0.58, gearCut=0.96
const color = (o: Partial<ShopColor>): ShopColor => ({
  id: 'test-color', name: 'Testowy', cost: 25, tier: 'basic',
  palette: { id: 'test-color', name: 'Testowy', coat: '#ABCDEF', shade: '#000', ear: '#000', ink: '#000', cost: 25, mark: '' } as any,
  ...o,
} as ShopColor);

describe('petBoxes — boxById', () => {
  test('znaleziona skrzynka po id', () => {
    expect(boxById('gold').id).toBe('gold');
  });
  test('nieznane id → fallback do pierwszej skrzynki, nie undefined', () => {
    expect(boxById('nonsense' as any).id).toBe(LOOT_BOXES[0].id);
  });
});

describe('petBoxes — rollBox (kaskada stref prawdopodobieństwa)', () => {
  afterEach(() => jest.restoreAllMocks());
  const sardine = boxById('sardine');
  const gold = boxById('gold');

  test('strefa koloru: r < colorChance i jest nieposiadany kolor → nagroda typu color', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
    const reward = rollBox(sardine, [color({ id: 'niebieski', tier: 'basic' })], [], 1);
    expect(reward.type).toBe('color');
    if (reward.type === 'color') {
      expect(reward.colorId).toBe('niebieski');
      expect(reward.rarity).toBe('rare'); // COLOR_RARITY: basic tier koloru → rzadkość 'rare' nagrody
    }
  });

  test('strefa startupu: r pomiędzy colorChance a startupChance → nagroda typu startup (nawet gdy kolory dostępne, bo r poza ich zakresem)', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.40).mockReturnValueOnce(0.5); // gold: [0.32, 0.48)
    const reward = rollBox(gold, [color({ id: 'niebieski' })], [], 1); // kolor nieposiadany, ale r=0.40 >= colorCut(0.32)
    expect(reward.type).toBe('startup');
  });

  test('strefa zamrożenia: r poza kolorem/startupem, w zakresie freezeChance', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.22); // sardine: [0.20, 0.25)
    const reward = rollBox(sardine, [], [], 1);
    expect(reward).toEqual({ type: 'freeze', count: 1, rarity: 'rare' });
  });
  test('zamrożenie ze złotej skrzynki ma wyższą rzadkość (epic, nie rare)', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.53); // gold: [0.48, 0.58)
    const reward = rollBox(gold, [], [], 1);
    expect(reward).toEqual({ type: 'freeze', count: 1, rarity: 'epic' });
  });

  test('strefa ekwipunku: r w zakresie gearChance → nagroda typu gear, item wg poziomu odblokowania', () => {
    // sardine: [0.25, 0.40). Drugi rzut=0 → floor(0*N)=0 → pierwszy odblokowany item
    // (helm_slomiany, T1/Lv1 — GEAR_SLOTS zaczyna się od 'helm'). Trzeci rzut=0 → pierwsza
    // rzadkość z niezerową wagą w gearRarityWeight (common, insertion order).
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.30).mockReturnValueOnce(0).mockReturnValueOnce(0);
    const reward = rollBox(sardine, [], [], 1);
    expect(reward).toEqual({ type: 'gear', itemId: 'helm_slomiany', name: 'Słomiany Kapelusz', slot: 'helm', rarity: 'common' });
  });
  test('strefa ekwipunku: item niedostępny na niskim poziomie nie może wypaść (pula filtrowana wg unlockLevel)', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.30).mockReturnValueOnce(0).mockReturnValueOnce(0);
    const reward = rollBox(sardine, [], [], 1);
    expect(reward.type).toBe('gear');
    if (reward.type === 'gear') expect(reward.itemId).not.toBe('helm_koronaBurzy'); // unlockLevel=90
  });

  test('strefa monet (bez jackpota): kwota w zakresie [min,max] skrzynki', () => {
    // r=0.9 poza wszystkimi wcześniejszymi strefami (w tym gearCut=0.40 dla sardine); drugi
    // rzut (jackpot check) wysoki → NIE jackpot; trzeci rzut (kwota) = 0 → dolna granica
    // zakresu (min=3 dla sardine)
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.99).mockReturnValueOnce(0);
    const reward = rollBox(sardine, [], [], 1);
    expect(reward).toEqual({ type: 'coins', coins: sardine.coins.min, rarity: 'basic' });
  });

  test('jackpot: drugi rzut trafia w jackpotChance → stała kwota jackpota, rzadkość legendary, TRZECI rzut w ogóle nie następuje', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0); // 0 < każdy dodatni jackpotChance
    const reward = rollBox(sardine, [], [], 1);
    expect(reward).toEqual({ type: 'coins', coins: sardine.coins.jackpot, rarity: 'legendary' });
    expect(spy).toHaveBeenCalledTimes(2); // nie 3 — ternary pomija rzut o kwotę przy jackpocie
  });
});

// 2026-08-29, user: "te itemy bossów... to są bardziej UMIEJĘTNOŚCI... BASIC ITEMY > STREAK
// FREEZE > COINY 50-300% > TE ITEMY BOSSÓW" — nowa, najrzadsza strefa `combatItemChance`.
// Progi: sardine combatItemCut=0.42 (gearCut 0.40 + 0.02), gold combatItemCut=1.04 (gearCut
// 0.96 + 0.08, w praktyce do 1.0 bo Math.random()<1).
describe('petBoxes — rollBox strefa PERKÓW BOSSÓW (combatItemChance, 2026-08-29)', () => {
  afterEach(() => jest.restoreAllMocks());
  const sardine = boxById('sardine');
  const gold = boxById('gold');

  test('sardine/silver (preferUpgrade=false): zawsze NOWY nieposiadany perk na poziomie 1', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.41).mockReturnValueOnce(0); // sardine: [0.40, 0.42)
    const reward = rollBox(sardine, [], [], 1, {});
    expect(reward).toEqual({ type: 'combatItem', itemId: 'headshot', name: 'Strzał w Łeb', level: 1, isUpgrade: false, rarity: 'rare' });
  });

  test('gold (preferUpgrade=true): PREFERUJE ulepszenie już posiadanego nieMAXowanego perku', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.97).mockReturnValueOnce(0); // gold: [0.96, 1.04)
    const reward = rollBox(gold, [], [], 1, { dodge: 1 }); // dodge maxLevel=4, więc jest upgradowalny
    expect(reward).toEqual({ type: 'combatItem', itemId: 'dodge', name: 'Unik', level: 2, isUpgrade: true, rarity: 'legendary' });
  });

  test('gold, brak upgradowalnych (jedyny posiadany już na maksie) → fallback do NOWEGO nieposiadanego perku', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.97).mockReturnValueOnce(0);
    const reward = rollBox(gold, [], [], 1, { headshot: 1 }); // headshot maxLevel=1 — nic do ulepszenia
    expect(reward).toEqual({ type: 'combatItem', itemId: 'heal', name: 'Uzdrowienie', level: 1, isUpgrade: false, rarity: 'legendary' });
  });

  test('wszystko posiadane NA MAKSIE → strefa nic nie daje, spada do monet (jak strefa ekwipunku w analogicznej sytuacji)', () => {
    const allMaxed = { headshot: 1, heal: 1, dodge: 4, fire: 3, execute: 3, reflect: 4, mindcontrol: 1, shield: 1, thorn: 1 };
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.41).mockReturnValueOnce(0.99).mockReturnValueOnce(0); // sardine: strefa perków, potem coins (bez jackpota, min)
    const reward = rollBox(sardine, [], [], 1, allMaxed);
    expect(reward).toEqual({ type: 'coins', coins: sardine.coins.min, rarity: 'basic' });
  });

  test('brak przekazanego ownedCombatItems (domyślne {}) — działa tak samo jak pusty obiekt', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.41).mockReturnValueOnce(0);
    const reward = rollBox(sardine, [], [], 1); // 5. argument pominięty
    expect(reward.type).toBe('combatItem');
  });
});
