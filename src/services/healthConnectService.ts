// Health Connect bridge (Android only). Reads steps / sleep / weight that Samsung
// Health (or any app) writes into the on-device Health Connect store — no cloud,
// no API key. The native module only exists in a build that bundled
// react-native-health-connect, so everything is loaded lazily and degrades
// gracefully (the Zdrowie screen keeps working with manual entry without it).

let HC: any = null;
function mod(): any {
  if (HC) return HC;
  try { HC = require('react-native-health-connect'); } catch { HC = null; }
  return HC;
}

export function isHealthConnectAvailable(): boolean {
  return !!mod();
}

// Opens the Health Connect app/settings so the user can grant Sapp access by
// hand — a crash-proof fallback when the in-app permission request misbehaves.
export async function openHealthConnect(): Promise<boolean> {
  const hc = mod();
  if (!hc) return false;
  try {
    if (typeof hc.openHealthConnectSettings === 'function') { await hc.openHealthConnectSettings(); return true; }
    if (typeof hc.openHealthConnectDataManagement === 'function') { await hc.openHealthConnectDataManagement(); return true; }
    return false;
  } catch { return false; }
}

// Lightweight probe: returns the raw SDK status string (or an error label) so the
// UI can show exactly where things stand without ever throwing.
export async function probeHealthConnect(): Promise<string> {
  const hc = mod();
  if (!hc) return 'brak-modułu';
  try {
    const status = await hc.getSdkStatus();
    const A = hc.SdkAvailabilityStatus ?? {};
    if (status === A.SDK_AVAILABLE) return 'dostępne';
    if (status === A.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'wymaga-aktualizacji';
    return `niedostępne (${status})`;
  } catch (e: any) {
    return `błąd: ${e?.message ?? 'native'}`;
  }
}

const READ_PERMS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'Weight' },
] as const;

export type HCResult = { ok: boolean; reason?: 'no-module' | 'unavailable' | 'update' | 'init' | 'denied' | 'error' };

// Initialise + make sure we have read permission (prompts the user the first
// time). Gated on getSdkStatus() — the safe check that won't crash if Health
// Connect isn't reachable — so a bad state shows a message instead of a crash.
export async function ensureHealthConnect(): Promise<HCResult> {
  const hc = mod();
  if (!hc) return { ok: false, reason: 'no-module' };
  try {
    const status = await hc.getSdkStatus();
    const A = hc.SdkAvailabilityStatus ?? {};
    if (status === A.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return { ok: false, reason: 'update' };
    if (A.SDK_AVAILABLE != null && status !== A.SDK_AVAILABLE) return { ok: false, reason: 'unavailable' };

    const ok = await hc.initialize();
    if (!ok) return { ok: false, reason: 'init' };

    let granted: any[] = [];
    try { granted = await hc.getGrantedPermissions(); } catch { granted = []; }
    const have = new Set((granted ?? []).map((p: any) => p.recordType));
    const missing = READ_PERMS.filter(p => !have.has(p.recordType));
    if (missing.length) {
      const res = await hc.requestPermission(READ_PERMS as any);
      const arr = Array.isArray(res) ? res : [];
      return { ok: arr.length > 0, reason: arr.length > 0 ? undefined : 'denied' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

function dayFilter(date: Date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  return { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() } as const;
}

async function read(hc: any, recordType: string, filter: any): Promise<any[]> {
  const res = await hc.readRecords(recordType, { timeRangeFilter: filter });
  return Array.isArray(res) ? res : (res?.records ?? []);
}

export interface HealthConnectDay {
  steps: number;
  sleepMinutes: number;
  weightKg: number | null;
}

// Read one day's steps + sleep + latest weight. Returns null if HC unavailable.
export async function readHealthDay(date: Date = new Date()): Promise<HealthConnectDay | null> {
  const hc = mod();
  if (!hc) return null;
  const filter = dayFilter(date);

  let steps = 0;
  try {
    const recs = await read(hc, 'Steps', filter);
    steps = recs.reduce((s, r) => s + (r.count ?? 0), 0);
  } catch {}

  let sleepMinutes = 0;
  try {
    const recs = await read(hc, 'SleepSession', filter);
    for (const r of recs) {
      const st = new Date(r.startTime).getTime();
      const en = new Date(r.endTime).getTime();
      if (en > st) sleepMinutes += Math.round((en - st) / 60000);
    }
  } catch {}

  let weightKg: number | null = null;
  try {
    let recs = await read(hc, 'Weight', filter);
    if (recs.length === 0) {
      // No weigh-in today → take the most recent from the last 30 days.
      const wide = { operator: 'between', startTime: new Date(date.getTime() - 30 * 864e5).toISOString(), endTime: filter.endTime };
      recs = await read(hc, 'Weight', wide);
    }
    if (recs.length) {
      const last = recs[recs.length - 1];
      const kg = last?.weight?.inKilograms ?? last?.weight?.value ?? null;
      weightKg = typeof kg === 'number' ? Math.round(kg * 10) / 10 : null;
    }
  } catch {}

  return { steps, sleepMinutes, weightKg };
}
