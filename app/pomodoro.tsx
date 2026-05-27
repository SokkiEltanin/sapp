import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Vibration, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { X, Play, Pause, SkipForward, RotateCcw, Timer, Volume2, VolumeX, CheckSquare, Square, Plus, Check, CheckCircle2 } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import GlassCard from '@/components/ui/GlassCard';
import { usePomodoroStore, PomodoroMode } from '@/store/pomodoroStore';
import { tasksService } from '@/services/calendarService';
import { useCalendarStore } from '@/store/calendarStore';
import { getTodaySessions, PomodoroSession } from '@/utils/pomodoroHistory';
import { useFocusSound, FocusSound, FOCUS_SOUND_LABELS } from '@/hooks/useFocusSound';
import { haptic } from '@/utils/haptics';
import { colors, spacing, radius, typography } from '@/theme';

const C = {
  accent: '#22D3EE',
  dim:    'rgba(34,211,238,0.14)',
  border: 'rgba(34,211,238,0.22)',
  muted:  'rgba(34,211,238,0.45)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const MODE_META: Record<PomodoroMode, { label: string; color: string; hint: string }> = {
  work:       { label: 'PRACA',         color: C.accent,              hint: 'Skupiony czas pracy' },
  break:      { label: 'PRZERWA',       color: colors.accent.success,  hint: 'Krótka przerwa' },
  long_break: { label: 'DŁUGA PRZERWA', color: colors.accent.warning,  hint: 'Czas odetchnąć' },
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
      <View style={[arcBase, { borderColor: 'rgba(255,255,255,0.07)' }]} />
      <View style={{ position: 'absolute', top: 0, right: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={[arcBase, {
          left: -half,
          borderColor: color,
          transform: [{ rotate: `${rightRotation}deg` }],
        }]} />
      </View>
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
        <View key={i} style={[dots.dot, i < (completed % 4) && dots.dotFilled]} />
      ))}
    </View>
  );
}
const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  dotFilled: { backgroundColor: C.accent },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PomodoroScreen() {
  const {
    taskId, taskTitle, mode, remaining, isRunning,
    workMins, completedRounds,
    pause, resume, reset, nextRound,
    milestones, addMilestone, toggleMilestone,
  } = usePomodoroStore();
  const updateTaskStore = useCalendarStore(s => s.updateTask);
  const { selected: focusSound, setSelected: setFocusSound } = useFocusSound(isRunning);

  const [newMilestone, setNewMilestone] = useState('');
  const [taskDismissed, setTaskDismissed] = useState(false);
  const [todaySessions, setTodaySessions] = useState<PomodoroSession[]>([]);

  const loadTodaySessions = useCallback(() => {
    getTodaySessions().then(setTodaySessions).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { loadTodaySessions(); }, [loadTodaySessions]));

  const prevTaskId = useRef(taskId);
  useEffect(() => {
    if (taskId !== prevTaskId.current) setTaskDismissed(false);
    prevTaskId.current = taskId;
  }, [taskId]);

  const totalSecs = mode === 'work'
    ? workMins * 60
    : mode === 'break' ? 5 * 60 : 15 * 60;

  const pct = 1 - remaining / totalSecs;
  const { label, color, hint } = MODE_META[mode];

  const prevRemaining = useRef(remaining);
  useEffect(() => {
    if (prevRemaining.current > 0 && remaining === 0) {
      // Double pulse: pleasant completion pattern
      Vibration.vibrate([0, 150, 80, 150, 80, 400]);
      haptic.success();
    }
    prevRemaining.current = remaining;
  }, [remaining]);

  const prevRounds = useRef(completedRounds);
  useEffect(() => {
    if (completedRounds > prevRounds.current) {
      if (taskId) {
        tasksService.updateTask(taskId, { completedPomodoros: completedRounds })
          .then(() => updateTaskStore(taskId, { completedPomodoros: completedRounds }))
          .catch(() => {});
      }
      loadTodaySessions();
    }
    prevRounds.current = completedRounds;
  }, [completedRounds]);

  const done = remaining === 0;

  const handleToggleMilestone = (id: string) => {
    const m = milestones.find(x => x.id === id);
    toggleMilestone(id);
    if (m && !m.done) haptic.success();
    else haptic.tap();
  };

  const handleAddMilestone = () => {
    const t = newMilestone.trim();
    if (!t) return;
    addMilestone(t);
    setNewMilestone('');
    haptic.tap();
  };

  const handleMarkTaskDone = async () => {
    if (!taskId) return;
    setTaskDismissed(true);
    haptic.success();
    const now = new Date().toISOString();
    try {
      await tasksService.updateTask(taskId, { status: 'done', updatedAt: now });
      updateTaskStore(taskId, { status: 'done', updatedAt: now });
    } catch {}
  };

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

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Ring + time */}
        <View style={styles.ringWrap}>
          <RingProgress pct={pct} size={220} stroke={10} color={color} />
          <View style={styles.ringCenter}>
            <View style={[styles.modeBadge, { borderColor: color + '30', backgroundColor: color + '12' }]}>
              <Text style={[styles.modeText, { color }]}>{label}</Text>
            </View>
            <Text style={[styles.timeText, done && { color }]}>
              {done ? 'KONIEC!' : fmt(remaining)}
            </Text>
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
          <PressableScale onPress={() => { reset(); haptic.tap(); }} style={styles.iconBtn}>
            <RotateCcw size={18} color={colors.text.muted} />
          </PressableScale>

          {done ? (
            <PressableScale onPress={() => { nextRound(); haptic.medium(); }} style={styles.mainBtn}>
              <SkipForward size={26} color={colors.bg.primary} />
            </PressableScale>
          ) : (
            <PressableScale
              onPress={() => { isRunning ? pause() : resume(); haptic.medium(); }}
              style={styles.mainBtn}
            >
              {isRunning
                ? <Pause size={26} color={colors.bg.primary} />
                : <Play size={26} color={colors.bg.primary} />
              }
            </PressableScale>
          )}

          <PressableScale onPress={() => { nextRound(); haptic.tap(); }} style={styles.iconBtn}>
            <SkipForward size={18} color={colors.text.muted} />
          </PressableScale>
        </View>

        {/* Task-done prompt — appears when work round ends with a linked task */}
        {done && mode === 'work' && !!taskId && !taskDismissed && (
          <View style={styles.taskDoneCard}>
            <View style={styles.taskDoneHeader}>
              <CheckCircle2 size={16} color={C.accent} />
              <Text style={styles.taskDoneTitle} numberOfLines={2}>{taskTitle}</Text>
            </View>
            <Text style={styles.taskDoneQuestion}>Zadanie ukończone?</Text>
            <View style={styles.taskDoneBtns}>
              <PressableScale onPress={handleMarkTaskDone} style={styles.taskDoneYes}>
                <Check size={14} color={colors.bg.primary} />
                <Text style={styles.taskDoneYesText}>Tak!</Text>
              </PressableScale>
              <PressableScale onPress={() => { setTaskDismissed(true); haptic.tap(); }} style={styles.taskDoneNo}>
                <Text style={styles.taskDoneNoText}>Jeszcze nie</Text>
              </PressableScale>
            </View>
          </View>
        )}

        {/* Milestones — only in work mode */}
        {mode === 'work' && (
          <GlassCard padding={spacing[4]} style={styles.milestoneCard}>
            <Text style={styles.settingsLabel}>Co robię w tej sesji</Text>

            {milestones.map(m => (
              <TouchableOpacity
                key={m.id}
                style={styles.milestoneRow}
                onPress={() => handleToggleMilestone(m.id)}
                activeOpacity={0.7}
              >
                {m.done
                  ? <CheckSquare size={16} color={C.accent} />
                  : <Square size={16} color={colors.text.muted} />}
                <Text style={[styles.milestoneText, m.done && styles.milestoneDone]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.milestoneInput}>
              <TextInput
                style={styles.milestoneInputField}
                value={newMilestone}
                onChangeText={setNewMilestone}
                placeholder="Dodaj krok..."
                placeholderTextColor={colors.text.muted}
                onSubmitEditing={handleAddMilestone}
                returnKeyType="done"
                maxLength={60}
              />
              <TouchableOpacity onPress={handleAddMilestone} hitSlop={8} activeOpacity={0.7}>
                <Plus size={16} color={newMilestone.trim() ? C.accent : colors.text.muted} />
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Settings strip */}
        <GlassCard padding={spacing[4]} style={styles.settingsCard}>
          <Text style={styles.settingsLabel}>Ustawienia sesji</Text>
          <View style={styles.settingsRow}>
            {[15, 20, 25, 30, 45].map((mins) => {
              const active = workMins === mins;
              return (
                <PressableScale
                  key={mins}
                  onPress={() => { usePomodoroStore.getState().setWorkMins(mins); haptic.tap(); }}
                  style={[styles.minBtn, active && styles.minBtnActive]}
                >
                  <Text style={[styles.minText, active && styles.minTextActive]}>{mins}</Text>
                  <Text style={[styles.minUnit, active && { color: colors.bg.primary }]}>min</Text>
                </PressableScale>
              );
            })}
          </View>

          <View style={styles.soundRow}>
            {focusSound === 'off'
              ? <VolumeX size={12} color={colors.text.muted} />
              : <Volume2 size={12} color={C.accent} />}
            <Text style={styles.soundRowLabel}>Dźwięk tła</Text>
          </View>
          <View style={styles.soundBtns}>
            {(['off', 'rain', 'noise', 'cafe'] as FocusSound[]).map(s => {
              const active = focusSound === s;
              return (
                <PressableScale
                  key={s}
                  onPress={() => { setFocusSound(s); haptic.tap(); }}
                  style={[styles.soundBtn, active && styles.soundBtnActive]}
                >
                  <Text style={[styles.soundBtnText, active && styles.soundBtnTextActive]}>
                    {FOCUS_SOUND_LABELS[s]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </GlassCard>
        {/* Today's sessions history */}
        {todaySessions.length > 0 && (
          <GlassCard padding={spacing[4]} style={styles.historyCard}>
            <Text style={styles.settingsLabel}>
              {'Sesje dzisiaj — ' + todaySessions.reduce((s, r) => s + r.durationMins, 0) + 'm'}
            </Text>
            {todaySessions.map((session, i) => (
              <View key={session.id} style={styles.historyRow}>
                <View style={styles.historyIndex}>
                  <Text style={styles.historyIndexText}>{i + 1}</Text>
                </View>
                <Text style={styles.historyTask} numberOfLines={1}>
                  {session.taskTitle ?? 'Wolna sesja'}
                </Text>
                <Text style={styles.historyDur}>{session.durationMins}m</Text>
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>
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

  scroll: {
    alignItems: 'center', paddingHorizontal: spacing[4],
    paddingTop: spacing[6], paddingBottom: spacing[8], gap: spacing[5],
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
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  milestoneCard: { width: '100%' },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  milestoneText: { flex: 1, fontSize: 14, color: colors.text.primary },
  milestoneDone: { color: colors.text.muted, textDecorationLine: 'line-through' },
  milestoneInput: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: spacing[3],
  },
  milestoneInputField: {
    flex: 1, fontSize: 13, color: colors.text.primary,
    paddingVertical: spacing[1],
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
  minBtnActive: { backgroundColor: C.dim, borderColor: C.border },
  minText: { fontSize: 16, fontWeight: '700', color: colors.text.secondary },
  minTextActive: { color: C.accent },
  minUnit: { fontSize: 8, color: colors.text.muted, marginTop: 1 },

  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[4], marginBottom: spacing[2] },
  soundRowLabel: { fontSize: 10, fontWeight: '600', color: colors.text.muted, letterSpacing: 1, textTransform: 'uppercase' },
  soundBtns: { flexDirection: 'row', gap: spacing[2] },
  soundBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[2],
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  soundBtnActive: { backgroundColor: C.dim, borderColor: C.border },
  soundBtnText: { fontSize: 11, fontWeight: '500', color: colors.text.muted },
  soundBtnTextActive: { color: C.accent, fontWeight: '700' },

  historyCard: { width: '100%' },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  historyIndex: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.dim, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  historyIndexText: { fontSize: 9, fontWeight: '800', color: C.accent },
  historyTask: { flex: 1, fontSize: 12, color: colors.text.secondary, fontWeight: '500' },
  historyDur: { fontSize: 11, fontWeight: '700', color: C.muted },

  taskDoneCard: {
    width: '100%',
    backgroundColor: C.dim, borderRadius: radius.xl,
    borderWidth: 1, borderColor: C.border,
    padding: spacing[4], gap: spacing[3],
  },
  taskDoneHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  taskDoneTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text.primary },
  taskDoneQuestion: { fontSize: 12, color: C.muted, fontWeight: '600', letterSpacing: 0.5 },
  taskDoneBtns: { flexDirection: 'row', gap: spacing[2] },
  taskDoneYes: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], backgroundColor: C.accent,
    borderRadius: radius.lg, paddingVertical: spacing[3],
  },
  taskDoneYesText: { fontSize: 14, fontWeight: '800', color: colors.bg.primary },
  taskDoneNo: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.lg, paddingVertical: spacing[3],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  taskDoneNoText: { fontSize: 13, fontWeight: '600', color: colors.text.muted },
});
