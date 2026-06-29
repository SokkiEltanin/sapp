import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';

interface Props {
  value: string;           // YYYY-MM-DD or ''
  onChange: (date: string) => void;
  placeholder?: string;
  style?: any;
}

const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toDisplay(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function firstDow(year: number, month: number) {
  const dow = new Date(year, month, 1).getDay();
  return dow === 0 ? 6 : dow - 1;
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function DatePickerField({ value, onChange, placeholder, style }: Props) {
  const c = useColors();
  const dp = useMemo(() => makeDp(c), [c]);
  const [open, setOpen] = useState(false);
  const today = todayIso();

  const [vy, vm] = useMemo(() => {
    const src = value || today;
    const p = src.split('-').map(Number);
    return [p[0], p[1] - 1];
  }, [value, open]);

  const [viewYear, setViewYear] = useState(vy);
  const [viewMonth, setViewMonth] = useState(vm);

  const cells = useMemo(() => {
    const blanks: null[] = Array(firstDow(viewYear, viewMonth)).fill(null);
    const days = Array.from({ length: daysInMonth(viewYear, viewMonth) }, (_, i) => i + 1);
    return [...blanks, ...days] as (number | null)[];
  }, [viewYear, viewMonth]);

  const openPicker = () => {
    const src = value || today;
    const p = src.split('-').map(Number);
    setViewYear(p[0]);
    setViewMonth(p[1] - 1);
    setOpen(true);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity onPress={openPicker} style={[dp.field, style]} activeOpacity={0.75}>
        <Calendar size={14} color={c.text.muted} />
        <Text style={[dp.value, !value && dp.placeholder]}>
          {value ? toDisplay(value) : (placeholder ?? 'Wybierz datę')}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View style={dp.overlay} />
        </Pressable>
        <View style={dp.modal} pointerEvents="box-none">
          <View style={dp.inner}>
            <View style={dp.header}>
              <TouchableOpacity onPress={prevMonth} style={dp.navBtn}>
                <ChevronLeft size={18} color={c.text.secondary} />
              </TouchableOpacity>
              <Text style={dp.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={dp.navBtn}>
                <ChevronRight size={18} color={c.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={dp.dayLabels}>
              {DAY_LABELS.map(d => <Text key={d} style={dp.dayLabel}>{d}</Text>)}
            </View>

            <View style={dp.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={i} style={dp.cell} />;
                const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                const isSelected = iso === value;
                const isToday = iso === today;
                return (
                  <TouchableOpacity
                    key={i} style={dp.cell}
                    onPress={() => selectDay(day)} activeOpacity={0.75}
                  >
                    <View style={[dp.dayCircle, isSelected && dp.cellSel, isToday && !isSelected && dp.cellToday]}>
                      <Text style={[dp.cellText, isSelected && dp.cellTextSel, isToday && !isSelected && { color: c.accent.blue }]}>
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={() => { onChange(today); setOpen(false); }} style={dp.todayBtn}>
              <Text style={dp.todayBtnText}>Dziś</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeDp = (c: typeof colors) => StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  value: { flex: 1, fontSize: 14, fontWeight: '600', color: c.text.primary },
  placeholder: { color: c.text.muted },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  modal: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  inner: {
    width: '100%', backgroundColor: c.bg.secondary,
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], gap: spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  monthTitle: { fontSize: 15, fontWeight: '700', color: c.text.primary },

  dayLabels: { flexDirection: 'row' },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: c.text.muted, paddingBottom: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  // Fixed-size circle centered inside the square cell — guarantees a perfect,
  // centered highlight regardless of cell-width rounding.
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cellSel: { backgroundColor: c.text.primary },
  cellToday: { borderWidth: 1, borderColor: c.accent.blue },
  cellText: { fontSize: 13, fontWeight: '500', color: c.text.primary },
  cellTextSel: { color: c.bg.primary, fontWeight: '800' },

  todayBtn: {
    alignSelf: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default,
  },
  todayBtnText: { fontSize: 12, fontWeight: '600', color: c.text.secondary },
});
