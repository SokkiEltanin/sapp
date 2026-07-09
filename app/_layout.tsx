import { useEffect, useState, useRef, Component, ReactNode } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ScrollView, StyleSheet, AppState, Alert, Pressable } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/services/firebase';
import { colors } from '@/theme';
import Toast from '@/components/ui/Toast';
import PomodoroIndicator from '@/components/ui/PomodoroIndicator';
import BadgeCelebration from '@/components/achievements/BadgeCelebration';
import { appSettings } from '@/utils/appSettings';
import { notificationsService } from '@/services/notificationsService';
import { maybeAutoBackup, getLastBackup, restoreBackup } from '@/services/backupService';
import { autoSyncHealth } from '@/services/healthAutoSync';
import { drainBankNotifications } from '@/services/bankNotificationDrain';
import { migrateBalanceModel } from '@/utils/accountBalance';
import MoodCheckInModal from '@/components/mood/MoodCheckInModal';
import { useMoodStore } from '@/store/moodStore';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={eb.wrap}>
        <Text style={eb.title}>Coś się wykrzaczyło</Text>
        <View style={eb.btnRow}>
          <Pressable style={[eb.btn, eb.btnPrimary]} onPress={() => { this.setState({ error: null }); try { router.replace('/(tabs)' as any); } catch {} }}>
            <Text style={eb.btnPrimaryTxt}>Wróć do apki</Text>
          </Pressable>
          <Pressable style={eb.btn} onPress={() => { Updates.reloadAsync().catch(() => {}); }}>
            <Text style={eb.btnTxt}>Przeładuj</Text>
          </Pressable>
        </View>
        <Text style={eb.hint}>Zapis wykonał się przed błędem — dane są bezpieczne. Skopiuj poniższe i wyślij, żebym to naprawił:</Text>
        <ScrollView style={eb.scroll}>
          <Text style={eb.msg}>{(error as Error).message}</Text>
          <Text style={eb.stack}>{(error as Error).stack}</Text>
        </ScrollView>
      </View>
    );
  }
}

const eb = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0D0D0D', padding: 20, paddingTop: 60 },
  title: { color: '#FF5A5F', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  btn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#333', backgroundColor: '#1A1A1A' },
  btnPrimary: { backgroundColor: '#2AC68F', borderColor: '#2AC68F' },
  btnPrimaryTxt: { color: '#07160F', fontSize: 14, fontWeight: '800' },
  btnTxt: { color: '#ddd', fontSize: 14, fontWeight: '700' },
  hint: { color: '#8A93A8', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  scroll: { flex: 1 },
  msg: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  stack: { color: '#aaa', fontSize: 11, lineHeight: 16 },
});

const MOOD_POPUP_KEY = 'last_mood_auto_popup';
// Short cooldown only to suppress rapid re-foreground spam — the real gate is
// "once per foreground session" (shownThisFg), so coming back to the dashboard
// later actually re-asks (the old 6h throttle made it never re-appear).
const MOOD_COOLDOWN_MS = 20 * 60 * 1000;

// Cross-component guards (module scope, single app instance):
// • lastHandledNotifKey — collapses the cold-start double delivery (the listener
//   AND getLastNotificationResponseAsync hand over the same tap).
// • suppressAutoMoodUntil — when a mood notification is being handled (it opens
//   the mood screen's own check-in), keep the global AutoMoodPopup quiet so the
//   modal doesn't appear twice.
let lastHandledNotifKey: string | null = null;
let suppressAutoMoodUntil = 0;

