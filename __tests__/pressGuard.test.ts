import { createPressGuard } from '@/utils/pressGuard';

// Zabezpieczenie przed podwójnym tapnięciem (§375). `Date.now()` zmockowane, żeby testy były
// deterministyczne (bez prawdziwego czekania).
describe('createPressGuard', () => {
  const realNow = Date.now;
  afterEach(() => { Date.now = realNow; });

  test('pierwsze wywołanie zawsze dozwolone', () => {
    const guard = createPressGuard(600);
    expect(guard.allow()).toBe(true);
  });

  test('drugie wywołanie TUŻ PO pierwszym (w oknie) jest zablokowane', () => {
    let t = 1000;
    Date.now = () => t;
    const guard = createPressGuard(600);
    expect(guard.allow()).toBe(true);
    t += 100; // 100ms później — wciąż w 600ms oknie
    expect(guard.allow()).toBe(false);
  });

  test('wywołanie PO upłynięciu okna jest znów dozwolone', () => {
    let t = 1000;
    Date.now = () => t;
    const guard = createPressGuard(600);
    expect(guard.allow()).toBe(true);
    t += 601; // tuż ZA oknem
    expect(guard.allow()).toBe(true);
  });

  test('wywołanie DOKŁADNIE na granicy okna jest już dozwolone (< nie <=)', () => {
    let t = 1000;
    Date.now = () => t;
    const guard = createPressGuard(600);
    expect(guard.allow()).toBe(true);
    t += 600;
    expect(guard.allow()).toBe(true);
  });

  test('zablokowane wywołanie NIE resetuje okna — kolejna próba liczy się od OSTATNIEGO dozwolonego', () => {
    let t = 1000;
    Date.now = () => t;
    const guard = createPressGuard(600);
    expect(guard.allow()).toBe(true); // t=1000, dozwolone
    t += 100; // t=1100
    expect(guard.allow()).toBe(false); // zablokowane, "last" zostaje 1000
    t += 450; // t=1550, 550ms od ostatniego DOZWOLONEGO (1000) — wciąż w oknie
    expect(guard.allow()).toBe(false);
    t += 60; // t=1610, 610ms od 1000 — poza oknem
    expect(guard.allow()).toBe(true);
  });

  test('dwa niezależne guardy nie dzielą stanu', () => {
    const a = createPressGuard(600);
    const b = createPressGuard(600);
    expect(a.allow()).toBe(true);
    expect(b.allow()).toBe(true); // b nie jest zablokowany przez a
  });

  test('domyślne okno to 600ms', () => {
    let t = 1000;
    Date.now = () => t;
    const guard = createPressGuard();
    expect(guard.allow()).toBe(true);
    t += 599;
    expect(guard.allow()).toBe(false);
  });
});
