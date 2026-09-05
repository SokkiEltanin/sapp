import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Coins, Check, Snowflake, Gift, X } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BoxRevealModal from '@/components/pet/BoxRevealModal';
import PupilNavbar from '@/components/pet/PupilNavbar';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { SHOP_COLORS } from '@/utils/petShop';
import { LOOT_BOXES, DAILY_BOX, LootBox, rollBox, BoxReward } from '@/utils/petBoxes';
import { dailyShopSlots, DailyShopSlot, RARITY_META, SLOT_META, SLOT_STAT, GEAR_STAT_LABEL, fmtGearStat, gearById, isGearUpgrade, GearSlot, GearRarity, OwnedGear } from '@/utils/gear';
import { RYNEK_BG, RYNEK_TOP, RYNEK_BOTTOM, RYNEK_TOP_ASPECT, RYNEK_BOTTOM_ASPECT, RYNEK_TOP_SLOTS, RYNEK_BOTTOM_SLOTS, PctRect } from '@/utils/rynekArt';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Pozycjonuje dziecko wewnątrz `s.artPiece` (position:relative, wymiary z aspectRatio) na
// procentowy prostokąt zmierzony na obrazku — patrz `rynekArt.ts`.
const pctStyle = (r: PctRect) => ({
  left: `${r.left}%`, top: `${r.top}%`, width: `${r.width}%`, height: `${r.height}%`,
}) as any;

