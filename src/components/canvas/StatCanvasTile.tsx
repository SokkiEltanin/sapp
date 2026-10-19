import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { BarChart2 } from 'lucide-react-native';
import { metricById, metricNumber, metricSeries, StatCtx } from '@/utils/statWidgets';
import { fmtStat, unitChip } from '@/utils/dashboard/format';
import { metricIcon } from '@/components/dashboard/StatTile';
import WaveChart from '@/components/dashboard/WaveChart';
import { StatTileCanvasStyle } from '@/store/statTileStyleDefaults';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';

// Renderer komponentu "Wykres" na płótnie (§386) — sygnatura `(style, onPress, sizeStyle)`
// jak reszta typów (patrz `IconTile.tsx`), ale DWA dodatkowe propsy specyficzne dla tego typu:
// `metric` (bindingKey — który wpis z `WIDGET_METRICS` rejestru) i `statCtx` (dane do
// policzenia wartości — TYLKO dashboard je dziś dostarcza, patrz `ScreenCanvas.tsx`). Brak
// `statCtx` renderuje się jak "brak podpięcia" (ten ekran nie wspiera jeszcze wykresów) —
// nie crash, nie pusty box bez wyjaśnienia.
export function StatCanvasTile({ metric, style, statCtx, accentColor, onPress, sizeStyle }: {
  metric: string | null;
  style: StatTileCanvasStyle;
  statCtx?: StatCtx;
  accentColor: string;
  onPress: () => void;
  sizeStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const def = metric ? metricById(metric) : undefined;

  if (!statCtx) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <View style={[st.wrap, { backgroundColor: c.bg.elevated, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' }]}>
          <BarChart2 size={18} color={c.text.muted} />
          <Text style={[st.placeholderTxt, { color: c.text.muted }]}>Wykresy — tylko na Dashboardzie</Text>
        </View>
      </TouchableOpacity>
    );
  }
  if (!def) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <View style={[st.wrap, { backgroundColor: c.bg.elevated, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' }]}>
          <BarChart2 size={18} color={c.text.muted} />
          <Text style={[st.placeholderTxt, { color: c.text.muted }]}>Wybierz metrykę</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const Ic = metricIcon(def);
  const period = style.period;
  const uChip = unitChip(def.unit);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
      <View style={[st.wrap, { backgroundColor: c.bg.elevated, borderColor: c.border.default }]}>
        <View style={st.header}>
          <View style={[st.iconChip, { backgroundColor: accentColor + '1A' }]}><Ic size={12} color={accentColor} /></View>
          <Text style={[st.title, { color: c.text.primary }]} numberOfLines={1}>{def.label}</Text>
          {!!uChip && <Text style={[st.unit, { color: accentColor }]}>{uChip}</Text>}
        </View>
        {style.viz === 'wave' ? (() => {
          const { values } = metricSeries(metric!, statCtx, period, 6);
          return values.some(v => v !== 0)
            ? <WaveChart data={values} color={accentColor} />
            : <Text style={[st.emptyTxt, { color: c.text.muted }]}>Brak danych</Text>;
        })() : (() => {
          const { value, unit } = metricNumber(metric!, statCtx, period);
          return <Text style={[st.number, { color: c.text.primary }]} numberOfLines={1}>{fmtStat(value, unit)}</Text>;
        })()}
      </View>
    </TouchableOpacity>
  );
}

const st = {
  wrap: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: spacing[2], gap: spacing[1], overflow: 'hidden' as const },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  iconChip: { width: 20, height: 20, borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
  title: { flex: 1, fontSize: 11, fontWeight: '700' as const },
  unit: { fontSize: 9.5, fontWeight: '700' as const },
  number: { fontSize: 20, fontWeight: '800' as const },
  emptyTxt: { fontSize: 11 },
  placeholderTxt: { fontSize: 10, textAlign: 'center' as const, marginTop: 2 },
};
