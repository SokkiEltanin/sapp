import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';
import Svg, { Defs, LinearGradient as LG, Stop, Rect, Circle, Ellipse, Path, G } from 'react-native-svg';

// Illustrated, lightly-animated backdrops for the pet — a real scene (sky by time of
// day, sun/moon on an arc, sea with drifting shimmer, sand, palm, distant birds)
// instead of emoji on a flat gradient. SVG for the static layers; a few overlay
// Animated.Views for motion (SVG-prop animation stutters on device, so motion lives
// on wrapper Views).

const VB_W = 300, VB_H = 250;

type Phase = 'dawn' | 'day' | 'dusk' | 'night';
function phaseFor(h: number): Phase {
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 18) return 'day';
  if (h >= 18 && h < 21) return 'dusk';
  return 'night';
}
const SKY: Record<Phase, [string, string]> = {
  dawn:  ['#F5A65B', '#FBE0AE'],
  day:   ['#3E97D6', '#BCE6F0'],
  dusk:  ['#E36A45', '#54376A'],
  night: ['#141E48', '#0A1030'],
};
const SEA: Record<Phase, [string, string]> = {
  dawn:  ['#3E8FB0', '#79C2D6'],
  day:   ['#2E86B8', '#66C0D8'],
  dusk:  ['#3A5F8A', '#7A6A9A'],
  night: ['#123A5A', '#0E2440'],
};
const SAND: Record<Phase, string> = { dawn: '#EAD2A6', day: '#EFDDAF', dusk: '#C9A98A', night: '#5A5468' };

function Shimmer({ y, w, delay, dur, opacity }: { y: number; w: number; delay: number; dur: number; opacity: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: dur, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const tx = a.interpolate({ inputRange: [0, 1], outputRange: [0, w * 0.14] });
  const op = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [opacity * 0.4, opacity, opacity * 0.4] });
  return <Animated.View style={{ position: 'absolute', top: `${(y / VB_H) * 100}%`, left: '8%', width: '46%', height: 2, borderRadius: 2, backgroundColor: '#FFFFFF', opacity: op, transform: [{ translateX: tx }] }} />;
}

function Bird({ startPct, top, dur, size }: { startPct: number; top: number; dur: number; size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const tx = a.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.5] });
  const ty = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -size * 0.03, 0] });
  const op = a.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.7, 0.7, 0] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: `${startPct}%`, top: `${top}%`, opacity: op, transform: [{ translateX: tx }, { translateY: ty }] }}>
      <Svg width={size * 0.07} height={size * 0.035} viewBox="0 0 12 4">
        <Path d="M0.5 3 Q3 0.4 6 3 Q9 0.4 11.5 3" fill="none" stroke="rgba(35,45,65,0.55)" strokeWidth="0.9" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

function BeachScene({ hour, size }: { hour: number; size: number }) {
  const phase = phaseFor(hour);
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const glowOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.5] });

  // sun/moon on an arc across the day (≈6→20h)
  const t = Math.min(1, Math.max(0, (hour - 6) / 14));
  const sunX = 44 + t * 212;
  const sunY = 118 - Math.sin(t * Math.PI) * 74;
  const isMoon = phase === 'night';
  const bodyColor = isMoon ? '#EAF0FF' : phase === 'day' ? '#FFE27A' : '#FFD08A';
  const [sky0, sky1] = SKY[phase];
  const [sea0, sea1] = SEA[phase];
  const sand = SAND[phase];
  const sunTop = (sunY / VB_H) * 100;
  const sunLeft = (sunX / VB_W) * 100;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* soft sun/moon glow — animated wrapper behind the SVG body */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: `${sunTop}%`, left: `${sunLeft}%`, width: size * 0.34, height: size * 0.34, marginLeft: -size * 0.17, marginTop: -size * 0.17, borderRadius: size * 0.17, backgroundColor: bodyColor, opacity: glowOp, transform: [{ scale: glowScale }] }} />
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LG id="sky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={sky0} /><Stop offset="1" stopColor={sky1} /></LG>
          <LG id="sea" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={sea0} /><Stop offset="1" stopColor={sea1} /></LG>
        </Defs>
        <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#sky)" />
        {/* stars at night */}
        {isMoon && [[40, 30], [90, 55], [150, 26], [210, 44], [260, 32], [180, 70]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={1.4} fill="#FFFFFF" opacity={0.8} />
        ))}
        {/* sun / moon */}
        <Circle cx={sunX} cy={sunY} r={17} fill={bodyColor} />
        {isMoon && <Circle cx={sunX + 6} cy={sunY - 4} r={14} fill={sky0} opacity={0.9} />}
        {/* sea */}
        <Rect x="0" y="150" width={VB_W} height="62" fill="url(#sea)" />
        {/* horizon line */}
        <Rect x="0" y="150" width={VB_W} height="1.5" fill="#FFFFFF" opacity={0.18} />
        {/* sand foreground (gentle curve) */}
        <Path d={`M0 206 Q150 192 300 206 L300 ${VB_H} L0 ${VB_H} Z`} fill={sand} />
        <Path d="M0 206 Q150 192 300 206" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity={0.2} />
        {/* palm — tapered banded trunk + a full drooping crown, right side */}
        <G>
          <Path d="M250 216 Q246 168 258 122 L269 124 Q260 168 261 216 Z" fill="#7A5230" />
          <Path d="M250 216 Q246 168 258 122" fill="none" stroke="#8C6238" strokeWidth="1.6" opacity={0.55} />
          <Path d="M252 204 Q256 206 259 203 M252 186 Q257 188 260 185 M253 166 Q258 167 261 164 M255 146 Q260 147 263 144 M257 130 Q261 131 264 128" fill="none" stroke="#5E3E22" strokeWidth="1.5" opacity={0.6} />
          {/* crown lowered ~9px so the fronds meet the trunk top instead of floating above it */}
          <G transform="translate(0 9)">
            {/* coconuts under the crown */}
            <Circle cx={258} cy={126} r={4} fill="#6E4B2A" /><Circle cx={268} cy={128} r={4} fill="#5E3E22" /><Circle cx={263} cy={131} r={3.6} fill="#6E4B2A" />
            {/* fronds: arc up then droop, back (dark) → front (light) */}
            <Path d="M262 116 Q222 96 194 130 Q236 120 262 116 Z" fill="#2A6E46" />
            <Path d="M262 116 Q302 96 330 130 Q288 120 262 116 Z" fill="#2A6E46" />
            <Path d="M262 116 Q228 86 206 98 Q244 106 262 116 Z" fill="#318554" />
            <Path d="M262 116 Q296 86 318 98 Q280 106 262 116 Z" fill="#318554" />
            <Path d="M262 116 Q242 78 232 72 Q254 92 262 116 Z" fill="#3B9A63" />
            <Path d="M262 116 Q282 78 292 72 Q270 92 262 116 Z" fill="#3B9A63" />
            <Path d="M262 116 Q261 80 266 68 Q270 90 262 116 Z" fill="#46AC6F" />
            {/* leaf ribs */}
            <Path d="M262 116 Q224 104 196 128 M262 116 Q300 104 328 128 M262 116 Q230 96 208 100 M262 116 Q294 96 316 100 M262 116 Q244 88 233 73 M262 116 Q280 88 291 73 M262 116 Q262 92 265 69" fill="none" stroke="#1F5A38" strokeWidth="0.9" opacity={0.45} />
            <Circle cx={262} cy={116} r={3.5} fill="#26623E" />
          </G>
        </G>
      </Svg>
      {/* animated overlays */}
      <Shimmer y={166} w={size} delay={0} dur={2800} opacity={0.5} />
      <Shimmer y={182} w={size} delay={900} dur={3400} opacity={0.35} />
      {!isMoon && <><Bird startPct={16} top={20} dur={9000} size={size} /><Bird startPct={30} top={26} dur={11000} size={size} /></>}
    </View>
  );
}