const FREEZE_COST = 50;   // monet za jedno zamrożenie serii

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// "Dzień sklepu" dla Sklepu dnia (2026-08-20, user: "dodaj za ile odświeża sie sklep,
// codziennie o 6:00") — rolluje się o 6:00 rano, NIE o północy jak `todayKey()` (dailybox/
// streak zostają na starym, kalendarzowym `todayKey` — user prosił konkretnie o sklep, nie o
// całą apkę). Przed 6:00 to dalej "wczorajszy" dzień sklepowy — zestaw 3 itemów trzyma się
// przez noc do 6:00, nie znika o północy.
const SHOP_REFRESH_HOUR = 6;
function shopDayKey(d: Date = new Date()): string {
  const shifted = new Date(d);
  if (shifted.getHours() < SHOP_REFRESH_HOUR) shifted.setDate(shifted.getDate() - 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
}
function nextShopRefresh(d: Date = new Date()): Date {
  const next = new Date(d);
  next.setHours(SHOP_REFRESH_HOUR, 0, 0, 0);
  if (next <= d) next.setDate(next.getDate() + 1);
  return next;
}
// Statyczne w chwili renderu, nie żywy tiker (ten sam wzorzec co fmtEnergyCountdown w
// bosses.tsx) — user i tak wraca na ten ekran co jakiś czas, nie trzeba tykać co sekundę.
function fmtShopRefresh(): string {
  const ms = Math.max(0, nextShopRefresh().getTime() - Date.now());
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

// Sklep (2026-08-19, restrukturyzacja) — kosmetyka kotka (kolory/oczy/nosek/dodatki)
// PRZENIESIONA do PetCustomizeModal (modal edycji imienia na /pet) — user: "nie przecież
// kliknięciem głaskam kotka to nie może... lepiej dać przy edycji imienia". Startupy (kosmetyk
// ekranu ładowania) DOŁĄCZYŁY do tej przeprowadzki (2026-09-02, user: "przenieś z rynku
// pupila startupy na [modal], gdzie ma edycję nazwy i kolory") — mimo że pierwotnie (2026-08-19)
// świadomie zostały TU, jako "nie kotek"; user po czasie chciał jednak WSZYSTKĄ kosmetykę w
// jednym miejscu. Ten ekran zostaje czysto "co kupić za gold": skrzynki (gacha) + sklep dnia
// (4 konkretne itemy ekwipunku, gwarantowany zakup, roluje się co dzień) — jedna zakładka
// "Rynek", bez kategorii-przełącznika (miał sens tylko przy 3 zakładkach, przy jednej to
// martwy UI). `grantStartup` (nagroda ze skrzynki) ZOSTAJE — startupy dalej dropują z gaczy,
// tylko wybór/zakup przeniósł się do PetCustomizeModal.

export default function PetShop() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { coins, xp, ownedItems, buyItem, addCoins, spendCoins, grantStartup,
    claimDailyBox, dayClaims, grantGear, buyDailyGear, equippedGear, ownedGear,
    ownedCombatItems, grantOrLevelCombatItem } = usePetStore();
  const petLevel = levelFromXp(xp).level;
  const freezes    = useStreakFreezeStore(st => st.freezes);
  const addFreezes = useStreakFreezeStore(st => st.addFreezes);

  const [reveal, setReveal] = useState<{ box: LootBox; reward: BoxReward; dupeCoins?: number } | null>(null);
  // Podgląd statów PRZED zakupem w Sklepie dnia (2026-08-22, user: "jak klikam w sklepiku to
  // żeby po kliknięciu w item pokazywało jego staty i porównanie z itemem założonym") — dawniej
  // tap na kafelku szedł od razu do `onBuyDaily`/ConfirmDialog bez pokazania CO właściwie się
  // kupuje. Tylko Sklep dnia — jedyna zakładka sprzedająca KONKRETNE itemy ekwipunku o znanym
  // staty/rarity; skrzynki (losowe) tego nie mają.
  const [gearPreview, setGearPreview] = useState<DailyShopSlot | null>(null);

  const [pendingBuy, setPendingBuy] = useState<{ name: string; cost: number; onYes: () => void; verb: string; extra?: string } | null>(null);
  const confirmBuy = (name: string, cost: number, onYes: () => void, verb = 'Kup', extra?: string) => {
    setPendingBuy({ name, cost, onYes, verb, extra });
  };

  const onBuyFreeze = () => {
    haptic.tap();
    if (coins < FREEZE_COST) { haptic.error(); toast.error(`Za mało monet — potrzeba ${FREEZE_COST}`); return; }
    confirmBuy('Zamrożenie serii', FREEZE_COST, () => {
      if (spendCoins(FREEZE_COST)) { addFreezes(1); haptic.success(); toast.success('Kupione: Zamrożenie serii ❄'); }
    });
  };

  // Kup skrzynkę → POTWIERDŹ → wylosuj → przyznaj nagrodę → pokaż odsłonę.
  const onBuyBox = (box: LootBox) => {
    haptic.tap();
    if (coins < box.cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${box.cost}`); return; }
    // Kafelek-okno na tablicy Rynku (2026-09-05) nie ma już miejsca na blurb/odds jak dawny
    // pełnoszerokościowy wiersz — obie linijki idą teraz do ConfirmDialog, żeby user dalej
    // widział je PRZED zakupem, nie tylko rozmiar/emoji skrzynki.
    const odds = `${box.blurb}\nekwipunek ${Math.round(box.gearChance * 100)}% · kolor ${Math.round(box.colorChance * 100)}% · ❄ ${Math.round(box.freezeChance * 100)}% · reszta monety`;
    confirmBuy(box.name, box.cost, () => {
      if (!spendCoins(box.cost)) { haptic.error(); toast.error('Nie udało się kupić skrzynki'); return; }
      const reward = rollBox(box, SHOP_COLORS, ownedItems, petLevel, ownedCombatItems);
      let dupeCoins: number | undefined;
      if (reward.type === 'color') buyItem(reward.colorId, 0);
      else if (reward.type === 'startup') grantStartup(reward.startupId);
      else if (reward.type === 'coins') addCoins(reward.coins);
      else if (reward.type === 'freeze') addFreezes(reward.count);
      else if (reward.type === 'gear') { const c = grantGear(reward.itemId, reward.rarity, reward.value); if (c > 0) dupeCoins = c; }
      else if (reward.type === 'combatItem') grantOrLevelCombatItem(reward.itemId, reward.level);
      haptic.success();
      setReveal({ box, reward, dupeCoins });
    }, 'Otwórz', odds);
  };

  // Darmowa skrzynka dnia — raz dziennie: losuj i przyznaj (jak w sklepowej gaczy).
  const dailyReady = !dayClaims[`dailybox:${todayKey()}`];
  const onDailyBox = () => {
    haptic.tap();
    if (!dailyReady || !claimDailyBox()) { haptic.error(); toast.info('Skrzynkę dnia już odebrałeś — wróć jutro'); return; }
    const reward = rollBox(DAILY_BOX, SHOP_COLORS, ownedItems, petLevel, ownedCombatItems);
    let dupeCoins: number | undefined;
    if (reward.type === 'color') buyItem(reward.colorId, 0);
    else if (reward.type === 'startup') grantStartup(reward.startupId);
    else if (reward.type === 'coins') addCoins(reward.coins);
    else if (reward.type === 'freeze') addFreezes(reward.count);
    else if (reward.type === 'gear') { const c = grantGear(reward.itemId, reward.rarity, reward.value); if (c > 0) dupeCoins = c; }
    else if (reward.type === 'combatItem') grantOrLevelCombatItem(reward.itemId, reward.level);
    haptic.success();
    setReveal({ box: DAILY_BOX, reward, dupeCoins });
  };

  // Sklep dnia — 4 KONKRETNE itemy ekwipunku, gwarantowany zakup (nie loteria), roluje się
  // co dzień o 6:00 rano (dailyShopSlots w gear.ts, deterministycznie po `shopDayKey`).
  const dailySlots = useMemo(() => dailyShopSlots(shopDayKey(), petLevel), [petLevel]);
  // Posiadasz już ten item w tej rzadkości LUB lepszej? (2026-08-26, user: "kupiłem item który
  // już miałem przez co zniknęły mi pieniądze i nic nie dostałem" — dawniej ani lista, ani
  // podgląd nie sprawdzały tego wprost, więc user nie miał jak się zorientować przed
  // zakupem; prawdziwa blokada zakupu jest w `petStore.buyDailyGear`, to tu jest tylko UI
  // pokazujące ten sam stan WCZEŚNIEJ, żeby nie trzeba było w ogóle próbować kupować).
  // isGearUpgrade (2026-08-31) zamiast porównania samej rzadkości — patrz komentarz przy
  // GearPreviewModal niżej. `value` teraz wymagany — Sklep dnia oferuje KONKRETNY roll
  // (`dailyShopSlots`), więc "już masz (lub lepszy)" musi porównać z TYM rollem, nie tylko
  // z rzadkością.
  const alreadyOwnGear = (itemId: string, rarity: GearRarity, value: number) => {
    return !isGearUpgrade({ rarity, value }, ownedGear[itemId]);
  };
  const onBuyDaily = (itemId: string, rarity: ReturnType<typeof dailyShopSlots>[number]['rarity'], cost: number, value: number, name: string) => {
    haptic.tap();
    const dayKey = `gearDaily:${shopDayKey()}:${itemId}`;
    if (dayClaims[dayKey]) return;
    if (alreadyOwnGear(itemId, rarity, value)) { haptic.error(); toast.error('Masz już ten przedmiot (lub lepszy)'); return; }
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmBuy(name, cost, () => {
      if (buyDailyGear(dayKey, itemId, rarity, cost, value)) { haptic.success(); toast.success(`Kupione: ${name}`); }
      else { haptic.error(); toast.error('Nie udało się kupić'); }
    });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Tło Rynku (2026-09-05) — scena wnętrza sklepu na CAŁY ekran, pod headerem i
          scrollem (oba mają przezroczyste tło, patrz style). Patrz `rynekArt.ts` po
          kontekst trzech warstw. */}
      <ImageBackground source={RYNEK_BG} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Sklep</Text>
        <View style={s.coinPill}><Coins size={13} color="#FBBF24" /><Text style={s.coinTxt}>{coins}</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* PRZYPIĘTE NA GÓRZE — zamrożenie serii (najważniejsze, funkcjonalne) */}
        <PressableScale onPress={onBuyFreeze}>
          <View style={s.freezeHero}>
            <View style={s.freezeIcon}><Snowflake size={22} color="#7DD3FC" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.freezeTitle}>Zamrożenie serii</Text>
              <Text style={s.freezeSub}>ratuje serię za 1 pominięty dzień · masz: {freezes}</Text>
            </View>
            <View style={s.buyPill}><Coins size={11} color="#FBBF24" /><Text style={s.buyPillTxt}>{FREEZE_COST}</Text></View>
          </View>
        </PressableScale>

        {/* ── RYNEK — skrzynka dnia (darmowa) + 3 skrzynki (gacha) na "tablicy" LADAGORA,
            4 okna. Dawny pełnoszerokościowy hero-wiersz skrzynki dnia i lista skrzynek
            (2026-08-27) ZASTĄPIONE tym samym contentem, tylko jako okna na grafice usera
            (2026-09-05) — patrz `rynekArt.ts`. ── */}
        <View style={{ gap: spacing[2] }}>
          <Text style={[s.subSection, { color: c.text.muted }]}>Skrzynki</Text>
          <Text style={s.blurbTop}>Pierwsze okno: skrzynka dnia za darmo. Reszta losuje ekwipunek, kolor kotka (im rzadszy tym trudniej), zamrożenie albo monety.</Text>
          <View style={[s.artPiece, { aspectRatio: RYNEK_TOP_ASPECT }]}>
            <Image source={RYNEK_TOP} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
            <PressableScale onPress={onDailyBox} style={[s.artSlot, pctStyle(RYNEK_TOP_SLOTS[0])]}>
              <Gift size={26} color={dailyReady ? '#FBBF24' : c.text.muted} />
              {dailyReady
                ? <View style={s.artSlotBadge}><Text style={s.artSlotBadgeTxt}>ODBIERZ</Text></View>
                : <View style={[s.artSlotCheck, { backgroundColor: c.text.muted }]}><Check size={11} color="#0B0E1A" strokeWidth={3} /></View>}
            </PressableScale>
            {LOOT_BOXES.map((box, i) => {
              const afford = coins >= box.cost;
              return (
                <PressableScale key={box.id} onPress={() => onBuyBox(box)} style={[s.artSlot, pctStyle(RYNEK_TOP_SLOTS[i + 1])]}>
                  <Text style={[s.boxEmoji, !afford && { opacity: 0.5 }]}>{box.emoji}</Text>
                  <View style={[s.artCostPill, !afford && { opacity: 0.5 }]}><Coins size={9} color="#FBBF24" /><Text style={s.buyPillTxt}>{box.cost}</Text></View>
                </PressableScale>
              );
            })}
          </View>
        </View>

        {/* ── Sklep dnia — 4 konkretne itemy ekwipunku na dziś, teraz jako górny rząd okien
            lady LADADOL (dolny rząd nieużywany, patrz `rynekArt.ts`). Popup ze statystykami
            i porównaniem (`GearPreviewModal`) BEZ ZMIAN — tylko trigger się przeniósł z
            plain-kafelka na okno na grafice. ── */}
        <View style={{ gap: spacing[2] }}>
          <Text style={[s.subSection, { color: c.text.muted }]}>Sklep dnia</Text>
          <Text style={s.blurbTop}>4 konkretne itemy ekwipunku na dziś — gwarantowany zakup, nie loteria.</Text>
          <Text style={s.refreshTxt}>Nowy zestaw za {fmtShopRefresh()} (codziennie o 6:00)</Text>
          {dailySlots.length === 0 && (
            <Text style={s.blurbTop}>Brak dostępnych itemów na twoim poziomie jeszcze.</Text>
          )}
          <View style={[s.artPiece, { aspectRatio: RYNEK_BOTTOM_ASPECT }]}>
            <Image source={RYNEK_BOTTOM} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
            {dailySlots.map((slot, i) => {
              const { item, rarity, value } = slot;
              const dayKey = `gearDaily:${shopDayKey()}:${item.id}`;
              const bought = !!dayClaims[dayKey];
              const owned = alreadyOwnGear(item.id, rarity, value);
              const meta = RARITY_META[rarity];
              return (
                <PressableScale key={item.id} onPress={() => { haptic.tap(); setGearPreview(slot); }} style={[s.artSlot, pctStyle(RYNEK_BOTTOM_SLOTS[i])]}>
                  <Image source={item.icon} style={s.artSlotImg} resizeMode="contain" />
                  {(bought || owned) && (
                    <View style={[s.artSlotCheck, { backgroundColor: meta.color }]}>
                      <Check size={11} color="#0B0E1A" strokeWidth={3} />
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </View>
        </View>

        <Text style={s.hint}>Monety: questy (za dbanie o SIEBIE) + darmowa skrzynka dnia + głaskanie kota. Startupy (ekran ładowania) i kosmetyka kotka: edytuj imię na /pet.</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      <BoxRevealModal
        visible={!!reveal}
        reward={reveal?.reward ?? null}
        boxColor={reveal?.box.color ?? '#9AA6B2'}
        boxEmoji={reveal?.box.emoji ?? '🎁'}
        dupeCoins={reveal?.dupeCoins}
        onClose={() => setReveal(null)}
      />

      <PupilNavbar current="shop" />
      <ConfirmDialog
        visible={!!pendingBuy}
        title="Potwierdź zakup"
        message={pendingBuy ? `${pendingBuy.name} — ${pendingBuy.cost} monet${pendingBuy.extra ? `\n${pendingBuy.extra}` : ''}` : ''}
        confirmLabel={pendingBuy?.verb ?? 'Kup'}
        cancelLabel="Anuluj"
        destructive={false}
        onConfirm={() => { pendingBuy?.onYes(); setPendingBuy(null); }}
        onCancel={() => setPendingBuy(null)}
      />
      <GearPreviewModal
        slot={gearPreview}
        equippedGear={equippedGear}
        ownedGear={ownedGear}
        dayClaims={dayClaims}
        coins={coins}
        onBuy={(item, rarity, cost, value) => { setGearPreview(null); onBuyDaily(item.id, rarity, cost, value, item.name); }}
        onClose={() => setGearPreview(null)}
      />
    </SafeAreaView>
  );
}

// Podgląd itemu przed zakupem (2026-08-22) — patrz komentarz przy `gearPreview` state wyżej.
// Ten sam wzorzec porównania co GearSlotModal w GearPanel.tsx (stat + delta vs założony), ale
// tu ITEM JESZCZE NIE JEST WŁASNOŚCIĄ gracza — porównanie idzie do TEGO CO JEST ZAŁOŻONE W
// TYM SLOCIE TERAZ, nie do listy posiadanych wariantów jak w GearSlotModal.
function GearPreviewModal({ slot, equippedGear, ownedGear, dayClaims, coins, onBuy, onClose }: {
  slot: DailyShopSlot | null;
  equippedGear: Partial<Record<GearSlot, string>>;
  ownedGear: Partial<Record<string, OwnedGear>>;
  dayClaims: Record<string, true>;
  coins: number;
  onBuy: (item: DailyShopSlot['item'], rarity: DailyShopSlot['rarity'], cost: number, value: number) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  if (!slot) return null;
  const { item, rarity, cost, value: val } = slot;
  const meta = RARITY_META[rarity];
  const stat = SLOT_STAT[item.slot];
  const equippedId = equippedGear[item.slot];
  const equippedItem = equippedId ? gearById(equippedId) : undefined;
  const equippedOwned = equippedId ? ownedGear[equippedId] : undefined;
  const equippedVal = equippedOwned ? equippedOwned.value : 0;
  const delta = val - equippedVal;
  const dayKey = `gearDaily:${shopDayKey()}:${item.id}`;
  const bought = !!dayClaims[dayKey];
  // Posiadasz już to (lub lepsze)? Osobny stan od `bought` (2026-08-26 fix) — `bought` jest
  // TYLKO o dzisiejszym zakupie tego konkretnego slotu, więc item posiadany z KRZYŻA innego
  // dnia albo ze skrzynki wcześniej pokazywał tu mylący przycisk "Kup", mimo że kupno by nic
  // nie dało (patrz `buyDailyGear` w petStore.ts — teraz i tak by odrzuciło zakup).
  // `isGearUpgrade` (2026-08-31) zamiast porównania samej rzadkości — ta sama rzadkość z
  // LEPSZYM rollem niż posiadany dalej jest realnym ulepszeniem, patrz gear.ts.
  const alreadyHave = !isGearUpgrade({ rarity, value: val }, ownedGear[item.id]);
  const afford = coins >= cost;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.previewOverlay}>
        <View style={s.previewSheet}>
          <View style={s.sheetHead}>
            <Text style={s.title2}>{item.name}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color={c.text.primary} /></TouchableOpacity>
          </View>
          <View style={s.previewTop}>
            <View style={[s.boxIcon, { backgroundColor: meta.color + '1E', borderColor: meta.color + '55', width: 64, height: 64 }]}>
              <Image source={item.icon} style={{ width: 40, height: 40 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cellState, { color: meta.color, fontSize: 12, fontWeight: '800' }]}>{meta.label} · {SLOT_META[item.slot].label}</Text>
              <Text style={s.previewStat}>{GEAR_STAT_LABEL[stat]}: {fmtGearStat(stat, val)}{stat === 'flatHp' ? ' HP' : ''}</Text>
              {equippedItem ? (
                <Text style={[s.deltaTxt, { color: delta > 0 ? '#2AC68F' : delta < 0 ? '#EF4444' : c.text.muted }]}>
                  {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {delta === 0 ? 'tyle samo' : `${fmtGearStat(stat, Math.abs(delta))} vs założony (${equippedItem.name})`}
                </Text>
              ) : (
                <Text style={[s.deltaTxt, { color: c.text.muted }]}>Nic nie masz założone w tym slocie</Text>
              )}
            </View>
          </View>
          {bought ? (
            <View style={s.previewBoughtRow}><Check size={16} color={meta.color} /><Text style={[s.previewBoughtTxt, { color: meta.color }]}>Już kupione dziś</Text></View>
          ) : alreadyHave ? (
            <View style={s.previewBoughtRow}><Check size={16} color={meta.color} /><Text style={[s.previewBoughtTxt, { color: meta.color }]}>Posiadasz ten przedmiot</Text></View>
          ) : (
            <TouchableOpacity
              style={[s.previewBuyBtn, !afford && { opacity: 0.5 }]}
              onPress={() => { haptic.tap(); onBuy(item, rarity, cost, val); }}
              disabled={!afford}
            >
              <Coins size={15} color="#0B0E1A" /><Text style={s.previewBuyTxt}>Kup za {cost}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  // Scrim za headerem (2026-09-05) — tło Rynku jest teraz ruchliwą grafiką pod spodem,
  // bez półprzezroczystego paska back/tytuł/monety zlewałyby się z tłem. Świadomie zwykłe
  // rgba, BEZ BlurView (ten sam wybór co TabBar — "czyściej + płynniej na Androidzie").
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3], backgroundColor: c.bg.primary + 'CC' },
  title: { fontSize: 18, fontWeight: '800', color: c.text.primary, flex: 1 },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FBBF2440' },
  coinTxt: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },
  scroll: { paddingHorizontal: spacing[4], gap: spacing[3], paddingTop: spacing[1] },

  // przypięty freeze
  freezeHero: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: '#7DD3FC44', backgroundColor: '#7DD3FC12' },
  freezeIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#7DD3FC1E', borderWidth: 1, borderColor: '#7DD3FC44', alignItems: 'center', justifyContent: 'center' },
  freezeTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  freezeSub: { fontSize: 11, color: c.text.muted, marginTop: 1 },

  boxIcon: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  boxEmoji: { fontSize: 26 },
  blurbTop: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16 },
  refreshTxt: { fontSize: 10.5, color: c.text.muted, fontWeight: '700', marginTop: -4 },

  // Kafelki na "tablicy"/ladzie Rynku (2026-09-05) — `s.artPiece` to kontener o wymiarach
  // `width:'100%'` + `aspectRatio` z `rynekArt.ts` (skaluje się z ekranem, bez zniekształcania
  // grafiki), dzieci to `PressableScale` pozycjonowane PROCENTOWO (`pctStyle`) na zmierzone
  // okna. Ten sam wzorzec co dawny `dailyGrid`/`dailyTile` (kwadratowy kafelek + check-badge
  // w rogu), tylko teraz miejsce kafelka dyktuje grafika, nie flex-wrap.
  artPiece: { width: '100%', position: 'relative' },
  artSlot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  artSlotImg: { width: '62%', height: '62%' },
  artSlotCheck: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  artCostPill: { position: 'absolute', bottom: -8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#FBBF2440' },
  artSlotBadge: { position: 'absolute', bottom: -8, backgroundColor: '#FBBF24', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  artSlotBadgeTxt: { fontSize: 9, fontWeight: '900', color: '#0B0E1A', letterSpacing: 0.3 },

  subSection: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  cellState: { fontSize: 10, color: c.text.muted },

  buyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FBBF2440' },
  buyPillTxt: { fontSize: 12, fontWeight: '800', color: '#FBBF24' },

  hint: { fontSize: 11, color: c.text.muted, textAlign: 'center', marginTop: spacing[2] },

  // Posiadane — pusty stan

  // podgląd itemu ze Sklepu dnia przed zakupem
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'flex-end' },
  previewSheet: { width: '100%', maxWidth: 480, backgroundColor: c.bg.primary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[4], gap: spacing[3] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title2: { fontSize: 16, fontWeight: '800', color: c.text.primary, flex: 1, marginRight: spacing[2] },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  previewStat: { fontSize: 13, color: c.text.primary, fontWeight: '700', marginTop: 4 },
  deltaTxt: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  previewBoughtRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing[3] },
  previewBoughtTxt: { fontSize: 13, fontWeight: '800' },
  previewBuyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FBBF24', borderRadius: radius.lg, paddingVertical: 14 },
  previewBuyTxt: { fontSize: 14, fontWeight: '900', color: '#0B0E1A' },
}));
