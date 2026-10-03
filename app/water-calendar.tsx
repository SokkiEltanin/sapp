import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { ChevronLeft, Droplets, Snowflake, Check } from 'lucide-react-native';

import { getWaterHabit, getCounts, setCounts, getCountsRange } from '@/utils/habits';
import { getHealthGoals } from '@/utils/healthGoals';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { spacing, radius } from '@/theme';
import { plPlural } from '@/utils/plural';
import { ymd, fmtDay, tierAlpha } from '@/utils/waterCalendar';
import DisplayText from '@/components/ui/DisplayText';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const ACCENT = '#46B0DE';   // ten sam niebieski co ikonka/gauge wody w health.tsx
const ICE = '#7DD3FC';
const MONTHS = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const WD = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const WINDOW = 371;

// Kalendarz wody — szczegółowy widok picia wody (2026-10-03, user: "żebym widział w
// zakładce zdrowie szczegółowe dane picia wody ile dziennie itp np kalendarz z zaznaczoną
// tylko wodą i ilością wypitą (i że zużytych freezami) i żebym mógł modyfikować np wczoraj
// wypiłem ale nie było internetu i mi nie złapało"). Wzorzec 1:1 z habit-year.tsx (okno
// rolkowe 35/371 dni kończące się DZIŚ, nie prawdziwy kalendarz z nawigacją miesięcy — ten
// sam UX co reszta appki dla nawyków) + amount-aware kolorowanie (tier wg stosunku do celu,
// nie tylko zrobione/nie, jak YearPixels.tsx dla innych metryk) + tap na dzień → edycja
// wsteczna (backfill), czego habit-year.tsx NIE ma dla żadnego nawyku — pierwsze miejsce w
// appce z edycją przeszłego dnia nawyku. Osobny ekran (nie rozszerzenie habit-year.tsx) —
// ten jest dzielony przez WSZYSTKIE nawyki/liczniki, tap-to-edit tylko dla wody na razie.
export default function WaterCalendar() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const params = useLocalSearchParams<{ id?: string }>();
  const frozen = useStreakFreezeStore(st => st.frozen);

  const [habitId, setHabitId] = useState<string | null>(typeof params.id === 'string' ? params.id : null);
  const [goal, setGoal] = useState(8);
  const [glassMl, setGlassMl] = useState(250);
  const [counts, setCountsState] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'year'>('month');
  const windowDays = view === 'month' ? 35 : WINDOW;

  const [editDate, setEditDate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const [h, goals] = await Promise.all([getWaterHabit(), getHealthGoals()]);
      const id = h?.id ?? habitId;
      if (!alive) return;
      setHabitId(id);
      setGoal(h?.dailyGoal || goals.waterGoal || 8);
      setGlassMl(goals.glassMl || 250);
      if (!id) { setLoading(false); return; }
      const today = new Date();
      const dates: string[] = [];
      for (let i = WINDOW - 1; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); dates.push(ymd(d)); }
      const byDate = await getCountsRange(dates);
      const map: Record<string, number> = {};
      for (const ds of dates) { const v = byDate[ds]?.[id]; if (v > 0) map[ds] = v; }
      if (alive) { setCountsState(map); setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const todayKey = ymd(new Date());

  const { cells, weeks, monthCols, stats } = useMemo(() => {
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - (windowDays - 1));
    const firstDow = (start.getDay() + 6) % 7;
    const cells: { wd: number; wk: number; ds: string; count: number; froz: boolean; dom: number; isToday: boolean }[] = [];
    const monthCols: { m: number; col: number }[] = [];
    let idx = 0, lastMonth = -1;
    const seq: boolean[] = [];   // "żywy" dzień (cel osiągnięty LUB zamrożony) do streaku
    let totalGlasses = 0, daysWithData = 0, goalDays = 0, freezeDays = 0;
    for (const cur = new Date(start); cur <= today; cur.setDate(cur.getDate() + 1)) {
      const ds = ymd(cur);
      const count = counts[ds] ?? 0;
      const froz = !!habitId && !!frozen[`${habitId}|${ds}`];
      const p = firstDow + idx;
      const wk = Math.floor(p / 7), wd = p % 7;
      const month = cur.getMonth();
      if (month !== lastMonth) { monthCols.push({ m: month, col: wk }); lastMonth = month; }
      cells.push({ wd, wk, ds, count, froz, dom: cur.getDate(), isToday: ds === todayKey });
      seq.push(count >= goal || froz);
      if (count > 0) { totalGlasses += count; daysWithData++; }
      if (count >= goal) goalDays++;
      if (froz) freezeDays++;
      idx++;
    }
    const weeks = Math.floor((firstDow + idx - 1) / 7) + 1;
    let longest = 0, run = 0, current = 0;
    for (let i = 0; i < seq.length; i++) { if (seq[i]) { run++; if (run > longest) longest = run; } else run = 0; }
    const n = seq.length;
    let ci = (n > 0 && seq[n - 1]) ? n - 1 : n - 2;
    for (; ci >= 0; ci--) { if (seq[ci]) current++; else break; }
    return { cells, weeks, monthCols, stats: { totalGlasses, daysWithData, goalDays, freezeDays, longest, current } };
  }, [counts, frozen, habitId, goal, windowDays, todayKey]);

  const isMonth = view === 'month';
  const MC = 40, MG = 6, MHEAD = 18;
  const mW = 7 * (MC + MG), mH = MHEAD + weeks * (MC + MG);
  const YC = 6, YG = 1.6, YTOP = 12;
  const yW = weeks * (YC + YG), yH = YTOP + 7 * (YC + YG);

  const openDay = (ds: string, count: number) => {
    haptic.tap();
    setEditDate(ds);
    setEditValue(String(count));
  };
  const saveDay = async () => {
    if (!editDate) return;
    if (!habitId) { haptic.error(); toast.error('Brak nawyku „Woda" — dodaj najpierw wodę na Zdrowiu'); return; }
    const n = Math.max(0, Math.round(parseFloat(editValue.replace(',', '.')) || 0));
    haptic.success();
    const dayCounts = await getCounts(editDate);
    dayCounts[habitId] = n;
    await setCounts(editDate, dayCounts);
    setCountsState(prev => { const next = { ...prev }; if (n > 0) next[editDate] = n; else delete next[editDate]; return next; });
    toast.success(n > 0 ? `${fmtDay(editDate, todayKey)}: ${n} ${plPlural(n, 'szklanka', 'szklanki', 'szklanek')}` : `${fmtDay(editDate, todayKey)}: wyzerowano`);
    setEditDate(null);
  };

  const avgPerDay = windowDays > 0 ? stats.totalGlasses / windowDays : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Woda</Text>
        <View style={s.viewToggle}>
          {(['month', 'year'] as const).map(v => (
            <TouchableOpacity key={v} onPress={() => setView(v)} style={[s.viewBtn, view === v && s.viewBtnOn]}>
              <Text style={[s.viewBtnTxt, view === v && s.viewBtnTxtOn]}>{v === 'month' ? 'Miesiąc' : 'Rok'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.hero, { borderColor: ACCENT + '3A', backgroundColor: ACCENT + '12' }]}>
          <Droplets size={26} color={ACCENT} />
          <View style={{ flex: 1 }}>
            <DisplayText style={s.heroNum}>{stats.current} <Text style={s.heroUnit}>{plPlural(stats.current, 'dzień', 'dni', 'dni')} z rzędu z celem</Text></DisplayText>
            <Text style={s.heroSub}>najdłuższa: {stats.longest} {plPlural(stats.longest, 'dzień', 'dni', 'dni')} · śr. {avgPerDay.toFixed(1).replace('.', ',')} szkl./dzień</Text>
          </View>
        </View>

        <Text style={s.hint}>stuknij dzień, żeby wpisać/poprawić ile wypiłeś (np. gdy appka nie złapała przez brak internetu)</Text>

        <View style={s.legendRow}>
          <View style={s.legendItem}><View style={[s.sw, { backgroundColor: ACCENT }]} /><Text style={s.legendTxt}>cel osiągnięty</Text></View>
          <View style={s.legendItem}><View style={[s.sw, { backgroundColor: ACCENT + '55' }]} /><Text style={s.legendTxt}>część celu</Text></View>
          <View style={s.legendItem}><View style={[s.sw, { borderWidth: 1.4, borderColor: ICE, backgroundColor: c.fill.subtle }]} /><Text style={s.legendTxt}>zamrożone</Text></View>
        </View>

        {!loading && (
          <View style={s.gridCard}>
            {isMonth ? (
              <View style={{ width: '100%', aspectRatio: mW / mH }}>
                <Svg width="100%" height="100%" viewBox={`0 0 ${mW} ${mH}`} preserveAspectRatio="xMidYMid meet">
                  {WD.map((w, i) => (
                    <SvgText key={w} x={i * (MC + MG) + MC / 2} y={11} fontSize={9} fontWeight="700" fill={c.text.muted} textAnchor="middle">{w}</SvgText>
                  ))}
                  {cells.map((cell, i) => {
                    const x = cell.wd * (MC + MG), y = MHEAD + cell.wk * (MC + MG);
                    const alpha = tierAlpha(cell.count, goal);
                    const fill = alpha ? ACCENT + alpha : c.fill.subtle;
                    return (
                      <G key={i}>
                        <Rect x={x} y={y} width={MC} height={MC} rx={7} fill={fill}
                          stroke={cell.froz ? ICE : cell.isToday ? c.text.primary : undefined}
                          strokeWidth={cell.froz ? 2 : cell.isToday ? 2.2 : 0} />
                        <SvgText x={x + MC / 2} y={y + MC / 2 + 4.5} fontSize={13} fontWeight="700"
                          fill={c.text.primary} textAnchor="middle" opacity={cell.count > 0 ? 1 : 0.5}>{cell.dom}</SvgText>
                      </G>
                    );
                  })}
                </Svg>
                {/* Nakładka dotykowa ZWYKŁYMI `Pressable` z 'react-native', NIE `onPress` na
                    elementach SVG (2026-10-03, user: "jak kliknąłem edyt wodę to nic nie mogę
                    klikać" — pierwsze w tej appce użycie onPress wprost na `<G>`/`<Rect>`,
                    nigdzie wcześniej nieprzetestowane; hit-testing w react-native-svg przy
                    skalowanym `viewBox`/`preserveAspectRatio` jest znanym źródłem problemów —
                    zamiast dalej zgadywać dlaczego, zamieniony na sprawdzony w całej appce
                    wzorzec: zwykłe RN-owe `Pressable` w przestrzeni ekranu (%), position
                    liczona z tych samych stałych co rysowanie SVG, więc zawsze pokrywa się
                    z narysowaną komórką). */}
                {cells.map((cell, i) => (
                  <Pressable
                    key={`t${i}`}
                    onPress={() => openDay(cell.ds, cell.count)}
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
                    const alpha = tierAlpha(cell.count, goal);
                    const fill = alpha ? ACCENT + alpha : c.fill.subtle;
                    return <Rect key={i} x={cell.wk * (YC + YG)} y={YTOP + cell.wd * (YC + YG)} width={YC} height={YC} rx={1.3}
                      fill={fill} stroke={cell.froz ? ICE : undefined} strokeWidth={cell.froz ? 0.8 : 0} />;
                  })}
                </Svg>
              </View>
            )}
          </View>
        )}

        <View style={s.statsRow}>
          <View style={s.stat}><DisplayText style={s.statVal}>{stats.goalDays}</DisplayText><Text style={s.statKey}>dni z celem</Text></View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Snowflake size={14} color={ICE} /><DisplayText style={[s.statVal, { color: ICE }]}>{stats.freezeDays}</DisplayText></View>
            <Text style={s.statKey}>zamrożenia użyte</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}><DisplayText style={s.statVal}>{stats.totalGlasses}</DisplayText><Text style={s.statKey}>szklanek razem</Text></View>
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* edycja/backfill dnia — overlay i arkusz jako RODZEŃSTWO (nie zagnieżdżone Pressable),
          ten sam wzorzec co modal ustawień wody w health.tsx (wm.overlay/wm.sheet). */}
      <Modal visible={!!editDate} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEditDate(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={s.overlay} onPress={() => setEditDate(null)} />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{editDate ? fmtDay(editDate, todayKey) : ''}</Text>
            <Text style={s.sheetSub}>Ile szklanek wody wypiłeś tego dnia</Text>
            <TextInput
              style={s.sheetInput} value={editValue} onChangeText={setEditValue}
              keyboardType="number-pad" placeholder="0" placeholderTextColor={c.text.muted}
              autoFocus selectTextOnFocus
            />
            <Text style={s.sheetMl}>
              {(() => { const n = Math.max(0, Math.round(parseFloat(editValue.replace(',', '.')) || 0)); return `≈ ${(n * glassMl / 1000).toFixed(2).replace('.', ',')} l`; })()}
            </Text>
            <TouchableOpacity style={s.sheetSave} onPress={saveDay} activeOpacity={0.85}>
              <Check size={17} color="#07160F" />
              <Text style={s.sheetSaveTxt}>Zapisz</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 17, fontWeight: '800', color: c.text.primary, flex: 1 },
  viewToggle: { flexDirection: 'row', backgroundColor: c.fill.subtle, borderRadius: radius.full, padding: 2, borderWidth: 1, borderColor: c.border.subtle },
  viewBtn: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.full },
  viewBtnOn: { backgroundColor: c.text.primary },
  viewBtnTxt: { fontSize: 11, fontWeight: '800', color: c.text.muted },
  viewBtnTxtOn: { color: c.bg.primary },
  scroll: { paddingHorizontal: spacing[4], gap: spacing[3] },

  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.xl, borderWidth: 1, padding: spacing[4] },
  heroNum: { fontSize: 26, color: c.text.primary, letterSpacing: -0.5 },
  heroUnit: { fontSize: 13, fontWeight: '700', color: c.text.muted },
  heroSub: { fontSize: 12, color: c.text.secondary, marginTop: 2 },

  hint: { fontSize: 11.5, color: c.text.muted, lineHeight: 15, textAlign: 'center' },

  legendRow: { flexDirection: 'row', gap: spacing[4], justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sw: { width: 10, height: 10, borderRadius: 3 },
  legendTxt: { fontSize: 11, fontWeight: '600', color: c.text.muted },

  gridCard: { backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },

  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, paddingVertical: spacing[3] },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 20, color: c.text.primary },
  statKey: { fontSize: 10.5, fontWeight: '600', color: c.text.muted },
  statDiv: { width: 1, height: 30, backgroundColor: c.border.subtle },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: c.bg.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderBottomWidth: 0, borderColor: c.border.default, padding: spacing[5], paddingBottom: spacing[8], gap: spacing[2], alignItems: 'center' },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  sheetSub: { fontSize: 12, color: c.text.muted, marginBottom: spacing[1] },
  sheetInput: { width: 110, height: 56, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.fill.subtle, textAlign: 'center', fontSize: 28, fontWeight: '800', color: c.text.primary },
  sheetMl: { fontSize: 12, color: c.text.muted, marginTop: 2 },
  sheetSave: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: ACCENT, paddingHorizontal: spacing[5], paddingVertical: 12, borderRadius: radius.full, marginTop: spacing[2] },
  sheetSaveTxt: { fontSize: 14.5, fontWeight: '800', color: '#07160F' },
}));
