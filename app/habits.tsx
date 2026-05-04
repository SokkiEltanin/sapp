import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft, Plus, Droplets, Dumbbell, BookOpen,
  Moon, Zap, Heart, Sun, Bike, Check, Trash2, Flame,
  CalendarDays, Bell, ChevronUp, ChevronDown,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useHabits } from '@/hooks/useHabits';
import { HABIT_COLORS, HABIT_ICONS, Habit } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { toast } from '@/store/toastStore';

// ─── Icon renderer ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  droplets:   Droplets,
  dumbbell:   Dumbbell,
  'book-open': BookOpen,
  moon:       Moon,
  zap:        Zap,
  heart:      Heart,
  sun:        Sun,
  bike:       Bike,
};

const ICON_LABELS: Record<string, string> = {
  droplets:   'Woda',
  dumbbell:   'Sport',
  'book-open': 'Czytanie',
  moon:       'Sen',
  zap:        'Energia',
  heart:      'Opieka',
  sun:        'Ranek',
  bike:       'Aktywność',
};

function HabitIcon({ name, size, color }: { name: string; size: number; color: string }) {
  const Icon = ICON_MAP[name] ?? Zap;
  return <Icon size={size} color={color} />;
}

// ─── 7-day history dots ───────────────────────────────────────────────────────

const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

function HistoryDots({ days }: { days: boolean[] }) {
  const today = new Date();
  const todayDow = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0
  return (
    <View style={hd.row}>
      {days.map((done, i) => {
        const offset = -(6 - i);
        const d = new Date(today);
        d.setDate(today.getDate() + offset);
        const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
        const isToday = i === 6;
        return (
          <View key={i} style={hd.col}>
            <View style={[
              hd.dot,
              done && hd.dotDone,
              isToday && hd.dotToday,
            ]} />
            <Text style={[hd.label, isToday && hd.labelToday]}>
              {DAY_LABELS[dow]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const hd = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  col: { alignItems: 'center', gap: 3 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dotDone: { backgroundColor: colors.accent.green },
  dotToday: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  label: { fontSize: 8, color: colors.text.muted },
  labelToday: { color: colors.text.secondary, fontWeight: '700' },
});

// ─── Habit row ────────────────────────────────────────────────────────────────

function HabitRow({ habit, done, streak, last7, onToggle, onDelete, onEdit }: {
  habit: Habit;
  done: boolean;
  streak: number;
  last7: boolean[];
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <TouchableOpacity onLongPress={onEdit} activeOpacity={0.85} delayLongPress={400} style={hr.wrap}>
      <View style={[hr.iconCircle, { backgroundColor: habit.color + '22', borderColor: habit.color + '44' }]}>
        <HabitIcon name={habit.icon} size={18} color={habit.color} />
      </View>

      <View style={hr.body}>
        <View style={hr.titleRow}>
          <Text style={hr.title}>{habit.title}</Text>
          {streak > 0 && (
            <View style={hr.streak}>
              <Flame size={9} color={colors.accent.amber} />
              <Text style={hr.streakText}>{streak}d</Text>
            </View>
          )}
          {habit.reminderTime && (
            <View style={hr.reminderBadge}>
              <Bell size={9} color={colors.accent.purple} />
              <Text style={hr.reminderText}>{habit.reminderTime}</Text>
            </View>
          )}
        </View>
        <HistoryDots days={last7} />
      </View>

      <TouchableOpacity
        onPress={onDelete}
        style={hr.deleteBtn}
        hitSlop={8}
      >
        <Trash2 size={13} color='rgba(255,255,255,0.15)' />
      </TouchableOpacity>

      <PressableScale onPress={onToggle} style={[hr.check, done && { backgroundColor: habit.color }]}>
        {done
          ? <Check size={14} color={colors.bg.primary} strokeWidth={3} />
          : <View style={[hr.checkInner, { borderColor: habit.color + '60' }]} />
        }
      </PressableScale>
    </TouchableOpacity>
  );
}

const hr = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[3],
  },
  iconCircle: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  streak: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.accent.amber + '18',
    borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 2,
  },
  streakText: { fontSize: 10, fontWeight: '700', color: colors.accent.amber },
  reminderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.accent.purple + '18',
    borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 2,
  },
  reminderText: { fontSize: 9, fontWeight: '600', color: colors.accent.purple },
  deleteBtn: { padding: spacing[1] },
  check: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkInner: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2,
  },
});

