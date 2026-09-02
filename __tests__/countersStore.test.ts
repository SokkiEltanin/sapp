import { matchesAvoid, AVOID_PRESETS } from '@/store/countersStore';

const sweetsKeyword = AVOID_PRESETS.find(p => p.key === 'sweets')!.keyword;

// 2026-09-02, user: "kupię drożdzówkę i ją oflaguję że to pieczywo/słodycz - jak zaznaczę
// że zjadłem to trzeba żeby oflagowało że zjadłem słodycz i tracę streak". Drożdżówka/rogal/
// croissant są kategoryzowane jako 'pieczywo' w FOOD_TAG_MAP (świadomie, dla podziału
// wydatków), więc kategoria-produktu NIE złapie ich jako słodycze — złapane tu, po nazwie,
// tym samym wzorcem co już istniejące 'pączek'.
describe('matchesAvoid — preset "słodycze" łapie słodkie wypieki po nazwie', () => {
  test.each([
    ['Drożdżówka z serem'],
    ['Rogal marcinski'],
    ['Croissant maślany'],
    ['Kroasan czekoladowy'],
  ])('%s pasuje do keyword słodyczy', (name) => {
    expect(matchesAvoid(name, sweetsKeyword)).toBe(true);
  });

  test('zwykłe pieczywo (chleb) nadal NIE pasuje', () => {
    expect(matchesAvoid('Chleb żytni razowy', sweetsKeyword)).toBe(false);
  });
});
