import { Image, Text } from 'react-native';
import { bossPng } from '@/utils/bossIcons';

// Boss portrait: real art if we have it (assets/ikonybosów via bossIcons.ts),
// emoji fallback otherwise — same image-or-emoji contract as BadgeArt/badgeIcons.
// Deliberately dumb/presentational: callers that need hit-shake or pop animation
// wrap THIS in their own Animated.View (see app/bosses.tsx) rather than this
// component owning any transform state itself.
export default function BossArt({ id, emoji, size = 74 }: { id: string; emoji: string; size?: number }) {
  const png = bossPng(id);
  if (!png) return <Text style={{ fontSize: size, lineHeight: size * 1.05 }}>{emoji}</Text>;
  return <Image source={png} style={{ width: size, height: size }} resizeMode="contain" />;
}
