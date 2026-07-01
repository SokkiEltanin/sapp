import { useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Tabs, usePathname, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors } from '@/theme';
import { useColors } from '@/theme/useColors';
import TabBar from '@/components/ui/TabBar';
import TopPill from '@/components/ui/TopPill';
import { useUiPrefs } from '@/store/uiPrefs';

const W = Dimensions.get('window').width;
const TABS = ['/', '/tasks', '/stats', '/finances', '/health'] as const;

function tabIdx(path: string): number {
  const i = (TABS as readonly string[]).indexOf(path);
  return i >= 0 ? i : 0;
}

export default function TabsLayout() {
  const pathname = usePathname();
  const currentIdx = tabIdx(pathname);
  const c = useColors();
  // Opt-in slide between boards. Safe now because all screens stay mounted
  // (detachInactiveScreens=false + lazy=false), so the destination is already laid
  // out during the v7 'shift' transition — no empty-slide / teleport pop-in like the
  // old custom translateX attempt. Default 'none' keeps the instant switch.
  const tabSlide = useUiPrefs(s => s.tabSlide);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= TABS.length) return;
    router.navigate(TABS[idx] as any);
  }, []);

  // Pure swipe-detection — NO visual drag. The gesture only reads direction and
  // navigates. Nothing translates on screen, so there is no gray gap and no
  // "pop-in" of the next screen. Reliable by construction.
  //
  // CRITICAL: the worklet must NOT call the JS function tabIdx() — that crashes
  // Reanimated. We capture `currentIdx` (a plain number) into the worklet closure
  // instead; primitives are safe to capture.
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-22, 22])
    .failOffsetY([-24, 24])
    .onEnd(e => {
      'worklet';
      const ok = Math.abs(e.translationX) > W * 0.28 || Math.abs(e.velocityX) > 550;
      if (!ok) return;
      if (e.translationX < 0 && currentIdx < TABS.length - 1) runOnJS(goTo)(currentIdx + 1);
      else if (e.translationX > 0 && currentIdx > 0)          runOnJS(goTo)(currentIdx - 1);
    }),
  [currentIdx, goTo]);

  return (
    <View style={[s.root, { backgroundColor: c.bg.primary }]}>
      {/* Global TopPill — fixed */}
      <SafeAreaView style={s.topArea} edges={['top']}>
        <TopPill />
      </SafeAreaView>

      {/* Tab screens — swipe to switch (instant, no drag animation).
          detachInactiveScreens=false + lazy=false keep all screens mounted AND
          attached to the native hierarchy, so switching is a pure visibility
          toggle with no repaint → no gray flash, no double-render. */}
      <GestureDetector gesture={pan}>
        <View style={s.swipeContainer}>
          <Tabs
            tabBar={() => null}
            detachInactiveScreens={false}
            screenOptions={{
              headerShown: false,
              lazy: false,
              animation: tabSlide ? 'shift' : 'none',
              freezeOnBlur: true,
              sceneStyle: { backgroundColor: c.bg.primary },
            }}
          >
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
