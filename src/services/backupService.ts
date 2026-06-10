import AsyncStorage from '@react-native-async-storage/async-storage';
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

// ─── Cloud backup ─────────────────────────────────────────────────────────────
// A backup is ONE snapshot of everything the app owns: all local config/data in
// AsyncStorage (notes, budgets, product memory, dashboard layout, tag limits,
// payers, weights, habits…) PLUS every Firestore collection (expenses, mood,
// calendar, tasks, subscriptions, templates, work shifts). The JSON is split into
// <1 MiB chunks and stored under users/{uid}/backups/{id}/chunks so it never hits
// the Firestore document size limit. We keep the most recent MAX_BACKUPS.

const BACKUPS = 'backups';
const MAX_BACKUPS = 10;
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

const CLOUD_COLS = ['expenses', 'mood', 'events', 'tasks', 'subscriptions', 'expenseTemplates', 'workShifts'] as const;

async function gatherSnapshot(appBuild?: number): Promise<Snapshot> {
  // Local: every AsyncStorage key except Firebase auth + our own throttle marker.
  const keys = (await AsyncStorage.getAllKeys()).filter(
    k => !k.startsWith('firebase:') && k !== LAST_AUTO_KEY,
  );
  const pairs = await AsyncStorage.multiGet(keys);
  const local: Record<string, string> = {};
  for (const [k, v] of pairs) if (v != null) local[k] = v;

  const [expenses, mood, events, tasks, subscriptions, expenseTemplates, workShifts] = await Promise.all([
    expensesService.getAll(),
    moodService.getAll(),
    calendarService.getAllEvents(),
    tasksService.getAllTasks(),
    subscriptionsService.getAll(),
    templatesService.getAll(),
    workService.getShifts(),
  ]);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    appBuild,
    local,
    cloud: { expenses, mood, events, tasks, subscriptions, expenseTemplates, workShifts },
  };
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
  const all = await listBackups();
  for (const b of all.slice(MAX_BACKUPS)) await deleteBackup(b.id).catch(() => {});
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

  // 2) Local config/data — overwrite AsyncStorage keys from the snapshot.
  const entries = Object.entries(snap.local);
  if (entries.length) await AsyncStorage.multiSet(entries);
}

export async function getLastBackup(): Promise<BackupMeta | null> {
  const all = await listBackups();
  return all[0] ?? null;
}

// Create an automatic backup at most once per AUTO_EVERY_MS. Safe to call on
// every app launch — cheap no-op when a recent backup already exists.
export async function maybeAutoBackup(appBuild?: number): Promise<void> {
  try {
    const last = await AsyncStorage.getItem(LAST_AUTO_KEY);
    if (last && Date.now() - new Date(last).getTime() < AUTO_EVERY_MS) return;
    await createBackup(true, appBuild);
  } catch {
    // Offline / not signed in yet — try again next launch.
  }
}
