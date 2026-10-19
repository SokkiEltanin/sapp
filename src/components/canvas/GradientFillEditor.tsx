import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Fill, GradientFill, isGradientFill, gradientPoints, makeGradientFill } from '@/store/gradientFill';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import ColorSwatchPicker from '@/components/ui/ColorSwatchPicker';

const DIRECTIONS: [GradientFill['direction'], string][] = [
  ['right', '→'], ['down', '↓'], ['diagonalDown', '↘'], ['diagonalUp', '↗'],
];

// Edytor wypełnienia płasko/gradient (Faza §394, 2026-10-19) — user: "dodaj gradienty na
// pewno". WSPÓLNY dla `CanvasShapeStyleModal.tsx` (rectShape/ellipseShape fill) i
// `CanvasProgressBarStyleModal.tsx` (progressBar fillColor) — jeden komponent, jedna zmiana
// naprawia/rozwija oba miejsca naraz, ten sam duch co `ColorSwatchPicker.tsx` będąc wspólnym
// dla wszystkich modali stylu.
export default function GradientFillEditor({ value, onChange, presets, label }: {
  value: Fill;
  onChange: (f: Fill) => void;
  presets: string[];
  label?: string;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const grad = isGradientFill(value) ? value : null;
  const flatBase: string = grad ? grad.stops[0] : (value as string);

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={s.headRow}>
        <Text style={s.sectionLabel}>{label ?? 'Wypełnienie'}</Text>
        <View style={s.segmented}>
          <TouchableOpacity
            onPress={() => { if (grad) { haptic.tap(); onChange(flatBase); } }}
            style={[s.segBtn, !grad && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}
          >
            <Text style={[s.segTxt, !grad && { color: c.accent.blue }]}>Płasko</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { if (!grad) { haptic.tap(); onChange(makeGradientFill(flatBase)); } }}
            style={[s.segBtn, !!grad && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}
          >
            <Text style={[s.segTxt, !!grad && { color: c.accent.blue }]}>Gradient</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!grad ? (
        <ColorSwatchPicker presets={presets} current={flatBase} onSelect={onChange} />
      ) : (
        <View style={{ gap: spacing[2] }}>
          <View style={[s.preview, { overflow: 'hidden' }]}>
            <LinearGradient colors={grad.stops} {...gradientPoints(grad.direction)} style={StyleSheet.absoluteFill} />
          </View>
          <Text style={s.miniLabel}>Kolor 1</Text>
          <ColorSwatchPicker presets={presets} current={grad.stops[0]} onSelect={(hex) => onChange({ ...grad, stops: [hex, grad.stops[1]] })} />
          <Text style={s.miniLabel}>Kolor 2</Text>
          <ColorSwatchPicker presets={presets} current={grad.stops[1]} onSelect={(hex) => onChange({ ...grad, stops: [grad.stops[0], hex] })} />
          <Text style={s.miniLabel}>Kierunek</Text>
          <View style={s.segmented}>
            {DIRECTIONS.map(([d, sym]) => {
              const on = grad.direction === d;
              return (
                <TouchableOpacity key={d} onPress={() => { haptic.tap(); onChange({ ...grad, direction: d }); }}
                  style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                  <Text style={[s.segTxt, { fontSize: 15 }, on && { color: c.accent.blue }]}>{sym}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const makeS = (c: any) => StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  miniLabel: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  segmented: { flexDirection: 'row', gap: 6 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  segTxt: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  preview: { height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
});
