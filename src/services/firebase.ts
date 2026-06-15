import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, Firestore, collection, doc } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import * as firebaseAuth from 'firebase/auth';
import { initializeAuth, getAuth, Auth, indexedDBLocalPersistence } from 'firebase/auth';
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

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

export const userCol = (col: string) => collection(db, 'users', uid(), col);
export const userDoc = (col: string, id: string) => doc(db, 'users', uid(), col, id);
// Nested subcollection/doc under a user document (e.g. backups/{id}/chunks/{n}).
export const userSubcol = (col: string, id: string, sub: string) =>
  collection(db, 'users', uid(), col, id, sub);
export const userSubdoc = (col: string, id: string, sub: string, subId: string) =>
  doc(db, 'users', uid(), col, id, sub, subId);
