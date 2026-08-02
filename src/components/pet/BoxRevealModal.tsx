import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Snowflake } from 'lucide-react-native';
import { CRATE_META } from '@/utils/crates';
import { BoxReward } from '@/utils/petBoxes';
import { haptic } from '@/utils/haptics';

// Cząstka lecąca od (sx,sy) do (ex,ey) — monety/iskry na zewnątrz, ❄ z boków do środka.
function Fly({ sx, sy, ex, ey, emoji, size }: { sx: number; sy: number; ex: number; ey: number; emoji: string; size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, []);
  const tx = a.interpolate({ inputRange: [0, 1], outputRange: [sx, ex] });
  const ty = a.interpolate({ inputRange: [0, 1], outputRange: [sy, ey] });
  const op = a.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const sc = a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.15, 0.7] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }}>
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
}

// Odsłona nagrody ze skrzynki. Nagroda jest JUŻ wylosowana i przyznana — tu tylko
// celebracja: stuknij → skrzynka się trzęsie → wybuch + cząstki + karta z nagrodą.
export default function BoxRevealModal({ visible, reward, boxColor, boxEmoji, onClose }: {
  visible: boolean; reward: BoxReward | null; boxColor: string; boxEmoji: string; onClose: () => void;
}) {
  const [phase, setPhase] = useState<'closed' | 'revealed'>('closed');
  const [flies, setFlies] = useState<{ id: number; sx: number; sy: number; ex: number; ey: number; emoji: string; size: number }[]>([]);
  const shake = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setPhase('closed'); setFlies([]); shake.setValue(0); burst.setValue(0);
  }, [visible]);

  useEffect(() => {
    if (!visible || phase !== 'closed') return;
    const l = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [visible, phase]);

  const meta = reward ? CRATE_META[reward.rarity] : CRATE_META.basic;

  const doOpen = () => {
    if (phase !== 'closed' || !reward) return;
    haptic.medium();
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 90, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 90, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      setPhase('revealed');
      haptic.success();
      Animated.spring(burst, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
      // cząstki: ❄ dla zamrożenia LECĄ Z BOKÓW do środka; reszta wybucha na zewnątrz
      if (reward.type === 'freeze') {
        const n = 14;
        setFlies(Array.from({ length: n }).map((_, i) => {
          const left = i % 2 === 0;
          return { id: i, sx: (left ? -1 : 1) * (150 + Math.random() * 70), sy: -60 + Math.random() * 120,
            ex: (Math.random() - 0.5) * 40, ey: -20 + (Math.random() - 0.5) * 40, emoji: '❄️', size: 20 + Math.random() * 12 };
        }));
      } else {
        const n = reward.rarity === 'mythic' ? 18 : reward.rarity === 'epic' ? 13 : 9;
        const em = reward.type === 'coins' ? '🪙' : '✨';
        setFlies(Array.from({ length: n }).map((_, i) => ({ id: i,
          sx: 0, sy: 0, ex: (Math.random() - 0.5) * 300, ey: -(50 + Math.random() * 230),
          emoji: i % 3 === 0 ? '✨' : em, size: 24 })));
      }
    });
  };

  const rot = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const glowScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const glowOp = burst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 0.28] });
  const cardScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const rewardTitle = reward?.type === 'color' ? 'NOWY KOLOR!' : reward?.type === 'startup' ? 'NOWY STARTUP!' : reward?.type === 'freeze' ? 'ZAMROŻENIE SERII' : 'MONETY';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={phase === 'revealed' ? onClose : undefined}>
        <View style={st.center} pointerEvents="box-none">
          {phase !== 'revealed' ? (
            <>
              <Pressable onPress={doOpen} hitSlop={20}>
                <Animated.View style={{ transform: [{ translateY: bobY }, { rotate: rot }] }}>
                  <View style={[st.box, { borderColor: boxColor }]}>
                    <View style={[st.boxLid, { backgroundColor: boxColor + '55' }]} />
                    <Text style={st.boxEmoji}>{boxEmoji}</Text>
                  </View>
                </Animated.View>
              </Pressable>
              <Text style={st.hint}>Stuknij, żeby otworzyć skrzynkę</Text>
            </>
          ) : (
            <>
              <View style={st.revealWrap}>
                <Animated.View style={[st.glow, { backgroundColor: meta.color, transform: [{ scale: glowScale }], opacity: glowOp }]} />
                {flies.map(f => <Fly key={f.id} sx={f.sx} sy={f.sy} ex={f.ex} ey={f.ey} emoji={f.emoji} size={f.size} />)}
                <Animated.View style={[st.card, { borderColor: meta.color, transform: [{ scale: cardScale }] }]}>
                  <Text style={[st.tier, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                  {reward?.type === 'color' ? (
                    <>
                      <View style={[st.swatch, { backgroundColor: reward.swatch }]} />
                      <Text style={st.rewardName}>{reward.name}</Text>
                    </>
                  ) : reward?.type === 'startup' ? (
                    <>
                      <View style={st.startupSwatch}><Text style={[st.startupMark, { color: reward.ink }]}>Sapp</Text></View>
                      <Text style={st.rewardName}>{reward.name}</Text>
                    </>
                  ) : reward?.type === 'freeze' ? (
                    <>
                      <Snowflake size={40} color="#7DD3FC" />
                      <Text style={st.rewardName}>+{reward.count} zamrożenie</Text>
                    </>
                  ) : (
                    <Text style={st.coins}>+{reward?.coins} 🪙</Text>
                  )}
                  <Text style={st.rewardKind}>{rewardTitle}</Text>
                </Animated.View>
              </View>
              <Pressable style={[st.btn, { backgroundColor: meta.color }]} onPress={onClose}>
                <Text style={st.btnTxt}>Super!</Text>
              </Pressable>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 18 },
  box: { width: 128, height: 104, borderRadius: 16, backgroundColor: '#161A1A', borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  boxLid: { position: 'absolute', top: 0, left: 0, right: 0, height: 30 },
  boxEmoji: { fontSize: 48, marginTop: 12 },
  hint: { color: '#E7EAEA', fontSize: 13.5, fontWeight: '700', textAlign: 'center', maxWidth: 240 },

  revealWrap: { width: 240, height: 220, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110 },
  card: { minWidth: 190, paddingHorizontal: 26, paddingVertical: 20, borderRadius: 20, backgroundColor: '#161A1A', borderWidth: 2, alignItems: 'center', gap: 8 },
  tier: { fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  swatch: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  startupSwatch: { width: 96, height: 46, borderRadius: 10, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  startupMark: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  coins: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  rewardName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  rewardKind: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5 },
  btn: { paddingHorizontal: 26, paddingVertical: 13, borderRadius: 14 },
  btnTxt: { color: '#07160F', fontSize: 15, fontWeight: '900' },
});
