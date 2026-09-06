import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View, StyleSheet, Text, Vibration } from 'react-native';
import Svg, { G, Path, Circle, Ellipse, Rect, Defs, Mask } from 'react-native-svg';
import { PetExpression } from '@/utils/petState';
import { haptic } from '@/utils/haptics';
import { CatPalette, DEFAULT_PALETTE, PUPIL } from '@/utils/catPalettes';
import CatTail from '@/components/pet/CatTail';

// The companion cat — a 1:1 port of the design approved in the HTML lab.
//
// Device rule that shapes everything here: JS-driven SVG-prop animation stutters, so
// ONLY wrapper <Animated.View> transforms animate (native driver) and everything inside
// the SVG changes by STATE (blink / look / mood / angry). The tail is a separate chain
// of Animated.Views (see CatTail) for exactly that reason.
//
// Two hard-won rules, learned by getting them wrong:
//  • MASK, don't paint. The cheeks/lids used to be painted in coat colour over the eyes —
//    invisible on fur, but they showed as blobs over anything else. They're masks now.
//  • Layer order is a feature. The raised paw draws AFTER the head (it looked like it
//    never reached the muzzle because the head covered it).

const LX = 794, RX = 1107, EYY = 762;

// cheek shapes — used ONLY as mask geometry, never painted
const CHEEK_L = 'M405.732,671.041L574.51,671.041C579.309,681.043 581.781,691.796 581.781,702.66C581.781,747.37 540.71,783.668 490.121,783.668C439.533,783.668 398.461,747.37 398.461,702.66C398.461,691.796 400.934,681.043 405.732,671.041Z';

function mouthFor(expr: PetExpression, angry: boolean, soft: boolean, ink: string): React.ReactNode {
  // angry = mouth SHUT. Tighter + deeper than the sad droop so the two never blur.
  if (angry) return <Path d="M932 920 Q985 882 1038 920" fill="none" stroke={ink} strokeWidth={16} strokeLinecap="round" />;
  if (soft) return <Path d="M934 896 Q985 929 1036 896" fill="none" stroke={ink} strokeWidth={12} strokeLinecap="round" />;
  if (expr === 'sad') return <Path d="M918 916 Q985 884 1052 916" fill="none" stroke={ink} strokeWidth={15} strokeLinecap="round" />;
  if (expr === 'meh') return <Path d="M925 905 H1045" fill="none" stroke={ink} strokeWidth={13} strokeLinecap="round" />;
  if (expr === 'sick') return <Path d="M918 905 q22 -20 44 0 t44 0" fill="none" stroke={ink} strokeWidth={14} strokeLinecap="round" />;
  if (expr === 'sleeping') return <Path d="M955 902 Q985 916 1015 902" fill="none" stroke={ink} strokeWidth={12} strokeLinecap="round" />;
  // 'content' reads as a calmer cat than 'happy' — soft smile + relaxed lids (see `half`)
  if (expr === 'content') return <Path d="M934 896 Q985 929 1036 896" fill="none" stroke={ink} strokeWidth={12} strokeLinecap="round" />;
  return (
    <G>
      <G transform="matrix(1,0,0,1.31158,57.033642,-397.041139)">
        <Path d="M893.229,971.7C895.371,980.267 906.949,1005.466 927.454,1012.301C933.741,1014.396 961.23,1020.803 973.759,1008.274" fill="none" stroke={ink} strokeWidth={10.72} strokeLinecap="round" />
      </G>
      <G transform="matrix(0.705861,-0.925793,0.605592,0.794283,-347.53569,978.25465)">
        <Path d="M893.229,971.7C895.371,980.267 906.949,1005.466 927.454,1012.301C933.741,1014.396 961.23,1020.803 973.759,1008.274" fill="none" stroke={ink} strokeWidth={13.41} strokeLinecap="round" />
      </G>
    </G>
  );
}

