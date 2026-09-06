import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Coins, Check, Snowflake, Gift, X, SlidersHorizontal } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BoxRevealModal from '@/components/pet/BoxRevealModal';
import PupilNavbar from '@/components/pet/PupilNavbar';
import CatArt from '@/components/pet/CatArt';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { SHOP_COLORS } from '@/utils/petShop';
import { SHOPKEEPER_PALETTE } from '@/utils/catPalettes';
import { LOOT_BOXES, DAILY_BOX, LootBox, rollBox, BoxReward } from '@/utils/petBoxes';
import { dailyShopSlots, DailyShopSlot, RARITY_META, SLOT_META, SLOT_STAT, GEAR_STAT_LABEL, fmtGearStat, gearById, isGearUpgrade, GearSlot, GearRarity, OwnedGear } from '@/utils/gear';
import { RYNEK_BG, RYNEK_TOP, RYNEK_BOTTOM, RYNEK_TOP_ASPECT, RYNEK_BOTTOM_ASPECT, RYNEK_TOP_SLOTS, RYNEK_BOTTOM_SLOTS, PctRect } from '@/utils/rynekArt';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Pozycjonuje dziecko wewnątrz `s.artPiece` na procentowy prostokąt zmierzony na obrazku —
// patrz `rynekArt.ts`.
const pctStyle = (r: PctRect) => ({
  left: `${r.left}%`, top: `${r.top}%`, width: `${r.width}%`, height: `${r.height}%`,
}) as any;

// Szerokość obu kawałków grafiki Rynku liczona WPROST z `Dimensions` (2026-09-06, fix po
// zgłoszeniu usera: "grafiki wychodzą poza ekran") — dawne `width:'100%'` + `aspectRatio` na
// dziecku wewnątrz `s.scene` (który ma `gap`) dawało na części urządzeń zawyżoną szerokość
// zamiast dopasować się do ekranu, więc `resizeMode="contain"` skalował obrazek w GÓRĘ od tej
// zawyżonej podstawy i wychodził poza widoczny ekran. Zamiast liczyć na Yogę (aspectRatio +
// procent + gap w tym samym łańcuchu), liczymy szerokość i wysokość WPROST w pikselach — ten
// sam wzorzec co `missionBarFillPx` w app/pet.tsx (jawna matematyka zamiast CSS-owego
// aspectRatio, żeby wyeliminować możliwość takiego rozjazdu).
const SCREEN_W = Dimensions.get('window').width;
const ART_CONTENT_W = SCREEN_W - spacing[4] * 2;   // dokładnie tyle, ile zostaje po paddingHorizontal `s.scroll`