function AutoMoodPopup() {
  const [visible, setVisible] = useState(false);
  const shownThisFg = useRef(false); // shown once this foreground session; reset on resume
  const pathname = usePathname();
  // Only nag while actually sitting on the dashboard ('/'). If the app opens and
  // you immediately tap "+" to add a receipt, you're off the dashboard before the
  // delay elapses — so the popup never interrupts that quick action; it waits
  // until you come back.
  const onDashboard = pathname === '/' || pathname === '/index';

  const check = async () => {
    try {
      if (!onDashboard) return;
      // Today's mood already logged? Then don't nag — neither the popup nor the
      // scheduled reminder (re-arm it to fire tomorrow instead).
      const logged = useMoodStore.getState().todayEntry != null;
      notificationsService.refreshMoodReminder(logged).catch(() => {});
      if (logged) return;
      // A mood notification tap is opening the check-in on the mood screen — don't
      // also pop the global modal (that was the "shows twice" bug).
      if (Date.now() < suppressAutoMoodUntil) return;
      if (shownThisFg.current) return; // already asked this foreground session
      const lastStr = await AsyncStorage.getItem(MOOD_POPUP_KEY);
      const now = Date.now();
      if (!lastStr || now - parseInt(lastStr) > MOOD_COOLDOWN_MS) {
        await AsyncStorage.setItem(MOOD_POPUP_KEY, String(now));
        shownThisFg.current = true;
        setVisible(true);
      }
    } catch {}
  };

  // (Re)arm whenever we land on the dashboard. Leaving it (e.g. → scan) clears the
  // pending timer, so the popup is cancelled mid-navigation and re-armed on return.
  useEffect(() => {
    if (!onDashboard) return;
    const timer = setTimeout(check, 3500);
    return () => clearTimeout(timer);
  }, [onDashboard]);

  // Returning to the foreground is a fresh session: allow the prompt again, then
  // re-check (still only fires if on the dashboard + mood unlogged + cooldown).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { shownThisFg.current = false; check(); }
    });
    return () => sub.remove();
  }, [onDashboard]);

  if (!visible) return null;
  return <MoodCheckInModal visible={visible} onClose={() => setVisible(false)} existingEntry={null} />;
}

