import { payMonthsSummary, computePayMonthsForEmployers, employerPayMonthsSummary, shiftsForEmployerInMonth } from '@/utils/workSummary';
import { Employer, Expense, CalendarEvent } from '@/types';

const row = (o: any) => ({ month: '2026-08', amount: 0, hours: 0, excluded: false, date: '2026-08-01', count: 1, ...o });

describe('workSummary — payMonthsSummary', () => {
  test('średnia stawka = Σ pensji ÷ Σ godzin (tylko included z godzinami)', () => {
    const r = payMonthsSummary([
      row({ month: '2026-08', amount: 4000, hours: 160 }),
      row({ month: '2026-07', amount: 3000, hours: 120 }),
    ]);
    expect(r.totalEarned).toBe(7000);
    expect(r.includedCount).toBe(2);
    expect(r.avgRate).toBeCloseTo(7000 / 280); // 25 zł/h
  });

  test('wykluczony miesiąc liczy się do sumy, ale NIE do stawki', () => {
    const r = payMonthsSummary([
      row({ month: '2026-08', amount: 4000, hours: 160 }),
      row({ month: '2026-07', amount: 9999, hours: 100, excluded: true }),
    ]);
    expect(r.totalEarned).toBe(13999);
    expect(r.includedCount).toBe(1);
    expect(r.avgRate).toBeCloseTo(4000 / 160);
  });

  test('brak godzin kalendarza → avgRate null (nie dzieli przez 0) — zamraża naprawiony bug', () => {
    const r = payMonthsSummary([row({ month: '2026-08', amount: 4000, hours: 0 })]);
    expect(r.avgRate).toBeNull();
    expect(r.totalEarned).toBe(4000);
    expect(r.includedCount).toBe(0);
  });

  test('puste → null/0', () => {
    expect(payMonthsSummary([])).toEqual({ avgRate: null, includedCount: 0, totalEarned: 0 });
  });
});

