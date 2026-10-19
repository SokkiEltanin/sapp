import { Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect, Ellipse, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import {
  ShapeComponentType, RectShapeStyle, EllipseShapeStyle, LineShapeStyle, TextShapeStyle,
} from '@/store/shapeStyleDefaults';
import { Fill, isGradientFill, gradientPoints } from '@/store/gradientFill';

// Gradient wypełnienia (§394) — jedna mała pomoc, dwa użycia (`rectShape`/`ellipseShape`
// niżej). `id="fillGrad"` jest bezpieczny statyczny — każda instancja ma WŁASNE drzewo `<Svg>`,
// id SVG są skopowane per-dokument w react-native-svg, zero kolizji między kaflami.
function fillPaint(fill: Fill): string {
  return isGradientFill(fill) ? 'url(#fillGrad)' : fill;
}
function FillDefs({ fill }: { fill: Fill }) {
  if (!isGradientFill(fill)) return null;
  const { start, end } = gradientPoints(fill.direction);
  return (
    <Defs>
      <LinearGradient id="fillGrad" x1={`${start.x * 100}%`} y1={`${start.y * 100}%`} x2={`${end.x * 100}%`} y2={`${end.y * 100}%`}>
        <Stop offset="0" stopColor={fill.stops[0]} />
        <Stop offset="1" stopColor={fill.stops[1]} />
      </LinearGradient>
    </Defs>
  );
}

// Renderer gołych kształtów-primitywów (Faza 26, 2026-10-17, §357) — siostrzany komponent
// `StreakTile`/`CountdownTile`/`NotesTile`, ta sama sygnatura `(…, onPress, sizeStyle)`, więc
// `CanvasPlacedItem.tsx`'s `renderTile` render-prop obsługuje go identycznie bez żadnej zmiany
// tam. Różnica: te 4 typy nie mają "stanu niepodpiętego" (zero `item: X | null` jak reszta) —
// kształt JEST swoją treścią (kolor/obrys/tekst), nie reprezentuje czegoś z apki.
//
// `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` (patrz komentarz w
// `shapeStyleDefaults.ts`) — SVG rozciąga się 1:1 z `sizeStyle` (flex 100%/100%), żywa animacja
// podczas przeciągania uchwytu resize bez pomiaru `onLayout`.
export function ShapeTile({ kind, style, width, height, onPress, sizeStyle }: {
  kind: ShapeComponentType;
  style: RectShapeStyle | EllipseShapeStyle | LineShapeStyle | TextShapeStyle;
  // Realny rozmiar (w px) instancji na płótnie — TYLKO dla `rectShape`, patrz fix niżej (§387).
  width: number;
  height: number;
  onPress: () => void;
  sizeStyle?: StyleProp<ViewStyle>;
}) {
  if (kind === 'rectShape') {
    const st = style as RectShapeStyle;
    const half = st.strokeWidth / 2;
    // Fix (§387, user: kształty "bez zaokrąglone bo tak to się wydłużają i wygląda jak gówno") —
    // poprzednio `viewBox` był ZAWSZE znormalizowanym kwadratem 0-100 + `preserveAspectRatio=
    // "none"`, więc dla niekwadratowego boxa (np. domyślny 140×90) skala X i Y po transformacie
    // się różniły — kwadratowa "ćwiartka koła" promienia zaokrąglenia w lokalnej przestrzeni
    // zamieniała się w rozciągniętą, eliptyczną ćwiartkę na ekranie (tym bardziej wyraźnie, im
    // bardziej box odbiegał od kwadratu). Teraz viewBox = REALNE piksele boxa (scaleX=scaleY=1
    // poza aktywnym gestem resize, gdzie `width`/`height` to ostatnie SKOMITOWANE wymiary ze
    // store'u — chwilowa, niewielka nieścisłość TYLKO podczas samego przeciągania uchwytu, znika
    // natychmiast po puszczeniu) — `rx`/`ry` liczone w prawdziwych pikselach, geometrycznie
    // poprawne kółko w rogu niezależnie od proporcji boxa, klamrowane do połowy krótszej krawędzi
    // (po odjęciu obrysu), żeby nie nałożyły się na siebie przy bardzo płaskich/wąskich kształtach.
    const w = Math.max(1, width), h = Math.max(1, height);
    const r = Math.max(0, Math.min(st.cornerRadius, w / 2 - half, h / 2 - half));
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ opacity: st.opacity }}>
          <FillDefs fill={st.fill} />
          <Rect x={half} y={half} width={w - st.strokeWidth} height={h - st.strokeWidth}
            rx={r} ry={r}
            fill={fillPaint(st.fill)} stroke={st.stroke ?? 'transparent'} strokeWidth={st.strokeWidth} />
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
          <FillDefs fill={st.fill} />
          <Ellipse cx={50} cy={50} rx={r} ry={r} fill={fillPaint(st.fill)} stroke={st.stroke ?? 'transparent'} strokeWidth={st.strokeWidth} />
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
  const shownText = st.text || 'Dwa kliknięcia na 🎨, żeby wpisać tekst';
  // Gradient na tekście (§402, user: "gradient na tekście") — RN <Text> nie ma natywnego
  // gradientowego wypełnienia (ten sam ograniczenie udokumentowane w `GradientText.tsx`), więc
  // gradient renderuje się jako PRAWDZIWE SVG (`<SvgText fill="url(#...)">`, reużyte
  // `FillDefs`/`fillPaint` z góry pliku — te same co rect/ellipse). ŚWIADOMY kompromis:
  // SVG-owy tekst NIE zawija się automatycznie jak RN `<Text numberOfLines>` — gradient jest
  // więc JEDNOLINIJKOWY (skalowany w dół, żeby zmieścić się w szerokości boxa, ten sam
  // fit-scale co `GradientText.tsx`). Płaski kolor (zdecydowana większość przypadków) zostaje
  // DOKŁADNIE jak dotąd — zero zmiany zachowania dla istniejących, wieloliniowych instancji.
  if (isGradientFill(st.color)) {
    const w = Math.max(1, width), h = Math.max(1, height);
    const estCharW = st.fontSize * 0.58; // przybliżenie szerokości znaku (brak pomiaru tekstu w RN)
    const fit = shownText.length > 0 ? Math.min(1, w / Math.max(1, shownText.length * estCharW)) : 1;
    const size = st.fontSize * fit;
    const x = st.align === 'left' ? 0 : st.align === 'right' ? w : w / 2;
    const anchor = st.align === 'left' ? 'start' : st.align === 'right' ? 'end' : 'middle';
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ opacity: st.opacity }}>
          <FillDefs fill={st.color} />
          <SvgText x={x} y={h / 2 + size * 0.35} fontSize={size} fontWeight={st.bold ? '800' : '500'}
            textAnchor={anchor} fill={fillPaint(st.color)}>
            {shownText}
          </SvgText>
        </Svg>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[sizeStyle, s.textWrap]}>
      <Text
        style={[s.text, { color: st.color, fontSize: st.fontSize, fontWeight: st.bold ? '800' : '500', textAlign: st.align, opacity: st.opacity }]}
        numberOfLines={6}
      >
        {shownText}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  textWrap: { justifyContent: 'center' },
  text: { width: '100%' },
});
