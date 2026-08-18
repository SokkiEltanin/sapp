import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { usePetStore } from '@/store/petStore';
import { CRATE_META, CrateTier } from '@/utils/crates';
import { COMBAT_ITEMS, CombatItemId } from '@/utils/combatItems';
import { haptic } from '@/utils/haptics';

// A coin/spark that flies outward and fades on the reveal burst.
function Fly({ dx, dy, emoji }: { dx: number; dy: number; emoji: string }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, []);
  const tx = a.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const ty = a.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const op = a.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const sc = a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.15, 0.7] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }}>
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
    </Animated.View>
  );
}

export default function CrateModal({ visible, onClose, onOpened }: { visible: boolean; onClose: () => void; onOpened?: () => void }) {
  const openCrate = usePetStore(s => s.openCrate);
  const pending = usePetStore(s => s.pendingCrates);

  const [phase, setPhase] = useState<'closed' | 'opening' | 'revealed'>('closed');
  const [result, setResult] = useState<{ tier: CrateTier; coins: number; itemDropped: CombatItemId | null; itemLeveledUp: { id: CombatItemId; level: number } | null } | null>(null);
  const [shown, setShown] = useState(0);
  const [flies, setFlies] = useState<{ id: number; dx: number; dy: number; emoji: string }[]>([]);

  const shake = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setPhase('closed'); setResult(null); setShown(0); setFlies([]);
    shake.setValue(0); burst.setValue(0);
  }, [visible]);

  // idle bob while closed
  useEffect(() => {
    if (!visible || phase !== 'closed') return;
    const l = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [visible, phase]);

  const doOpen = () => {
    if (phase !== 'closed') return;
    haptic.medium();
    setPhase('opening');
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 90, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 90, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.6, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      const roll = openCrate();
      if (!roll) { onClose(); return; }
      setResult(roll);
      setPhase('revealed');
      haptic.success();
      Animated.spring(burst, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
      const n = roll.tier === 'legendary' ? 18 : roll.tier === 'epic' ? 13 : roll.tier === 'rare' ? 9 : 6;
      setFlies(Array.from({ length: n }).map((_, i) => ({ id: i, dx: (Math.random() - 0.5) * 280, dy: -(50 + Math.random() * 230), emoji: i % 3 === 0 ? '✨' : '🪙' })));
      let c = 0; const step = Math.max(1, Math.round(roll.coins / 24));
      const iv = setInterval(() => { c = Math.min(roll.coins, c + step); setShown(c); if (c >= roll.coins) clearInterval(iv); }, 30);
      onOpened?.();
    });
  };

  const meta = result ? CRATE_META[result.tier] : CRATE_META.basic;
  const rot = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const glowScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const glowOp = burst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 0.28] });
  const cardScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={phase === 'revealed' ? onClose : undefined}>
        <View style={st.center} pointerEvents="box-none">
          {phase !== 'revealed' ? (
            <>
              <Pressable onPress={doOpen} hitSlop={20}>
                <Animated.View style={{ transform: [{ translateY: bobY }, { rotate: rot }] }}>
                  {/* wooden sardine crate */}
                  <View style={st.crate}>
                    <View style={st.crateLid} />
                    <View style={st.crateBoardV} />
                    <Text style={st.crateFish}>🐟</Text>
                  </View>
                </Animated.View>
              </Pressable>
              <Text style={st.hint}>{phase === 'opening' ? 'Otwieram…' : 'Stuknij, żeby otworzyć skrzynkę sardynek'}</Text>
              {pending > 1 && phase === 'closed' && <Text style={st.more}>Masz jeszcze {pending - 1} do otwarcia</Text>}
            </>
          ) : (
            <>
              <View style={st.revealWrap}>
                <Animated.View style={[st.glow, { backgroundColor: meta.color, transform: [{ scale: glowScale }], opacity: glowOp }]} />
                {flies.map(f => <Fly key={f.id} dx={f.dx} dy={f.dy} emoji={f.emoji} />)}
                <Animated.View style={[st.card, { borderColor: meta.color, transform: [{ scale: cardScale }] }]}>
                  <Text style={[st.tier, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                  <Text style={st.coins}>+{shown} 🪙</Text>
                  <Text style={st.fish2}>🐟</Text>
                  {result?.itemDropped && (
                    <Text style={st.itemDrop}>🎁 Nowy item bojowy: {COMBAT_ITEMS[result.itemDropped].name}!</Text>
                  )}
                  {result?.itemLeveledUp && (
                    <Text style={st.itemDrop}>⬆️ {COMBAT_ITEMS[result.itemLeveledUp.id].name} +1 poziom (Lv{result.itemLeveledUp.level})!</Text>
                  )}
                </Animated.View>
              </View>
              <Pressable style={[st.btn, { backgroundColor: meta.color }]} onPress={onClose}>
                <Text style={st.btnTxt}>{pending > 0 ? `Otwórz następną (${pending})` : 'Super!'}</Text>
              </Pressable>
              {pending > 0 && <Pressable onPress={() => { setPhase('closed'); setResult(null); setShown(0); setFlies([]); shake.setValue(0); burst.setValue(0); }} hitSlop={10}><Text style={st.again}>otwórz teraz →</Text></Pressable>}
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

  crate: { width: 128, height: 104, borderRadius: 14, backgroundColor: '#8A5E38', borderWidth: 4, borderColor: '#5E3F24', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  crateLid: { position: 'absolute', top: 0, left: 0, right: 0, height: 26, backgroundColor: '#6E4A2B', borderBottomWidth: 3, borderBottomColor: '#5E3F24' },
  crateBoardV: { position: 'absolute', top: 0, bottom: 0, width: 4, backgroundColor: '#5E3F24', opacity: 0.5 },
  crateFish: { fontSize: 46, marginTop: 14 },
  hint: { color: '#E7EAEA', fontSize: 13.5, fontWeight: '700', textAlign: 'center', maxWidth: 240 },
  more: { color: '#9AA6B2', fontSize: 11.5, fontWeight: '600' },

  revealWrap: { width: 240, height: 200, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110 },
  card: { minWidth: 190, paddingHorizontal: 26, paddingVertical: 20, borderRadius: 20, backgroundColor: '#161A1A', borderWidth: 2, alignItems: 'center', gap: 6 },
  tier: { fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  coins: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  fish2: { fontSize: 26 },
  itemDrop: { color: '#FBBF24', fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  btn: { paddingHorizontal: 26, paddingVertical: 13, borderRadius: 14 },
  btnTxt: { color: '#07160F', fontSize: 15, fontWeight: '900' },
  again: { color: '#9AA6B2', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
});