// A small element that drifts across (clouds, rockets, candies, shooting stars).
function Drift({ children, top, fromPct, dist, dur, delay = 0, fade }: { children: React.ReactNode; top: number; fromPct: number; dist: number; dur: number; delay?: number; fade?: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(a, { toValue: 1, duration: dur, delay, easing: Easing.linear, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, []);
  const tx = a.interpolate({ inputRange: [0, 1], outputRange: [0, dist] });
  const op = fade ? a.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 1, 1, 0] }) : (1 as any);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top: `${top}%`, left: `${fromPct}%`, opacity: op, transform: [{ translateX: tx }] }}>{children}</Animated.View>;
}
// A twinkling dot (star / candy sparkle).
function Twinkle({ top, left, s, color = '#FFFFFF', dur = 1800, delay = 0 }: { top: number; left: number; s: number; color?: string; dur?: number; delay?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: dur, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, []);
  const op = a.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top: `${top}%`, left: `${left}%`, width: s, height: s, borderRadius: s / 2, backgroundColor: color, opacity: op }} />;
}

function NightScene({ size }: { size: number }) {
  const stars: [number, number][] = [[30, 28], [70, 52], [112, 22], [150, 62], [190, 34], [232, 56], [266, 26], [252, 84], [90, 92], [170, 100], [44, 70], [200, 78]];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LG id="nsky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#101C48" /><Stop offset="1" stopColor="#070B22" /></LG>
          <LG id="nhill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#1A2C4E" /><Stop offset="1" stopColor="#0C1730" /></LG>
        </Defs>
        <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#nsky)" />
        {stars.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.1} fill="#FFFFFF" opacity={0.85} />)}
        <Circle cx={228} cy={54} r={27} fill="#FBF4D8" opacity={0.22} />
        <Circle cx={228} cy={54} r={20} fill="#FBF4D8" />
        <Circle cx={237} cy={48} r={16} fill="#0C1638" opacity={0.92} />
        <Path d={`M0 196 Q80 166 160 192 Q232 214 300 188 L300 ${VB_H} L0 ${VB_H} Z`} fill="url(#nhill)" />
        <Path d={`M0 216 Q120 198 300 218 L300 ${VB_H} L0 ${VB_H} Z`} fill="#0A1428" />
      </Svg>
      <Twinkle top={11} left={12} s={size * 0.012} dur={1500} />
      <Twinkle top={22} left={56} s={size * 0.012} dur={2100} delay={600} />
      <Twinkle top={14} left={82} s={size * 0.012} dur={1800} delay={300} />
      {/* shooting star */}
      <Drift top={12} fromPct={-10} dist={size * 1.15} dur={4200} delay={2600} fade>
        <View style={{ width: size * 0.16, height: 2, borderRadius: 2, backgroundColor: '#FFFFFF', transform: [{ rotate: '18deg' }] }} />
      </Drift>
    </View>
  );
}

