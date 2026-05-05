import { useEffect, Component, ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
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
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen as string | undefined;
      if (screen === 'mood')     router.push('/(tabs)/mood' as any);
      else if (screen === 'calendar') router.push('/(tabs)/calendar' as any);
      else if (screen === 'tasks')   router.push('/(tabs)/tasks' as any);
      else if (screen === 'habits')  router.push('/habits' as any);
    });
    return () => sub.remove();
  }, []);

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={colors.bg.primary} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="expenses/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="expenses/scan" options={{ presentation: 'modal' }} />
          <Stack.Screen name="expenses/stats" />
          <Stack.Screen name="expenses/[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="search" options={{ presentation: 'modal' }} />
          <Stack.Screen name="calendar/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="tasks/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="tasks/[id]" />
          <Stack.Screen name="calendar/[id]" />
          <Stack.Screen name="pomodoro" options={{ presentation: 'modal' }} />
          <Stack.Screen name="habits" />
          <Stack.Screen name="weekly" />
          <Stack.Screen name="focus" options={{ presentation: 'modal' }} />
          <Stack.Screen name="notes" />
        </Stack>
        <PomodoroIndicator />
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
