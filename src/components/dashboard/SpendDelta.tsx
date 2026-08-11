import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';

// A spend delta chip: lower spend = green, higher = red (opposite of "growth good").
export default function SpendDelta({ pct, label, muted }: { pct: number; label: string; muted: string }) {
  const up = pct > 0;
  const color = pct === 0 ? muted : up ? '#F87171' : '#2AC68F';
  return (
    <View style={s.chip}>
      {up ? <TrendingUp size={11} color={color} /> : <TrendingDown size={11} color={color} />}
      <Text style={[s.val, { color }]}>{up ? '+' : ''}{pct}%</Text>
      <Text style={[s.label, { color: muted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  val: { fontSize: 12, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600' },
});
