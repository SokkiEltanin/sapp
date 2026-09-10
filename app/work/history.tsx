import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, X, Briefcase, Pencil } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useExpensesStore } from '@/store/expensesStore';
import { useCalendarStore } from '@/store/calendarStore';
import { workService } from '@/services/workService';
import {
  computePayMonthsForEmployers, employerPayMonthsSummary, shiftsForEmployerInMonth,
  EmployerPayMonthRow, EmployerShift,
} from '@/utils/workSummary';
import { Employer } from '@/types';
import { haptic } from '@/utils/haptics';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const ACCENT = '#60A5FA';
const MONEY = '#2AC68F';

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
function firstDow(year: number, month0: number) {
  const dow = new Date(year, month0, 1).getDay();
  return dow === 0 ? 6 : dow - 1;
}
function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}

// Ekran "Historia pracy" (2026-09-10, drugi front przebudowy Pracy — patrz ARCHITECTURE.md
// §66/§67, user: "praca zakładkę bym od nowa zbudował... rozpisane co gdzie jak, w pracy bym
// podzielił na miesiące lepiej pokazał to i ogólną średnią" + doprecyzowanie: "historia
// ostatnich miesięcy z wypłatami i średnia gdzie mogę kliknąć na każdy miesiąc sprawdzić
// szczegóły i czy dobrze złapało dni jak pracowałem, taki mini kalendarz"). Osobny ekran
// (nie nowa zakładka w pasku, user: "osobny ekran spod dashboardu/ustawień") — dostępny z
// Ustawienia → Praca i z panelu "Praca" na dashboardzie. Buduje na fundamencie pracodawców
// (§66, `computePayMonthsForEmployers`/`employerPayMonthsSummary`) — czysto WIDOK, zero nowej
// logiki liczenia (ta sama `computePayMonths` co dotąd, tylko per pracodawca i zebrana tu w
// jedno, przeglądalne miejsce zamiast rozproszonych fragmentów w Ustawieniach/dashboardzie).
export default function WorkHistory() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { expenses } = useExpensesStore();
  const { events, gcalEvents } = useCalendarStore();
  const allEvents = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);

  const [employers, setEmployers] = useState<Employer[]>([]);
  useEffect(() => { workService.getEmployers().then(setEmployers).catch(() => {}); }, []);

  const [filterId, setFilterId] = useState<string | 'all'>('all');
  const [showHidden, setShowHidden] = useState(false);

  const allRows = useMemo(() => computePayMonthsForEmployers(expenses, allEvents, employers), [expenses, allEvents, employers]);
  const rows = useMemo(
    () => allRows.filter(r => (showHidden || !r.employerHidden) && (filterId === 'all' || r.employerId === filterId)),
    [allRows, showHidden, filterId],
  );
  // Zawsze `includeHidden: true` — `rows` już wcześniej przefiltrowane (showHidden/filterId),
  // filtrowanie DRUGI raz po `employerHidden` wewnątrz `employerPayMonthsSummary` wycięłoby z
  // podsumowania te wiersze, które user WŁAŚNIE świadomie odkrył (`showHidden`).
  const summary = useMemo(() => employerPayMonthsSummary(rows, { includeHidden: true }), [rows]);
  const avgMonthly = useMemo(() => {
    const included = rows.filter(r => !r.excluded && r.amount > 0);
    if (included.length === 0) return null;
    return included.reduce((sum, r) => sum + r.amount, 0) / included.length;
  }, [rows]);

  const [detail, setDetail] = useState<EmployerPayMonthRow | null>(null);
  const detailEmployer = detail ? employers.find(e => e.id === detail.employerId) ?? null : null;
  const detailShifts = useMemo<EmployerShift[]>(
    () => (detail && detailEmployer) ? shiftsForEmployerInMonth(allEvents, detailEmployer, detail.month) : [],
    [detail, detailEmployer, allEvents],
  );

  const multiEmployer = employers.length > 1;
  const hiddenCount = employers.filter(e => e.hidden).length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Historia pracy</Text>
        <View style={{ width: 24 }} />
      </View>

      {multiEmployer && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          <PressableScale onPress={() => setFilterId('all')} style={[s.chip, filterId === 'all' && s.chipOn]}>
            <Text style={[s.chipTxt, filterId === 'all' && s.chipTxtOn]}>Wszystko</Text>
          </PressableScale>
          {employers.map(emp => (
            <PressableScale key={emp.id} onPress={() => setFilterId(emp.id)} style={[s.chip, filterId === emp.id && s.chipOn, emp.hidden && !showHidden && s.chipDisabled]}>
              <Text style={[s.chipTxt, filterId === emp.id && s.chipTxtOn]} numberOfLines={1}>{emp.name}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Text style={s.heroBig}>{avgMonthly != null ? `${Math.round(avgMonthly).toLocaleString('pl-PL')} zł` : '—'}</Text>
          <Text style={s.heroSub}>średnio na miesiąc{summary.includedCount > 0 ? ` · z ${summary.includedCount} ${summary.includedCount === 1 ? 'miesiąca' : 'miesięcy'}` : ''}</Text>
          <View style={s.heroRow}>
            <View style={s.heroStat}>
              <Text style={[s.heroStatVal, { color: MONEY }]}>{summary.avgRate != null ? summary.avgRate.toFixed(2) : '—'}</Text>
              <Text style={s.heroStatLbl}>zł/h średnio</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={[s.heroStatVal, { color: ACCENT }]}>{Math.round(summary.totalEarned).toLocaleString('pl-PL')}</Text>
              <Text style={s.heroStatLbl}>zł łącznie</Text>
            </View>
          </View>
        </View>

        {hiddenCount > 0 && (
          <PressableScale onPress={() => { haptic.tap(); setShowHidden(v => !v); }} style={s.hiddenToggle}>
            <Text style={s.hiddenToggleTxt}>{showHidden ? 'Ukryj schowane pracodawców' : `Pokaż ${hiddenCount} schowan${hiddenCount === 1 ? 'ego pracodawcę' : 'ych pracodawców'}`}</Text>
          </PressableScale>
        )}

        {rows.length === 0 ? (
          <View style={s.empty}>
            <Briefcase size={28} color={c.text.muted} />
            <Text style={s.emptyTxt}>
              {employers.length === 0
                ? 'Brak skonfigurowanej pracy — ustaw prefiks/tryb w Ustawienia → Praca.'
                : 'Brak jeszcze żadnej wypłaty do pokazania.'}
            </Text>
          </View>
        ) : (
          <View style={s.list}>
            {rows.map(r => {
              const rate = r.hours > 0 ? r.amount / r.hours : null;
              return (
                <PressableScale key={`${r.employerId}:${r.month}`} onPress={() => { haptic.tap(); setDetail(r); }} style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowMonth, r.excluded && { color: c.text.muted }]}>
                      {monthLabel(r.month)}{r.excluded ? ' · poza średnią' : ''}
                    </Text>
                    {multiEmployer && <Text style={s.rowEmployer} numberOfLines={1}>{r.employerName}{r.employerHidden ? ' · schowana' : ''}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.rowAmount}>{Math.round(r.amount).toLocaleString('pl-PL')} zł</Text>
                    <Text style={s.rowHours}>{r.hours > 0 ? `${Math.round(r.hours)} h${rate != null ? ` · ${rate.toFixed(1)} zł/h` : ''}` : 'brak godzin'}</Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        )}
        <Text style={s.hint}>Dotknij miesiąc, żeby zobaczyć mini-kalendarz dni roboczych i sprawdzić, czy dobrze złapało zmiany.</Text>
      </ScrollView>

      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <Pressable style={s.overlay} onPress={() => setDetail(null)} />
        <View style={s.modalWrap} pointerEvents="box-none">
          <View style={s.modalCard}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>{detail ? monthLabel(detail.month) : ''}</Text>
              <TouchableOpacity onPress={() => setDetail(null)} hitSlop={10}><X size={20} color={c.text.primary} /></TouchableOpacity>
            </View>
            {detail && (
              <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
                {multiEmployer && <Text style={s.modalEmployer}>{detail.employerName}</Text>}
                <View style={s.modalStatsRow}>
                  <Text style={s.modalStat}><Text style={{ color: MONEY, fontWeight: '800' }}>{Math.round(detail.amount).toLocaleString('pl-PL')} zł</Text> wypłata</Text>
                  <Text style={s.modalStat}><Text style={{ color: ACCENT, fontWeight: '800' }}>{Math.round(detail.hours)} h</Text> przepracowane</Text>
                </View>

                {/* Mini-kalendarz — dni z dopasowaną zmianą podświetlone + suma godzin tego
                    dnia, żeby dało się na oko zweryfikować "czy dobrze złapało dni jak
                    pracowałem" bez przeklikiwania każdego eventu z osobna. */}
                <MiniCalendar month={detail.month} shifts={detailShifts} colors={c} />

                {detailShifts.length > 0 ? (
                  <View style={{ marginTop: spacing[3] }}>
                    <Text style={s.shiftsTitle}>ZMIANY · {detailShifts.length} · {detailShifts.reduce((sum, sh) => sum + sh.hours, 0).toFixed(1)} h</Text>
                    {detailShifts.map(sh => (
                      <PressableScale key={sh.id} onPress={() => { setDetail(null); router.push(`/calendar/${sh.id}` as any); }} style={s.shiftRow}>
                        <View style={s.shiftDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.shiftTitle} numberOfLines={1}>{sh.title || 'Zmiana'}</Text>
                          <Text style={s.shiftMeta}>{sh.date} · {sh.startTime}–{sh.endTime}</Text>
                        </View>
                        <Text style={s.shiftHours}>{sh.hours.toFixed(1)} h</Text>
                        <Pencil size={13} color={c.text.muted} />
                      </PressableScale>
                    ))}
                  </View>
                ) : (
                  <Text style={s.noShifts}>Brak zmian w kalendarzu pasujących do prefiksu tego pracodawcy w tym miesiącu.</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MiniCalendar({ month, shifts, colors: c }: { month: string; shifts: EmployerShift[]; colors: ReturnType<typeof useColors> }) {
  const s = useMemo(() => makeS(c), [c]);
  const [y, m] = month.split('-').map(Number);
  const month0 = m - 1;
  const hoursByDay = useMemo(() => {
    const map: Record<number, number> = {};
    for (const sh of shifts) {
      const day = Number(sh.date.slice(8, 10));
      map[day] = (map[day] ?? 0) + sh.hours;
    }
    return map;
  }, [shifts]);
  const cells = useMemo(() => {
    const blanks: null[] = Array(firstDow(y, month0)).fill(null);
    const days = Array.from({ length: daysInMonth(y, month0) }, (_, i) => i + 1);
    return [...blanks, ...days] as (number | null)[];
  }, [y, month0]);

  return (
    <View style={{ marginTop: spacing[3] }}>
      <View style={s.calDayLabels}>
        {DAY_LABELS.map(d => <Text key={d} style={s.calDayLabel}>{d}</Text>)}
      </View>
      <View style={s.calGrid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={s.calCell} />;
          const h = hoursByDay[day] ?? 0;
          const worked = h > 0;
          return (
            <View key={i} style={s.calCell}>
              <View style={[s.calDayCircle, worked && s.calDayWorked]}>
                <Text style={[s.calDayText, worked && s.calDayTextWorked]}>{day}</Text>
                {worked && <Text style={s.calDayHours}>{h % 1 === 0 ? h : h.toFixed(1)}h</Text>}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 18, fontWeight: '800', color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2], gap: spacing[3], paddingBottom: spacing[8] },

  chipRow: { paddingHorizontal: spacing[4], paddingBottom: spacing[2], gap: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default },
  chipOn: { backgroundColor: ACCENT + '22', borderColor: ACCENT },
  chipDisabled: { opacity: 0.5 },
  chipTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary },
  chipTxtOn: { color: ACCENT },

  hero: { alignItems: 'center', padding: spacing[4], borderRadius: radius.xl, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default, gap: 4 },
  heroBig: { fontSize: 32, fontWeight: '900', color: c.text.primary },
  heroSub: { fontSize: 12, color: c.text.muted, marginBottom: spacing[2] },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  heroStat: { alignItems: 'center' },
  heroStatVal: { fontSize: 17, fontWeight: '800' },
  heroStatLbl: { fontSize: 10.5, color: c.text.muted, marginTop: 1 },
  heroDivider: { width: 1, height: 28, backgroundColor: c.border.default },

  hiddenToggle: { alignSelf: 'center', paddingHorizontal: spacing[3], paddingVertical: 6 },
  hiddenToggleTxt: { fontSize: 11.5, color: ACCENT, fontWeight: '700' },

  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyTxt: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },

  list: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[3], borderRadius: radius.lg, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default },
  rowMonth: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  rowEmployer: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  rowAmount: { fontSize: 14, fontWeight: '800', color: MONEY },
  rowHours: { fontSize: 11, color: c.text.muted, marginTop: 1 },

  hint: { fontSize: 11, color: c.text.muted, textAlign: 'center', marginTop: spacing[2] },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  modalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] },
  modalCard: { width: '100%', backgroundColor: c.bg.secondary, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4] },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  modalTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  modalEmployer: { fontSize: 12, color: c.text.muted, marginBottom: spacing[2] },
  modalStatsRow: { flexDirection: 'row', gap: spacing[4] },
  modalStat: { fontSize: 12.5, color: c.text.secondary },

  calDayLabels: { flexDirection: 'row' },
  calDayLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: c.text.muted, paddingBottom: 4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 1 },
  calDayCircle: { width: '92%', height: '92%', borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  calDayWorked: { backgroundColor: ACCENT + '2A', borderWidth: 1, borderColor: ACCENT + '66' },
  calDayText: { fontSize: 11, fontWeight: '600', color: c.text.secondary },
  calDayTextWorked: { color: c.text.primary, fontWeight: '800' },
  calDayHours: { fontSize: 8, fontWeight: '700', color: ACCENT, marginTop: -1 },

  shiftsTitle: { fontSize: 10.5, fontWeight: '800', color: c.text.muted, letterSpacing: 0.4, marginBottom: spacing[1] },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  shiftDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  shiftTitle: { fontSize: 12.5, fontWeight: '600', color: c.text.primary },
  shiftMeta: { fontSize: 10.5, color: c.text.muted, marginTop: 1 },
  shiftHours: { fontSize: 12, fontWeight: '700', color: MONEY },
  noShifts: { fontSize: 12, color: c.text.muted, marginTop: spacing[3], lineHeight: 17 },
}));