export default function CatArt({
  size = 150, expression = 'happy', animate = true, onPress, onLongPress, celebrate = 0, affection = 0,
  palette = DEFAULT_PALETTE, stripes = false, onAngry, lively = false,
  eyeColor = '', noseColor = '', whiskers = false, legStripes = false, attack = 0, shopkeeper = false,
}: {
  size?: number; expression?: PetExpression; animate?: boolean; onPress?: () => void;
  onLongPress?: () => void;   // hold = a distinct "cuddle" (paw-lick + hearts + long purr)
  celebrate?: number; affection?: number; palette?: CatPalette; stripes?: boolean;
  onAngry?: () => void;
  lively?: boolean;   // eager idle for the loading splash: glance + ear-flutter soon & often
  eyeColor?: string;   // '' = domyślny PUPIL; inaczej hex koloru oczu
  noseColor?: string;  // '' = domyślny p.ink; inaczej hex koloru noska
  whiskers?: boolean;  // wąsy
  legStripes?: boolean; // pręgi na łapkach
  attack?: number;     // increment to make the cat swat + pull a battle face (boss fights)
  // "Sklepikarz" — the market stall persona (2026-09-03): fałszywe wąsy + kapelusik z
  // uszami wystającymi na wierzchu (mustache/hat są rysowane w SVG, więc siedzą POD
  // overlayem `Ear` renderowanym niżej — stąd uszy zawsze wychodzą na wierzch bez
  // dodatkowej maski). Wyłącza auto-lizanie i reakcje na dotyk/przytulanie (kotek za ladą
  // nie jest tapowalnym zwierzakiem) — ale NIE dotyka breathe/blink/glance/ear-flutter,
  // żeby nie był statyczny (user: "rozgladanie mu zostaje tylko zeby nie byl zbyt statyczny").
  shopkeeper?: boolean;
}) {
  const p = palette;
  const breathe = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const arm = useRef(new Animated.Value(0)).current;      // 0 = resting, 1 = raised (lick)
  const swat = useRef(new Animated.Value(0)).current;

  const [blink, setBlink] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [petting, setPetting] = useState(false);
  const [angry, setAngry] = useState(false);
  const [battleFace, setBattleFace] = useState(false);   // fierce eyes, no halo/side-effects — see `attack` prop
  const [licking, setLicking] = useState(false);
  const [swatting, setSwatting] = useState(false);
  const [particles, setParticles] = useState<{ id: number; kind: 'heart' | 'spark'; dx: number }[]>([]);
  const pid = useRef(0);
  const taps = useRef<number[]>([]);
  const angryTimer = useRef<any>(null);
  const earL = useRef(new Animated.Value(0)).current;
  const earR = useRef(new Animated.Value(0)).current;

  // ear flutter — a real cat twitches one ear several times in a burst (the HTML lab
  // behaviour the user missed). Smooth because it rotates an overlay wrapper, not an SVG
  // prop. Negative-only rotation keeps the ear's corner inside the head.
  const flutterEar = (which: 'L' | 'R') => {
    if (!animate || asleep) return;
    const v = which === 'L' ? earL : earR;
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.1, duration: 90, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.8, duration: 90, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.15, duration: 90, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.55, duration: 90, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 130, useNativeDriver: true }),
    ]).start();
  };

  const spawn = (kind: 'heart' | 'spark', dx: number) => {
    const id = ++pid.current;
    setParticles(ps => [...ps, { id, kind, dx }]);
    setTimeout(() => setParticles(ps => ps.filter(x => x.id !== id)), 1050);
  };

  const asleep = expression === 'sleeping';
  const shut = blink || asleep || licking;
  const half = !shut && !angry && !battleFace && (petting || expression === 'content');
  const fierce = angry || battleFace;   // shared eye/mouth treatment; halo stays angry-only (see below)

  // ── idle: very light breathing (a visible pulse read as wrong) ──
  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animate]);

  // ── blink (sometimes a double, like a real cat) ──
  useEffect(() => {
    if (!animate || asleep || angry) return;
    let t: any;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          if (Math.random() < 0.3) setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 105); }, 145);
        }, 115);
        loop();
      }, 2600 + Math.random() * 2800);
    };
    loop();
    return () => clearTimeout(t);
  }, [animate, asleep, angry]);

  // ── idle glance ──
  useEffect(() => {
    if (!animate || asleep || angry || petting || lively) { setLook({ x: 0, y: 0 }); return; }
    let t: any;
    const loop = () => {
      t = setTimeout(() => {
        setLook({ x: (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 18), y: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 7) });
        setTimeout(() => setLook({ x: 0, y: 0 }), 700 + Math.random() * 600);
        loop();
      }, 3200 + Math.random() * 4200);
    };
    loop();
    return () => clearTimeout(t);
  }, [animate, asleep, angry, petting, lively]);

  // ── idle ear flutter — one random ear, now and then ──
  useEffect(() => {
    if (!animate || asleep || lively) return;
    let t: any;
    const loop = () => { t = setTimeout(() => { flutterEar(Math.random() < 0.5 ? 'L' : 'R'); loop(); }, 4000 + Math.random() * 5000); };
    loop();
    return () => clearTimeout(t);
  }, [animate, asleep, lively]);

  // ── LIVELY (loading splash): glance around + flutter ears almost immediately and
  // every ~1.1 s, so the cat is visibly alive in the brief moment it's on screen. Biased
  // to glance DOWN now and then — toward the "ładowanie" dots — so it reads as the cat
  // watching the app load, not just twitching in a void. ──
  useEffect(() => {
    if (!animate || !lively || asleep) return;
    let on = true;
    const beat = (first = false) => {
      if (!on) return;
      const down = Math.random() < 0.45;
      setLook({
        x: down ? (Math.random() - 0.5) * 14 : (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 16),
        y: down ? (11 + Math.random() * 6) : (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 6),
      });
      flutterEar(Math.random() < 0.5 ? 'L' : 'R');
      setTimeout(() => { if (on) setLook({ x: 0, y: 0 }); }, 620);
      setTimeout(() => beat(), (first ? 900 : 1050) + Math.random() * 450);
    };
    const t0 = setTimeout(() => beat(true), 220);   // start right after mount
    return () => { on = false; clearTimeout(t0); };
  }, [animate, lively, asleep]);

  // ── paw lick ──
  const doLick = () => {
    if (licking || asleep || angry) return;
    setLicking(true);
    Animated.sequence([
      Animated.timing(arm, { toValue: 1, duration: 290, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      // three licks
      ...[0, 1, 2].flatMap(() => [
        Animated.timing(arm, { toValue: 0.94, duration: 190, useNativeDriver: true }),
        Animated.timing(arm, { toValue: 1, duration: 190, useNativeDriver: true }),
      ]),
      Animated.timing(arm, { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setLicking(false));
  };
  useEffect(() => {
    if (!animate || asleep || shopkeeper) return;
    let t: any;
    const loop = () => { t = setTimeout(() => { if (!angry && Math.random() < 0.6) doLick(); loop(); }, 12000 + Math.random() * 10000); };
    loop();
    return () => clearTimeout(t);
  }, [animate, asleep, angry, licking, shopkeeper]);

  // ── angry ──
  const doSwat = (vibrate: boolean = true) => {
    swat.setValue(0);
    setSwatting(true);   // without this the arm stayed hidden and the swat was invisible
    Animated.sequence([
      Animated.timing(swat, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(swat, { toValue: -1, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(swat, { toValue: 0.85, duration: 110, useNativeDriver: true }),
      Animated.timing(swat, { toValue: -0.9, duration: 90, useNativeDriver: true }),
      Animated.timing(swat, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setSwatting(false));
    if (vibrate) { try { Vibration.vibrate([0, 25, 45, 25]); } catch {} }
  };
  const goAngry = () => {
    if (angry) return;
    setAngry(true); setPetting(false);
    // an aggressive, hard, uneven buzz — the "he's had ENOUGH" hiss. Long hits, short
    // gaps, escalating, nothing like the soft purr roll.
    try { Vibration.vibrate([0, 90, 50, 130, 45, 180, 40, 240]); } catch {}
    haptic.warn();
    const s = Animated.loop(Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 40, useNativeDriver: true }),
    ]));
    s.start();
    setTimeout(doSwat, 380);
    setTimeout(doSwat, 1500);
    onAngry?.();
    clearTimeout(angryTimer.current);
    angryTimer.current = setTimeout(() => {
      s.stop(); shake.setValue(0); setAngry(false); taps.current = [];
    }, 3000);
  };

  // ── attack (boss fights) — reuses the exact same swat + fierce-eyes rendering as
  // `angry`/`doSwat` above, just without the halo or the anger STATE (no onAngry callback,
  // no 3s cooldown, no interaction with the pet-page tap-counter) so a fight screen can
  // trigger it freely every round without fighting the petting-anger mechanic.
  //
  // Deliberately NOT gated on `animate` (2026-08-30, user: "kotek pupil był tam [w walce]
  // statyczny bez animacji... bo teraz jest w pełni z głaskaniem animacjami lizania co
  // pewnie laguje") — `animate={false}` on the fight screen kills the decorative IDLE loops
  // (breathe/blink/glance/ear-flutter/periodic auto-lick, all below) that were the real lag
  // source, but the attack swat is a deliberate per-round SIGNAL from the fight screen, not
  // idle decoration — it must keep working under `animate={false}` or a static fight cat
  // would never show a hit. `asleep` alone still guards it (a sleeping cat doesn't swat).
  const firstAttack = useRef(true);
  useEffect(() => {
    if (firstAttack.current) { firstAttack.current = false; return; }
    if (asleep) return;
    setBattleFace(true);
    doSwat(false);
    setTimeout(() => setBattleFace(false), 260);
  }, [attack]);

  // HOLD (long press) = a cuddle: distinct from a tap. The cat licks its paw (a cute,
  // slower move), a warmer shower of hearts drifts up, a longer soft purr buzzes, and it
  // keeps content half-lidded eyes for a beat. Reads clearly as "mizianie", not a poke.
  const doCuddle = () => {
    if (asleep || angry || shopkeeper) return;
    taps.current = [];                       // a deliberate cuddle shouldn't count toward anger
    doLick();
    setPetting(true);
    setTimeout(() => setPetting(false), 1500);
    for (let i = 0; i < 6; i++) setTimeout(() => spawn('heart', (Math.random() - 0.5) * size * 0.55), i * 95);
    if (animate) { try { Vibration.vibrate([0, 18, 55, 18, 55, 18, 55, 22]); } catch {} }
    onLongPress?.();
  };

  const onTap = () => {
    if (angry || shopkeeper) return;
    const now = Date.now();
    // Anger needs deliberate fast tapping but should be reachable. 7-in-4s snapped during
    // normal petting; 20-in-2.5s (8/sec) was too hard to sustain. 12 in 2.5s (~5/sec) is
    // the middle: enthusiastic petting (~3/sec → 7-8 in the window) stays under it.
    taps.current = [...taps.current, now].filter(t => now - t < 2500);
    if (taps.current.length >= 12) { goAngry(); return; }

    haptic.tap();
    flutterEar(Math.random() < 0.5 ? 'L' : 'R');   // ears react to being touched
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(hop, { toValue: 0, friction: 5, tension: 90, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(wiggle, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -1, duration: 110, useNativeDriver: true }),
      Animated.spring(wiggle, { toValue: 0, friction: 4, useNativeDriver: true }),
    ]).start();
    setPetting(true);
    setTimeout(() => setPetting(false), 900);

    // Reactions escalate with the affection bar: a lone sparkle when barely petted,
    // warming up to hearts once he adores you. Few and calm (1–3), so it reads as
    // building warmth rather than confetti.
    const a = affection;
    const n = a >= 80 ? 3 : a >= 45 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      setTimeout(() => spawn(a >= 45 ? 'heart' : 'spark', (Math.random() - 0.5) * size * (0.34 + a / 400)), i * 70);
    }

    if (animate) {
      try {
        // purr: a soft roll that lengthens as he gets happier
        const pulses = affection >= 80 ? 6 : affection >= 45 ? 4 : 2;
        const pat: number[] = [];
        for (let i = 0; i < pulses; i++) pat.push(14, 26);
        Vibration.vibrate(pat);
      } catch {}
    }
    onPress?.();
  };

  const firstCeleb = useRef(true);
  useEffect(() => {
    if (firstCeleb.current) { firstCeleb.current = false; return; }
    if (!animate) return;
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(hop, { toValue: 0, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [celebrate]);

  // kolor oczu (dodatek). Zapis "hexL|hexR" = heterochromia (inny kolor każdego oka).
  const [eyeL, eyeR] = eyeColor.includes('|')
    ? (() => { const [a, b] = eyeColor.split('|'); return [a || PUPIL, b || PUPIL]; })()
    : [eyeColor || PUPIL, eyeColor || PUPIL];
  const hasEyeColor = !!eyeColor;         // wybrano kolorowe oczy → dodaj głębię (tęczówka+źrenica)
  const unit = size / 2000;               // px per viewBox unit — everything derives from this
  // shoulder (829,1250 in viewBox) expressed relative to the overlay's CENTRE, because RN
  // rotates about the centre and has no transform-origin
  const pivotX = 829 * unit - size / 2;
  const pivotY = 1250 * unit - size / 2;
  const armOut = licking || swatting;

  const amp = asleep ? 0.0025 : 0.0035;    // barely-there; a real pulse looked wrong
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1 - amp, 1 + amp] });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.07] });
  const rot = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] });
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-size * 0.012, size * 0.012] });

  // lick: the arm swings up to the muzzle. Rotating a rigid arm is right HERE (the paw
  // really does arc up to the face) — unlike the swat, which must go straight down.
  const armRot = arm.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-147deg'] });
  const headDip = arm.interpolate({ inputRange: [0, 1], outputRange: [0, 56] });
  const tongueOp = arm.interpolate({ inputRange: [0, 0.55, 0.94, 1], outputRange: [0, 1, 1, 1] });
  // swat: mostly TRANSLATION. A rigid rotation threw the paw 257px sideways before it
  // dropped, which read as a side-swipe; a real cat folds and throws it straight down.
  // The throw is in viewBox units, so it must be scaled to px like everything else.
  const swatTY = swat.interpolate({ inputRange: [-1, 0, 1], outputRange: [35 * (size / 2000), 0, -175 * (size / 2000)] });
  const swatRot = swat.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-6deg', '0deg', '-20deg'] });

  const tailMood = angry ? 'angry' : petting ? 'purr' : 'idle';

  return (
    <Pressable onPress={onTap} onLongPress={doCuddle} delayLongPress={280} hitSlop={12}>
      <View>
        <Animated.View style={{ transform: [{ translateY: hopY }, { rotate: rot }, { translateX: shakeX }] }}>
          <Animated.View style={{ transform: [{ scale }] }}>
            {/* Tail sits BEHIND the body — a full-overlay SVG of the real tail path,
                gently swaying (see CatTail). */}
            <CatTail color={p.coat} markColor={p.mark} stripes={stripes} animate={animate && !asleep} mood={tailMood} size={size} />

            <Svg width={size} height={size} viewBox="0 0 2000 2000">
              <Defs>
                {/* mask, don't paint — see the note at the top of this file */}
                <Mask id="eyesFull">
                  <Rect x="0" y="0" width="2000" height="2000" fill="#fff" />
                  <G transform="matrix(0.881056,0,0,0.515896,679.72648,498.929128)"><Path d={CHEEK_L} fill="#000" /></G>
                  <G transform="matrix(0.881056,0,0,0.515896,361.996844,497.010652)"><Path d={CHEEK_L} fill="#000" /></G>
                </Mask>
                <Mask id="eyesHalf">
                  <Rect x="0" y="0" width="2000" height="2000" fill="#fff" />
                  <G transform="matrix(0.881056,0,0,0.515896,679.72648,498.929128)"><Path d={CHEEK_L} fill="#000" /></G>
                  <G transform="matrix(0.881056,0,0,0.515896,361.996844,497.010652)"><Path d={CHEEK_L} fill="#000" /></G>
                  <Rect x="706" y="668" width="180" height="92" fill="#000" />
                  <Rect x="1018" y="670" width="182" height="92" fill="#000" />
                </Mask>
                {/* angry = the same top cut as 'content', but SLANTED to the brow. Wide
                    round eyes read as startled, not angry. */}
                <Mask id="eyesAngry">
                  <Rect x="0" y="0" width="2000" height="2000" fill="#fff" />
                  <G transform="matrix(0.881056,0,0,0.515896,679.72648,498.929128)"><Path d={CHEEK_L} fill="#000" /></G>
                  <G transform="matrix(0.881056,0,0,0.515896,361.996844,497.010652)"><Path d={CHEEK_L} fill="#000" /></G>
                  <Rect x="676" y="608" width="232" height="150" transform="rotate(16 794 758)" fill="#000" />
                  <Rect x="994" y="610" width="232" height="150" transform="rotate(-16 1107 760)" fill="#000" />
                </Mask>
              </Defs>

              {/* bottle-brush halo when angry */}
              {angry && <Path d={spiky(952, 800, 420, 420, 26, 0.11)} fill={p.mark} opacity={0.55} />}

              {/* body */}
              <G>
                <G transform="matrix(0,-0.483436,0.363931,0,59.355842,1854.91733)"><Path d="M1217.952,1697.909L615.632,1697.909C608.388,1670.962 604.719,1643.161 604.719,1615.237C604.719,1441.176 744.554,1299.859 916.792,1299.859C1089.029,1299.859 1228.864,1441.176 1228.864,1615.237C1228.864,1643.161 1225.195,1670.962 1217.952,1697.909Z" fill={p.coat} /></G>
                <G transform="matrix(-0,0.483436,-0.363931,-0,1843.367298,968.497305)"><Path d="M1217.952,1697.909L615.632,1697.909C608.388,1670.962 604.719,1643.161 604.719,1615.237C604.719,1441.176 744.554,1299.859 916.792,1299.859C1089.029,1299.859 1228.864,1441.176 1228.864,1615.237C1228.864,1643.161 1225.195,1670.962 1217.952,1697.909Z" fill={p.coat} /></G>                <G transform="matrix(1,0,0,1.860595,35.894072,-1501.867858)"><Path d="M1227.275,1647.023L606.308,1647.023C605.249,1636.462 604.719,1625.853 604.719,1615.237C604.719,1523.584 644.172,1436.465 712.809,1376.557L1120.774,1376.557C1189.411,1436.465 1228.864,1523.584 1228.864,1615.237C1228.864,1625.853 1228.334,1636.462 1227.275,1647.023Z" fill={p.shade} /></G>
                {/* forelegs WITHOUT the original arch: the arch had to be covered by a
                    rect to raise a paw, and that rect bit a square notch out of it.
                    The LEFT leg + paw hide whenever the raised arm is out (lick OR swat) —
                    tying this to `licking` alone left a third paw during a swat. */}
                {!armOut && <Rect x={777} y={1236} width={104} height={306} rx={52} fill={p.coat} />}
                <Rect x={1025} y={1236} width={104} height={306} rx={52} fill={p.coat} />
              </G>
              {!armOut && <Paw cx={829} p={p} />}
              <Paw cx={1077} p={p} />
              {/* pręgi na łapkach — poziome bandki na goleniach (tabby); lewa znika tu (statyczna
                  łapka jest schowana pod `!armOut`, jak reszta lewej nogi wyżej), ale WRACA na
                  uniesionej łapce w osobnym overlay'u niżej (2026-08-21 fix) — bez tego, przez
                  chwilę animacji, kotek wyglądał jakby paski na chwilę znikały. */}
              {legStripes && !armOut && (
                <G fill={p.mark} opacity={0.32}>
                  <Rect x={779} y={1300} width={100} height={13} rx={5} />
                  <Rect x={779} y={1360} width={100} height={13} rx={5} />
                  <Rect x={779} y={1420} width={100} height={13} rx={5} />
                </G>
              )}
              {legStripes && (
                <G fill={p.mark} opacity={0.32}>
                  <Rect x={1027} y={1300} width={100} height={13} rx={5} />
                  <Rect x={1027} y={1360} width={100} height={13} rx={5} />
                  <Rect x={1027} y={1420} width={100} height={13} rx={5} />
                </G>
              )}

              {/* ears are drawn as separate animated overlays (Ear, below) so they can
                  flutter — animating them here inside the SVG would stutter */}
              <G>
                <G transform="matrix(1,0,0,0.890459,-226.720183,-280.574338)"><Circle cx={1179.406} cy={1195.161} r={370.904} fill={p.coat} /></G>                <G transform="matrix(0.213355,0,0,0.272984,737.537265,581.298175)"><Path d="M1144.719,1084.766L843.176,1084.766C840.209,1076.226 838.71,1067.464 838.71,1058.671C838.71,998.193 908.269,949.093 993.948,949.093C1079.626,949.093 1149.185,998.193 1149.185,1058.671C1149.185,1067.464 1147.686,1076.226 1144.719,1084.766Z" fill={noseColor || p.ink} /></G>

                {shut ? (
                  <G>
                    <Path d={`M${LX - 70} ${EYY} Q${LX} ${EYY + 46} ${LX + 70} ${EYY}`} fill="none" stroke={p.ink} strokeWidth={16} strokeLinecap="round" />
                    <Path d={`M${RX - 70} ${EYY} Q${RX} ${EYY + 46} ${RX + 70} ${EYY}`} fill="none" stroke={p.ink} strokeWidth={16} strokeLinecap="round" />
                  </G>
                ) : (
                  <G mask={`url(#${fierce ? 'eyesAngry' : half ? 'eyesHalf' : 'eyesFull'})`}>
                    <Ellipse cx={794} cy={785} rx={78} ry={85} fill="#fff" />
                    <Ellipse cx={1107} cy={787} rx={80} ry={87} fill="#fff" />
                    <G transform={`translate(${look.x} ${look.y})`}>
                      {fierce ? (
                        // slit pupils: a round pupil simply fills the narrowed eye, so all
                        // you saw was a dark wedge — and slits are what an angry cat has
                        <G>
                          <Ellipse cx={794} cy={792} rx={17} ry={55} fill={eyeL} />
                          <Ellipse cx={1107} cy={794} rx={17} ry={55} fill={eyeR} />
                          <Circle cx={820} cy={762} r={9} fill="#fff" opacity={0.9} />
                          <Circle cx={1133} cy={764} r={9} fill="#fff" opacity={0.9} />
                        </G>
                      ) : (
                        <G>
                          {/* tęczówka */}
                          <Ellipse cx={794} cy={792} rx={54} ry={61} fill={eyeL} />
                          <Ellipse cx={1107} cy={794} rx={55} ry={61} fill={eyeR} />
                          {hasEyeColor && (
                            <G>
                              {/* głębia: ciemniejszy rąbek tęczówki + pionowa źrenica */}
                              <Ellipse cx={794} cy={792} rx={54} ry={61} fill="none" stroke="#000" strokeWidth={7} opacity={0.22} />
                              <Ellipse cx={1107} cy={794} rx={55} ry={61} fill="none" stroke="#000" strokeWidth={7} opacity={0.22} />
                              <Ellipse cx={794} cy={792} rx={22} ry={50} fill="#12131A" />
                              <Ellipse cx={1107} cy={794} rx={22} ry={50} fill="#12131A" />
                            </G>
                          )}
                          <Circle cx={815} cy={758} r={17} fill="#fff" />
                          <Circle cx={1128} cy={760} r={17} fill="#fff" />
                        </G>
                      )}
                    </G>
                  </G>
                )}
                {half && (
                  <G>
                    <Path d="M718 758 Q794 776 870 758" fill="none" stroke={p.ink} strokeWidth={11} strokeLinecap="round" />
                    <Path d="M1030 760 Q1107 778 1184 760" fill="none" stroke={p.ink} strokeWidth={11} strokeLinecap="round" />
                  </G>
                )}
                {fierce && (
                  <G>
                    <Path d="M700 664 Q788 680 876 720" fill="none" stroke={p.ink} strokeWidth={19} strokeLinecap="round" />
                    <Path d="M1202 666 Q1114 682 1026 722" fill="none" stroke={p.ink} strokeWidth={19} strokeLinecap="round" />
                  </G>
                )}
                {mouthFor(expression, fierce, petting || licking, p.ink)}
                {/* wąsy — cienkie kreski od pyszczka na boki (statyczne, animacji nie ruszają) */}
                {whiskers && (
                  <G stroke={p.ink} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.5}>
                    <Path d="M846 874 Q722 852 604 838" />
                    <Path d="M848 902 Q720 906 596 904" />
                    <Path d="M846 930 Q724 948 606 968" />
                    <Path d="M1124 874 Q1248 852 1366 838" />
                    <Path d="M1122 902 Q1250 906 1374 904" />
                    <Path d="M1124 930 Q1246 948 1364 968" />
                  </G>
                )}
                {licking && (
                  <G>
                    <Ellipse cx={985} cy={906} rx={46} ry={32} fill="#5E3140" />
                    <Rect x={961} y={884} width={48} height={116} rx={24} fill="#F28BAE" />
                  </G>
                )}
                {expression === 'sick' && (
                  <G transform="rotate(-17 862 566)">
                    <Rect x={762} y={536} width={200} height={60} rx={18} fill="#F0D3AE" stroke="#D3B187" strokeWidth={4} />
                    <Rect x={822} y={546} width={80} height={40} rx={9} fill="#E0BE93" />
                  </G>
                )}
                {expression === 'sad' && <Path d="M726 838 q-40 74 0 116 q40 -40 0 -116 z" fill="#5AB0F0" stroke="#3E93D8" strokeWidth={5} />}
                {expression === 'sick' && <Path d="M1245 706 q34 64 0 100 q-34 -36 0 -100 z" fill="#BFE3F5" stroke="#8FCDEA" strokeWidth={4} />}
                {/* "sklepikarz" disguise — hat + cheek scratch mark. Fixed costume colours
                    (not palette-driven). Drawn LAST inside the SVG (after eyes/mouth) so it
                    sits on top of the face, and — crucially — the hat is drawn INSIDE this
                    <Svg>, which closes below BEFORE the <Ear> overlays render, so the ears
                    automatically poke out on top of the brim with no extra cutout math.
                    Draft 4 (2026-09-06) — user dostał statyczny .svg-eksport (ten sam
                    viewBox 0 0 2000, patrz ARCHITECTURE.md §36) i sam dopracował wygląd w
                    zewnętrznym edytorze wektorowym, odsyłając gotowy plik
                    (`assets/Gotowysklepikarz.svg`). Względem draftu 3: kapelusz WIĘKSZY i
                    szerszy (rondo 604-1274 vs dawne 760-1160, korona/rondo przeskalowane
                    ~1.67×, wyśrodkowane tak samo nad głową), "gather"-elipsy przy uszach
                    USUNIĘTE (zbędne przy szerszym rondzie), CAŁA wąsata "handlebar mustache"
                    USUNIĘTA (user uznał sam uśmiech za wystarczający, bez doklejonych wąsów)
                    — zastąpiona małym akcentem: bliznowatą "błyskawicą" na prawym policzku.
                    Współrzędne przeniesione 1:1 z przysłanego pliku (dokładna transformacja
                    macierzy z edytora rozpisana na sztywno, nie przybliżenie). */}
                {shopkeeper && (
                  <G>
                    <Ellipse cx={939.03} cy={645.59} rx={501.83} ry={103.71} fill="#2E2620" />
                    <Path d="M604.47 645.59 C604.47 439.28 715.99 318.28 939.03 282.59 C1162.07 318.28 1273.59 439.28 1273.59 645.59 L604.47 645.59 Z" fill="#3A3128" />
                    <Path d="M679.75 633.88 C690.9 468.83 766.18 355.64 905.57 294.3 C805.21 342.25 743.87 455.45 721.57 633.88 L679.75 633.88 Z" fill="#463C31" opacity={0.55} />
                    <Rect x={604.47} y={587.04} width={669.11} height={70.26} fill="#241A10" />
                    <Rect x={885.5} y={580.35} width={107.06} height={83.64} rx={10.04} fill="#171310" />
                    <Path d="M1194.04 866.41 L1126.18 949.72 L1185.45 937.18 L1109.01 1017.58 L1217.23 937.18 L1237.84 906.04 L1172.57 923.04 Z" fill="#87714E" />
                    {/* Uszy sklepikarza SCHOWANE za czapką (user: "uszy specjalnie ukryłem za
                        czapką, a ty je znowu wyjąłeś") — zamiast pełnowymiarowego, animowanego
                        <Ear> (który wystaje wyraźnie ponad rondo), tylko mały, statyczny
                        "prześwit" ucha wystający spod ronda z KAŻDEJ strony, dokładnie wg
                        kształtu z przysłanego pliku (assets/Gotowysklepikarz.svg, grupa
                        "ear-left" — mimo nazwy zawierała kształty dla OBU stron; prawa strona
                        w pliku, "ear-right", była pusta = user faktycznie chciał różne, mniejsze
                        kształty na obu bokach, nie stary symetryczny trójkąt). Rysowane TU,
                        wewnątrz głównego <Svg>, więc chowają się pod rondem/koroną kapelusza
                        (narysowanymi wyżej w tym samym G) zamiast wystawać nad nimi jak
                        standardowy <Ear>-overlay. */}
                    <Path d="M581.78 627.54 L553.21 534.45 L562.87 434.03 L652.1 448.49 C646.59 457.78 641.57 467.43 637.01 477.45 L594.04 469.61 L611.32 566.49 C611.32 566.49 607.73 583.44 607.96 587.04 L604.47 657.3 L581.78 627.54 Z" fill={p.coat} />
                    <Path d="M604.47 637.28 C604.47 637.28 584.37 585.24 581.78 551.82 C579.16 518.01 589.2 468.2 589.2 468.2 L637.01 477.45 C624.64 504.67 611.33 565.81 611.33 565.81 L604.47 637.28 Z" fill={p.ear} />
                    <Path d="M1240.39 476.03 L1352.94 464.09 L1340.3 583.32 C1340.3 583.32 1325.44 621.87 1314.32 634.2 C1303.87 645.79 1273.58 657.3 1273.58 657.3 L1322.07 489.75 L1251.2 502.62 C1247.95 493.49 1244.35 484.62 1240.39 476.03 Z" fill={p.coat} />
                    <Path d="M1251.2 502.62 L1322.07 489.75 L1299.48 630.18 L1273.58 657.3 L1267.57 567.21 C1267.57 567.21 1258.39 522.83 1251.2 502.62 Z" fill={p.ear} />
                  </G>
                )}
              </G>
            </Svg>

            {/* ears — overlays on top of the head so they can flutter (native-driver
                wrapper rotation about the ear base). Sklepikarz dostaje WŁASNE, schowane pod
                czapką uszy narysowane wyżej wewnątrz <Svg> — standardowy pełnowymiarowy
                <Ear> zawsze wystawałby ponad rondo, więc jest tu wyłączony dla shopkeeper. */}
            {!shopkeeper && <Ear side="R" anim={earR} size={size} coat={p.coat} inner={p.ear} />}
            {!shopkeeper && <Ear side="L" anim={earL} size={size} coat={p.coat} inner={p.ear} />}

            {/* The raised foreleg lives OUTSIDE the SVG, in its own wrapper, so it can be
                animated with the native driver — and it renders ON TOP of the head, which
                is why the paw visibly reaches the muzzle.

                RN rotates about a view's CENTRE and has no transform-origin, so rotating
                this full-size overlay swung the arm around the middle of the CAT instead
                of the shoulder. Pivot the same way CatTail does: translate the shoulder to
                the centre, rotate, translate back. */}
            {armOut && (
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    transform: [
                      { translateY: swatTY },
                      { translateX: pivotX }, { translateY: pivotY },
                      { rotate: licking ? armRot : swatRot },
                      { translateX: -pivotX }, { translateY: -pivotY },
                    ],
                  },
                ]}
              >
                <Svg width={size} height={size} viewBox="0 0 2000 2000" style={{ position: 'absolute' }}>
                  <G>
                    <Rect x={779} y={1240} width={100} height={300} rx={50} fill={p.coat} />
                    <Ellipse cx={829} cy={1541} rx={76} ry={48} fill={p.coat} />
                    <Path d="M799 1516 v26 M829 1511 v31 M859 1516 v26" stroke={p.ink} strokeWidth={7} strokeLinecap="round" opacity={0.4} />
                  </G>
                  {/* pręgi na tej samej łapce co w spoczynku (2026-08-21, user: "jak liże łapkę
                      to paski na łapkach znikają na czas animacji a po niej wracają") — ten
                      overlay rysuje uniesioną łapkę OSOBNO od statycznej w SVG wyżej (patrz
                      komentarz przy `!armOut`), ale nigdy nie kopiował na nią pręg — łapka
                      znikała bez wzoru, wyglądało jakby paski "znikały". Te same 3 Rect co przy
                      spoczynkowej łapce (x=779, ten sam lokalny układ współrzędnych). */}
                  {legStripes && (
                    <G fill={p.mark} opacity={0.32}>
                      <Rect x={779} y={1300} width={100} height={13} rx={5} />
                      <Rect x={779} y={1360} width={100} height={13} rx={5} />
                      <Rect x={779} y={1420} width={100} height={13} rx={5} />
                    </G>
                  )}
                </Svg>
              </Animated.View>
            )}

            {/* tap reactions — real vector hearts / sparkles, no emoji */}
            {particles.map(pt => <Particle key={pt.id} kind={pt.kind} dx={pt.dx} size={size} />)}

            {asleep && <SleepZs size={size} />}
          </Animated.View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

