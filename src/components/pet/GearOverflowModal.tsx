import { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Pressable } from 'react-native';
import { Trash2, Coins, X } from 'lucide-react-native';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useShallow } from 'zustand/react/shallow';
import { usePetStore } from '@/store/petStore';
import {
  GearInstance, RARITY_META, SLOT_META, SLOT_STAT, GEAR_STAT_LABEL,
  GEAR_SLOT_CAP, gearById, gearSellValue, fmtGearStat, parseGearInstanceId,
} from '@/utils/gear';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Modal GLOBALNY (zamontowany w app/_layout.tsx, ten sam wzorzec co BadgeCelebration/
// LevelUpCelebration/MoodCheckInModal) — rozwiązuje kolejkę `pendingGearOverflow` (petStore.ts,
// 2026-10-06, patrz komentarz przy `GEAR_SLOT_CAP` w gear.ts). Grant z PEŁNEGO slotu
// (skrzynka/Sklep dnia) nie ginie i nie sprzedaje się automatycznie — user musi wprost
// wybrać, którą z POSIADANYCH instancji TEGO SAMEGO slotu sprzedać, żeby zrobić miejsce
// (user: "Limit ekwipunku: pytaj który sprzedać gdy pełne"). Pokazuje się nad wszystkim
// innym, niezależnie z którego ekranu (pet.tsx/pet-shop.tsx/CrateModal) przyszedł drop.
export default function GearOverflowModal() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { pending, ownedGear, resolveGearOverflow, discardGearOverflow } = usePetStore(useShallow((st) => ({
    pending: st.pendingGearOverflow[0] ?? null,
    ownedGear: st.ownedGear,
    resolveGearOverflow: st.resolveGearOverflow,
    discardGearOverflow: st.discardGearOverflow,
  })));
  const [sellTarget, setSellTarget] = useState<{ id: string; name: string; coins: number } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (!pending) return null;
  const pendingItem = gearById(pending.itemId);
  if (!pendingItem) return null;   // nie powinno się zdarzyć — defensywnie, żeby nie wywalić renderu
  const slot = pendingItem.slot;
  const pendingMeta = RARITY_META[pending.rarity];
  const stat = SLOT_STAT[slot];

  // Te same instancje co GearPanel.tsx'owy `groupOwnedBySlot`, ale płasko (bez grupowania po
  // itemie) — tu user wybiera KONKRETNĄ instancję do sprzedania, nie "sprzedaj N najsłabszych
  // tego itemu", więc pełna lista pojedynczych kopii jest właściwsza. Najsłabsza pierwsza —
  // naturalna domyślna sugestia "co sprzedać".
  const candidates = (Object.entries(ownedGear) as [string, GearInstance | undefined][])
    .filter(([, inst]) => inst && gearById(inst.itemId)?.slot === slot)
    .map(([id, inst]) => ({ id, inst: inst! }))
    .sort((a, b) => a.inst.value - b.inst.value);

  return (
    <>
      <Modal visible transparent animationType="fade">
        <Pressable style={s.overlay}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.head}>
              <Text style={s.title}>Ekwipunek pełny!</Text>
            </View>
            <View style={s.wonCard}>
              <Image source={pendingItem.icon} style={[s.wonImg, { borderColor: pendingMeta.color + '55' }]} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={s.wonName}>Zdobyto: <Text style={{ color: pendingMeta.color }}>{pendingItem.name}</Text></Text>
                <Text style={s.wonStat}>{pendingMeta.label} · {GEAR_STAT_LABEL[stat]}: {fmtGearStat(stat, pending.value)}{stat === 'flatHp' ? ' HP' : ''}</Text>
              </View>
            </View>
            <Text style={s.sub}>
              Slot „{SLOT_META[slot].label}” jest pełny ({candidates.length}/{GEAR_SLOT_CAP}). Wybierz, którą posiadaną kopię sprzedać, żeby zrobić miejsce — nowy item trafi do ekwipunku od razu po sprzedaży.
            </Text>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {candidates.map(({ id, inst }) => {
                const item = gearById(inst.itemId)!;
                const meta = RARITY_META[inst.rarity];
                const seq = parseGearInstanceId(id)?.seq;
                return (
                  <View key={id} style={[s.itemRow, { borderColor: meta.color + '55' }]}>
                    <Image source={item.icon} style={[s.itemImg, { borderColor: meta.color + '55' }]} resizeMode="contain" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName}>{item.name}{seq ? ` #${seq}` : ''}</Text>
                      <Text style={[s.itemRarity, { color: meta.color }]}>{meta.label}</Text>
                      <Text style={s.itemStat}>{GEAR_STAT_LABEL[stat]}: {fmtGearStat(stat, inst.value)}{stat === 'flatHp' ? ' HP' : ''}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.sellBtn}
                      onPress={() => { haptic.tap(); setSellTarget({ id, name: item.name, coins: gearSellValue(item, inst.rarity) }); }}
                    >
                      <Trash2 size={12} color={c.text.muted} />
                      <Text style={s.sellBtnTxt}>+{gearSellValue(item, inst.rarity)}</Text>
                      <Coins size={11} color="#FBBF24" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={s.discardBtn} onPress={() => { haptic.tap(); setConfirmDiscard(true); }}>
              <X size={13} color={c.text.muted} />
              <Text style={s.discardTxt}>Odrzuć nowy przedmiot — nic nie sprzedawaj</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={!!sellTarget}
        title="Sprzedać item?"
        message={sellTarget ? `${sellTarget.name} — otrzymasz ${sellTarget.coins} monet. Zrobi to miejsce na ${pendingItem.name}. Tej operacji nie można cofnąć.` : ''}
        confirmLabel="Sprzedaj"
        cancelLabel="Anuluj"
        destructive
        onConfirm={() => {
          if (sellTarget) {
            const ok = resolveGearOverflow(sellTarget.id);
            if (ok) { haptic.success(); toast.success(`Sprzedano ${sellTarget.name} (+${sellTarget.coins}) — ${pendingItem.name} trafił do ekwipunku`); }
            else { haptic.error(); toast.error('Nie udało się — spróbuj ponownie'); }
          }
          setSellTarget(null);
        }}
        onCancel={() => setSellTarget(null)}
      />

      <ConfirmDialog
        visible={confirmDiscard}
        title="Odrzucić nowy przedmiot?"
        message={`${pendingItem.name} (${pendingMeta.label}) przepadnie bez żadnej kompensaty. Tej operacji nie można cofnąć.`}
        confirmLabel="Odrzuć"
        cancelLabel="Anuluj"
        destructive
        onConfirm={() => { discardGearOverflow(); haptic.tap(); toast.info(`Odrzucono: ${pendingItem.name}`); setConfirmDiscard(false); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: c.bg.primary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[4], gap: spacing[2] },
  head: { marginBottom: spacing[1] },
  title: { fontSize: 17, fontWeight: '900', color: c.text.primary },
  sub: { fontSize: 12, color: c.text.secondary, lineHeight: 17, marginBottom: spacing[1] },

  wonCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },
  wonImg: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, backgroundColor: c.fill.subtle },
  wonName: { fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  wonStat: { fontSize: 11.5, color: c.text.secondary, marginTop: 2 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[2], borderRadius: radius.md, borderWidth: 1, backgroundColor: c.bg.secondary, marginBottom: spacing[2] },
  itemImg: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, backgroundColor: c.fill.subtle },
  itemName: { fontSize: 13, fontWeight: '800', color: c.text.primary },
  itemRarity: { fontSize: 10.5, fontWeight: '800', marginTop: 1 },
  itemStat: { fontSize: 11, color: c.text.secondary, marginTop: 2 },
  sellBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: c.border.default },
  sellBtnTxt: { fontSize: 10.5, fontWeight: '700', color: c.text.muted },

  discardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: spacing[1] },
  discardTxt: { fontSize: 11.5, fontWeight: '700', color: c.text.muted },
}));
