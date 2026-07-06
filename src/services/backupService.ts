import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  getDocs, setDoc, deleteDoc, getDoc, query, orderBy, writeBatch,
} from 'firebase/firestore';
import { db, userCol, userDoc, userSubcol, userSubdoc } from './firebase';
import { expensesService } from './expensesService';
import { moodService } from './moodService';
import { calendarService, tasksService } from './calendarService';
import { subscriptionsService } from './subscriptionsService';
import { templatesService } from './templatesService';
import { workService } from './workService';
import { vehiclesService } from './vehiclesService';
import { maintenanceService } from './maintenanceService';
import { debtsService } from './debtsService';
import { buildDerivedAnalysis } from '@/utils/exportAnalysis';
import { loadNameAliases } from '@/utils/productMemory';
import { getHealthHistory } from '@/utils/healthHistory';

// ─── Cloud backup ─────────────────────────────────────────────────────────────
// A backup is ONE snapshot of everything the app owns: all local config/data in
// AsyncStorage (notes, budgets, product memory, dashboard layout, tag limits,
// payers, weights, habits…) PLUS every Firestore collection (expenses, mood,
// calendar, tasks, subscriptions, templates, work shifts). The JSON is split into
// <1 MiB chunks and stored under users/{uid}/backups/{id}/chunks so it never hits
// the Firestore document size limit.
//
// Retention is a rolling window: keep backups from the last RETAIN_DAYS, but
// always keep at least MIN_KEEP of the most recent ones (so you never end up with
// zero after not opening the app for a while). Auto runs daily, so steady state is
// ~3 backups — tiny, and Firestore never fills up.

const BACKUPS = 'backups';
const RETAIN_DAYS = 3;
const MIN_KEEP = 3;
const CHUNK = 480_000;                 // chars per chunk, safely under 1 MiB
const LAST_AUTO_KEY = 'backup_last_auto_at';
const AUTO_EVERY_MS = 24 * 60 * 60 * 1000;

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export interface BackupMeta {
  id: string;
  createdAt: string;
  auto: boolean;
  appBuild?: number;
  chunks: number;
  sizeBytes: number;
  counts: Record<string, number>;
}

interface Snapshot {
  version: number;
  createdAt: string;
  appBuild?: number;
  local: Record<string, string>;
  cloud: Record<string, any[]>;
}

const CLOUD_COLS = ['expenses', 'mood', 'events', 'tasks', 'subscriptions', 'expenseTemplates', 'workShifts', 'vehicles', 'maintenanceItems', 'debts'] as const;

async function gatherSnapshot(appBuild?: number): Promise<Snapshot> {
  // Local: every AsyncStorage key except Firebase auth + our own throttle marker.
  const keys = (await AsyncStorage.getAllKeys()).filter(
    k => !k.startsWith('firebase:') && k !== LAST_AUTO_KEY,
  );
  const pairs = await AsyncStorage.multiGet(keys);
  const local: Record<string, string> = {};
  for (const [k, v] of pairs) if (v != null) local[k] = v;

  const [expenses, mood, events, tasks, subscriptions, expenseTemplates, workShifts, vehicles, maintenanceItems, debts] = await Promise.all([
    expensesService.getAll(),
    moodService.getAll(),
    calendarService.getAllEvents(),
    tasksService.getAllTasks(),
    subscriptionsService.getAll(),
    templatesService.getAll(),
    workService.getShifts(),
    vehiclesService.getAll(),
    maintenanceService.getAll(),
    debtsService.getAll(),
  ]);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    appBuild,
    local,
    cloud: { expenses, mood, events, tasks, subscriptions, expenseTemplates, workShifts, vehicles, maintenanceItems, debts },
  };
}

// Parse every local AsyncStorage value into JSON where possible, so the exported
// config is readable (dashboard layout, budgets, tag rules, memories…) instead of
// a wall of escaped strings. Non-JSON values are kept verbatim.
function parseLocalConfig(local: Record<string, string>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(local)) {
    try { out[k] = JSON.parse(v); } catch { out[k] = v; }
  }
  return out;
}

// Export the whole snapshot to a JSON file and open the share sheet, so the data
// can be sent out and inspected. On top of the raw `local` + `cloud` snapshot it
// adds a `config` block (parsed settings incl. the dashboard layout) and a
// `derived` block that runs the app's own computations over the data (paychecks,
// work rate, monthly reports, Wrapped cards, health rollups, product grouping,
// integrity warnings) — so raw vs. interpreted can be cross-checked. Returns the
// byte size for a quick toast summary.
export async function exportSnapshotToFile(appBuild?: number): Promise<{ uri: string; bytes: number }> {
  const snap = await gatherSnapshot(appBuild);

  // Extra inputs the derived analysis needs (best-effort — never block the export).
  const [workSettings, nameAliases, health] = await Promise.all([
    workService.getSettings().catch(() => undefined),
    loadNameAliases().catch(() => ({})),
    getHealthHistory(400).catch(() => ({})),
  ]);
  const healthDays: Record<string, { steps: number; sleepMinutes: number; weightKg: number | null }> = {};
  for (const [d, v] of Object.entries(health as Record<string, { steps: number; sleepMinutes: number; weight: number }>)) {
    healthDays[d] = { steps: v.steps, sleepMinutes: v.sleepMinutes, weightKg: v.weight > 0 ? v.weight : null };
  }

  let derived: any = null;
  try {
    derived = buildDerivedAnalysis({
      expenses: snap.cloud.expenses ?? [],
      events: snap.cloud.events ?? [],
      mood: snap.cloud.mood ?? [],
      tasks: snap.cloud.tasks ?? [],
      workSettings: workSettings ?? ({ workPrefix: '', workColor: undefined, excludedPayMonths: [] } as any),
      healthDays,
      nameAliases: nameAliases as Record<string, string>,
    });
  } catch (e: any) {
    derived = { error: String(e?.message ?? e) };
  }

  const out = { ...snap, exportVersion: 2, config: parseLocalConfig(snap.local), derived };
  const json = JSON.stringify(out, null, 2);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const uri = `${FileSystem.cacheDirectory}sapp-export-${stamp}.json`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Eksport danych Sapp',
      UTI: 'public.json',
    });
  }
  return { uri, bytes: json.length };
}

