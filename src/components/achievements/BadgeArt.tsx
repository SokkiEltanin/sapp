import { View, Image, StyleSheet } from 'react-native';
import {
  Flame, Crown, Salad, PiggyBank, Landmark, Banknote, Briefcase, Heart, Award, Lock, Skull,
} from 'lucide-react-native';

import { badgePng } from '@/utils/badgeIcons';
import { TIER_COLOR, BAD_COLOR } from '@/utils/achievements';
import { useColors } from '@/theme/useColors';

// lucide placeholder for ids that don't (yet) have a custom PNG.
const FALLBACK: Record<string, any> = {
  'loyal': Heart, 'habit-streak-7': Flame, 'habit-streak-30': Crown, 'no-junk-7': Salad,
  'saver-1000': PiggyBank, 'saver-5000': PiggyBank, 'saver-10000': Landmark,
  'work-100h': Briefcase, 'payday-first': Banknote,
};

export default function BadgeArt({ id, tier, size = 76, unlocked, bad }: {
  id: string; tier: 1 | 2 | 3; size?: number; unlocked: boolean; bad?: boolean;
}) {
  const c = useColors();
  const png = badgePng(id);
  const ring = !unlocked ? c.text.muted : (bad ? BAD_COLOR : TIER_COLOR[tier]);
  const Icon = FALLBACK[id] ?? (bad ? Skull : Award);

  const lock = !unlocked && (
    <View style={[st.lockDot, { backgroundColor: c.bg.card, borderColor: c.border.default }]}>
      <Lock size={11} color={c.text.muted} />
    </View>
  );

  if (png) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={png} style={{ width: size, height: size, opacity: unlocked ? 1 : 0.22 }} resizeMode="contain" />
        {lock}
      </View>
    );
  }

  return (
    <View style={[st.medallion, {
      width: size, height: size, borderRadius: size / 2, borderColor: ring + (unlocked ? 'FF' : '55'),
      backgroundColor: unlocked ? ring + '1E' : c.fill.subtle,
    }]}>
      <Icon size={size * 0.4} color={unlocked ? ring : c.text.muted + '99'} strokeWidth={2.2} />
      {lock}
    </View>
  );
}

const st = StyleSheet.create({
  medallion: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  lockDot: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
