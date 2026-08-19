import { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { X, Check } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { usePetStore } from '@/store/petStore';
import {
  GEAR_SLOTS, GearSlot, GearRarity, RARITY_META, SLOT_META, SLOT_STAT,
  gearById, gearBySlot, gearStatValue,
} from '@/utils/gear';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const STAT_LABEL: Record<string, string> = {
  critPct: 'krytyk', flatHp: 'HP', dodgePct: 'unik', atkPct: 'atak', energyMultPct: 'energia', coinsPct: 'monety',
};
const STAT_UNIT: Record<string, string> = {
  critPct: '%', flatHp: '', dodgePct: '%', atkPct: '%', energyMultPct: '%', coinsPct: '%',
};
const fmtStat = (stat: string, v: number) => stat === 'flatHp' ? `+${Math.round(v)}` : `+${(v * 100).toFixed(1)}%`;

// 6 slotów ekwipunku przy kotku (2026-08-19, krok 7 planu z NEXT_STEPS.md "SYSTEM
// EKWIPUNKU"). Staty JESZCZE nic nie robią w walce/ekonomii (krok 8, świadomie osobny —
// patrz komentarz w petStore.ts przy ownedGear) — to czysto zarządzanie kolekcją: patrz
// jaki masz item w slocie, otwórz slot → wybierz spośród POSIADANYCH z porównaniem do
// aktualnie założonego.
export default function GearPanel() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { ownedGear, equippedGear } = usePetStore();
  const [openSlot, setOpenSlot] = useState<GearSlot | null>(null);

  const slotButton = (slot: GearSlot) => {
    const equippedId = equippedGear[slot];
    const equippedItem = equippedId ? gearById(equippedId) : undefined;
    const rarity = equippedId ? ownedGear[equippedId] : undefined;
    const meta = rarity ? RARITY_META[rarity] : null;
    const ownedCount = gearBySlot(slot).filter(g => ownedGear[g.id]).length;
    return (
      <PressableScale key={slot} onPress={() => { haptic.tap(); setOpenSlot(slot); }}>
        <View style={[s.slot, meta && { borderColor: meta.color, backgroundColor: meta.color + '1A' }]}>
          <Text style={s.slotIcon}>{SLOT_META[slot].icon}</Text>
          <Text style={s.slotLabel} numberOfLines={1}>{equippedItem ? equippedItem.name : SLOT_META[slot].label}</Text>
          {ownedCount > 0 && !equippedId && <View style={s.slotDot} />}
        </View>
      </PressableScale>
    );
  };

  return (
    <>
      <View style={s.row}>{GEAR_SLOTS.map(slotButton)}</View>
      <GearSlotModal slot={openSlot} onClose={() => setOpenSlot(null)} />
    </>
  );
}

function GearSlotModal({ slot, onClose }: { slot: GearSlot | null; onClose: () => void }) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { ownedGear, equippedGear, equipGear, unequipGear } = usePetStore();

  if (!slot) return null;
  const items = gearBySlot(slot).filter(g => ownedGear[g.id]);
  const equippedId = equippedGear[slot];
  const equippedItem = equippedId ? gearById(equippedId) : undefined;
  const equippedRarity = equippedId ? ownedGear[equippedId] : undefined;
  const equippedVal = equippedItem && equippedRarity ? gearStatValue(equippedItem, equippedRarity) : 0;
  const stat = SLOT_STAT[slot];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{SLOT_META[slot].icon} {SLOT_META[slot].label}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color={c.text.primary} /></TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <Text style={s.emptyTxt}>Brak jeszcze itemów do tego slotu — zdobądź w skrzynkach albo sklepie dnia.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {items.map(item => {
                const rarity = ownedGear[item.id]!;
                const meta = RARITY_META[rarity];
                const val = gearStatValue(item, rarity);
                const delta = val - equippedVal;
                const isEquipped = equippedId === item.id;
                return (
                  <View key={item.id} style={[s.itemRow, { borderColor: meta.color + '55' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName}>{item.name}</Text>
                      <Text style={[s.itemRarity, { color: meta.color }]}>{meta.label}</Text>
                      <Text style={s.itemStat}>{STAT_LABEL[stat]}: {fmtStat(stat, val)}{STAT_UNIT[stat] === '' ? ' HP' : ''}</Text>
                      {!isEquipped && equippedItem && (
                        <Text style={[s.deltaTxt, { color: delta > 0 ? '#2AC68F' : delta < 0 ? '#EF4444' : c.text.muted }]}>
                          {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {delta === 0 ? 'tyle samo' : `${fmtStat(stat, Math.abs(delta))} vs założony`}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => { haptic.tap(); isEquipped ? unequipGear(slot) : equipGear(item.id); }}
                      style={[s.equipBtn, isEquipped && s.equipBtnOn]}
                    >
                      {isEquipped && <Check size={13} color={c.bg.primary} />}
                      <Text style={[s.equipBtnTxt, isEquipped && s.equipBtnTxtOn]}>{isEquipped ? 'Załóż.' : 'Załóż'}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], width: '100%', justifyContent: 'center', marginTop: spacing[2] },
  slot: { width: 84, alignItems: 'center', gap: 3, paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card, position: 'relative' },
  slotIcon: { fontSize: 20 },
  slotLabel: { fontSize: 9.5, fontWeight: '700', color: c.text.secondary, maxWidth: 76, textAlign: 'center' },
  slotDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#FBBF24' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: c.bg.primary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[4], gap: spacing[2] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  emptyTxt: { fontSize: 12.5, color: c.text.muted, lineHeight: 18, paddingVertical: spacing[4], textAlign: 'center' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, backgroundColor: c.bg.card, marginBottom: spacing[2] },
  itemName: { fontSize: 13.5, fontWeight: '800', color: c.text.primary },
  itemRarity: { fontSize: 10.5, fontWeight: '800', marginTop: 1 },
  itemStat: { fontSize: 11, color: c.text.secondary, marginTop: 2 },
  deltaTxt: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  equipBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.border.default },
  equipBtnOn: { backgroundColor: '#2AC68F', borderColor: '#2AC68F' },
  equipBtnTxt: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  equipBtnTxtOn: { color: c.bg.primary },
}));
