import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { ChevronLeft, ChevronDown, ChevronUp, Dumbbell, Plus } from 'lucide-react-native';

import ExerciseLogHistory from '@/components/health/ExerciseLogHistory';
import DisplayText from '@/components/ui/DisplayText';
import PressableScale from '@/components/ui/PressableScale';
import { useExerciseLogging } from '@/hooks/useExerciseLogging';
import { EXERCISE_META } from '@/utils/exerciseMeta';
import { exerciseDayCell, exerciseMonthSummary } from '@/utils/exerciseCalendar';
import { ymd, fmtDay, tierAlpha } from '@/utils/waterCalendar';
import { plPlural } from '@/utils/plural';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const ACCENT = '#FB923C';   // ten sam pomarańcz co reszta akcentu "Trening" w appce
const MONTHS = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const WD = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const WINDOW = 371;

function resolveLabel(exercise: string): { label: string; unit: string } {
  const meta = EXERCISE_META.find((m) => m.id === exercise);
  return meta ? { label: meta.label, unit: meta.unit } : { label: exercise, unit: '' };
}

// Historia/kalendarz ćwiczeń (2026-10-15, ARCHITECTURE.md §324) — user, ostro: "nie ma
// historii nie wiem ile wczoraj zrobiłem i nie mogę edytować/dodawac... jak wchodzę nie
// widze postępu w sensie looku na całość np tego miesiąca". §323 dodał edycję/usuwanie TYLKO
// dla dzisiejszych wpisów (ikonka historii na ekranie Ćwiczenia) — ten ekran to właściwa
// odpowiedź na "historia" i "miesiąc": pełny kalendarz 1:1 z wzorcem `water-calendar.tsx`
// (okno rolkowe kończące się dziś, tap-dzień = edycja/dodanie wsteczne — pierwszy taki wzorzec
// w appce dla WODY, tu reużyty dla ćwiczeń), plus rzeczywisty miesięczny podsumowujący pasek
// (`exerciseMonthSummary`, kalendarzowy miesiąc, nie okno rolkowe — user chciał "tego
// miesiąca", nie "ostatnich 30 dni"). Dzień może mieć WIELE różnych ćwiczeń naraz (w
// przeciwieństwie do wody, jeden licznik) — kolor kafla = ile RÓŻNYCH z 6 kanonicznych
// ćwiczeń dnia (`distinctCount`/6), tap otwiera listę WSZYSTKICH wpisów tego dnia
// (`ExerciseLogHistory` z `resolveLabel` — ten sam komponent co §323, teraz obsługujący
// wielo-ćwiczeniowy dzień) + formularz dopisania zaległego wpisu dla TEJ daty.
export default function ExercisesHistoryScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { logs, streak, addLog, updateLog, removeLog } = useExerciseLogging();
  const [view, setView] = useState<'month' | 'year'>('month');
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const windowDays = view === 'month' ? 35 : WINDOW;

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addExerciseId, setAddExerciseId] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState('');

  const todayKey = ymd(new Date());
  const currentMonthKey = todayKey.slice(0, 7);
  const monthSummary = useMemo(() => exerciseMonthSummary(logs, currentMonthKey), [logs, currentMonthKey]);

  const { cells, weeks, monthCols } = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - (windowDays - 1));
    const firstDow = (start.getDay() + 6) % 7;
    const cells: { wd: number; wk: number; ds: string; distinctCount: number; dom: number; isToday: boolean }[] = [];
    const monthCols: { m: number; col: number }[] = [];
    let idx = 0, lastMonth = -1;
    for (const cur = new Date(start); cur <= now; cur.setDate(cur.getDate() + 1)) {
      const ds = ymd(cur);
      const cell = exerciseDayCell(logs, ds);
      const p = firstDow + idx;
      const wk = Math.floor(p / 7), wd = p % 7;
      const month = cur.getMonth();
      if (month !== lastMonth) { monthCols.push({ m: month, col: wk }); lastMonth = month; }
      cells.push({ wd, wk, ds, distinctCount: cell.distinctCount, dom: cur.getDate(), isToday: ds === todayKey });
      idx++;
    }
    const weeks = Math.floor((firstDow + idx - 1) / 7) + 1;
    return { cells, weeks, monthCols };
  }, [logs, windowDays, todayKey]);

  const isMonth = view === 'month';
  const MC = 40, MG = 6, MHEAD = 18;
  const mW = 7 * (MC + MG), mH = MHEAD + weeks * (MC + MG);
  const YC = 6, YG = 1.6, YTOP = 12;
  const yW = weeks * (YC + YG), yH = YTOP + 7 * (YC + YG);
  const last7 = cells.slice(-7);

  const openDay = (ds: string) => {
    haptic.tap();
    setSelectedDate((prev) => (prev === ds ? null : ds));
    setAddExerciseId(null);
    setAddDraft('');
  };

  const confirmAdd = () => {
    if (!selectedDate || !addExerciseId) return;
    const meta = EXERCISE_META.find((m) => m.id === addExerciseId);
    if (!meta) return;
    const amount = parseFloat(addDraft.replace(',', '.'));
    if (!addDraft || isNaN(amount) || amount <= 0) return;
    addLog(addExerciseId, amount, selectedDate);
    haptic.success();
    toast.success(`${fmtDay(selectedDate, todayKey)}: +${amount} ${meta.unit} ${meta.label}`);
    setAddExerciseId(null);
    setAddDraft('');
  };

  const dayEntries = selectedDate ? logs.filter((l) => l.date === selectedDate) : [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Historia ćwiczeń</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.hero, { borderColor: ACCENT + '3A', backgroundColor: ACCENT + '12' }]}>
          <Dumbbell size={26} color={ACCENT} />
          <View style={{ flex: 1 }}>
            <DisplayText style={s.heroNum}>{streak} <Text style={s.heroUnit}>{plPlural(streak, 'dzień', 'dni', 'dni')} z rzędu</Text></DisplayText>
            <Text style={s.heroSub}>seria liczy dowolny zalogowany dzień, nie trzeba robić wszystkiego naraz</Text>
          </View>
        </View>

        {/* Prawdziwy miesiąc kalendarzowy (user: "jak wchodzę nie widze postępu... np tego
            miesiąca"), NIE okno rolkowe jak siatka niżej — inne pytanie ("ten miesiąc" vs
            "ostatnie 35 dni"), więc osobny pasek. */}
        <View style={s.monthRow}>
          <View style={s.monthStat}><DisplayText style={s.monthStatVal}>{monthSummary.activeDays}</DisplayText><Text style={s.monthStatKey}>aktywnych dni</Text></View>
          <View style={s.monthDiv} />
          <View style={s.monthStat}><DisplayText style={s.monthStatVal}>{monthSummary.totalEntries}</DisplayText><Text style={s.monthStatKey}>wpisów</Text></View>
          <View style={s.monthDiv} />
          <View style={s.monthStat}><DisplayText style={s.monthStatVal}>{monthSummary.distinctExercises}</DisplayText><Text style={s.monthStatKey}>różnych ćwiczeń</Text></View>
        </View>

        <Text style={s.hint}>stuknij dzień, żeby zobaczyć/poprawić wpisy albo dopisać zaległy trening</Text>

        {/* Pasek "ostatnie 7 dni" — ten sam wzorzec co water-calendar.tsx. */}
        <View style={s.weekRow}>
          {last7.map((cell) => {
            const alpha = tierAlpha(cell.distinctCount, 6);
            const fill = alpha ? ACCENT + alpha : c.fill.subtle;
            return (
              <TouchableOpacity key={cell.ds} onPress={() => openDay(cell.ds)} style={s.weekCellTouch}>
                <Text style={s.weekCellDow}>{WD[cell.wd]}</Text>
                <View style={[
                  s.weekCell, { backgroundColor: fill },
                  cell.isToday && { borderWidth: 2, borderColor: c.text.primary },
                  selectedDate === cell.ds && { borderWidth: 2, borderColor: ACCENT },
                ]}>
                  <Text style={[s.weekCellNum, { opacity: cell.distinctCount > 0 ? 1 : 0.5 }]}>{cell.dom}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity activeOpacity={0.7} onPress={() => { haptic.tap(); setCalendarExpanded((v) => !v); }} style={s.expandRow}>
          <Text style={s.expandTxt}>{calendarExpanded ? 'Zwiń kalendarz' : 'Pokaż pełny kalendarz'}</Text>
          {calendarExpanded ? <ChevronUp size={16} color={c.text.muted} /> : <ChevronDown size={16} color={c.text.muted} />}
        </TouchableOpacity>

        {calendarExpanded && (
          <View style={s.viewToggle}>
            {(['month', 'year'] as const).map((v) => (
              <TouchableOpacity key={v} onPress={() => setView(v)} style={[s.viewBtn, view === v && s.viewBtnOn]}>
                <Text style={[s.viewBtnTxt, view === v && s.viewBtnTxtOn]}>{v === 'month' ? 'Miesiąc' : 'Rok'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {calendarExpanded && (
          <View style={s.gridCard}>
            {isMonth ? (
              <View style={{ width: '100%', aspectRatio: mW / mH }}>
                <Svg width="100%" height="100%" viewBox={`0 0 ${mW} ${mH}`} preserveAspectRatio="xMidYMid meet">
                  {WD.map((w, i) => (
                    <SvgText key={w} x={i * (MC + MG) + MC / 2} y={11} fontSize={9} fontWeight="700" fill={c.text.muted} textAnchor="middle">{w}</SvgText>
                  ))}
                  {cells.map((cell, i) => {
                    const x = cell.wd * (MC + MG), y = MHEAD + cell.wk * (MC + MG);
                    const alpha = tierAlpha(cell.distinctCount, 6);
                    const fill = alpha ? ACCENT + alpha : c.fill.subtle;
                    return (
                      <G key={i}>
                        <Rect x={x} y={y} width={MC} height={MC} rx={7} fill={fill}
                          stroke={cell.isToday ? c.text.primary : selectedDate === cell.ds ? ACCENT : undefined}
                          strokeWidth={cell.isToday || selectedDate === cell.ds ? 2.2 : 0} />
                        <SvgText x={x + MC / 2} y={y + MC / 2 + 4.5} fontSize={13} fontWeight="700"
                          fill={c.text.primary} textAnchor="middle" opacity={cell.distinctCount > 0 ? 1 : 0.5}>{cell.dom}</SvgText>
                      </G>
                    );
                  })}
                </Svg>
                {/* Nakładka dotykowa zwykłym Pressable (nie onPress na SVG) — ten sam fix co
                    water-calendar.tsx (hit-testing w react-native-svg pod skalowanym viewBox
                    jest znanym źródłem problemów). */}
                {cells.map((cell, i) => (
                  <Pressable
                    key={`t${i}`}
                    onPress={() => openDay(cell.ds)}
                    style={{
                      position: 'absolute',
                      left: `${(cell.wd * (MC + MG)) / mW * 100}%`,
                      top: `${(MHEAD + cell.wk * (MC + MG)) / mH * 100}%`,
                      width: `${MC / mW * 100}%`,
                      height: `${MC / mH * 100}%`,
                    }}
                  />
                ))}
              </View>
            ) : (
              <View style={{ width: '100%', aspectRatio: yW / yH }}>
                <Svg width="100%" height="100%" viewBox={`0 0 ${yW} ${yH}`} preserveAspectRatio="xMidYMid meet">
                  {monthCols.map(({ m, col }) => (
                    <SvgText key={`${m}-${col}`} x={col * (YC + YG)} y={8} fontSize={6} fill={c.text.muted}>{MONTHS[m]}</SvgText>
                  ))}
                  {cells.map((cell, i) => {
                    const alpha = tierAlpha(cell.distinctCount, 6);
                    const fill = alpha ? ACCENT + alpha : c.fill.subtle;
                    return <Rect key={i} x={cell.wk * (YC + YG)} y={YTOP + cell.wd * (YC + YG)} width={YC} height={YC} rx={1.3} fill={fill} />;
                  })}
                </Svg>
              </View>
            )}
          </View>
        )}

        {selectedDate && (
          <View style={s.dayCard}>
            <Text style={s.dayTitle}>{fmtDay(selectedDate, todayKey)}</Text>
            <ExerciseLogHistory
              entries={dayEntries}
              resolveLabel={resolveLabel}
              onUpdate={updateLog}
              onDelete={removeLog}
            />

            <Text style={s.addTitle}>Dopisz wpis</Text>
            <View style={s.chipsRow}>
              {EXERCISE_META.map((m) => (
                <PressableScale key={m.id} onPress={() => { haptic.tap(); setAddExerciseId(m.id); }} style={[s.chip, addExerciseId === m.id && s.chipActive]}>
                  <Text style={[s.chipTxt, addExerciseId === m.id && s.chipTxtActive]}>{m.label}</Text>
                </PressableScale>
              ))}
            </View>
            {addExerciseId && (
              <View style={s.addRow}>
                <TextInput
                  style={s.addInput}
                  keyboardType="numeric"
                  autoFocus
                  placeholder={`Ile ${EXERCISE_META.find((m) => m.id === addExerciseId)?.unit}…`}
                  placeholderTextColor={c.text.muted}
                  value={addDraft}
                  onChangeText={setAddDraft}
                />
                <PressableScale onPress={confirmAdd} style={s.addBtn}>
                  <Plus size={15} color="#07160F" />
                  <Text style={s.addBtnTxt}>Dodaj</Text>
                </PressableScale>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  title: { fontSize: 17, fontWeight: '800', color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2], gap: spacing[3] },

  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.lg, borderWidth: 1, padding: spacing[4] },
  heroNum: { fontSize: 26, fontWeight: '900', color: c.text.primary },
  heroUnit: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  heroSub: { fontSize: 11, color: c.text.muted, marginTop: 2 },

  monthRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingVertical: spacing[3] },
  monthStat: { flex: 1, alignItems: 'center' },
  monthStatVal: { fontSize: 18, fontWeight: '900', color: c.text.primary },
  monthStatKey: { fontSize: 10, color: c.text.muted, marginTop: 2, textAlign: 'center' },
  monthDiv: { width: 1, height: 28, backgroundColor: c.border.default },

  hint: { fontSize: 11, color: c.text.muted, textAlign: 'center' },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCellTouch: { alignItems: 'center', gap: 4 },
  weekCellDow: { fontSize: 9.5, color: c.text.muted, fontWeight: '700' },
  weekCell: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  weekCellNum: { fontSize: 13, fontWeight: '700', color: c.text.primary },

  expandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing[1] },
  expandTxt: { fontSize: 12, fontWeight: '700', color: c.text.muted },

  viewToggle: { flexDirection: 'row', backgroundColor: c.bg.card, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, padding: 3 },
  viewBtn: { flex: 1, paddingVertical: 7, borderRadius: radius.full, alignItems: 'center' },
  viewBtnOn: { backgroundColor: ACCENT },
  viewBtnTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary },
  viewBtnTxtOn: { color: '#07160F' },

  gridCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },

  dayCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], gap: spacing[2] },
  dayTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  addTitle: { fontSize: 12, fontWeight: '800', color: c.text.muted, marginTop: spacing[2] },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default },
  chipActive: { backgroundColor: '#FB923C1F', borderColor: ACCENT },
  chipTxt: { fontSize: 11.5, fontWeight: '700', color: c.text.secondary },
  chipTxtActive: { color: ACCENT },
  addRow: { flexDirection: 'row', gap: spacing[2] },
  addInput: { flex: 1, backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5, color: c.text.primary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2AC68F', borderRadius: radius.md, paddingHorizontal: 14, justifyContent: 'center' },
  addBtnTxt: { fontSize: 13, fontWeight: '800', color: '#07160F' },
}));
