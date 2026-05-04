import { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, Play, Pause, SkipForward, RotateCcw, Timer } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import GlassCard from '@/components/ui/GlassCard';
import { usePomodoroStore, PomodoroMode } from '@/store/pomodoroStore';
import { tasksService } from '@/services/calendarService';
import { useCalendarStore } from '@/store/calendarStore';
import { colors, spacing, radius, typography } from '@/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const MODE_META: Record<PomodoroMode, { label: string; color: string; hint: string }> = {
  work:       { label: 'PRACA',        color: colors.text.primary,  hint: 'Skupiony czas pracy' },
  break:      { label: 'PRZERWA',      color: colors.accent.success, hint: 'Krótka przerwa' },
  long_break: { label: 'DŁUGA PRZERWA', color: colors.accent.warning, hint: 'Czas odetchnąć' },
};

// ─── Ring progress (two-half technique) ──────────────────────────────────────

function RingProgress({ pct, size = 200, stroke = 8, color = colors.text.primary }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const half = size / 2;
  const prog = Math.max(0, Math.min(1, pct));

  const rightRotation = prog < 0.5 ? 180 - (prog / 0.5) * 180 : 0;
  const leftRotation  = prog >= 0.5 ? 180 - ((prog - 0.5) / 0.5) * 180 : 180;

  const arcBase = {
    position: 'absolute' as const,
    width: size, height: size,
    borderRadius: half,
    borderWidth: stroke,
  };

  return (
    <View style={{ width: size, height: size }}>
      {/* Track */}
      <View style={[arcBase, { borderColor: 'rgba(255,255,255,0.07)' }]} />

      {/* Right half clip — fills first 50% */}
      <View style={{ position: 'absolute', top: 0, right: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={[arcBase, {
          left: -half,
          borderColor: color,
          transform: [{ rotate: `${rightRotation}deg` }],
        }]} />
      </View>

      {/* Left half clip — fills second 50% */}
      {prog >= 0.5 && (
        <View style={{ position: 'absolute', top: 0, left: 0, width: half, height: size, overflow: 'hidden' }}>
          <View style={[arcBase, {
            left: 0,
            borderColor: color,
            transform: [{ rotate: `${leftRotation}deg` }],
          }]} />
        </View>
      )}
    </View>
  );
}

// ─── Round dots ───────────────────────────────────────────────────────────────

function RoundDots({ completed }: { completed: number }) {
  return (
    <View style={dots.row}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[dots.dot, i < (completed % 4) && dots.dotFilled]}
        />
      ))}
    </View>
  );
}
const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  dotFilled: { backgroundColor: colors.text.primary },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PomodoroScreen() {
  const {
    taskId, taskTitle, mode, remaining, isRunning,
    workMins, completedRounds,
    pause, resume, reset, nextRound,
  } = usePomodoroStore();
  const updateTaskStore = useCalendarStore(s => s.updateTask);

  const totalSecs = mode === 'work'
    ? workMins * 60
    : mode === 'break' ? 5 * 60 : 15 * 60;

  const pct = 1 - remaining / totalSecs;
  const { label, color, hint } = MODE_META[mode];

  const prevRemaining = useRef(remaining);
  useEffect(() => {
    if (prevRemaining.current > 0 && remaining === 0) {
      Vibration.vibrate([0, 300, 100, 300]);
    }
    prevRemaining.current = remaining;
  }, [remaining]);

  const prevRounds = useRef(completedRounds);
  useEffect(() => {
    if (completedRounds > prevRounds.current && taskId) {
      tasksService.updateTask(taskId, { completedPomodoros: completedRounds })
        .then(() => updateTaskStore(taskId, { completedPomodoros: completedRounds }))
        .catch(() => {});
    }
    prevRounds.current = completedRounds;
  }, [completedRounds]);

  const done = remaining === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
          <X size={20} color={colors.text.secondary} />
        </PressableScale>
        <View style={styles.headerCenter}>
          <Timer size={14} color={colors.text.muted} />
          <Text style={styles.headerTitle}>Pomodoro</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.body}>
        {/* Ring + time */}
        <View style={styles.ringWrap}>
          <RingProgress pct={pct} size={220} stroke={10} color={color} />

          <View style={styles.ringCenter}>
            {/* Mode badge */}
            <View style={[styles.modeBadge, { borderColor: color + '30', backgroundColor: color + '12' }]}>
              <Text style={[styles.modeText, { color }]}>{label}</Text>
            </View>

            {/* Time */}
            <Text style={[styles.timeText, done && { color: color }]}>
              {done ? 'KONIEC!' : fmt(remaining)}
            </Text>

            {/* Task name */}
            {taskTitle && (
              <Text style={styles.taskName} numberOfLines={1}>{taskTitle}</Text>
            )}
          </View>
        </View>

        {/* Hint */}
        <View style={styles.hintRow}>
          <Text style={styles.hint}>{done ? 'Świetna robota!' : hint}</Text>
          <RoundDots completed={completedRounds} />
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Reset */}
          <PressableScale onPress={reset} style={styles.iconBtn}>
            <RotateCcw size={18} color={colors.text.muted} />
          </PressableScale>

          {/* Play/Pause — main */}
          {done ? (
            <PressableScale onPress={nextRound} style={styles.mainBtn}>
              <SkipForward size={26} color={colors.bg.primary} />
            </PressableScale>
          ) : (
            <PressableScale
              onPress={isRunning ? pause : resume}
              style={styles.mainBtn}
            >
              {isRunning
                ? <Pause size={26} color={colors.bg.primary} />
                : <Play size={26} color={colors.bg.primary} />
              }
            </PressableScale>
          )}

          {/* Skip */}
          <PressableScale onPress={nextRound} style={styles.iconBtn}>
            <SkipForward size={18} color={colors.text.muted} />
          </PressableScale>
        </View>

        {/* Settings strip */}
        <View>
          <GlassCard padding={spacing[4]} style={styles.settingsCard}>
            <Text style={styles.settingsLabel}>Ustawienia sesji</Text>
            <View style={styles.settingsRow}>
              {[15, 20, 25, 30, 45].map((mins) => {
                const active = workMins === mins;
                return (
                  <PressableScale
                    key={mins}
                    onPress={() => usePomodoroStore.getState().setWorkMins(mins)}
                    style={[styles.minBtn, active && styles.minBtnActive]}
                  >
                    <Text style={[styles.minText, active && styles.minTextActive]}>{mins}</Text>
                    <Text style={[styles.minUnit, active && { color: colors.bg.primary }]}>min</Text>
                  </PressableScale>
                );
              })}
            </View>
          </GlassCard>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  headerTitle: { ...typography.h4, color: colors.text.primary },

  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[4], gap: spacing[6],
  },

  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: {
    position: 'absolute', alignItems: 'center', gap: spacing[2],
    width: 160,
  },
  modeBadge: {
    paddingHorizontal: spacing[3], paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
  },
  modeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  timeText: {
    fontSize: 52, fontWeight: '800', color: colors.text.primary,
    letterSpacing: -2, lineHeight: 58,
  },
  taskName: {
    ...typography.caption, color: colors.text.muted,
    fontSize: 11, textAlign: 'center',
  },

  hintRow: { flexDirection: 'column', alignItems: 'center', gap: spacing[3] },
  hint: { ...typography.caption, color: colors.text.muted, fontSize: 12 },

  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing[5] },
  iconBtn: {
    width: 48, height: 48, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  mainBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.text.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  settingsCard: { width: '100%' },
  settingsLabel: { fontSize: 10, fontWeight: '600', color: colors.text.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing[3] },
  settingsRow: { flexDirection: 'row', gap: spacing[2] },
  minBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  minBtnActive: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
  minText: { fontSize: 16, fontWeight: '700', color: colors.text.secondary },
  minTextActive: { color: colors.bg.primary },
  minUnit: { fontSize: 8, color: colors.text.muted, marginTop: 1 },
});

