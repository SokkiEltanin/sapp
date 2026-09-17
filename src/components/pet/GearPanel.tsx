import { ReactNode, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Pressable } from 'react-native';
import { X, Check, HardHat, Shield, Footprints, Link2, Gem, Coins, Trash2, LucideIcon } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { usePetStore } from '@/store/petStore';
import {
  GEAR_SLOTS, GearSlot, RARITY_META, SLOT_META, SLOT_STAT,
  gearById, gearBySlot, gearSellValue, GEAR_STAT_LABEL, fmtGearStat,
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
    const owned = equippedId ? ownedGear[equippedId] : undefined;
    const meta = owned ? RARITY_META[owned.rarity] : null;
    const ownedCount = gearBySlot(slot).filter(g => ownedGear[g.id]).length;
    const Icon = SLOT_ICON[slot];
    return (
      <PressableScale key={slot} onPress={() => { haptic.tap(); setOpenSlot(slot); }}>
        <View style={[s.slot, meta ? { borderColor: meta.color, backgroundColor: meta.color + '1A' } : { borderColor: c.border.default, backgroundColor: c.bg.card }]}>
          {equippedItem ? (
            <Image source={equippedItem.icon} style={s.slotImg} resizeMode="contain" />
          ) : (
            <Icon size={27} color={c.text.muted} strokeWidth={1.6} />
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
      <GearSlotModal slot={openSlot} onSelectSlot={setOpenSlot} onClose={() => setOpenSlot(null)} />
    </>
  );
}

// Redesign (2026-09-17, user: "kliknięcie w sloty otwierał sie ekwipunek pełnoprawny...
// klikanie w te ikonki małe to ból dupy potem zeby trafić w sprzedaz albo doczytać sie co
// robi item... zeby wyjść z eq chciałem kliknąć poza niego ale nie traf w malutki x... a
// sprzedawanie podobnych itemow z gorszym floatem to tez masakra") — cztery zmiany w JEDNYM
// modalu (nie osobny full-screen route — mniej ryzyka w nawigacji, ten sam bottom-sheet):
// (1) pasek zakładek WSZYSTKICH 6 slotów u góry, przełącza się bez zamykania/ponownego
// otwierania z malutkich ikonek na kotku (to jest "ekwipunek pełnoprawny" — cały ekwipunek
// w jednym miejscu, nie pojedynczy slot na raz); (2) tap na tło ZA arkuszem zamyka (obok X,
// nie tylko X); (3) X i przycisk Sprzedaj powiększone/z paddingiem (dawny `sellLink` był
// gołym podkreślonym tekstem bez paddingu — realnie ciężko trafić); (4) "Sprzedaj słabsze"
// — jeden przycisk sprzedaje WSZYSTKIE nie-założone itemy tego slotu za jednym
// potwierdzeniem, zamiast N razy osobno.
function GearSlotModal({ slot, onSelectSlot, onClose }: { slot: GearSlot | null; onSelectSlot: (s: GearSlot) => void; onClose: () => void }) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { ownedGear, equippedGear, equipGear, unequipGear, sellGear } = usePetStore();
  // Sprzedaż pojedynczego itemu (2026-08-20, user: "co robimy z itemami co sa słabsze ale je
  // mamy w eq? mozna je sprzedać? jak tak dodaj przycisk sprzedaj z potwierdzeniem") —
  // potwierdzenie przez ISTNIEJĄCY `ConfirmDialog`, ten sam wzorzec co reszta destrukcyjnych
  // akcji w apce.
  const [sellTarget, setSellTarget] = useState<{ id: string; name: string; coins: number; wasEquipped: boolean } | null>(null);
  // Sprzedaż zbiorcza (2026-09-17) — patrz komentarz nad komponentem, punkt (4).
  const [bulkSell, setBulkSell] = useState<{ slot: GearSlot; ids: string[]; coins: number } | null>(null);

  if (!slot) return null;
  const items = gearBySlot(slot).filter(g => ownedGear[g.id]);
  const equippedId = equippedGear[slot];
  const equippedItem = equippedId ? gearById(equippedId) : undefined;
  const equippedOwned = equippedId ? ownedGear[equippedId] : undefined;
  const equippedVal = equippedOwned ? equippedOwned.value : 0;
  const stat = SLOT_STAT[slot];
  const nonEquipped = items.filter(item => item.id !== equippedId);
  const nonEquippedTotal = nonEquipped.reduce((sum, item) => sum + gearSellValue(item, ownedGear[item.id]!.rarity), 0);

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
              const hasDot = gearBySlot(sl).some(g => ownedGear[g.id]) && !equippedGear[sl];
              return (
                <TouchableOpacity key={sl} onPress={() => { haptic.tap(); onSelectSlot(sl); }} style={[s.tab, active && s.tabActive]}>
                  <TabIcon size={19} color={active ? c.accent.blue : c.text.muted} strokeWidth={1.8} />
                  {hasDot && <View style={s.tabDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.slotLabel}>{SLOT_META[slot].icon} {SLOT_META[slot].label}</Text>

          {items.length === 0 ? (
            <Text style={s.emptyTxt}>Brak jeszcze itemów do tego slotu — zdobądź w skrzynkach albo sklepie dnia.</Text>
          ) : (
            <>
            {nonEquipped.length > 0 && (
              <TouchableOpacity
                style={s.bulkSellBtn}
                onPress={() => { haptic.tap(); setBulkSell({ slot, ids: nonEquipped.map(i => i.id), coins: nonEquippedTotal }); }}
              >
                <Trash2 size={13} color={c.accent.red ?? '#EF4444'} />
                <Text style={s.bulkSellTxt}>Sprzedaj {nonEquipped.length} niezałożonych (+{nonEquippedTotal} 🪙)</Text>
              </TouchableOpacity>
            )}
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {items.map(item => {
                const owned = ownedGear[item.id]!;
                const rarity = owned.rarity;
                const meta = RARITY_META[rarity];
                const val = owned.value;
                const delta = val - equippedVal;
                const isEquipped = equippedId === item.id;
                return (
                  <View key={item.id} style={[s.itemRow, { borderColor: meta.color + '55' }]}>
                    <Image source={item.icon} style={[s.itemImg, { borderColor: meta.color + '55' }]} resizeMode="contain" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName}>{item.name}</Text>
                      <Text style={[s.itemRarity, { color: meta.color }]}>{meta.label}</Text>
                      <Text style={s.itemStat}>{GEAR_STAT_LABEL[stat]}: {fmtGearStat(stat, val)}{stat === 'flatHp' ? ' HP' : ''}</Text>
                      {!isEquipped && equippedItem && (
                        <Text style={[s.deltaTxt, { color: delta > 0 ? '#2AC68F' : delta < 0 ? '#EF4444' : c.text.muted }]}>
                          {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {delta === 0 ? 'tyle samo' : `${fmtGearStat(stat, Math.abs(delta))} vs założony`}
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
                        style={s.sellBtn}
                        hitSlop={6}
                      >
                        <Trash2 size={12} color={c.text.muted} />
                        <Text style={s.sellBtnTxt}>+{gearSellValue(item, rarity)} 🪙</Text>
                      </TouchableOpacity>
                    </View>
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
      message={bulkSell ? `${bulkSell.ids.length} itemów (${SLOT_META[bulkSell.slot].label}) — otrzymasz łącznie ${bulkSell.coins} monet. Założony item zostaje. Tej operacji nie można cofnąć.` : ''}
      confirmLabel="Sprzedaj wszystkie"
      cancelLabel="Anuluj"
      destructive
      onConfirm={() => {
        if (bulkSell) {
          const earned = bulkSell.ids.reduce((sum, id) => sum + sellGear(id), 0);
          haptic.success();
          toast.success(`Sprzedano ${bulkSell.ids.length} itemów — +${earned} 🪙`);
        }
        setBulkSell(null);
      }}
      onCancel={() => setBulkSell(null)}
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
  // Sloty powiększone DRUGI RAZ (2026-09-04, user: "sloty na ekwipunku pupila jeszcze
  // powiększyć trochę bo teraz itemy nadal sa trochę malo widoczne") — 50→62 (pierwsza
  // rozbiórka 40→50 była 2026-08-27), ikona/obrazek itemu i kropka "posiadasz" przeskalowane
  // razem z nim, kolumna odpowiednio szersza żeby sloty nie stykały się krawędziami.
  flankCol: { width: 68, gap: spacing[2], alignItems: 'center' },
  catCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slot: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, position: 'relative' },
  slotImg: { width: 44, height: 44 },
  slotDot: { position: 'absolute', top: 4, right: 4, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#FBBF24' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: c.bg.primary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[4], gap: spacing[2] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  // Powiększony hit-target zamknięcia (2026-09-17, user: "nie traf w malutki x zeby wyjść")
  // — dawny gołe 20px z hitSlop 10 zostaje 22px + hitSlop 16 + padding, razem ~54×54 efektywnie.
  // Backdrop (tap poza arkuszem, `overlay` Pressable w renderze) teraz też zamyka — to jest
  // GŁÓWNY fix, X jest już tylko zapasową drogą wyjścia.
  closeBtn: { padding: spacing[1] },
  // Pasek zakładek WSZYSTKICH slotów (2026-09-17) — "ekwipunek pełnoprawny": przełączanie
  // między slotami bez zamykania modala i szukania ponownie malutkiej ikonki na kotku.
  tabRow: { flexDirection: 'row', gap: spacing[1], marginBottom: spacing[2] },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: radius.md, backgroundColor: c.fill.subtle, position: 'relative' },
  tabActive: { backgroundColor: c.accent.blue + '22' },
  tabDot: { position: 'absolute', top: 5, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FBBF24' },
  slotLabel: { fontSize: 13, fontWeight: '800', color: c.text.primary, marginBottom: spacing[2] },
  emptyTxt: { fontSize: 12.5, color: c.text.muted, lineHeight: 18, paddingVertical: spacing[4], textAlign: 'center' },

  // Sprzedaż zbiorcza (2026-09-17, user: "sprzedawanie podobnych itemow z gorszym floatem to
  // tez masakra") — jeden przycisk nad listą, zamiast osobnego "Sprzedaj" + potwierdzenia per item.
  bulkSellBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, borderWidth: 1, borderColor: (c.accent.red ?? '#EF4444') + '55', backgroundColor: (c.accent.red ?? '#EF4444') + '14', paddingVertical: 9, marginBottom: spacing[2] },
  bulkSellTxt: { fontSize: 11.5, fontWeight: '700', color: c.accent.red ?? '#EF4444' },

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
  // Przycisk Sprzedaj (2026-09-17) — dawny `sellLink` to był goły podkreślony `Text` bez
  // paddingu (user: "ciezko trafic w sprzedaz") — teraz pełnoprawny przycisk z ikoną, tym
  // samym paddingiem co `equipBtn` obok niego, więc oba mają porównywalny hit-target.
  sellBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.border.default },
  sellBtnTxt: { fontSize: 10.5, fontWeight: '700', color: c.text.muted },
}));
