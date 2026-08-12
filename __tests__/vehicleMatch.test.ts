import {
  looksLikeFuel, expenseMatchesVehicle, mainCarId, summarizeVehicle,
  maintenanceDueMonths, maintenancePresets,
} from '@/utils/vehicleMatch';
import { Expense, Vehicle, VehicleMaintenance } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'transport', tags: [], note: '',
  date: '2026-08-04T10:00:00', createdAt: '', updatedAt: '', ...o,
} as Expense);
const v = (o: Partial<Vehicle>): Vehicle => ({
  id: 'v1', name: 'Auto', kind: 'car', createdAt: '', updatedAt: '', ...o,
} as Vehicle);

describe('vehicleMatch — looksLikeFuel', () => {
  test('rozpoznaje po tagu (case-insensitive)', () => {
    expect(looksLikeFuel(e({ tags: ['Paliwo'] }))).toBe(true);
  });
  test('rozpoznaje stację paliw po nazwie sklepu/notatce', () => {
    expect(looksLikeFuel(e({ storeName: 'Orlen Rzeszów' }))).toBe(true);
    expect(looksLikeFuel(e({ note: 'tankowanie przed trasą' }))).toBe(true);
  });
  test('zwykły wydatek transportowy (np. bilet MPK) to NIE paliwo', () => {
    expect(looksLikeFuel(e({ storeName: 'MPK Rzeszów', note: 'bilet miesięczny' }))).toBe(false);
  });
  test('"bp" jako CAŁE słowo trafia, ale nie jako fragment innego słowa', () => {
    expect(looksLikeFuel(e({ storeName: 'BP Stacja' }))).toBe(true);
    expect(looksLikeFuel(e({ storeName: 'Sklep' }))).toBe(false); // nie zawiera "bp" jako słowa
  });
});

describe('vehicleMatch — expenseMatchesVehicle (kolejność priorytetów)', () => {
  test('przychód (income) nigdy nie pasuje, nawet z pasującym tagiem', () => {
    const car = v({ tag: 'auto' });
    expect(expenseMatchesVehicle(e({ type: 'income', tags: ['auto'] }), car)).toBe(false);
  });

  test('ręczne przypisanie (vehicleId) jest NADRZĘDNE i WYŁĄCZNE — wygrywa nawet nad pasującym tagiem', () => {
    const car = v({ id: 'v1', tag: 'auto' });
    const other = v({ id: 'v2', tag: 'rower' });
    // wydatek otagowany "auto" ALE ręcznie przypisany do v2 → NIE pasuje do v1 mimo tagu
    expect(expenseMatchesVehicle(e({ vehicleId: 'v2', tags: ['auto'] }), car)).toBe(false);
    expect(expenseMatchesVehicle(e({ vehicleId: 'v2', tags: ['auto'] }), other)).toBe(true);
  });

  test('dopasowanie po tagu wydatku', () => {
    const bike = v({ id: 'v1', kind: 'bike', tag: 'rower' });
    expect(expenseMatchesVehicle(e({ tags: ['rower'] }), bike)).toBe(true);
  });
  test('dopasowanie po tagu pozycji paragonu', () => {
    const bike = v({ id: 'v1', kind: 'bike', tag: 'rower' });
    expect(expenseMatchesVehicle(e({ receiptItems: [{ name: '', price: 0, category: 'other', quantity: 1, unitPrice: 0, tags: ['rower'] }] }), bike)).toBe(true);
  });
  test('dopasowanie po prefiksie #tag lub [T] w notatce', () => {
    const bike = v({ id: 'v1', kind: 'bike', tag: 'rower' });
    expect(expenseMatchesVehicle(e({ note: 'nowe opony #rower' }), bike)).toBe(true);
    expect(expenseMatchesVehicle(e({ note: '[R] łańcuch' }), bike)).toBe(true);
  });

  test('paliwo pasuje TYLKO do wyznaczonego głównego samochodu, nie do innych aut', () => {
    const mainCar = v({ id: 'main', kind: 'car', tag: '' });
    const otherCar = v({ id: 'other', kind: 'car', tag: '' });
    const fuelExp = e({ storeName: 'Orlen' });
    expect(expenseMatchesVehicle(fuelExp, mainCar, 'main')).toBe(true);
    expect(expenseMatchesVehicle(fuelExp, otherCar, 'main')).toBe(false);
  });
  test('paliwo NIE pasuje do roweru nawet jeśli byłby "głównym" (musi być kind=car)', () => {
    const bike = v({ id: 'main', kind: 'bike', tag: '' });
    expect(expenseMatchesVehicle(e({ storeName: 'Orlen' }), bike, 'main')).toBe(false);
  });
  test('bez tagu i bez dopasowania paliwa → false', () => {
    const car = v({ id: 'v1', tag: '' });
    expect(expenseMatchesVehicle(e({ storeName: 'Zupełnie inny sklep' }), car)).toBe(false);
  });
});