// 2026-09-10 (user: "żeby dało się zmienić prefiks... i działał jak zmienię pracę" + "wyłączyć
// stare żeby one były ale widzieć tylko z nowej pracy") — `Employer`/`computePayMonthsForEmployers`
// generalizują dokładnie te same `computePayMonths`/`payMonthsSummary` (bez zmian w ich wnętrzu)
// na wielu pracodawców naraz, każdy ze SWOIM prefiksem.
describe('workSummary — computePayMonthsForEmployers / employerPayMonthsSummary', () => {
  const emp = (o: Partial<Employer>): Employer => ({
    id: 'emp-x', name: 'Praca', createdAt: 0, monthlySalary: 5000, hoursPerMonth: 168, ...o,
  });
  const income = (o: Partial<Expense>): Expense => ({
    id: `e-${Math.random()}`, type: 'income', amount: 0, currency: 'PLN', category: 'salary',
    tags: [], note: '', date: '2026-01-01', createdAt: '', updatedAt: '', ...o,
  } as Expense);
  const shift = (o: Partial<CalendarEvent>): CalendarEvent => ({
    id: `c-${Math.random()}`, title: '', date: '2026-01-01', allDay: false, priority: 'normal', createdAt: '', ...o,
  } as CalendarEvent);

  test('każdy pracodawca liczony PRZEZ SWÓJ prefiks, wiersze otagowane employerId/employerName', () => {
    const empA = emp({ id: 'a', name: 'Stara firma', workPrefix: '[JD]' });
    const empB = emp({ id: 'b', name: 'Nowa firma', workPrefix: '[NOWA]' });
    const expenses = [
      income({ amount: 3000, tags: ['[jd]'], date: '2026-09-05' }),   // → target 2026-08 (zaliczka wstecz)
      income({ amount: 4000, tags: ['[nowa]'], date: '2026-10-05' }), // → target 2026-09
    ];
    const events = [
      shift({ title: '[JD] 08:00 - 16:00', date: '2026-08-10' }),   // 8h dla empA w sierpniu
      shift({ title: '[NOWA] 08:00 - 16:00', date: '2026-09-15' }), // 8h dla empB we wrześniu
    ];
    const rows = computePayMonthsForEmployers(expenses, events, [empA, empB]);
    expect(rows).toHaveLength(2);
    const aRow = rows.find(r => r.employerId === 'a')!;
    const bRow = rows.find(r => r.employerId === 'b')!;
    expect(aRow.employerName).toBe('Stara firma');
    expect(aRow.month).toBe('2026-08');
    expect(aRow.hours).toBe(8);
    expect(bRow.employerName).toBe('Nowa firma');
    expect(bRow.month).toBe('2026-09');
    expect(bRow.hours).toBe(8);
    // posortowane malejąco po miesiącu — nowszy (empB, 2026-09) pierwszy
    expect(rows[0].employerId).toBe('b');
  });

  test('ukryty (hidden) pracodawca WYŁĄCZONY z domyślnej sumy, ale wiersz zostaje w danych', () => {
    const empA = emp({ id: 'a', name: 'Aktywna', workPrefix: '[JD]' });
    const empB = emp({ id: 'b', name: 'Schowana', workPrefix: '[NOWA]', hidden: true });
    const expenses = [
      income({ amount: 3000, tags: ['[jd]'], date: '2026-09-05' }),
      income({ amount: 4000, tags: ['[nowa]'], date: '2026-09-05' }),
    ];
    const events = [
      shift({ title: '[JD] 08:00 - 16:00', date: '2026-08-10' }),
      shift({ title: '[NOWA] 08:00 - 16:00', date: '2026-08-10' }),
    ];
    const rows = computePayMonthsForEmployers(expenses, events, [empA, empB]);
    expect(rows).toHaveLength(2); // dane obu zostają — hidden nie usuwa nic

    const visibleOnly = employerPayMonthsSummary(rows);
    expect(visibleOnly.totalEarned).toBe(3000); // tylko empA

    const withHidden = employerPayMonthsSummary(rows, { includeHidden: true });
    expect(withHidden.totalEarned).toBe(7000); // oba, na żądanie
  });
});

// 2026-09-10 (ekran "Historia pracy" — mini-kalendarz dni roboczych, user: "sprawdzić czy
// dobrze złapało dni jak pracowałem, taki mini kalendarz").
describe('workSummary — shiftsForEmployerInMonth', () => {
  const shift = (o: Partial<CalendarEvent>): CalendarEvent => ({
    id: `c-${Math.random()}`, title: '', date: '2026-01-01', allDay: false, priority: 'normal', createdAt: '', ...o,
  } as CalendarEvent);

  test('zwraca tylko zmiany TEGO pracodawcy (prefiks) w PODANYM miesiącu, posortowane', () => {
    const events = [
      shift({ title: '[JD] 08:00 - 16:00', date: '2026-08-10' }),
      shift({ title: '[JD] 09:00 - 17:00', date: '2026-08-03' }),  // wcześniej w miesiącu → pierwsza po sortowaniu
      shift({ title: '[JD] 08:00 - 16:00', date: '2026-09-01' }),  // inny miesiąc → wykluczona
      shift({ title: '[NOWA] 08:00 - 16:00', date: '2026-08-10' }), // inny prefiks → wykluczona
    ];
    const rows = shiftsForEmployerInMonth(events, { workPrefix: '[JD]' }, '2026-08');
    expect(rows).toHaveLength(2);
    expect(rows[0].date).toBe('2026-08-03');
    expect(rows[1].date).toBe('2026-08-10');
    expect(rows[0].hours).toBe(8);
  });

  test('pracodawca bez prefiksu/koloru → pusta lista (nic by fałszywie nie dopasowało)', () => {
    const events = [shift({ title: '[JD] 08:00 - 16:00', date: '2026-08-10' })];
    expect(shiftsForEmployerInMonth(events, {}, '2026-08')).toEqual([]);
  });
});