export default function RootLayout() {
  const [authReady, setAuthReady] = useState(false);

  // Bundled hero greeting fonts — registered by name so react-native-svg can use
  // them. Non-blocking: the app renders immediately, the greeting updates once
  // these finish loading.
  useFonts({
    Blackout:      require('../assets/fonts/Blackout.ttf'),
    Pastel:        require('../assets/fonts/Pastel.ttf'),
    Airstrike:     require('../assets/fonts/airstrike.ttf'),
    AirstrikeBold: require('../assets/fonts/airstrikebold.ttf'),
    AirstrikeCond: require('../assets/fonts/airstrikecond.ttf'),
  });

  useEffect(() => { appSettings.loadAll(); }, []);
  useEffect(() => { migrateBalanceModel().catch(() => {}); }, []);
  useEffect(() => { notificationsService.ensureAndroidChannel().catch(() => {}); }, []);

  useEffect(() => {
    // Fallback: show app after 4s regardless (prevents permanent black screen)
    const timer = setTimeout(() => setAuthReady(true), 4000);
    const unsub = onAuthStateChanged(auth, (user) => {
      clearTimeout(timer);
      if (!user) {
        signInAnonymously(auth)
          .then(() => setAuthReady(true))
          .catch(() => setAuthReady(true));
      } else {
        setAuthReady(true);
      }
    });
    return () => { unsub(); clearTimeout(timer); };
  }, []);

  // Daily cloud backup — runs shortly after launch (throttled to once/24h inside).
  // Also backs up when the app goes to background (shorter 2h throttle) so recent
  // changes — e.g. product kcal you just set — are captured before a reinstall.
  useEffect(() => {
    if (!authReady) return;
    const t = setTimeout(() => { maybeAutoBackup().catch(() => {}); }, 8000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        maybeAutoBackup(undefined, 2 * 60 * 60 * 1000).catch(() => {});
      }
    });
    return () => { clearTimeout(t); sub.remove(); };
  }, [authReady]);

  // Background-ish health sync: pull the watch's recent history into the per-day
  // cache on cold start + every time the app returns to the foreground, so the
  // dashboard / achievements / calories stay current even on days the Zdrowie
  // screen was never opened. Silent + throttled (10 min) inside autoSyncHealth.
  useEffect(() => {
    const t = setTimeout(() => { autoSyncHealth().catch(() => {}); }, 3000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') autoSyncHealth().catch(() => {});
    });
    return () => { clearTimeout(t); sub.remove(); };
  }, []);

  // Drain bank notifications captured by the native listener while the app was
  // closed/backgrounded, on cold start + every foreground. Enqueued items are then
  // auto-accepted (trusted merchants) or shown for review by the dashboard.
  useEffect(() => {
    const t = setTimeout(() => { drainBankNotifications().catch(() => {}); }, 1500);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') drainBankNotifications().catch(() => {});
    });
    return () => { clearTimeout(t); sub.remove(); };
  }, []);

  // After signing into a pre-existing Google account (e.g. on a fresh install),
  // offer to restore that account's latest cloud backup so local config/data come
  // back too — not just the live Firestore collections.
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      try {
        if ((await AsyncStorage.getItem('restore_prompt_pending')) !== '1') return;
        await AsyncStorage.removeItem('restore_prompt_pending');
        const last = await getLastBackup();
        if (!last) return;
        const when = new Date(last.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        Alert.alert(
          'Znaleziono kopię w chmurze',
          `Z dnia ${when}. Przywrócić dane i ustawienia z tej kopii?`,
          [
            { text: 'Nie teraz', style: 'cancel' },
            { text: 'Przywróć', onPress: async () => {
                try { await restoreBackup(last.id); } catch {}
                Updates.reloadAsync().catch(() => {});
              } },
          ],
        );
      } catch {}
    })();
  }, [authReady]);

  useEffect(() => {
    function handleNotifResponse(response: Notifications.NotificationResponse) {
      // Cold-start delivers the SAME tap twice (listener + getLastNotificationResponse).
      // Dedupe by identifier + delivery date so a real next-day tap still works.
      const key = `${response.notification.request.identifier}:${(response.notification as any).date ?? 0}`;
      if (key === lastHandledNotifKey) return;
      lastHandledNotifKey = key;

      const data = (response.notification.request.content.data ?? {}) as Record<string, any>;
      const { screen, taskId, eventId } = data;

      if (screen === 'mood') {
        suppressAutoMoodUntil = Date.now() + 8000; // the mood screen opens the check-in itself
        router.push({ pathname: '/(tabs)/mood', params: { openCheckIn: 'true' } } as any);
      } else if (screen === 'tasks') {
        if (taskId) router.push(`/tasks/${taskId}` as any);
        else        router.push('/(tabs)/tasks' as any);
      } else if (screen === 'calendar' || screen === 'calendar_event') {
        if (eventId) router.push(`/calendar/${eventId}` as any);
        else         router.push('/(tabs)/stats' as any); // calendar lives in the stats tab
      } else if (screen === 'habits') {
        router.push('/habits' as any);
      } else if (screen === 'subscriptions') {
        router.push('/expenses/subscriptions' as any);
      } else if (screen === 'finances') {
        router.push('/(tabs)/finances' as any);
      } else if (screen === 'index') {
        router.push('/(tabs)/' as any);       // work shift → dashboard (live earnings widget)
      } else if (screen === 'work' || screen === 'stats') {
        router.push('/(tabs)/stats' as any);
      } else if (screen === 'month-cards') {
        router.push('/month-cards' as any);
      } else {
        // Never leave a tap dead — fall back to the dashboard.
        router.push('/(tabs)/' as any);
      }
    }

    // Foreground / background tap
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotifResponse);

    // Cold-start: app opened by tapping a notification when it was killed
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) setTimeout(() => handleNotifResponse(response), 300);
    });

    return () => sub.remove();
  }, []);

  if (!authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }} />
    );
  }

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={colors.bg.primary} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary }, animation: 'fade' }}>
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="expenses/add" options={{ animation: 'fade' }} />
          <Stack.Screen name="expenses/scan" options={{ animation: 'fade' }} />
          <Stack.Screen name="expenses/manual" options={{ animation: 'fade' }} />
          <Stack.Screen name="expenses/subscriptions" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="expenses/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="search" options={{ animation: 'fade' }} />
          <Stack.Screen name="calendar/add" options={{ animation: 'fade' }} />
          <Stack.Screen name="tasks/add" options={{ animation: 'fade' }} />
          <Stack.Screen name="tasks/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="calendar/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pomodoro" options={{ animation: 'fade' }} />
          <Stack.Screen name="habits" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="weekly" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="focus" options={{ animation: 'fade' }} />
          <Stack.Screen name="notes" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="widget-builder" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="expenses/templates" options={{ animation: 'fade' }} />
          <Stack.Screen name="vehicles" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="items" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="products" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="debts" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="counters" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="bank-review" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="work/add" options={{ animation: 'slide_from_bottom', presentation: 'modal', headerShown: false }} />
        </Stack>
        <PomodoroIndicator />
        <Toast />
        <BadgeCelebration />
        <AutoMoodPopup />
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
