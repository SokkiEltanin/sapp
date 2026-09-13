import { usePetStore, effectiveCatMaxHp } from '@/store/petStore';
import { isPotionActive, potionFlatHp, potionAtkBonus, potionXpMult, POTIONS } from '@/utils/potions';

// Potki czasowe (2026-09-08) — user planuje przebudowę Rynku (górne 4 sloty tablicy: Zamrożenie
// + potki HP/ATK/XP na 24h). Pełny opis w ARCHITECTURE.md §47/48.

describe('potions.ts — funkcje czyste', () => {
  test('isPotionActive: null → false', () => {
    expect(isPotionActive(null)).toBe(false);
  });
  test('isPotionActive: wygasła → false', () => {
    expect(isPotionActive({ kind: 'hp', endsAt: new Date(Date.now() - 1000).toISOString() })).toBe(false);
  });
  test('isPotionActive: aktywna → true', () => {
    expect(isPotionActive({ kind: 'hp', endsAt: new Date(Date.now() + 3600000).toISOString() })).toBe(true);
  });
  test('isPotionActive: filtr po kind — inny typ aktywny nie liczy się jako "ten" typ', () => {
    const p = { kind: 'atk' as const, endsAt: new Date(Date.now() + 3600000).toISOString() };
    expect(isPotionActive(p, 'atk')).toBe(true);
    expect(isPotionActive(p, 'hp')).toBe(false);
  });
  test('potionFlatHp/potionAtkBonus/potionXpMult: 0 gdy nic aktywne', () => {
    expect(potionFlatHp(null)).toBe(0);
    expect(potionAtkBonus(null)).toBe(0);
    expect(potionXpMult(null)).toBe(1);
  });
  test('potionFlatHp: tylko potka HP daje bonus, ATK/XP nie', () => {
    const hp = { kind: 'hp' as const, endsAt: new Date(Date.now() + 3600000).toISOString() };
    const atk = { kind: 'atk' as const, endsAt: new Date(Date.now() + 3600000).toISOString() };
    expect(potionFlatHp(hp)).toBe(POTIONS.hp.hpBonus);
    expect(potionFlatHp(atk)).toBe(0);
  });
  test('potionAtkBonus: tylko potka ATK', () => {
    const atk = { kind: 'atk' as const, endsAt: new Date(Date.now() + 3600000).toISOString() };
    expect(potionAtkBonus(atk)).toBe(POTIONS.atk.atkBonus);
  });
  test('potionXpMult: tylko potka XP', () => {
    const xp = { kind: 'xp' as const, endsAt: new Date(Date.now() + 3600000).toISOString() };
    expect(potionXpMult(xp)).toBe(POTIONS.xp.xpMult);
  });
});

// 2026-09-13, user zrzutem ekranu: "Max HP kotka: 397.9813491557909" — `gearFlatHp` zwraca
// wylosowany, ciągły `owned.value` (roll zbroi), nigdy nie był całkowity.
// `effectiveCatMaxHp` (jedyne wspólne miejsce liczące sufit HP dla wyświetlania I walki,
// patrz komentarz w petStore.ts) musi zaokrąglić WYNIK, żeby HP zostało spójną, całkowitą
// koncepcją gry wszędzie, tak jak bazowe staty czy HP bossów.
describe('petStore — effectiveCatMaxHp zaokrągla ułamkowy roll ekwipunku', () => {
  test('ułamkowa wartość zbroi (roll ze skrzynki) nie przecieka do wyświetlanego/bojowego max HP', () => {
    const maxHp = effectiveCatMaxHp(
      0,
      { zbroja: 'zbroja_smoczaLuska' },
      { zbroja_smoczaLuska: { rarity: 'epic', value: 297.9813491557909 } },
      null,
    );
    expect(Number.isInteger(maxHp)).toBe(true);
    expect(maxHp).toBe(Math.round(100 + 297.9813491557909));
  });

  test('bez ekwipunku/potki: całkowita wartość zostaje całkowita (regresja na "zawsze zaokrąglaj bez różnicy")', () => {
    expect(effectiveCatMaxHp(20, {}, {}, null)).toBe(120);
  });
});

