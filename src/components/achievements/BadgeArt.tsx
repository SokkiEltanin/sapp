import { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';
import {
  Flame, Crown, Salad, PiggyBank, Landmark, Banknote, Briefcase, Heart, Award, Lock, Skull,
  Gem, ShieldCheck, Star, Sparkles, Zap, Dumbbell, Medal,
} from 'lucide-react-native';

import { badgePng } from '@/utils/badgeIcons';
import { TIER_COLOR, BAD_COLOR, Tier } from '@/utils/achievements';
import { useColors } from '@/theme/useColors';

// lucide placeholder for ids that don't (yet) have a custom PNG.
const FALLBACK: Record<string, any> = {
  'loyal': Heart, 'habit-streak-7': Flame, 'habit-streak-30': Crown, 'no-junk-7': Salad,
  'saver-1000': PiggyBank, 'saver-5000': PiggyBank, 'saver-10000': Landmark,
  'work-100h': Briefcase, 'work-1000h': Medal, 'payday-first': Banknote,
  // legendary
  'legend-saver': Gem, 'centurion': ShieldCheck, 'unbreakable': Crown, 'year-one': Star,
  'clean-month': Sparkles, 'ultra-walk': Zap, 'titan': Dumbbell,
};

export default function BadgeArt({ id, tier, size = 76, unlocked, bad }: {
  id: string; tier: Tier; size?: number; unlocked: boolean; bad?: boolean;
}) {
  const c = useColors();
  const png = badgePng(id);
  const legendary = tier === 4;
  const ring = !unlocked ? c.text.muted : (bad ? BAD_COLOR : TIER_COLOR[tier]);
  const Icon = FALLBACK[id] ?? (bad ? Skull : Award);

  // Legendary unlocked badges get a pulsing purple halo + gentle breathing scale.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!(legendary && unlocked)) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [legendary, unlocked]);

  const lock = !unlocked && (
    <View style={[st.lockDot, { backgroundColor: c.bg.card, borderColor: c.border.default }]}>
      <Lock size={11} color={c.text.muted} />
    </View>
  );

  const inner = png ? (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={png} style={{ width: size, height: size, opacity: unlocked ? 1 : 0.22 }} resizeMode="contain" />
      {lock}
    </View>
  ) : (
    <View style={[st.medallion, {
      width: size, height: size, borderRadius: size / 2, borderColor: ring + (unlocked ? 'FF' : '55'),
      backgroundColor: unlocked ? ring + '1E' : c.fill.subtle,
    }]}>
      <Icon size={size * 0.4} color={unlocked ? ring : c.text.muted + '99'} strokeWidth={2.2} />
      {lock}
    </View>
  );

  if (legendary && unlocked) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[st.halo, {
          width: size * 1.18, height: size * 1.18, borderRadius: size, backgroundColor: TIER_COLOR[4],
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.32] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) }],
        }]} />
        <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }}>
          {inner}
        </Animated.View>
      </View>
    );
  }
  return inner;
}

const st = StyleSheet.create({
  medallion: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  lockDot: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
});