function MeadowScene({ hour, size }: { hour: number; size: number }) {
  const phase = phaseFor(hour);
  const [sky0, sky1] = SKY[phase];
  const t = Math.min(1, Math.max(0, (hour - 6) / 14));
  const sunX = 44 + t * 212, sunY = 108 - Math.sin(t * Math.PI) * 70;
  const isMoon = phase === 'night';
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LG id="msky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={sky0} /><Stop offset="1" stopColor={sky1} /></LG>
          <LG id="mhill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#57A85C" /><Stop offset="1" stopColor="#2E6E3A" /></LG>
        </Defs>
        <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#msky)" />
        {isMoon && [[50, 34], [140, 26], [230, 40]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={1.4} fill="#fff" opacity={0.8} />)}
        <Circle cx={sunX} cy={sunY} r={16} fill={isMoon ? '#EAF0FF' : '#FFE27A'} />
        {/* rolling hills */}
        <Path d={`M0 168 Q90 138 190 166 Q250 182 300 160 L300 ${VB_H} L0 ${VB_H} Z`} fill="#6FB86E" />
        <Path d={`M0 196 Q120 168 260 194 Q285 198 300 196 L300 ${VB_H} L0 ${VB_H} Z`} fill="url(#mhill)" />
        {/* flowers on the near hill */}
        {[[40, 214], [95, 224], [150, 216], [205, 226], [262, 218]].map(([x, y], i) => (
          <G key={i}>
            <Circle cx={x} cy={y} r={3.2} fill={i % 2 ? '#F6C445' : '#F27FA6'} />
            <Circle cx={x} cy={y} r={1.3} fill="#fff" />
            <Path d={`M${x} ${y + 3} L${x} ${y + 12}`} stroke="#2E6E3A" strokeWidth="1.4" />
          </G>
        ))}
      </Svg>
      {/* drifting clouds + a butterfly */}
      <Drift top={18} fromPct={-20} dist={size * 1.4} dur={16000}>
        <View style={cloud.wrap}><View style={cloud.a} /><View style={cloud.b} /></View>
      </Drift>
      <Drift top={44} fromPct={-14} dist={size * 1.3} dur={7000} delay={1500} fade>
        <View style={{ width: size * 0.03, height: size * 0.03, borderRadius: 4, backgroundColor: '#F27FA6', opacity: 0.9 }} />
      </Drift>
    </View>
  );
}

function CandyScene({ size }: { size: number }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LG id="csky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#F5A9D0" /><Stop offset="1" stopColor="#B061A6" /></LG>
          <LG id="cgum" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#8E3D7E" /><Stop offset="1" stopColor="#5E2456" /></LG>
        </Defs>
        <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#csky)" />
        {/* candy-cane striped ground */}
        <Path d={`M0 198 Q150 184 300 198 L300 ${VB_H} L0 ${VB_H} Z`} fill="url(#cgum)" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <Path key={i} d={`M${-30 + i * 42} 198 l 26 0 l -40 52 l -26 0 Z`} fill="#F7CFE6" opacity={0.5} />
        ))}
        {/* lollipop trees */}
        {[[60, 150, '#F27FA6'], [210, 138, '#7FC8F2']].map(([x, y, c], i) => (
          <G key={i}>
            <Path d={`M${x} ${y} L${x} 206`} stroke="#EBD6E6" strokeWidth="6" strokeLinecap="round" />
            <Circle cx={x as number} cy={y as number} r={22} fill={c as string} />
            <Path d={`M${x} ${y} m -22 0 a 22 22 0 0 1 44 0`} fill="#fff" opacity={0.25} />
          </G>
        ))}
      </Svg>
      {/* floating candies rising */}
      {[[24, 5200, 0], [64, 6400, 1200], [86, 5800, 2600]].map(([left, dur, delay], i) => (
        <RiseCandy key={i} left={left} dur={dur} delay={delay} size={size} color={i % 2 ? '#7FC8F2' : '#F6C445'} />
      ))}
    </View>
  );
}
function RiseCandy({ left, dur, delay, size, color }: { left: number; dur: number; delay: number; size: number; color: string }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { const l = Animated.loop(Animated.timing(a, { toValue: 1, duration: dur, delay, easing: Easing.linear, useNativeDriver: true })); l.start(); return () => l.stop(); }, []);
  const ty = a.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.4] });
  const op = a.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.9, 0.9, 0] });
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: '18%', left: `${left}%`, width: size * 0.028, height: size * 0.028, borderRadius: 3, backgroundColor: color, opacity: op, transform: [{ translateY: ty }] }} />;
}

function SpaceScene({ size }: { size: number }) {
  const stars: [number, number][] = [[24, 30], [66, 60], [108, 24], [150, 70], [188, 40], [228, 66], [262, 30], [248, 96], [88, 104], [176, 110], [40, 84], [206, 20], [130, 44]];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LG id="ssky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#2A1C55" /><Stop offset="1" stopColor="#090620" /></LG>
        </Defs>
        <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#ssky)" />
        {/* nebula glow */}
        <Circle cx={80} cy={180} r={90} fill="#5B3AA0" opacity={0.22} />
        <Circle cx={250} cy={210} r={80} fill="#3A6AA0" opacity={0.2} />
        {stars.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 1.8 : 1} fill="#FFFFFF" opacity={0.85} />)}
        {/* ringed planet */}
        <G>
          <Circle cx={228} cy={78} r={30} fill="#C88A5A" />
          <Path d="M228 78 m -30 0 a 30 12 0 1 0 60 0 a 30 12 0 1 0 -60 0" fill="none" stroke="#EBC79A" strokeWidth="4" opacity={0.85} transform="rotate(-18 228 78)" />
          <Circle cx={218} cy={70} r={7} fill="#B0744A" opacity={0.7} />
        </G>
        {/* small moon */}
        <Circle cx={70} cy={54} r={11} fill="#AEB6C8" />
        <Circle cx={66} cy={50} r={3} fill="#8A94AA" opacity={0.7} />
      </Svg>
      <Twinkle top={16} left={40} s={size * 0.012} dur={1400} />
      <Twinkle top={30} left={72} s={size * 0.012} dur={1900} delay={500} />
      {/* rocket drifting across */}
      <Drift top={62} fromPct={-14} dist={size * 1.35} dur={9000} delay={1000}>
        <Text style={{ fontSize: size * 0.075, transform: [{ rotate: '42deg' }] }}>🚀</Text>
      </Drift>
    </View>
  );
}

