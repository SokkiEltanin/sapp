import { useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Tabs, usePathname, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  runOnJS, cancelAnimation,
} from 'react-native-reanimated';
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
  const idxSV = useSharedValue(tabIdx(pathname));
  const tx    = useSharedValue(0);
  const busy  = useSharedValue(false);

  useEffect(() => {
    cancelAnimation(tx);
    idxSV.value = tabIdx(pathname);
    busy.value  = false;
    tx.value    = 0;
  }, [pathname]);

  const doNavigate = useCallback((path: string) => {
    router.navigate(path as any);
  }, []);

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-20, 20])
    .onUpdate(e => {
      'worklet';
      if (busy.value) return;
      const i = idxSV.value;
      const blocked = (e.translationX > 0 && i === 0) || (e.translationX < 0 && i === TABS.length - 1);
      tx.value = blocked ? e.translationX * 0.06 : e.translationX;
    })
    .onEnd(e => {
      'worklet';
      if (busy.value) return;
      const i   = idxSV.value;
      const ok  = Math.abs(e.translationX) > W * 0.25 || Math.abs(e.velocityX) > 500;
      const fwd = e.translationX < 0 && i < TABS.length - 1;
      const bck = e.translationX > 0 && i > 0;

      if (!ok || !(fwd || bck)) {
        tx.value = withSpring(0, { damping: 26, stiffness: 280 });
        return;
      }

      // Instant snap, then navigate — any animation reveals gray background
      busy.value = true;
      const nextI = fwd ? i + 1 : i - 1;
      tx.value = 0;
      runOnJS(doNavigate)(TABS[nextI] as string);
    }),
  []);

  // Current screen slides with tx
  const screenStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: tx.value }],
  }));

  // Adjacent fill: same bg color, stays beside the sliding screen so no gray gap is visible
  const adjacentStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.primary,
    // When sliding left (tx<0): fill is to the right (tx+W)
    // When sliding right (tx>0): fill is to the left (tx-W)
    transform: [{ translateX: tx.value + (tx.value < 0 ? W : -W) }],
  }));

  return (
    <View style={s.root}>
      {/* Global TopPill — fixed, never slides */}
      <SafeAreaView style={s.topArea} edges={['top']}>
        <TopPill />
      </SafeAreaView>

      {/* Sliding tab screens */}
      <GestureDetector gesture={pan}>
        <View style={s.swipeContainer}>
          {/* Fills the gap beside the sliding screen — prevents gray background flash */}
          <Animated.View style={adjacentStyle} pointerEvents="none" />
          <Animated.View style={screenStyle}>
            <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
              <Tabs.Screen name="index"    />
              <Tabs.Screen name="tasks"    />
              <Tabs.Screen name="stats"    />
              <Tabs.Screen name="finances" />
              <Tabs.Screen name="analytics" options={{ href: null }} />
              <Tabs.Screen name="calendar"  options={{ href: null }} />
              <Tabs.Screen name="mood"      options={{ href: null }} />
              <Tabs.Screen name="health"    options={{ href: null }} />
            </Tabs>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Fixed tab bar */}
      <TabBar currentIndex={tabIdx(pathname)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: colors.bg.primary },
  topArea:        { backgroundColor: 'transparent' },
  swipeContainer: { flex: 1, overflow: 'hidden' },
});
