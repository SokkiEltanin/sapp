import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { colors } from '@/theme';
import Toast from '@/components/ui/Toast';
import PomodoroIndicator from '@/components/ui/PomodoroIndicator';

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
  );
}
