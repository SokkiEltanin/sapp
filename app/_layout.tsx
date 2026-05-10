import { useEffect, useState, Component, ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { colors } from '@/theme';
import Toast from '@/components/ui/Toast';
import PomodoroIndicator from '@/components/ui/PomodoroIndicator';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={eb.wrap}>
        <Text style={eb.title}>Crash — skopiuj ten błąd i wyślij</Text>
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
  title: { color: '#FF5A5F', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  scroll: { flex: 1 },
  msg: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  stack: { color: '#aaa', fontSize: 11, lineHeight: 16 },
});

export default function RootLayout() {
  const [authReady, setAuthReady] = useState(false);

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

  useEffect(() => {
    function handleNotifResponse(response: Notifications.NotificationResponse) {
      const data = (response.notification.request.content.data ?? {}) as Record<string, any>;
      const { screen, taskId, eventId } = data;

      if (screen === 'mood') {
        router.push({ pathname: '/(tabs)/mood', params: { openCheckIn: 'true' } } as any);
      } else if (screen === 'tasks') {
        if (taskId) router.push(`/tasks/${taskId}` as any);
        else        router.push('/(tabs)/tasks' as any);
      } else if (screen === 'calendar' || screen === 'calendar_event') {
        if (eventId) router.push(`/calendar/${eventId}` as any);
        else         router.push('/(tabs)/tasks' as any);
      } else if (screen === 'habits') {
        router.push('/habits' as any);
      } else if (screen === 'subscriptions') {
        router.push('/expenses/subscriptions' as any);
      } else if (screen === 'finances') {
        router.push('/(tabs)/finances' as any);
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
          <Stack.Screen name="expenses/add" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="expenses/scan" options={{ animation: 'fade' }} />
          <Stack.Screen name="expenses/manual" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="expenses/subscriptions" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="expenses/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="search" options={{ animation: 'fade' }} />
          <Stack.Screen name="calendar/add" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="tasks/add" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="tasks/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="calendar/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pomodoro" options={{ animation: 'fade' }} />
          <Stack.Screen name="habits" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="weekly" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="focus" options={{ animation: 'fade' }} />
          <Stack.Screen name="notes" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="expenses/templates" options={{ animation: 'fade' }} />
        </Stack>
        <PomodoroIndicator />
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
