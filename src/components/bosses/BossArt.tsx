import { Image, Text, View } from 'react-native';
import { bossPng, poweredBossPng } from '@/utils/bossIcons';
import RadialGlow from '@/components/ui/RadialGlow';

// Boss portrait: real art if we have it (assets/ikonybosów via bossIcons.ts),
// emoji fallback otherwise — same image-or-emoji contract as BadgeArt/badgeIcons.
// Deliberately dumb/presentational: callers that need hit-shake or pop animation
// wrap THIS in their own Animated.View (see app/bosses.tsx) rather than this
// component owning any transform state itself.
//
// `powered` (2026-08-15) — raid bosses (and MAD-campaign bosses) need to read as an
// "enraged/empowered" variant, not just their normal portrait. Two paths:
// 1. Dedicated art exists (`poweredBossPng(id)`, e.g. MADBOSS_GOLEM.png, user-drawn) — use
//    it directly, just with a soft red glow behind for atmosphere (no fake tint needed,
//    it's already a proper "angry" drawing).
// 2. No dedicated art — same halo-behind-shape sticker trick as StreakFlameGlow
//    (counters/StreakFlame.tsx): soft red RadialGlow behind the normal art, plus a
//    slightly enlarged red silhouette (tintColor) peeking out from behind the edges —
//    reads as an aura, not a flat recolor of the character itself.
export default function BossArt({ id, emoji, size = 74, powered = false }: {
  id: string; emoji: string; size?: number; powered?: boolean;
}) {
  const png = bossPng(id);
  const dedicatedPowered = powered ? poweredBossPng(id) : undefined;
  const aura = powered ? '#DC2626' : null;

  if (dedicatedPowered) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <RadialGlow size={size * 1.4} color={aura!} opacity={0.4} />
        <Image source={dedicatedPowered} style={{ width: size, height: size }} resizeMode="contain" />
      </View>
    );
  }

  if (!png) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {aura && <RadialGlow size={size * 1.5} color={aura} opacity={0.5} />}
        <Text style={{ fontSize: size, lineHeight: size * 1.05 }}>{emoji}</Text>
      </View>
    );
  }

  if (!aura) return <Image source={png} style={{ width: size, height: size }} resizeMode="contain" />;

  const silSize = size * 1.16;
  const silOffset = (silSize - size) / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <RadialGlow size={size * 1.6} color={aura} opacity={0.45} />
      <Image
        source={png}
        style={{ position: 'absolute', left: -silOffset, top: -silOffset, width: silSize, height: silSize, tintColor: aura, opacity: 0.55 }}
        resizeMode="contain"
      />
      <Image source={png} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}
