import { BOSSES } from '@/utils/bosses';
import { madBossId, madCandidate, madBossFor, MAD_UNLOCK_LEVEL, MAD_HP_MULT, MAD_COUNTER_MULT } from '@/utils/madBosses';

describe('madBosses — madCandidate (pierwszy pokonany-ale-nie-MAD, po kolejności)', () => {
  test('brak pokonanych bossów kampanii → brak kandydata', () => {
    expect(madCandidate([], [])).toBeNull();
  });

  test('pokonany pierwszy boss, żaden MAD jeszcze nie ukończony → to on jest kandydatem', () => {
    const c = madCandidate(['sloth'], []);
    expect(c?.id).toBe('sloth');
  });

  test('MAD tego bossa już ukończony → kandydat null (nic więcej nie pokonano normalnie)', () => {
    expect(madCandidate(['sloth'], ['sloth'])).toBeNull();
  });

  test('dwa pokonane normalnie, jeden MAD ukończony → drugi (po kolejności) jest kandydatem', () => {
    const c = madCandidate(['sloth', 'sugar'], ['sloth']);
    expect(c?.id).toBe('sugar');
  });
});

// PRZEBUDOWANE (2026-08-21) — MAD hp dawniej liczyło się z AKTUALNEJ mocy gracza (rosło z
// levelem, "nigdy nie przestarzałe"). User: "ty zrobiles ze im większy level tym większe HP
// mad bossów?????" → po wyjaśnieniu (tak zawsze działało, nie dzisiejsza zmiana) user świadomie
// odwrócił na STAŁE, "pojebane" wartości: "chce stałe... mad bossy byly 10x silniejsze od
// kampanijnych odzwierciedleń... i z większym o wiele atakiem". Testy niżej pilnują nowego
// modelu: hp = boss.hp(kampania) × MAD_HP_MULT, STAŁE (niezależne od poziomu/statów gracza).
describe('madBosses — balans (STAŁE hp = kampania × MAD_HP_MULT, 2026-08-21)', () => {
  const sloth = BOSSES.find(b => b.id === 'sloth')!;

  test('MAD_HP_MULT to dokładnie 10 (user: "10x silniejsze od kampanijnych odzwierciedleń")', () => {
    expect(MAD_HP_MULT).toBe(10);
  });

  test('hp MAD bossa to dokładnie boss.hp × MAD_HP_MULT, niezależnie od parametrów gracza', () => {
    const mad = madBossFor(sloth);
    expect(mad.hp).toBe(sloth.hp * MAD_HP_MULT);
  });

  test('hp rośnie z `order` bossa TYLKO przez to że kampanijne hp też rośnie z order — nie osobną krzywą', () => {
    const wizard = BOSSES.find(b => b.id === 'wizard')!;
    const madSloth = madBossFor(sloth);
    const madWizard = madBossFor(wizard);
    expect(madWizard.hp).toBe(wizard.hp * MAD_HP_MULT);
    expect(madWizard.hp).toBeGreaterThan(madSloth.hp);
  });

  test('counterMult ustawiony na MAD_COUNTER_MULT (dodatkowy mnożnik kontrataku, user: "z większym o wiele atakiem")', () => {
    const mad = madBossFor(sloth);
    expect(mad.counterMult).toBe(MAD_COUNTER_MULT);
    expect(MAD_COUNTER_MULT).toBeGreaterThan(1);
  });

  test('id ma prefiks mad_, nie koliduje z bossem bazowym w defeatedBosses/bossLog', () => {
    expect(madBossId('sloth')).toBe('mad_sloth');
  });
});

// PRZEBUDOWANE NAGRODY (2026-08-22) — user: "mad bossy mają być nagrody z nich kontynuacja
// jak po ostatnim busie kampanii". Stary MAD_REWARD_MULT (×3 na WŁASNĄ nagrodę bazowego
// bossa) dawał absurdalnie mało dla wczesnych bossów kampanii mimo że ich MAD wersja jest
// teraz dużo trudniejsza niż finał kampanii. Nowy model: KAŻDY MAD boss startuje od nagrody
// OSTATNIEGO bossa kampanii (floor), rosnąc łagodnie (+15%/order MAD-a) — user wybrał to
// zamiast dosłownej kontynuacji krzywej kampanii (~1.48×/krok), która przy order22 dałaby
// ~88 mln monet za jedną walkę.
describe('madBosses — nagrody (start od finału kampanii, łagodny wzrost, 2026-08-22)', () => {
  const sloth = BOSSES.find(b => b.id === 'sloth')!; // order 1 — najsłabszy bazowy boss
  const finale = BOSSES[BOSSES.length - 1]; // Iluzja Kontroli, order 22

  test('MAD order 1 (Kanapowy Leniwiec) daje DOKŁADNIE tyle co finał kampanii, nie własną małą nagrodę', () => {
    const mad = madBossFor(sloth);
    expect(mad.coins).toBe(finale.coins);
    expect(mad.xp).toBe(finale.xp);
    expect(mad.coins).toBeGreaterThan(sloth.coins * 3); // dużo więcej niż stary ×3 na własnej, małej nagrodzie
  });

  test('nagroda rośnie z WŁASNYM order MAD-a, nie tylko z bazowego bossa', () => {
    const wizard = BOSSES.find(b => b.id === 'wizard')!; // order 22
    const madSloth = madBossFor(sloth);
    const madWizard = madBossFor(wizard);
    expect(madWizard.coins).toBeGreaterThan(madSloth.coins);
    expect(madWizard.coins).toBeGreaterThan(finale.coins); // ostatni MAD > sam finał kampanii
  });

  test('wzrost jest ŁAGODNY (liniowy), nie eksplozja wykładnicza jak reszta kampanii', () => {
    const wizard = BOSSES.find(b => b.id === 'wizard')!;
    const mad = madBossFor(wizard);
    // order22 = finale × (1 + 21×0.15) = finale × 4.15 — daleko od milionów
    expect(mad.coins).toBeLessThan(finale.coins * 5);
    expect(mad.coins).toBeGreaterThan(finale.coins * 4);
  });

  test('unlockLevel to FLAT MAD_UNLOCK_LEVEL, nie oryginalny unlockLevel bossa', () => {
    const mad = madBossFor(sloth);
    expect(mad.unlockLevel).toBe(MAD_UNLOCK_LEVEL);
    expect(mad.unlockLevel).not.toBe(sloth.unlockLevel);
  });

  test('guard/regenPct NIE są dziedziczone z oryginału (fix 2026-08-15, patrz komentarz)', () => {
    const sugar = BOSSES.find(b => b.id === 'sugar')!; // ma guard: true
    expect(sugar.guard).toBe(true);
    const mad = madBossFor(sugar);
    expect(mad.guard).toBeUndefined();
  });

  test('id/name/weakness pochodzą od bossa bazowego', () => {
    const mad = madBossFor(sloth);
    expect(mad.id).toBe('mad_sloth');
    expect(mad.weakness).toBe(sloth.weakness);
  });
});
