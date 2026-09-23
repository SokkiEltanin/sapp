import { formatWaterDiagnostic, WaterProbe } from '@/services/healthConnectService';

// 2026-09-23, user #14: "możliwe że źle łapie wodę z zegarka... gdzie w ustawieniach
// dosłownie co łapie kiedy i ile ml, żebym potwierdził" — formatWaterDiagnostic() jest
// wydzielone z health.tsx (dawny jednorazowy inline blok) właśnie po to, żeby ten sam
// werdykt dało się pokazać z DWÓCH miejsc (Zdrowie i Ustawienia) bez duplikacji, i żeby
// dało się to w ogóle przetestować bez mockowania natywnego Health Connect.
const base = (over: Partial<WaterProbe> = {}): WaterProbe => ({
  permission: true, records: 0, totalMl: 0, sources: [], entries: [],
  nutriPermission: true, nutriRecords: 0, nutriSources: [], nutriKeys: [],
  ...over,
});

describe('formatWaterDiagnostic', () => {
  test('rekordy Hydration obecne → werdykt "JEST ✓" + lista wpisów kiedy/ile ml/źródło', () => {
    const p = base({
      records: 2, totalMl: 500, sources: ['com.sec.android.app.shealth'],
      entries: [
        { time: '2026-09-23T08:00:00.000Z', ml: 250, source: 'com.sec.android.app.shealth' },
        { time: '2026-09-23T12:00:00.000Z', ml: 250, source: 'com.sec.android.app.shealth' },
      ],
    });
    const out = formatWaterDiagnostic(p);
    expect(out).toContain('dostęp ✓');
    expect(out).toContain('2 rekordy');
    expect(out).toContain('0.50 l');
    expect(out).toContain('250 ml');
    expect(out).toContain('Wpisy z zegarka');
    expect(out).toContain('Woda JEST jako Hydration ✓');
  });

  test('brak Hydration, ale są rekordy Nutrition → werdykt podpowiada wysłanie pól', () => {
    const p = base({ records: 0, nutriRecords: 3, nutriKeys: ['hydration', 'name'] });
    const out = formatWaterDiagnostic(p);
    expect(out).toContain('Pola Nutrition: hydration, name');
    expect(out).toContain('Hydration puste, ale są rekordy Nutrition');
  });

  test('brak dostępu do obu typów → werdykt każe włączyć uprawnienia', () => {
    const p = base({ permission: false, nutriPermission: false });
    const out = formatWaterDiagnostic(p);
    expect(out).toContain('BRAK dostępu');
    expect(out).toContain('Brak dostępu do obu');
  });

  test('dostęp jest, ale zero rekordów wszędzie → werdykt mówi że Samsung nic nie eksportuje', () => {
    const p = base();
    const out = formatWaterDiagnostic(p);
    expect(out).toContain('Ani Hydration, ani Nutrition');
  });

  test('lista wpisów ucięta do 20 + licznik reszty', () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({
      time: `2026-09-${String(i + 1).padStart(2, '0')}T08:00:00.000Z`, ml: 200, source: 'watch',
    }));
    const p = base({ records: 25, entries });
    const out = formatWaterDiagnostic(p);
    expect(out).toContain('… i jeszcze 5');
  });
});
