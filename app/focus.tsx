import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  X, CheckCircle2, ChevronRight, Timer, CheckSquare, Square, Plus, Check,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useTasks } from '@/hooks/useTasks';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { Task } from '@/types';
import { colors, spacing, radius } from '@/theme';

const G = {
  card:       '#0D2318',
  cardBorder: 'rgba(61,190,117,0.18)',
  accent:     '#3DBE75',
  accentDim:  'rgba(61,190,117,0.14)',
  muted:      'rgba(61,190,117,0.45)',
};

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };

function priorityColor(p: string) {
  if (p === 'high') return colors.accent.red;
  if (p === 'low')  return colors.text.muted;
  return colors.accent.purple;
}

export default function FocusScreen() {
  const { tasks, toggle, toggleSubtask, create } = useTasks();
  const startPomodoro = usePomodoroStore(s => s.startFor);
  const [skipSet, setSkipSet] = useState<Set<string>>(new Set());
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState('');

  const today = todayStr();

  const queue = useMemo(() => {
    return tasks
      .filter(t =>
        t.status === 'pending' &&
        !skipSet.has(t.id) &&
        (
          t.deadline?.split('T')[0] === today ||
          t.scheduledDate === today ||
          t.priority === 'high' ||
          (!t.deadline && !t.scheduledDate) ||
          (t.deadline?.split('T')[0] && t.deadline.split('T')[0] < today) // overdue
        )
      )
      .sort((a, b) => {
        const po = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        if (po !== 0) return po;
        return (a.deadline ?? 'z').localeCompare(b.deadline ?? 'z');
      });
  }, [tasks, skipSet, today]);

  const task = queue[0] ?? null;
  const remaining = queue.length;

  const estimatedMins = useMemo(() => {
    const total = queue.reduce((sum, t) => sum + (t.estimatedPomodoros ?? 0), 0);
    return total > 0 ? total * 25 : null;
  }, [queue]);

  const handleDone = () => {
    if (!task) return;
    haptic.success();
    toggle(task.id);
    toast.success('Ukończono!');
  };

  const handleSkip = () => {
    if (!task) return;
    haptic.tap();
    setSkipSet(prev => new Set([...prev, task.id]));
  };

  const handlePomodoro = () => {
    if (!task) return;
    haptic.tap();
    startPomodoro(task.id, task.title);
    router.push('/pomodoro' as any);
  };

  const handleCapture = async () => {
    const t = captureText.trim();
    if (!t) { setCaptureOpen(false); return; }
    try {
      await create({ title: t, status: 'pending', priority: 'normal', tags: [] });
      toast.success('Dodano!');
      haptic.success();
    } catch {}
    setCaptureText('');
    setCaptureOpen(false);
  };

  const subtasksDone   = task?.subtasks?.filter(s => s.done).length ?? 0;
  const subtasksTotal  = task?.subtasks?.length ?? 0;
  const subtasksPct    = subtasksTotal > 0 ? subtasksDone / subtasksTotal : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
          <X size={20} color={colors.text.secondary} />
        </PressableScale>
        <Text style={styles.headerTitle}>Tryb skupienia</Text>
        <View style={styles.queueBadge}>
          <Text style={styles.queueText}>{remaining} zad.</Text>
          {estimatedMins !== null && (
            <Text style={styles.queueEstimate}>
              {'~' + (estimatedMins >= 60
                ? `${Math.floor(estimatedMins / 60)}h${estimatedMins % 60 > 0 ? `${estimatedMins % 60}m` : ''}`
                : `${estimatedMins}m`)}
            </Text>
          )}
        </View>
      </View>

      {task ? (
        <View style={styles.body}>
          {/* Priority badge */}
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor(task.priority) + '18', borderColor: priorityColor(task.priority) + '40' }]}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor(task.priority) }]} />
            <Text style={[styles.priorityText, { color: priorityColor(task.priority) }]}>
              {{ high: 'Pilne', normal: 'Normalne', low: 'Niski priorytet' }[task.priority] ?? 'Normal'}
            </Text>
          </View>

          {/* Task title */}
          <Text style={styles.taskTitle}>{task.title}</Text>

          {task.description ? (
            <Text style={styles.taskDesc}>{task.description}</Text>
          ) : null}

          {/* Deadline */}
          {task.deadline && (
            <Text style={styles.deadline}>
              Termin: {task.deadline.split('T')[0]}
            </Text>
          )}

          {/* Subtasks */}
          {subtasksTotal > 0 && (
            <View style={styles.subtasksCard}>
              <View style={styles.subtasksHeader}>
                <Text style={styles.subtasksLabel}>Kroki</Text>
                <Text style={styles.subtasksCount}>{subtasksDone}/{subtasksTotal}</Text>
              </View>
              <View style={styles.subtasksProgressTrack}>
                <View style={[styles.subtasksProgressFill, {
                  width: `${subtasksPct * 100}%`,
                  backgroundColor: subtasksPct === 1 ? G.accent : colors.accent.blue,
                }]} />
              </View>
              <View style={styles.subtasksList}>
                {task.subtasks?.map(sub => (
                  <TouchableOpacity
                    key={sub.id}
                    style={styles.subtaskRow}
                    onPress={() => toggleSubtask(task.id, sub.id)}
                    activeOpacity={0.75}
                  >
                    {sub.done
                      ? <CheckSquare size={18} color={G.accent} />
                      : <Square size={18} color='rgba(255,255,255,0.2)' strokeWidth={1.5} />
                    }
                    <Text style={[styles.subtaskText, sub.done && styles.subtaskTextDone]}>
                      {sub.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Pomodoro CTA */}
          <PressableScale onPress={handlePomodoro} style={styles.pomCta}>
            <Timer size={16} color={colors.accent.purple} />
            <Text style={styles.pomCtaText}>
              {'Zacznij Pomodoro' + (task.estimatedPomodoros ? ` · ${task.estimatedPomodoros}×25 min` : '')}
            </Text>
            <ChevronRight size={14} color={colors.accent.purple} />
          </PressableScale>

          {/* Actions */}
          <View style={styles.actions}>
            <PressableScale onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Pomiń</Text>
            </PressableScale>
            <PressableScale onPress={handleDone} style={styles.doneBtn}>
              <CheckCircle2 size={22} color={colors.bg.primary} />
              <Text style={styles.doneBtnText}>Gotowe!</Text>
            </PressableScale>
          </View>

          {/* Queue preview */}
          {queue.length > 1 && (
            <View style={styles.nextWrap}>
              <Text style={styles.nextLabel}>Następne:</Text>
              <Text style={styles.nextTitle} numberOfLines={1}>{queue[1].title}</Text>
            </View>
          )}

          {/* Quick capture */}
          <View style={styles.captureWrap}>
            {captureOpen ? (
              <View style={styles.captureInputRow}>
                <TextInput
                  autoFocus
                  style={styles.captureInput}
                  value={captureText}
                  onChangeText={setCaptureText}
                  placeholder="Nowe zadanie..."
                  placeholderTextColor={G.muted}
                  onSubmitEditing={handleCapture}
                  returnKeyType="done"
                  maxLength={80}
                />
                <TouchableOpacity onPress={handleCapture} hitSlop={8} activeOpacity={0.7}>
                  <Check size={16} color={captureText.trim() ? G.accent : G.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setCaptureOpen(false); setCaptureText(''); }} hitSlop={8} activeOpacity={0.7}>
                  <X size={14} color={G.muted} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setCaptureOpen(true); haptic.tap(); }} style={styles.captureBtn} activeOpacity={0.7}>
                <Plus size={11} color={G.muted} />
                <Text style={styles.captureBtnText}>Przechwyt</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.emptyBody}>
          <CheckCircle2 size={64} color={G.accent} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Wszystko zrobione!</Text>
          <Text style={styles.emptySub}>
            {skipSet.size > 0
              ? `Pominięto ${skipSet.size} zadań`
              : 'Nie ma aktywnych zadań na dziś'}
          </Text>
          <PressableScale onPress={() => router.back()} style={styles.backHome}>
            <Text style={styles.backHomeText}>Wróć</Text>
          </PressableScale>

          {/* Quick capture in empty state */}
          <View style={[styles.captureWrap, { marginTop: spacing[2] }]}>
            {captureOpen ? (
              <View style={styles.captureInputRow}>
                <TextInput
                  autoFocus
                  style={styles.captureInput}
                  value={captureText}
                  onChangeText={setCaptureText}
                  placeholder="Nowe zadanie..."
                  placeholderTextColor={G.muted}
                  onSubmitEditing={handleCapture}
                  returnKeyType="done"
                  maxLength={80}
                />
                <TouchableOpacity onPress={handleCapture} hitSlop={8} activeOpacity={0.7}>
                  <Check size={16} color={captureText.trim() ? G.accent : G.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setCaptureOpen(false); setCaptureText(''); }} hitSlop={8} activeOpacity={0.7}>
                  <X size={14} color={G.muted} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setCaptureOpen(true); haptic.tap(); }} style={styles.captureBtn} activeOpacity={0.7}>
                <Plus size={11} color={G.muted} />
                <Text style={styles.captureBtnText}>Przechwyt</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: G.card, borderWidth: 1, borderColor: G.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 14, fontWeight: '700', color: colors.text.secondary },
  queueBadge: {
    paddingHorizontal: spacing[3], paddingVertical: 5,
    borderRadius: radius.full, backgroundColor: G.accentDim,
    borderWidth: 1, borderColor: G.cardBorder,
    alignItems: 'center',
  },
  queueText: { fontSize: 11, fontWeight: '600', color: G.muted },
  queueEstimate: { fontSize: 9, fontWeight: '500', color: G.muted, marginTop: 1 },

  body: {
    flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6],
    gap: spacing[4],
  },

  priorityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3], paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1,
  },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 11, fontWeight: '700' },

  taskTitle: {
    fontSize: 32, fontWeight: '900', color: colors.text.primary,
    lineHeight: 40, letterSpacing: -0.5,
  },
  taskDesc: { fontSize: 14, color: colors.text.secondary, lineHeight: 22 },
  deadline: { fontSize: 12, color: colors.text.muted, fontWeight: '500' },

  subtasksCard: {
    backgroundColor: G.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: G.cardBorder,
    padding: spacing[4], gap: spacing[3],
  },
  subtasksHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subtasksLabel: { fontSize: 11, fontWeight: '700', color: colors.text.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  subtasksCount: { fontSize: 12, fontWeight: '700', color: colors.text.secondary },
  subtasksProgressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  subtasksProgressFill: { height: 3, borderRadius: radius.full },
  subtasksList: { gap: spacing[2] },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 2 },
  subtaskText: { flex: 1, fontSize: 14, color: colors.text.primary, fontWeight: '500' },
  subtaskTextDone: { textDecorationLine: 'line-through', color: colors.text.muted },

  pomCta: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.accent.purple + '15',
    borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.accent.purple + '35',
    padding: spacing[4],
  },
  pomCtaText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.accent.purple },

  actions: { flexDirection: 'row', gap: spacing[3], marginTop: 'auto' },
  skipBtn: {
    flex: 1, paddingVertical: spacing[4], borderRadius: radius.xl,
    backgroundColor: G.card, borderWidth: 1, borderColor: G.cardBorder,
    alignItems: 'center',
  },
  skipText: { fontSize: 15, fontWeight: '600', color: G.muted },
  doneBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[4], borderRadius: radius.xl,
    backgroundColor: G.accent,
  },
  doneBtnText: { fontSize: 17, fontWeight: '800', color: colors.bg.primary },

  nextWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[3],
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },
  nextLabel: { fontSize: 11, color: colors.text.muted, fontWeight: '600' },
  nextTitle: { flex: 1, fontSize: 12, color: colors.text.secondary },

  captureWrap: { paddingBottom: spacing[1] },
  captureBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  captureBtnText: { fontSize: 12, color: G.muted, fontWeight: '500' },
  captureInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: G.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: G.cardBorder,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  captureInput: { flex: 1, fontSize: 14, color: colors.text.primary, paddingVertical: 4 },

  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  emptyTitle: { fontSize: 26, fontWeight: '900', color: colors.text.primary },
  emptySub: { fontSize: 14, color: colors.text.muted, textAlign: 'center', lineHeight: 22 },
  backHome: {
    marginTop: spacing[4], paddingHorizontal: spacing[6], paddingVertical: spacing[4],
    backgroundColor: G.accentDim, borderRadius: radius.xl,
    borderWidth: 1, borderColor: G.cardBorder,
  },
  backHomeText: { fontSize: 15, fontWeight: '700', color: G.accent },
});
