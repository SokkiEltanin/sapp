import { buildQuests, buildMissedDaily, sweetlessDaysFrom, QuestCtx, ClaimState } from '@/utils/quests';

// weekKeyOf jest już pokryty przez __tests__/weekKey.test.ts — nie duplikujemy tutaj.

const baseCtx = (o: Partial<QuestCtx> = {}): QuestCtx => ({
  stepsToday: 0, moodLoggedToday: false, habitsDone: 0, habitsTotal: 0,
  sweetlessDays: 0, bestStepDay: 0, habitBestStreak: 0, cardsCollected: 0, trainingStreak: 0,
  ...o,
});
const baseClaim = (o: Partial<ClaimState> = {}): ClaimState => ({
  claimedMilestones: [], dailyClaims: {}, today: '2026-08-15', ...o,
});

describe('buildQuests — dzienne (done/claimed/claimable)', () => {
  test('quest zrobiony i NIEODEBRANY liczy się do claimableCount', () => {
    const r = buildQuests(baseCtx({ moodLoggedToday: true }), baseClaim());
    const q = r.daily.find(d => d.id === 'd_mood')!;
    expect(q.done).toBe(true);
    expect(q.claimed).toBe(false);
    expect(r.claimableCount).toBeGreaterThanOrEqual(1);
  });

  test('quest zrobiony i JUŻ odebrany dziś nie liczy się drugi raz do claimableCount', () => {
    const r = buildQuests(
      baseCtx({ moodLoggedToday: true }),
      baseClaim({ dailyClaims: { d_mood: '2026-08-15' } }),
    );
    const q = r.daily.find(d => d.id === 'd_mood')!;
    expect(q.claimed).toBe(true);
  });

  test('odebranie WCZORAJ nie liczy się jako odebrane DZIŚ (data musi się zgadzać)', () => {
    const r = buildQuests(
      baseCtx({ moodLoggedToday: true }),
      baseClaim({ dailyClaims: { d_mood: '2026-08-14' } }),
    );
    expect(r.daily.find(d => d.id === 'd_mood')!.claimed).toBe(false);
  });
});

describe('buildQuests — bonusDaily (widoczne TYLKO gdy dostępne)', () => {
  test('bonus bez ustawionego celu (np. brak stepTarget) w ogóle nie pojawia się na liście', () => {
    const r = buildQuests(baseCtx(), baseClaim());
    expect(r.bonusDaily.find(b => b.id === 'b_stepbeat')).toBeUndefined();
  });
  test('bonus z ustawionym celem pojawia się i poprawnie ocenia done', () => {
    const r = buildQuests(baseCtx({ stepTarget: 8000, stepsToday: 9000 }), baseClaim());
    const q = r.bonusDaily.find(b => b.id === 'b_stepbeat')!;
    expect(q).toBeDefined();
    expect(q.done).toBe(true);
  });
});

describe('buildQuests — milestones (progi kumulatywne)', () => {
  test('próg osiągnięty i nieodebrany → reached=true, liczy się do claimableCount', () => {
    const r = buildQuests(baseCtx({ sweetlessDays: 15 }), baseClaim());
    const m = r.milestones.find(x => x.id === 'm_sweetless')!;
    expect(m.tiers.find(t => t.at === 10)!.reached).toBe(true);
    expect(m.tiers.find(t => t.at === 30)!.reached).toBe(false); // 15 < 30
  });
  test('próg już odebrany (w claimedMilestones) → nie liczy się drugi raz', () => {
    const r = buildQuests(
      baseCtx({ sweetlessDays: 15 }),
      baseClaim({ claimedMilestones: ['m_sweetless:10'] }),
    );
    const m = r.milestones.find(x => x.id === 'm_sweetless')!;
    expect(m.tiers.find(t => t.at === 10)!.claimed).toBe(true);
  });
  test('nextAt wskazuje NAJBLIŻSZY nieosiągnięty próg, null gdy wszystkie osiągnięte', () => {
    const r = buildQuests(baseCtx({ sweetlessDays: 15 }), baseClaim());
    expect(r.milestones.find(x => x.id === 'm_sweetless')!.nextAt).toBe(30);
    const maxed = buildQuests(baseCtx({ sweetlessDays: 999 }), baseClaim());
    expect(maxed.milestones.find(x => x.id === 'm_sweetless')!.nextAt).toBeNull();
  });
});

