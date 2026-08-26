import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { G, Path, Circle, Ellipse, Rect } from 'react-native-svg';
import { CatPalette, DEFAULT_PALETTE, PUPIL } from '@/utils/catPalettes';

// Dedykowany, MAŁY art kotka na kafelek dashboardu (2026-08-27) — user: "widzę używasz ciągle
// tego samego [CatArt, pełnego] z głaskaniem na dostawę, tutaj może być inny oparty na naszym
// po prostu głowa lekko tułów dwie łapki trzymające krawędź kafelka jak pokazywałem, i
// animacje samych oczu zrobimy i uszka i tyle". Poprzednie podejście (PetTile.tsx do #89)
// próbowało wyciąć "samą głowę" z PEŁNEGO `CatArt` (viewBox 2000×2000, cała reszta ciała)
// przez `overflow:hidden` na mniejszym oknie — kruche (Android potrafi spłaszczyć View i
// zgubić przycinanie mimo `collapsable={false}`, patrz historia w ARCHITECTURE.md) i dawało
// za duży, źle wykadrowany wynik nawet gdy działało. Ten komponent to NIE crop innego kota —
// osobny, celowo prosty rysunek (własny mały viewBox) w tej samej palecie/systemie
// personalizacji co `CatArt` (kolor futra, kolor oczu/noska, wąsy, pręgi na łapkach), ale bez
// reszty aparatu CatArt (mruganie/spojrzenie/głaskanie/pazur/ogon) — user chciał WYŁĄCZNIE
// animacji oczu (mrugnięcie) i uszek (delikatny ruch), nic więcej.
//
// `stripes` (pręgi na PEŁNYM kocie w CatArt renderują się tylko na ogonie, CatTail.tsx) nie
// ma tu odpowiednika — w tej pozycji ogon nie jest widoczny — więc prop jest przyjmowany dla
// zgodności API z resztą personalizacji, ale celowo nieużywany.

const VB_W = 220, VB_H = 250;   // kompaktowy, własny viewBox — nie 2000×2000 CatArt

export interface PetTileCatProps {
  size?: number;          // wysokość renderu w px; szerokość = size × (VB_W/VB_H)
  animate?: boolean;      // false = statyczny render (np. podgląd)
  palette?: CatPalette;
  stripes?: boolean;      // przyjęte dla spójności API, nieużywane (brak ogona w tej pozycji)
  eyeColor?: string;
  noseColor?: string;
  whiskers?: boolean;
  legStripes?: boolean;
}

