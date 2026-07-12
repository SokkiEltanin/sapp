import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';
import Svg, { Defs, LinearGradient as LG, Stop, Rect, Circle, Path, G } from 'react-native-svg';

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
        {/* palm — trunk + fronds, right side */}
        <G>
          <Path d="M256 214 Q250 168 262 120" fill="none" stroke="#6E4B2A" strokeWidth="7" strokeLinecap="round" />
          <Path d="M262 120 Q232 104 208 112 Q234 108 262 120" fill="#2E7D4F" />
          <Path d="M262 120 Q292 104 300 118 Q286 108 262 120" fill="#2E7D4F" />
          <Path d="M262 120 Q252 92 234 82 Q256 96 262 120" fill="#33885A" />
          <Path d="M262 120 Q276 92 296 88 Q278 100 262 120" fill="#33885A" />
          <Path d="M262 120 Q262 100 262 84 Q268 100 262 120" fill="#3B9A65" />
          <Circle cx={262} cy={120} r={4.5} fill="#5A3A1E" />
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

// Generic time-of-day scene for the non-beach rooms until they get their own art:
// a proper sky gradient + sun/moon + a coloured ground band, themed by the room's
// palette. Much less "emoji on a flat fill" than before.
function GenericScene({ hour, colors }: { hour: number; colors?: [string, string]; }) {
  const phase = phaseFor(hour);
  const [sky0, sky1] = colors ?? SKY[phase];
  const t = Math.min(1, Math.max(0, (hour - 6) / 14));
  const sunX = 44 + t * 212;
  const sunY = 130 - Math.sin(t * Math.PI) * 80;
  const isMoon = phase === 'night';
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
      <Defs><LG id="gsky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={sky0} /><Stop offset="1" stopColor={sky1} /></LG></Defs>
      <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#gsky)" />
      {isMoon && [[50, 34], [120, 50], [200, 30], [250, 52]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={1.4} fill="#fff" opacity={0.8} />)}
      <Circle cx={sunX} cy={sunY} r={16} fill={isMoon ? '#EAF0FF' : '#FFE27A'} opacity={0.92} />
      <Path d={`M0 200 Q150 188 300 200 L300 ${VB_H} L0 ${VB_H} Z`} fill="rgba(0,0,0,0.22)" />
    </Svg>
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
    </>
  );
}

export default function PetScene({ room, colors, addons = [], size = 290 }: { room?: string; colors?: [string, string]; addons?: string[]; size?: number }) {
  const hour = new Date().getHours();
  const scene = (() => {
    switch (room) {
      case 'room_beach':  return <BeachScene hour={hour} size={size} />;
      case 'room_night':  return <NightScene size={size} />;
      case 'room_meadow': return <MeadowScene hour={hour} size={size} />;
      case 'room_candy':  return <CandyScene size={size} />;
      case 'room_space':  return <SpaceScene size={size} />;
      default:            return <GenericScene hour={hour} colors={colors} />;
    }
  })();
  return (
    <View style={StyleSheet.absoluteFill}>
      {scene}
      <AddonLayer addons={addons} size={size} />
    </View>
  );
}
