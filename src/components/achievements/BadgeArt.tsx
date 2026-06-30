import { View, Image, StyleSheet } from 'react-native';
import {
  Flame, Crown, CheckCheck, Salad, Leaf, Coins, PiggyBank, Landmark, Banknote,
  Briefcase, ScanLine, ReceiptText, Smile, Brain, Footprints, FileCheck, Award, Lock,
} from 'lucide-react-native';

import { badgePng } from '@/utils/badgeIcons';
import { TIER_COLOR } from '@/utils/achievements';
import { useColors } from '@/theme/useColors';

// lucide placeholder per achievement id — shown until a custom PNG is dropped in.
const FALLBACK: Record<string, any> = {
  'habit-streak-3': Flame, 'habit-streak-7': Flame, 'habit-streak-30': Crown, 'habit-all-day': CheckCheck,
  'no-junk-3': Salad, 'no-junk-7': Salad, 'no-junk-14': Leaf,
  'saver-first': Coins, 'saver-1000': PiggyBank, 'saver-5000': PiggyBank, 'saver-10000': Landmark,
  'work-payday-first': Banknote, 'work-50h': Briefcase, 'work-100h': Briefcase,
  'receipts-25': ScanLine, 'receipts-100': ReceiptText, 'mood-7': Smile, 'mood-30': Brain,
  'steps-10k': Footprints, 'bills-first': FileCheck,
};

export default function BadgeArt({ id, tier, size = 76, unlocked }: {
  id: string; tier: 1 | 2 | 3; size?: number; unlocked: boolean;
}) {
  const c = useColors();
  const png = badgePng(id);
  const ring = unlocked ? TIER_COLOR[tier] : c.text.muted;
  const Icon = FALLBACK[id] ?? Award;

  if (png) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={png} style={{ width: size, height: size, opacity: unlocked ? 1 : 0.22 }} resizeMode="contain" />
        {!unlocked && (
          <View style={[st.lockDot, { backgroundColor: c.bg.card, borderColor: c.border.default }]}>
            <Lock size={11} color={c.text.muted} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[st.medallion, {
      width: size, height: size, borderRadius: size / 2, borderColor: ring + (unlocked ? 'FF' : '55'),
      backgroundColor: unlocked ? ring + '1E' : c.fill.subtle,
    }]}>
      <Icon size={size * 0.4} color={unlocked ? ring : c.text.muted + '99'} strokeWidth={2.2} />
      {!unlocked && (
        <View style={[st.lockDot, { backgroundColor: c.bg.card, borderColor: c.border.default }]}>
          <Lock size={11} color={c.text.muted} />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  medallion: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  lockDot: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
