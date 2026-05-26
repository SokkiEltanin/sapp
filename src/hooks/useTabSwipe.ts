import { useRef, useEffect, useCallback } from 'react';
import { PanResponder, Animated, Dimensions } from 'react-native';
import { router, usePathname, useFocusEffect } from 'expo-router';

const TABS = ['/', '/tasks', '/stats', '/finances'] as const;
const { width: W } = Dimensions.get('window');

// Set before navigate() so the incoming screen reads it on mount / focus
let pendingDirection: -1 | 0 | 1 = 0;

export function useTabSwipe() {
  const pathname = usePathname();
  const pathRef  = useRef(pathname);

  // Initialize off-screen when arriving via swipe (pendingDirection is set
  // before router.navigate, so useRef picks it up on first mount)
  const translateX = useRef(
    new Animated.Value(pendingDirection !== 0 ? -pendingDirection * W : 0)
  ).current;

  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  useFocusEffect(
    useCallback(() => {
      const dir = pendingDirection;
      pendingDirection = 0; // consume immediately so re-renders don't re-read it

      if (dir !== 0) {
        // Might already be off-screen from useRef init (first mount) — setValue
        // is a no-op if value is already correct, so safe to call either way
        translateX.setValue(-dir * W);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 220,
          friction: 26,
        }).start();
      } else {
        translateX.setValue(0);
      }
    }, []),
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
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
          Animated.spring(translateX, {
            toValue: 0, useNativeDriver: true,
            tension: 260, friction: 28,
          }).start();
          return;
        }

        const dir: -1 | 1 = dx < 0 ? -1 : 1;
        pendingDirection = dir;

        Animated.timing(translateX, {
          toValue: dir * W,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          if (canNext) router.navigate(TABS[idx + 1] as any);
          if (canPrev) router.navigate(TABS[idx - 1] as any);
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
