import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Hash, BarChart3, List, GitCompare, PieChart, Check, Wallet, ShoppingCart, Smile, Briefcase, Trash2 } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useDashboardLayout, WidgetViz } from '@/store/dashboardLayout';
import { WIDGET_METRICS, MetricDef, MetricGroup, metricById, WIDGET_TAGS, StatCtx, metricNumber, metricSeries, metricList } from '@/utils/statWidgets';
import { useExpensesStore } from '@/store/expensesStore';
import { useStatsScope } from '@/store/statsScope';
import { useMoodStore } from '@/store/moodStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useWorkStore } from '@/store/workStore';
import { useWorkEarnings, isPaycheck } from '@/hooks/useWorkEarnings';
import { paycheckTargetMonth } from '@/utils/paycheck';
import { useHabits } from '@/hooks/useHabits';
import { loadNameAliases, loadWeightMemory, WeightMemory } from '@/utils/productMemory';
import { getHealthHistory } from '@/utils/healthHistory';
import { toast } from '@/store/toastStore';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

const GROUPS: MetricGroup[] = ['Finanse', 'Konsumpcja', 'Nastrój i zdrowie', 'Praca i zadania'];
const GROUP_ICON: Record<MetricGroup, any> = {
  'Finanse': Wallet, 'Konsumpcja': ShoppingCart, 'Nastrój i zdrowie': Smile, 'Praca i zadania': Briefcase,
};
const VIZ_META: { id: WidgetViz; label: string; Icon: any }[] = [
  { id: 'number',  label: 'Wielka liczba', Icon: Hash },
  { id: 'wave',    label: 'Mini-wykres',   Icon: BarChart3 },
  { id: 'list',    label: 'Lista (top)',   Icon: List },
  { id: 'donut',   label: 'Donut',         Icon: PieChart },
  { id: 'compare', label: 'Porównanie',    Icon: GitCompare },
];

