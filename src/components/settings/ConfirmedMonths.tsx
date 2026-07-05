import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck, Calculator } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { useWorkStore } from '@/store/workStore';
import { workService } from '@/services/workService';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
function label(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

export interface PayMonthRow { month: string; amount: number; hours: number; excluded: boolean; date: string }

// The estimated hourly rate now comes straight from the REAL paychecks: each row is
// one paycheck (its target month, actual amount, calendar hours). The user includes
// or excludes each month from the average with the calculator button — e.g. leaving
// out umowa-zlecenie months so the UoP rate isn't skewed. Excluded months still count
// toward the total earned.
export default function ConfirmedMonths({ payMonths }: { payMonths: PayMonthRow[] }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const settings = useWorkStore(st => st.settings);
  const setSettings = useWorkStore(st => st.setSettings);

  const toggleExclude = (month: string, currentlyExcluded: boolean) => {
    haptic.tap();
    const set = new Set(settings.excludedPayMonths ?? []);
    if (currentlyExcluded) set.delete(month); else set.add(month);
    const next = { ...settings, excludedPayMonths: Array.from(set) };
    setSettings(next);
    workService.saveSettings(next).catch(() => {});
    toast.info(currentlyExcluded ? `${label(month)} liczy się do średniej` : `${label(month)} wyłączony ze średniej`);
  };

  const { avgRate, totalEarned, inAvgCount } = useMemo(() => {
    let sal = 0, hrs = 0, cnt = 0, total = 0;
    for (const r of payMonths) {
      total += r.amount;
      if (!r.excluded && r.hours > 0) { sal += r.amount; hrs += r.hours; cnt++; }
    }
    return { avgRate: hrs > 0 ? sal / hrs : null, totalEarned: total, inAvgCount: cnt };
  }, [payMonths]);

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <ShieldCheck size={14} color="#2AC68F" />
        <Text style={s.title}>Wypłaty i średnia stawka</Text>
      </View>
      <Text style={s.sub}>
        Stawka = średnia z {inAvgCount} {inAvgCount === 1 ? 'miesiąca' : 'miesięcy'}
        {avgRate != null ? ` · ${avgRate.toFixed(2)} zł/h` : ' (brak godzin w kalendarzie)'}.
        {'\n'}Kalkulatorem wyłączasz miesiąc ze średniej (np. inna umowa), nie tracąc go z sumy.
      </Text>
      {totalEarned > 0 && (
        <Text style={s.total}>Łącznie zarobione: <Text style={s.totalStrong}>{Math.round(totalEarned).toLocaleString('pl-PL')} zł</Text></Text>
      )}

      {payMonths.length === 0 ? (
        <Text style={s.empty}>Brak wypłat. Dodaj przychód z „To jest wypłata [prefiks]" (lub prefiksem w tytule).</Text>
      ) : (
        payMonths.map(r => {
          const rate = r.hours > 0 ? r.amount / r.hours : null;
          const inAvg = !r.excluded && r.hours > 0;
          return (
            <View key={r.month} style={s.row}>
              <Text style={[s.rowMonth, r.excluded && s.rowMuted]}>{label(r.month)}</Text>
              <Text style={[s.rowMeta, r.excluded && s.rowMuted]} numberOfLines={1}>
                {Math.round(r.amount)} zł{r.hours > 0 ? ` · ${Math.round(r.hours)} h · ${rate!.toFixed(1)} zł/h` : ' · brak godzin'}
                {r.excluded ? ' · poza średnią' : ''}
              </Text>
              <PressableScale
                onPress={() => toggleExclude(r.month, r.excluded)}
                style={[s.avgToggle, inAvg && s.avgToggleOn]}
              >
                <Calculator size={13} color={inAvg ? '#2AC68F' : c.text.muted} />
              </PressableScale>
            </View>
          );
        })
      )}
    </View>
  );
}

const makeStyles = (c: typeof colors) => StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: c.border.subtle, paddingTop: spacing[3], paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  sub: { fontSize: 11, color: c.text.muted, lineHeight: 15 },
  total: { fontSize: 12, color: c.text.secondary, marginTop: 2 },
  totalStrong: { fontWeight: '800', color: '#2AC68F' },
  empty: { fontSize: 12, color: c.text.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6 },
  rowMonth: { fontSize: 13, fontWeight: '700', color: c.text.primary, width: 64 },
  rowMuted: { color: c.text.muted, opacity: 0.6 },
  rowMeta: { flex: 1, fontSize: 11, color: c.text.muted },
  avgToggle: { padding: 6, borderRadius: radius.md, backgroundColor: c.fill.subtle, borderWidth: 1, borderColor: c.border.subtle },
  avgToggleOn: { backgroundColor: '#2AC68F18', borderColor: '#2AC68F55' },
});
