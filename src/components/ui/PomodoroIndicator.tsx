import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { router } from 'expo-router';
import { Timer } from 'lucide-react-native';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { colors, spacing, radius } from '@/theme';

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PomodoroIndicator() {
  const { isRunning, remaining, mode, taskTitle } = usePomodoroStore();

  const pulse = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const pan = useRef(new Animated.ValueXY()).current;
  const didMove = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        didMove.current = false;
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gs) => {
        didMove.current = true;
        pan.setValue({ x: gs.dx, y: gs.dy });
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        if (!didMove.current) {
          router.push('/pomodoro' as any);
        }
      },
    })
  ).current;

  useEffect(() => {
    loopRef.current?.stop();
    if (isRunning) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
        ])
      );
      loopRef.current.start();
    } else {
      pulse.setValue(0.3);
    }
    return () => loopRef.current?.stop();
  }, [isRunning]);

  if (!isRunning && remaining === usePomodoroStore.getState().workMins * 60) return null;

  const modeColor = mode === 'work'
    ? colors.text.primary
    : mode === 'break' ? colors.accent.success : colors.accent.warning;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View
        style={[styles.draggable, { transform: pan.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={() => { if (!didMove.current) router.push('/pomodoro' as any); }}
          activeOpacity={0.85}
          style={styles.pill}
        >
          <Animated.View style={[styles.dot, { backgroundColor: modeColor, opacity: pulse }]} />
          <Timer size={11} color={modeColor} />
          <Text style={[styles.time, { color: modeColor }]}>{fmt(remaining)}</Text>
          {taskTitle && (
            <Text style={styles.task} numberOfLines={1}>{taskTitle}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0, right: 0,
    bottom: 88,
    alignItems: 'center',
    zIndex: 999,
  },
  draggable: {
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderRadius: radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 7, paddingHorizontal: spacing[4],
    maxWidth: 240,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  time: { fontSize: 13, fontWeight: '700', letterSpacing: -0.3 },
  task: { fontSize: 11, color: colors.text.muted, flex: 1 },
});
