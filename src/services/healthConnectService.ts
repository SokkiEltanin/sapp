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
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'OxygenSaturation' },
  { accessType: 'read', recordType: 'Vo2Max' },
] as const;

export type HCResult = { ok: boolean; reason?: 'no-module' | 'unavailable' | 'update' | 'init' | 'denied' | 'error' };

// Initialise + ensure read permission. requestPermission() launches Health
// Connect's permission screen (which also REGISTERS the app so it appears in HC's
// app list). The launcher only works because plugins/withHealthConnectQueries.js
// injects setPermissionDelegate(this) into MainActivity. If anything throws we
// report a reason and the UI falls back to opening HC settings.
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
    if (READ_PERMS.every(p => have.has(p.recordType))) return { ok: true };

    const res = await hc.requestPermission(READ_PERMS as any);
    const arr = Array.isArray(res) ? res : [];
    return arr.length > 0 ? { ok: true } : { ok: false, reason: 'denied' };
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
  heartRateAvg: number | null;     // bpm, day average
  restingHeartRate: number | null; // bpm
  distanceKm: number | null;       // km
  activeCalories: number | null;   // kcal
  totalCalories: number | null;    // kcal
  exerciseMinutes: number;         // sum of workout sessions
  oxygenPct: number | null;        // SpO2 %
  vo2max: number | null;
}

// Read one day of everything we support from Health Connect. Each metric is read
// independently and guarded, so a missing/denied type just stays null.
export async function readHealthDay(date: Date = new Date()): Promise<HealthConnectDay | null> {
  const hc = mod();
  if (!hc) return null;
  const filter = dayFilter(date);
  const r1 = (v: number | null) => (typeof v === 'number' ? Math.round(v * 10) / 10 : null);

  // Latest record of a type within the last `days` (for things logged sporadically).
  const latest = async (type: string, days: number): Promise<any | null> => {
    try {
      const wide = { operator: 'between', startTime: new Date(date.getTime() - days * 864e5).toISOString(), endTime: filter.endTime };
      const recs = await read(hc, type, wide);
      return recs.length ? recs[recs.length - 1] : null;
    } catch { return null; }
  };
  const sum = async (type: string, pick: (r: any) => number): Promise<number | null> => {
    try {
      const recs = await read(hc, type, filter);
      if (!recs.length) return null;
      return recs.reduce((s, r) => s + (pick(r) || 0), 0);
    } catch { return null; }
  };

  let steps = 0;
  try { steps = (await read(hc, 'Steps', filter)).reduce((s, r) => s + (r.count ?? 0), 0); } catch {}

  let sleepMinutes = 0;
  try {
    for (const r of await read(hc, 'SleepSession', filter)) {
      const st = new Date(r.startTime).getTime(), en = new Date(r.endTime).getTime();
      if (en > st) sleepMinutes += Math.round((en - st) / 60000);
    }
  } catch {}

  let exerciseMinutes = 0;
  try {
    for (const r of await read(hc, 'ExerciseSession', filter)) {
      const st = new Date(r.startTime).getTime(), en = new Date(r.endTime).getTime();
      if (en > st) exerciseMinutes += Math.round((en - st) / 60000);
    }
  } catch {}

  // Heart rate: average of all bpm samples across the day.
  let heartRateAvg: number | null = null;
  try {
    const recs = await read(hc, 'HeartRate', filter);
    const bpms: number[] = [];
    for (const r of recs) for (const s of (r.samples ?? [])) if (s.beatsPerMinute) bpms.push(s.beatsPerMinute);
    if (bpms.length) heartRateAvg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
  } catch {}

  const wt = await latest('Weight', 30);
  const rhr = await latest('RestingHeartRate', 7);
  const spo2 = await latest('OxygenSaturation', 7);
  const vo2 = await latest('Vo2Max', 60);
  const distM = await sum('Distance', r => r.distance?.inMeters ?? 0);
  const active = await sum('ActiveCaloriesBurned', r => r.energy?.inKilocalories ?? 0);
  const total = await sum('TotalCaloriesBurned', r => r.energy?.inKilocalories ?? 0);

  return {
    steps,
    sleepMinutes,
    weightKg: r1(wt?.weight?.inKilograms ?? wt?.weight?.value ?? null),
    heartRateAvg,
    restingHeartRate: rhr?.beatsPerMinute ?? null,
    distanceKm: distM != null ? r1(distM / 1000) : null,
    activeCalories: active != null ? Math.round(active) : null,
    totalCalories: total != null ? Math.round(total) : null,
    exerciseMinutes,
    oxygenPct: r1(spo2?.percentage ?? null),
    vo2max: r1(vo2?.vo2MillilitersPerMinuteKilogram ?? null),
  };
}
