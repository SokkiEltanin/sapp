import { useEffect, useState, Component, ReactNode } from 'react';
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
import AnimatedSplash from '@/components/AnimatedSplash';
import { appSettings } from '@/utils/appSettings';
import { notificationsService } from '@/services/notificationsService';
import { maybeAutoBackup, getLastBackup, restoreBackup } from '@/services/backupService';
import { autoSyncHealth } from '@/services/healthAutoSync';
import { drainBankNotifications } from '@/services/bankNotificationDrain';
import { flushPendingExpenseWrites } from '@/services/expenseSync';
import { useExpensesStore } from '@/store/expensesStore';
import { migrateBalanceModel } from '@/utils/accountBalance';
import { loadNonFood } from '@/utils/food';
import MoodCheckInModal from '@/components/mood/MoodCheckInModal';
import { useMoodStore } from '@/store/moodStore';
import { useUiActions } from '@/store/uiActions';
import { todayISO } from '@/utils/date';
import { persistCrash } from '@/utils/crashLog';
import { takeDanglingScanSave } from '@/utils/scanBreadcrumb';
import * as FileSystem from 'expo-file-system/legacy';

// Catch JS errors that escape React's render tree (async, event handlers, native
// bridge) too — those can leave a black screen the ErrorBoundary never sees. We
// persist them so the user can surface the text from Settings after a restart.
(() => {
  const g: any = global as any;
  if (g.__sappErrHandlerInstalled || !g.ErrorUtils?.setGlobalHandler) return;
  g.__sappErrHandlerInstalled = true;
  const prev = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    persistCrash(error, isFatal ? 'FATAL' : '');
    prev?.(error, isFatal);
  });
  // Unhandled PROMISE REJECTIONS escape both the render ErrorBoundary AND the global
  // handler above — and an uncaught rejection in a save/async path is exactly what
  // leaves a black screen with "brak zapisanego crasha". Track them so the cause
  // finally lands in Diagnostyka → ostatni błąd.
  try {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (_id: any, error: any) => { persistCrash(error, 'UNHANDLED_REJECTION'); },
      onHandled: () => {},
    });
  } catch {}
})();

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string }) { persistCrash(error, info?.componentStack); }
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

// One auto-ask per calendar day: store the day we last popped the check-in. This
// makes "ask me on the first entry of the day" reliable — the old cooldown +
// once-per-foreground combo sometimes skipped a whole day (or never fired if the
// 3.5 s timer was cancelled by a quick navigation).
const MOOD_PROMPT_DAY_KEY = 'mood_prompt_day';

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
  const pathname = usePathname();
  // Ask while sitting on the dashboard ('/'). If the app opens and you immediately
  // tap "+" to add a receipt, you're off the dashboard before the short delay
  // elapses — so the popup never interrupts that quick action; it waits until you
  // come back to the dashboard.
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
      // Already auto-asked today? Once per day is enough — the scheduled reminder
      // handles further nagging. This is what makes the daily ask reliable.
      const today = todayISO();
      if ((await AsyncStorage.getItem(MOOD_PROMPT_DAY_KEY)) === today) return;
      await AsyncStorage.setItem(MOOD_PROMPT_DAY_KEY, today);
      setVisible(true);
    } catch {}
  };

  // Ask soon after landing on the dashboard — the first entry of the day. A short
  // delay lets the dashboard paint first so the sheet slides over a rendered
  // screen (not a blank one). Leaving the dashboard clears the timer.
  useEffect(() => {
    if (!onDashboard) return;
    const timer = setTimeout(check, 900);
    return () => clearTimeout(timer);
  }, [onDashboard]);

  // Re-check on every return to the foreground (still gated to once/day by the
  // stored flag) so opening the app fresh on a new day always asks.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [onDashboard]);

  if (!visible) return null;
  return <MoodCheckInModal visible={visible} onClose={() => setVisible(false)} existingEntry={null} />;
}

