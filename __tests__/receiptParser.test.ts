import { getFoodTags } from '@/utils/receiptParser';

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
