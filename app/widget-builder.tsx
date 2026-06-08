import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Hash, BarChart3, List, GitCompare, PieChart, Check, Wallet, ShoppingCart, Smile, Briefcase } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useDashboardLayout, WidgetViz } from '@/store/dashboardLayout';
import { WIDGET_METRICS, MetricDef, MetricGroup, metricById, WIDGET_TAGS } from '@/utils/statWidgets';
import { colors, spacing, radius, typography } from '@/theme';
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
  const addCustomTile = useDashboardLayout(s => s.addCustomTile);
  const updateCustomTile = useDashboardLayout(s => s.updateCustomTile);
  const accent = '#6C9EFF';

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
    const target = showTarget ? parseFloat(targetInput.replace(',', '.')) : NaN;
    const cfg = {
      title: title.trim() || labelFor(def, tag),
      metric: def.id,
      metric2: viz === 'compare' ? metric2 : undefined,
      viz,
      period: def.periodic ? period : undefined,
      target: !isNaN(target) && target > 0 ? target : undefined,
      tag: needsTag ? tag : undefined,
    };
    if (existing) updateCustomTile(existing.id, cfg);
    else addCustomTile({ type: 'stat', ...cfg });
    router.back();
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
            <Text style={s.step}>Cel (opcjonalnie)</Text>
            <TextInput
              value={targetInput}
              onChangeText={setTargetInput}
              keyboardType="numeric"
              placeholder={`np. limit / cel w ${def!.unit || 'liczbie'}`}
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
        <PressableScale onPress={save} disabled={!canSave}>
          <View style={[s.saveBtn, { backgroundColor: accent }, !canSave && { opacity: 0.4 }]}>
            <Check size={18} color={colors.bg.primary} />
            <Text style={s.saveText}>Dodaj widget</Text>
          </View>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: colors.text.primary },
  scroll: { padding: spacing[4], gap: spacing[2] },
  step: { fontSize: 11, fontWeight: '800', color: colors.text.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[3], marginBottom: spacing[1] },
  group: { marginBottom: spacing[2] },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing[1] },
  groupTitle: { fontSize: 11, fontWeight: '700', color: colors.text.secondary },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.card,
  },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.text.secondary },
  vizRow: { flexDirection: 'row', gap: spacing[2] },
  vizTile: {
    alignItems: 'center', gap: 5, paddingVertical: spacing[3], borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.card,
  },
  vizLabel: { fontSize: 10.5, fontWeight: '600', color: colors.text.muted, textAlign: 'center' },
  periodRow: { flexDirection: 'row', gap: spacing[2] },
  periodBtn: {
    alignItems: 'center', paddingVertical: 10, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.card,
  },
  periodText: { fontSize: 13, fontWeight: '700', color: colors.text.secondary },
  titleInput: {
    backgroundColor: colors.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: 11, fontSize: 14, color: colors.text.primary,
  },
  footer: { padding: spacing[4], borderTopWidth: 1, borderTopColor: colors.border.subtle },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.lg },
  saveText: { fontSize: 15, fontWeight: '800', color: colors.bg.primary },
});
