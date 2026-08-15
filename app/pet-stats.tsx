import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Coins, Swords, Heart, Zap, Lock, Check } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PupilNavbar from '@/components/pet/PupilNavbar';
import { usePetStore, levelFromXp, catMaxHp, combatItemSlotsFor } from '@/store/petStore';
import { bossBonuses, atkPower, atkMultiplier, dailyAttempts, BASE_ATK } from '@/utils/bosses';
import { COMBAT_ITEMS, CombatItemId, combatItemUpgradeCost } from '@/utils/combatItems';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const ITEM_IDS = Object.keys(COMBAT_ITEMS) as CombatItemId[];

// Ulepszenia HP/ATK — przeniesione tu z pet-shop.tsx (2026-08-10, user: "ulepszenia statystyk
// niech będą w statystykach a nie w sklepie"). Trwały, rosnący koszt, ta sama krzywa dla obu.
const HP_UPGRADE_AMOUNT = 20;   // +HP za jeden zakup
const hpUpgradeCost = (currentBonus: number) => 40 + Math.floor(currentBonus / HP_UPGRADE_AMOUNT) * 15;
const ATK_UPGRADE_AMOUNT = 5;   // +ATK za jeden zakup — mniejszy krok niż HP, bo atkStatBonus
// dokłada się wprost do BASE_ATK i mnoży się przez atkMultiplier (mocniejszy stat na monetę).
const atkUpgradeCost = (currentBonus: number) => 40 + Math.floor(currentBonus / ATK_UPGRADE_AMOUNT) * 15;

