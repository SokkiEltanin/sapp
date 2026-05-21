import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  X, Check, Clock, AlignLeft, DollarSign, Calendar,
  ChevronUp, ChevronDown,
} from 'lucide-react-native';
import { colors, spacing, radius } from '@/theme';
import { workService } from '@/services/workService';
import { useWorkStore } from '@/store/workStore';
import { toast } from '@/store/toastStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDate(s: string): string {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}

// ─── Time picker ─────────────────────────────────────────────────────────────

function TimePicker({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(':').map(Number);
  const inc = (delta: number, part: 'h' | 'm') => {
    if (part === 'h') {
      const nh = (h + delta + 24) % 24;
      onChange(`${pad(nh)}:${pad(m)}`);
    } else {
      const nm = (m + delta + 60) % 60;
      onChange(`${pad(h)}:${pad(nm)}`);
    }
  };
  return (
    <View style={tp.wrap}>
      <Text style={tp.label}>{label}</Text>
      <View style={tp.row}>
        <View style={tp.unit}>
          <TouchableOpacity onPress={() => inc(1, 'h')} style={tp.btn}>
            <ChevronUp size={14} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={tp.digit}>{pad(h)}</Text>
          <TouchableOpacity onPress={() => inc(-1, 'h')} style={tp.btn}>
            <ChevronDown size={14} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <Text style={tp.colon}>:</Text>
        <View style={tp.unit}>
          <TouchableOpacity onPress={() => inc(5, 'm')} style={tp.btn}>
            <ChevronUp size={14} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={tp.digit}>{pad(m)}</Text>
          <TouchableOpacity onPress={() => inc(-5, 'm')} style={tp.btn}>
            <ChevronDown size={14} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const tp = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', gap: spacing[2] },
  label: { fontSize: 10, fontWeight: '600', color: colors.text.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unit:  { alignItems: 'center', gap: 2 },
  colon: { fontSize: 24, fontWeight: '800', color: colors.text.primary, marginTop: -4 },
  digit: { fontSize: 28, fontWeight: '900', color: colors.text.primary, letterSpacing: -1, minWidth: 44, textAlign: 'center' },
  btn:   { width: 36, height: 26, alignItems: 'center', justifyContent: 'center' },
});

// ─── Date picker (simple +/- day) ────────────────────────────────────────────

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const shift = (delta: number) => {
    const d = new Date(value);
    d.setDate(d.getDate() + delta);
    onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };
  const today = todayStr();
  const isToday = value === today;
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  const isTomorrow = value === tomorrow;
  const label = isToday ? 'Dziś' : isTomorrow ? 'Jutro' : fmtDate(value);
  return (
    <View style={dp.wrap}>
      <TouchableOpacity onPress={() => shift(-1)} style={dp.arrow}>
        <ChevronUp size={18} color={colors.text.secondary} />
      </TouchableOpacity>
      <View style={dp.mid}>
        <Calendar size={14} color={colors.accent.blue} />
        <Text style={dp.label}>{label}</Text>
      </View>
      <TouchableOpacity onPress={() => shift(1)} style={dp.arrow}>
        <ChevronDown size={18} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}

const dp = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[3], backgroundColor: colors.bg.elevated, borderRadius: radius.lg, paddingVertical: spacing[3], borderWidth: 1, borderColor: colors.border.default },
  arrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  mid:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minWidth: 90, justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AddWorkShift() {
  const { settings, addShift: storeAdd } = useWorkStore();

  const [date, setDate]         = useState(todayStr());
  const [startTime, setStart]   = useState('08:00');
  const [endTime, setEnd]       = useState('16:00');
  const [note, setNote]         = useState('');
  const [salary, setSalary]     = useState(String(settings.monthlySalary));
  const [hours, setHours]       = useState(String(settings.hoursPerMonth));
  const [saving, setSaving]     = useState(false);

  // Duration preview
  const durationMin = (() => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  })();
  const durationLabel = durationMin > 0
    ? `${Math.floor(durationMin / 60)}h ${durationMin % 60 > 0 ? `${durationMin % 60}m` : ''}`.trim()
    : '—';

  // Earnings preview
  const salaryNum = parseFloat(salary) || 0;
  const hoursNum  = parseFloat(hours)  || 1;
  const perSecond = salaryNum / (hoursNum * 3600);
  const earned    = perSecond * durationMin * 60;
  const perHour   = perSecond * 3600;

  const save = async () => {
    if (saving) return;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      toast.error('Godzina końca musi być po godzinie startu');
      return;
    }
    setSaving(true);
    try {
      const shift = await workService.addShift({
        date,
        startTime,
        endTime,
        note: note.trim() || undefined,
        monthlySalary: salaryNum,
        hoursPerMonth: hoursNum,
        currency: settings.currency,
      });
      storeAdd(shift);
      toast.success('Zmiana pracy dodana');
      router.back();
    } catch (e: any) {
      toast.error('Błąd zapisu: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} hitSlop={10}>
            <X size={18} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={s.title}>Zmiana pracy</Text>
          <TouchableOpacity onPress={save} style={[s.saveBtn, saving && { opacity: 0.5 }]} hitSlop={10} disabled={saving}>
            <Check size={18} color={colors.accent.green} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Date */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Data</Text>
            <DatePicker value={date} onChange={setDate} />
          </View>

          {/* Time pickers */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Godziny</Text>
            <View style={[s.card, s.timesRow]}>
              <TimePicker label="Od" value={startTime} onChange={setStart} />
              <View style={s.timeSep} />
              <TimePicker label="Do" value={endTime} onChange={setEnd} />
            </View>
            {durationMin > 0 && (
              <View style={s.durationRow}>
                <Clock size={12} color={colors.text.muted} />
                <Text style={s.durationText}>Czas pracy: {durationLabel}</Text>
              </View>
            )}
          </View>

          {/* Salary settings */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Stawka</Text>
            <View style={s.card}>
              <View style={s.inputRow}>
                <DollarSign size={14} color={colors.accent.blue} />
                <Text style={s.inputLabel}>Pensja miesięczna (zł)</Text>
                <TextInput
                  style={s.numInput}
                  value={salary}
                  onChangeText={setSalary}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
              <View style={s.divider} />
              <View style={s.inputRow}>
                <Clock size={14} color={colors.accent.purple} />
                <Text style={s.inputLabel}>Godziny w miesiącu</Text>
                <TextInput
                  style={s.numInput}
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            </View>
          </View>

          {/* Earnings preview */}
          {durationMin > 0 && salaryNum > 0 && (
            <View style={[s.card, s.previewCard]}>
              <Text style={s.previewLabel}>Podgląd zarobku za tę zmianę</Text>
              <Text style={s.previewAmount}>{earned.toFixed(2)} zł</Text>
              <Text style={s.previewSub}>
                {perHour.toFixed(2)} zł/h · {perSecond.toFixed(4)} zł/s
              </Text>
            </View>
          )}

          {/* Note */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Notatka (opcjonalnie)</Text>
            <View style={[s.card, s.noteWrap]}>
              <AlignLeft size={14} color={colors.text.muted} style={{ marginTop: 2 }} />
              <TextInput
                style={s.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="np. nadgodziny, projekt X..."
                placeholderTextColor={colors.text.muted}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Save button */}
          <TouchableOpacity style={[s.saveFullBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving} activeOpacity={0.8}>
            <Check size={16} color="#000" />
            <Text style={s.saveBtnText}>{saving ? 'Zapisuję...' : 'Zapisz zmianę'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  saveBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text.primary },

  section:      { gap: spacing[2] },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.5, textTransform: 'uppercase', paddingLeft: 2 },

  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default, padding: spacing[4],
  },

  timesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  timeSep:  { width: 1, height: 60, backgroundColor: colors.border.subtle },

  durationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: 2 },
  durationText:{ fontSize: 12, color: colors.text.muted },

  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  inputLabel: { flex: 1, fontSize: 14, color: colors.text.secondary, fontWeight: '500' },
  numInput: {
    fontSize: 16, fontWeight: '700', color: colors.text.primary,
    textAlign: 'right', minWidth: 80, paddingVertical: 4,
  },
  divider: { height: 1, backgroundColor: colors.border.subtle, marginVertical: spacing[3] },

  previewCard: {
    alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.accent.green + '10',
    borderColor: colors.accent.green + '30',
  },
  previewLabel:  { fontSize: 10, fontWeight: '600', color: colors.accent.green, letterSpacing: 0.8, textTransform: 'uppercase' },
  previewAmount: { fontSize: 32, fontWeight: '900', color: colors.accent.green, letterSpacing: -1 },
  previewSub:    { fontSize: 11, color: colors.accent.green + 'AA' },

  noteWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  noteInput: { flex: 1, fontSize: 14, color: colors.text.primary, lineHeight: 20, minHeight: 60 },

  saveFullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    backgroundColor: colors.accent.green, borderRadius: radius.xl, paddingVertical: spacing[4],
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
