import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Coins, Check, Snowflake } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import CatArt from '@/components/pet/CatArt';
import { usePetStore } from '@/store/petStore';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';

const FREEZE_COST = 50;   // monet za jedno zamrożenie serii
import { SHOP_COLORS, STRIPES, TIER_META } from '@/utils/petShop';
import { paletteById } from '@/utils/catPalettes';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Coat colours + tail stripes — that's the whole shop now. Rooms, hats, glasses, collars
// and held items were cut so the effort goes into the cat itself instead.
export default function PetShop() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { coins, ownedItems, catColor, catStripes, buyColor, buyStripes, spendCoins } = usePetStore();
  const freezes    = useStreakFreezeStore(st => st.freezes);
  const addFreezes = useStreakFreezeStore(st => st.addFreezes);

  const onBuyFreeze = () => {
    haptic.tap();
    if (spendCoins(FREEZE_COST)) { addFreezes(1); haptic.success(); toast.success('Kupione: Zamrożenie serii ❄'); }
    else { haptic.error(); toast.error(`Za mało monet — potrzeba ${FREEZE_COST}`); }
  };

  const onColor = (id: string, cost: number, name: string) => {
    haptic.tap();
    const had = ownedItems.includes(id) || cost === 0;
    if (buyColor(id, cost)) {
      haptic.success();
      toast.success(had ? `${name} — założone` : `Kupione: ${name}`);
    } else {
      haptic.error();
      toast.error(`Za mało monet — potrzeba ${cost}`);
    }
  };
  const onStripes = () => {
    haptic.tap();
    if (buyStripes(STRIPES.cost)) haptic.success();
    else { haptic.error(); toast.error(`Za mało monet — potrzeba ${STRIPES.cost}`); }
  };

  const worn = paletteById(catColor);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Sklep</Text>
        <View style={s.coinPill}><Coins size={13} color="#FBBF24" /><Text style={s.coinTxt}>{coins}</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.preview}>
          <CatArt size={168} expression="happy" palette={worn} stripes={catStripes} animate={false} />
        </View>

        <Text style={s.section}>Kolor futra</Text>
        <View style={s.grid}>
          {SHOP_COLORS.map(sc => {
            const owned = ownedItems.includes(sc.id) || sc.cost === 0;
            const on = catColor === sc.id;
            const tier = TIER_META[sc.tier];
            return (
              <PressableScale key={sc.id} onPress={() => onColor(sc.id, sc.cost, sc.name)}>
                <View style={[s.cell, on && { borderColor: tier.color, backgroundColor: tier.color + '1E' }]}>
                  <View style={[s.swatch, { backgroundColor: sc.palette.coat, borderColor: sc.palette.ear }]}>
                    {on && <Check size={18} color={sc.palette.ink} />}
                  </View>
                  <Text style={s.cellName} numberOfLines={1}>{sc.name}</Text>
                  {owned
                    ? <Text style={[s.cellState, { color: on ? tier.color : c.text.muted }]}>{on ? 'założone' : 'kupione'}</Text>
                    : <View style={s.cost}><Coins size={9} color="#FBBF24" /><Text style={s.costTxt}>{sc.cost}</Text></View>}
                </View>
              </PressableScale>
            );
          })}
        </View>

        <Text style={s.section}>Dodatek</Text>
        <PressableScale onPress={onStripes}>
          <View style={[s.stripeRow, catStripes && { borderColor: '#4DA8FF', backgroundColor: '#4DA8FF1E' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.cellName}>{STRIPES.name}</Text>
              <Text style={s.cellState}>
                {ownedItems.includes('stripes')
                  ? (catStripes ? '● włączone — stuknij, aby wyłączyć' : '○ wyłączone — stuknij, aby włączyć')
                  : 'jedyny wzór, który przeszedł'}
              </Text>
            </View>
            {ownedItems.includes('stripes')
              ? <Check size={18} color="#4DA8FF" />
              : <View style={s.cost}><Coins size={9} color="#FBBF24" /><Text style={s.costTxt}>{STRIPES.cost}</Text></View>}
          </View>
        </PressableScale>

        <Text style={s.section}>Zamrożenia serii</Text>
        <PressableScale onPress={onBuyFreeze}>
          <View style={s.stripeRow}>
            <View style={s.freezeIcon}><Snowflake size={20} color="#7DD3FC" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cellName}>Zamrożenie serii</Text>
              <Text style={s.cellState}>ratuje serię za 1 pominięty dzień · masz: {freezes}</Text>
            </View>
            <View style={s.cost}><Coins size={9} color="#FBBF24" /><Text style={s.costTxt}>{FREEZE_COST}</Text></View>
          </View>
        </PressableScale>

        <Text style={s.hint}>Monety zbierasz questami — za dbanie o SIEBIE.</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 18, fontWeight: '800', color: c.text.primary, flex: 1 },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FBBF2440' },
  coinTxt: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },
  scroll: { paddingHorizontal: spacing[4], gap: spacing[3] },
  preview: { alignItems: 'center', paddingVertical: spacing[3] },
  section: { fontSize: 12, fontWeight: '800', color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  cell: { width: 96, alignItems: 'center', gap: 5, padding: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  swatch: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cellName: { fontSize: 12, fontWeight: '700', color: c.text.primary },
  cellState: { fontSize: 10, color: c.text.muted },
  cost: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  costTxt: { fontSize: 11, fontWeight: '800', color: '#FBBF24' },
  stripeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  freezeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#7DD3FC1E', borderWidth: 1, borderColor: '#7DD3FC44', alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 11, color: c.text.muted, textAlign: 'center', marginTop: spacing[2] },
}));
