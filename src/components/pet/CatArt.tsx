import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View, StyleSheet, Text, Vibration } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { PetExpression } from '@/utils/petState';
import { haptic } from '@/utils/haptics';
import { HeldArt } from '@/components/pet/BlobItems';
import CatAccessories from '@/components/pet/CatAccessories';

// The companion cat — a faithful 1:1 port of the user's own Affinity drawing
// (pupildoapki.svg), kept in named layers so it can be animated: gentle breathing
// + sway + blink + a springy hop on tap. Mood is carried by the mouth + closed
// eyes / tear / zzz, keeping the cat's blue identity.

const BLUE = '#A7CCF5';
const INK = '#3B3C4E';

// Emoji that float up when you tap the cat — mood-aware so a happy cat throws hearts
// and a sad one gets a comforting one. (Pet stickers/emoji are an intentional design
// piece, unlike the rest of the UI.)
const REACTIONS: Record<string, string[]> = {
  happy:    ['❤️', '💛', '✨', '♪', '😻'],
  content:  ['❤️', '✨', '♪', '🐾'],
  meh:      ['🐾', '❔', '♪'],
  sad:      ['🤍', '🥺', '❤️'],
  sick:     ['💧', '🤒', '🤍'],
  sleeping: ['💤', '😴', '💤'],
};

// One floating reaction emoji: rises, scales in, fades out. Overlay View (not SVG),
// so it never touches the janky SVG-prop animation path.
function Particle({ emoji, dx, size }: { emoji: string; dx: number; size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 1050, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []);
  const y  = a.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.6] });
  const op = a.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const sc = a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 0.9] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: size * 0.5 + dx, top: size * 0.28, opacity: op, transform: [{ translateY: y }, { scale: sc }] }}>
      <Text style={{ fontSize: size * 0.15 }}>{emoji}</Text>
    </Animated.View>
  );
}

// eye centres (in the 2000×2000 viewBox) for the closed-eye / blink arcs
const LX = 794, RX = 1107, EYY = 762;

function mouthFor(expr: PetExpression): React.ReactNode {
  // frown — control point ABOVE the corners so it curves ∩ (was a ∪ smile = bug)
  if (expr === 'sad') return <Path d="M918 916 Q985 884 1052 916" fill="none" stroke={INK} strokeWidth={15} strokeLinecap="round" />;
  if (expr === 'meh') return <Path d="M925 905 H1045" fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />;
  // queasy wavy mouth for sick (no longer a smile)
  if (expr === 'sick') return <Path d="M918 905 q22 -20 44 0 t44 0" fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />;
  if (expr === 'sleeping') return <Path d="M955 902 Q985 916 1015 902" fill="none" stroke={INK} strokeWidth={12} strokeLinecap="round" />;
  // happy / content → the user's original two-stroke smile
  return (
    <G id="mouth">
      <G transform="matrix(1,0,0,1.31158,57.033642,-397.041139)">
        <Path d="M893.229,971.7C895.371,980.267 906.949,1005.466 927.454,1012.301C933.741,1014.396 961.23,1020.803 973.759,1008.274" fill="none" stroke={INK} strokeWidth={10.72} strokeLinecap="round" />
      </G>
      <G transform="matrix(0.705861,-0.925793,0.605592,0.794283,-347.53569,978.25465)">
        <Path d="M893.229,971.7C895.371,980.267 906.949,1005.466 927.454,1012.301C933.741,1014.396 961.23,1020.803 973.759,1008.274" fill="none" stroke={INK} strokeWidth={13.41} strokeLinecap="round" />
      </G>
    </G>
  );
}

