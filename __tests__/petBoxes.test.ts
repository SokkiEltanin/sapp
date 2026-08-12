import { boxById, rollBox, LOOT_BOXES } from '@/utils/petBoxes';
import { ShopColor } from '@/utils/petShop';

// rollBox kaskaduje kilka niezależnych progów (kolor → startup → zamrożenie → monety) i
// czyta Math.random() bez wstrzykiwania. Sekwencja mockReturnValueOnce dla każdego testu
// odzwierciedla DOKŁADNĄ kolejność wywołań w źródle: (1) r decydujący o strefie, (2) drugi
// rzut WEWNĄTRZ ważonego losowania koloru/startupu (jeśli dotyczy) lub sprawdzenie jackpota
// (dla monet), (3) trzeci rzut na kwotę monet (tylko gdy NIE jackpot — ternary go pomija
// przy jackpocie, co też jest tu sprawdzone).
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
  const sardine = boxById('sardine'); // colorCut=0.25, startupCut=0.25 (brak startupChance), freezeCut=0.30
  const gold = boxById('gold');       // colorCut=0.48, startupCut=0.64, freezeCut=0.82

  test('strefa koloru: r < colorChance i jest nieposiadany kolor → nagroda typu color', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
    const reward = rollBox(sardine, [color({ id: 'niebieski', tier: 'basic' })], []);
    expect(reward.type).toBe('color');
    if (reward.type === 'color') {
      expect(reward.colorId).toBe('niebieski');
      expect(reward.rarity).toBe('rare'); // COLOR_RARITY: basic tier koloru → rzadkość 'rare' nagrody
    }
  });

  test('strefa startupu: r pomiędzy colorChance a startupChance → nagroda typu startup (nawet gdy kolory dostępne, bo r poza ich zakresem)', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.55).mockReturnValueOnce(0.5);
    const reward = rollBox(gold, [color({ id: 'niebieski' })], []); // kolor nieposiadany, ale r=0.55 >= colorCut(0.48)
    expect(reward.type).toBe('startup');
  });

  test('strefa zamrożenia: r poza kolorem/startupem, w zakresie freezeChance', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.27); // sardine: [0.25, 0.30)
    const reward = rollBox(sardine, [], []);
    expect(reward).toEqual({ type: 'freeze', count: 1, rarity: 'rare' });
  });
  test('zamrożenie ze złotej skrzynki ma wyższą rzadkość (epic, nie rare)', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.70); // gold: [0.64, 0.82)
    const reward = rollBox(gold, [], []);
    expect(reward).toEqual({ type: 'freeze', count: 1, rarity: 'epic' });
  });

  test('strefa monet (bez jackpota): kwota w zakresie [min,max] skrzynki', () => {
    // r=0.9 poza wszystkimi wcześniejszymi strefami; drugi rzut (jackpot check) wysoki → NIE jackpot;
    // trzeci rzut (kwota) = 0 → dolna granica zakresu (min=3 dla sardine)
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.99).mockReturnValueOnce(0);
    const reward = rollBox(sardine, [], []);
    expect(reward).toEqual({ type: 'coins', coins: sardine.coins.min, rarity: 'basic' });
  });

  test('jackpot: drugi rzut trafia w jackpotChance → stała kwota jackpota, rzadkość legendary, TRZECI rzut w ogóle nie następuje', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0); // 0 < każdy dodatni jackpotChance
    const reward = rollBox(sardine, [], []);
    expect(reward).toEqual({ type: 'coins', coins: sardine.coins.jackpot, rarity: 'legendary' });
    expect(spy).toHaveBeenCalledTimes(2); // nie 3 — ternary pomija rzut o kwotę przy jackpocie
  });
});
