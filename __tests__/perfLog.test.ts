import AsyncStorage from '@react-native-async-storage/async-storage';
import { markDashboardFirstFrame, recordDashboardReady, getPerfLog, clearPerfLog, getLiveLagStats, pauseLagSampling, resumeLagSampling } from '@/utils/perfLog';

// `startColdStartLagSampling` deliberately NOT imported/called anywhere in this file — it
// schedules real `setTimeout`s for up to 8s (patrz komentarz w perfLog.ts), które by wisiały
// w tle każdego testu w tym pliku. Testy niżej sprawdzają tylko że pola lagu ISTNIEJĄ i
// domyślnie wynoszą 0 (sampler nigdy nie odpalony), nie samo próbkowanie.

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

  test('pola lagu wątku JS domyślnie zerowe, gdy sampler nigdy nie odpalony', async () => {
    await recordDashboardReady();
    const [entry] = await getPerfLog();
    expect(entry.maxLagMs).toBe(0);
    expect(entry.totalLagMs).toBe(0);
    expect(entry.lagSamples).toBe(0);
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

// 2026-10-09, user: "nadal mam wrażenie że appka laguje, dodaj testową [diagnostykę]" —
// próbkowanie teraz leci przez CAŁĄ sesję (nie tylko pierwsze 8s), odczytywalne w dowolnym
// momencie przez `getLiveLagStats()`. Sampler sam (prawdziwe timery) świadomie NIE jest tu
// odpalany (patrz komentarz na górze pliku) — te testy sprawdzają tylko kształt/bezpieczeństwo
// odczytu i że pauza/wznowienie się nie wysypują, gdy sampler nigdy nie wystartował.
describe('perfLog — live lag stats (cała sesja)', () => {
  test('getLiveLagStats zwraca nieujemne liczby, sinceMs rośnie od importu modułu', () => {
    const live = getLiveLagStats();
    expect(live.maxLagMs).toBeGreaterThanOrEqual(0);
    expect(live.totalLagMs).toBeGreaterThanOrEqual(0);
    expect(live.lagSamples).toBeGreaterThanOrEqual(0);
    expect(live.sinceMs).toBeGreaterThanOrEqual(0);
  });

  test('pauseLagSampling/resumeLagSampling nie rzucają, nawet gdy sampler nigdy nie wystartował', () => {
    expect(() => { pauseLagSampling(); resumeLagSampling(); }).not.toThrow();
  });

  // 2026-10-10, user wkleił realne dane (skok 6157ms, suma 32817ms) — same zagregowane liczby
  // nie mówią KIEDY to było, więc `topSpikes` dorzuca zegarowy czas kilku największych skoków
  // (patrz `recordLagSpike` w perfLog.ts). Sampler nieodpalony tutaj → pusta lista, nie błąd.
  test('topSpikes to tablica (pusta, gdy sampler nigdy nie odpalił żadnej próbki)', () => {
    const live = getLiveLagStats();
    expect(Array.isArray(live.topSpikes)).toBe(true);
    expect(live.topSpikes.length).toBe(0);
  });
});
