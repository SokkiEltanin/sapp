import { useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Tabs, usePathname, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors } from '@/theme';
import TabBar from '@/components/ui/TabBar';
import TopPill from '@/components/ui/TopPill';

const W = Dimensions.get('window').width;
const TABS = ['/', '/tasks', '/stats', '/finances'] as const;

function tabIdx(path: string): number {
  const i = (TABS as readonly string[]).indexOf(path);
  return i >= 0 ? i : 0;
}

export default function TabsLayout() {
  const pathname = usePathname();
  const currentIdx = tabIdx(pathname);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= TABS.length) return;
    router.navigate(TABS[idx] as any);
  }, []);

  // Pure swipe-detection — NO visual drag. The gesture only reads direction and
  // navigates. Nothing translates on screen, so there is no gray gap and no
  // "pop-in" of the next screen. Reliable by construction.
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-22, 22])
    .failOffsetY([-24, 24])
    .onEnd(e => {
      'worklet';
      const ok = Math.abs(e.translationX) > W * 0.28 || Math.abs(e.velocityX) > 550;
      if (!ok) return;
      const i = tabIdx(pathname);
      if (e.translationX < 0 && i < TABS.length - 1) runOnJS(goTo)(i + 1);
      else if (e.translationX > 0 && i > 0)          runOnJS(goTo)(i - 1);
    }),
  [pathname, goTo]);

  return (
    <View style={s.root}>
      {/* Global TopPill — fixed */}
      <SafeAreaView style={s.topArea} edges={['top']}>
        <TopPill />
      </SafeAreaView>

      {/* Tab screens — swipe to switch (instant, no drag animation) */}
      <GestureDetector gesture={pan}>
        <View style={s.swipeContainer}>
          <Tabs tabBar={() => null} screenOptions={{ headerShown: false, lazy: false, animation: 'none' }}>
            <Tabs.Screen name="index"    />
            <Tabs.Screen name="tasks"    />
            <Tabs.Screen name="stats"    />
            <Tabs.Screen name="finances" />
            <Tabs.Screen name="analytics" options={{ href: null }} />
            <Tabs.Screen name="calendar"  options={{ href: null }} />
            <Tabs.Screen name="mood"      options={{ href: null }} />
            <Tabs.Screen name="health"    options={{ href: null }} />
          </Tabs>
        </View>
      </GestureDetector>

      {/* Fixed tab bar */}
      <TabBar currentIndex={currentIdx} />
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: colors.bg.primary },
  topArea:        { backgroundColor: 'transparent' },
  swipeContainer: { flex: 1, overflow: 'hidden' },
});
