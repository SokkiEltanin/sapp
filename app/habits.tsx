import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft, Plus, Minus, Droplets, Dumbbell, BookOpen,
  Moon, Zap, Heart, Sun, Bike, Check, Trash2, Flame,
  CalendarDays, Bell, ChevronUp, ChevronDown,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useHabits } from '@/hooks/useHabits';
import { HABIT_COLORS, HABIT_ICONS, Habit, HabitType } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';

// ─── Icon renderer ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  droplets:    Droplets,
  dumbbell:    Dumbbell,
  'book-open': BookOpen,
  moon:        Moon,
  zap:         Zap,
  heart:       Heart,
  sun:         Sun,
  bike:        Bike,
};

function HabitIcon({ name, size, color }: { name: string; size: number; color: string }) {
  const Icon = ICON_MAP[name] ?? Zap;
  return <Icon size={size} color={color} />;
}

// ─── 7-day history dots ───────────────────────────────────────────────────────

const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

function HistoryDots({ days, color }: { days: boolean[]; color: string }) {
  const colors = useColors();
  const hd = useMemo(() => makeHd(colors), [colors]);
  const today = new Date();
  return (
    <View style={hd.row}>
      {days.map((done, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
        const isToday = i === 6;
        return (
          <View key={i} style={hd.col}>
            <View style={[hd.dot, done && { backgroundColor: color }, isToday && hd.dotToday]} />
            <Text style={[hd.label, isToday && hd.labelToday]}>{DAY_LABELS[dow]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const makeHd = (c: any) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  col: { alignItems: 'center', gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border.subtle },
  dotToday: { borderWidth: 1, borderColor: c.border.default },
  label: { fontSize: 8, color: c.text.muted },
  labelToday: { color: c.text.secondary, fontWeight: '700' },
});

// ─── Habit row ────────────────────────────────────────────────────────────────

function HabitRow({ habit, done, count, streak, last7, onToggle, onIncrement, onDecrement, onDelete, onEdit }: {
  habit: Habit;
  done: boolean;
  count: number;
  streak: number;
  last7: boolean[];
  onToggle: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const colors = useColors();
  const hr = useMemo(() => makeHr(colors), [colors]);
  const isCount = habit.type === 'count';
  const goal    = habit.dailyGoal ?? 1;
  const pct     = isCount ? Math.min(count / goal, 1) : (done ? 1 : 0);

  // Weekly progress for habits with weeklyTarget < 7
  const weeklyTarget = habit.weeklyTarget && habit.weeklyTarget < 7 ? habit.weeklyTarget : null;
  const thisWeekDone = weeklyTarget != null ? (() => {
    const dow = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
    return last7.slice(6 - dow).filter(Boolean).length;
  })() : null;
  const weeklyMet = weeklyTarget != null && thisWeekDone != null && thisWeekDone >= weeklyTarget;

  return (
    <TouchableOpacity onLongPress={() => { haptic.medium(); onEdit(); }} activeOpacity={0.85} delayLongPress={400} style={[hr.wrap, done && { backgroundColor: habit.color + '0D', borderColor: habit.color + '35' }]}>
      <View style={[hr.iconCircle, { backgroundColor: habit.color + '22', borderColor: habit.color + '44' }]}>
        <HabitIcon name={habit.icon} size={18} color={habit.color} />
      </View>

      <View style={hr.body}>
        <View style={hr.titleRow}>
          <Text style={hr.title}>{habit.title}</Text>
          {streak > 0 && (
            <View style={[hr.streak, !done && { backgroundColor: colors.accent.red + '15', borderColor: colors.accent.red + '35' }]}>
              <Flame size={9} color={!done ? colors.accent.red : colors.accent.amber} />
              <Text style={[hr.streakText, !done && { color: colors.accent.red }]}>{streak}d</Text>
            </View>
          )}
          {weeklyTarget != null && thisWeekDone != null && (
            <View style={[hr.freqBadge, weeklyMet && { backgroundColor: colors.accent.green + '20', borderColor: colors.accent.green + '40' }]}>
              <Text style={[hr.freqText, weeklyMet && { color: colors.accent.green }]}>
                {thisWeekDone}/{weeklyTarget} tydz.
              </Text>
            </View>
          )}
          {habit.reminderTime && (
            <View style={hr.reminderBadge}>
              <Bell size={9} color={colors.accent.purple} />
              <Text style={hr.reminderText}>{habit.reminderTime}</Text>
            </View>
          )}
        </View>

        {/* Progress bar for count habits */}
        {isCount && (
          <View style={hr.progressWrap}>
            <View style={hr.progressTrack}>
              <View style={[
                hr.progressFill,
                { width: `${pct * 100}%` as any, backgroundColor: done ? colors.accent.green : habit.color },
              ]} />
            </View>
            <Text style={[hr.countLabel, done && { color: colors.accent.green }]}>
              {count}/{goal}{habit.unit ? ` ${habit.unit}` : ''}
            </Text>
          </View>
        )}

        <HistoryDots days={last7} color={habit.color} />
      </View>

      <TouchableOpacity onPress={() => { haptic.tap(); onDelete(); }} style={hr.deleteBtn} hitSlop={8}>
        <Trash2 size={13} color={colors.text.muted} />
      </TouchableOpacity>

      {isCount ? (
        <View style={hr.countControls}>
          <PressableScale onPress={onIncrement} style={[hr.countBtn, { borderColor: habit.color + '60' }]}>
            <Plus size={13} color={habit.color} />
          </PressableScale>
          <Text style={hr.countNum}>{count}</Text>
          <PressableScale onPress={onDecrement} style={hr.countBtn} disabled={count === 0}>
            <Minus size={13} color={count === 0 ? colors.text.muted : colors.text.secondary} />
          </PressableScale>
        </View>
      ) : (
        <PressableScale onPress={onToggle} style={[hr.check, done && { backgroundColor: habit.color }]}>
          {done
            ? <Check size={14} color={colors.bg.primary} strokeWidth={3} />
            : <View style={[hr.checkInner, { borderColor: habit.color + '60' }]} />
          }
        </PressableScale>
      )}
    </TouchableOpacity>
  );
}

const makeHr = (c: any) => StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.card,
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3],
  },
  iconCircle: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 14, fontWeight: '600', color: c.text.primary },
  streak: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: c.accent.amber + '18',
    borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: c.accent.amber + '30',
  },
  streakText: { fontSize: 10, fontWeight: '700', color: c.accent.amber },
  freqBadge: {
    backgroundColor: c.border.subtle,
    borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: 'transparent',
  },
  freqText: { fontSize: 9, fontWeight: '600', color: c.text.muted },

  reminderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: c.accent.purple + '18',
    borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 2,
  },
  reminderText: { fontSize: 9, fontWeight: '600', color: c.accent.purple },

  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  progressTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: c.border.subtle, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  countLabel: { fontSize: 10, fontWeight: '700', color: c.text.secondary, minWidth: 40, textAlign: 'right' },

  deleteBtn: { padding: spacing[1] },

  check: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: c.border.subtle,
    borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  checkInner: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },

  countControls: { alignItems: 'center', gap: 2 },
  countBtn: {
    width: 28, height: 28, borderRadius: radius.sm,
    backgroundColor: c.border.subtle,
    borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  countNum: { fontSize: 13, fontWeight: '800', color: c.text.primary, minWidth: 20, textAlign: 'center' },
});

