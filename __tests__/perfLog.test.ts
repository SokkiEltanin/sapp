import AsyncStorage from '@react-native-async-storage/async-storage';
import { markDashboardFirstFrame, recordDashboardReady, getPerfLog, clearPerfLog } from '@/utils/perfLog';

// 2026-08-25 (perf pass): "poor man's" cold-start profiler — no remote on-device profiler
// here, so this logs real msToFirstFrame/msToReady numbers on the user's own phone, readable
// via Ustawienia → Diagnostyka. `recordDashboardReady` is a plain, always-appends function —
// the "only once per cold start" policy lives at the CALL SITE (index.tsx's module-level
// `dashboardPerfLogged` flag), not here, precisely so this stays trivial to test: no hidden
// one-shot state that only a fresh module load could reset.

beforeEach(async () => { await AsyncStorage.clear(); });

describe('perfLog — cold-start timing log', () => {
  test('brak wpisów na starcie', async () => {
    expect(await getPerfLog()).toEqual([]);
  });

  test('recordDashboardReady zapisuje jeden wpis z nieujemnymi czasami', async () => {
    markDashboardFirstFrame();
    await recordDashboardReady();
    const log = await getPerfLog();
    expect(log.length).toBe(1);
    expect(log[0].msToFirstFrame).toBeGreaterThanOrEqual(0);
    expect(log[0].msToReady).toBeGreaterThanOrEqual(0);
    expect(typeof log[0].at).toBe('string');
  });

  test('kolejne wywołania dopisują kolejne wpisy (one-shot pilnowany PRZEZ WOŁAJĄCEGO, nie tutaj)', async () => {
    await recordDashboardReady();
    await recordDashboardReady();
    await recordDashboardReady();
    expect((await getPerfLog()).length).toBe(3);
  });

  test('bufor trzyma maksimum 20 wpisów, najstarsze wypadają first-in-first-out', async () => {
    for (let i = 0; i < 25; i++) await recordDashboardReady();
    const log = await getPerfLog();
    expect(log.length).toBe(20);
  });

  test('clearPerfLog czyści historię', async () => {
    await recordDashboardReady();
    expect((await getPerfLog()).length).toBe(1);
    await clearPerfLog();
    expect(await getPerfLog()).toEqual([]);
  });

  test('zepsuty JSON w AsyncStorage → getPerfLog zwraca pustą listę zamiast rzucać', async () => {
    await AsyncStorage.setItem('perf_dashboard_log_v1', '{not json');
    expect(await getPerfLog()).toEqual([]);
  });
});
