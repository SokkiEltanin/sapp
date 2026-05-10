import { useRef, useEffect, useCallback } from 'react';
import { PanResponder, Animated, Dimensions } from 'react-native';
import { router, usePathname, useFocusEffect } from 'expo-router';

const TABS = ['/', '/tasks', '/finances'] as const;
const { width: W } = Dimensions.get('window');

// Set before navigate() so the incoming screen reads it in useFocusEffect
let pendingDirection: -1 | 0 | 1 = 0;

export function useTabSwipe() {
  const pathname   = usePathname();
  const pathRef    = useRef(pathname);
  const translateX = useRef(new Animated.Value(0)).current;

  // Keep pathRef current so PanResponder closures get the live pathname
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  // Fires ONLY on the screen that just gained focus — no cross-screen conflicts
  useFocusEffect(
    useCallback(() => {
      const dir = pendingDirection;
      if (dir !== 0) {
        // Arrived here via swipe — slide in from the correct off-screen edge
        pendingDirection = 0;
        translateX.setValue(-dir * W);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 220,
          friction: 26,
        }).start();
      } else {
        // Normal focus (tab press, back nav, app resume) — snap to center
        translateX.setValue(0);
      }
    }, []),
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
        // Block gesture capture when a modal / non-tab screen is on top
        if (!TABS.includes(pathRef.current as any)) return false;
        return Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 2.5;
      },

      onPanResponderMove: (_, { dx }) => {
        const idx = TABS.indexOf(pathRef.current as any);
        if (idx < 0) return;
        const atStart = dx > 0 && idx === 0;
        const atEnd   = dx < 0 && idx === TABS.length - 1;
        translateX.setValue(atStart || atEnd ? dx * 0.1 : dx);
      },

      onPanResponderRelease: (_, { dx, vx }) => {
        const idx = TABS.indexOf(pathRef.current as any);
        if (idx < 0) { translateX.setValue(0); return; }

        const isSwipe = Math.abs(dx) > W * 0.25 || Math.abs(vx) > 0.45;
        const canNext = dx < 0 && idx < TABS.length - 1;
        const canPrev = dx > 0 && idx > 0;

        if (!isSwipe || !(canNext || canPrev)) {
          // Not enough — spring back
          Animated.spring(translateX, {
            toValue: 0, useNativeDriver: true,
            tension: 260, friction: 28,
          }).start();
          return;
        }

        const dir: -1 | 1 = dx < 0 ? -1 : 1;
        pendingDirection = dir; // incoming screen reads this in useFocusEffect

        // Slide current screen off-screen, THEN navigate
        Animated.timing(translateX, {
          toValue: dir * W,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          if (canNext) router.navigate(TABS[idx + 1] as any);
          if (canPrev) router.navigate(TABS[idx - 1] as any);
          // translateX for this (now hidden) screen is reset by useFocusEffect on next visit
        });
      },

      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0, useNativeDriver: true,
          tension: 240, friction: 26,
        }).start();
      },
    }),
  ).current;

  return {
    panHandlers:   panResponder.panHandlers,
    animatedStyle: { transform: [{ translateX }] } as const,
  };
}
