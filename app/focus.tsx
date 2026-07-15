import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  X, Timer, CheckSquare, Square, Plus, Check, ArrowLeft,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useTasks } from '@/hooks/useTasks';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';

const G = {
  card:       '#0C2218',
  cardBorder: 'rgba(46,222,160,0.20)',
  accent:     '#2EDEA0',
  accentDim:  'rgba(46,222,160,0.18)',
  muted:      'rgba(46,222,160,0.50)',
};

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DOW_PL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

function deadlineSub(iso: string): { label: string; color: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(iso.split('T')[0] + 'T00:00:00');
  const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0)  return { label: 'PRZETERMINOWANE', color: colors.accent.red };
  if (days === 0) return { label: 'NA DZIŚ', color: colors.accent.amber };
  if (days === 1) return { label: 'NA JUTRO', color: colors.accent.amber };
  if (days <= 6) return { label: `NA ${DOW_PL[target.getDay()].toUpperCase()}`, color: G.muted };
  const [, m, d] = iso.split('T')[0].split('-');
  return { label: `ZAPLANOWANE ${parseInt(d)}.${parseInt(m)}`, color: G.muted };
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };

export default function FocusScreen() {
  const colors = useColors();
  const s = useMemo(() => makeS(colors), [colors]);
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
          (t.deadline?.split('T')[0] && t.deadline.split('T')[0] < today)
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
  const subtasksDone  = task?.subtasks?.filter(s => s.done).length ?? 0;
  const subtasksTotal = task?.subtasks?.length ?? 0;

  const handleDone = () => {
    if (!task) return;
    toggle(task.id);   // hook handles haptics + the coin-reward toast
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

  const deadline = task?.deadline || task?.scheduledDate
    ? deadlineSub((task.deadline || task.scheduledDate)!)
    : null;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={s.header}>
        <PressableScale onPress={() => { haptic.tap(); router.back(); }} style={s.headerBtn}>
          <ArrowLeft size={18} color={colors.text.secondary} />
        </PressableScale>
        <Text style={s.headerTitle}>SKUPIENIE</Text>
        <View style={s.queuePill}>
          <Text style={s.queueText}>{remaining}</Text>
        </View>
      </View>

      {task ? (
        <View style={s.body}>

          {/* ── MAIN TASK CARD (60-65% height) ── */}
          <View style={s.taskCard}>

            {/* Top: date/deadline sub */}
            <Text style={[s.cardSub, deadline && { color: deadline.color }]}>
              {deadline ? deadline.label : 'BEZ TERMINU'}
            </Text>

            {/* Title */}
            <Text style={s.cardTitle} numberOfLines={4}>
              {task.title.toUpperCase()}
            </Text>

            {/* Description if any */}
            {task.description ? (
              <Text style={s.cardDesc} numberOfLines={3}>{task.description}</Text>
            ) : null}

            {/* Subtasks */}
            {subtasksTotal > 0 && (
              <ScrollView style={s.subList} showsVerticalScrollIndicator={false}>
                <View style={s.subProgressTrack}>
                  <View style={[s.subProgressFill, {
                    width: `${(subtasksDone / subtasksTotal) * 100}%` as any,
                    backgroundColor: subtasksDone === subtasksTotal ? G.accent : 'rgba(46,222,160,0.50)',
                  }]} />
                </View>
                {task.subtasks?.map(sub => (
                  <TouchableOpacity
                    key={sub.id}
                    style={s.subRow}
                    onPress={() => {
                      const willFinishAll = !sub.done && subtasksDone + 1 === subtasksTotal;
                      willFinishAll ? haptic.success() : haptic.tap();
                      toggleSubtask(task.id, sub.id);
                    }}
                    activeOpacity={0.75}
                  >
                    {sub.done
                      ? <CheckSquare size={16} color={G.accent} strokeWidth={2} />
                      : <Square size={16} color={colors.text.muted} strokeWidth={1.5} />
                    }
                    <Text style={[s.subText, sub.done && s.subTextDone]}>
                      {sub.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Spacer pushes toggle to bottom */}
            <View style={{ flex: 1 }} />

            {/* Bottom row: milestones count + toggle complete */}
            <View style={s.cardBottom}>
              {subtasksTotal > 0 && (
                <Text style={s.subCount}>{subtasksDone}/{subtasksTotal} kroków</Text>
              )}
              <View style={{ flex: 1 }} />
              {/* Toggle pill (Figma spec: same as tasks list) */}
              <TouchableOpacity
                style={s.toggleWrap}
                onPress={handleDone}
                activeOpacity={0.8}
                hitSlop={8}
              >
                <View style={[s.toggleTrack]}>
                  <View style={[s.toggleDot, s.toggleDotLeft]} />
                  <View style={[s.toggleDot, s.toggleDotRight]} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── BELOW CARD ── */}
          <View style={s.belowCard}>

            {/* Pomodoro CTA */}
            {task.estimatedPomodoros && task.estimatedPomodoros > 0 ? (
              <TouchableOpacity style={s.pomCta} onPress={handlePomodoro} activeOpacity={0.8}>
                <Timer size={15} color='#2BC8E0' strokeWidth={2} />
                <Text style={s.pomCtaText}>
                  {`Pomodoro · ${task.estimatedPomodoros}×25 min`}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.pomCtaGhost} onPress={handlePomodoro} activeOpacity={0.8}>
                <Timer size={14} color={colors.text.muted} strokeWidth={1.5} />
                <Text style={s.pomCtaGhostText}>Zacznij Pomodoro</Text>
              </TouchableOpacity>
            )}

            {/* Next task preview */}
            {queue.length > 1 && (
              <View style={s.nextRow}>
                <Text style={s.nextLabel}>Następne:</Text>
                <Text style={s.nextTitle} numberOfLines={1}>{queue[1].title.toUpperCase()}</Text>
              </View>
            )}

            {/* Skip + capture row */}
            <View style={s.bottomRow}>
              <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.75}>
                <Text style={s.skipText}>POMIŃ</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              {captureOpen ? (
                <View style={s.captureInputRow}>
                  <TextInput
                    autoFocus
                    style={s.captureInput}
                    value={captureText}
                    onChangeText={setCaptureText}
                    placeholder="Nowe zadanie..."
                    placeholderTextColor={G.muted}
                    onSubmitEditing={handleCapture}
                    returnKeyType="done"
                    maxLength={80}
                  />
                  <TouchableOpacity onPress={handleCapture} hitSlop={8}>
                    <Check size={15} color={captureText.trim() ? G.accent : G.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { haptic.tap(); setCaptureOpen(false); setCaptureText(''); }} hitSlop={8}>
                    <X size={13} color={G.muted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.addBtn}
                  onPress={() => { setCaptureOpen(true); haptic.tap(); }}
                  activeOpacity={0.8}
                >
                  <Plus size={20} color={colors.bg.primary} strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ) : (
        /* ── EMPTY STATE ── */
        <View style={s.emptyBody}>
          <View style={s.emptyIcon}>
            <Text style={s.emptyEmoji}>✓</Text>
          </View>
          <Text style={s.emptyTitle}>WSZYSTKO ZROBIONE</Text>
          <Text style={s.emptySub}>
            {skipSet.size > 0
              ? `Pominięto ${skipSet.size} zadań`
              : 'Brak aktywnych zadań na dziś'}
          </Text>
          <PressableScale onPress={() => { haptic.tap(); router.back(); }} style={s.backBtn}>
            <Text style={s.backBtnText}>Wróć</Text>
          </PressableScale>
        </View>
      )}
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.primary },

  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    gap: spacing[3],
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: G.card, borderWidth: 1, borderColor: G.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, fontSize: 13, fontWeight: '800', color: c.text.muted,
    letterSpacing: 1.4,
  },
  queuePill: {
    minWidth: 32, height: 26, borderRadius: 13,
    backgroundColor: G.accentDim, borderWidth: 1, borderColor: G.cardBorder,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  queueText: { fontSize: 12, fontWeight: '800', color: G.accent },

  // ── Body ─────────────────────────────────────────────────────────────────────
  body: {
    flex: 1, paddingHorizontal: spacing[4],
    paddingBottom: spacing[4], gap: spacing[4],
  },

  // ── Task card (60-65% of screen) ──────────────────────────────────────────────
  taskCard: {
    flex: 0.62,
    backgroundColor: G.card, borderRadius: 20,
    borderWidth: 1, borderColor: G.cardBorder,
    padding: spacing[5], gap: spacing[3],
  },
  cardSub: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.4,
    color: G.muted,
  },
  cardTitle: {
    fontSize: 20, fontWeight: '800', color: c.white,
    letterSpacing: 0.3, lineHeight: 28,
  },
  cardDesc: {
    fontSize: 13, color: c.text.secondary, lineHeight: 20,
  },

  // Subtasks
  subList: { flex: 1 },
  subProgressTrack: {
    height: 8, backgroundColor: c.border.subtle,
    borderRadius: 4, overflow: 'hidden', marginBottom: spacing[3],
  },
  subProgressFill: { height: '100%', borderRadius: 4 },
  subRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: 'rgba(46,222,160,0.08)',
  },
  subText: { flex: 1, fontSize: 13, color: c.text.primary, fontWeight: '500' },
  subTextDone: { textDecorationLine: 'line-through', color: c.text.muted },

  // Card bottom row
  cardBottom: { flexDirection: 'row', alignItems: 'center' },
  subCount: { fontSize: 10, fontWeight: '600', color: G.muted, letterSpacing: 0.5 },

  // Toggle pill (same as tasks list toggle)
  toggleWrap: { alignItems: 'center', justifyContent: 'center' },
  toggleTrack: {
    width: 54, height: 28, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, justifyContent: 'space-between',
    backgroundColor: c.border.subtle,
    borderWidth: 1, borderColor: G.cardBorder,
  },
  toggleDot: { width: 12, height: 12, borderRadius: 6 },
  toggleDotLeft:  { backgroundColor: c.border.subtle },
  toggleDotRight: { backgroundColor: c.border.subtle },

  // ── Below card ────────────────────────────────────────────────────────────────
  belowCard: {
    flex: 1, gap: spacing[3], justifyContent: 'flex-end',
  },

  pomCta: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: 'rgba(43,200,224,0.10)',
    borderRadius: radius.lg, borderWidth: 1,
    borderColor: 'rgba(43,200,224,0.25)',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  pomCtaText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#2BC8E0' },
  pomCtaGhost: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  pomCtaGhostText: { fontSize: 12, color: c.text.muted },

  nextRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1, borderTopColor: c.border.subtle,
  },
  nextLabel: { fontSize: 10, fontWeight: '700', color: c.text.muted, letterSpacing: 0.8 },
  nextTitle: { flex: 1, fontSize: 11, color: c.text.secondary, fontWeight: '600' },

  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  skipBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderRadius: radius.full,
    backgroundColor: G.card, borderWidth: 1, borderColor: G.cardBorder,
  },
  skipText: { fontSize: 11, fontWeight: '800', color: G.muted, letterSpacing: 1 },

  // Green "+" FAB (Figma: bottom right)
  addBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: G.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.accent, shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 8,
  },

  captureInputRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: G.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: G.cardBorder,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  captureInput: { flex: 1, fontSize: 14, color: c.text.primary, paddingVertical: 4 },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: G.accentDim, borderWidth: 1, borderColor: G.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyEmoji: { fontSize: 36, fontWeight: '800', color: G.accent },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: c.text.primary, letterSpacing: 1 },
  emptySub: { fontSize: 13, color: c.text.muted, textAlign: 'center' },
  backBtn: {
    paddingHorizontal: spacing[6], paddingVertical: spacing[4],
    backgroundColor: G.accentDim, borderRadius: radius.xl,
    borderWidth: 1, borderColor: G.cardBorder,
  },
  backBtnText: { fontSize: 14, fontWeight: '700', color: G.accent },
}));
