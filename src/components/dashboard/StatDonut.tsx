import { View, Text } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useColors } from '@/theme/useColors';
import { spacing } from '@/theme';

const DONUT_COLORS = ['#6C9EFF', '#4ECBA8', '#FBBF24', '#F472B6', '#A78BFA', '#FB923C', '#9CA3AF'];

export default function StatDonut({ rows, fmt }: { rows: { label: string; value: number; unit: string }[]; fmt: (v: number, u: string) => string }) {
  const colors = useColors();
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const R = 30, SW = 12, C = 2 * Math.PI * R;
  let acc = 0;
  const unit = rows[0]?.unit ?? '';
  const totalLabel = unit === 'zł' ? `${Math.round(total)}` : unit === '×' ? `${Math.round(total)}` : `${Math.round(total)}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
      <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={84} height={84} viewBox="0 0 84 84" style={{ position: 'absolute' }}>
          <SvgCircle cx={42} cy={42} r={R} stroke={colors.border.default} strokeWidth={SW} fill="none" />
          {rows.map((r, i) => {
            const frac = r.value / total;
            const dash = `${(frac * C).toFixed(2)} ${C.toFixed(2)}`;
            const off = -(acc * C);
            acc += frac;
            return (
              <SvgCircle key={i} cx={42} cy={42} r={R}
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth={SW} fill="none"
                strokeDasharray={dash} strokeDashoffset={off} transform="rotate(-90 42 42)" />
            );
          })}
        </Svg>
        <Text style={{ fontSize: 15, fontWeight: '900', color: colors.text.primary }}>{totalLabel}</Text>
        <Text style={{ fontSize: 8, color: colors.text.muted, fontWeight: '700' }}>{unit === 'zł' ? 'zł' : 'razem'}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {rows.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <Text style={{ flex: 1, fontSize: 11.5, color: colors.text.secondary }} numberOfLines={1}>{r.label}</Text>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.text.primary }}>{fmt(r.value, r.unit)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