const cloud = StyleSheet.create({
  wrap: { width: 46, height: 16 },
  a: { position: 'absolute', left: 0, top: 4, width: 30, height: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.85)' },
  b: { position: 'absolute', left: 16, top: 0, width: 24, height: 16, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.9)' },
});

// The FREE default backdrop (no room bought): a cosy indoor room — warm wall, wood
// floor, a window that shows the sky by time of day, a plant, a framed picture and a
// rug the cat sits on. Premium rooms are upgrades over this.
function CozyRoomScene({ hour, size }: { hour: number; size: number }) {
  const phase = phaseFor(hour);
  const isNight = phase === 'night';
  const [wsky0, wsky1] = SKY[phase];
  // Auto-seasonal: December dresses the room for Christmas; late October for Halloween.
  const now = new Date();
  const month = now.getMonth(), day = now.getDate();
  const xmas = month === 11;
  const halloween = month === 9 && day >= 24;
  const summer = month >= 5 && month <= 7; // Jun–Aug: a warm beachy vibe indoors
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LG id="cwall" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#F0E2C9" /><Stop offset="1" stopColor="#E0C7A2" /></LG>
          <LG id="cfloor" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#CDA372" /><Stop offset="1" stopColor="#B98A56" /></LG>
          <LG id="cwin" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={wsky0} /><Stop offset="1" stopColor={wsky1} /></LG>
        </Defs>
        <Rect x="0" y="0" width={VB_W} height="186" fill="url(#cwall)" />
        <Rect x="0" y="182" width={VB_W} height={VB_H - 182} fill="url(#cfloor)" />
        <Rect x="0" y="180" width={VB_W} height="6" fill="#A87C4C" />
        {[40, 120, 200, 280].map((x, i) => <Path key={i} d={`M${x} 188 L${x - 18} ${VB_H}`} stroke="#A87C4C" strokeWidth="1.4" opacity={0.4} />)}
        {/* window with sky by time of day */}
        <G>
          <Rect x="30" y="44" width="78" height="74" rx="8" fill="#8A5A32" />
          <Rect x="36" y="50" width="66" height="62" rx="5" fill="url(#cwin)" />
          {isNight
            ? <><Circle cx={84} cy={68} r={8} fill="#EAF0FF" /><Circle cx={50} cy={62} r={1.2} fill="#fff" /><Circle cx={62} cy={80} r={1.2} fill="#fff" /><Circle cx={92} cy={94} r={1.2} fill="#fff" /></>
            : <><Circle cx={54} cy={66} r={9} fill="#FFE27A" /><Ellipse cx={82} cy={88} rx={16} ry={7} fill="#FFFFFF" opacity={0.85} /></>}
          <Rect x="67" y="50" width="4" height="62" fill="#8A5A32" /><Rect x="36" y="78" width="66" height="4" fill="#8A5A32" />
          <Rect x="26" y="116" width="86" height="7" rx="2" fill="#9C6A3C" />
        </G>
        {/* framed picture */}
        <G>
          <Rect x="196" y="52" width="52" height="40" rx="4" fill="#9C6A3C" />
          <Rect x="201" y="57" width="42" height="30" rx="2" fill="#BFE3F0" />
          <Path d="M201 87 L214 72 L224 82 L234 68 L243 87 Z" fill="#6FB86E" />
          <Circle cx={236} cy={64} r={3} fill="#FFE27A" />
        </G>
        {/* potted plant */}
        <G>
          <Path d="M256 168 Q250 140 242 132 Q254 146 256 168" fill="#4FA06A" />
          <Path d="M256 168 Q266 142 280 138 Q268 152 256 168" fill="#4FA06A" />
          <Path d="M250 170 L262 170 Q266 150 258 138 Q256 156 250 170" fill="#3E8A58" />
          <Path d="M244 182 L272 182 L268 204 L248 204 Z" fill="#C86E4A" />
          <Rect x="242" y="178" width="32" height="7" rx="2" fill="#B45C3A" />
        </G>
        {/* rug the cat sits on */}
        <Ellipse cx={150} cy={224} rx={96} ry={20} fill="#D98C6A" opacity={0.9} />
        <Ellipse cx={150} cy={224} rx={72} ry={13} fill="none" stroke="#F0C6A6" strokeWidth={3} opacity={0.7} />
        {/* ── Grudzień: choinka + girlanda światełek ── */}
        {xmas && (
          <G>
            <Path d="M6 26 Q78 40 150 26 Q222 40 294 26" fill="none" stroke="#6B4A2A" strokeWidth={1.4} opacity={0.55} />
            {[20, 55, 90, 125, 160, 195, 230, 265].map((x, i) => (
              <Circle key={i} cx={x} cy={i % 2 ? 34 : 30} r={2.3} fill={['#E8564B', '#F6D43D', '#4FB06A', '#6AC8FF'][i % 4]} />
            ))}
            <Path d="M150 150 L132 178 L168 178 Z" fill="#2E6E45" />
            <Path d="M150 164 L128 196 L172 196 Z" fill="#357C4F" />
            <Path d="M150 180 L124 210 L176 210 Z" fill="#3E8A58" />
            <Rect x={146} y={210} width={8} height={9} fill="#7A4A22" />
            <Path d="M150 145 l2.2 5 l5.4 0.8 l-4 3.6 l1 5.4 l-4.6 -2.6 l-4.6 2.6 l1 -5.4 l-4 -3.6 l5.4 -0.8 z" fill="#FBE38A" />
            {[[140, 186, '#E8564B'], [161, 190, '#F6D43D'], [133, 205, '#6AC8FF'], [167, 205, '#F27FA6'], [150, 197, '#E8564B']].map(([x, y, col], i) => (
              <Circle key={i} cx={x as number} cy={y as number} r={2.6} fill={col as string} />
            ))}
          </G>
        )}
        {/* ── Lato: promień słońca przez okno + piłka plażowa ── */}
        {summer && (
          <G>
            <Path d="M40 118 L98 118 L168 250 L78 250 Z" fill="#FFE9A8" opacity={0.16} />
            <G>
              <Circle cx={196} cy={230} r={12} fill="#FFFFFF" />
              <Path d="M196 218 Q207 230 196 242" fill="none" stroke="#E8564B" strokeWidth={3} />
              <Path d="M196 218 Q185 230 196 242" fill="none" stroke="#4C86E0" strokeWidth={3} />
              <Path d="M184 230 L208 230" stroke="#F6D43D" strokeWidth={2.6} />
              <Circle cx={196} cy={230} r={12} fill="none" stroke="#DADADA" strokeWidth={0.8} />
              <Circle cx={192} cy={226} r={2.4} fill="#FFFFFF" opacity={0.7} />
            </G>
          </G>
        )}
        {/* ── Halloween: dynia ── */}
        {halloween && (
          <G>
            <Path d="M66 224 Q60 218 66 214" fill="none" stroke="#3E8A58" strokeWidth={2} />
            <Ellipse cx={72} cy={230} rx={13} ry={11} fill="#E8863B" />
            <Ellipse cx={66} cy={230} rx={5} ry={11} fill="#D2732E" opacity={0.5} />
            <Path d="M65 227 l3 4 l3 -4 Z M73 227 l3 4 l3 -4 Z" fill="#3A2410" />
            <Path d="M66 235 q6 5 12 0" fill="none" stroke="#3A2410" strokeWidth={1.6} />
          </G>
        )}
      </Svg>
      {isNight && <View pointerEvents="none" style={{ position: 'absolute', top: '4%', left: '40%', width: '28%', height: '26%', borderRadius: 999, backgroundColor: '#FFDD99', opacity: 0.14 }} />}
      {xmas && <Snow size={size} />}
    </View>
  );
}

