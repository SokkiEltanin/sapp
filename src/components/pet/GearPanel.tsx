import { ReactNode, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Pressable } from 'react-native';
import { X, Check, ChevronDown, HardHat, Shield, Footprints, Link2, Gem, Coins, Trash2, Minus, Plus, LucideIcon } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useShallow } from 'zustand/react/shallow';
import { usePetStore } from '@/store/petStore';
import {
  GEAR_SLOTS, GearSlot, GearItemDef, GearInstance, RARITY_META, SLOT_META, SLOT_STAT,
  gearById, gearSellValue, GEAR_STAT_LABEL, fmtGearStat, parseGearInstanceId,
} from '@/utils/gear';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import { plPlural } from '@/utils/plural';

const SLOT_ICON: Record<GearSlot, LucideIcon> = {
  helm: HardHat, zbroja: Shield, buty: Footprints, obroza: Link2, talizman: Gem, kolczyki: Coins,
};
const LEFT_SLOTS = GEAR_SLOTS.slice(0, 3);
const RIGHT_SLOTS = GEAR_SLOTS.slice(3);

type OwnedMap = Partial<Record<string, GearInstance>>;

// Grupuje FLAT mapę instancji (petStore `ownedGear`, kluczowaną `itemId:seq`, 2026-09-18) po
// bazowym itemie, dla danego slotu — jedna karta na item w UI, niezależnie od tego ile
// konkretnych kopii user posiada. Instancje w grupie sortowane wg wartości (najlepsza pierwsza).
interface GearGroup { item: GearItemDef; instances: { id: string; inst: GearInstance }[] }
function groupOwnedBySlot(ownedGear: OwnedMap, slot: GearSlot): GearGroup[] {
  const groups = new Map<string, GearGroup>();
  for (const [id, inst] of Object.entries(ownedGear)) {
    if (!inst) continue;
    const item = gearById(inst.itemId);
    if (!item || item.slot !== slot) continue;
    if (!groups.has(inst.itemId)) groups.set(inst.itemId, { item, instances: [] });
    groups.get(inst.itemId)!.instances.push({ id, inst });
  }
  for (const g of groups.values()) g.instances.sort((a, b) => b.inst.value - a.inst.value);
  return [...groups.values()].sort((a, b) => a.item.unlockLevel - b.item.unlockLevel);
}

export default function GearPanel({ children }: { children: ReactNode }) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  // useShallow (2026-09-18, audyt wydajności runda 4) — gołe `usePetStore()` subskrybowało
  // CAŁY store (dziesiątki pól: energia, questy, kosmetyka, raid...), więc ten permanentnie
  // zamontowany panel (renderowany cały czas na ekranie pupila, opasujący kotka) re-renderował
  // się przy KAŻDEJ zmianie w petStore, nie tylko przy zmianie ekwipunku. `app/pet.tsx` (rodzic)
  // już ma tę samą optymalizację (2026-09-09) — ten komponent po prostu nigdy jej nie dostał.
  const { ownedGear, equippedGear } = usePetStore(useShallow((s) => ({ ownedGear: s.ownedGear, equippedGear: s.equippedGear })));
  const [openSlot, setOpenSlot] = useState<GearSlot | null>(null);

  const slotButton = (slot: GearSlot) => {
    const equippedId = equippedGear[slot];
    // Instancje modelu (2026-09-18): `equippedId` jest teraz złożonym `itemId:seq`, a
    // `ownedGear` jest kluczowany TYM SAMYM złożonym id — więc lookup grafiki/rzadkości idzie
    // przez `parseGearInstanceId` do bazowego itemu, a nie prosto `gearById(equippedId)`.
    const equippedInst = equippedId ? ownedGear[equippedId] : undefined;
    const equippedItem = equippedInst ? gearById(equippedInst.itemId) : undefined;
    const meta = equippedInst ? RARITY_META[equippedInst.rarity] : null;
    const hasUnequippedInSlot = Object.entries(ownedGear).some(
      ([id, inst]) => inst && id !== equippedId && gearById(inst.itemId)?.slot === slot,
    );
    const Icon = SLOT_ICON[slot];
    return (
      <PressableScale key={slot} onPress={() => { haptic.tap(); setOpenSlot(slot); }}>
        <View style={[s.slot, meta ? { borderColor: meta.color, backgroundColor: meta.color + '1A' } : { borderColor: c.border.default, backgroundColor: c.bg.card }]}>
          {equippedItem ? (
            <Image source={equippedItem.icon} style={s.slotImg} resizeMode="contain" />
          ) : (
            <Icon size={27} color={c.text.muted} strokeWidth={1.6} />
          )}
          {hasUnequippedInSlot && <View style={s.slotDot} />}
        </View>
      </PressableScale>
    );
  };

  return (
    <>
      <View style={s.flankRow}>
        <View style={s.flankCol}>{LEFT_SLOTS.map(slotButton)}</View>
        <View style={s.catCol}>{children}</View>
        <View style={s.flankCol}>{RIGHT_SLOTS.map(slotButton)}</View>
      </View>
      <GearSlotModal slot={openSlot} onSelectSlot={setOpenSlot} onClose={() => setOpenSlot(null)} />
    </>
  );
}

