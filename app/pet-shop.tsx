import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronLeft, Coins, Check } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import Blob from '@/components/pet/Blob';
import { usePetStore } from '@/store/petStore';
import { COSMETICS, SLOT_ORDER, SLOT_LABEL, Cosmetic } from '@/utils/petShop';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

export default function PetShop() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { coins, ownedItems, equipped, buyItem, equip } = usePetStore();

  const act = (item: Cosmetic) => {
    const owned = ownedItems.includes(item.id);
    const isEq = equipped[item.slot] === item.id;
    if (!owned) {
      if (coins < item.cost) { haptic.error(); toast.info(`Brakuje ${item.cost - coins} 🪙`); return; }
      buyItem(item.id, item.cost);
      equip(item.slot, item.id);          // auto-wear on purchase
      haptic.success(); toast.success(`Kupione: ${item.name}`);
    } else if (isEq) {
      equip(item.slot, null); haptic.tap();
    } else {
      equip(item.slot, item.id); haptic.success();
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Sklep</Text>
        <View style={s.coinPill}>
          <Coins size={13} color="#FBBF24" />
          <Text style={s.coinTxt}>{coins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {SLOT_ORDER.map(slot => (
          <View key={slot}>
            <Text style={s.section}>{SLOT_LABEL[slot]}</Text>
            <View style={s.grid}>
              {COSMETICS.filter(i => i.slot === slot).map(item => {
                const owned = ownedItems.includes(item.id);
                const isEq = equipped[item.slot] === item.id;
                const afford = coins >= item.cost;
                return (
                  <PressableScale key={item.id} onPress={() => act(item)} style={s.cell}>
                    <View style={[s.swatch, isEq && { borderColor: '#2AC68F', borderWidth: 2 }, !owned && !afford && { opacity: 0.5 }]}>
                      {item.colors
                        ? <><LinearGradient colors={item.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                            <Text style={s.swatchEmoji}>{item.decor?.[0] ?? '🏠'}</Text></>
                        : <Blob color="#4FC98E" expression="happy" size={58} animate={false} equipped={{ [item.slot]: item.id }} />}
                      {isEq && <View style={s.eqBadge}><Check size={12} color="#fff" /></View>}
                    </View>
                    <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                    {owned
                      ? <Text style={[s.tag, { color: isEq ? '#2AC68F' : c.text.muted }]}>{isEq ? 'Założone' : 'Załóż'}</Text>
                      : <View style={s.priceRow}><Coins size={10} color={afford ? '#FBBF24' : c.text.muted} /><Text style={[s.price, { color: afford ? '#FBBF24' : c.text.muted }]}>{item.cost}</Text></View>}
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ))}
        <Text style={s.foot}>Monety zdobywasz questami na stronie pupila.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, height: 30, borderWidth: 1, borderColor: '#FBBF2440' },
  coinTxt: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8] },

  section: { fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[3], marginBottom: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  cell: { width: '22%', alignItems: 'center' },
  swatch: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: c.bg.card },
  swatchEmoji: { fontSize: 30 },
  eqBadge: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#2AC68F', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 11.5, fontWeight: '700', color: c.text.secondary, marginTop: 5 },
  tag: { fontSize: 10.5, fontWeight: '800', marginTop: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  price: { fontSize: 11, fontWeight: '800' },
  foot: { fontSize: 11.5, color: c.text.muted, textAlign: 'center', marginTop: spacing[5] },
});
