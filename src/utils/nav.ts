import { router } from 'expo-router';

// Go back if there's somewhere to go, otherwise land on the dashboard. Screens that
// can be launched directly (app-shortcut deep links: sapp://expenses/scan, /manual,
// /mood) have NO back stack on a cold start — a bare router.back() there leaves a
// black screen you have to force-close. Always use this for their back/close/save.
export function goBackOrHome() {
  try {
    if (router.canGoBack()) { router.back(); return; }
  } catch {}
  // No back stack (deep-link entry) → replace to the dashboard. '/(tabs)/' is the
  // form that actually resolves (matches the notification-tap navigation); fall back
  // to '/' if anything about that path changes.
  try { router.replace('/(tabs)/' as any); return; } catch {}
  try { router.replace('/' as any); } catch {}
}
