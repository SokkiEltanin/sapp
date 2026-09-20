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

// PRZEBUDOWANE DRUGI RAZ (2026-09-20) — user po realnym eksporcie postępu pupila: "ilość XP i
// coinów za bossy jest popierdolone... z dnia na dzień wbiłem z 51 lvl na 270". Poprzedni
// model (floor = 100% finału OD order1) potwierdzony w logu jako przyczyna: MAD order1 dawał
// 1:1 tyle co pokonanie finału kampanii. Nowy model: order1 = własna nagroda bossa × mnożnik
// trudności (maleje z orderem), order22 (=finał) = dokładnie nagroda finału, bez skoku.
describe('madBosses — nagrody (interpolacja własna→finał z malejącym mnożnikiem trudności, 2026-09-20)', () => {
  const sloth = BOSSES.find(b => b.id === 'sloth')!; // order 1 — najsłabszy bazowy boss
  const finale = BOSSES[BOSSES.length - 1]; // Iluzja Kontroli, order 22

  test('MAD order 1 (Kanapowy Leniwiec) daje WYRAŹNIE mniej niż finał kampanii, ale wyraźnie więcej niż własna nagroda', () => {
    const mad = madBossFor(sloth);
    expect(mad.coins).toBeLessThan(finale.coins);
    expect(mad.xp).toBeLessThan(finale.xp);
    // mnożnik trudności (REWARD_BOOST_AT_ORDER_1=20) — MAD ma stałe 10× hp/3× kontratak
    // niezależnie od poziomu trudności bazowego bossa, więc nawet order1 potrzebuje wyraźnie
    // więcej niż goła własna nagroda (8 monet/60 XP), inaczej opłaca się mniej niż quest.
    expect(mad.coins).toBeGreaterThan(sloth.coins * 15);
    expect(mad.xp).toBeGreaterThan(sloth.xp * 15);
  });

  test('MAD ostatniego bossa kampanii (order22 = sam finał) daje DOKŁADNIE tyle co finał — bez skoku na granicy', () => {
    const wizard = BOSSES.find(b => b.id === 'wizard')!; // order 22 = Iluzja Kontroli = finale
    const mad = madBossFor(wizard);
    expect(mad.coins).toBe(finale.coins);
    expect(mad.xp).toBe(finale.xp);
  });

  test('nagroda rośnie ściśle MONOTONICZNIE z order MAD-a, przez WSZYSTKIE 22 kroki — bez dołka w środku', () => {
    // To jest WŁAŚNIE właściwość, którą złamała pierwsza, naiwna wersja fixu (malejący
    // mnożnik × własna nagroda mógł PRZEKROCZYĆ finał w środku skali dla orderów ~15-21,
    // co w interpolacji dawało krzywą która rosła POWYŻEJ finału, a potem SPADAŁA z powrotem
    // do finału na order22 — późniejszy, trudniejszy MAD dawałby wtedy MNIEJ niż wcześniejszy).
    // Sprawdzone throwaway-symulacją w Node na wszystkich 22 orderach przed wyborem capu
    // (REWARD_ANCHOR_CAP_OF_FINALE) — ten test pilnuje że nikt tego capu nie usunie bez
    // ponownej weryfikacji.
    let prevCoins = -Infinity, prevXp = -Infinity;
    for (const b of BOSSES) {
      const mad = madBossFor(b);
      expect(mad.coins).toBeGreaterThanOrEqual(prevCoins);
      expect(mad.xp).toBeGreaterThanOrEqual(prevXp);
      prevCoins = mad.coins;
      prevXp = mad.xp;
    }
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
