import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';

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

// 2026-09-09, user (dopytany o sekcję "Dane osobowe" w Ustawieniach — data urodzenia): "jak
// klikam datę urodzenia to mam tylko opcje przeklikiwania miesięcy a nie mam roku przez co
// muszę przeklinać milion razy" — same strzałki miesiąc-po-miesiącu (`prevMonth`/`nextMonth`)
// wymagały dziesiątek tapnięć żeby cofnąć się o dekady (data urodzenia to skrajny przypadek,
// ale komponent jest współdzielony w 19 miejscach — długi/krótki, przyszły/przeszły zakres
// wszędzie inny). Naprawa: nagłówek miesiąca/roku jest teraz tappable — przełącza na siatkę
// LAT (`YEARS`, `CURRENT-100`…`CURRENT+15`, malejąco — bliskie/przyszłe lata u góry, bo to
// częstszy przypadek dla dat zadań/długów niż urodzeń), wybór roku wraca do siatki dni z tym
// samym miesiącem. Strzałki miesiąca zostają BEZ zmian — to rozwiązuje TYLKO brakujący skok
// po latach, nie zastępuje istniejącej nawigacji.
const CURRENT_YEAR = new Date().getFullYear();
const YEARS: number[] = Array.from({ length: (CURRENT_YEAR + 15) - (CURRENT_YEAR - 100) + 1 }, (_, i) => (CURRENT_YEAR + 15) - i);

export default function DatePickerField({ value, onChange, placeholder, style }: Props) {
  const c = useColors();
  const dp = useMemo(() => makeDp(c), [c]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'days' | 'years'>('days');
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
    setMode('days');
    setOpen(true);
  };

  const selectYear = (y: number) => {
    setViewYear(y);
    setMode('days');
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
              <TouchableOpacity onPress={prevMonth} style={dp.navBtn} disabled={mode === 'years'}>
                <ChevronLeft size={18} color={mode === 'years' ? 'transparent' : c.text.secondary} />
              </TouchableOpacity>
              {/* Tappable nagłówek → siatka lat (patrz komentarz przy `YEARS` u góry pliku) —
                  jedyny sposób na skok o dekady, bez którego cofnięcie się np. do roku
                  urodzenia wymagało dziesiątek tapnięć strzałki miesiąca. */}
              <TouchableOpacity onPress={() => setMode(m => m === 'days' ? 'years' : 'days')} activeOpacity={0.7}>
                <Text style={dp.monthTitle}>{mode === 'days' ? `${MONTH_NAMES[viewMonth]} ${viewYear}` : 'Wybierz rok'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={nextMonth} style={dp.navBtn} disabled={mode === 'years'}>
                <ChevronRight size={18} color={mode === 'years' ? 'transparent' : c.text.secondary} />
              </TouchableOpacity>
            </View>

            {mode === 'years' ? (
              <ScrollView style={dp.yearScroll} contentContainerStyle={dp.yearGrid}>
                {YEARS.map(y => {
                  const isSelected = y === viewYear;
                  const isCurrent = y === CURRENT_YEAR;
                  return (
                    <TouchableOpacity key={y} style={dp.yearCell} onPress={() => selectYear(y)} activeOpacity={0.75}>
                      <View style={[dp.yearChip, isSelected && dp.cellSel, isCurrent && !isSelected && dp.cellToday]}>
                        <Text style={[dp.cellText, isSelected && dp.cellTextSel, isCurrent && !isSelected && { color: c.text.primary }]}>
                          {y}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <>
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
                          <Text style={[dp.cellText, isSelected && dp.cellTextSel, isToday && !isSelected && { color: c.text.primary }]}>
                            {day}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <TouchableOpacity onPress={() => { onChange(today); setOpen(false); }} style={dp.todayBtn}>
              <Text style={dp.todayBtnText}>Dziś</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeDp = themedStyles((c: typeof colors) => StyleSheet.create({
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
  cellToday: { borderWidth: 1, borderColor: c.text.primary },
  cellText: { fontSize: 13, fontWeight: '500', color: c.text.primary },
  cellTextSel: { color: c.bg.primary, fontWeight: '800' },

  // Siatka lat (2026-09-09) — ten sam wzorzec chipów co dni, ale 4 kolumny (zamiast 7) i
  // prostokątne chipy (nie kołowe) — rok to 4 cyfry, kółko byłoby albo za ciasne albo
  // rozciągnięte do owalu. `yearScroll` ma STAŁĄ wysokość (nie rośnie z siatką dni pod spodem
  // — jest sam, bez `dayLabels`), żeby modal nie skakał rozmiarem między trybami dzień/rok.
  yearScroll: { maxHeight: 260 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  yearCell: { width: '25%', paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  yearChip: { width: '86%', paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },

  todayBtn: {
    alignSelf: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default,
  },
  todayBtnText: { fontSize: 12, fontWeight: '600', color: c.text.secondary },
}));