function GearSlotModal({ slot, onSelectSlot, onClose }: { slot: GearSlot | null; onSelectSlot: (s: GearSlot) => void; onClose: () => void }) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  // useShallow (2026-09-18, audyt wydajności runda 4) — patrz komentarz w `GearPanel` wyżej;
  // ten modal jest zamontowany (i subskrybuje store) CAŁY CZAS, nawet gdy `slot` jest `null`
  // i nic się nie renderuje (early return NIŻEJ, po hookach) — bez selektora re-renderowałby
  // się na każdą zmianę petStore również w tym stanie.
  const { ownedGear, equippedGear, equipGear, unequipGear, sellGear } = usePetStore(useShallow((s) => ({
    ownedGear: s.ownedGear, equippedGear: s.equippedGear,
    equipGear: s.equipGear, unequipGear: s.unequipGear, sellGear: s.sellGear,
  })));
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  // Sprzedaż JEDNEJ konkretnej instancji.
  const [sellTarget, setSellTarget] = useState<{ id: string; name: string; coins: number; wasEquipped: boolean } | null>(null);
  // Sprzedaż całego slotu naraz (wszystkie niezałożone instancje, niezależnie od itemu).
  const [bulkSell, setBulkSell] = useState<{ slot: GearSlot; ids: string[]; coins: number } | null>(null);
  // Sprzedaż N kopii TEGO SAMEGO itemu — wybierana ilość (user: "jak sa dosłownie takie same
  // moge je sprzedac i wtedy wybieram ile"). Sprzedaje N najsłabszych niezałożonych kopii.
  const [groupSell, setGroupSell] = useState<{ item: GearItemDef; candidates: { id: string; inst: GearInstance }[]; qty: number } | null>(null);

  if (!slot) return null;
  const groups = groupOwnedBySlot(ownedGear, slot);
  const equippedId = equippedGear[slot];
  const equippedInst = equippedId ? ownedGear[equippedId] : undefined;
  const equippedItem = equippedInst ? gearById(equippedInst.itemId) : undefined;
  const equippedVal = equippedInst ? equippedInst.value : 0;
  const stat = SLOT_STAT[slot];
  const allNonEquipped = groups.flatMap(g => g.instances.filter(i => i.id !== equippedId));
  const nonEquippedTotal = allNonEquipped.reduce((sum, { id, inst }) => sum + gearSellValue(gearById(inst.itemId)!, inst.rarity), 0);

  const groupSellCoins = groupSell
    ? groupSell.candidates.slice(0, groupSell.qty).reduce((sum, { inst }) => sum + gearSellValue(groupSell.item, inst.rarity), 0)
    : 0;

  return (
    <>
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>Ekwipunek</Text>
            <TouchableOpacity onPress={onClose} hitSlop={16} style={s.closeBtn}><X size={22} color={c.text.primary} /></TouchableOpacity>
          </View>

          <View style={s.tabRow}>
            {GEAR_SLOTS.map(sl => {
              const TabIcon = SLOT_ICON[sl];
              const active = sl === slot;
              const slEquippedId = equippedGear[sl];
              const hasDot = Object.entries(ownedGear).some(
                ([id, inst]) => inst && id !== slEquippedId && gearById(inst.itemId)?.slot === sl,
              );
              return (
                <TouchableOpacity key={sl} onPress={() => { haptic.tap(); setExpandedItemId(null); onSelectSlot(sl); }} style={[s.tab, active && s.tabActive]}>
                  <TabIcon size={19} color={active ? c.accent.blue : c.text.muted} strokeWidth={1.8} />
                  {hasDot && <View style={s.tabDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Bez emoji (2026-09-18, user: "eq możemy w górę i usun z niego emotki") — dawne
              `SLOT_META[slot].icon` zostaje jako format dla pet-shop.tsx/BoxRevealModal.tsx
              (celowe, nie dead code), tu tylko sama etykieta słowna. */}
          <Text style={s.slotLabel}>{SLOT_META[slot].label}</Text>

          {groups.length === 0 ? (
            <Text style={s.emptyTxt}>Brak jeszcze itemów do tego slotu — zdobądź w skrzynkach albo sklepie dnia.</Text>
          ) : (
            <>
            {allNonEquipped.length > 0 && (
              <TouchableOpacity
                style={s.bulkSellBtn}
                onPress={() => { haptic.tap(); setBulkSell({ slot, ids: allNonEquipped.map(i => i.id), coins: nonEquippedTotal }); }}
              >
                <Trash2 size={13} color={c.accent.red ?? '#EF4444'} />
                <Text style={s.bulkSellTxt}>Sprzedaj {allNonEquipped.length} niezałożonych (+{nonEquippedTotal} 🪙)</Text>
              </TouchableOpacity>
            )}
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {groups.map(group => {
                const isExpanded = expandedItemId === group.item.id;
                const count = group.instances.length;
                const groupHasEquipped = group.instances.some(i => i.id === equippedId);
                const best = group.instances[0].inst;
                const bestMeta = RARITY_META[best.rarity];
                const nonEquippedInGroup = group.instances.filter(i => i.id !== equippedId);
                return (
                  <View key={group.item.id} style={[s.itemGroup, { borderColor: bestMeta.color + '55' }]}>
                    <TouchableOpacity
                      style={s.itemGroupHead}
                      activeOpacity={0.8}
                      onPress={() => { haptic.tap(); setExpandedItemId(isExpanded ? null : group.item.id); }}
                    >
                      <Image source={group.item.icon} style={[s.itemImg, { borderColor: bestMeta.color + '55' }]} resizeMode="contain" />
                      <View style={{ flex: 1 }}>
                        <View style={s.itemNameRow}>
                          <Text style={s.itemName}>{group.item.name}</Text>
                          {/* Znacznik "masz kilka" (2026-09-18, user: "jak sa takie same te
                              pierwsze kody to pokazuje ze mam kilka") — złota pigułka ×N,
                              tylko gdy realnie posiada więcej niż jedną kopię. */}
                          {count > 1 && (
                            <View style={s.countBadge}><Text style={s.countBadgeTxt}>×{count}</Text></View>
                          )}
                          {groupHasEquipped && (
                            <View style={s.equippedBadge}><Check size={10} color="#2AC68F" /></View>
                          )}
                        </View>
                        <Text style={[s.itemRarity, { color: bestMeta.color }]}>{bestMeta.label}{count > 1 ? ' (najlepsza)' : ''}</Text>
                        <Text style={s.itemStat}>{GEAR_STAT_LABEL[stat]}: {fmtGearStat(stat, best.value)}{stat === 'flatHp' ? ' HP' : ''}</Text>
                      </View>
                      <ChevronDown size={18} color={c.text.muted} style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }} />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={s.instanceList}>
                        {count > 1 && nonEquippedInGroup.length > 0 && (
                          <TouchableOpacity
                            style={s.groupSellBtn}
                            onPress={() => {
                              haptic.tap();
                              // Sprzedaje od najsłabszej — kandydatki posortowane wartością rosnąco.
                              const candidates = [...nonEquippedInGroup].sort((a, b) => a.inst.value - b.inst.value);
                              setGroupSell({ item: group.item, candidates, qty: 1 });
                            }}
                          >
                            <Trash2 size={12} color={c.accent.red ?? '#EF4444'} />
                            <Text style={s.groupSellTxt}>Sprzedaj kilka…</Text>
                          </TouchableOpacity>
                        )}
                        {group.instances.map(({ id, inst }, idx) => {
                          const meta = RARITY_META[inst.rarity];
                          const delta = inst.value - equippedVal;
                          const isEquipped = equippedId === id;
                          const seq = parseGearInstanceId(id)?.seq ?? idx + 1;
                          return (
                            <View key={id} style={[s.itemRow, { borderColor: meta.color + '55' }]}>
                              <View style={{ flex: 1 }}>
                                <Text style={s.itemInstanceLabel}>Kopia #{seq}</Text>
                                <Text style={[s.itemRarity, { color: meta.color }]}>{meta.label}</Text>
                                <Text style={s.itemStat}>{GEAR_STAT_LABEL[stat]}: {fmtGearStat(stat, inst.value)}{stat === 'flatHp' ? ' HP' : ''}</Text>
                                {!isEquipped && equippedItem && (
                                  <Text style={[s.deltaTxt, { color: delta > 0 ? '#2AC68F' : delta < 0 ? '#EF4444' : c.text.muted }]}>
                                    {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {delta === 0 ? 'tyle samo' : `${fmtGearStat(stat, Math.abs(delta))} vs założony`}
                                  </Text>
                                )}
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                <TouchableOpacity
                                  onPress={() => { haptic.tap(); isEquipped ? unequipGear(slot) : equipGear(id); }}
                                  style={[s.equipBtn, isEquipped && s.equipBtnOn]}
                                >
                                  {isEquipped && <Check size={13} color={c.bg.primary} />}
                                  <Text style={[s.equipBtnTxt, isEquipped && s.equipBtnTxtOn]}>{isEquipped ? 'Załóż.' : 'Załóż'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => { haptic.tap(); setSellTarget({ id, name: group.item.name, coins: gearSellValue(group.item, inst.rarity), wasEquipped: isEquipped }); }}
                                  style={s.sellBtn}
                                  hitSlop={6}
                                >
                                  <Trash2 size={12} color={c.text.muted} />
                                  <Text style={s.sellBtnTxt}>+{gearSellValue(group.item, inst.rarity)} 🪙</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>

    <ConfirmDialog
      visible={!!sellTarget}
      title="Sprzedać item?"
      message={sellTarget ? `${sellTarget.name} — otrzymasz ${sellTarget.coins} monet.${sellTarget.wasEquipped ? ' Zostanie zdjęty ze slotu.' : ''} Tej operacji nie można cofnąć.` : ''}
      confirmLabel="Sprzedaj"
      cancelLabel="Anuluj"
      destructive
      onConfirm={() => {
        if (sellTarget) { sellGear(sellTarget.id); haptic.success(); toast.success(`Sprzedano ${sellTarget.name} — +${sellTarget.coins} 🪙`); }
        setSellTarget(null);
      }}
      onCancel={() => setSellTarget(null)}
    />

    <ConfirmDialog
      visible={!!bulkSell}
      title="Sprzedać niezałożone?"
      message={bulkSell ? `${bulkSell.ids.length} ${plPlural(bulkSell.ids.length, 'item', 'itemy', 'itemów')} (${SLOT_META[bulkSell.slot].label}) — otrzymasz łącznie ${bulkSell.coins} monet. Założony item zostaje. Tej operacji nie można cofnąć.` : ''}
      confirmLabel="Sprzedaj wszystkie"
      cancelLabel="Anuluj"
      destructive
      onConfirm={() => {
        if (bulkSell) {
          const earned = bulkSell.ids.reduce((sum, id) => sum + sellGear(id), 0);
          haptic.success();
          toast.success(`Sprzedano ${bulkSell.ids.length} ${plPlural(bulkSell.ids.length, 'item', 'itemy', 'itemów')} — +${earned} 🪙`);
        }
        setBulkSell(null);
      }}
      onCancel={() => setBulkSell(null)}
    />

    {/* Wybór ILE sprzedać z duplikatów (2026-09-18, user: "jak sa dosłownie takie same moge
        je sprzedac i wtedy wybieram ile"). Sprzedaje `qty` NAJSŁABSZYCH niezałożonych kopii
        (candidates już posortowane wartością rosnąco), założona kopia nigdy nie jest kandydatem. */}
    <Modal visible={!!groupSell} transparent animationType="fade" onRequestClose={() => setGroupSell(null)}>
      <Pressable style={s.overlay} onPress={() => setGroupSell(null)}>
        <Pressable style={s.qtyCard} onPress={() => {}}>
          <Text style={s.qtyTitle}>Sprzedaj {groupSell?.item.name}</Text>
          <Text style={s.qtyMsg}>Sprzedane zostaną najsłabsze kopie. Posiadasz {groupSell?.candidates.length ?? 0} niezałożonych.</Text>
          <View style={s.qtyRow}>
            <TouchableOpacity
              style={s.qtyBtn}
              onPress={() => { haptic.tap(); setGroupSell(g => g ? { ...g, qty: Math.max(1, g.qty - 1) } : g); }}
            >
              <Minus size={16} color={c.text.primary} />
            </TouchableOpacity>
            <Text style={s.qtyVal}>{groupSell?.qty ?? 1}</Text>
            <TouchableOpacity
              style={s.qtyBtn}
              onPress={() => { haptic.tap(); setGroupSell(g => g ? { ...g, qty: Math.min(g.candidates.length, g.qty + 1) } : g); }}
            >
              <Plus size={16} color={c.text.primary} />
            </TouchableOpacity>
          </View>
          <Text style={s.qtyCoins}>Otrzymasz: {groupSellCoins} 🪙</Text>
          <View style={s.qtyActionsRow}>
            <TouchableOpacity style={s.qtyCancelBtn} onPress={() => setGroupSell(null)} activeOpacity={0.8}>
              <Text style={s.qtyCancelTxt}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.qtyConfirmBtn}
              activeOpacity={0.8}
              onPress={() => {
                if (groupSell) {
                  const toSell = groupSell.candidates.slice(0, groupSell.qty);
                  const earned = toSell.reduce((sum, { id }) => sum + sellGear(id), 0);
                  haptic.success();
                  toast.success(`Sprzedano ${toSell.length} × ${groupSell.item.name} — +${earned} 🪙`);
                }
                setGroupSell(null);
              }}
            >
              <Text style={s.qtyConfirmTxt}>Sprzedaj</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  flankRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: spacing[2] },
  flankCol: { width: 68, gap: spacing[2], alignItems: 'center' },
  catCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slot: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, position: 'relative' },
  slotImg: { width: 44, height: 44 },
  slotDot: { position: 'absolute', top: 4, right: 4, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#FBBF24' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: c.bg.primary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[4], gap: spacing[2] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  closeBtn: { padding: spacing[1] },
  tabRow: { flexDirection: 'row', gap: spacing[1], marginBottom: spacing[2] },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: radius.md, backgroundColor: c.fill.subtle, position: 'relative' },
  tabActive: { backgroundColor: c.accent.blue + '22' },
  tabDot: { position: 'absolute', top: 5, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FBBF24' },
  slotLabel: { fontSize: 13, fontWeight: '800', color: c.text.primary, marginBottom: spacing[2] },
  emptyTxt: { fontSize: 12.5, color: c.text.muted, lineHeight: 18, paddingVertical: spacing[4], textAlign: 'center' },

  bulkSellBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, borderWidth: 1, borderColor: (c.accent.red ?? '#EF4444') + '55', backgroundColor: (c.accent.red ?? '#EF4444') + '14', paddingVertical: 9, marginBottom: spacing[2] },
  bulkSellTxt: { fontSize: 11.5, fontWeight: '700', color: c.accent.red ?? '#EF4444' },

  // Karta grupy (jeden item, N kopii) — 2026-09-18. Kolapsuje/rozwija instancje.
  itemGroup: { borderRadius: radius.lg, borderWidth: 1, backgroundColor: c.bg.card, marginBottom: spacing[2], overflow: 'hidden' },
  itemGroupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[3] },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countBadge: { backgroundColor: '#FBBF2426', borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 1 },
  countBadgeTxt: { fontSize: 10.5, fontWeight: '800', color: '#FBBF24' },
  equippedBadge: { backgroundColor: '#2AC68F26', borderRadius: radius.full, padding: 3 },
  instanceList: { paddingHorizontal: spacing[3], paddingBottom: spacing[3], gap: spacing[2] },
  itemInstanceLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted },

  groupSellBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radius.md, borderWidth: 1, borderColor: (c.accent.red ?? '#EF4444') + '44', paddingVertical: 7 },
  groupSellTxt: { fontSize: 10.5, fontWeight: '700', color: c.accent.red ?? '#EF4444' },

  itemImg: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, backgroundColor: c.fill.subtle },
  itemName: { fontSize: 13.5, fontWeight: '800', color: c.text.primary },
  itemRarity: { fontSize: 10.5, fontWeight: '800', marginTop: 1 },
  itemStat: { fontSize: 11, color: c.text.secondary, marginTop: 2 },
  deltaTxt: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[2], borderRadius: radius.md, borderWidth: 1, backgroundColor: c.bg.secondary },
  equipBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.border.default },
  equipBtnOn: { backgroundColor: '#2AC68F', borderColor: '#2AC68F' },
  equipBtnTxt: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  equipBtnTxtOn: { color: c.bg.primary },
  sellBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.border.default },
  sellBtnTxt: { fontSize: 10.5, fontWeight: '700', color: c.text.muted },

  // Modal wyboru ilości (2026-09-18) — prosty stepper +/-, ten sam card-language co ConfirmDialog.
  qtyCard: { width: '100%', maxWidth: 360, backgroundColor: c.bg.secondary, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], gap: spacing[2] },
  qtyTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  qtyMsg: { fontSize: 12.5, color: c.text.secondary, lineHeight: 17 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[4], marginTop: spacing[1] },
  qtyBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.card },
  qtyVal: { fontSize: 20, fontWeight: '800', color: c.text.primary, minWidth: 36, textAlign: 'center' },
  qtyCoins: { fontSize: 13, fontWeight: '700', color: '#FBBF24', textAlign: 'center', marginTop: spacing[1] },
  qtyActionsRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  qtyCancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  qtyCancelTxt: { fontSize: 14, fontWeight: '700', color: c.text.secondary },
  qtyConfirmBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: radius.lg, backgroundColor: '#EF4444' },
  qtyConfirmTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
}));