export default function RootLayout() {
  const [authReady, setAuthReady] = useState(false);
  // Animated pet splash: keep it up until auth is ready AND a minimum time has passed,
  // so the cat animation is actually seen on every launch (auth can resolve instantly).
  // `splashGone` unmounts it after its fade-out completes.
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinSplashDone(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Bundled hero greeting fonts — registered by name so react-native-svg can use
  // them. Non-blocking: the app renders immediately, the greeting updates once
  // these finish loading.
  useFonts({
    Blackout:      require('../assets/fonts/Blackout.ttf'),
    Pastel:        require('../assets/fonts/Pastel.ttf'),
    Airstrike:     require('../assets/fonts/airstrike.ttf'),
    AirstrikeBold: require('../assets/fonts/airstrikebold.ttf'),
    AirstrikeCond: require('../assets/fonts/airstrikecond.ttf'),
    LexendTera:    require('../assets/fonts/LexendTera.ttf'),   // CAPS-owe nagłówki (mockup serii)
    ArchivoBlack:  require('../assets/fonts/ArchivoBlack.ttf'), // wielkie liczby (heavy 900)
  });

  useEffect(() => { appSettings.loadAll(); }, []);
  useEffect(() => { migrateBalanceModel().catch(() => {}); }, []);
  useEffect(() => { loadNonFood().catch(() => {}); }, []);   // "to nie jedzenie" exclusions → module set

  // Surface a FRESH crash right after a restart, so a black-screen crash reports
  // itself (message + top of stack) instead of the user having to dig into Settings.
  // Only very recent ones — an old crash shouldn't nag on every launch.
  useEffect(() => {
    (async () => {
      // 1) NATIVE (JVM) crash caught by the ContentProvider handler — this is the
      //    black-screen case a JS boundary can't see. Prefer it if present.
      try {
        const file = `${FileSystem.documentDirectory ?? ''}native_crash.json`;
        const info = await FileSystem.getInfoAsync(file);
        if (info.exists) {
          const cr = JSON.parse(await FileSystem.readAsStringAsync(file));
          await FileSystem.deleteAsync(file, { idempotent: true }).catch(() => {});
          const age = Date.now() - Number(cr.at ?? 0);
          if (age >= 0 && age < 20 * 60 * 1000) {
            const stackTop = String(cr.stack ?? '').split('\n').slice(0, 8).join('\n');
            setTimeout(() => Alert.alert('Natywny crash (wyślij mi to)', `${cr.message ?? '—'}\n\n${stackTop}`), 1400);
            return;
          }
        }
      } catch {}
      // 2) JS crash persisted via crashLog (route/root ErrorBoundary or global handler).
      try {
        const raw = await AsyncStorage.getItem('last_crash');
        if (!raw) return;
        const cr = JSON.parse(raw);
        const age = Date.now() - new Date(cr.at).getTime();
        if (!(age >= 0 && age < 15 * 60 * 1000)) return;
        await AsyncStorage.removeItem('last_crash');
        const stackTop = String(cr.stack ?? cr.component ?? '').split('\n').slice(0, 6).join('\n');
        setTimeout(() => Alert.alert('Ostatni błąd (wyślij mi to)', `${cr.message ?? '—'}\n\n${stackTop}`), 1400);
      } catch {}
    })();
  }, []);

  // A receipt save that started but never finished = the screen froze (an ANR, not a
  // JS crash — which is why nothing shows in the crash log). Surface it so the freeze
  // is finally reportable instead of invisible.
  useEffect(() => {
    (async () => {
      try {
        const d = await takeDanglingScanSave();
        if (!d) return;
        const age = Date.now() - Number(d.at ?? 0);
        if (!(age >= 0 && age < 30 * 60 * 1000)) return;
        setTimeout(() => Alert.alert(
          'Zapis paragonu się zaciął (wyślij mi to)',
          `Ekran zamarł podczas zapisu paragonu (${d.meta ?? '?'}, ostatni krok: ${d.step ?? 'start'}). To zawieszenie, nie błąd — dlatego crash jest pusty.`,
        ), 1800);
      } catch {}
    })();
  }, []);

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
  // screen was never opened. FORCED (bypasses the 10-min throttle) because the user
  // wants fresh watch data on app entry — the throttle was leaving widgets stale when
  // you re-opened the app. Concurrent runs are still deduped inside autoSyncHealth.
  useEffect(() => {
    const t = setTimeout(() => { autoSyncHealth(14, true).catch(() => {}); }, 2000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') autoSyncHealth(14, true).catch(() => {});
    });
    return () => { clearTimeout(t); sub.remove(); };
  }, []);

  // Flush przed północą — gdy apka jest otwarta, tuż przed zmianą dnia (23:58) zrzuca
  // dzisiejsze kroki + wodę z zegarka do cache per-dzień, żeby dzień nigdy nie kończył
  // się nieaktualnymi danymi „zanim się zresetuje". Self-reschedule na kolejną noc.
  // (Pełne działanie w tle o północy wymagałoby natywnego zadania — to best-effort gdy
  //  apka żyje; poranny foreground i tak dorównuje zaległości przez range-backfill.)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnightFlush = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(23, 58, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const ms = Math.min(next.getTime() - now.getTime(), 2 ** 31 - 1);
      timer = setTimeout(() => {
        autoSyncHealth(2, true).catch(() => {});   // kroki + hydration → nawyk „Woda"
        scheduleMidnightFlush();                    // ustaw na kolejną noc
      }, ms);
    };
    scheduleMidnightFlush();
    return () => clearTimeout(timer);
  }, []);

  // Drain bank notifications captured by the native listener while the app was
  // closed/backgrounded, on cold start + every foreground. Enqueued items are then
  // auto-accepted (trusted merchants) or shown for review by the dashboard.
  useEffect(() => {
    // Drain, then immediately auto-commit trusted/full-auto items so payments post
    // without opening the dashboard — but only once expenses are loaded, so receipt
    // matching stays reliable (the dashboard effect is the fallback otherwise).
    const drainThenAuto = () => drainBankNotifications()
      .then(() => { if (useExpensesStore.getState().expenses.length > 0) return import('@/services/bankAutoProcess').then(m => m.processAutoBankQueue()); })
      .catch(() => {});
    const t = setTimeout(drainThenAuto, 1500);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') drainThenAuto(); });
    return () => { clearTimeout(t); sub.remove(); };
  }, []);

  // Retry Firestore writes for receipts/expenses saved on weak/no signal (they were
  // stored locally + flagged pendingSync so they never disappear). Cold start +
  // every foreground, so a save made offline lands in the cloud once back online.
  useEffect(() => {
    const t = setTimeout(() => { flushPendingExpenseWrites().catch(() => {}); }, 2500);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushPendingExpenseWrites().catch(() => {});
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
        router.navigate({ pathname: '/(tabs)/mood', params: { openCheckIn: 'true' } } as any);
      } else if (screen === 'tasks') {
        if (taskId) router.navigate(`/tasks/${taskId}` as any);
        else        router.navigate('/(tabs)/tasks' as any);
      } else if (screen === 'calendar' || screen === 'calendar_event') {
        if (eventId) router.navigate(`/calendar/${eventId}` as any);
        else         router.navigate('/(tabs)/stats' as any); // calendar lives in the stats tab
      } else if (screen === 'habits') {
        router.navigate('/habits' as any);
      } else if (screen === 'subscriptions') {
        router.navigate('/expenses/subscriptions' as any);
      } else if (screen === 'vehicles') {
        router.navigate('/vehicles' as any);   // "Serwis / wymiana" reminder
      } else if (screen === 'finances') {
        router.navigate('/(tabs)/finances' as any);
      } else if (screen === 'index') {
        router.navigate('/(tabs)/' as any);       // work shift → dashboard (live earnings widget)
      } else if (screen === 'payday') {
        router.navigate('/(tabs)/' as any);       // → dashboard, then open the "add paycheck" modal directly
        setTimeout(() => useUiActions.getState().openPaydayPrompt(), 400);
      } else if (screen === 'work' || screen === 'stats') {
        router.navigate('/(tabs)/stats' as any);
      } else if (screen === 'month-cards') {
        router.navigate('/month-cards' as any);
      } else if (screen === 'pet') {
        router.navigate('/pet' as any);           // pupil nudge (skrzynka dnia / nagrody / tęskni)
      } else {
        // Never leave a tap dead — fall back to the dashboard.
        router.navigate('/(tabs)/' as any);
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

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={authReady ? colors.bg.primary : '#083A64'} />
        {authReady && (
        <>
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
        </>
        )}
        {!splashGone && (
          <AnimatedSplash visible={!(authReady && minSplashDone)} onHidden={() => setSplashGone(true)} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
