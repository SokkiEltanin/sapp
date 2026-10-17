import { Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect, Ellipse, Line } from 'react-native-svg';
import {
  ShapeComponentType, RectShapeStyle, EllipseShapeStyle, LineShapeStyle, TextShapeStyle,
} from '@/store/shapeStyleDefaults';

// Renderer gołych kształtów-primitywów (Faza 26, 2026-10-17, §357) — siostrzany komponent
// `StreakTile`/`CountdownTile`/`NotesTile`, ta sama sygnatura `(…, onPress, sizeStyle)`, więc
// `CanvasPlacedItem.tsx`'s `renderTile` render-prop obsługuje go identycznie bez żadnej zmiany
// tam. Różnica: te 4 typy nie mają "stanu niepodpiętego" (zero `item: X | null` jak reszta) —
// kształt JEST swoją treścią (kolor/obrys/tekst), nie reprezentuje czegoś z apki.
//
// `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` (patrz komentarz w
// `shapeStyleDefaults.ts`) — SVG rozciąga się 1:1 z `sizeStyle` (flex 100%/100%), żywa animacja
// podczas przeciągania uchwytu resize bez pomiaru `onLayout`.
export function ShapeTile({ kind, style, onPress, sizeStyle }: {
  kind: ShapeComponentType;
  style: RectShapeStyle | EllipseShapeStyle | LineShapeStyle | TextShapeStyle;
  onPress: () => void;
  sizeStyle?: StyleProp<ViewStyle>;
}) {
  if (kind === 'rectShape') {
    const st = style as RectShapeStyle;
    const half = st.strokeWidth / 2;
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: st.opacity }}>
          <Rect x={half} y={half} width={100 - st.strokeWidth} height={100 - st.strokeWidth}
            rx={st.cornerRadius} ry={st.cornerRadius}
            fill={st.fill} stroke={st.stroke ?? 'transparent'} strokeWidth={st.strokeWidth} />
        </Svg>
      </TouchableOpacity>
    );
  }
  if (kind === 'ellipseShape') {
    const st = style as EllipseShapeStyle;
    const r = 50 - st.strokeWidth / 2;
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: st.opacity }}>
          <Ellipse cx={50} cy={50} rx={r} ry={r} fill={st.fill} stroke={st.stroke ?? 'transparent'} strokeWidth={st.strokeWidth} />
        </Svg>
      </TouchableOpacity>
    );
  }
  if (kind === 'lineShape') {
    const st = style as LineShapeStyle;
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: st.opacity }}>
          <Line x1={0} y1={0} x2={100} y2={100} stroke={st.color} strokeWidth={st.thickness} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>
    );
  }
  const st = style as TextShapeStyle;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[sizeStyle, s.textWrap]}>
      <Text
        style={[s.text, { color: st.color, fontSize: st.fontSize, fontWeight: st.bold ? '800' : '500', textAlign: st.align, opacity: st.opacity }]}
        numberOfLines={6}
      >
        {st.text || 'Dwa kliknięcia na 🎨, żeby wpisać tekst'}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  textWrap: { justifyContent: 'center' },
  text: { width: '100%' },
});
