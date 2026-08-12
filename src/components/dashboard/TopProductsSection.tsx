import { memo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import { spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

function TopProductsSection(
  { s, cardBg, accentColor, topProducts }:
  { s: any; cardBg: string; accentColor: string; topProducts: { name: string; count: number; variants: { name: string; count: number }[] }[] },
) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <ShoppingCart size={13} color={accentColor} />
        <Text style={s.cardTitle}>Najczęściej kupowane</Text>
      </View>
      <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
        {topProducts.map((p, i) => {
          const max = topProducts[0].count || 1;
          const medals = ['#FBBF24', '#9CA3AF', '#B45309', accentColor, accentColor];
          const hasVariants = p.variants.length > 1;
          const open = expanded === p.name;
          return (
            <TouchableOpacity key={p.name} activeOpacity={hasVariants ? 0.7 : 1}
              onPress={() => { if (hasVariants) { haptic.tap(); setExpanded(open ? null : p.name); } }}
              style={s.topRow}>
              <View style={[s.topRank, { backgroundColor: medals[i] + '22', borderColor: medals[i] + '55' }]}>
                <Text style={[s.topRankText, { color: medals[i] }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.topNameRow}>
                  <Text style={s.topName} numberOfLines={1}>{p.name}{hasVariants ? ` · ${p.variants.length} rodz.` : ''}</Text>
                  <Text style={s.topCount}>×{p.count}</Text>
                </View>
                <View style={s.topBarTrack}>
                  <View style={[s.topBarFill, { width: `${Math.max(8, (p.count / max) * 100)}%`, backgroundColor: accentColor }]} />
                </View>
                {open && (
                  <View style={s.variantWrap}>
                    {p.variants.map(v => (
                      <View key={v.name} style={s.variantRow}>
                        <Text style={s.variantName} numberOfLines={1}>{v.name}</Text>
                        <Text style={s.variantCount}>×{v.count}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default memo(TopProductsSection);