// ─── 30-day month heatmap ─────────────────────────────────────────────────────

const CELL = 18;
const GAP  = 2;
const ROW_H = CELL + GAP;

function MonthGrid({ habits, getLast30 }: { habits: Habit[]; getLast30: (id: string) => boolean[] }) {
  const colors = useColors();
  const mg = useMemo(() => makeMg(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const data = useMemo(() => habits.map((h) => getLast30(h.id)), [habits, getLast30]);
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (29 - i));
      return { num: d.getDate(), isToday: i === 29, isWeekend: d.getDay() === 0 || d.getDay() === 6 };
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
        <View style={{ paddingRight: GAP + 2 }}>
          <View style={{ height: ROW_H }} />
          {habits.map((h) => (
            <View key={h.id} style={[mg.iconCell, { height: ROW_H }]}>
              <HabitIcon name={h.icon} size={11} color={h.color} />
            </View>
          ))}
        </View>
        <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: GAP }}>
          {days.map((day, di) => (
            <View key={di} style={{ gap: GAP }}>
              <View style={{ width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[mg.dayNum, day.isWeekend && mg.dayNumWeekend, day.isToday && mg.dayNumToday]}>{day.num}</Text>
              </View>
              {habits.map((h, hi) => (
                <View key={h.id} style={[
                  mg.cell,
                  { backgroundColor: data[hi][di] ? h.color + 'CC' : colors.border.subtle },
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

const makeMg = (c: any) => StyleSheet.create({
  wrap: { backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], overflow: 'hidden' },
  title: { fontSize: 10, fontWeight: '600', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[2] },
  iconCell: { width: 20, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 8, color: c.text.muted, fontWeight: '500', textAlign: 'center' },
  dayNumWeekend: { color: c.text.muted },
  dayNumToday: { color: c.text.primary, fontWeight: '800' },
  cell: { width: CELL, height: CELL, borderRadius: 4 },
  cellToday: { borderWidth: 1, borderColor: c.border.default },
});

// ─── Habit form modal ────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

const UNIT_PRESETS = ['szkl.', 'ml', 'min', 'km', 'powt.'];

const FREQ_OPTIONS: { label: string; value: number }[] = [
  { label: 'Codziennie', value: 7 },
  { label: '5×/tydzień', value: 5 },
  { label: '3×/tydzień', value: 3 },
  { label: '2×/tydzień', value: 2 },
];

const HABIT_PRESETS: Array<{
  title: string; type: HabitType; icon: string; color: string;
  dailyGoal?: number; unit?: string; reminderHour?: number; reminderMin?: number;
}> = [
  { title: 'Woda',       type: 'count', icon: 'droplets',  color: '#60A5FA', dailyGoal: 8, unit: 'szkl.' },
  { title: 'Ruch',       type: 'check', icon: 'dumbbell',  color: '#34D399' },
  { title: 'Czytanie',   type: 'check', icon: 'book-open', color: '#FBBF24' },
  { title: 'Sen',        type: 'check', icon: 'moon',      color: '#C084FC', reminderHour: 22, reminderMin: 0 },
  { title: 'Medytacja',  type: 'check', icon: 'heart',     color: '#F472B6' },
];

interface HabitFormData {
  title: string; color: string; icon: string; reminderTime?: string;
  type: HabitType; dailyGoal?: number; unit?: string; weeklyTarget?: number;
}

function HabitFormModal({ visible, onClose, onSave, editing }: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: HabitFormData) => void;
  editing?: Habit | null;
}) {
  const colors = useColors();
  const am = useMemo(() => makeAm(colors), [colors]);
  const [title, setTitle]             = useState('');
  const [selColor, setSelColor]       = useState<string>(HABIT_COLORS[0]);
  const [selIcon, setSelIcon]         = useState<string>(HABIT_ICONS[0]);
  const [type, setType]               = useState<HabitType>('check');
  const [goal, setGoal]               = useState('8');
  const [unit, setUnit]               = useState('szkl.');
  const [customUnit, setCustomUnit]   = useState('');
  const [unitCustom, setUnitCustom]   = useState(false);
  const [reminderOn, setReminderOn]   = useState(false);
  const [reminderHour, setRemH]       = useState(20);
  const [reminderMin, setRemM]        = useState(0);
  const [weeklyTarget, setWeeklyTarget] = useState(7);

  const applyPreset = (p: typeof HABIT_PRESETS[number]) => {
    haptic.tap();
    setTitle(p.title);
    setType(p.type);
    setSelIcon(p.icon);
    setSelColor(p.color);
    if (p.type === 'count') {
      setGoal(String(p.dailyGoal ?? 8));
      setUnit(p.unit ?? 'szkl.');
      setUnitCustom(false);
    }
    if (p.reminderHour != null) {
      setRemH(p.reminderHour);
      setRemM(p.reminderMin ?? 0);
      setReminderOn(true);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setTitle(editing?.title ?? '');
    setSelColor(editing?.color ?? HABIT_COLORS[0]);
    setSelIcon(editing?.icon ?? HABIT_ICONS[0]);
    const t = editing?.type ?? 'check';
    setType(t);
    if (t === 'count') {
      setGoal(String(editing?.dailyGoal ?? 8));
      const u = editing?.unit ?? 'szkl.';
      if (UNIT_PRESETS.includes(u)) { setUnit(u); setUnitCustom(false); }
      else { setCustomUnit(u); setUnitCustom(true); }
    } else {
      setGoal('8'); setUnit('szkl.'); setUnitCustom(false);
    }
    setWeeklyTarget(editing?.weeklyTarget ?? 7);
    const rt = editing?.reminderTime;
    if (rt) {
      const [h, m] = rt.split(':').map(Number);
      setRemH(h); setRemM(m); setReminderOn(true);
    } else {
      setRemH(20); setRemM(0); setReminderOn(false);
    }
  }, [visible, editing]);

  const handleSave = () => {
    if (!title.trim()) return;
    haptic.success();
    const rt = reminderOn ? `${pad2(reminderHour)}:${pad2(reminderMin)}` : undefined;
    const goalN = type === 'count' ? (parseInt(goal) || 1) : undefined;
    const unitVal = type === 'count' ? (unitCustom ? customUnit.trim() : unit) : undefined;
    onSave({ title: title.trim(), color: selColor, icon: selIcon, reminderTime: rt, type, dailyGoal: goalN, unit: unitVal || undefined, weeklyTarget: weeklyTarget < 7 ? weeklyTarget : undefined });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={am.overlay} onPress={onClose} />
      <ScrollView style={am.sheetScroll} contentContainerStyle={am.sheet} keyboardShouldPersistTaps="handled">
        <View style={am.handle} />
        <Text style={am.heading}>{editing ? 'Edytuj nawyk' : 'Nowy nawyk'}</Text>

        {/* Presets — only when creating */}
        {!editing && (
          <View style={am.presetsSection}>
            <Text style={am.sectionLabel}>Szybki start</Text>
            <View style={am.presetsRow}>
              {HABIT_PRESETS.map(p => (
                <PressableScale key={p.title} onPress={() => applyPreset(p)} style={[am.presetChip, { borderColor: p.color + '60' }]}>
                  <View style={[am.presetIconWrap, { backgroundColor: p.color + '22' }]}>
                    <HabitIcon name={p.icon} size={13} color={p.color} />
                  </View>
                  <Text style={[am.presetLabel, { color: p.color }]}>{p.title}</Text>
                </PressableScale>
              ))}
            </View>
          </View>
        )}

        {/* Name */}
        <TextInput
          value={title} onChangeText={setTitle}
          placeholder="Nazwa nawyku..."
          placeholderTextColor={colors.text.muted}
          style={am.input} autoFocus returnKeyType="done" onSubmitEditing={handleSave}
        />

        {/* Type */}
        <Text style={am.sectionLabel}>Typ śledzenia</Text>
        <View style={am.typeRow}>
          <PressableScale onPress={() => setType('check')} style={[am.typePill, type === 'check' && am.typePillActive]}>
            <Check size={13} color={type === 'check' ? colors.bg.primary : colors.text.muted} />
            <Text style={[am.typePillText, type === 'check' && am.typePillTextActive]}>Tak / Nie</Text>
          </PressableScale>
          <PressableScale onPress={() => setType('count')} style={[am.typePill, type === 'count' && am.typePillActive]}>
            <Droplets size={13} color={type === 'count' ? colors.bg.primary : colors.text.muted} />
            <Text style={[am.typePillText, type === 'count' && am.typePillTextActive]}>Licznik</Text>
          </PressableScale>
        </View>

        {/* Count settings */}
        {type === 'count' && (
          <View style={am.countBox}>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <View style={{ flex: 1 }}>
                <Text style={am.sectionLabel}>Cel dzienny</Text>
                <TextInput
                  value={goal} onChangeText={setGoal}
                  keyboardType="number-pad" style={am.input}
                  placeholderTextColor={colors.text.muted} placeholder="np. 8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={am.sectionLabel}>Jednostka</Text>
                <View style={am.unitPresets}>
                  {UNIT_PRESETS.map((u) => (
                    <PressableScale
                      key={u}
                      onPress={() => { setUnit(u); setUnitCustom(false); }}
                      style={[am.unitChip, !unitCustom && unit === u && am.unitChipActive]}
                    >
                      <Text style={[am.unitChipText, !unitCustom && unit === u && am.unitChipTextActive]}>{u}</Text>
                    </PressableScale>
                  ))}
                  <PressableScale
                    onPress={() => setUnitCustom(true)}
                    style={[am.unitChip, unitCustom && am.unitChipActive]}
                  >
                    <Text style={[am.unitChipText, unitCustom && am.unitChipTextActive]}>inne</Text>
                  </PressableScale>
                </View>
                {unitCustom && (
                  <TextInput
                    value={customUnit} onChangeText={setCustomUnit}
                    placeholder="np. strony" placeholderTextColor={colors.text.muted}
                    style={[am.input, { marginTop: spacing[2] }]}
                  />
                )}
              </View>
            </View>
          </View>
        )}

        {/* Icon */}
        <Text style={am.sectionLabel}>Ikona</Text>
        <View style={am.iconRow}>
          {HABIT_ICONS.map((icon) => {
            const active = selIcon === icon;
            return (
              <PressableScale key={icon} onPress={() => setSelIcon(icon)} style={[am.iconBtn, active && { backgroundColor: selColor + '30', borderColor: selColor }]}>
                <HabitIcon name={icon} size={20} color={active ? selColor : colors.text.muted} />
              </PressableScale>
            );
          })}
        </View>

        {/* Color */}
        <Text style={am.sectionLabel}>Kolor</Text>
        <View style={am.colorRow}>
          {HABIT_COLORS.map((c) => (
            <PressableScale key={c} onPress={() => setSelColor(c)} style={[am.colorBtn, { backgroundColor: c }, selColor === c && am.colorBtnActive]}>
              {selColor === c && <Check size={12} color={colors.bg.primary} strokeWidth={3} />}
            </PressableScale>
          ))}
        </View>

        {/* Frequency */}
        <Text style={am.sectionLabel}>Częstotliwość</Text>
        <View style={am.freqRow}>
          {FREQ_OPTIONS.map(opt => (
            <PressableScale
              key={opt.value}
              onPress={() => setWeeklyTarget(opt.value)}
              style={[am.freqChip, weeklyTarget === opt.value && { backgroundColor: selColor + '30', borderColor: selColor }]}
            >
              <Text style={[am.freqChipText, weeklyTarget === opt.value && { color: selColor }]}>{opt.label}</Text>
            </PressableScale>
          ))}
        </View>

        {/* Reminder */}
        <Text style={am.sectionLabel}>Przypomnienie</Text>
        <View style={am.reminderWrap}>
          <TouchableOpacity style={am.reminderToggleRow} onPress={() => { haptic.tap(); setReminderOn((v) => !v); }} activeOpacity={0.8}>
            <Bell size={14} color={reminderOn ? colors.accent.purple : colors.text.muted} />
            <Text style={[am.reminderLabel, reminderOn && { color: colors.text.primary }]}>Codzienne przypomnienie</Text>
            <View style={[am.toggleTrack, reminderOn && am.toggleTrackOn]}>
              <View style={[am.toggleThumb, reminderOn && am.toggleThumbOn]} />
            </View>
          </TouchableOpacity>
          {reminderOn && (
            <View style={am.timePickerRow}>
              <View style={am.timeUnit}>
                <TouchableOpacity onPress={() => { haptic.tap(); setRemH((h) => (h + 23) % 24); }} style={am.timeArrow}><ChevronUp size={16} color={colors.text.secondary} /></TouchableOpacity>
                <Text style={am.timeDigit}>{pad2(reminderHour)}</Text>
                <TouchableOpacity onPress={() => { haptic.tap(); setRemH((h) => (h + 1) % 24); }} style={am.timeArrow}><ChevronDown size={16} color={colors.text.secondary} /></TouchableOpacity>
              </View>
              <Text style={am.timeSep}>:</Text>
              <View style={am.timeUnit}>
                <TouchableOpacity onPress={() => { haptic.tap(); setRemM((m) => (m + 55) % 60); }} style={am.timeArrow}><ChevronUp size={16} color={colors.text.secondary} /></TouchableOpacity>
                <Text style={am.timeDigit}>{pad2(reminderMin)}</Text>
                <TouchableOpacity onPress={() => { haptic.tap(); setRemM((m) => (m + 5) % 60); }} style={am.timeArrow}><ChevronDown size={16} color={colors.text.secondary} /></TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <PressableScale onPress={handleSave} style={[am.addBtn, !title.trim() && am.addBtnDisabled]}>
          <Text style={am.addBtnText}>{editing ? 'Zapisz zmiany' : 'Dodaj nawyk'}</Text>
        </PressableScale>
      </ScrollView>
    </Modal>
  );
}

const makeAm = (c: any) => StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetScroll: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '92%' },
  sheet: {
    backgroundColor: c.bg.secondary, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing[5], paddingBottom: spacing[10], gap: spacing[3],
    borderWidth: 1, borderBottomWidth: 0, borderColor: c.border.default,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border.subtle, alignSelf: 'center', marginBottom: spacing[1] },
  heading: { fontSize: 18, fontWeight: '800', color: c.text.primary, marginBottom: spacing[1] },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing[1] },
  input: {
    backgroundColor: c.bg.elevated, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: 15, color: c.text.primary,
  },

  presetsSection: { gap: spacing[2] },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  presetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1,
    backgroundColor: c.border.subtle,
  },
  presetIconWrap: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  presetLabel: { fontSize: 12, fontWeight: '700' },

  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  freqChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
  },
  freqChipText: { fontSize: 12, fontWeight: '600', color: c.text.muted },

  typeRow: { flexDirection: 'row', gap: spacing[3] },
  typePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.lg,
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
  },
  typePillActive: { backgroundColor: c.text.primary, borderColor: c.text.primary },
  typePillText: { fontSize: 13, fontWeight: '600', color: c.text.muted },
  typePillTextActive: { color: c.bg.primary },

  countBox: { backgroundColor: c.bg.elevated, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },
  unitPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  unitChip: {
    paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm,
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },
  unitChipActive: { backgroundColor: c.accent.amber + '20', borderColor: c.accent.amber },
  unitChipText: { fontSize: 11, fontWeight: '600', color: c.text.muted },
  unitChipTextActive: { color: c.accent.amber },

  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: c.border.subtle, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', gap: spacing[2] },
  colorBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorBtnActive: { borderWidth: 2, borderColor: c.text.primary, transform: [{ scale: 1.15 }] },
  addBtn: { backgroundColor: c.accent.amber, borderRadius: radius.full, paddingVertical: spacing[4], alignItems: 'center', marginTop: spacing[2] },
  addBtnDisabled: { opacity: 0.35 },
  addBtnText: { fontSize: 15, fontWeight: '700', color: c.bg.primary },

  reminderWrap: { backgroundColor: c.bg.elevated, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, overflow: 'hidden' },
  reminderToggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  reminderLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: c.text.secondary },
  toggleTrack: { width: 38, height: 22, borderRadius: 11, backgroundColor: c.border.subtle, justifyContent: 'center', paddingHorizontal: 3 },
  toggleTrackOn: { backgroundColor: c.accent.purple },
  toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: c.border.subtle },
  toggleThumbOn: { backgroundColor: '#fff', transform: [{ translateX: 16 }] },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingBottom: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle, paddingTop: spacing[3] },
  timeUnit: { alignItems: 'center', gap: 4 },
  timeArrow: { width: 36, height: 28, borderRadius: radius.md, backgroundColor: c.border.subtle, alignItems: 'center', justifyContent: 'center' },
  timeDigit: { fontSize: 28, fontWeight: '800', color: c.text.primary, letterSpacing: 1, minWidth: 44, textAlign: 'center' },
  timeSep: { fontSize: 28, fontWeight: '800', color: c.text.muted, marginBottom: 4 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HabitsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { habits, todayDone, isLoading, toggle, increment, decrement, add, remove, update, getStreak, getLast7, getLast30, getTodayCount } = useHabits();
  const [showAdd, setShowAdd]      = useState(false);
  const [showMonth, setShowMonth]  = useState(false);
  const [editingHabit, setEditing] = useState<Habit | null>(null);

  const doneCount = todayDone.length;
  const allDone   = habits.length > 0 && doneCount === habits.length;

  // Done habits sink to bottom so remaining ones are always at top
  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => {
      const aDone = todayDone.includes(a.id) ? 1 : 0;
      const bDone = todayDone.includes(b.id) ? 1 : 0;
      return aDone - bDone;
    }),
    [habits, todayDone],
  );

  const handleDelete = (habit: Habit) => {
    Alert.alert('Usuń nawyk', `Usunąć "${habit.title}"?`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { haptic.medium(); remove(habit.id); toast.info('Usunięto'); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
            <PressableScale onPress={() => setShowMonth((v) => !v)} style={[styles.iconBtn, showMonth && styles.iconBtnActive]}>
              <CalendarDays size={17} color={showMonth ? colors.accent.purple : colors.text.secondary} />
            </PressableScale>
          )}
          <PressableScale onPress={() => setShowAdd(true)} style={[styles.iconBtn, styles.addBtn]}>
            <Plus size={20} color={colors.bg.primary} />
          </PressableScale>
        </View>
      </View>

      {habits.length > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {
            width: `${(doneCount / habits.length) * 100}%` as any,
            backgroundColor: allDone ? colors.accent.green : colors.accent.amber,
          }]} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {allDone && (() => {
          const bestStreak = Math.max(...habits.map(h => getStreak(h.id)), 0);
          return (
            <View style={styles.allDoneCard}>
              <View style={styles.allDoneIconWrap}>
                <CalendarDays size={22} color={colors.accent.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.allDoneTitle}>Wszystkie nawyki ukończone!</Text>
                <Text style={styles.allDoneSub}>
                  {bestStreak >= 2 ? `Najlepsza seria: ${bestStreak} dni` : 'Doskonała robota na dziś!'}
                </Text>
              </View>
            </View>
          );
        })()}

        {habits.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Zap size={32} color={colors.accent.amber} />
            </View>
            <Text style={styles.emptyTitle}>Zacznij budować nawyki</Text>
            <Text style={styles.emptySub}>Codzienne rutyny pomagają w skupieniu i redukcji decyzji</Text>
            <PressableScale onPress={() => setShowAdd(true)} style={styles.emptyBtn}>
              <Plus size={16} color={colors.bg.primary} />
              <Text style={styles.emptyBtnText}>Dodaj pierwszy nawyk</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            {sortedHabits.map((habit) => {
              const isDone = todayDone.includes(habit.id);
              const count  = getTodayCount(habit.id);
              const goal   = habit.type === 'count' ? (habit.dailyGoal ?? 1) : 1;
              return (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  done={isDone}
                  count={count}
                  streak={getStreak(habit.id)}
                  last7={getLast7(habit.id)}
                  onToggle={() => {
                    haptic[isDone ? 'tap' : 'success']();
                    toggle(habit.id);
                  }}
                  onIncrement={() => {
                    haptic[count + 1 >= goal ? 'success' : 'tap']();
                    increment(habit.id);
                  }}
                  onDecrement={() => { haptic.tap(); decrement(habit.id); }}
                  onDelete={() => handleDelete(habit)}
                  onEdit={() => setEditing(habit)}
                />
              );
            })}
            {showMonth && <MonthGrid habits={habits} getLast30={getLast30} />}
          </>
        )}
      </ScrollView>

      <HabitFormModal
        visible={showAdd || editingHabit != null}
        editing={editingHabit}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        onSave={(data) => {
          if (editingHabit) {
            update(editingHabit.id, data);
            toast.success('Nawyk zaktualizowany');
          } else {
            add(data);
            toast.success('Nawyk dodany');
          }
          setEditing(null);
          setShowAdd(false);
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontSize: 18, fontWeight: '800', color: c.text.primary },
  subtitle: { fontSize: 11, color: c.text.secondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: c.accent.purple + '18', borderColor: c.accent.purple + '40' },
  addBtn: { backgroundColor: c.accent.amber, borderColor: c.accent.amber },
  progressTrack: { height: 8, backgroundColor: c.border.subtle, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 60 },

  allDoneCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.accent.green + '12',
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.accent.green + '35',
    padding: spacing[4],
  },
  allDoneIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: c.accent.green + '20',
    borderWidth: 1, borderColor: c.accent.green + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  allDoneTitle: { fontSize: 14, fontWeight: '800', color: c.accent.green, lineHeight: 20 },
  allDoneSub: { fontSize: 12, color: c.text.secondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing[4] },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: c.accent.amber + '15', borderWidth: 1, borderColor: c.accent.amber + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: c.text.primary },
  emptySub: { fontSize: 14, color: c.text.muted, textAlign: 'center', lineHeight: 21, paddingHorizontal: spacing[6] },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.accent.amber, borderRadius: radius.full,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3], marginTop: spacing[2],
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: c.bg.primary },
});
