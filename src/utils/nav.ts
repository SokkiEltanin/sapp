import { router } from 'expo-router';

// Go back if there's somewhere to go, otherwise land on the dashboard. Screens that
// can be launched directly (app-shortcut deep links: sapp://expenses/scan, /manual,
// /mood) have NO back stack on a cold start — a bare router.back() there leaves a
// black screen you have to force-close. Always use this for their back/close/save.
export function goBackOrHome() {
  try {
    if (router.canGoBack()) { router.back(); return; }
  } catch {}
  try { router.replace('/(tabs)' as any); } catch {}
}
