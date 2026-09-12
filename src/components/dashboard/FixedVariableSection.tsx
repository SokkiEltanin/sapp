import { memo, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Wallet, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react-native';
import { Expense } from '@/types';
import { FixedDeviation, VariableContributor, FvBucket, bucketTransactions } from '@/utils/fixedVariable';
import FvBreakdownModal from './FvBreakdownModal';

const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${MON[m - 1]} ${y}`;
};

// 2026-09-12, user o dotychczasowej wersji: "koncept jest spoko ale wykonanie [słabe]...
// muszą byc stałe zmienne w tym miesiacu pokazane wzgledem średniej to na głównym tle, pod
// nim muszą byc wykresy stałych, zmiennych, jedzenie każdy osobno klikalny z pokazaniem co
// sie kiedy tam wlicza zebym mógł kliknąć ze np cos sie zle liczy... zeby sie uczyło".
// Przebudowa: (1) każdy wiersz "hero" (Stałe/Zmienne/Jedzenie) pokazuje deltę WPROST przy
// kwocie (nie dopiero w stopce jak wcześniej), (2) każdy wiersz + każdy mini-wykres trendu
// jest klikalny → otwiera `FvBreakdownModal` z surową listą transakcji tego miesiąca w danym
// kuble, (3) w modalu każdą transakcję można przeklasyfikować (`fvOverride`, patrz
// fixedVariable.ts `bucketOf`) — to jest "uczenie się": raz poprawiona transakcja liczy się
// tam gdzie user chce, NA STAŁE, niezależnie od heurystyki kategorii/tagów.
function FixedVariableSection(
  { s, cardBg, accentColor, colors, expenses, fvMonths, fvDeviations, fvTopVariable, onReclassify }:
  { s: any; cardBg: string; accentColor: string; colors: any; expenses: Expense[];
    fvMonths: { month: string; fixed: number; variable: number; food: number }[];
    fvDeviations: FixedDeviation[]; fvTopVariable: VariableContributor[];
    onReclassify: (id: string, bucket: FvBucket | null) => void },
) {
  const [openBucket, setOpenBucket] = useState<FvBucket | null>(null);

  const cur = fvMonths[fvMonths.length - 1];
  const total = cur ? cur.fixed + cur.variable + cur.food : 0;
  const prev = useMemo(() => fvMonths.slice(0, -1).filter(m => m.fixed + m.variable + m.food > 0), [fvMonths]);
  const avg = (sel: (m: NonNullable<typeof cur>) => number) =>
    prev.length && cur ? Math.round(prev.reduce((a, m) => a + sel(m), 0) / prev.length) : (cur ? sel(cur) : 0);
  const fmt = (n: number) => n.toLocaleString('pl-PL');

  const openTransactions = useMemo(
    () => (openBucket && cur ? bucketTransactions(expenses, cur.month, openBucket) : []),
    [openBucket, expenses, cur],
  );

  if (!cur || total === 0) return null;
  const fixedC = '#8893A8', varC = accentColor, foodC = '#4CA96B';
  const BUCKETS: { key: FvBucket; label: string; val: number; col: string }[] = [
    { key: 'fixed', label: 'Stałe', val: cur.fixed, col: fixedC },
    { key: 'variable', label: 'Zmienne', val: cur.variable, col: varC },
    { key: 'food', label: 'Jedzenie', val: cur.food, col: foodC },
  ];
  const H = 40;

  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Wallet size={13} color={accentColor} />
        <Text style={s.cardTitle} numberOfLines={1}>Na co idą pieniądze</Text>
        <Text style={s.fvHint}>ten miesiąc</Text>
      </View>
      <View style={{ gap: 9 }}>
        {BUCKETS.map(({ key, label, val, col }) => {
          const avgVal = avg(m => m[key]);
          const deltaPct = prev.length && avgVal > 0 ? (val - avgVal) / avgVal : null;
          const up = deltaPct !== null && deltaPct > 0.03;
          const down = deltaPct !== null && deltaPct < -0.03;
          const DeltaIcon = up ? TrendingUp : down ? TrendingDown : null;
          const deltaCol = up ? '#F59E0B' : down ? '#4CA96B' : colors.text.muted;
          return (
            <Pressable key={key} onPress={() => setOpenBucket(key)} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <View style={s.fvRow}>
                <View style={[s.fvDot, { backgroundColor: col }]} />
                <Text style={s.fvRowLbl}>{label}</Text>
                <Text style={[s.fvRowAmt, { color: col }]}>{fmt(val)} zł</Text>
                <ChevronRight size={14} color={colors.text.muted} />
              </View>
              {prev.length > 0 && (
                <View style={s.fvRowSub}>
                  <Text style={s.fvRowPct}>śr. {fmt(avgVal)} zł</Text>
                  {deltaPct !== null && DeltaIcon && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <DeltaIcon size={10} color={deltaCol} />
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: deltaCol }}>{up ? '+' : ''}{Math.round(deltaPct * 100)}% vs śr.</Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={s.fvBar}>
        <View style={{ flex: Math.max(cur.fixed, 0.001), backgroundColor: fixedC }} />
        <View style={{ flex: Math.max(cur.variable, 0.001), backgroundColor: varC }} />
        <View style={{ flex: Math.max(cur.food, 0.001), backgroundColor: foodC }} />
      </View>
      {fvDeviations.length > 0 && (
        <View style={s.fvDevBox}>
          {fvDeviations.slice(0, 3).map(d => {
            const up = d.deltaPct > 0;
            const Icon = up ? TrendingUp : TrendingDown;
            const col = up ? '#F59E0B' : '#4CA96B';
            return (
              <View key={d.label} style={s.fvDevRow}>
                <Icon size={11} color={col} />
                <Text style={s.fvDevLbl} numberOfLines={1}>{d.label}</Text>
                <Text style={[s.fvDevPct, { color: col }]}>{up ? '+' : ''}{Math.round(d.deltaPct * 100)}%</Text>
                <Text style={s.fvDevAmt}>{fmt(d.amount)} (śr. {fmt(d.avgAmount)}) zł</Text>
              </View>
            );
          })}
        </View>
      )}
      {prev.length > 0 && cur.variable > avg(m => m.variable) * 1.15 && fvTopVariable.length > 0 && (
        <Text style={s.fvTip}>
          Zmienne wyżej niż zwykle (śr. {fmt(avg(m => m.variable))} zł) — głównie: {fvTopVariable.map((c, i) => (
            <Text key={c.label} style={s.fvTipB}>{i > 0 ? ', ' : ''}{c.label} {fmt(c.amount)} zł</Text>
          ))}
        </Text>
      )}
      {prev.length > 0 && (
        <View style={s.fvBucketChartsRow}>
          {BUCKETS.map(({ key, label, col }) => {
            const vals = fvMonths.map(m => m[key]);
            const localMax = Math.max(...vals, 1);
            return (
              <Pressable key={key} onPress={() => setOpenBucket(key)} style={({ pressed }) => [s.fvBucketChart, pressed && { opacity: 0.6 }]}>
                <View style={s.fvBucketChartHead}>
                  <View style={[s.fvDotSm, { backgroundColor: col }]} />
                  <Text style={s.fvLegTxt}>{label}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end' }}>
                  {fvMonths.map((m, i) => (
                    <View key={m.month} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                      <View style={{ width: '100%', height: H, justifyContent: 'flex-end' }}>
                        <View style={{
                          height: Math.max((vals[i] / localMax) * H, 2), borderRadius: 3, backgroundColor: col,
                          opacity: i === fvMonths.length - 1 ? 1 : 0.45,
                        }} />
                      </View>
                      <Text style={[s.fvMonthLbl, i === fvMonths.length - 1 && { color: accentColor, fontWeight: '800' }]}>
                        {MON[parseInt(m.month.slice(5, 7), 10) - 1]}
                      </Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      <FvBreakdownModal
        visible={!!openBucket}
        bucket={openBucket}
        color={openBucket ? (BUCKETS.find(b => b.key === openBucket)?.col ?? accentColor) : accentColor}
        monthLabel={monthLabel(cur.month)}
        transactions={openTransactions}
        onReclassify={onReclassify}
        onClose={() => setOpenBucket(null)}
      />
    </View>
  );
}

export default memo(FixedVariableSection);
