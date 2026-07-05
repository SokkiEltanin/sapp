import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '@/theme/useColors';

export interface RingSpec {
  key: string;
  label: string;
  Icon: any;
  value: number;
  goal: number;
  color: string;
  display: string;   // big value shown under the ring
  over?: boolean;    // e.g. budget exceeded — tint the ring red
}

function Ring({ spec, size }: { spec: RingSpec; size: number }) {
  const c = useColors();
  const pct = spec.goal > 0 ? Math.min(1, spec.value / spec.goal) : 0;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const col = spec.over ? '#FF6B6B' : spec.color;
  return (
    <View style={s.ringWrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={col + '24'} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={stroke} fill="none"
            strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFillObject, s.center]}>
          <spec.Icon size={17} color={col} />
        </View>
      </View>
      <Text style={[s.val, { color: c.text.primary }]} numberOfLines={1}>{spec.display}</Text>
      <Text style={[s.label, { color: c.text.muted }]} numberOfLines={1}>{spec.label}</Text>
    </View>
  );
}

export default function DailyRings({ rings, size = 62 }: { rings: RingSpec[]; size?: number }) {
  return (
    <View style={s.row}>
      {rings.map(r => <Ring key={r.key} spec={r} size={size} />)}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginTop: 6 },
  ringWrap: { flex: 1, alignItems: 'center', gap: 3 },
  center: { alignItems: 'center', justifyContent: 'center' },
  val: { fontSize: 12.5, fontWeight: '800', letterSpacing: -0.2 },
  label: { fontSize: 9.5, fontWeight: '600' },
});