export default function PetTileCat({
  size = 72, animate = true, palette = DEFAULT_PALETTE,
  eyeColor = '', noseColor = '', whiskers = false, legStripes = false,
}: PetTileCatProps) {
  const p = palette;
  const unit = size / VB_H;
  const width = VB_W * unit;
  const eye = eyeColor || PUPIL;

  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!animate) return;
    let t: any;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 110);
        loop();
      }, 2400 + Math.random() * 3200);
    };
    loop();
    return () => clearTimeout(t);
  }, [animate]);

  const earL = useRef(new Animated.Value(0)).current;
  const earR = useRef(new Animated.Value(0)).current;
  const flutterEar = (which: 'L' | 'R') => {
    const v = which === 'L' ? earL : earR;
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  };
  useEffect(() => {
    if (!animate) return;
    let t: any;
    const loop = () => { t = setTimeout(() => { flutterEar(Math.random() < 0.5 ? 'L' : 'R'); loop(); }, 3600 + Math.random() * 4800); };
    loop();
    return () => clearTimeout(t);
  }, [animate]);

  return (
    <View style={{ width, height: size }}>
      <Svg width={width} height={size} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {/* tułów — wygląda jakby wystawał zza łapek/głowy, sugerując że kotek "wisi" na
            krawędzi kafelka, którą jest po prostu dolna krawędź tego SVG */}
        <Ellipse cx={110} cy={186} rx={80} ry={62} fill={p.coat} />
        <Ellipse cx={110} cy={205} rx={68} ry={40} fill={p.shade} />

        {/* ręce/łapki trzymające krawędź — krótkie łapy schodzące do owalnych łapek na samym
            dole viewBoxu (jego dolna krawędź = krawędź kafelka, po prostu tam sięgają) */}
        <Rect x={52} y={168} width={44} height={68} rx={22} fill={p.coat} />
        <Rect x={124} y={168} width={44} height={68} rx={22} fill={p.coat} />
        {legStripes && (
          <G fill={p.mark} opacity={0.32}>
            <Rect x={54} y={192} width={40} height={7} rx={3.5} />
            <Rect x={54} y={210} width={40} height={7} rx={3.5} />
            <Rect x={126} y={192} width={40} height={7} rx={3.5} />
            <Rect x={126} y={210} width={40} height={7} rx={3.5} />
          </G>
        )}
        <Ellipse cx={74} cy={226} rx={30} ry={19} fill={p.coat} />
        <Ellipse cx={146} cy={226} rx={30} ry={19} fill={p.coat} />
        <Path d="M62 220 v14 M74 217 v18 M86 220 v14" stroke={p.ink} strokeWidth={3.5} strokeLinecap="round" opacity={0.35} />
        <Path d="M134 220 v14 M146 217 v18 M158 220 v14" stroke={p.ink} strokeWidth={3.5} strokeLinecap="round" opacity={0.35} />

        {/* głowa — dominujący element, jak user chciał "praktycznie sama głowa" */}
        <Circle cx={110} cy={98} r={78} fill={p.coat} />

        {/* nosek */}
        <Path d="M98 128 L122 128 L110 141 Z" fill={noseColor || p.ink} />

        {/* pyszczek */}
        <Path d="M110 141 Q110 152 96 156 M110 141 Q110 152 124 156" fill="none" stroke={p.ink} strokeWidth={4} strokeLinecap="round" />

        {whiskers && (
          <G stroke={p.ink} strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.45}>
            <Path d="M92 140 Q60 134 32 130" />
            <Path d="M92 148 Q58 150 30 152" />
            <Path d="M128 140 Q160 134 188 130" />
            <Path d="M128 148 Q162 150 190 152" />
          </G>
        )}

        {/* oczy — mruganie to prosta zamiana stanu (otwarte/zamknięte), TA SAMA technika co
            `CatArt`'s `blink` (bez tweenowania SVG-prop, tylko przełącznik) */}
        {blink ? (
          <G>
            <Path d="M68 96 Q80 104 92 96" fill="none" stroke={p.ink} strokeWidth={6} strokeLinecap="round" />
            <Path d="M128 96 Q140 104 152 96" fill="none" stroke={p.ink} strokeWidth={6} strokeLinecap="round" />
          </G>
        ) : (
          <G>
            <Circle cx={80} cy={96} r={17} fill="#fff" />
            <Circle cx={140} cy={96} r={17} fill="#fff" />
            <Circle cx={80} cy={97} r={11} fill={eye} />
            <Circle cx={140} cy={97} r={11} fill={eye} />
            <Circle cx={76} cy={92} r={3.5} fill="#fff" />
            <Circle cx={136} cy={92} r={3.5} fill="#fff" />
          </G>
        )}
      </Svg>

      {/* uszy — osobne nakładki, jak w CatArt, żeby mogły się delikatnie obracać bez
          tweenowania SVG-prop (mruga tylko wrapper, nie geometria) */}
      <Ear side="L" anim={earL} unit={unit} size={size} coat={p.coat} inner={p.ear} />
      <Ear side="R" anim={earR} unit={unit} size={size} coat={p.coat} inner={p.ear} />
    </View>
  );
}

// Jedno ucho jako animowana nakładka — obraca się wokół swojej podstawy (RN nie ma
// transform-origin, więc kanapka translate/rotate/translate), ten sam wzorzec co `Ear` w
// CatArt.tsx, tylko przeliczony na mały, własny viewBox tego komponentu.
const EAR_BASE_L = { x: 60, y: 58 };
const EAR_BASE_R = { x: 160, y: 58 };
function Ear({ side, anim, unit, size, coat, inner }: {
  side: 'L' | 'R'; anim: Animated.Value; unit: number; size: number; coat: string; inner: string;
}) {
  const base = side === 'L' ? EAR_BASE_L : EAR_BASE_R;
  const px = base.x * unit;
  const py = base.y * unit;
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', side === 'L' ? '9deg' : '-9deg'] });
  const outer = side === 'L' ? 'M50,60 L92,60 L58,8 Z' : 'M170,60 L128,60 L162,8 Z';
  const innerPath = side === 'L' ? 'M58,52 L84,54 L62,20 Z' : 'M162,52 L136,54 L158,20 Z';
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 0, top: 0, width: size * (VB_W / VB_H), height: size,
        transform: [{ translateX: px }, { translateY: py }, { rotate }, { translateX: -px }, { translateY: -py }],
      }}
    >
      <Svg width={VB_W * unit} height={VB_H * unit} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Path d={outer} fill={coat} />
        <Path d={innerPath} fill={inner} />
      </Svg>
    </Animated.View>
  );
}
