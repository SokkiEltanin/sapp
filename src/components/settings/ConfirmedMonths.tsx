import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { ShieldCheck, X, Check, Calculator } from 'lucide-react-native';
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

// The estimated rate averages over months the user has personally CONFIRMED.
// We don't make them type anything — we show the auto-detected paycheck + hours
// for a month and ask "does this match?". Yes → saved into the average forever.
export default function ConfirmedMonths({ detectedMonth, detectedSalary, detectedHours }: {
  detectedMonth?: string;
  detectedSalary?: number;
  detectedHours?: number;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const settings = useWorkStore(st => st.settings);
  const setSettings = useWorkStore(st => st.setSettings);
  const confirmed = settings.confirmedMonths ?? {};
  const entries = Object.entries(confirmed).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const [dismissed, setDismissed] = useState(false);

  const persist = (next: Record<string, { salary: number; hours: number; excluded?: boolean }>) => {
    const s = { ...settings, confirmedMonths: next };
    setSettings(s);
    workService.saveSettings(s).catch(() => {});
  };

  // Keep the month (and its earnings) but stop it counting toward the average rate —
  // e.g. months on a fixed employment contract at a different rate.
  const toggleExclude = (m: string) => {
    haptic.tap();
    const cur = confirmed[m];
    if (!cur) return;
    persist({ ...confirmed, [m]: { ...cur, excluded: !cur.excluded } });
    toast.info(cur.excluded ? `${label(m)} liczy się do średniej` : `${label(m)} wyłączony ze średniej`);
  };

  const askable = !!detectedMonth && (detectedSalary ?? 0) > 0 && (detectedHours ?? 0) > 0 && !confirmed[detectedMonth] && !dismissed;
  const detRate = askable ? (detectedSalary! / detectedHours!) : 0;

  const confirmDetected = () => {
    haptic.success();
    persist({ ...confirmed, [detectedMonth!]: { salary: Math.round(detectedSalary!), hours: Math.round(detectedHours!) } });
    toast.success(`Zapisano ${label(detectedMonth!)} do średniej`);
  };

  const remove = (m: string) => {
    Alert.alert(
      'Usunąć potwierdzony miesiąc?',
      `${label(m)} przestanie liczyć się do średniej stawki. Tego nie cofniesz (chyba że potwierdzisz go ponownie).`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń', style: 'destructive', onPress: () => {
            haptic.medium();
            const next = { ...confirmed }; delete next[m];
            persist(next);
          },
        },
      ],
    );
  };

  const avgRate = (() => {
    const ms = Object.values(confirmed).filter(m => !m.excluded);
    const sal = ms.reduce((s, m) => s + (m.salary || 0), 0);
    const hrs = ms.reduce((s, m) => s + (m.hours || 0), 0);
    return hrs > 0 ? sal / hrs : null;
  })();
  // Total earned across ALL confirmed months (excluded ones still count here).
  const totalEarned = Object.values(confirmed).reduce((s, m) => s + (m.salary || 0), 0);

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <ShieldCheck size={14} color="#2AC68F" />
        <Text style={s.title}>Potwierdzone miesiące (stawka)</Text>
      </View>
      <Text style={s.sub}>
        Stawka szacunkowa = średnia z potwierdzonych miesięcy
        {avgRate != null ? ` · teraz ${avgRate.toFixed(2)} zł/h` : ' (jeszcze brak — potwierdź poniżej)'}.
        {'\n'}Kalkulatorem wyłączasz miesiąc ze średniej (np. po zmianie na umowę o pracę), nie tracąc go z sumy zarobków.
      </Text>
      {totalEarned > 0 && (
        <Text style={s.total}>Łącznie zarobione: <Text style={s.totalStrong}>{Math.round(totalEarned).toLocaleString('pl-PL')} zł</Text></Text>
      )}

      {askable && (
        <View style={s.ask}>
          <Text style={s.askTitle}>Czy się zgadza? — {label(detectedMonth!)}</Text>
          <Text style={s.askLine}>
            Wypłata <Text style={s.askStrong}>{Math.round(detectedSalary!)} zł</Text> ÷ <Text style={s.askStrong}>{Math.round(detectedHours!)} h</Text> = <Text style={s.askStrong}>{detRate.toFixed(2)} zł/h</Text>
          </Text>
          <View style={s.askBtns}>
            <PressableScale onPress={() => { haptic.tap(); setDismissed(true); }} style={s.no}>
              <X size={14} color={c.text.muted} /><Text style={s.noText}>Nie teraz</Text>
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
            <Text style={[s.rowMonth, v.excluded && s.rowMuted]}>{label(m)}</Text>
            <Text style={[s.rowMeta, v.excluded && s.rowMuted]} numberOfLines={1}>
              {v.salary} zł · {v.hours} h · {(v.salary / v.hours).toFixed(1)} zł/h{v.excluded ? ' · poza średnią' : ''}
            </Text>
            <PressableScale
              onPress={() => toggleExclude(m)}
              style={[s.avgToggle, !v.excluded && s.avgToggleOn]}
            >
              <Calculator size={13} color={v.excluded ? c.text.muted : '#2AC68F'} />
            </PressableScale>
            <PressableScale onPress={() => remove(m)} style={s.del}><X size={14} color={c.text.secondary} /></PressableScale>
          </View>
        ))
      )}
    </View>
  );
}

const makeStyles = (c: typeof colors) => StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: c.border.subtle, paddingTop: spacing[3], paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  sub: { fontSize: 11, color: c.text.muted, lineHeight: 15 },
  ask: {
    backgroundColor: 'rgba(42,198,143,0.08)', borderWidth: 1, borderColor: 'rgba(42,198,143,0.30)',
    borderRadius: radius.md, padding: spacing[3], gap: 6, marginTop: spacing[1],
  },
  askTitle: { fontSize: 13, fontWeight: '800', color: '#2AC68F' },
  askLine: { fontSize: 12, color: c.text.secondary },
  askStrong: { fontWeight: '800', color: c.text.primary },
  askBtns: { flexDirection: 'row', gap: spacing[2], marginTop: 4 },
  no: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: radius.md, backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default },
  noText: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  yes: { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: radius.md, backgroundColor: '#2AC68F' },
  yesText: { fontSize: 13, fontWeight: '800', color: '#06231a' },
  empty: { fontSize: 12, color: c.text.muted },
  total: { fontSize: 12, color: c.text.secondary, marginTop: 2 },
  totalStrong: { fontWeight: '800', color: '#2AC68F' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6 },
  rowMonth: { fontSize: 13, fontWeight: '700', color: c.text.primary, width: 64 },
  rowMuted: { color: c.text.muted, opacity: 0.6 },
  rowMeta: { flex: 1, fontSize: 11, color: c.text.muted },
  avgToggle: { padding: 6, borderRadius: radius.md, backgroundColor: c.fill.subtle, borderWidth: 1, borderColor: c.border.subtle },
  avgToggleOn: { backgroundColor: '#2AC68F18', borderColor: '#2AC68F55' },
  del: { padding: 6, borderRadius: radius.md, backgroundColor: c.fill.subtle, borderWidth: 1, borderColor: c.border.subtle },
});
