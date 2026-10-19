import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { X, Palette } from 'lucide-react-native';
import {
  ShapeComponentType, RectShapeStyle, EllipseShapeStyle, LineShapeStyle, TextShapeStyle, SHAPE_COLOR_PRESETS,
} from '@/store/shapeStyleDefaults';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import Stepper from '@/components/ui/Stepper';
import ColorSwatchPicker from '@/components/ui/ColorSwatchPicker';
import GradientFillEditor from './GradientFillEditor';

// Jeden adaptacyjny modal dla 4 typów kształtów (Faza 26, 2026-10-17, §357) — zamiast 4 osobnych,
// prawie identycznych plików (każdy to i tak tylko kolor+kilka numerycznych pól). Branch wg
// `kind` wewnątrz, ten sam wzorzec co `CountdownTile.tsx`'s branching per `layoutPreset`.
// `onChange` przyjmuje `Partial<any>` (nie osobny generyk per typ) — wołający (`ScreenCanvas.
// tsx`) i tak zawęża przez `item.componentType` PRZED wywołaniem, bezpieczeństwo typów żyje tam
// (ta sama, już udokumentowana decyzja co `CanvasItem.style` w `canvasComponentsStore.ts`).
export default function CanvasShapeStyleModal({ visible, kind, style, onChange, onClose }: {
  visible: boolean;
  kind: ShapeComponentType;
  style: RectShapeStyle | EllipseShapeStyle | LineShapeStyle | TextShapeStyle;
  onChange: (patch: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const title = kind === 'rectShape' ? 'Styl prostokąta' : kind === 'ellipseShape' ? 'Styl elipsy' : kind === 'lineShape' ? 'Styl linii' : 'Styl tekstu';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.head}>
            <Palette size={16} color={c.accent.blue} />
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: spacing[3] }}>
            {(kind === 'rectShape' || kind === 'ellipseShape') && (() => {
              const st = style as RectShapeStyle | EllipseShapeStyle;
              return (
                <>
                  <GradientFillEditor presets={SHAPE_COLOR_PRESETS} value={st.fill} onChange={(fill) => onChange({ fill })} />
                  <View>
                    <View style={s.rowBetween}>
                      <Text style={s.sectionLabel}>Obrys</Text>
                      <TouchableOpacity onPress={() => { haptic.tap(); onChange({ stroke: st.stroke ? null : '#FFFFFF' }); }} style={s.tinyBtn}>
                        <Text style={s.tinyBtnTxt}>{st.stroke ? 'Usuń obrys' : 'Dodaj obrys'}</Text>
                      </TouchableOpacity>
                    </View>
                    {st.stroke && (
                      <ColorSwatchPicker presets={SHAPE_COLOR_PRESETS} current={st.stroke} onSelect={(hex) => onChange({ stroke: hex })} />
                    )}
                  </View>
                  <View style={s.innerCard}>
                    {st.stroke && (
                      <>
                        <Stepper label="Grubość obrysu" value={st.strokeWidth} min={1} max={10} step={1}
                          onChange={v => onChange({ strokeWidth: v })} />
                        <View style={s.divider} />
                      </>
                    )}
                    {kind === 'rectShape' && (
                      <>
                        <Stepper label="Zaokrąglenie rogów" value={(st as RectShapeStyle).cornerRadius} min={0} max={50} step={2}
                          onChange={v => onChange({ cornerRadius: v })} />
                        <View style={s.divider} />
                      </>
                    )}
                    <Stepper label="Przezroczystość" value={st.opacity} min={0.1} max={1} step={0.1} decimals={1}
                      onChange={v => onChange({ opacity: v })} />
                  </View>
                </>
              );
            })()}

            {kind === 'lineShape' && (() => {
              const st = style as LineShapeStyle;
              return (
                <>
                  <View>
                    <Text style={s.sectionLabel}>Kolor</Text>
                    <ColorSwatchPicker presets={SHAPE_COLOR_PRESETS} current={st.color} onSelect={(hex) => onChange({ color: hex })} />
                  </View>
                  <View style={s.innerCard}>
                    <Stepper label="Grubość" value={st.thickness} min={1} max={10} step={1}
                      onChange={v => onChange({ thickness: v })} />
                    <View style={s.divider} />
                    <Stepper label="Przezroczystość" value={st.opacity} min={0.1} max={1} step={0.1} decimals={1}
                      onChange={v => onChange({ opacity: v })} />
                  </View>
                </>
              );
            })()}

            {kind === 'textShape' && (() => {
              const st = style as TextShapeStyle;
              return (
                <>
                  <View>
                    <Text style={s.sectionLabel}>Treść</Text>
                    <TextInput
                      value={st.text} onChangeText={(v) => onChange({ text: v })}
                      placeholder="Wpisz tekst…" placeholderTextColor={c.text.muted}
                      multiline maxLength={80} style={s.textInput}
                    />
                  </View>
                  {/* Gradient na tekście (§402, user: "gradient na tekście") — reużyty
                      `GradientFillEditor` (Płasko/Gradient), ten sam co rectShape/ellipseShape
                      wyżej. Renderowane jako SVG TYLKO gdy gradient wybrany — patrz
                      `ShapeTile.tsx`. */}
                  <GradientFillEditor label="Kolor" presets={SHAPE_COLOR_PRESETS} value={st.color} onChange={(color) => onChange({ color })} />
                  <Text style={s.sectionLabel}>Wyrównanie</Text>
                  <View style={s.segmented}>
                    {([['left', 'Do lewej'], ['center', 'Środek'], ['right', 'Do prawej']] as [TextShapeStyle['align'], string][]).map(([m, lbl]) => {
                      const on = st.align === m;
                      return (
                        <TouchableOpacity key={m} onPress={() => { haptic.tap(); onChange({ align: m }); }}
                          style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                          <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={s.innerCard}>
                    <Stepper label="Rozmiar czcionki" value={st.fontSize} min={10} max={40} step={2}
                      onChange={v => onChange({ fontSize: v })} />
                    <View style={s.divider} />
                    <View style={s.rowBetween}>
                      <Text style={s.rowLabel}>Pogrubienie</Text>
                      <TouchableOpacity onPress={() => { haptic.tap(); onChange({ bold: !st.bold }); }}
                        style={[s.tinyBtn, st.bold && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                        <Text style={[s.tinyBtnTxt, st.bold && { color: c.accent.blue }]}>{st.bold ? 'Włączone' : 'Wyłączone'}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={s.divider} />
                    {/* Przezroczystość (§402, fix) — `opacity` ISTNIAŁ w `TextShapeStyle`/
                        renderowany w `ShapeTile.tsx` od §357, ale NIGDY nie był tu wystawiony —
                        martwa kontrolka UI, user nie miał jak jej dotknąć. */}
                    <Stepper label="Przezroczystość" value={st.opacity} min={0.1} max={1} step={0.1} decimals={1}
                      onChange={v => onChange({ opacity: v })} />
                  </View>
                </>
              );
            })()}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeS = (c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[6] },
  card: {
    width: '100%', maxWidth: 420, maxHeight: '88%', backgroundColor: c.bg.secondary,
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], gap: spacing[2],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[1] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, fontWeight: '600', color: c.text.primary, flex: 1 },
  innerCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.card, padding: spacing[3] },
  divider: { height: 1, backgroundColor: c.border.subtle },
  segmented: { flexDirection: 'row', gap: 6 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  segTxt: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  tinyBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  tinyBtnTxt: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  textInput: {
    minHeight: 60, fontSize: 14, fontWeight: '600', color: c.text.primary, backgroundColor: c.bg.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.card, padding: spacing[3], textAlignVertical: 'top',
  },
});