export default function WidgetBuilder() {
  const colors = useColors();
  const s = useMemo(() => makeS(colors), [colors]);
  const addCustomTile = useDashboardLayout(s => s.addCustomTile);
  const updateCustomTile = useDashboardLayout(s => s.updateCustomTile);
  const removeCustomTile = useDashboardLayout(s => s.removeCustomTile);
  const accent = '#6C9EFF';

  // ── Real data for a live preview (so the tile shows YOUR numbers, not mockups) ──
  const { expenses } = useExpensesStore();
  const scope = useStatsScope(s => s.scope);
  const { entries: moodEntries } = useMoodStore();
  const { events, gcalEvents, tasks: calTasks } = useCalendarStore();
  const { shifts: workShifts, settings: workSettings } = useWorkStore();
  const { habits, todayDone } = useHabits();
  const allEvents = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);
  const workEarnings = useWorkEarnings(workShifts, allEvents, workSettings, expenses);
  const [nameAliases, setNameAliases] = useState<Record<string, string>>({});
  const [weightMemory, setWeightMemory] = useState<WeightMemory>({});
  const [healthDays, setHealthDays] = useState<StatCtx['healthDays']>({});
  useEffect(() => { loadNameAliases().then(setNameAliases).catch(() => {}); }, []);
  useEffect(() => { loadWeightMemory().then(setWeightMemory).catch(() => {}); }, []);
  useEffect(() => {
    getHealthHistory(150).then(h => {
      const m: StatCtx['healthDays'] = {};
      for (const [d, v] of Object.entries(h)) m[d] = { steps: v.steps, sleepMinutes: v.sleepMinutes, weightKg: v.weight > 0 ? v.weight : null };
      setHealthDays(m);
    }).catch(() => {});
  }, []);
  const statCtx = useMemo<StatCtx>(() => ({
    expenses, scope, moodEntries, workEvents: allEvents, workSettings,
    ratePerHour: (workEarnings?.perSecond ?? 0) * 3600,
    tasks: calTasks, habitsTotal: habits.length, habitsDone: todayDone.length,
    nameAliases, weightMemory, healthDays,
    // Match the dashboard: earnings preview shows the REAL [JD] paycheck per month.
    paycheckByMonth: (() => {
      const m: Record<string, number> = {};
      const seen = new Set<string>();
      const pcs = expenses.filter(e => isPaycheck(e, workSettings.workPrefix)).sort((a, b) => b.date.localeCompare(a.date));
      for (const e of pcs) { const tm = paycheckTargetMonth(e); if (seen.has(tm)) continue; seen.add(tm); m[tm] = e.amount; }
      return m;
    })(),
  }), [expenses, scope, moodEntries, allEvents, workSettings, workEarnings, calTasks, habits.length, todayDone.length, nameAliases, weightMemory, healthDays]);

  const fmtVal = (v: number, unit: string): string => {
    if (unit === 'zł') return Math.round(v).toLocaleString('pl-PL');
    if (unit === 'kroki') return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
    if (unit === 'h' || unit === 'kg') return v.toFixed(1).replace('.0', '');
    if (unit === '/5') return v.toFixed(1);
    return `${Math.round(v)}`;
  };

  // Edit mode: preload an existing tile by id (?edit=custom:...).
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const existing = useDashboardLayout(s => s.customTiles.find(t => t.id === edit));

  const [metric, setMetric] = useState<string>(existing?.metric ?? '');
  const [viz, setViz] = useState<WidgetViz>(existing?.viz ?? 'number');
  const [metric2, setMetric2] = useState<string>(existing?.metric2 ?? '');
  const [period, setPeriod] = useState<'week' | 'month'>(existing?.period ?? 'month');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [targetInput, setTargetInput] = useState(existing?.target != null ? String(existing.target) : '');
  const [tag, setTag] = useState<string>(existing?.tag ?? '');
  const [calcHours, setCalcHours] = useState('');
  const [calcRate, setCalcRate] = useState('');
  const [compareOffset, setCompareOffset] = useState<number>(existing?.compareOffset ?? 1);

  const def = metricById(metric);
  const needsTag = !!def?.needsTag;
  const vizOptions = useMemo(() => def ? VIZ_META.filter(v => def.viz.includes(v.id)) : [], [def]);

  const labelFor = (m: MetricDef, t?: string) =>
    m.needsTag && t ? `${t.charAt(0).toUpperCase() + t.slice(1)} (${m.unit})` : m.label;

  // pick a metric → default its viz + auto title
  const pickMetric = (m: MetricDef) => {
    haptic.tap();
    setMetric(m.id);
    const firstViz = m.viz[0];
    setViz(firstViz);
    if (!m.needsTag) setTag('');
    setTitle(labelFor(m, m.needsTag ? tag : undefined));
    if (firstViz !== 'compare') setMetric2('');
  };

  const pickTag = (t: string) => {
    haptic.tap();
    setTag(t);
    if (def) setTitle(labelFor(def, t));
  };

  // Any periodic, compare-capable metric — the chart normalises each line to its
  // own scale, so cross-unit overlays (e.g. godziny pracy vs zarobek) work too.
  const compareCandidates = useMemo(
    () => WIDGET_METRICS.filter(m => m.id !== metric && m.viz.includes('compare')),
    [metric],
  );

  const canSave = !!def && (viz !== 'compare' || !!metric2) && (!needsTag || !!tag);
  const showTarget = !!def && (viz === 'number' || viz === 'wave') && def.unit !== '/5';

  const save = () => {
    if (!def) return;
    haptic.success();
    let target = showTarget ? parseFloat(targetInput.replace(',', '.')) : NaN;
    if (metric === 'earnings' && showTarget) {
      const h = parseFloat(calcHours.replace(',', '.'));
      const r = parseFloat(calcRate.replace(',', '.'));
      if (!isNaN(h) && !isNaN(r) && h > 0 && r > 0) target = Math.round(h * r);
    }
    const cfg = {
      title: title.trim() || labelFor(def, tag),
      metric: def.id,
      metric2: viz === 'compare' ? metric2 : undefined,
      compareOffset: viz === 'compare' && metric2 === '__self__' ? compareOffset : undefined,
      viz,
      period: def.periodic ? period : undefined,
      target: !isNaN(target) && target > 0 ? target : undefined,
      tag: needsTag ? tag : undefined,
    };
    if (existing) { updateCustomTile(existing.id, cfg); toast.success('Widget zaktualizowany'); }
    else { addCustomTile({ type: 'stat', ...cfg }); toast.success('Widget dodany na górze dashboardu'); }
    router.back();
  };

  const deleteWidget = () => {
    if (!existing) return;
    Alert.alert('Usunąć widget?', `„${existing.title}" zniknie z dashboardu.`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { haptic.medium(); removeCustomTile(existing.id); toast.success('Widget usunięty'); router.back(); } },
    ]);
  };

  const showPeriod = !!def && def.periodic && viz !== 'list' && viz !== 'donut';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={colors.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>{existing ? 'Edytuj widget' : 'Nowy widget'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Live layout preview — shape updates as you configure */}
        <Text style={s.previewLabel}>PODGLĄD UKŁADU</Text>
        <View style={s.previewCard}>
          {!def ? (
            <Text style={s.previewEmpty}>Wybierz metrykę poniżej, aby zobaczyć jak wyjdzie kafelek</Text>
          ) : (
            <>
              <View style={s.previewHead}>
                <BarChart3 size={13} color={accent} />
                <Text style={s.previewTitle} numberOfLines={1}>{title.trim() || labelFor(def, tag)}</Text>
                {showPeriod && <Text style={s.previewPeriod}>{period === 'week' ? 'tydz.' : 'mies.'}</Text>}
              </View>
              {viz === 'number' && (() => {
                const r = metricNumber(def.id, statCtx, period, needsTag ? tag : undefined);
                return (
                  <View style={s.pNumberRow}>
                    <Text style={s.pNumber}>{fmtVal(r.value, def.unit)}</Text>
                    {!!def.unit && <Text style={s.pUnit}>{def.unit}</Text>}
                  </View>
                );
              })()}
              {viz === 'wave' && (() => {
                const ser = metricSeries(def.id, statCtx, period, 6, needsTag ? tag : undefined);
                const max = Math.max(...ser.values, 1);
                return (
                  <View style={s.pWave}>
                    {ser.values.map((v, i) => (
                      <View key={i} style={[s.pWaveBar, { height: v > 0 ? Math.max(4, (v / max) * 40) : 3, backgroundColor: i === ser.values.length - 1 ? accent : accent + '55' }]} />
                    ))}
                  </View>
                );
              })()}
              {viz === 'compare' && (() => {
                const a = metricNumber(def.id, statCtx, period, needsTag ? tag : undefined).value;
                const defB = metricById(metric2);
                const b = metric2 === '__self__'
                  ? (metricSeries(def.id, statCtx, period, compareOffset + 1).values[0] ?? 0)
                  : metric2 === '__avg__'
                    ? (() => { const vs = metricSeries(def.id, statCtx, period, 6, needsTag ? tag : undefined).values.slice(0, -1).filter(v => v !== 0); return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : 0; })()
                    : (defB ? metricNumber(metric2, statCtx, period).value : 0);
                const mx = Math.max(a, b, 1);
                return (
                  <View style={[s.pWave, { alignItems: 'flex-end' }]}>
                    {[{ v: a, c: accent }, { v: b, c: '#FBBF24' }].map((x, i) => (
                      <View key={i} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                        <Text style={s.pCmpVal}>{fmtVal(x.v, def.unit)}</Text>
                        <View style={[s.pCmpBar, { height: Math.max(10, (x.v / mx) * 36), backgroundColor: x.c }]} />
                      </View>
                    ))}
                  </View>
                );
              })()}
              {(viz === 'list' || viz === 'donut') && (() => {
                const rows = metricList(def.id, statCtx, 3);
                if (rows.length === 0) return <Text style={s.previewEmpty}>Brak danych jeszcze — pojawią się gdy dodasz wpisy</Text>;
                const max = Math.max(...rows.map(r => r.value), 1);
                const DC = [accent, '#FBBF24', '#2AC68F'];
                return (
                  <View style={{ gap: 6, marginTop: 6 }}>
                    {rows.map((r, i) => (
                      <View key={r.label + i} style={s.pListRow2}>
                        <Text style={s.pListLabel} numberOfLines={1}>{r.label}</Text>
                        <View style={[s.pListBar, { width: `${Math.max(12, (r.value / max) * 70)}%`, backgroundColor: DC[i % DC.length] }]} />
                        <Text style={s.pListVal}>{fmtVal(r.value, r.unit)}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
              {showTarget && targetInput.trim() !== '' && (
                <Text style={s.pTarget}>cel: {targetInput} {def.unit}</Text>
              )}
            </>
          )}
        </View>

        {/* 1 — metric */}
        <Text style={s.step}>1 · Co pokazać?</Text>
        {GROUPS.map(g => {
          const Icon = GROUP_ICON[g];
          const items = WIDGET_METRICS.filter(m => m.group === g);
          return (
            <View key={g} style={s.group}>
              <View style={s.groupHead}>
                <Icon size={13} color={colors.text.muted} />
                <Text style={s.groupTitle}>{g}</Text>
              </View>
              <View style={s.chipsWrap}>
                {items.map(m => {
                  const active = metric === m.id;
                  return (
                    <PressableScale key={m.id} onPress={() => pickMetric(m)}>
                      <View style={[s.chip, active && { backgroundColor: accent + '22', borderColor: accent }]}>
                        <Text style={[s.chipText, active && { color: accent }]}>{m.label}</Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* tag picker (tag-based metrics) */}
        {needsTag && (
          <>
            <Text style={s.step}>Tag</Text>
            <View style={s.chipsWrap}>
              {WIDGET_TAGS.map(t => {
                const active = tag === t;
                return (
                  <PressableScale key={t} onPress={() => pickTag(t)}>
                    <View style={[s.chip, active && { backgroundColor: accent + '22', borderColor: accent }]}>
                      <Text style={[s.chipText, active && { color: accent }]}>#{t}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </>
        )}

        {/* 2 — viz */}
        {!!def && (
          <>
            <Text style={s.step}>2 · Jak pokazać?</Text>
            <View style={s.vizRow}>
              {vizOptions.map(v => {
                const active = viz === v.id;
                return (
                  <PressableScale key={v.id} onPress={() => { haptic.tap(); setViz(v.id); }} style={{ flex: 1 }}>
                    <View style={[s.vizTile, active && { backgroundColor: accent + '18', borderColor: accent }]}>
                      <v.Icon size={18} color={active ? accent : colors.text.muted} />
                      <Text style={[s.vizLabel, active && { color: accent }]}>{v.label}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </>
        )}

        {/* compare second metric */}
        {viz === 'compare' && (
          <>
            <Text style={s.step}>Porównaj z…</Text>
            {/* Same metric, a different period (month-over-month / year-over-year) */}
            <View style={[s.chipsWrap, { marginBottom: spacing[2] }]}>
              {([
                { off: 1,  label: period === 'month' ? 'Poprzedni miesiąc' : 'Poprzedni tydzień' },
                { off: 2,  label: period === 'month' ? '2 mies. temu' : '2 tyg. temu' },
                { off: 3,  label: period === 'month' ? '3 mies. temu' : '3 tyg. temu' },
                { off: 6,  label: period === 'month' ? '6 mies. temu' : '6 tyg. temu' },
                { off: 12, label: period === 'month' ? 'Rok temu' : '12 tyg. temu' },
              ] as const).map(o => {
                const active = metric2 === '__self__' && compareOffset === o.off;
                return (
                  <PressableScale key={o.off} onPress={() => { haptic.tap(); setMetric2('__self__'); setCompareOffset(o.off); }}>
                    <View style={[s.chip, active && { backgroundColor: '#6C9EFF22', borderColor: '#6C9EFF' }]}>
                      <Text style={[s.chipText, active && { color: '#6C9EFF' }]}>{o.label}</Text>
                    </View>
                  </PressableScale>
                );
              })}
              <PressableScale onPress={() => { haptic.tap(); setMetric2('__avg__'); }}>
                <View style={[s.chip, metric2 === '__avg__' && { backgroundColor: '#2AC68F22', borderColor: '#2AC68F' }]}>
                  <Text style={[s.chipText, metric2 === '__avg__' && { color: '#2AC68F' }]}>Twoja średnia</Text>
                </View>
              </PressableScale>
            </View>
            <Text style={[s.rowSubLabel]}>…albo z inną metryką:</Text>
            <View style={s.chipsWrap}>
              {compareCandidates.map(m => {
                const active = metric2 === m.id;
                return (
                  <PressableScale key={m.id} onPress={() => { haptic.tap(); setMetric2(m.id); }}>
                    <View style={[s.chip, active && { backgroundColor: '#FBBF2422', borderColor: '#FBBF24' }]}>
                      <Text style={[s.chipText, active && { color: '#FBBF24' }]}>{m.label}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </>
        )}

        {/* 3 — period */}
        {showPeriod && (
          <>
            <Text style={s.step}>3 · Okres</Text>
            <View style={s.periodRow}>
              {(['week', 'month'] as const).map(p => {
                const active = period === p;
                return (
                  <PressableScale key={p} onPress={() => { haptic.tap(); setPeriod(p); }} style={{ flex: 1 }}>
                    <View style={[s.periodBtn, active && { backgroundColor: accent + '22', borderColor: accent }]}>
                      <Text style={[s.periodText, active && { color: accent }]}>{p === 'week' ? 'Tydzień' : 'Miesiąc'}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </>
        )}

        {/* target / goal */}
        {showTarget && (
          <>
            <Text style={s.step}>{metric === 'earnings' ? 'Oczekiwany zarobek — linia (opcjonalnie)' : 'Cel (opcjonalnie)'}</Text>
            {metric === 'earnings' && (
              <View style={s.calcRow}>
                <TextInput value={calcHours} onChangeText={setCalcHours} keyboardType="numeric"
                  placeholder="godz." placeholderTextColor={colors.text.muted} style={s.calcInput} />
                <Text style={s.calcX}>×</Text>
                <TextInput value={calcRate} onChangeText={setCalcRate} keyboardType="numeric"
                  placeholder="zł/h" placeholderTextColor={colors.text.muted} style={s.calcInput} />
                <Text style={s.calcEq}>= {(() => { const h = parseFloat(calcHours.replace(',', '.')); const r = parseFloat(calcRate.replace(',', '.')); return (!isNaN(h) && !isNaN(r)) ? `${Math.round(h * r)} zł` : '—'; })()}</Text>
              </View>
            )}
            <TextInput
              value={targetInput}
              onChangeText={setTargetInput}
              keyboardType="numeric"
              placeholder={metric === 'earnings' ? 'albo wpisz kwotę ręcznie (zł)' : `np. limit / cel w ${def!.unit || 'liczbie'}`}
              placeholderTextColor={colors.text.muted}
              style={s.titleInput}
            />
          </>
        )}

        {/* title */}
        {!!def && (
          <>
            <Text style={s.step}>Nazwa kafelka</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={def.label}
              placeholderTextColor={colors.text.muted}
              style={s.titleInput}
            />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={s.footer}>
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          {existing && (
            <PressableScale onPress={deleteWidget}>
              <View style={s.delBtn}><Trash2 size={18} color={colors.accent.red} /></View>
            </PressableScale>
          )}
          <PressableScale onPress={save} disabled={!canSave} style={{ flex: 1 }}>
            <View style={[s.saveBtn, { backgroundColor: accent }, !canSave && { opacity: 0.4 }]}>
              <Check size={18} color={colors.bg.primary} />
              <Text style={s.saveText}>{existing ? 'Zapisz zmiany' : 'Dodaj widget'}</Text>
            </View>
          </PressableScale>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeS = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], gap: spacing[2] },
  step: { fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[3], marginBottom: spacing[1] },

  // Live preview
  previewLabel: { fontSize: 10, fontWeight: '800', color: c.text.muted, letterSpacing: 0.8, marginBottom: spacing[2] },
  previewCard: {
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], minHeight: 92, justifyContent: 'center', marginBottom: spacing[2],
  },
  previewEmpty: { fontSize: 12, color: c.text.muted, textAlign: 'center', fontStyle: 'italic' },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing[2] },
  previewTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: c.text.secondary, letterSpacing: 0.3 },
  previewPeriod: { fontSize: 9, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase' },
  pNumberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  pNumber: { fontSize: 30, fontWeight: '800', color: c.text.primary, letterSpacing: -1 },
  pUnit: { fontSize: 13, fontWeight: '700', color: c.text.muted, marginBottom: 5 },
  pWave: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 46, marginTop: 4 },
  pWaveBar: { flex: 1, borderRadius: 3, minHeight: 4 },
  pCmpBar: { width: '70%', borderRadius: 4, minHeight: 10 },
  pCmpVal: { fontSize: 11, fontWeight: '800', color: c.text.primary },
  pListRow: { height: 12, justifyContent: 'center' },
  pListRow2: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pListLabel: { width: 84, fontSize: 11, color: c.text.secondary, fontWeight: '600' },
  pListVal: { fontSize: 11, fontWeight: '700', color: c.text.primary, marginLeft: 'auto' },
  pListBar: { height: 8, borderRadius: 4, backgroundColor: c.fill.strong },
  pDonutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], marginTop: 2 },
  pDonut: { width: 44, height: 44, borderRadius: 22, borderWidth: 7 },
  pLegend: { width: 30, height: 5, borderRadius: 3 },
  pTarget: { fontSize: 10.5, fontWeight: '600', color: c.text.muted, marginTop: spacing[2] },
  rowSubLabel: { fontSize: 11, color: c.text.muted, marginBottom: spacing[1] },
  group: { marginBottom: spacing[2] },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing[1] },
  groupTitle: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card,
  },
  chipText: { fontSize: 12.5, fontWeight: '600', color: c.text.secondary },
  vizRow: { flexDirection: 'row', gap: spacing[2] },
  vizTile: {
    alignItems: 'center', gap: 5, paddingVertical: spacing[3], borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card,
  },
  vizLabel: { fontSize: 10.5, fontWeight: '600', color: c.text.muted, textAlign: 'center' },
  periodRow: { flexDirection: 'row', gap: spacing[2] },
  periodBtn: {
    alignItems: 'center', paddingVertical: 10, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card,
  },
  periodText: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  titleInput: {
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: 11, fontSize: 14, color: c.text.primary,
  },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  calcInput: {
    flex: 1, backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: 10, fontSize: 14, color: c.text.primary, textAlign: 'center',
  },
  calcX: { fontSize: 15, fontWeight: '700', color: c.text.muted },
  calcEq: { fontSize: 12, fontWeight: '700', color: '#6C9EFF', minWidth: 60, textAlign: 'right' },
  footer: { padding: spacing[4], borderTopWidth: 1, borderTopColor: c.border.subtle },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.lg },
  saveText: { fontSize: 15, fontWeight: '800', color: c.bg.primary },
  delBtn: { width: 52, paddingVertical: 14, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.accent.red + '55', backgroundColor: c.accent.red + '14' },
});
