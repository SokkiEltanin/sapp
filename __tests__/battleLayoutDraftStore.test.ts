import { useBattleLayoutDraft, BATTLE_LAYOUT_DEFAULT, BG_EXTRA_DEFAULT } from '@/store/battleLayoutDraftStore';

// 2026-10-10, user: "dawaj edytor lepszy pod każdego bosa możesz dać inny i pod kazde tlo
// inny... i opcje cofnij" — store przeszedł z JEDNEGO globalnego draftu na bazowy `draft` +
// `perBoss` (pozycja/rozmiar/cień/odbicie per boss.id) + `perBg` (jasność per tło) + stos
// `history` pod "Cofnij". Testowane bezpośrednio na store (ten sam wzorzec co
// streakFreezeStore.test.ts) — AsyncStorage zmockowane globalnie w jest.setup.js.
beforeEach(() => {
  useBattleLayoutDraft.setState({ draft: BATTLE_LAYOUT_DEFAULT, perBoss: {}, perBg: {}, history: [] });
});

describe('battleLayoutDraftStore — set() per boss, nie globalnie', () => {
  test('set() zapisuje TYLKO do perBoss[bossId], nie rusza bazowego draftu', () => {
    useBattleLayoutDraft.getState().set('boss_a', { catSize: 300 });
    const s = useBattleLayoutDraft.getState();
    expect(s.perBoss['boss_a']).toEqual({ catSize: 300 });
    expect(s.draft).toEqual(BATTLE_LAYOUT_DEFAULT);
  });

  test('dwa różne bossy mają NIEZALEŻNE, nie nadpisujące się nawzajem wartości', () => {
    useBattleLayoutDraft.getState().set('boss_a', { catSize: 300 });
    useBattleLayoutDraft.getState().set('boss_b', { bossSize: 50 });
    const s = useBattleLayoutDraft.getState();
    expect(s.perBoss['boss_a']).toEqual({ catSize: 300 });
    expect(s.perBoss['boss_b']).toEqual({ bossSize: 50 });
  });

  test('kolejne set() na TYM SAMYM bossie mergują się (nie nadpisują całości)', () => {
    useBattleLayoutDraft.getState().set('boss_a', { catSize: 300 });
    useBattleLayoutDraft.getState().set('boss_a', { bossSize: 80 });
    expect(useBattleLayoutDraft.getState().perBoss['boss_a']).toEqual({ catSize: 300, bossSize: 80 });
  });

  test('resetBoss() usuwa TYLKO override jednego bossa, zostawia resztę', () => {
    useBattleLayoutDraft.getState().set('boss_a', { catSize: 300 });
    useBattleLayoutDraft.getState().set('boss_b', { bossSize: 50 });
    useBattleLayoutDraft.getState().resetBoss('boss_a');
    const s = useBattleLayoutDraft.getState();
    expect(s.perBoss['boss_a']).toBeUndefined();
    expect(s.perBoss['boss_b']).toEqual({ bossSize: 50 });
  });
});

describe('battleLayoutDraftStore — setBg/setBgExtra per tło', () => {
  test('setBg() zmienia bazowy draft.bg (wspólny — "które tło jest oglądane")', () => {
    useBattleLayoutDraft.getState().setBg('lodowa');
    expect(useBattleLayoutDraft.getState().draft.bg).toBe('lodowa');
  });

  test('setBgExtra() zapisuje jasność NIEZALEŻNIE per tło', () => {
    useBattleLayoutDraft.getState().setBgExtra('lodowa', { darken: 0.4 });
    useBattleLayoutDraft.getState().setBgExtra('jungla', { darken: 0.1 });
    const s = useBattleLayoutDraft.getState();
    expect(s.perBg['lodowa']).toEqual({ darken: 0.4 });
    expect(s.perBg['jungla']).toEqual({ darken: 0.1 });
  });

  test('tło bez własnego wpisu efektywnie czyta się jako BG_EXTRA_DEFAULT (darken: 0)', () => {
    expect(useBattleLayoutDraft.getState().perBg['gorskislas']).toBeUndefined();
    expect(BG_EXTRA_DEFAULT.darken).toBe(0);
  });
});

