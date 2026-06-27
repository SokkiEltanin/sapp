import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import {
  Sparkles, Wallet, TrendingUp, Footprints, Moon, Smile, Briefcase, ListChecks, Cookie, Scale,
  ArrowUpRight, ArrowDownRight, Minus, ChevronDown, ArrowRight, X, SlidersHorizontal, Check,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { StatCtx, metricSeries } from '@/utils/statWidgets';
import { haptic } from '@/utils/haptics';
import { useWeeklyBoard } from '@/store/weeklyBoardStore';

export type WeeklyNote = { tone: 'good' | 'warn' | 'neutral'; text: string };

type Period = 'week' | 'month';

type TileDef = {
  id: string;
  label: string;
  Icon: any;
  unit: string;
  betterHigh: boolean | null; // null = neutral metric (no good/bad direction)
};

// The metrics that get a tile. Order = visual order in the grid.
const TILES: TileDef[] = [
  { id: 'spend',     label: 'Wydatki',   Icon: Wallet,     unit: 'zł',    betterHigh: false },
  { id: 'income',    label: 'Przychody', Icon: TrendingUp, unit: 'zł',    betterHigh: true  },
  { id: 'steps',     label: 'Kroki',     Icon: Footprints, unit: 'kroki', betterHigh: true  },
  { id: 'sleepAvg',  label: 'Sen',       Icon: Moon,       unit: 'h',     betterHigh: true  },
  { id: 'moodAvg',   label: 'Nastrój',   Icon: Smile,      unit: '/5',    betterHigh: true  },
  { id: 'workHours', label: 'Praca',     Icon: Briefcase,  unit: 'h',     betterHigh: null  },
  { id: 'tasksDone', label: 'Zadania',   Icon: ListChecks, unit: '',      betterHigh: true  },
  { id: 'weight',    label: 'Waga',      Icon: Scale,      unit: 'kg',    betterHigh: null  },
  { id: 'sweets',    label: 'Słodycze',  Icon: Cookie,     unit: 'zł',    betterHigh: false },
];

// Where each metric's full view lives — powers the "Zobacz w …" deep-link in the
// expanded panel. Metrics with no dedicated screen (workHours) are omitted.
const METRIC_HOME: Record<string, { route: string; label: string }> = {
  spend:     { route: '/(tabs)/finances',  label: 'Finanse' },
  income:    { route: '/(tabs)/finances',  label: 'Finanse' },
  sweets:    { route: '/(tabs)/finances',  label: 'Finanse' },
  steps:     { route: '/(tabs)/health',    label: 'Zdrowie' },
  sleepAvg:  { route: '/(tabs)/health',    label: 'Zdrowie' },
  moodAvg:   { route: '/(tabs)/mood',      label: 'Nastrój' },
  weight:    { route: '/(tabs)/health',    label: 'Zdrowie' },
  tasksDone: { route: '/(tabs)/analytics', label: 'Analizy' },
};

function fmtVal(v: number, unit: string): string {
  if (unit === 'kroki') return Math.round(v).toLocaleString('pl-PL');
  if (unit === 'h' || unit === 'kg') return v.toFixed(1).replace('.0', '');
  if (unit === '/5') return v.toFixed(1);
  return `${Math.round(v)}`;
}

export default function WeeklyBoard({ statCtx, notes, accent }: { statCtx: StatCtx; notes: WeeklyNote[]; accent: string }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [period, setPeriod] = useState<Period>('week');
  const [selected, setSelected] = useState<string | null>(null);
  const [editTiles, setEditTiles] = useState(false);
  const hidden = useWeeklyBoard(s => s.hidden);
  const toggleTile = useWeeklyBoard(s => s.toggle);

  // One pass: per tile, the selected-period mini series (now/prev/spark) plus the
  // always-monthly 6-bucket series that powers the "vs other months" expand.
  const data = useMemo(() => {
    return TILES.map(t => {
      const cur = metricSeries(t.id, statCtx, period, 6);
      const months = metricSeries(t.id, statCtx, 'month', 6);
      const now = cur.values[cur.values.length - 1] ?? 0;
      const prev = cur.values[cur.values.length - 2] ?? 0;
      const pct = prev > 0 ? Math.round(((now - prev) / prev) * 100) : null;
      const hasData = now > 0 || prev > 0 || months.values.some(v => v > 0);
      return { def: t, now, prev, pct, spark: cur.values, months: months.values, monthLabels: months.labels, hasData };
    }).filter(d => d.hasData);
  }, [statCtx, period]);

  const visible = useMemo(() => data.filter(d => !hidden.includes(d.def.id)), [data, hidden]);

  const toggle = (id: string) => {
    haptic.tap();
    setSelected(s => (s === id ? null : id));
  };

  const switchPeriod = (p: Period) => { haptic.tap(); setPeriod(p); };

  if (visible.length === 0 && notes.length === 0) return null;

  const sel = data.find(d => d.def.id === selected) || null;

  return (
    <View style={[styles.card, { backgroundColor: c.bg.card }]}>
      <View style={styles.header}>
        <Sparkles size={13} color={accent} />
        <Text style={styles.title}>Przegląd</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.periodToggle}>
          {(['week', 'month'] as Period[]).map(p => (
            <TouchableOpacity key={p} onPress={() => switchPeriod(p)} style={[styles.periodBtn, period === p && { backgroundColor: accent + '26' }]}>
              <Text style={[styles.periodText, period === p && { color: accent, fontWeight: '800' }]}>{p === 'week' ? 'Tydzień' : 'Miesiąc'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => { haptic.tap(); setEditTiles(true); }} hitSlop={8} style={styles.editBtn}>
          <SlidersHorizontal size={14} color={c.text.muted} />
        </TouchableOpacity>
      </View>

      {/* ── Tile grid ─────────────────────────────────────────────────── */}
      <View style={styles.grid}>
        {visible.map(d => {
          const { def, now, pct } = d;
          const isSel = selected === def.id;
          const improving = def.betterHigh == null || pct == null || pct === 0
            ? null
            : (def.betterHigh ? pct > 0 : pct < 0);
          const tone = improving == null ? c.text.muted : improving ? '#2AC68F' : '#FBBF24';
          const max = Math.max(...d.spark, 1);
          return (
            <TouchableOpacity
              key={def.id}
              activeOpacity={0.85}
              onPress={() => toggle(def.id)}
              style={[styles.tile, isSel && { borderColor: accent + '88', backgroundColor: accent + '12' }]}
            >
              <View style={styles.tileTop}>
                <def.Icon size={13} color={isSel ? accent : c.text.muted} />
                <Text style={[styles.tileLabel, isSel && { color: accent }]} numberOfLines={1}>{def.label}</Text>
              </View>
              <View style={styles.tileValRow}>
                <Text style={styles.tileVal} numberOfLines={1}>{fmtVal(now, def.unit)}</Text>
                {def.unit !== '' && <Text style={styles.tileUnit}>{def.unit === 'kroki' ? '' : def.unit}</Text>}
              </View>
              <View style={styles.tileFoot}>
                {pct == null ? (
                  <Text style={[styles.deltaText, { color: c.text.muted }]}>nowe</Text>
                ) : (
                  <View style={styles.deltaChip}>
                    {pct === 0 ? <Minus size={10} color={tone} /> : pct > 0 ? <ArrowUpRight size={11} color={tone} /> : <ArrowDownRight size={11} color={tone} />}
                    <Text style={[styles.deltaText, { color: tone }]}>{Math.abs(pct)}%</Text>
                  </View>
                )}
                {/* mini sparkline */}
                <View style={styles.spark}>
                  {d.spark.map((v, i) => (
                    <View key={i} style={[styles.sparkBar, {
                      height: v > 0 ? Math.max(2, (v / max) * 16) : 1.5,
                      backgroundColor: i === d.spark.length - 1 ? (isSel ? accent : c.text.secondary) : c.border.subtle,
                      opacity: i === d.spark.length - 1 ? 1 : 0.7,
                    }]} />
                  ))}
                </View>
              </View>
              <ChevronDown size={12} color={c.text.muted} style={[styles.chev, isSel && { transform: [{ rotate: '180deg' }] }]} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Month comparison popup ─────────────────────────────────── */}
      <Modal visible={!!sel} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          {sel && (() => {
            const vals = sel.months;
            const max = Math.max(...vals, 1);
            const nonZero = vals.filter(v => v > 0);
            const avg = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
            const best = Math.max(...vals);
            const bestIdx = vals.indexOf(best);
            const curM = vals[vals.length - 1] ?? 0;
            const prevM = vals[vals.length - 2] ?? 0;
            const mPct = prevM > 0 ? Math.round(((curM - prevM) / prevM) * 100) : null;
            return (
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <sel.def.Icon size={15} color={accent} />
                  <Text style={styles.modalTitle}>{sel.def.label} — miesiące</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
                </View>
                <View style={styles.monthRow}>
              {vals.map((v, i) => {
                const isCur = i === vals.length - 1;
                const isBest = i === bestIdx && best > 0;
                return (
                  <View key={i} style={styles.monthCol}>
                    <Text style={[styles.monthVal, isCur && { color: accent, fontWeight: '800' }]}>{v > 0 ? fmtVal(v, sel.def.unit) : ''}</Text>
                    <View style={styles.monthBarWrap}>
                      <View style={{
                        width: '64%', borderRadius: 3, minHeight: 2,
                        height: v > 0 ? Math.max(3, (v / max) * 64) : 2,
                        backgroundColor: v === 0 ? c.border.subtle : isCur ? accent : isBest ? accent + '99' : c.text.muted,
                        opacity: v === 0 ? 0.5 : 1,
                      }} />
                    </View>
                    <Text style={[styles.monthLabel, isCur && { color: accent, fontWeight: '700' }]}>{sel.monthLabels[i]}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.statRow}>
              <View style={styles.statCell}>
                <Text style={styles.statVal}>{fmtVal(avg, sel.def.unit)}</Text>
                <Text style={styles.statLabel}>śr. 6 mies.</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statVal}>{fmtVal(best, sel.def.unit)}</Text>
                <Text style={styles.statLabel}>rekord</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={[styles.statVal, mPct != null && {
                  color: sel.def.betterHigh == null ? c.text.primary
                    : (sel.def.betterHigh ? mPct >= 0 : mPct <= 0) ? '#2AC68F' : '#FBBF24',
                }]}>{mPct == null ? '—' : `${mPct >= 0 ? '+' : ''}${mPct}%`}</Text>
                <Text style={styles.statLabel}>vs poprz. mies.</Text>
              </View>
            </View>

            {METRIC_HOME[sel.def.id] && (
              <TouchableOpacity
                style={styles.detailsBtn}
                activeOpacity={0.8}
                onPress={() => { haptic.tap(); router.push(METRIC_HOME[sel.def.id].route as any); }}
              >
                <Text style={[styles.detailsText, { color: accent }]}>Zobacz w: {METRIC_HOME[sel.def.id].label}</Text>
                <ArrowRight size={14} color={accent} />
              </TouchableOpacity>
            )}
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* ── Smart notes (correlations, streaks) ───────────────────────── */}
      {notes.length > 0 && (
        <View style={styles.notes}>
          {notes.slice(0, 4).map((n, i) => {
            const col = n.tone === 'good' ? '#2AC68F' : n.tone === 'warn' ? '#FBBF24' : c.text.secondary;
            return (
              <View key={i} style={styles.noteRow}>
                <View style={[styles.noteDot, { backgroundColor: col }]} />
                <Text style={[styles.noteText, { color: col }]} numberOfLines={2}>{n.text}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Tile picker ───────────────────────────────────────────────── */}
      <Modal visible={editTiles} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEditTiles(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditTiles(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <SlidersHorizontal size={15} color={accent} />
              <Text style={styles.modalTitle}>Kafelki przeglądu</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setEditTiles(false)} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
            </View>
            <Text style={styles.pickerHint}>Wybierz, które kafelki pokazywać (jeśli mają dane).</Text>
            {TILES.map(t => {
              const on = !hidden.includes(t.id);
              return (
                <TouchableOpacity key={t.id} activeOpacity={0.8} onPress={() => { haptic.tap(); toggleTile(t.id); }} style={styles.pickerRow}>
                  <t.Icon size={15} color={on ? accent : c.text.muted} />
                  <Text style={[styles.pickerLabel, { color: on ? c.text.primary : c.text.muted }]}>{t.label}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={[styles.pickerCheck, on && { backgroundColor: accent, borderColor: accent }]}>
                    {on && <Check size={12} color={c.bg.card} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.subtle },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  title: { fontSize: 13, fontWeight: '800', color: c.text.primary, letterSpacing: 0.3 },

  periodToggle: { flexDirection: 'row', backgroundColor: c.bg.primary, borderRadius: radius.full, padding: 2 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  periodText: { fontSize: 10.5, fontWeight: '700', color: c.text.muted },
  editBtn: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.primary },
  pickerHint: { fontSize: 11, color: c.text.muted, marginBottom: spacing[2] },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 9 },
  pickerLabel: { fontSize: 14, fontWeight: '600' },
  pickerCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: {
    width: '48%', flexGrow: 1,
    backgroundColor: c.bg.primary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.subtle,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    position: 'relative',
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileLabel: { fontSize: 10.5, fontWeight: '700', color: c.text.muted, letterSpacing: 0.3, flexShrink: 1 },
  tileValRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 4 },
  tileVal: { fontSize: 20, fontWeight: '800', color: c.text.primary, lineHeight: 23 },
  tileUnit: { fontSize: 10, fontWeight: '700', color: c.text.muted, marginBottom: 3 },
  tileFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  deltaChip: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  deltaText: { fontSize: 11, fontWeight: '800' },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5, height: 16 },
  sparkBar: { width: 3, borderRadius: 1.5 },
  chev: { position: 'absolute', top: 6, right: 6, opacity: 0.5 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing[4] },
  modalSheet: { width: '100%', maxWidth: 420, backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.default },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  modalTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary, letterSpacing: 0.2 },
  monthRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  monthCol: { flex: 1, alignItems: 'center', gap: 3 },
  monthVal: { fontSize: 9, fontWeight: '600', color: c.text.muted },
  monthBarWrap: { width: '100%', height: 64, justifyContent: 'flex-end', alignItems: 'center' },
  monthLabel: { fontSize: 9, fontWeight: '600', color: c.text.muted },

  statRow: { flexDirection: 'row', marginTop: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle, paddingTop: spacing[2] },
  statCell: { flex: 1, alignItems: 'center', gap: 1 },
  statVal: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  statLabel: { fontSize: 9, color: c.text.muted, letterSpacing: 0.2 },

  detailsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing[3], paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: c.fill.subtle, borderWidth: 1, borderColor: c.border.subtle,
  },
  detailsText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  notes: { marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle, gap: spacing[2] },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  noteDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  noteText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 16 },
});
