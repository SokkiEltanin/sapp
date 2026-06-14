import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck, X, Check } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { useWorkStore } from '@/store/workStore';
import { workService } from '@/services/workService';
import { colors, spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
function label(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

// The estimated rate averages over months the user has personally CONFIRMED.
// We don't make them type anything — we show the auto-detected paycheck + hours
// for a month and ask "does this match?". Yes → saved into the average forever.
export default function ConfirmedMonths({ detectedMonth, detectedSalary, detectedHours }: {
  detectedMonth?: string;
  detectedSalary?: number;
  detectedHours?: number;
}) {
  const settings = useWorkStore(s => s.settings);
  const setSettings = useWorkStore(s => s.setSettings);
  const confirmed = settings.confirmedMonths ?? {};
  const entries = Object.entries(confirmed).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const [dismissed, setDismissed] = useState(false);

  const persist = (next: Record<string, { salary: number; hours: number }>) => {
    const s = { ...settings, confirmedMonths: next };
    setSettings(s);
    workService.saveSettings(s).catch(() => {});
  };

  const askable = !!detectedMonth && (detectedSalary ?? 0) > 0 && (detectedHours ?? 0) > 0 && !confirmed[detectedMonth] && !dismissed;
  const detRate = askable ? (detectedSalary! / detectedHours!) : 0;

  const confirmDetected = () => {
    haptic.success();
    persist({ ...confirmed, [detectedMonth!]: { salary: Math.round(detectedSalary!), hours: Math.round(detectedHours!) } });
    toast.success(`Zapisano ${label(detectedMonth!)} do średniej`);
  };

  const remove = (m: string) => {
    haptic.medium();
    const next = { ...confirmed }; delete next[m];
    persist(next);
  };

  const avgRate = (() => {
    const ms = Object.values(confirmed);
    const sal = ms.reduce((s, m) => s + (m.salary || 0), 0);
    const hrs = ms.reduce((s, m) => s + (m.hours || 0), 0);
    return hrs > 0 ? sal / hrs : null;
  })();

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <ShieldCheck size={14} color="#2AC68F" />
        <Text style={s.title}>Potwierdzone miesiące (stawka)</Text>
      </View>
      <Text style={s.sub}>
        Stawka szacunkowa = średnia z potwierdzonych miesięcy
        {avgRate != null ? ` · teraz ${avgRate.toFixed(2)} zł/h` : ' (jeszcze brak — potwierdź poniżej)'}.
      </Text>

      {askable && (
        <View style={s.ask}>
          <Text style={s.askTitle}>Czy się zgadza? — {label(detectedMonth!)}</Text>
          <Text style={s.askLine}>
            Wypłata <Text style={s.askStrong}>{Math.round(detectedSalary!)} zł</Text> ÷ <Text style={s.askStrong}>{Math.round(detectedHours!)} h</Text> = <Text style={s.askStrong}>{detRate.toFixed(2)} zł/h</Text>
          </Text>
          <View style={s.askBtns}>
            <PressableScale onPress={() => { haptic.tap(); setDismissed(true); }} style={s.no}>
              <X size={14} color={colors.text.muted} /><Text style={s.noText}>Nie teraz</Text>
            </PressableScale>
            <PressableScale onPress={confirmDetected} style={s.yes}>
              <Check size={15} color="#06231a" /><Text style={s.yesText}>Tak, zapisz</Text>
            </PressableScale>
          </View>
        </View>
      )}

      {entries.length === 0 ? (
        !askable && <Text style={s.empty}>Brak potwierdzonych miesięcy.</Text>
      ) : (
        entries.map(([m, v]) => (
          <View key={m} style={s.row}>
            <Text style={s.rowMonth}>{label(m)}</Text>
            <Text style={s.rowMeta}>{v.salary} zł · {v.hours} h · {(v.salary / v.hours).toFixed(1)} zł/h</Text>
            <PressableScale onPress={() => remove(m)} style={s.del}><X size={14} color={colors.text.muted} /></PressableScale>
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: spacing[3], gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  sub: { fontSize: 11, color: colors.text.muted, lineHeight: 15 },
  ask: {
    backgroundColor: 'rgba(42,198,143,0.08)', borderWidth: 1, borderColor: 'rgba(42,198,143,0.30)',
    borderRadius: radius.md, padding: spacing[3], gap: 6, marginTop: spacing[1],
  },
  askTitle: { fontSize: 13, fontWeight: '800', color: '#2AC68F' },
  askLine: { fontSize: 12, color: colors.text.secondary },
  askStrong: { fontWeight: '800', color: colors.text.primary },
  askBtns: { flexDirection: 'row', gap: spacing[2], marginTop: 4 },
  no: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default },
  noText: { fontSize: 12, fontWeight: '600', color: colors.text.muted },
  yes: { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: radius.md, backgroundColor: '#2AC68F' },
  yesText: { fontSize: 13, fontWeight: '800', color: '#06231a' },
  empty: { fontSize: 12, color: colors.text.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6 },
  rowMonth: { fontSize: 13, fontWeight: '700', color: colors.text.primary, width: 64 },
  rowMeta: { flex: 1, fontSize: 11, color: colors.text.muted },
  del: { padding: 6, borderRadius: radius.md, backgroundColor: colors.bg.elevated },
});