// ── Zima: falling snow ──
function Flake({ left, s, dur, delay }: { left: number; s: number; dur: number; delay: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { const l = Animated.loop(Animated.timing(a, { toValue: 1, duration: dur, delay, easing: Easing.linear, useNativeDriver: true })); l.start(); return () => l.stop(); }, []);
  const ty = a.interpolate({ inputRange: [0, 1], outputRange: [-12, 250] });
  const tx = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, s * 2.5, 0] });
  const op = a.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.95, 0.95, 0] });
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: `${left}%`, width: s, height: s, borderRadius: s / 2, backgroundColor: '#FFFFFF', opacity: op, transform: [{ translateY: ty }, { translateX: tx }] }} />;
}
function Snow({ size }: { size: number }) {
  const flakes: [number, number, number, number][] = [[8, 3, 7000, 0], [24, 2.2, 9000, 1200], [40, 3.4, 8000, 600], [55, 2.6, 10500, 2100], [70, 3, 7600, 3000], [86, 2.2, 9500, 1500], [94, 2.8, 8200, 4200]];
  return <>{flakes.map(([l, sc, d, dl], i) => <Flake key={i} left={l} s={size * 0.011 * sc} dur={d} delay={dl} />)}</>;
}
// One snow-tipped pine at (x, baseY).
function Pine({ x, baseY, scale = 1 }: { x: number; baseY: number; scale?: number }) {
  const h = 20 * scale, w = 18 * scale;
  return (
    <G>
      <Path d={`M${x - 2} ${baseY} h4 v6 h-4 Z`} fill="#5A3A1E" />
      <Path d={`M${x} ${baseY - h * 2.0} L${x - w} ${baseY} L${x + w} ${baseY} Z`} fill="#2E6E45" />
      <Path d={`M${x} ${baseY - h * 2.7} L${x - w * 0.8} ${baseY - h * 0.9} L${x + w * 0.8} ${baseY - h * 0.9} Z`} fill="#357C4F" />
      <Path d={`M${x} ${baseY - h * 3.3} L${x - w * 0.55} ${baseY - h * 1.8} L${x + w * 0.55} ${baseY - h * 1.8} Z`} fill="#3E8A58" />
      <Path d={`M${x} ${baseY - h * 3.3} L${x - w * 0.24} ${baseY - h * 2.65} L${x + w * 0.24} ${baseY - h * 2.65} Z`} fill="#FFFFFF" opacity={0.9} />
    </G>
  );
}
function WinterScene({ hour, size }: { hour: number; size: number }) {
  const phase = phaseFor(hour);
  const isNight = phase === 'night';
  const [sky0, sky1] = isNight ? ['#16224A', '#0A1030'] : phase === 'dusk' ? ['#C98BA0', '#7E7BA8'] : ['#AED4E6', '#E8F4FA'];
  const stars: [number, number][] = [[40, 30], [90, 46], [150, 24], [210, 40], [258, 30], [120, 58]];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Defs><LG id="wsky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={sky0} /><Stop offset="1" stopColor={sky1} /></LG></Defs>
        <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#wsky)" />
        {isNight && stars.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={i % 2 ? 1.1 : 1.7} fill="#FFFFFF" opacity={0.85} />)}
        {isNight
          ? <><Circle cx={232} cy={52} r={18} fill="#EAF0FF" /><Circle cx={239} cy={47} r={14} fill={sky0} opacity={0.9} /></>
          : <Circle cx={232} cy={52} r={16} fill="#FFF3C4" />}
        <Path d={`M0 176 Q90 150 180 172 Q240 184 300 166 L300 ${VB_H} L0 ${VB_H} Z`} fill="#E9F2F7" />
        <Path d={`M0 200 Q120 182 300 202 L300 ${VB_H} L0 ${VB_H} Z`} fill="#FBFDFE" />
        <Pine x={58} baseY={196} scale={1} />
        <Pine x={96} baseY={202} scale={0.72} />
        <Pine x={255} baseY={194} scale={1.05} />
      </Svg>
      <Snow size={size} />
    </View>
  );
}