export default function PetStats() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const {
    coins, xp, ownedItems, defeatedBosses, catMaxHpBonus, atkStatBonus, buyMaxHp, buyAtkStat,
    ownedCombatItems, equippedCombatItems, upgradeCombatItem, equipCombatItem, unequipCombatItem,
  } = usePetStore();

  const lvl = levelFromXp(xp);
  const bonuses = useMemo(() => bossBonuses(ownedItems), [ownedItems]);
  const power = atkPower(atkStatBonus, lvl.level, bonuses);
  const mult = atkMultiplier(lvl.level, bonuses);
  const maxHp = catMaxHp(catMaxHpBonus);
  const attempts = dailyAttempts(bonuses.energyMult);
  const hpCost = hpUpgradeCost(catMaxHpBonus);
  const atkCost = atkUpgradeCost(atkStatBonus);
  const itemSlots = combatItemSlotsFor(lvl.level);

  // Posiadane na górze (user, 2026-08-11) — reszta ("???" zablokowane) niżej, stabilne
  // sortowanie więc kolejność w obrębie każdej grupy zostaje jak w COMBAT_ITEMS.
  const sortedItemIds = useMemo(
    () => [...ITEM_IDS].sort((a, b) => (ownedCombatItems[a] ? 0 : 1) - (ownedCombatItems[b] ? 0 : 1)),
    [ownedCombatItems],
  );

  // Themowany ConfirmDialog zamiast Alert.alert (2026-08-15, user: "potwierdzenia nie są
  // dokończone" — natywny szary Alert nie pasuje do reszty apki). Ten sam wzorzec co inne
  // ekrany (patrz komentarz w ConfirmDialog.tsx) — kontrolowany stan, nie globalny hook.
  const [pendingUpgrade, setPendingUpgrade] = useState<{ name: string; cost: number; onYes: () => void } | null>(null);
  const confirmUpgrade = (name: string, cost: number, onYes: () => void) => {
    setPendingUpgrade({ name, cost, onYes });
  };
  const onBuyMaxHp = () => {
    haptic.tap();
    if (coins < hpCost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${hpCost}`); return; }
    confirmUpgrade('Ulepszenie HP kotka', hpCost, () => {
      if (buyMaxHp(hpCost, HP_UPGRADE_AMOUNT)) { haptic.success(); toast.success(`Kupione: +${HP_UPGRADE_AMOUNT} max HP kotka`); }
    });
  };
  const onBuyAtk = () => {
    haptic.tap();
    if (coins < atkCost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${atkCost}`); return; }
    confirmUpgrade('Ulepszenie ATK', atkCost, () => {
      if (buyAtkStat(atkCost, ATK_UPGRADE_AMOUNT)) { haptic.success(); toast.success(`Kupione: +${ATK_UPGRADE_AMOUNT} ATK`); }
    });
  };
  const onToggleEquip = (id: CombatItemId) => {
    haptic.tap();
    if (equippedCombatItems.includes(id)) { unequipCombatItem(id); return; }
    if (!equipCombatItem(id)) { haptic.error(); toast.error(`Masz już ${itemSlots} założone itemy — zdejmij coś najpierw`); return; }
    haptic.success();
  };
  const onUpgradeItem = (id: CombatItemId, level: number, maxLevel: number) => {
    haptic.tap();
    if (level >= maxLevel) return;
    const cost = combatItemUpgradeCost(level);
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmUpgrade(COMBAT_ITEMS[id].name, cost, () => {
      if (upgradeCombatItem(id, cost, maxLevel)) { haptic.success(); toast.success(`${COMBAT_ITEMS[id].name} → poziom ${level + 1}`); }
    });
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Statystyki</Text>
        <View style={s.coinPill}>
          <Coins size={13} color="#FBBF24" />
          <Text style={s.coinTxt}>{coins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── SIŁA BOJOWA ──────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Siła bojowa</Text>
        <View style={s.statGrid}>
          <View style={[s.statCard, { borderColor: '#F8717144', backgroundColor: '#F8717112' }]}>
            <Swords size={18} color="#F87171" />
            <Text style={s.statVal}>{Math.round(power)}</Text>
            <Text style={s.statLabel}>Moc ataku</Text>
            <Text style={s.statSub}>({BASE_ATK}+{atkStatBonus}) × {mult.toFixed(2)}</Text>
            <TouchableOpacity onPress={onBuyAtk} style={[s.buyPill, { marginTop: 6 }]} activeOpacity={0.8}>
              <Swords size={10} color="#F87171" /><Text style={s.buyPillTxt}>+{ATK_UPGRADE_AMOUNT}</Text>
              <Coins size={10} color="#FBBF24" /><Text style={s.buyPillTxt}>{atkCost}</Text>
            </TouchableOpacity>
          </View>
          <View style={[s.statCard, { borderColor: '#2AC68F44', backgroundColor: '#2AC68F12' }]}>
            <Heart size={18} color="#2AC68F" />
            <Text style={s.statVal}>{maxHp}</Text>
            <Text style={s.statLabel}>Max HP kotka</Text>
            <Text style={s.statSub}>bazowe 100 + {catMaxHpBonus}</Text>
            <TouchableOpacity onPress={onBuyMaxHp} style={[s.buyPill, { marginTop: 6 }]} activeOpacity={0.8}>
              <Heart size={10} color="#2AC68F" /><Text style={s.buyPillTxt}>+{HP_UPGRADE_AMOUNT}</Text>
              <Coins size={10} color="#FBBF24" /><Text style={s.buyPillTxt}>{hpCost}</Text>
            </TouchableOpacity>
          </View>
          <View style={[s.statCard, { borderColor: '#38BDF844', backgroundColor: '#38BDF812' }]}>
            <Zap size={18} color="#38BDF8" />
            <Text style={s.statVal}>{attempts}</Text>
            <Text style={s.statLabel}>Prób dziennie</Text>
            <Text style={s.statSub}>{bonuses.energyMult > 0 ? `+${Math.round(bonuses.energyMult * 100)}% z łupu` : 'baza 3'}</Text>
          </View>
          <View style={[s.statCard, { borderColor: '#FBBF2444', backgroundColor: '#FBBF2412' }]}>
            <Text style={s.lvlBadge}>Lv{lvl.level}</Text>
            <Text style={s.statVal}>{lvl.inLevel}/{lvl.needed}</Text>
            <Text style={s.statLabel}>Doświadczenie</Text>
            <View style={s.xpBarTrack}><View style={[s.xpBarFill, { width: `${Math.round(lvl.progress * 100)}%` }]} /></View>
          </View>
        </View>
        {(bonuses.dodge > 0 || bonuses.crit > 0) && (
          <Text style={s.blurb}>Z łupu bossów: {bonuses.dodge > 0 ? `+${Math.round(bonuses.dodge * 100)}% unik ` : ''}{bonuses.crit > 0 ? `+${Math.round(bonuses.crit * 100)}% kryt` : ''}</Text>
        )}

        {/* ── EKWIPUNEK BOJOWY ─────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Ekwipunek bojowy ({equippedCombatItems.length}/{itemSlots} założone)</Text>
        <Text style={s.blurb}>Losowany ze skrzynek z głaskania. Załóż do {itemSlots} naraz (rośnie z poziomem, max 6) — działają w każdej walce kampanii.</Text>
        <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
          {sortedItemIds.map(id => {
            const def = COMBAT_ITEMS[id];
            const level = ownedCombatItems[id] ?? 0;
            const owned = level > 0;
            const equipped = equippedCombatItems.includes(id);
            const maxed = level >= def.maxLevel;
            const cost = combatItemUpgradeCost(level);
            return (
              <View key={id} style={[s.itemRow, !owned && s.itemRowLocked]}>
                <View style={[s.itemIcon, !owned && s.itemIconLocked]}>
                  {owned
                    ? <Image source={def.icons[Math.min(level, def.icons.length) - 1]} style={{ width: 30, height: 30 }} resizeMode="contain" />
                    : <Lock size={18} color={c.text.muted} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cellName}>{owned ? def.name : '???'}</Text>
                  <Text style={s.cellState} numberOfLines={2}>{owned ? def.desc : 'Nieznaleziony — spróbuj skrzynki z głaskania'}</Text>
                  {owned && def.maxLevel > 1 && <Text style={s.itemLevel}>poziom {level}/{def.maxLevel}</Text>}
                </View>
                {owned && (
                  <View style={{ gap: 6, alignItems: 'flex-end' }}>
                    <TouchableOpacity onPress={() => onToggleEquip(id)} style={[s.equipPill, equipped && s.equipPillOn]} activeOpacity={0.8}>
                      {equipped && <Check size={11} color={c.bg.primary} />}
                      <Text style={[s.equipPillTxt, equipped && s.equipPillTxtOn]}>{equipped ? 'Założone' : 'Załóż'}</Text>
                    </TouchableOpacity>
                    {!maxed && (
                      <TouchableOpacity onPress={() => onUpgradeItem(id, level, def.maxLevel)} style={s.buyPill} activeOpacity={0.8}>
                        <Coins size={10} color="#FBBF24" /><Text style={s.buyPillTxt}>{cost}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <PupilNavbar current="stats" />
      <ConfirmDialog
        visible={!!pendingUpgrade}
        title="Potwierdź ulepszenie"
        message={pendingUpgrade ? `${pendingUpgrade.name} — ${pendingUpgrade.cost} monet` : ''}
        confirmLabel="Ulepsz"
        cancelLabel="Anuluj"
        destructive={false}
        onConfirm={() => { pendingUpgrade?.onYes(); setPendingUpgrade(null); }}
        onCancel={() => setPendingUpgrade(null)}
      />
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2] },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.card },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FBBF2440' },
  coinTxt: { fontSize: 12, fontWeight: '800', color: '#FBBF24' },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: 120, gap: spacing[2] },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: c.text.primary, marginTop: spacing[3], marginBottom: spacing[1] },
  blurb: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  statCard: { width: '48%', borderRadius: radius.lg, borderWidth: 1, padding: spacing[3], gap: 2 },
  statVal: { fontSize: 20, fontWeight: '800', color: c.text.primary, marginTop: 4 },
  statLabel: { fontSize: 11, color: c.text.secondary, fontWeight: '600' },
  statSub: { fontSize: 9.5, color: c.text.muted },
  lvlBadge: { fontSize: 11, fontWeight: '800', color: '#FBBF24' },
  xpBarTrack: { height: 5, borderRadius: 3, backgroundColor: c.fill.subtle, marginTop: 4, overflow: 'hidden' },
  xpBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#FBBF24' },

  cellName: { fontSize: 12, fontWeight: '700', color: c.text.primary },
  cellState: { fontSize: 10, color: c.text.muted },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  itemRowLocked: { opacity: 0.55 },
  itemIcon: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fill.subtle },
  itemIconLocked: { backgroundColor: 'transparent' },
  itemLevel: { fontSize: 9.5, color: '#FBBF24', fontWeight: '700', marginTop: 2 },
  equipPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: c.border.default },
  equipPillOn: { backgroundColor: '#2AC68F', borderColor: '#2AC68F' },
  equipPillTxt: { fontSize: 10.5, fontWeight: '700', color: c.text.secondary },
  equipPillTxtOn: { color: c.bg.primary },
  buyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#FBBF2440' },
  buyPillTxt: { fontSize: 10.5, fontWeight: '800', color: '#FBBF24' },
}));
