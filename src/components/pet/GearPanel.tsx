import { ReactNode, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { X, Check, HardHat, Shield, Footprints, Link2, Gem, Coins, LucideIcon } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { usePetStore } from '@/store/petStore';
import {
  GEAR_SLOTS, GearSlot, GearRarity, RARITY_META, SLOT_META, SLOT_STAT,
  gearById, gearBySlot, gearStatValue, gearSellValue,
} from '@/utils/gear';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Ikony lucide zamiast emoji dla sloty flankujące kotka (2026-08-20, user: "lepsze ikony
// lucid bez koloru jako by były puste" — puste/niezałożone sloty renderują ikonę wyciszonym
// kolorem, bez wypełnienia rarity). Emoji z SLOT_META.icon ZOSTAJE dla innych miejsc
// (pet-shop.tsx, BoxRevealModal.tsx) — to celowe, nie dead code.
const SLOT_ICON: Record<GearSlot, LucideIcon> = {
  helm: HardHat, zbroja: Shield, buty: Footprints, obroza: Link2, talizman: Gem, kolczyki: Coins,
};
// 3 lewo / 3 prawo flankujące kotka (2026-08-20, user: "itemy będą 3 z prawej i 3 z lewej
// kotka" — zastępuje dawny pojedynczy rząd POD kotkiem, patrz historia niżej przy `flankRow`).
const LEFT_SLOTS = GEAR_SLOTS.slice(0, 3);
const RIGHT_SLOTS = GEAR_SLOTS.slice(3);

const STAT_LABEL: Record<string, string> = {
  critPct: 'krytyk', flatHp: 'HP', dodgePct: 'unik', atkPct: 'atak', energyMultPct: 'energia', coinsPct: 'monety',
};
const STAT_UNIT: Record<string, string> = {
  critPct: '%', flatHp: '', dodgePct: '%', atkPct: '%', energyMultPct: '%', coinsPct: '%',
};
const fmtStat = (stat: string, v: number) => stat === 'flatHp' ? `+${Math.round(v)}` : `+${(v * 100).toFixed(1)}%`;

// 6 slotów ekwipunku FLANKUJĄCYCH kotka, 3 lewo/3 prawo (2026-08-20, user: "itemy będą 3 z
// prawej i 3 z lewej kotka" — zastępuje dawny pojedynczy rząd emoji POD kotkiem, którego
// napisy zachodziły na kartę misji niżej). `children` = render kotka (przekazany przez
// pet.tsx), wstawiany w środkową kolumnę żeby sloty otaczały go z obu stron zamiast żyć
// jako osobna sekcja pod nim. Staty JESZCZE nic nie robią w walce/ekonomii bezpośrednio TU —
// to czysto zarządzanie kolekcją (realne wpięcie w combat jest w bosses.ts/gear.ts, krok 8).
export default function GearPanel({ children }: { children: ReactNode }) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { ownedGear, equippedGear } = usePetStore();
  const [openSlot, setOpenSlot] = useState<GearSlot | null>(null);

  const slotButton = (slot: GearSlot) => {
    const equippedId = equippedGear[slot];
    // Grafika KONKRETNEGO założonego itemu (2026-08-20, user: "dodałeś ze ikony te które
    // dodam wyświetlają sie jako w tych kafelkach u pupila?") — `GearItemDef.icon` istniało
    // w gear.ts od kroku 1 (require() per plik w assets/ekwipunek/), ale NIC go dotąd
    // faktycznie nie renderowało (ani stara wersja tego slotu, ani sklep/reveal — wszędzie
    // leciała generyczna emoji/ikona SLOTU, nie itemu). Puste sloty ZOSTAJĄ na `SLOT_ICON`
    // (kategoria, nie ma czego pokazać).
    const equippedItem = equippedId ? gearById(equippedId) : undefined;
    const rarity = equippedId ? ownedGear[equippedId] : undefined;
    const meta = rarity ? RARITY_META[rarity] : null;
    const ownedCount = gearBySlot(slot).filter(g => ownedGear[g.id]).length;
    const Icon = SLOT_ICON[slot];
    return (
      <PressableScale key={slot} onPress={() => { haptic.tap(); setOpenSlot(slot); }}>
        <View style={[s.slot, meta ? { borderColor: meta.color, backgroundColor: meta.color + '1A' } : { borderColor: c.border.default, backgroundColor: c.bg.card }]}>
          {equippedItem ? (
            <Image source={equippedItem.icon} style={s.slotImg} resizeMode="contain" />
          ) : (
            <Icon size={18} color={c.text.muted} strokeWidth={1.6} />
          )}
          {ownedCount > 0 && !equippedId && <View style={s.slotDot} />}
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
      <GearSlotModal slot={openSlot} onClose={() => setOpenSlot(null)} />
    </>
  );
}

function GearSlotModal({ slot, onClose }: { slot: GearSlot | null; onClose: () => void }) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { ownedGear, equippedGear, equipGear, unequipGear, sellGear } = usePetStore();
  // Sprzedaż (2026-08-20, user: "co robimy z itemami co sa słabsze ale je mamy w eq? mozna
  // je sprzedać? jak tak dodaj przycisk sprzedaj z potwierdzeniem") — potwierdzenie przez
  // ISTNIEJĄCY `ConfirmDialog`, ten sam wzorzec co reszta destrukcyjnych akcji w apce.
  const [sellTarget, setSellTarget] = useState<{ id: string; name: string; coins: number; wasEquipped: boolean } | null>(null);

  if (!slot) return null;
  const items = gearBySlot(slot).filter(g => ownedGear[g.id]);
  const equippedId = equippedGear[slot];
  const equippedItem = equippedId ? gearById(equippedId) : undefined;
  const equippedRarity = equippedId ? ownedGear[equippedId] : undefined;
  const equippedVal = equippedItem && equippedRarity ? gearStatValue(equippedItem, equippedRarity) : 0;
  const stat = SLOT_STAT[slot];

  return (
    <>
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
                    <Image source={item.icon} style={[s.itemImg, { borderColor: meta.color + '55' }]} resizeMode="contain" />
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
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => { haptic.tap(); isEquipped ? unequipGear(slot) : equipGear(item.id); }}
                        style={[s.equipBtn, isEquipped && s.equipBtnOn]}
                      >
                        {isEquipped && <Check size={13} color={c.bg.primary} />}
                        <Text style={[s.equipBtnTxt, isEquipped && s.equipBtnTxtOn]}>{isEquipped ? 'Załóż.' : 'Załóż'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { haptic.tap(); setSellTarget({ id: item.id, name: item.name, coins: gearSellValue(item, rarity), wasEquipped: isEquipped }); }}
                      >
                        <Text style={s.sellLink}>Sprzedaj +{gearSellValue(item, rarity)} 🪙</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
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
    </>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  // Flankujące kolumny (2026-08-20) — `catCol` bierze resztę szerokości (flex:1) i centruje
  // przekazanego kotka, kolumny slotów po bokach mają STAŁĄ, wąską szerokość (nie flex) żeby
  // nie ściskać kotka gdy jest mało itemów; ikony bez etykiet (dawny `slotLabel` z nazwą itemu
  // nie mieścił się obok kotka i zachodził na inne karty — szczegóły itemu są w modalu).
  flankRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: spacing[2] },
  flankCol: { width: 46, gap: spacing[2], alignItems: 'center' },
  catCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slot: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, position: 'relative' },
  slotImg: { width: 26, height: 26 },
  slotDot: { position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: 4, backgroundColor: '#FBBF24' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: c.bg.primary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[4], gap: spacing[2] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  emptyTxt: { fontSize: 12.5, color: c.text.muted, lineHeight: 18, paddingVertical: spacing[4], textAlign: 'center' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, backgroundColor: c.bg.card, marginBottom: spacing[2] },
  itemImg: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, backgroundColor: c.fill.subtle },
  itemName: { fontSize: 13.5, fontWeight: '800', color: c.text.primary },
  itemRarity: { fontSize: 10.5, fontWeight: '800', marginTop: 1 },
  itemStat: { fontSize: 11, color: c.text.secondary, marginTop: 2 },
  deltaTxt: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  equipBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.border.default },
  equipBtnOn: { backgroundColor: '#2AC68F', borderColor: '#2AC68F' },
  equipBtnTxt: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  equipBtnTxtOn: { color: c.bg.primary },
  sellLink: { fontSize: 10, fontWeight: '700', color: c.text.muted, textDecorationLine: 'underline' },
}));
