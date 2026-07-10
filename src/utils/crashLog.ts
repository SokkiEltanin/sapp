import AsyncStorage from '@react-native-async-storage/async-storage';

// One place to persist a crash so it survives the process dying, and the next
// launch can surface it (app/_layout.tsx reads 'last_crash'). Used by BOTH the
// root class ErrorBoundary AND the per-route expo-router ErrorBoundary — the
// latter matters because expo-router catches a screen's render error in its OWN
// boundary (a blank screen in production) before it can reach the root one, so
// without a route-level boundary the crash was invisible ("brak zapisanego crasha").
export function persistCrash(error: any, extra?: string) {
  try {
    AsyncStorage.setItem('last_crash', JSON.stringify({
      at: new Date().toISOString(),
      message: error?.message ?? String(error),
      stack: (error?.stack ?? '').slice(0, 4000),
      component: (extra ?? '').slice(0, 2000),
    })).catch(() => {});
  } catch {}
}
