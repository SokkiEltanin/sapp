import { memo } from 'react';
import { View, Text } from 'react-native';
import { Wallet } from 'lucide-react-native';

function FixedVariableSection(
  { s, cardBg, accentColor, colors, fvMonths, fvFixedItems }:
  { s: any; cardBg: string; accentColor: string; colors: any;
    fvMonths: { month: string; fixed: number; variable: number; food: number }[];
    fvFixedItems: { label: string; amount: number }[] },
) {
  const cur = fvMonths[fvMonths.length - 1];
  if (!cur) return null;
  const totalCur = cur.fixed + cur.variable + cur.food;
  if (totalCur === 0) return null;
  const prev = fvMonths.slice(0, -1).filter(m => m.fixed + m.variable + m.food > 0);
  const avg = (sel: (m: typeof cur) => number) => prev.length ? Math.round(prev.reduce((a, m) => a + sel(m), 0) / prev.length) : sel(cur);
  const maxMonth = Math.max(...fvMonths.map(m => m.fixed + m.variable + m.food), 1);
  const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const fixedC = '#8893A8', varC = accentColor, foodC = '#4CA96B';
  const H = 46;
  const fmt = (n: number) => n.toLocaleString('pl-PL');
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Wallet size={13} color={accentColor} />
        <Text style={s.cardTitle} numberOfLines={1}>Na co idą pieniądze</Text>
        <Text style={s.fvHint}>ten miesiąc</Text>
      </View>
      <View style={{ gap: 7 }}>
        {([['Stałe', cur.fixed, fixedC], ['Zmienne', cur.variable, varC], ['Jedzenie', cur.food, foodC]] as const).map(([lbl, val, col]) => (
          <View key={lbl} style={s.fvRow}>
            <View style={[s.fvDot, { backgroundColor: col }]} />
            <Text style={s.fvRowLbl}>{lbl}</Text>
            <Text style={s.fvRowPct}>{Math.round((val / totalCur) * 100)}%</Text>
            <Text style={[s.fvRowAmt, { color: col }]}>{fmt(val)} zł</Text>
          </View>
        ))}
      </View>
      <View style={s.fvBar}>
        <View style={{ flex: Math.max(cur.fixed, 0.001), backgroundColor: fixedC }} />
        <View style={{ flex: Math.max(cur.variable, 0.001), backgroundColor: varC }} />
        <View style={{ flex: Math.max(cur.food, 0.001), backgroundColor: foodC }} />
      </View>
      {fvFixedItems.length > 0 && (
        <View style={s.fvFixBox}>
          <Text style={s.fvFixHead}>STAŁE — SKŁADNIKI</Text>
          {fvFixedItems.slice(0, 4).map(it => (
            <View key={it.label} style={s.fvFixRow}>
              <Text style={s.fvFixLbl} numberOfLines={1}>{it.label}</Text>
              <Text style={s.fvFixAmt}>{fmt(it.amount)} zł</Text>
            </View>
          ))}
          {fvFixedItems.length > 4 && <Text style={s.fvFixMore}>+{fvFixedItems.length - 4} więcej</Text>}
        </View>
      )}
      {prev.length > 0 && (
        <>
          <View style={s.fvLegend}>
            {([['Stałe', fixedC], ['Zmienne', varC], ['Jedzenie', foodC]] as const).map(([lbl, col]) => (
              <View key={lbl} style={s.fvLegItem}><View style={[s.fvDotSm, { backgroundColor: col }]} /><Text style={s.fvLegTxt}>{lbl}</Text></View>
            ))}
          </View>
          <View style={s.fvTrend}>
            {fvMonths.map((m, i) => (
              <View key={m.month} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                <View style={{ width: 20, height: H, justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden', backgroundColor: colors.fill.subtle }}>
                  <View style={{ height: (m.food / maxMonth) * H, backgroundColor: foodC }} />
                  <View style={{ height: (m.variable / maxMonth) * H, backgroundColor: varC }} />
                  <View style={{ height: (m.fixed / maxMonth) * H, backgroundColor: fixedC }} />
                </View>
                <Text style={[s.fvMonthLbl, i === fvMonths.length - 1 && { color: accentColor, fontWeight: '800' }]}>{MON[parseInt(m.month.slice(5, 7), 10) - 1]}</Text>
              </View>
            ))}
          </View>
          <Text style={s.fvAvg}>śr. {prev.length} mies.: stałe {fmt(avg(m => m.fixed))} · zmienne {fmt(avg(m => m.variable))} · jedzenie {fmt(avg(m => m.food))} zł</Text>
        </>
      )}
    </View>
  );
}

export default memo(FixedVariableSection);