function resetStore(coins: number) {
  usePetStore.setState({ coins, activePotion: null, xp: 0, claimedQuests: [] });
}

describe('petStore.buyPotion / syncPotionExpiry', () => {
  beforeEach(() => resetStore(1000));

  test('zakup udany: pobiera monety, ustawia activePotion z endsAt ~24h w przyszłości', () => {
    const ok = usePetStore.getState().buyPotion('atk');
    expect(ok).toBe(true);
    const s = usePetStore.getState();
    expect(s.coins).toBe(1000 - POTIONS.atk.cost);
    expect(s.activePotion?.kind).toBe('atk');
    const hoursLeft = (new Date(s.activePotion!.endsAt).getTime() - Date.now()) / 3600000;
    expect(hoursLeft).toBeGreaterThan(23.9);
    expect(hoursLeft).toBeLessThanOrEqual(24);
  });

  test('za mało monet — zakup odrzucony, nic się nie zmienia', () => {
    resetStore(10);
    const ok = usePetStore.getState().buyPotion('hp');
    expect(ok).toBe(false);
    expect(usePetStore.getState().coins).toBe(10);
    expect(usePetStore.getState().activePotion).toBeNull();
  });

  test('kupienie nowej potki PODMIENIA poprzednią (tylko jedna naraz)', () => {
    usePetStore.getState().buyPotion('hp');
    usePetStore.getState().buyPotion('xp');
    expect(usePetStore.getState().activePotion?.kind).toBe('xp');
  });

  test('syncPotionExpiry: czyści activePotion po wygaśnięciu', () => {
    usePetStore.setState({ activePotion: { kind: 'hp', endsAt: new Date(Date.now() - 1000).toISOString() } });
    usePetStore.getState().syncPotionExpiry();
    expect(usePetStore.getState().activePotion).toBeNull();
  });

  test('syncPotionExpiry: NIE rusza wciąż aktywnej potki', () => {
    const endsAt = new Date(Date.now() + 3600000).toISOString();
    usePetStore.setState({ activePotion: { kind: 'hp', endsAt } });
    usePetStore.getState().syncPotionExpiry();
    expect(usePetStore.getState().activePotion).toEqual({ kind: 'hp', endsAt });
  });
});

describe('petStore — potka XP mnoży przyznawane XP', () => {
  beforeEach(() => resetStore(1000));

  test('claimQuest bez aktywnej potki XP: przyznaje dokładnie tyle, ile podano', () => {
    usePetStore.getState().claimQuest('q1', 0, 20);
    expect(usePetStore.getState().xp).toBe(20);
  });

  test('claimQuest z aktywną potką XP: przyznane XP pomnożone przez POTIONS.xp.xpMult', () => {
    usePetStore.setState({ activePotion: { kind: 'xp', endsAt: new Date(Date.now() + 3600000).toISOString() } });
    usePetStore.getState().claimQuest('q1', 0, 20);
    expect(usePetStore.getState().xp).toBe(Math.round(20 * POTIONS.xp.xpMult!));
  });

  test('addXp z aktywną potką XP też jest mnożone (nie tylko claimQuest)', () => {
    usePetStore.setState({ activePotion: { kind: 'xp', endsAt: new Date(Date.now() + 3600000).toISOString() } });
    usePetStore.getState().addXp(10);
    expect(usePetStore.getState().xp).toBe(Math.round(10 * POTIONS.xp.xpMult!));
  });

  test('wygasła potka XP nie mnoży już XP', () => {
    usePetStore.setState({ activePotion: { kind: 'xp', endsAt: new Date(Date.now() - 1000).toISOString() } });
    usePetStore.getState().claimQuest('q1', 0, 20);
    expect(usePetStore.getState().xp).toBe(20);
  });
});