describe('battleLayoutDraftStore — Cofnij (undo/history)', () => {
  test('set() sam z siebie NIE dopisuje do historii — trzeba jawnie pushUndoSnapshot()', () => {
    useBattleLayoutDraft.getState().set('boss_a', { catSize: 300 });
    expect(useBattleLayoutDraft.getState().history.length).toBe(0);
  });

  test('pushUndoSnapshot() dopisuje DOKŁADNIE jeden snapshot, nie rusza perBoss/perBg', () => {
    useBattleLayoutDraft.getState().pushUndoSnapshot();
    const s = useBattleLayoutDraft.getState();
    expect(s.history.length).toBe(1);
    expect(s.perBoss).toEqual({});
  });

  test('setBgExtra() sam pcha dokładnie jeden snapshot na wywołanie (bez osobnego flagowania)', () => {
    useBattleLayoutDraft.getState().setBgExtra('lodowa', { darken: 0.4 });
    expect(useBattleLayoutDraft.getState().history.length).toBe(1);
  });

  test('undo() przywraca stan SPRZED ostatniej zmiany i zdejmuje wpis ze stosu', () => {
    // Snapshot "sprzed" pchany jawnie (tak jak robi to Stepper's onCommit/Draggable's onGrab
    // w UI) PRZED realną zmianą — przywraca więc stan BEZ catSize:300, nie jakiś pośredni stan.
    useBattleLayoutDraft.getState().pushUndoSnapshot();
    useBattleLayoutDraft.getState().set('boss_a', { catSize: 300 });
    expect(useBattleLayoutDraft.getState().perBoss['boss_a']).toEqual({ catSize: 300 });

    useBattleLayoutDraft.getState().undo();
    const s = useBattleLayoutDraft.getState();
    expect(s.perBoss['boss_a']).toBeUndefined();
    expect(s.history.length).toBe(0);
  });

  test('undo() na pustej historii nic nie robi (nie rzuca, nie psuje stanu)', () => {
    useBattleLayoutDraft.getState().set('boss_a', { catSize: 300 });
    expect(() => useBattleLayoutDraft.getState().undo()).not.toThrow();
    expect(useBattleLayoutDraft.getState().perBoss['boss_a']).toEqual({ catSize: 300 });
  });

  test('wielokrotne undo() cofa wiele kroków po kolei (LIFO)', () => {
    useBattleLayoutDraft.getState().pushUndoSnapshot();
    useBattleLayoutDraft.getState().set('boss_a', { catSize: 300 });
    useBattleLayoutDraft.getState().pushUndoSnapshot();
    useBattleLayoutDraft.getState().set('boss_a', { catSize: 999 });
    expect(useBattleLayoutDraft.getState().perBoss['boss_a']).toEqual({ catSize: 999 });

    useBattleLayoutDraft.getState().undo();
    expect(useBattleLayoutDraft.getState().perBoss['boss_a']).toEqual({ catSize: 300 });
    useBattleLayoutDraft.getState().undo();
    expect(useBattleLayoutDraft.getState().perBoss['boss_a']).toBeUndefined();
  });

  test('pushUndoSnapshot() przy dotknięciu bez realnej zmiany NIE tworzy pustego wpisu perBoss (regresja na stary bug)', () => {
    // 2026-10-10: `set(bossId, {}, true)` jako "push undo" robiło TO SAMO co tap-bez-ruchu na
    // przeciąganym sprite — tworzyło perBoss[bossId]={} jako SKUTEK UBOCZNY samego pchnięcia
    // historii, fałszywie znacząc bossa jako "ma własny układ" mimo braku realnej zmiany.
    useBattleLayoutDraft.getState().pushUndoSnapshot();
    expect(useBattleLayoutDraft.getState().perBoss['boss_a']).toBeUndefined();
  });
});

describe('battleLayoutDraftStore — reset()', () => {
  test('reset() czyści bazowy draft ORAZ wszystkie perBoss/perBg naraz', () => {
    useBattleLayoutDraft.getState().set('boss_a', { catSize: 300 });
    useBattleLayoutDraft.getState().setBgExtra('lodowa', { darken: 0.5 });
    useBattleLayoutDraft.getState().setBg('jungla');

    useBattleLayoutDraft.getState().reset();
    const s = useBattleLayoutDraft.getState();
    expect(s.draft).toEqual(BATTLE_LAYOUT_DEFAULT);
    expect(s.perBoss).toEqual({});
    expect(s.perBg).toEqual({});
  });
});