export default function CatArt({
  size = 150, expression = 'happy', animate = true, onPress, equipped, celebrate = 0, affection = 0,
}: { size?: number; expression?: PetExpression; animate?: boolean; onPress?: () => void; equipped?: { hat?: string; face?: string; neck?: string; held?: string }; celebrate?: number; affection?: number }) {
  const breathe = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const stretch = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);
  const [lookX, setLookX] = useState(0);   // idle glance: pupils drift left/right
  const [particles, setParticles] = useState<{ id: number; emoji: string; dx: number }[]>([]);
  const pid = useRef(0);
  const taps = useRef(0);
  const tapReset = useRef<any>(null);
  const asleep = expression === 'sleeping';
  const closed = blink || asleep;

  // mood transition — a single blink masks the mouth/eye swap so a mood change
  // reads as deliberate. No bounce/pulse: the cat stays put. Skipped on first mount.
  const firstMood = useRef(true);
  useEffect(() => {
    if (firstMood.current) { firstMood.current = false; return; }
    if (!animate || asleep) return;
    setBlink(true);
    const t = setTimeout(() => setBlink(false), 150);
    return () => clearTimeout(t);
  }, [expression, animate]);

  // (tail is static — a JS-driven SVG rotation stuttered/teleported on-device)

  // very light body breathing only — no floating, no sway.
  useEffect(() => {
    if (!animate) return;
    const b = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: asleep ? 3000 : 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: asleep ? 3000 : 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    b.start();
    return () => b.stop();
  }, [animate, asleep]);

  useEffect(() => {
    if (!animate || asleep) return;
    let t: any;
    const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 130); loop(); }, 2600 + Math.random() * 2800); };
    loop();
    return () => clearTimeout(t);
  }, [animate, asleep]);

  // idle glance — the eyes drift left/right now and then, then re-centre, so the cat
  // feels alive even when you're not touching it. (Toggling state re-renders the SVG,
  // it does NOT animate an SVG prop, so it stays smooth.)
  useEffect(() => {
    if (!animate || asleep) { setLookX(0); return; }
    let t: any;
    const loop = () => {
      t = setTimeout(() => {
        setLookX((Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 22));
        setTimeout(() => setLookX(0), 750 + Math.random() * 550);
        loop();
      }, 3200 + Math.random() * 4200);
    };
    loop();
    return () => clearTimeout(t);
  }, [animate, asleep]);

  // idle stretch — an occasional gentle "grow taller then settle" (wrapper scaleY).
  useEffect(() => {
    if (!animate || asleep) return;
    let t: any;
    const loop = () => {
      t = setTimeout(() => {
        Animated.sequence([
          Animated.timing(stretch, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(stretch, { toValue: 0, duration: 560, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]).start();
        loop();
      }, 9000 + Math.random() * 9000);
    };
    loop();
    return () => clearTimeout(t);
  }, [animate, asleep]);

  const spawn = (emoji: string, dx: number) => {
    const id = ++pid.current;
    setParticles(p => [...p, { id, emoji, dx }]);
    setTimeout(() => setParticles(p => p.filter(x => x.id !== id)), 1100);
  };

  // celebrate — bumped by the pet screen on a quest claim / full affection: a happy
  // hop + a shower of celebratory emojis. Skipped on first mount.
  const firstCeleb = useRef(true);
  useEffect(() => {
    if (firstCeleb.current) { firstCeleb.current = false; return; }
    if (!animate) return;
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(hop, { toValue: 0, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();
    const pool = ['🎉', '⭐', '❤️', '✨', '🌟'];
    for (let i = 0; i < 8; i++) setTimeout(() => spawn(pool[i % pool.length], (Math.random() - 0.5) * size * 0.85), i * 45);
  }, [celebrate]);

  const onTap = () => {
    haptic.tap();
    // hop + a quick wiggle so each tap feels alive
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(hop, { toValue: 0, friction: 5, tension: 90, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(wiggle, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -1, duration: 110, useNativeDriver: true }),
      Animated.spring(wiggle, { toValue: 0, friction: 4, useNativeDriver: true }),
    ]).start();
    // Petting reaction ESCALATES with the affection bar — from sparkles when barely
    // petted, through a warm ✨/💛 mix, to hearts when the cat adores you. Fewer, calmer
    // emojis (1–3) so it reads as building warmth, not confetti chaos.
    const a = affection;
    const pool = a >= 80 ? ['❤️', '💗', '❤️'] : a >= 45 ? ['✨', '💛', '❤️'] : a >= 18 ? ['✨', '💛'] : ['✨'];
    const n = a >= 80 ? 3 : a >= 45 ? 2 : 1;
    for (let i = 0; i < n; i++) setTimeout(() => spawn(pool[Math.floor(Math.random() * pool.length)], (Math.random() - 0.5) * size * (0.34 + a / 400)), i * 70);
    // purr — a soft vibration pattern that lengthens as the cat gets happier
    if (animate) {
      try {
        const pulses = a >= 80 ? 6 : a >= 45 ? 4 : 2;
        const pat: number[] = [];
        for (let i = 0; i < pulses; i++) pat.push(14, 26);
        Vibration.vibrate(pat);
      } catch {}
    }
    onPress?.();
  };

  const amp = asleep ? 0.008 : 0.012;   // barely-there breathing, keeps it grounded
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1 - amp, 1 + amp] });
  const stretchY = stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.07] });
  const rot = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] });

  return (
    <Pressable onPress={onTap} hitSlop={12}>
      <View>
      <Animated.View style={{ transform: [{ translateY: hopY }, { rotate: rot }] }}>
        <Animated.View style={{ transform: [{ scale }, { scaleY: stretchY }] }}>
          <Svg width={size} height={size} viewBox="0 0 2000 2000">
            {/* tail (static) */}
            <G transform="matrix(1,0,0,1,-106.194312,-183.051682)">
              <Path d="M1308.567,1421.964C1297.672,1432.859 1279.982,1432.859 1269.087,1421.964C1258.192,1411.069 1258.192,1393.379 1269.087,1382.484C1274.676,1376.895 1277.281,1367.411 1282.899,1357.04C1301.861,1322.036 1336.867,1273.685 1472.244,1256.763C1513.594,1251.594 1538.649,1251.292 1557.619,1235.85C1577.302,1219.829 1589.355,1189.318 1609.223,1129.716C1618.603,1101.577 1623.848,1052.64 1624.601,1045.862C1626.302,1030.548 1640.116,1019.497 1655.43,1021.198C1670.743,1022.9 1681.794,1036.714 1680.093,1052.027C1679.236,1059.741 1672.864,1115.352 1662.191,1147.372C1637.124,1222.574 1617.7,1258.937 1592.866,1279.152C1567.314,1299.95 1534.864,1305.204 1479.169,1312.165C1417.965,1319.816 1382.013,1333.948 1359.888,1350.59C1339.802,1365.699 1332.394,1382.571 1325.987,1395.385C1320.517,1406.322 1315.177,1415.355 1308.567,1421.964Z" fill={BLUE} />
            </G>
            {/* body */}
            <G>
              <G transform="matrix(0,-0.483436,0.363931,0,59.355842,1854.91733)"><Path d="M1217.952,1697.909L615.632,1697.909C608.388,1670.962 604.719,1643.161 604.719,1615.237C604.719,1441.176 744.554,1299.859 916.792,1299.859C1089.029,1299.859 1228.864,1441.176 1228.864,1615.237C1228.864,1643.161 1225.195,1670.962 1217.952,1697.909Z" fill={BLUE} /></G>
              <G transform="matrix(-0,0.483436,-0.363931,-0,1843.367298,968.497305)"><Path d="M1217.952,1697.909L615.632,1697.909C608.388,1670.962 604.719,1643.161 604.719,1615.237C604.719,1441.176 744.554,1299.859 916.792,1299.859C1089.029,1299.859 1228.864,1441.176 1228.864,1615.237C1228.864,1643.161 1225.195,1670.962 1217.952,1697.909Z" fill={BLUE} /></G>
              <G transform="matrix(1,0,0,1.860595,35.894072,-1501.867858)"><Path d="M1227.275,1647.023L606.308,1647.023C605.249,1636.462 604.719,1625.853 604.719,1615.237C604.719,1523.584 644.172,1436.465 712.809,1376.557L1120.774,1376.557C1189.411,1436.465 1228.864,1523.584 1228.864,1615.237C1228.864,1625.853 1228.334,1636.462 1227.275,1647.023Z" fill="#93C1F4" /></G>
              <G transform="matrix(1,0,0,1,66.267314,-54.305614)"><Path d="M799.499,1372.998C767.256,1417.604 814.179,1616.88 814.179,1616.88L710.499,1616.88C710.499,1616.88 635.664,1374.925 710.499,1285.047C785.335,1195.169 997.48,1190.035 1062.337,1285.047C1127.195,1380.059 1062.337,1616.88 1062.337,1616.88L958.658,1616.88C958.658,1616.88 1010.6,1424.336 972.289,1372.474C933.979,1320.611 831.742,1328.392 799.499,1372.998Z" fill={BLUE} /></G>
            </G>
            {/* head */}
            <G transform="matrix(1,0,0,0.890459,-226.720183,-280.574338)"><Circle cx={1179.406} cy={1195.161} r={370.904} fill={BLUE} /></G>
            {/* ears */}
            <G id="ear-right">
              <G transform="matrix(1.041427,1.041427,-0.644296,0.644296,299.104612,-1346.740541)"><Path d="M1348.771,586.138L1472.912,834.421L1224.629,834.421L1348.771,586.138Z" fill={BLUE} /></G>
              <G transform="matrix(0.599735,0.599735,-0.504606,0.504606,795.603559,-629.947691)"><Path d="M1326.238,586.138L1472.912,834.421L1224.629,834.421L1326.238,586.138Z" fill="#8AB5E7" /></G>
            </G>
            <G id="ear-left" transform="matrix(0.995551,-0.88133,0.54525,0.615914,-1080.579653,1264.375067)">
              <Path d="M1348.771,586.138L1472.912,834.421L1224.629,834.421L1348.771,586.138Z" fill={BLUE} />
              <G transform="matrix(0.72388,-0.071206,0.038982,1.035369,340.059015,115.16946)"><Path d="M1348.771,586.138L1472.912,834.421L1224.629,834.421L1348.771,586.138Z" fill="#8AB5E7" /></G>
            </G>
            {/* nose */}
            <G transform="matrix(0.213355,0,0,0.272984,737.537265,581.298175)"><Path d="M1144.719,1084.766L843.176,1084.766C840.209,1076.226 838.71,1067.464 838.71,1058.671C838.71,998.193 908.269,949.093 993.948,949.093C1079.626,949.093 1149.185,998.193 1149.185,1058.671C1149.185,1067.464 1147.686,1076.226 1144.719,1084.766Z" fill={INK} /></G>

            {/* eyes (open) or closed arcs */}
            {closed ? (
              <G>
                <Path d={`M${LX - 70} ${EYY} Q${LX} ${EYY + 46} ${LX + 70} ${EYY}`} fill="none" stroke={INK} strokeWidth={16} strokeLinecap="round" />
                <Path d={`M${RX - 70} ${EYY} Q${RX} ${EYY + 46} ${RX + 70} ${EYY}`} fill="none" stroke={INK} strokeWidth={16} strokeLinecap="round" />
              </G>
            ) : (
              <>
                <G id="eye-left">
                  <G transform="matrix(1.091685,0,0,1.184008,4.188232,-192.139452)"><Circle cx={723.316} cy={825.671} r={71.68} fill="#fff" /></G>
                  <G transform={`translate(${lookX} 0)`}>
                    <G transform="matrix(1.580175,0,0,1.775546,-402.185722,-711.962057)"><Circle cx={756.882} cy={849.163} r={34.202} fill={INK} /></G>
                    <G transform="matrix(0.615389,0,0,0.488819,349.091369,339.943831)"><Circle cx={756.882} cy={849.163} r={34.202} fill="#fff" /></G>
                  </G>
                </G>
                <G id="eye-right">
                  <G transform="matrix(1.116362,0,0,1.210772,299.668629,-212.319638)"><Circle cx={723.316} cy={825.671} r={71.68} fill="#fff" /></G>
                  <G transform={`translate(${lookX} 0)`}>
                    <G transform="matrix(1.615895,0,-0.037553,1.775546,-84.003122,-710.043581)"><Circle cx={756.882} cy={849.163} r={34.202} fill={INK} /></G>
                    <G transform="matrix(0.629299,0,0,0.499869,653.865406,332.031541)"><Circle cx={756.882} cy={849.163} r={34.202} fill="#fff" /></G>
                  </G>
                </G>
                <G transform="matrix(0.881056,0,0,0.515896,679.72648,498.929128)"><Path d="M405.732,671.041L574.51,671.041C579.309,681.043 581.781,691.796 581.781,702.66C581.781,747.37 540.71,783.668 490.121,783.668C439.533,783.668 398.461,747.37 398.461,702.66C398.461,691.796 400.934,681.043 405.732,671.041Z" fill={BLUE} /></G>
                <G transform="matrix(0.881056,0,0,0.515896,361.996844,497.010652)"><Path d="M405.732,671.041L574.51,671.041C579.309,681.043 581.781,691.796 581.781,702.66C581.781,747.37 540.71,783.668 490.121,783.668C439.533,783.668 398.461,747.37 398.461,702.66C398.461,691.796 400.934,681.043 405.732,671.041Z" fill={BLUE} /></G>
              </>
            )}

            {/* mouth (mood) */}
            {mouthFor(expression)}
            {/* tear when sad / sweat drop when sick — outlined so they read on the blue coat */}
            {expression === 'sad' && <Path d="M726 838 q-40 74 0 116 q40 -40 0 -116 z" fill="#5AB0F0" stroke="#3E93D8" strokeWidth={5} />}
            {expression === 'sick' && <Path d="M1245 706 q34 64 0 100 q-34 -36 0 -100 z" fill="#BFE3F5" stroke="#8FCDEA" strokeWidth={4} />}
            {/* custom accessories drawn to fit the cat (hat / face / neck) */}
            <CatAccessories equipped={equipped} />
          </Svg>
          {equipped?.held && (
            <View pointerEvents="none" style={{ position: 'absolute', width: size * 0.4, height: size * 0.4 * 1.05, left: size * 0.52, top: size * 0.44 }}>
              <Svg viewBox="0 0 100 105" width="100%" height="100%"><HeldArt id={equipped.held} /></Svg>
            </View>
          )}
          {asleep && <SleepZs size={size} />}
        </Animated.View>
      </Animated.View>
      {/* tap reaction emojis float up over the cat */}
      {particles.map(p => <Particle key={p.id} emoji={p.emoji} dx={p.dx} size={size} />)}
      </View>
    </Pressable>
  );
}

function SleepZs({ size }: { size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const y = a.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.24] });
  const op = a.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View style={[zs.wrap, { right: size * 0.16, top: size * 0.1, opacity: op, transform: [{ translateY: y }] }]}>
      <Text style={[zs.z, { fontSize: size * 0.16 }]}>z</Text>
    </Animated.View>
  );
}
const zs = StyleSheet.create({ wrap: { position: 'absolute' }, z: { color: '#9FB0BD', fontWeight: '900' } });
