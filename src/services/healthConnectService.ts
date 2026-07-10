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

// Initialise the SDK once (no permission prompt). Reads need this; calling it
// from readHealthDay/readHealthRange lets background/auto syncs work silently
// when access was already granted, while the "Synchronizuj" button still owns
// the permission request via ensureHealthConnect().
let _inited = false;
async function ensureInit(hc: any): Promise<boolean> {
  if (_inited) return true;
  try { _inited = await hc.initialize(); } catch { _inited = false; }
  return _inited;
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
  // Richer Samsung-Health data (Galaxy Watch writes most of these):
  { accessType: 'read', recordType: 'FloorsClimbed' },
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
  { accessType: 'read', recordType: 'RespiratoryRate' },
  { accessType: 'read', recordType: 'BodyFat' },
  { accessType: 'read', recordType: 'BasalMetabolicRate' },
  { accessType: 'read', recordType: 'LeanBodyMass' },
  { accessType: 'read', recordType: 'BodyWaterMass' },
  { accessType: 'read', recordType: 'Hydration' },
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

// Is a specific record type currently readable (permission granted)? Best-effort;
// lets the UI tell "you never granted Nawodnienie" apart from "granted, but no
// water data is flowing from Samsung Health". Never throws.
export async function isPermissionGranted(recordType: string): Promise<boolean> {
  const hc = mod();
  if (!hc) return false;
  try {
    if (!(await ensureInit(hc))) return false;
    const granted = await hc.getGrantedPermissions();
    return (granted ?? []).some((p: any) => p.recordType === recordType);
  } catch { return false; }
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
  sleepDeepMin: number;            // sleep stages (Samsung writes them)
  sleepRemMin: number;
  sleepLightMin: number;
  weightKg: number | null;
  heartRateAvg: number | null;     // bpm, day average
  restingHeartRate: number | null; // bpm
  distanceKm: number | null;       // km
  activeCalories: number | null;   // kcal
  totalCalories: number | null;    // kcal
  exerciseMinutes: number;         // sum of workout sessions
  oxygenPct: number | null;        // SpO2 %
  vo2max: number | null;
  floors: number | null;           // floors climbed
  hrv: number | null;              // heart-rate variability (ms, RMSSD) — stress proxy
  respiratoryRate: number | null;  // breaths/min
  bodyFatPct: number | null;       // %
  bmr: number | null;              // basal metabolic rate, kcal/day
  leanMassKg: number | null;       // lean / skeletal mass, kg (BIA)
  bodyWaterKg: number | null;      // body water, kg (BIA)
  hydrationMl: number | null;      // water logged, ml
}

// Read one day of everything we support from Health Connect. Each metric is read
// independently and guarded, so a missing/denied type just stays null.
export async function readHealthDay(date: Date = new Date()): Promise<HealthConnectDay | null> {
  const hc = mod();
  if (!hc) return null;
  if (!(await ensureInit(hc))) return null;
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

  let sleepMinutes = 0, sleepDeepMin = 0, sleepRemMin = 0, sleepLightMin = 0;
  try {
    for (const r of await read(hc, 'SleepSession', filter)) {
      const st = new Date(r.startTime).getTime(), en = new Date(r.endTime).getTime();
      if (en > st) sleepMinutes += Math.round((en - st) / 60000);
      // Stage minutes (HC enum: 4=light, 5=deep, 6=REM). Samsung populates these.
      for (const stg of (r.stages ?? [])) {
        const ss = new Date(stg.startTime).getTime(), se = new Date(stg.endTime).getTime();
        if (se <= ss) continue;
        const mins = Math.round((se - ss) / 60000);
        if (stg.stage === 5) sleepDeepMin += mins;
        else if (stg.stage === 6) sleepRemMin += mins;
        else if (stg.stage === 4) sleepLightMin += mins;
      }
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
  const floorsN = await sum('FloorsClimbed', r => r.floors ?? 0);
  const hrvRec = await latest('HeartRateVariabilityRmssd', 2);
  const rrRec = await latest('RespiratoryRate', 2);
  const bfRec = await latest('BodyFat', 60);
  const bmrRec = await latest('BasalMetabolicRate', 30);
  const leanRec = await latest('LeanBodyMass', 60);
  const waterRec = await latest('BodyWaterMass', 60);
  const hydrationN = await sum('Hydration', r => r.volume?.inMilliliters ?? (r.volume?.inLiters != null ? r.volume.inLiters * 1000 : 0));

  return {
    steps,
    sleepMinutes,
    sleepDeepMin,
    sleepRemMin,
    sleepLightMin,
    weightKg: r1(wt?.weight?.inKilograms ?? wt?.weight?.value ?? null),
    heartRateAvg,
    restingHeartRate: rhr?.beatsPerMinute ?? null,
    distanceKm: distM != null ? r1(distM / 1000) : null,
    activeCalories: active != null ? Math.round(active) : null,
    totalCalories: total != null ? Math.round(total) : null,
    exerciseMinutes,
    oxygenPct: r1(spo2?.percentage ?? null),
    vo2max: r1(vo2?.vo2MillilitersPerMinuteKilogram ?? null),
    floors: floorsN != null ? Math.round(floorsN) : null,
    hrv: r1(hrvRec?.heartRateVariabilityMillis ?? null),
    respiratoryRate: r1(rrRec?.rate ?? null),
    bodyFatPct: r1(bfRec?.percentage ?? null),
    bmr: bmrRec ? Math.round(bmrRec?.basalMetabolicRate?.inKilocaloriesPerDay ?? bmrRec?.basalMetabolicRate?.inWatts ?? 0) || null : null,
    leanMassKg: r1(leanRec?.mass?.inKilograms ?? leanRec?.mass?.value ?? null),
    bodyWaterKg: r1(waterRec?.mass?.inKilograms ?? waterRec?.mass?.value ?? null),
    hydrationMl: hydrationN != null ? Math.round(hydrationN) : null,
  };
}

export interface HealthDayPoint {
  date: string;            // YYYY-MM-DD (local day)
  steps: number;
  sleepMinutes: number;
  weightKg: number | null;
}

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Read a back-window of daily steps + sleep (+ any logged weight) for the charts
// and the weekly/monthly analysis. Each record type is read ONCE across the whole
// window and bucketed locally — far fewer native calls than N per-day reads.
// Returns oldest → newest, always `days` long (missing days = zeros / null weight).
// Steps bucket by their own day; a sleep session counts on the day you WOKE (its
// end), so "today" shows last night — matching the single-day card.
export async function readHealthRange(days: number, end: Date = new Date()): Promise<HealthDayPoint[]> {
  const start = new Date(end); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  const out: HealthDayPoint[] = [];
  const byDay = new Map<string, HealthDayPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const p: HealthDayPoint = { date: localKey(d), steps: 0, sleepMinutes: 0, weightKg: null };
    byDay.set(p.date, p); out.push(p);
  }

  const hc = mod();
  if (!hc) return out;                 // no native module → zeros (caller uses local cache)
  if (!(await ensureInit(hc))) return out;

  const endIso = new Date(end); endIso.setHours(23, 59, 59, 999);
  const filter = { operator: 'between', startTime: start.toISOString(), endTime: endIso.toISOString() } as const;

  try {
    for (const r of await read(hc, 'Steps', filter)) {
      const p = byDay.get(localKey(new Date(r.startTime)));
      if (p) p.steps += r.count ?? 0;
    }
  } catch {}

  try {
    for (const r of await read(hc, 'SleepSession', filter)) {
      const st = new Date(r.startTime).getTime(), en = new Date(r.endTime).getTime();
      if (en <= st) continue;
      const p = byDay.get(localKey(new Date(r.endTime)));   // wake day
      if (p) p.sleepMinutes += Math.round((en - st) / 60000);
    }
  } catch {}

  try {
    const recs = await read(hc, 'Weight', filter);
    recs.sort((a, b) => new Date(a.time ?? a.startTime).getTime() - new Date(b.time ?? b.startTime).getTime());
    for (const r of recs) {
      const p = byDay.get(localKey(new Date(r.time ?? r.startTime)));
      const kg = r.weight?.inKilograms ?? r.weight?.value ?? null;
      if (p && kg != null) p.weightKg = Math.round(kg * 10) / 10;   // last reading of the day wins
    }
  } catch {}

  return out;
}