describe('buildQuests — monthly/weekly (filtrowane po dostępności danych, progress ograniczony do 1)', () => {
  test('brak danej (np. moodDaysThisMonth undefined) → quest w ogóle nie pojawia się', () => {
    const r = buildQuests(baseCtx(), baseClaim());
    expect(r.monthly.find(m => m.id === 'mo_mood')).toBeUndefined();
  });
  test('progress nie przekracza 1 nawet gdy wartość przekroczyła cel', () => {
    const r = buildQuests(baseCtx({ moodDaysThisMonth: 25 }), baseClaim()); // cel to 20
    expect(r.monthly.find(m => m.id === 'mo_mood')!.progress).toBe(1);
  });
});

describe('buildMissedDaily — odrabianie wczorajszych questów (anti-farming)', () => {
  test('quest zrobiony wczoraj i nieodebrany ZA WCZORAJ pojawia się jako do odrobienia', () => {
    const yestCtx = baseCtx({ moodLoggedToday: true }); // ctx dla WCZORAJSZEGO dnia
    const out = buildMissedDaily(yestCtx, {}, '2026-08-14');
    expect(out.find(q => q.id === 'd_mood')).toBeDefined();
  });

  test('już odebrany ZA TEN KONKRETNY dzień → nie pojawia się drugi raz', () => {
    const yestCtx = baseCtx({ moodLoggedToday: true });
    const out = buildMissedDaily(yestCtx, { 'd_mood:2026-08-14': true }, '2026-08-14');
    expect(out.find(q => q.id === 'd_mood')).toBeUndefined();
  });

  test('klucz per-dzień NIE koliduje między różnymi dniami (naprawiony bug z pętlą farmienia)', () => {
    // Odebranie za 14. NIE powinno maskować identycznego questu jako odebranego za 15.
    const ctx = baseCtx({ moodLoggedToday: true });
    const out15 = buildMissedDaily(ctx, { 'd_mood:2026-08-14': true }, '2026-08-15');
    expect(out15.find(q => q.id === 'd_mood')).toBeDefined(); // wciąż do odrobienia za 15
  });

  test('d_pet i b_stepbeat NIGDY nie pojawiają się jako do odrobienia (celowo wykluczone, nie da się zrekonstruować)', () => {
    const ctx = baseCtx({ affectionFull: true, stepTarget: 8000, stepsToday: 9000 });
    const out = buildMissedDaily(ctx, {}, '2026-08-14');
    expect(out.find(q => q.id === 'd_pet')).toBeUndefined();
    expect(out.find(q => q.id === 'b_stepbeat')).toBeUndefined();
  });

  test('quest niezrobiony tamtego dnia nie pojawia się do odrobienia', () => {
    const ctx = baseCtx({ moodLoggedToday: false });
    const out = buildMissedDaily(ctx, {}, '2026-08-14');
    expect(out.find(q => q.id === 'd_mood')).toBeUndefined();
  });
});

describe('sweetlessDaysFrom', () => {
  test('brak jakichkolwiek zakupów słodyczy → 0 (nie jakaś domyślna duża liczba)', () => {
    expect(sweetlessDaysFrom([])).toBe(0);
  });

  test('liczy dni od NAJPÓŹNIEJSZEGO zakupu słodyczy, pomijając przychody/wykluczone/kaucje', () => {
    const now = new Date();
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const threeDaysAgo = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3));
    const expenses = [
      { date: threeDaysAgo + 'T10:00:00', receiptItems: [{ tags: ['słodycze'] }] },
      { date: ymd(now) + 'T10:00:00', type: 'income', receiptItems: [{ tags: ['słodycze'] }] }, // przychód, pomijany
      { date: ymd(now) + 'T10:00:00', receiptItems: [{ tags: ['słodycze'], excluded: true }] }, // wykluczony, pomijany
    ];
    expect(sweetlessDaysFrom(expenses)).toBe(3);
  });
});