// Ręczny "edytor sceny" (2026-09-06, user po kolejnym zrzucie "nadal [źle]": zamiast żebym
// dalej zgadywał współrzędne na ślepo bez dostępu do urządzenia, user dostaje suwaki do
// samodzielnego dostrojenia NA ŻYWO na telefonie, a potem przycisk "Eksportuj" wypluwa
// dokładne liczby do wklejenia w czacie — ja je już tylko wpisuję na sztywno jako nowe
// wartości domyślne, zero kolejnych rund zgadywania). Draft 3 (ten sam dzień, user po
// drafcie 2: "steruję slotami i skaluję sloty razem z tą grafiką... nie mogę jej w ogóle
// poprzesuwać, klikam i nie widzę") — dwa realne problemy z draftu 2:
// 1. Panel był pełnoekranowym `<Modal>` — user dostrajał "na ślepo", bo sam edytor
//    ZASŁANIAŁ scenę, którą miał dostrajać. Naprawa: panel to teraz NIE modal, tylko
//    pływający, PÓŁPRZEZROCZYSTY pasek przyklejony do DOŁU ekranu (nad `PupilNavbar`),
//    zajmujący ~46% wysokości — górna część sceny zostaje widoczna nad panelem, a user
//    może przescrollować `ScrollView` żeby ustawić w tej widocznej części dokładnie to,
//    co dostraja.
// 2. Dla tablicy/lady jeden wspólny `x/y/scale` poruszał NAROŻNIKI + SLOTY (klikalne okna
//    na skrzynki/itemy) RAZEM — user chciał móc naprawić NIEDOPASOWANIE między obrazkiem a
//    siatką slotów (czyli poruszyć je WZGLĘDEM SIEBIE), a nie tylko przesunąć oba na raz.
//    Naprawa: `topSlots`/`bottomSlots` to NIEZALEŻNA druga warstwa (osobny x/y/scale) nad
//    obrazkiem tej samej wielkości co `top`/`bottom` — steruje WYŁĄCZNIE pozycją/skalą
//    siatki klikalnych okien, obrazek pod spodem się nie rusza.
// `scale: 1` = dzisiejszy domyślny rozmiar/pozycja dla każdej warstwy z osobna, `x`/`y` to
// przesunięcie w px od tej domyślnej pozycji (czysty `transform`). Wartości persystują w
// AsyncStorage, panel schowany za ikoną w headerze.
interface ImgAdjust { x: number; y: number; scale: number }
interface ArtAdjust {
  bg: ImgAdjust; top: ImgAdjust; topSlots: ImgAdjust; cat: ImgAdjust; bottom: ImgAdjust; bottomSlots: ImgAdjust;
}
const DEFAULT_IMG: ImgAdjust = { x: 0, y: 0, scale: 1 };
const DEFAULT_ADJUST: ArtAdjust = {
  bg: { ...DEFAULT_IMG }, top: { ...DEFAULT_IMG }, topSlots: { ...DEFAULT_IMG },
  cat: { ...DEFAULT_IMG }, bottom: { ...DEFAULT_IMG }, bottomSlots: { ...DEFAULT_IMG },
};
const ADJUST_KEY = 'rynek_art_adjust_v3';
const IMG_GROUPS: { key: keyof ArtAdjust; label: string }[] = [
  { key: 'bg', label: 'Tło (cała scena)' },
  { key: 'top', label: 'Tablica — obrazek' },
  { key: 'topSlots', label: 'Tablica — sloty (klikalne okna)' },
  { key: 'cat', label: 'Sklepikarz' },
  { key: 'bottom', label: 'Lada — obrazek' },
  { key: 'bottomSlots', label: 'Lada — sloty (klikalne okna)' },
];
const IMG_FIELDS: { key: keyof ImgAdjust; label: string; step: number; min: number; max: number; fmt: (v: number) => string }[] = [
  { key: 'x', label: 'Pozycja X', step: 4, min: -160, max: 160, fmt: v => `${v}px` },
  { key: 'y', label: 'Pozycja Y', step: 4, min: -160, max: 160, fmt: v => `${v}px` },
  { key: 'scale', label: 'Skala', step: 0.02, min: 0.6, max: 1.6, fmt: v => `${Math.round(v * 100)}%` },
];

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

  // Edytor sceny Rynku — patrz komentarz przy `ArtAdjust` u góry pliku. Ładowany raz z
  // AsyncStorage; `adjustLoaded` chroni przed nadpisaniem zapisanych wartości domyślnymi
  // zanim odczyt zdąży wrócić (ten sam wzorzec co reszta store'ów w apce).
  const [adjust, setAdjust] = useState<ArtAdjust>(DEFAULT_ADJUST);
  const [adjustLoaded, setAdjustLoaded] = useState(false);
  const [editScene, setEditScene] = useState(false);
  const [showExport, setShowExport] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(ADJUST_KEY).then(raw => {
      if (raw) { try { setAdjust({ ...DEFAULT_ADJUST, ...JSON.parse(raw) }); } catch {} }
      setAdjustLoaded(true);
    }).catch(() => setAdjustLoaded(true));
  }, []);
  useEffect(() => {
    if (!adjustLoaded) return;
    AsyncStorage.setItem(ADJUST_KEY, JSON.stringify(adjust)).catch(() => {});
  }, [adjust, adjustLoaded]);
  const stepImgAdjust = (group: keyof ArtAdjust, field: keyof ImgAdjust, dir: 1 | -1) => {
    haptic.tap();
    const f = IMG_FIELDS.find(f => f.key === field)!;
    setAdjust(a => {
      const raw = Math.min(f.max, Math.max(f.min, a[group][field] + dir * f.step));
      return { ...a, [group]: { ...a[group], [field]: Math.round(raw * 100) / 100 } };
    });
  };
  const resetAdjust = () => { haptic.tap(); setAdjust(DEFAULT_ADJUST); setShowExport(false); };

  // Rozmiary sceny wyliczone z aktualnych `adjust` (zamiast sztywnego ART_CONTENT_W) — patrz
  // komentarz przy `RYNEK_BG` w rynekArt.ts oraz przy `ArtAdjust` u góry tego pliku. Tablica/
  // lada/kotek: `scale` zmienia rozmiar (i tym samym miejsce zarezerwowane w layoucie), `x`/`y`
  // to czysty `transform` (przesunięcie WIZUALNE, nie zmienia zarezerwowanego miejsca — więc
  // np. ujemny `cat.y` "podciąga" kotka bliżej tablicy bez przeliczania reszty sceny). Tło:
  // `scale` to mnożnik NAD minimalną skalą `cover` (1.0 = dokładnie tyle co dziś, wypełnia bez
  // przycinania na sztywno), `x`/`y` przesuwają wykadrowany fragment od domyślnego środka —
  // jednolity model z resztą grafik zamiast osobnego `bgFocusY` z draftu 1.
  const bgSrc = useMemo(() => Image.resolveAssetSource(RYNEK_BG), []);
  const topW = ART_CONTENT_W * adjust.top.scale;
  const topH = topW / RYNEK_TOP_ASPECT;
  const botW = ART_CONTENT_W * adjust.bottom.scale;
  const botH = botW / RYNEK_BOTTOM_ASPECT;
  const catSize = 140 * adjust.cat.scale;
  const sceneH = topH + spacing[3] + catSize + spacing[3] + botH;
  const bgMinScale = Math.max(ART_CONTENT_W / bgSrc.width, sceneH / bgSrc.height);
  const bgScale = bgMinScale * adjust.bg.scale;
  const bgRenderW = bgSrc.width * bgScale;
  const bgRenderH = bgSrc.height * bgScale;
  const bgLeft = (ART_CONTENT_W - bgRenderW) / 2 + adjust.bg.x;
  const bgTop = (sceneH - bgRenderH) / 2 + adjust.bg.y;

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
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Sklep</Text>
        <View style={s.coinPill}><Coins size={13} color="#FBBF24" /><Text style={s.coinTxt}>{coins}</Text></View>
        {/* Edytor sceny (2026-09-06) — ukryty za ikoną, nie przeszkadza w normalnym sklepie. */}
        <TouchableOpacity onPress={() => { haptic.tap(); setEditScene(true); }} hitSlop={10} style={{ marginLeft: spacing[2] }}>
          <SlidersHorizontal size={18} color={c.text.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* PRZYPIĘTE NA GÓRZE — zamrożenie serii (najważniejsze, funkcjonalne) */}
        <PressableScale onPress={onBuyFreeze}>
          <View style={s.freezeHero}>
            <LinearGradient
              colors={['#7DD3FC22', '#7DD3FC08'] as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={s.freezeIcon}><Snowflake size={22} color="#7DD3FC" /></View>
            <View style={{ flex: 1 }}>
              {/* Podpis "ratuje serię za 1 pominięty dzień" USUNIĘTY (2026-09-06, user:
                  "wypierdol te napisy wszystkie... i wgle przebuduj żeby było dobrze" —
                  odchudzenie sceny Rynku z instruktażowych podpisów objęło też tę kartę) —
                  to tekst dla NOWEGO usera, powracający już wie co robi zamrożenie; sama
                  nazwa + licznik posiadanych wystarczy. */}
              <Text style={s.freezeTitle}>Zamrożenie serii</Text>
              <Text style={s.freezeSub}>masz: {freezes}</Text>
            </View>
            <View style={s.buyPill}><Coins size={11} color="#FBBF24" /><Text style={s.buyPillTxt}>{FREEZE_COST}</Text></View>
          </View>
        </PressableScale>

        {/* ── SCENA RYNKU (2026-09-05, fix po zgłoszeniu usera: "grafiki wstawione nie na
            miejscu... rusza się a miało być statyczne jakby ze sobą") — tło było wcześniej
            `position:absolute` PRZYPIĘTE DO EKRANU jako sibling ScrollView, podczas gdy
            tablica/luka-ze-sklepikarzem/lada scrollowały NORMALNIE w środku ScrollView —
            przy scrollu tło zostawało w miejscu a grafiki nad nim jechały, więc licznik
            (kontuar mający stać na podłodze, tablica wisząca u sufitu) odjeżdżał od tła
            i wyglądał "nie na miejscu"/"w złej skali", mimo że każdy z 3 plików osobno miał
            poprawny rozmiar. Naprawa: `RYNEK_BG` teraz PIERWSZE DZIECKO w środku TEGO
            `s.scene` wrappera (position:relative, wysokość = suma treści pod spodem, nie
            cały ekran) — tło scrolluje RAZEM z tablicą/kotkiem/ladą bo są w tym samym
            rodzicu, więc zawsze zostają w idealnej rejestracji względem siebie niezależnie
            od pozycji scrolla. Freeze-card (nad scenerią) i `hint` (pod nią) świadomie
            ZOSTAJĄ POZA tym wrapperem — nigdy nie miały wymogu piksel-w-piksel wyrównania
            z konkretnym miejscem na obrazku, to zwykłe karty UI, nie część "obrazu". ── */}
        <View style={[s.scene, { height: sceneH }]}>
          <Image source={RYNEK_BG} style={{ position: 'absolute', width: bgRenderW, height: bgRenderH, left: bgLeft, top: bgTop }} resizeMode="stretch" />

        {/* Skrzynka dnia (darmowa) + 3 skrzynki (gacha) na "tablicy" LADAGORA, 4 okna. Etykieta
            "Skrzynki" + instruktażowy podpis USUNIĘTE (2026-09-06, user: "wypierdol te
            napisy wszystkie... przebuduj żeby było dobrze") — czysta scena bez tekstu na
            tle grafiki, opis skrzynki i tak wyskakuje w ConfirmDialog przy zakupie
            (`odds` w `onBuyBox`), więc informacja nie zniknęła, tylko przestała siedzieć na
            stałe na ekranie. */}
        <View style={{ gap: spacing[2] }}>
          <View style={[s.artPiece, { width: topW, height: topH, alignSelf: 'center' }]}>
            {/* Warstwa OBRAZKA — własne x/y z `adjust.top`, niezależne od siatki slotów pod
                spodem (patrz komentarz przy `ArtAdjust` u góry pliku, draft 3). */}
            <View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: adjust.top.x }, { translateY: adjust.top.y }] }]}>
              <Image source={RYNEK_TOP} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
            </View>
            {/* Warstwa SLOTÓW — własne x/y/scale z `adjust.topSlots`, żeby dało się poprawić
                niedopasowanie siatki klikalnych okien względem narysowanych na obrazku okien,
                bez ruszania samego obrazka. */}
            <View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: adjust.topSlots.x }, { translateY: adjust.topSlots.y }, { scale: adjust.topSlots.scale }] }]}>
              <PressableScale onPress={onDailyBox} style={[s.artSlot, pctStyle(RYNEK_TOP_SLOTS[0])]}>
                <View style={s.artSlotBg} />
                <Gift size={26} color={dailyReady ? '#FBBF24' : c.text.muted} />
                {dailyReady
                  ? <View style={s.artSlotBadge}><Text style={s.artSlotBadgeTxt}>ODBIERZ</Text></View>
                  : <View style={[s.artSlotCheck, { backgroundColor: c.text.muted }]}><Check size={11} color="#0B0E1A" strokeWidth={3} /></View>}
              </PressableScale>
              {LOOT_BOXES.map((box, i) => {
                const afford = coins >= box.cost;
                return (
                  <PressableScale key={box.id} onPress={() => onBuyBox(box)} style={[s.artSlot, pctStyle(RYNEK_TOP_SLOTS[i + 1])]}>
                    <View style={s.artSlotBg} />
                    <Text style={[s.boxEmoji, !afford && { opacity: 0.5 }]}>{box.emoji}</Text>
                    <View style={[s.artCostPill, !afford && { opacity: 0.5 }]}><Coins size={9} color="#FBBF24" /><Text style={s.buyPillTxt}>{box.cost}</Text></View>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </View>

        {/* Sklepikarz (2026-09-05) — kotek w przebraniu (`shopkeeper` prop na CatArt,
            zaprojektowany 2026-09-03, czekał na sam ekran Rynku żeby mieć gdzie stanąć —
            patrz ARCHITECTURE.md §20). Stoi w scenie sklepu widocznej MIĘDZY tablicą a ladą
            (`TLOSKLEPIKARZ` przebija przez tę lukę) — user: "co to jest za sklepik, gdzie
            sklepikarz". Bez `onPress` — `shopkeeper` i tak wygasza tap/cuddle-reakcje
            wewnątrz komponentu, więc obsługa dotyku byłaby martwym kodem. */}
        <View style={{ alignItems: 'center', marginTop: spacing[3], marginBottom: spacing[3] }}>
          <View style={{ transform: [{ translateX: adjust.cat.x }, { translateY: adjust.cat.y }] }}>
            <CatArt size={catSize} palette={SHOPKEEPER_PALETTE} shopkeeper />
          </View>
        </View>

        {/* ── Sklep dnia — 4 konkretne itemy ekwipunku na dziś, teraz jako górny rząd okien
            lady LADADOL (dolny rząd nieużywany, patrz `rynekArt.ts`). Popup ze statystykami
            i porównaniem (`GearPreviewModal`) BEZ ZMIAN — tylko trigger się przeniósł z
            plain-kafelka na okno na grafice. Etykieta "Sklep dnia" + instruktażowy podpis
            USUNIĘTE (2026-09-06, ten sam porządek co "Skrzynki" wyżej) — licznik odświeżenia
            ZOSTAJE (to żywa, funkcjonalna informacja, nie instrukcja), ale jako mała
            pigułka nad ladą zamiast pełnego zdania. ── */}
        <View style={{ gap: spacing[2] }}>
          <View style={[s.artPiece, { width: botW, height: botH, alignSelf: 'center' }]}>
            {/* Warstwa OBRAZKA — patrz analogiczny komentarz przy tablicy wyżej. */}
            <View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: adjust.bottom.x }, { translateY: adjust.bottom.y }] }]}>
              <Image source={RYNEK_BOTTOM} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
            </View>
            {/* Warstwa SLOTÓW + pigułki (żywe, funkcjonalne, więc jadą RAZEM ze slotami, nie
                z samym obrazkiem — mają zostać czytelne względem okien niezależnie od tego,
                jak bardzo obrazek trzeba było doszlifować x/y). */}
            <View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: adjust.bottomSlots.x }, { translateY: adjust.bottomSlots.y }, { scale: adjust.bottomSlots.scale }] }]}>
              <View style={s.refreshRow} pointerEvents="none">
                <View style={s.refreshPill}><Text style={s.refreshPillTxt}>Nowy zestaw za {fmtShopRefresh()}</Text></View>
              </View>
              {dailySlots.length === 0 && (
                <View style={s.emptyRow} pointerEvents="none">
                  <View style={s.refreshPill}><Text style={s.refreshPillTxt}>Brak itemów na Twoim poziomie</Text></View>
                </View>
              )}
              {dailySlots.map((slot, i) => {
                const { item, rarity, value } = slot;
                const dayKey = `gearDaily:${shopDayKey()}:${item.id}`;
                const bought = !!dayClaims[dayKey];
                const owned = alreadyOwnGear(item.id, rarity, value);
                const meta = RARITY_META[rarity];
                return (
                  <PressableScale key={item.id} onPress={() => { haptic.tap(); setGearPreview(slot); }} style={[s.artSlot, pctStyle(RYNEK_BOTTOM_SLOTS[i])]}>
                    {/* Tło slotu = gradient rzadkości (2026-09-05, user: "kolor gradientu za
                        nimi jakby") — ciemny róg dla kontrastu ikony na busy tle, przeciwległy
                        róg podbarwiony kolorem rzadkości, ten sam `meta.color` co plakietka ✓
                        i pigułka w GearPreviewModal, więc kolor rzadkości czyta się spójnie
                        wszędzie w Sklepie dnia. */}
                    <LinearGradient
                      colors={['rgba(0,0,0,0.55)', meta.color + '77'] as [string, string]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.artSlotBg}
                    />
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
      {/* Panel edytora — draft 3 (2026-09-06, user: "klikam i nie widzę"). CELOWO nie
          `<Modal>` — modal zasłaniał całą scenę, więc user dostrajał na ślepo, nie mogąc
          widzieć efektu. Zamiast tego: pływający, PÓŁPRZEZROCZYSTY pasek przyklejony do
          DOŁU ekranu (nad `PupilNavbar`, który się w tym trybie chowa), ~46% wysokości —
          górna część sceny zostaje odsłonięta nad panelem; user przescrolluje `ScrollView`
          pod spodem (dalej aktywny, panel go nie blokuje poza swoim własnym obszarem), żeby
          ustawić w tym widocznym pasku dokładnie to, co akurat dostraja. */}
      {editScene && (
        <View style={s.editorPanel}>
          <View style={s.editorHead}>
            <Text style={s.title2}>Edytor sceny Rynku</Text>
            <TouchableOpacity onPress={() => setEditScene(false)} hitSlop={10}><X size={20} color={c.text.primary} /></TouchableOpacity>
          </View>
          <Text style={s.adjustIntro}>Przescrolluj scenę POD panelem żeby widzieć co zmieniasz. Dostrój, potem "Eksportuj" i wyślij mi te liczby w czacie.</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {IMG_GROUPS.map(g => (
              <View key={g.key} style={s.adjustGroup}>
                <Text style={s.adjustGroupTitle}>{g.label}</Text>
                {IMG_FIELDS.map(f => (
                  <View key={f.key} style={s.adjustRow}>
                    <Text style={s.adjustLabel}>{f.label}</Text>
                    <View style={s.adjustCtrl}>
                      <TouchableOpacity onPress={() => stepImgAdjust(g.key, f.key, -1)} style={s.adjustBtn} hitSlop={6}><Text style={s.adjustBtnTxt}>−</Text></TouchableOpacity>
                      <Text style={s.adjustVal}>{f.fmt(adjust[g.key][f.key])}</Text>
                      <TouchableOpacity onPress={() => stepImgAdjust(g.key, f.key, 1)} style={s.adjustBtn} hitSlop={6}><Text style={s.adjustBtnTxt}>+</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] }}>
              <TouchableOpacity onPress={resetAdjust} style={[s.previewBuyBtn, { flex: 1, backgroundColor: c.bg.secondary }]}>
                <Text style={[s.previewBuyTxt, { color: c.text.primary }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { haptic.tap(); setShowExport(v => !v); }} style={[s.previewBuyBtn, { flex: 1 }]}>
                <Text style={s.previewBuyTxt}>{showExport ? 'Ukryj dane' : 'Eksportuj'}</Text>
              </TouchableOpacity>
            </View>
            {showExport && (
              <View style={s.exportBox}>
                <Text style={s.exportHint}>Zaznacz cały tekst poniżej (długi tap → zaznacz wszystko) i wklej mi w czacie:</Text>
                <Text selectable style={s.exportTxt}>{JSON.stringify(adjust, null, 2)}</Text>
              </View>
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      )}
      {!editScene && <PupilNavbar current="shop" />}
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
            <View style={{ flex: 1, marginRight: spacing[2] }}>
              <Text style={s.title2}>{item.name}</Text>
              {/* Gradientowa kreska rzadkości pod nazwą (2026-09-05, user: "kolor gradientu
                  za nimi jakby + gradientowo kolorowy schludny pod nazwę itemu") — ten sam
                  `meta.color` co reszta modala (etykieta rzadkości, plakietka ✓), gaśnie do
                  przezroczystości zamiast twardej krawędzi. */}
              <LinearGradient
                colors={[meta.color, meta.color + '00'] as [string, string]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.rarityUnderline}
              />
            </View>
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
  freezeHero: { position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: '#7DD3FC44', backgroundColor: '#7DD3FC12' },
  freezeIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#7DD3FC1E', borderWidth: 1, borderColor: '#7DD3FC44', alignItems: 'center', justifyContent: 'center' },
  freezeTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  freezeSub: { fontSize: 11, color: c.text.muted, marginTop: 1 },

  boxIcon: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  boxEmoji: { fontSize: 26 },

  // Scena Rynku (2026-09-05, fix "grafiki się rushają/nie na miejscu") — jeden
  // `position:relative` wrapper wokół tablicy+kotka+lady, żeby `RYNEK_BG` (pierwsze dziecko,
  // absoluteFillObject) scrollował RAZEM z nimi zamiast być przypięty do ekranu jako
  // niezależna warstwa. Wysokość = suma treści w środku (żadnego sztywnego rozmiaru) —
  // działa bo `position:absolute` dziecko w RN rozciąga się do już WYLICZONEGO rozmiaru
  // rodzica, nie wpływa na jego pomiar. `overflow:'hidden'` na wypadek gdyby `cover` na
  // skrajnie wąskim/szerokim ekranie chciał wystawić poza zaokrąglone rogi (scena i tak nie
  // ma tu rogów, ale to tania asekuracja przed przypadkowym poziomym scrollem).
  // `gap` USUNIĘTY (2026-09-06) — odstęp tablica↔kotek↔lada to teraz stały `spacing[3]` jako
  // `marginTop`/`marginBottom` wprost na wrapperze kotka (fine-tuning idzie przez `x`/`y` w
  // edytorze sceny, patrz `ArtAdjust`), nie jeden wspólny `gap` na tym kontenerze.
  scene: { position: 'relative', overflow: 'hidden' },

  // Kafelki na "tablicy"/ladzie Rynku — `s.artPiece` to kontener na PIKSELOWO (nie
  // procentowo) wyliczonych `width`/`height` (patrz `ART_CONTENT_W` u góry pliku — fix
  // 2026-09-06 po zgłoszeniu "grafiki wychodzą poza ekran"), dzieci to `PressableScale`
  // pozycjonowane PROCENTOWO (`pctStyle`) na zmierzone okna względem TEGO kontenera. Ten sam
  // wzorzec co dawny `dailyGrid`/`dailyTile` (kwadratowy kafelek + check-badge w rogu), tylko
  // teraz miejsce kafelka dyktuje grafika, nie flex-wrap.
  artPiece: { position: 'relative' },
  artSlot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  // Ciemne tło slotu bez rzadkości (skrzynka dnia + 3 skrzynki) — 2026-09-05, user: "sloty
  // muszą mieć jaśniejsze lub ciemniejsze lepiej ciemniejsze tło żeby zwiększyć kontrast
  // itemów". Okno na grafice jest samo w sobie przezroczyste (przebija ruchliwe tło sklepu),
  // więc bez tego ikony/emoji ledwo widać. `inset` zamiast absoluteFillObject — mały margines
  // (4%) żeby ciemny prostokąt nie wychodził poza obrys okna narysowanego na grafice.
  artSlotBg: { position: 'absolute', top: '4%', left: '4%', right: '4%', bottom: '4%', borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.5)' },
  artSlotImg: { width: '62%', height: '62%' },
  artSlotCheck: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  artCostPill: { position: 'absolute', bottom: -8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#FBBF2440' },
  artSlotBadge: { position: 'absolute', bottom: -8, backgroundColor: '#FBBF24', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  artSlotBadgeTxt: { fontSize: 9, fontWeight: '900', color: '#0B0E1A', letterSpacing: 0.3 },
  rarityUnderline: { height: 3, borderRadius: 1.5, marginTop: 5, width: '70%' },

  // Pigułka odświeżenia Sklepu dnia (2026-09-06) — zastępuje dawne pełne zdanie tekstu nad
  // ladą ("Nowy zestaw za..." + "Brak itemów...") po usunięciu instruktażowych podpisów z
  // całej sceny Rynku. `refreshRow`/`emptyRow` to niewidoczne, pełnoszerokościowe "wiersze
  // pozycjonujące" (position:absolute + alignItems:center) — sama widoczna pigułka to
  // dziecko `refreshPill`, które hugguje tekst zamiast rozciągać się na całą szerokość.
  refreshRow: { position: 'absolute', top: -13, left: 0, right: 0, alignItems: 'center' },
  emptyRow: { position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center' },
  refreshPill: { backgroundColor: 'rgba(11,14,26,0.85)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  refreshPillTxt: { fontSize: 10.5, fontWeight: '700', color: '#fff' },

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

  // Edytor sceny Rynku (2026-09-06) — patrz `ArtAdjust` u góry pliku. `editorPanel` NIE jest
  // modalem (draft 3, patrz komentarz przy `editScene` w JSX) — pływający pasek przyklejony
  // do dołu, żeby scena nad nim zostawała widoczna i przescrollowywalna podczas dostrajania.
  editorPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%', backgroundColor: 'rgba(11,14,26,0.94)', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 1, borderColor: c.border.default, padding: spacing[4] },
  editorHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  adjustIntro: { fontSize: 12, color: c.text.muted, marginBottom: spacing[2] },
  adjustGroup: { marginBottom: spacing[3] },
  adjustGroupTitle: { fontSize: 12, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[1] },
  adjustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: c.border.default },
  adjustLabel: { flex: 1, fontSize: 12.5, color: c.text.primary, fontWeight: '600', marginRight: spacing[2] },
  adjustCtrl: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  adjustBtn: { width: 30, height: 30, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  adjustBtnTxt: { fontSize: 17, fontWeight: '800', color: c.text.primary, lineHeight: 20 },
  adjustVal: { fontSize: 12.5, fontWeight: '800', color: c.text.primary, minWidth: 48, textAlign: 'center' },
  exportBox: { marginTop: spacing[3], padding: spacing[3], borderRadius: radius.md, backgroundColor: c.bg.secondary, borderWidth: 1, borderColor: c.border.default },
  exportHint: { fontSize: 11, color: c.text.muted, marginBottom: spacing[1] },
  exportTxt: { fontSize: 11.5, fontFamily: 'monospace', color: c.text.primary },
}));
