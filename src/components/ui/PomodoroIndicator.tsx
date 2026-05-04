import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
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
    <View style={styles.wrap}>
      <TouchableOpacity onPress={() => router.push('/pomodoro' as any)} activeOpacity={0.8} style={styles.pill}>
        <Animated.View style={[styles.dot, { backgroundColor: modeColor, opacity: pulse }]} />
        <Timer size={11} color={modeColor} />
        <Text style={[styles.time, { color: modeColor }]}>{fmt(remaining)}</Text>
        {taskTitle && (
          <Text style={styles.task} numberOfLines={1}>{taskTitle}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 88,
    alignSelf: 'center',
    zIndex: 999,
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