describe('vehicleMatch — mainCarId', () => {
  test('samochód oflagowany isMainCar wygrywa', () => {
    const vehicles = [v({ id: 'a', kind: 'car' }), v({ id: 'b', kind: 'car', isMainCar: true })];
    expect(mainCarId(vehicles)).toBe('b');
  });
  test('brak flagi, ale DOKŁADNIE jeden samochód → ten jest głównym', () => {
    const vehicles = [v({ id: 'a', kind: 'car' }), v({ id: 'bike1', kind: 'bike' })];
    expect(mainCarId(vehicles)).toBe('a');
  });
  test('kilka aut bez flagi → niejednoznaczne, undefined', () => {
    const vehicles = [v({ id: 'a', kind: 'car' }), v({ id: 'b', kind: 'car' })];
    expect(mainCarId(vehicles)).toBeUndefined();
  });
  test('brak żadnego auta → undefined', () => {
    expect(mainCarId([v({ id: 'a', kind: 'bike' })])).toBeUndefined();
  });
});

describe('vehicleMatch — summarizeVehicle', () => {
  test('sumuje paliwo/inne osobno, liczy tylko pasujące wydatki, sortuje najnowsze pierwsze', () => {
    const car = v({ id: 'v1', tag: '' });
    const exps = [
      e({ id: '1', vehicleId: 'v1', amount: 100, storeName: 'Orlen', date: '2026-01-01T00:00:00' }),
      e({ id: '2', vehicleId: 'v1', amount: 50, storeName: 'Warsztat', date: '2026-03-01T00:00:00' }),
      e({ id: '3', vehicleId: 'inny', amount: 999, date: '2026-02-01T00:00:00' }), // nie pasuje
    ];
    const s = summarizeVehicle(car, exps);
    expect(s.count).toBe(2);
    expect(s.total).toBe(150);
    expect(s.fuel).toBe(100);
    expect(s.other).toBe(50);
    expect(s.expenses.map(x => x.id)).toEqual(['2', '1']); // marzec przed styczniem
  });
});

describe('vehicleMatch — maintenanceDueMonths (Date.now() wewnętrznie, bez wstrzykiwania)', () => {
  const m = (o: Partial<VehicleMaintenance>): VehicleMaintenance => ({
    id: 'm1', vehicleId: 'v1', label: 'Serwis', date: '2026-01-01', createdAt: '', ...o,
  } as VehicleMaintenance);
  const isoToday = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  test('brak interwału → null', () => {
    expect(maintenanceDueMonths(m({ intervalMonths: undefined }))).toBeNull();
  });

  test('termin dziś + 1 miesiąc interwału → ok. +1 miesiąc do terminu (dodatnie)', () => {
    const today = isoToday(new Date());
    const result = maintenanceDueMonths(m({ date: today, intervalMonths: 1 }));
    expect(result).toBeGreaterThan(0.8);
    expect(result).toBeLessThan(1.2);
  });

  test('serwis 2 miesiące temu + interwał 1 miesiąc → przeterminowane ok. -1 miesiąc (ujemne)', () => {
    const now = new Date();
    const twoMoAgo = isoToday(new Date(now.getFullYear(), now.getMonth() - 2, now.getDate()));
    const result = maintenanceDueMonths(m({ date: twoMoAgo, intervalMonths: 1 }));
    expect(result).toBeLessThan(-0.8);
    expect(result).toBeGreaterThan(-1.2);
  });
});

describe('vehicleMatch — maintenancePresets', () => {
  test('rower ma presety specyficzne dla roweru (smarowanie łańcucha)', () => {
    expect(maintenancePresets('bike').map(p => p.label)).toContain('Smarowanie łańcucha');
  });
  test('samochód ma presety specyficzne dla auta (klocki hamulcowe)', () => {
    expect(maintenancePresets('car').map(p => p.label)).toContain('Klocki hamulcowe');
  });
  test('inny rodzaj pojazdu dostaje generyczny fallback', () => {
    expect(maintenancePresets('other').map(p => p.label)).toContain('Serwis');
  });
});
