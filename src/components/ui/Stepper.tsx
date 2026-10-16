import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { radius } from '@/theme';
import { haptic } from '@/utils/haptics';

// Wyniesiony z `app/dashboard-tile-creator.tsx` (2026-10-16, system kopiowania komponentów,
// Faza 16) — drugi konsument (`CanvasStreakStyleModal.tsx`, edycja stylu per-instancja na
// płótnie) uczynił z lokalnej funkcji-pomocnika kandydata do wspólnego komponentu. Samodzielny
// (własny `useColors()`/`themedStyles`, nie przyjmuje `c`/`s` od wołającego jak oryginał) —
// żeby dało się go użyć w DOWOLNYM miejscu bez przekazywania lokalnych stylów rodzica.
export default function Stepper({ label, value, min, max, step, decimals = 0, onChange }: {
  label: string; value: number; min: number; max: number; step: number; decimals?: number;
  onChange: (v: number) => void;
}) {
  const c = useColors();
  const s = makeS(c);
  const dec = (delta: number) => {
    haptic.tap();
    const next = Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100));
    onChange(next);
  };
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.stepperRow}>
        <TouchableOpacity onPress={() => dec(-step)} style={s.stepBtn} disabled={value <= min}>
          <Minus size={14} color={value <= min ? c.text.muted : c.text.primary} />
        </TouchableOpacity>
        <Text style={s.stepVal}>{value.toFixed(decimals)}</Text>
        <TouchableOpacity onPress={() => dec(step)} style={s.stepBtn} disabled={value >= max}>
          <Plus size={14} color={value >= max ? c.text.muted : c.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontSize: 13, fontWeight: '600', color: c.text.primary, flex: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.bg.elevated, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 13, fontWeight: '800', color: c.text.primary, minWidth: 34, textAlign: 'center', fontVariant: ['tabular-nums'] },
}));
