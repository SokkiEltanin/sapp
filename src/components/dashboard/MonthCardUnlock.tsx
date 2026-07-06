import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Easing } from 'react-native';
import Confetti from '@/components/achievements/Confetti';
import MonthWrappedCard from '@/components/dashboard/MonthWrappedCard';
import { MonthCard } from '@/utils/monthCards';
import { haptic } from '@/utils/haptics';

// Full-screen "you unlocked a new month card" moment. Reuses the confetti burst,
// tinted to the card's rarity tier, and flips the card in.
export default function MonthCardUnlock({ card, onDismiss }: { card: MonthCard; onDismiss: () => void }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const op = useRef(new Animated.Value(0)).current;
  const labelY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    haptic.success();
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(labelY, { toValue: 0, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  const legendary = card.tierRank >= 4;
  const confettiColors = legendary
    ? [card.accent, '#FFFFFF', '#FDE047', '#22D3EE']
    : [card.accent, '#FFFFFF', card.palette[1]];

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={st.backdrop} onPress={onDismiss}>
        <Confetti colors={confettiColors} />
        <View style={st.center} pointerEvents="none">
          <Animated.View style={{ opacity: op, transform: [{ translateY: labelY }], alignItems: 'center', marginBottom: 18 }}>
            <Text style={[st.kicker, { color: card.accent }]}>{legendary ? '✦ LEGENDARNA KARTA ✦' : 'NOWA KARTA MIESIĄCA'}</Text>
            <Text style={st.title}>{card.label}</Text>
          </Animated.View>
          <Animated.View style={{ opacity: op, transform: [{ scale }], width: '100%' }}>
            <MonthWrappedCard card={card} />
          </Animated.View>
        </View>
        <Text style={st.hint}>Stuknij, aby dodać do kolekcji</Text>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(8,8,16,0.94)' },
  center: { width: '100%', maxWidth: 420, alignItems: 'center' },
  kicker: { fontSize: 13, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, textAlign: 'center' },
  hint: { position: 'absolute', bottom: 48, color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '600' },
});