export async function createBackup(auto: boolean, appBuild?: number): Promise<BackupMeta> {
  const snap = await gatherSnapshot(appBuild);
  const json = JSON.stringify(snap);
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += CHUNK) chunks.push(json.slice(i, i + CHUNK));

  const id = String(Date.now());
  const counts: Record<string, number> = {};
  for (const c of CLOUD_COLS) counts[c] = snap.cloud[c]?.length ?? 0;

  // Chunks first, then the meta doc — so a half-written backup is never listed.
  for (let i = 0; i < chunks.length; i++) {
    await setDoc(userSubdoc(BACKUPS, id, 'chunks', String(i)), { d: chunks[i] });
  }
  const meta: BackupMeta = {
    id, createdAt: snap.createdAt, auto, appBuild,
    chunks: chunks.length, sizeBytes: json.length, counts,
  };
  await setDoc(userDoc(BACKUPS, id), strip(meta));

  await prune();
  if (auto) await AsyncStorage.setItem(LAST_AUTO_KEY, snap.createdAt);
  return meta;
}

export async function listBackups(): Promise<BackupMeta[]> {
  const q = query(userCol(BACKUPS), orderBy('createdAt', 'desc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<BackupMeta, 'id'>) }));
}

async function deleteBackup(id: string): Promise<void> {
  const chunksSnap = await getDocs(userSubcol(BACKUPS, id, 'chunks'));
  await Promise.all(chunksSnap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(userDoc(BACKUPS, id));
}

async function prune(): Promise<void> {
  const all = await listBackups();                 // newest first
  const cutoff = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000;
  // Delete a backup only if it's both beyond MIN_KEEP and older than the window.
  const stale = all.filter((b, i) => i >= MIN_KEEP && new Date(b.createdAt).getTime() < cutoff);
  for (const b of stale) await deleteBackup(b.id).catch(() => {});
}

async function readSnapshot(id: string): Promise<Snapshot> {
  const metaSnap = await getDoc(userDoc(BACKUPS, id));
  if (!metaSnap.exists()) throw new Error('Kopia nie istnieje');
  const meta = metaSnap.data() as BackupMeta;
  let json = '';
  for (let i = 0; i < meta.chunks; i++) {
    const c = await getDoc(userSubdoc(BACKUPS, id, 'chunks', String(i)));
    json += (c.data() as { d?: string } | undefined)?.d ?? '';
  }
  return JSON.parse(json) as Snapshot;
}

// Replace a Firestore collection's contents with `items` (upsert by id first so
// data is never momentarily empty, then delete ids that aren't in the backup).
async function replaceCollection(col: string, items: any[]): Promise<void> {
  const keepIds = new Set(items.map(it => it.id));
  const current = await getDocs(userCol(col));

  let batch = writeBatch(db);
  let ops = 0;
  const flush = async () => { if (ops > 0) { await batch.commit(); batch = writeBatch(db); ops = 0; } };

  for (const it of items) {
    const { id, ...rest } = it;
    batch.set(userDoc(col, id), strip(rest));
    if (++ops >= 450) await flush();
  }
  for (const d of current.docs) {
    if (!keepIds.has(d.id)) { batch.delete(d.ref); if (++ops >= 450) await flush(); }
  }
  await flush();
}

export async function restoreBackup(id: string): Promise<void> {
  const snap = await readSnapshot(id);

  // 1) Cloud collections first (the bulk / failure-prone part) — full replace.
  const map: Record<string, any[]> = snap.cloud;
  await replaceCollection('expenses',         map.expenses ?? []);
  await replaceCollection('mood',             map.mood ?? []);
  await replaceCollection('events',           map.events ?? []);
  await replaceCollection('tasks',            map.tasks ?? []);
  await replaceCollection('subscriptions',    map.subscriptions ?? []);
  await replaceCollection('expenseTemplates', map.expenseTemplates ?? []);
  await replaceCollection('workShifts',       map.workShifts ?? []);
  await replaceCollection('vehicles',         map.vehicles ?? []);
  await replaceCollection('maintenanceItems', map.maintenanceItems ?? []);
  await replaceCollection('debts',            map.debts ?? []);

  // 2) Local config/data — overwrite AsyncStorage keys from the snapshot.
  const entries = Object.entries(snap.local);
  if (entries.length) await AsyncStorage.multiSet(entries);
}

export async function getLastBackup(): Promise<BackupMeta | null> {
  const all = await listBackups();
  return all[0] ?? null;
}

// Create an automatic backup at most once per `minIntervalMs` (default 24h).
// Safe to call on every launch — cheap no-op when a recent backup exists. Called
// on app-background with a shorter interval too, so recent changes (e.g. product
// kcal) are captured before a possible reinstall.
export async function maybeAutoBackup(appBuild?: number, minIntervalMs: number = AUTO_EVERY_MS): Promise<void> {
  try {
    const last = await AsyncStorage.getItem(LAST_AUTO_KEY);
    if (last && Date.now() - new Date(last).getTime() < minIntervalMs) return;
    await createBackup(true, appBuild);
  } catch {
    // Offline / not signed in yet — try again next launch.
  }
}