// ─── 30-day month heatmap ─────────────────────────────────────────────────────

const CELL = 18;
const GAP  = 2;
const ROW_H = CELL + GAP;

function MonthGrid({ habits, getLast30 }: {
  habits: Habit[];
  getLast30: (id: string) => boolean[];
}) {
  const scrollRef = useRef<ScrollView>(null);

  const data = useMemo(
    () => habits.map(h => getLast30(h.id)),
    [habits, getLast30],
  );

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (29 - i));
      return {
        num: d.getDate(),
        isToday: i === 29,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      };
    });
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }, []);

  if (habits.length === 0) return null;

  return (
    <View style={mg.wrap}>
      <Text style={mg.title}>OSTATNIE 30 DNI</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Fixed left column: habit icons */}
        <View style={{ paddingRight: GAP + 2 }}>
          <View style={{ height: ROW_H }} />
          {habits.map(h => (
            <View key={h.id} style={[mg.iconCell, { height: ROW_H }]}>
              <HabitIcon name={h.icon} size={11} color={h.color} />
            </View>
          ))}
        </View>

        {/* Scrollable day grid */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', gap: GAP }}
        >
          {days.map((day, di) => (
            <View key={di} style={{ gap: GAP }}>
              <View style={{ width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[
                  mg.dayNum,
                  day.isWeekend && mg.dayNumWeekend,
                  day.isToday && mg.dayNumToday,
                ]}>
                  {day.num}
                </Text>
              </View>
              {habits.map((h, hi) => (
                <View key={h.id} style={[
                  mg.cell,
                  { backgroundColor: data[hi][di] ? h.color + 'CC' : 'rgba(255,255,255,0.06)' },
                  day.isToday && mg.cellToday,
                ]} />
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const mg = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
    overflow: 'hidden',
  },
  title: {
    fontSize: 10, fontWeight: '600', color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing[2],
  },
  iconCell: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '500',
    textAlign: 'center',
  },
  dayNumWeekend: { color: 'rgba(255,255,255,0.15)' },
  dayNumToday: { color: colors.text.primary, fontWeight: '800' },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 4,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

// ─── Habit form modal (add + edit) ────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

function HabitFormModal({ visible, onClose, onSave, editing }: {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, color: string, icon: string, reminderTime?: string) => void;
  editing?: Habit | null;
}) {
  const [title, setTitle]               = useState('');
  const [selColor, setSelColor]         = useState<string>(HABIT_COLORS[0]);
  const [selIcon, setSelIcon]           = useState<string>(HABIT_ICONS[0]);
  const [reminderOn, setReminderOn]     = useState(false);
  const [reminderHour, setReminderHour] = useState(20);
  const [reminderMin, setReminderMin]   = useState(0);

  useEffect(() => {
    if (visible) {
      setTitle(editing?.title ?? '');
      setSelColor(editing?.color ?? HABIT_COLORS[0]);
      setSelIcon(editing?.icon ?? HABIT_ICONS[0]);
      const rt = editing?.reminderTime;
      if (rt) {
        const [h, m] = rt.split(':').map(Number);
        setReminderHour(h);
        setReminderMin(m);
        setReminderOn(true);
      } else {
        setReminderHour(20);
        setReminderMin(0);
        setReminderOn(false);
      }
    }
  }, [visible, editing]);

  const handleSave = () => {
    if (!title.trim()) return;
    const rt = reminderOn ? `${pad2(reminderHour)}:${pad2(reminderMin)}` : undefined;
    onSave(title.trim(), selColor, selIcon, rt);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={am.overlay} onPress={onClose} />
      <View style={am.sheet}>
        <View style={am.handle} />
        <Text style={am.heading}>{editing ? 'Edytuj nawyk' : 'Nowy nawyk'}</Text>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Nazwa nawyku..."
          placeholderTextColor={colors.text.muted}
          style={am.input}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <Text style={am.sectionLabel}>Ikona</Text>
        <View style={am.iconRow}>
          {HABIT_ICONS.map(icon => {
            const active = selIcon === icon;
            return (
              <PressableScale key={icon} onPress={() => setSelIcon(icon)} style={[
                am.iconBtn,
                active && { backgroundColor: selColor + '30', borderColor: selColor },
              ]}>
                <HabitIcon name={icon} size={20} color={active ? selColor : colors.text.muted} />
              </PressableScale>
            );
          })}
        </View>

        <Text style={am.sectionLabel}>Kolor</Text>
        <View style={am.colorRow}>
          {HABIT_COLORS.map(c => (
            <PressableScale key={c} onPress={() => setSelColor(c)} style={[
              am.colorBtn, { backgroundColor: c },
              selColor === c && am.colorBtnActive,
            ]}>
              {selColor === c && <Check size={12} color={colors.bg.primary} strokeWidth={3} />}
            </PressableScale>
          ))}
        </View>

        <Text style={am.sectionLabel}>Przypomnienie</Text>
        <View style={am.reminderWrap}>
          <TouchableOpacity
            style={am.reminderToggleRow}
            onPress={() => setReminderOn(v => !v)}
            activeOpacity={0.8}
          >
            <Bell size={14} color={reminderOn ? colors.accent.purple : colors.text.muted} />
            <Text style={[am.reminderLabel, reminderOn && { color: colors.text.primary }]}>
              Codzienne przypomnienie
            </Text>
            <View style={[am.toggleTrack, reminderOn && am.toggleTrackOn]}>
              <View style={[am.toggleThumb, reminderOn && am.toggleThumbOn]} />
            </View>
          </TouchableOpacity>

          {reminderOn && (
            <View style={am.timePickerRow}>
              {/* Hour */}
              <View style={am.timeUnit}>
                <TouchableOpacity onPress={() => setReminderHour(h => (h + 23) % 24)} style={am.timeArrow}>
                  <ChevronUp size={16} color={colors.text.secondary} />
                </TouchableOpacity>
                <Text style={am.timeDigit}>{pad2(reminderHour)}</Text>
                <TouchableOpacity onPress={() => setReminderHour(h => (h + 1) % 24)} style={am.timeArrow}>
                  <ChevronDown size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <Text style={am.timeSep}>:</Text>
              {/* Minute (step 5) */}
              <View style={am.timeUnit}>
                <TouchableOpacity onPress={() => setReminderMin(m => (m + 55) % 60)} style={am.timeArrow}>
                  <ChevronUp size={16} color={colors.text.secondary} />
                </TouchableOpacity>
                <Text style={am.timeDigit}>{pad2(reminderMin)}</Text>
                <TouchableOpacity onPress={() => setReminderMin(m => (m + 5) % 60)} style={am.timeArrow}>
                  <ChevronDown size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <PressableScale onPress={handleSave} style={[am.addBtn, !title.trim() && am.addBtnDisabled]}>
          <Text style={am.addBtnText}>{editing ? 'Zapisz zmiany' : 'Dodaj nawyk'}</Text>
        </PressableScale>
      </View>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing[5],
    paddingBottom: spacing[8],
    gap: spacing[3],
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border.default,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center', marginBottom: spacing[1],
  },
  heading: { fontSize: 18, fontWeight: '800', color: colors.text.primary, marginBottom: spacing[1] },
  sectionLabel: {
    fontSize: 10, fontWeight: '600', color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing[1],
  },
  input: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: 16, color: colors.text.primary,
  },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', gap: spacing[2] },
  colorBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  colorBtnActive: {
    borderWidth: 2, borderColor: colors.text.primary,
    transform: [{ scale: 1.15 }],
  },
  addBtn: {
    backgroundColor: colors.text.primary,
    borderRadius: radius.full, paddingVertical: spacing[4],
    alignItems: 'center', marginTop: spacing[2],
  },
  addBtnDisabled: { opacity: 0.35 },
  addBtnText: { fontSize: 15, fontWeight: '700', color: colors.bg.primary },

  reminderWrap: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  reminderToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  reminderLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.text.secondary },
  toggleTrack: {
    width: 38, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleTrackOn: { backgroundColor: colors.accent.purple },
  toggleThumb: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  toggleThumbOn: {
    backgroundColor: '#fff',
    transform: [{ translateX: 16 }],
  },
  timePickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2],
    paddingBottom: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[3],
  },
  timeUnit: { alignItems: 'center', gap: 4 },
  timeArrow: {
    width: 36, height: 28, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  timeDigit: {
    fontSize: 28, fontWeight: '800', color: colors.text.primary,
    letterSpacing: 1, minWidth: 44, textAlign: 'center',
  },
  timeSep: { fontSize: 28, fontWeight: '800', color: colors.text.muted, marginBottom: 4 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HabitsScreen() {
  const { habits, todayDone, isLoading, toggle, add, remove, update, getStreak, getLast7, getLast30 } = useHabits();
  const [showAdd, setShowAdd]       = useState(false);
  const [showMonth, setShowMonth]   = useState(false);
  const [editingHabit, setEditing]  = useState<Habit | null>(null);

  const doneCount = habits.filter(h => todayDone.includes(h.id)).length;
  const allDone   = habits.length > 0 && doneCount === habits.length;

  const handleDelete = (habit: Habit) => {
    Alert.alert('Usuń nawyk', `Usunąć "${habit.title}"?`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { remove(habit.id); toast.info('Usunięto'); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={20} color={colors.text.secondary} />
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Nawyki</Text>
          {habits.length > 0 && (
            <Text style={styles.subtitle}>
              {allDone ? 'Wszystko ukończone!' : `${doneCount}/${habits.length} dziś`}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {habits.length > 0 && (
            <PressableScale
              onPress={() => setShowMonth(v => !v)}
              style={[styles.iconBtn, showMonth && styles.iconBtnActive]}
            >
              <CalendarDays size={17} color={showMonth ? colors.accent.purple : colors.text.secondary} />
            </PressableScale>
          )}
          <PressableScale onPress={() => setShowAdd(true)} style={[styles.iconBtn, styles.addBtn]}>
            <Plus size={20} color={colors.bg.primary} />
          </PressableScale>
        </View>
      </View>

      {/* Progress bar */}
      {habits.length > 0 && (
        <View style={styles.progressTrack}>
          <View style={[
            styles.progressFill,
            {
              width: `${(doneCount / habits.length) * 100}%` as any,
              backgroundColor: allDone ? colors.accent.green : colors.accent.purple,
            },
          ]} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {habits.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Zap size={32} color={colors.accent.amber} />
            </View>
            <Text style={styles.emptyTitle}>Zacznij budować nawyki</Text>
            <Text style={styles.emptySub}>
              Codzienne rutyny pomagają w skupieniu i redukcji decyzji
            </Text>
            <PressableScale onPress={() => setShowAdd(true)} style={styles.emptyBtn}>
              <Plus size={16} color={colors.bg.primary} />
              <Text style={styles.emptyBtnText}>Dodaj pierwszy nawyk</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            {habits.map(habit => (
              <HabitRow
                key={habit.id}
                habit={habit}
                done={todayDone.includes(habit.id)}
                streak={getStreak(habit.id)}
                last7={getLast7(habit.id)}
                onToggle={() => toggle(habit.id)}
                onDelete={() => handleDelete(habit)}
                onEdit={() => setEditing(habit)}
              />
            ))}
            {showMonth && <MonthGrid habits={habits} getLast30={getLast30} />}
          </>
        )}
      </ScrollView>

      <HabitFormModal
        visible={showAdd || editingHabit != null}
        editing={editingHabit}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        onSave={(title, color, icon, reminderTime) => {
          if (editingHabit) {
            update(editingHabit.id, { title, color, icon, reminderTime });
            toast.success('Nawyk zaktualizowany');
          } else {
            add({ title, color, icon, reminderTime });
            toast.success('Nawyk dodany');
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text.primary },
  subtitle: { fontSize: 11, color: colors.text.secondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: colors.accent.purple + '18',
    borderColor: colors.accent.purple + '40',
  },
  addBtn: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },

  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  progressFill: { height: 2, borderRadius: 1 },

  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 60 },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing[4] },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accent.amber + '15',
    borderWidth: 1, borderColor: colors.accent.amber + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary },
  emptySub: {
    fontSize: 14, color: colors.text.muted, textAlign: 'center',
    lineHeight: 21, paddingHorizontal: spacing[6],
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.text.primary, borderRadius: radius.full,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    marginTop: spacing[2],
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: colors.bg.primary },
});