// ── Podwodny świat ──
function RiseBubble({ left, dur, delay, size }: { left: number; dur: number; delay: number; size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { const l = Animated.loop(Animated.timing(a, { toValue: 1, duration: dur, delay, easing: Easing.linear, useNativeDriver: true })); l.start(); return () => l.stop(); }, []);
  const ty = a.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.62] });
  const op = a.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.6, 0.6, 0] });
  const d = Math.max(3, size * 0.02);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: '10%', left: `${left}%`, width: d, height: d, borderRadius: d, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', opacity: op, transform: [{ translateY: ty }] }} />;
}
function FishSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size * 0.11} height={size * 0.06} viewBox="0 0 22 12">
      <Path d="M2 6 Q9 0 16 6 Q9 12 2 6 Z" fill={color} />
      <Path d="M16 6 L22 2 L22 10 Z" fill={color} />
      <Circle cx={6} cy={6} r={1} fill="#0A2A3E" />
    </Svg>
  );
}
function OceanScene({ size }: { size: number }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Defs><LG id="osea" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#2E86A8" /><Stop offset="1" stopColor="#0A2436" /></LG></Defs>
        <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#osea)" />
        {/* light rays from the surface */}
        <Path d="M40 0 L70 0 L150 250 L90 250 Z" fill="#FFFFFF" opacity={0.06} />
        <Path d="M150 0 L172 0 L210 250 L168 250 Z" fill="#FFFFFF" opacity={0.05} />
        {/* seabed */}
        <Path d={`M0 214 Q80 200 160 212 Q240 222 300 208 L300 ${VB_H} L0 ${VB_H} Z`} fill="#C9B68A" />
        <Path d="M0 214 Q80 200 160 212 Q240 222 300 208" fill="none" stroke="#EADFC0" strokeWidth="1.4" opacity={0.4} />
        {/* seaweed */}
        <Path d="M60 214 Q52 196 62 182 Q54 170 64 156" fill="none" stroke="#2E8B57" strokeWidth="5" strokeLinecap="round" />
        <Path d="M72 214 Q80 198 71 186 Q79 176 70 164" fill="none" stroke="#3AA06A" strokeWidth="4" strokeLinecap="round" />
        {/* coral */}
        <Path d="M228 214 Q224 198 232 196 Q226 190 236 188 Q246 192 240 200 Q248 202 244 214 Z" fill="#E06A8B" opacity={0.9} />
        <Circle cx={214} cy={210} r={5} fill="#F2A65A" opacity={0.85} />
      </Svg>
      {[[20, 6000, 0], [46, 7200, 1500], [78, 6600, 2800]].map(([l, d, dl], i) => <RiseBubble key={i} left={l} dur={d} delay={dl} size={size} />)}
      <Drift top={40} fromPct={-14} dist={size * 1.3} dur={12000} delay={800}><FishSvg size={size} color="#F4B23E" /></Drift>
    </View>
  );
}

// A gentle vertical bob (for a boat rocking on the sea).
function Bob({ children, amp = 3, dur = 2800 }: { children: React.ReactNode; amp?: number; dur?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, []);
  const ty = a.interpolate({ inputRange: [0, 1], outputRange: [-amp, amp] });
  return <Animated.View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, transform: [{ translateY: ty }] }}>{children}</Animated.View>;
}

// A full-scene SVG overlay sharing the room's coordinate system, so add-on vector
// art lines up with the scene underneath.
function SceneSvg({ children }: { children: React.ReactNode }) {
  return <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>{children}</Svg>;
}

