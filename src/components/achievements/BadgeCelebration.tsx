import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Easing } from 'react-native';

import { ACHIEVEMENTS, TIER_COLOR, BAD_COLOR } from '@/utils/achievements';
import { useCelebration } from '@/store/celebrationStore';
import BadgeArt from './BadgeArt';
import Confetti from './Confetti';
import { haptic } from '@/utils/haptics';

// Full-screen celebration shown when a badge unlocks (queued in celebrationStore).
// Tap anywhere to advance to the next one.
export default function BadgeCelebration() {
  const queue = useCelebration(s => s.queue);
  const dismissTop = useCelebration(s => s.dismissTop);
  const topId = queue[0] ?? null;
  const a = topId ? ACHIEVEMENTS.find(x => x.id === topId) : null;

  const scale = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(22)).current;
  const textOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!a) return;
    scale.setValue(0); textY.setValue(22); textOp.setValue(0);
    a.kind === 'bad' ? haptic.error() : haptic.success();
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(textOp, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(textY, { toValue: 0, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, [topId]);

  if (!a) return null;
  const bad = a.kind === 'bad';
  const legendary = a.tier === 4;
  const accent = bad ? BAD_COLOR : TIER_COLOR[a.tier];
  const label = bad ? 'OJ…' : legendary ? '✦ LEGENDARNA ✦' : 'ZDOBYTO!';

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={dismissTop}>
      <Pressable style={[st.backdrop, { backgroundColor: bad ? 'rgba(38,8,8,0.92)' : 'rgba(8,8,16,0.93)' }]} onPress={dismissTop}>
        {!bad && (
          <Confetti colors={legendary ? ['#A855F7', '#FFC83D', '#FFFFFF', '#22D3EE'] : ['#FFC83D', '#2AC68F', '#46B0DE', '#F472B6', '#A855F7']} />
        )}
        <View style={st.center} pointerEvents="none">
          <Animated.View style={[st.badgeWrap, {
            transform: [{ scale }, { rotate: scale.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] }) }],
          }]}>
            <View style={[st.glow, { backgroundColor: accent }]} />
            <BadgeArt id={a.id} tier={a.tier} unlocked size={156} bad={bad} />
          </Animated.View>
          <Animated.View style={{ opacity: textOp, transform: [{ translateY: textY }], alignItems: 'center' }}>
            <Text style={[st.label, { color: accent }]}>{label}</Text>
            <Text style={st.title}>{a.title}</Text>
            <Text style={st.desc}>{a.desc}</Text>
            {!!a.lore && <Text style={st.lore}>„{a.lore}"</Text>}
          </Animated.View>
        </View>
        <Text style={st.hint}>{queue.length > 1 ? `Stuknij — jeszcze ${queue.length - 1}` : 'Stuknij, aby zamknąć'}</Text>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  center: { alignItems: 'center', gap: 22 },
  badgeWrap: { width: 156, height: 156, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.22, top: -32, left: -32 },
  label: { fontSize: 13, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, textAlign: 'center' },
  desc: { fontSize: 14, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  lore: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontStyle: 'italic', marginTop: 12, lineHeight: 19, maxWidth: 300 },
  hint: { position: 'absolute', bottom: 48, color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '600' },
});
