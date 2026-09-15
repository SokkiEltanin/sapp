import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, Firestore, collection, doc } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import * as firebaseAuth from 'firebase/auth';
import { initializeAuth, getAuth, Auth, indexedDBLocalPersistence, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// `ignoreUndefinedProperties` makes Firestore silently drop `undefined` fields
// instead of throwing. Without it, writing an object that contains a nested
// `undefined` (e.g. a receipt item with `eaters: undefined`) makes updateDoc()
// reject — which is exactly why editing receipt products failed to save. The
// setting applies to ALL writes, so it fixes this whole class of bug at once.
let _db: Firestore;
try {
  _db = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  // Firestore was already initialised (e.g. dev fast-refresh) — reuse it.
  _db = getFirestore(app);
}
export const db: Firestore = _db;
export const storage: FirebaseStorage = getStorage(app);

// CRITICAL: on React Native, auth state must persist via AsyncStorage. The web
// `indexedDBLocalPersistence` does NOT work on a device — without real
// persistence the session is lost on every app restart, which (combined with the
// anonymous-sign-in fallback) causes an infinite login→reload→login loop.
// `getReactNativePersistence` only exists in firebase/auth's RN build, so it's
// accessed dynamically to keep the web/Node typecheck happy.
const getRNPersistence = (firebaseAuth as any).getReactNativePersistence as
  | ((storage: unknown) => unknown)
  | undefined;

let _auth: Auth;
try {
  _auth = initializeAuth(app, {
    persistence: getRNPersistence
      ? (getRNPersistence(AsyncStorage) as any)
      : indexedDBLocalPersistence,
  });
} catch {
  // initializeAuth throws if auth was already initialised (e.g. fast refresh)
  _auth = getAuth(app);
}
export const auth: Auth = _auth;
export default app;

// Shared, memoized auth resolution (2026-09-15, moved here from app/_layout.tsx) — user:
// "aplikacja bardzo laguje na wejściu" → Diagnostyka (perfLog.ts) showed msToFirstFrame
// averaging ~1.5s across 20 real cold starts, and msToReady only ~285ms behind THAT (the
// staged/deferred dashboard rendering from 2026-08-24 already made the POST-mount work
// fast) — meaning the entire delay sits BEFORE the dashboard even mounts. Root cause:
// `_layout.tsx` used to wrap the whole `<Stack>` in `{authReady && (...)}`, blocking every
// screen behind `onAuthStateChanged`/`signInAnonymously` finishing a full round-trip
// through the Firebase SDK (reading the persisted RN session from AsyncStorage, then
// possibly a network call for a fresh anonymous account) before ANYTHING could render.
//
// Fix: resolve auth ONCE, here, as an awaitable promise — `_layout.tsx` now renders the
// `<Stack>` immediately (screens show their normal loading/empty state for the ~1-1.5s
// this takes, same as any other network wait) instead of hiding the entire app behind a
// splash. The wait doesn't disappear, it just moves from "blocks the first frame" to
// "each Firestore call waits for it internally" — `uid()` (and everything built on it:
// `userCol`/`userDoc`/`userSubcol`/`userSubdoc`) now AWAITS this promise before touching
// `auth.currentUser`, so every existing call site (already `async`, already inside a
// `query(...)`/`addDoc(...)`/etc. that's awaited) picks up the wait for free — nothing
// call-site-specific to update beyond adding `await` where these used to be synchronous
// (TypeScript catches every missed one, since passing a `Promise<CollectionReference>`
// into `query()` no longer type-checks). 4s fallback ceiling preserved from the old
// `_layout.tsx` timer — if Firebase never resolves, reads/writes fail with "Not
// authenticated" after that, exactly like today's edge case when the fallback fires
// without a real user.
let authReadyPromise: Promise<void> | null = null;
export function whenAuthReady(): Promise<void> {
  if (!authReadyPromise) {
    authReadyPromise = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 4000);
      const unsub = onAuthStateChanged(auth, (user) => {
        clearTimeout(timer);
        unsub();
        if (user) { resolve(); return; }
        signInAnonymously(auth).then(() => resolve(), () => resolve());
      });
    });
  }
  return authReadyPromise;
}

async function uid(): Promise<string> {
  await whenAuthReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

export const userCol = async (col: string) => collection(db, 'users', await uid(), col);
export const userDoc = async (col: string, id: string) => doc(db, 'users', await uid(), col, id);
// Nested subcollection/doc under a user document (e.g. backups/{id}/chunks/{n}).
export const userSubcol = async (col: string, id: string, sub: string) =>
  collection(db, 'users', await uid(), col, id, sub);
export const userSubdoc = async (col: string, id: string, sub: string, subId: string) =>
  doc(db, 'users', await uid(), col, id, sub, subId);