// Buyable per-room extras (ship, lighthouse, satellite…) drawn on top of the scene.
function AddonLayer({ addons, size }: { addons: string[]; size: number }) {
  if (!addons.length) return null;
  const has = (id: string) => addons.includes(id);
  return (
    <>
      {/* ── Plaża ── */}
      {has('beach_ship') && (
        <Bob amp={2.4} dur={3000}>
          <SceneSvg>
            <G>
              <Path d="M80 176 L120 176 L112 187 L88 187 Z" fill="#8A5A32" />
              <Path d="M80 176 L120 176 L118 179 L82 179 Z" fill="#6E4B2A" />
              <Path d="M100 150 L100 176" stroke="#5A3A1E" strokeWidth="1.6" />
              <Path d="M100 151 L100 174 L84 172 Z" fill="#FFFFFF" opacity={0.95} />
              <Path d="M102 152 L102 172 L116 170 Z" fill="#F4C6D6" />
            </G>
          </SceneSvg>
        </Bob>
      )}
      {has('beach_lighthouse') && (
        <SceneSvg>
          <G>
            <Path d="M24 206 L29 150 L41 150 L46 206 Z" fill="#F2ECE4" />
            <Path d="M27 168 L43 168 L44 178 L26 178 Z" fill="#E4534B" opacity={0.9} />
            <Path d="M28.5 150 L41.5 150 L40 138 L30 138 Z" fill="#33415A" />
            <Circle cx={35} cy={132} r={7} fill="#FBE38A" />
            <Circle cx={35} cy={132} r={3.4} fill="#FFF6D6" />
          </G>
        </SceneSvg>
      )}
      {has('beach_gulls') && (<><Bird startPct={52} top={30} dur={10000} size={size} /><Bird startPct={66} top={22} dur={12500} size={size} /></>)}

      {/* ── Noc ── */}
      {has('night_shooting') && (
        <>
          <Drift top={20} fromPct={-12} dist={size * 1.2} dur={3600} delay={800} fade>
            <View style={{ width: size * 0.14, height: 2, borderRadius: 2, backgroundColor: '#FFFFFF', transform: [{ rotate: '20deg' }] }} />
          </Drift>
          <Drift top={30} fromPct={-12} dist={size * 1.25} dur={4600} delay={3400} fade>
            <View style={{ width: size * 0.1, height: 2, borderRadius: 2, backgroundColor: '#CFE0FF', transform: [{ rotate: '16deg' }] }} />
          </Drift>
        </>
      )}
      {has('night_owl') && (
        <SceneSvg>
          <G>
            <Path d="M204 214 Q204 193 214 193 Q224 193 224 214 Z" fill="#0A1220" />
            <Path d="M206 196 L203 189 L210 194 Z" fill="#0A1220" />
            <Path d="M222 196 L225 189 L218 194 Z" fill="#0A1220" />
            <Circle cx={210} cy={202} r={2.4} fill="#FBE38A" />
            <Circle cx={218} cy={202} r={2.4} fill="#FBE38A" />
            <Circle cx={210} cy={202} r={1} fill="#0A1220" />
            <Circle cx={218} cy={202} r={1} fill="#0A1220" />
          </G>
        </SceneSvg>
      )}

      {/* ── Łąka ── */}
      {has('meadow_rainbow') && (
        <SceneSvg>
          <G opacity={0.75}>
            {([['#E8564B', 92], ['#F2A03D', 84], ['#F6D43D', 76], ['#4FB06A', 68], ['#4C86E0', 60]] as [string, number][]).map(([col, r], i) => (
              <Path key={i} d={`M${150 - r} 150 A ${r} ${r} 0 0 1 ${150 + r} 150`} fill="none" stroke={col} strokeWidth={4} strokeLinecap="round" />
            ))}
          </G>
        </SceneSvg>
      )}
      {has('meadow_balloon') && (
        <Drift top={18} fromPct={-16} dist={size * 1.3} dur={15000} delay={500}>
          <Text style={{ fontSize: size * 0.09 }}>🎈</Text>
        </Drift>
      )}

      {/* ── Cukierkowo ── */}
      {has('candy_extra') && (
        <SceneSvg>
          <G>
            <Path d="M135 158 L135 202" stroke="#EBD6E6" strokeWidth={6} strokeLinecap="round" />
            <Circle cx={135} cy={158} r={18} fill="#8FD98A" />
            <Path d="M135 158 m -18 0 a 18 18 0 0 1 36 0" fill="#FFFFFF" opacity={0.25} />
          </G>
        </SceneSvg>
      )}
      {has('candy_cupcake') && (
        <Text style={{ position: 'absolute', bottom: '14%', left: '8%', fontSize: size * 0.1 }}>🧁</Text>
      )}

      {/* ── Kosmos ── */}
      {has('space_planet2') && (
        <SceneSvg>
          <G>
            <Circle cx={96} cy={150} r={18} fill="#6E7BC8" />
            <Path d="M96 150 m -18 0 a 18 7 0 1 0 36 0 a 18 7 0 1 0 -36 0" fill="none" stroke="#B7C0EA" strokeWidth={2.6} opacity={0.85} transform="rotate(-14 96 150)" />
            <Circle cx={90} cy={144} r={4} fill="#5763A8" opacity={0.7} />
          </G>
        </SceneSvg>
      )}
      {has('space_satellite') && (
        <Drift top={30} fromPct={-14} dist={size * 1.3} dur={11000} delay={600}>
          <Text style={{ fontSize: size * 0.06 }}>🛰️</Text>
        </Drift>
      )}
      {has('space_ufo') && (
        <Drift top={44} fromPct={-16} dist={size * 1.35} dur={8000} delay={2000}>
          <Text style={{ fontSize: size * 0.075 }}>🛸</Text>
        </Drift>
      )}

      {/* ── Zima ── */}
      {has('winter_snowman') && (
        <SceneSvg>
          <G>
            <Circle cx={205} cy={206} r={11} fill="#FFFFFF" />
            <Circle cx={205} cy={190} r={8} fill="#FFFFFF" />
            <Circle cx={205} cy={177} r={6} fill="#FFFFFF" />
            <Circle cx={203} cy={176} r={0.9} fill="#1A1A1A" /><Circle cx={207} cy={176} r={0.9} fill="#1A1A1A" />
            <Path d="M205 178 L211 179 L205 180 Z" fill="#E8863B" />
            <Circle cx={205} cy={188} r={0.9} fill="#1A1A1A" /><Circle cx={205} cy={192} r={0.9} fill="#1A1A1A" />
          </G>
        </SceneSvg>
      )}
      {has('winter_igloo') && (
        <SceneSvg>
          <G>
            <Path d="M28 204 A 26 20 0 0 1 80 204 Z" fill="#DCE8F0" />
            <Path d="M46 204 L46 191 A 8 11 0 0 1 62 191 L62 204 Z" fill="#9DB4C8" />
            <Path d="M35 190 L44 187" stroke="#B9CCDC" strokeWidth="1" />
            <Path d="M64 187 L73 190" stroke="#B9CCDC" strokeWidth="1" />
          </G>
        </SceneSvg>
      )}
      {has('winter_aurora') && (
        <SceneSvg>
          <G fill="none" strokeLinecap="round">
            <Path d="M-10 60 Q80 30 160 55 Q240 78 320 48" stroke="#4FE0A8" strokeWidth={10} opacity={0.18} />
            <Path d="M-10 78 Q80 50 160 74 Q240 96 320 66" stroke="#6AC8FF" strokeWidth={8} opacity={0.16} />
            <Path d="M-10 96 Q90 72 170 92 Q250 110 320 86" stroke="#B98BFF" strokeWidth={7} opacity={0.14} />
          </G>
        </SceneSvg>
      )}

      {/* ── Podwodny świat ── */}
      {has('ocean_fish') && (
        <>
          <Drift top={26} fromPct={-14} dist={size * 1.3} dur={9000} delay={300}><FishSvg size={size} color="#5AC8E0" /></Drift>
          <Drift top={54} fromPct={-16} dist={size * 1.35} dur={13000} delay={2400}><FishSvg size={size} color="#F27FA6" /></Drift>
          <Drift top={68} fromPct={-12} dist={size * 1.25} dur={10500} delay={4200}><FishSvg size={size} color="#F4D03F" /></Drift>
        </>
      )}
      {has('ocean_chest') && (
        <SceneSvg>
          <G>
            <Rect x={140} y={198} width={30} height={14} rx={2} fill="#7A4A22" />
            <Path d="M140 198 Q155 188 170 198 Z" fill="#8A5A2E" />
            <Rect x={140} y={202} width={30} height={2.4} fill="#E7B84B" />
            <Circle cx={155} cy={205} r={2} fill="#E7B84B" />
            <Circle cx={150} cy={195} r={1.4} fill="#FBE38A" opacity={0.9} /><Circle cx={162} cy={194} r={1.2} fill="#FBE38A" opacity={0.9} />
          </G>
        </SceneSvg>
      )}
      {has('ocean_sub') && (
        <Drift top={34} fromPct={-18} dist={size * 1.4} dur={12000} delay={1200}>
          <Svg width={size * 0.16} height={size * 0.09} viewBox="0 0 40 22">
            <Path d="M9 11 L9 5" stroke="#F4C430" strokeWidth={1.6} /><Circle cx={9} cy={4} r={2} fill="#F4C430" />
            <Path d="M6 13 Q6 6 20 6 L30 6 Q40 6 40 13 Q40 20 30 20 L20 20 Q6 20 6 13 Z" fill="#F4C430" />
            <Circle cx={20} cy={13} r={3.4} fill="#BFEAF5" />
            <Circle cx={30} cy={13} r={2.6} fill="#BFEAF5" />
          </Svg>
        </Drift>
      )}

      {/* ── Dom (darmowy pokój) ── */}
      {has('home_bed') && (
        <SceneSvg>
          <G>
            <Ellipse cx={92} cy={230} rx={46} ry={15} fill="#7FA8CE" />
            <Ellipse cx={92} cy={226} rx={38} ry={11} fill="#A7C6E4" />
            <Path d="M54 228 Q54 214 70 214 L114 214 Q130 214 130 228" fill="none" stroke="#6C93B8" strokeWidth={6} strokeLinecap="round" />
          </G>
        </SceneSvg>
      )}
      {has('home_bowl') && (
        <SceneSvg>
          <G>
            <Path d="M198 229 Q212 241 226 229 Z" fill="#E06A4A" />
            <Ellipse cx={212} cy={228} rx={15} ry={4} fill="#C85838" />
            <Ellipse cx={212} cy={227} rx={10} ry={2.6} fill="#E8B24A" />
          </G>
        </SceneSvg>
      )}
      {has('home_scratch') && (
        <SceneSvg>
          <G>
            <Rect x={266} y={150} width={12} height={58} rx={3} fill="#C9A06A" />
            <Ellipse cx={272} cy={208} rx={22} ry={7} fill="#8A5A32" />
            <Circle cx={272} cy={146} r={7} fill="#E06A8B" />
          </G>
        </SceneSvg>
      )}
      {has('home_clock') && (
        <SceneSvg>
          <G>
            <Circle cx={150} cy={54} r={16} fill="#F2ECE4" stroke="#9C6A3C" strokeWidth={3} />
            <Path d="M150 54 L150 44 M150 54 L158 58" stroke="#3B3C4E" strokeWidth={2} strokeLinecap="round" />
            <Circle cx={150} cy={54} r={1.6} fill="#3B3C4E" />
          </G>
        </SceneSvg>
      )}
      {has('home_toy') && (
        <Drift top={80} fromPct={-8} dist={size * 1.15} dur={9000} delay={500}>
          <Svg width={size * 0.05} height={size * 0.05} viewBox="0 0 14 14">
            <Circle cx={7} cy={7} r={6} fill="#E88AAE" />
            <Path d="M2 7 Q7 3 12 7 M7 1 Q3 7 7 13 M3 3 Q10 6 11 11" stroke="#C85E86" strokeWidth={0.8} fill="none" />
          </Svg>
        </Drift>
      )}
    </>
  );
}

export default function PetScene({ room, addons = [], size = 290 }: { room?: string; colors?: [string, string]; addons?: string[]; size?: number }) {
  const hour = new Date().getHours();
  const scene = (() => {
    switch (room) {
      case 'room_beach':  return <BeachScene hour={hour} size={size} />;
      case 'room_night':  return <NightScene size={size} />;
      case 'room_meadow': return <MeadowScene hour={hour} size={size} />;
      case 'room_candy':  return <CandyScene size={size} />;
      case 'room_space':  return <SpaceScene size={size} />;
      case 'room_winter': return <WinterScene hour={hour} size={size} />;
      case 'room_ocean':  return <OceanScene size={size} />;
      default:            return <CozyRoomScene hour={hour} size={size} />;
    }
  })();
  return (
    <View style={StyleSheet.absoluteFill}>
      {scene}
      <AddonLayer addons={addons} size={size} />
    </View>
  );
}
