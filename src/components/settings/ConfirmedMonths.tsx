import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Check, X, ShieldCheck } from 'lucide-react-native';
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
function prevMonth(): string {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Lets the user confirm real (salary, hours) per month. The estimated rate then
// averages over these trusted months instead of guessing from one paycheck.
export default function ConfirmedMonths() {
  const settings = useWorkStore(s => s.settings);
  const setSettings = useWorkStore(s => s.setSettings);
  const confirmed = settings.confirmedMonths ?? {};
  const entries = Object.entries(confirmed).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const [ym, setYm] = useState(prevMonth());
  const [salary, setSalary] = useState('');
  const [hours, setHours] = useState('');

  const persist = (next: Record<string, { salary: number; hours: number }>) => {
    const s = { ...settings, confirmedMonths: next };
    setSettings(s);
    workService.saveSettings(s).catch(() => {});
  };

  const add = () => {
    const sal = parseFloat(salary.replace(',', '.'));
    const hrs = parseFloat(hours.replace(',', '.'));
    if (!/^\d{4}-\d{2}$/.test(ym) || !sal || !hrs || sal <= 0 || hrs <= 0) {
      toast.error('Podaj miesiąc (RRRR-MM), wypłatę i godziny');
      return;
    }
    haptic.success();
    persist({ ...confirmed, [ym]: { salary: Math.round(sal), hours: Math.round(hrs) } });
    setSalary(''); setHours('');
    toast.success(`Potwierdzono ${label(ym)}`);
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
        Stawka szacunkowa = średnia z miesięcy, które potwierdziłeś osobiście
        {avgRate != null ? ` · teraz ${avgRate.toFixed(2)} zł/h` : ''}.
      </Text>

      {entries.map(([m, v]) => (
        <View key={m} style={s.row}>
          <Text style={s.rowMonth}>{label(m)}</Text>
          <Text style={s.rowMeta}>{v.salary} zł · {v.hours} h · {(v.salary / v.hours).toFixed(1)} zł/h</Text>
          <PressableScale onPress={() => remove(m)} style={s.del}><X size={14} color={colors.text.muted} /></PressableScale>
        </View>
      ))}

      <View style={s.addRow}>
        <TextInput value={ym} onChangeText={setYm} placeholder="RRRR-MM" placeholderTextColor={colors.text.muted} autoCapitalize="none" style={[s.input, { flex: 1.3 }]} />
        <TextInput value={salary} onChangeText={setSalary} placeholder="zł" placeholderTextColor={colors.text.muted} keyboardType="numeric" style={s.input} />
        <TextInput value={hours} onChangeText={setHours} placeholder="h" placeholderTextColor={colors.text.muted} keyboardType="numeric" style={s.input} />
        <PressableScale onPress={add} style={s.add}><Check size={16} color="#06231a" /></PressableScale>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: spacing[3], gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  sub: { fontSize: 11, color: colors.text.muted, lineHeight: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6 },
  rowMonth: { fontSize: 13, fontWeight: '700', color: colors.text.primary, width: 64 },
  rowMeta: { flex: 1, fontSize: 11, color: colors.text.muted },
  del: { padding: 6, borderRadius: radius.md, backgroundColor: colors.bg.elevated },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1] },
  input: {
    flex: 1, fontSize: 13, fontWeight: '600', color: colors.text.primary, textAlign: 'center',
    paddingVertical: 7, paddingHorizontal: spacing[2], borderRadius: radius.md,
    backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default,
  },
  add: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: '#2AC68F', alignItems: 'center', justifyContent: 'center' },
});
