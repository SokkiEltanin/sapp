import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
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

export default function PetScene({ room, colors, size = 290 }: { room?: string; colors?: [string, string]; size?: number }) {
  const hour = new Date().getHours();
  if (room === 'room_beach') return <BeachScene hour={hour} size={size} />;
  return <GenericScene hour={hour} colors={colors} />;
}