// One floating reaction: rises, scales in, fades. A real vector heart/sparkle — the old
// cat threw emoji, which the user cut ("mniej emotek, więcej prawdziwych efektów").
function Particle({ kind, dx, size }: { kind: 'heart' | 'spark'; dx: number; size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []);
  const y = a.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.55] });
  const op = a.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const sc = a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.15, 0.9] });
  const d = size * 0.13;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: size * 0.5 + dx, top: size * 0.3, opacity: op, transform: [{ translateY: y }, { scale: sc }] }}
    >
      <Svg width={d} height={d} viewBox="0 0 32 32">
        {kind === 'heart'
          ? <Path d="M16 29S1 19.6 1 10.2A8.6 8.6 0 0 1 16 5a8.6 8.6 0 0 1 15 5.2C31 19.6 16 29 16 29z" fill="#F2789F" />
          : <Path d="M16 0c1.4 8.6 6 13.2 16 16-10 2.8-14.6 7.4-16 16-1.4-8.6-6-13.2-16-16C10 13.2 14.6 8.6 16 0z" fill="#FFD76E" />}
      </Svg>
    </Animated.View>
  );
}

// One ear as an animated overlay. Rotates about its base (RN has no transform-origin →
// translate/rotate/translate sandwich) so the flutter is smooth. Same paths as the
// artwork, just lifted out of the body SVG.
function Ear({ side, anim, size, coat, inner }: {
  side: 'L' | 'R'; anim: Animated.Value; size: number; coat: string; inner: string;
}) {
  const unit = size / 2000;
  const pivot = side === 'R' ? { x: 1200, y: 815 } : { x: 760, y: 810 };   // ear base
  const px = pivot.x * unit - size / 2;
  const py = pivot.y * unit - size / 2;
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', side === 'R' ? '-7deg' : '7deg'] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 0, top: 0, width: size, height: size,
        transform: [{ translateX: px }, { translateY: py }, { rotate }, { translateX: -px }, { translateY: -py }],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 2000 2000">
        {side === 'R' ? (
          <G>
            <G transform="matrix(1.041427,1.041427,-0.644296,0.644296,299.104612,-1346.740541)"><Path d="M1348.771,586.138L1472.912,834.421L1224.629,834.421L1348.771,586.138Z" fill={coat} /></G>
            <G transform="matrix(0.599735,0.599735,-0.504606,0.504606,795.603559,-629.947691)"><Path d="M1326.238,586.138L1472.912,834.421L1224.629,834.421L1326.238,586.138Z" fill={inner} /></G>
          </G>
        ) : (
          <G transform="matrix(0.995551,-0.88133,0.54525,0.615914,-1080.579653,1264.375067)">
            <Path d="M1348.771,586.138L1472.912,834.421L1224.629,834.421L1348.771,586.138Z" fill={coat} />
            <G transform="matrix(0.72388,-0.071206,0.038982,1.035369,340.059015,115.16946)"><Path d="M1348.771,586.138L1472.912,834.421L1224.629,834.421L1348.771,586.138Z" fill={inner} /></G>
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}

function Paw({ cx, p }: { cx: number; p: CatPalette }) {
  return (
    <G>
      <Ellipse cx={cx} cy={1541} rx={76} ry={48} fill={p.coat} />
      <Path d={`M${cx - 30} 1516 v26 M${cx} 1511 v31 M${cx + 30} 1516 v26`} stroke={p.ink} strokeWidth={7} strokeLinecap="round" opacity={0.4} />
    </G>
  );
}

// jagged ring for the angry bottle-brush halo
function spiky(cx: number, cy: number, rx: number, ry: number, spikes: number, amp: number): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 ? 1 : 1 + amp;
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
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
