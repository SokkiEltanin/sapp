import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Coins, Check, Snowflake, Gift, Rocket, Backpack, Store, X } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BoxRevealModal from '@/components/pet/BoxRevealModal';
import StartupPreview from '@/components/pet/StartupPreview';
import PupilNavbar from '@/components/pet/PupilNavbar';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { SHOP_COLORS, TIER_META, CosmeticTier } from '@/utils/petShop';
import { LOOT_BOXES, DAILY_BOX, LootBox, rollBox, BoxReward } from '@/utils/petBoxes';
import { STARTUPS, startupById, ANIM_LABEL, Startup } from '@/utils/petStartups';
import { dailyShopSlots, DailyShopSlot, RARITY_META, RARITY_MULT, SLOT_META, SLOT_STAT, GEAR_STAT_LABEL, fmtGearStat, gearById, gearStatValue, GearSlot, GearRarity } from '@/utils/gear';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

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
// kliknięciem głaskam kotka to nie może... lepiej dać przy edycji imienia". Ten ekran zostaje
// czysto "co kupić za gold": skrzynki (gacha), sklep dnia (4 konkretne itemy ekwipunku,
// gwarantowany zakup, roluje się co dzień), startupy (kosmetyk ekranu ładowania — TO
// zostaje tu, to nie "kotek"), posiadane (startupy).
// `boxes`+`daily` SCALONE w JEDNĄ zakładkę `market` (2026-08-27, user: "w sklepie połączmy
// SKLEP DNIA oraz SKRZYNKI, nazywając to ogólnie RYNEK LUB BAZAR... ja moze zrobię grafikę pod
// ten bazarek potem, ale to potem — na razie połączmy [je] żeby były razem jak jedna
// zakładka"). Treść obu (skrzynki gacha + sklep dnia z gwarantowanymi itemami) renderuje się
// jedna pod drugą pod wspólnym nagłówkiem `s.subSection`, żadna logika zakupu nie zmieniona —
// czysto łączenie dwóch zakładek w jedną. `Store` = neutralna ikona "rynku", nie przesądza na
// razie żadnego motywu (user planuje własną grafikę pod bazarek później).
type Cat = 'market' | 'startups' | 'owned';
const CATS: { id: Cat; label: string; Icon: any }[] = [
  { id: 'market',   label: 'Rynek',      Icon: Store },
  { id: 'startups', label: 'Startupy',   Icon: Rocket },
  { id: 'owned',    label: 'Posiadane',  Icon: Backpack },
];
const TIER_ORDER: CosmeticTier[] = ['basic', 'rare', 'epic'];

export default function PetShop() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { coins, xp, ownedItems, buyItem, addCoins, spendCoins, buyStartup, grantStartup, equippedStartup,
    claimDailyBox, dayClaims, grantGear, buyDailyGear, equippedGear, ownedGear,
    ownedCombatItems, grantOrLevelCombatItem } = usePetStore();
  const petLevel = levelFromXp(xp).level;
  const freezes    = useStreakFreezeStore(st => st.freezes);
  const addFreezes = useStreakFreezeStore(st => st.addFreezes);

  const [cat, setCat] = useState<Cat>('market');
  const [reveal, setReveal] = useState<{ box: LootBox; reward: BoxReward; dupeCoins?: number } | null>(null);
  const [previewStartupId, setPreviewStartupId] = useState<string | null>(null);
  // Podgląd statów PRZED zakupem w Sklepie dnia (2026-08-22, user: "jak klikam w sklepiku to
  // żeby po kliknięciu w item pokazywało jego staty i porównanie z itemem założonym") — dawniej
  // tap na kafelku szedł od razu do `onBuyDaily`/ConfirmDialog bez pokazania CO właściwie się
  // kupuje. Tylko Sklep dnia — jedyna zakładka sprzedająca KONKRETNE itemy ekwipunku o znanym
  // staty/rarity; skrzynki (losowe) i startupy (kosmetyka bez statów bojowych) tego nie mają.
  const [gearPreview, setGearPreview] = useState<DailyShopSlot | null>(null);

  const [pendingBuy, setPendingBuy] = useState<{ name: string; cost: number; onYes: () => void; verb: string } | null>(null);
  const confirmBuy = (name: string, cost: number, onYes: () => void, verb = 'Kup') => {
    setPendingBuy({ name, cost, onYes, verb });
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
    confirmBuy(box.name, box.cost, () => {
      if (!spendCoins(box.cost)) { haptic.error(); toast.error('Nie udało się kupić skrzynki'); return; }
      const reward = rollBox(box, SHOP_COLORS, ownedItems, petLevel, ownedCombatItems);
      let dupeCoins: number | undefined;
      if (reward.type === 'color') buyItem(reward.colorId, 0);
      else if (reward.type === 'startup') grantStartup(reward.startupId);
      else if (reward.type === 'coins') addCoins(reward.coins);
      else if (reward.type === 'freeze') addFreezes(reward.count);
      else if (reward.type === 'gear') { const c = grantGear(reward.itemId, reward.rarity); if (c > 0) dupeCoins = c; }
      else if (reward.type === 'combatItem') grantOrLevelCombatItem(reward.itemId, reward.level);
      haptic.success();
      setReveal({ box, reward, dupeCoins });
    }, 'Otwórz');
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
    else if (reward.type === 'gear') { const c = grantGear(reward.itemId, reward.rarity); if (c > 0) dupeCoins = c; }
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
  const alreadyOwnGear = (itemId: string, rarity: GearRarity) => {
    const cur = ownedGear[itemId];
    return !!cur && RARITY_MULT[cur] >= RARITY_MULT[rarity];
  };
  const onBuyDaily = (itemId: string, rarity: ReturnType<typeof dailyShopSlots>[number]['rarity'], cost: number, name: string) => {
    haptic.tap();
    const dayKey = `gearDaily:${shopDayKey()}:${itemId}`;
    if (dayClaims[dayKey]) return;
    if (alreadyOwnGear(itemId, rarity)) { haptic.error(); toast.error('Masz już ten przedmiot (lub lepszy)'); return; }
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmBuy(name, cost, () => {
      if (buyDailyGear(dayKey, itemId, rarity, cost)) { haptic.success(); toast.success(`Kupione: ${name}`); }
      else { haptic.error(); toast.error('Nie udało się kupić'); }
    });
  };

  // Startup (kosmetyk splasha): kup+ustaw, albo tylko ustaw jeśli już masz.
  const onStartup = (su: Startup) => {
    haptic.tap();
    setPreviewStartupId(su.id);
    const had = ownedItems.includes(`startup:${su.id}`) || su.cost === 0;
    if (had) { if (buyStartup(su.id, su.cost)) { haptic.success(); toast.success(`${su.name} — ustawione`); } return; }
    if (coins < su.cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${su.cost}`); return; }
    confirmBuy(su.name, su.cost, () => { if (buyStartup(su.id, su.cost)) { haptic.success(); toast.success(`Kupione: ${su.name}`); } });
  };

  const renderStartupCell = (su: Startup) => {
    const owned = ownedItems.includes(`startup:${su.id}`) || su.cost === 0;
    const on = equippedStartup === su.id;
    const tier = TIER_META[su.tier];
    return (
      <PressableScale key={su.id} onPress={() => onStartup(su)}>
        <View style={[s.cell, on && { borderColor: tier.color, backgroundColor: tier.color + '1E' }]}>
          <View style={[s.startupSwatch, { borderColor: su.ink + '55' }]}>
            {su.anim === 'custom' && su.asset
              ? <Image source={su.asset} style={{ width: 60, height: 34 }} resizeMode="contain" fadeDuration={0} />
              : <Text style={[s.startupSwatchMark, { color: su.ink }]}>Sapp</Text>}
          </View>
          <Text style={s.cellName} numberOfLines={1}>{su.name}</Text>
          <Text style={s.animTag}>{ANIM_LABEL[su.anim]}{su.glow ? ' · glow' : ''}</Text>
          {owned
            ? <Text style={[s.cellState, { color: on ? tier.color : c.text.muted }]}>{on ? 'ustawione' : 'kupione'}</Text>
            : <View style={s.cost}><Coins size={9} color="#FBBF24" /><Text style={s.costTxt}>{su.cost}</Text></View>}
        </View>
      </PressableScale>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Sklep</Text>
        <View style={s.coinPill}><Coins size={13} color="#FBBF24" /><Text style={s.coinTxt}>{coins}</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* PRZYPIĘTE: darmowa skrzynka dnia — główne nowe źródło monet */}
        <PressableScale onPress={onDailyBox}>
          <View style={[s.dailyHero, !dailyReady && s.dailyHeroDone]}>
            <View style={[s.dailyIcon, !dailyReady && { backgroundColor: '#FBBF2420' }]}>
              <Gift size={22} color={dailyReady ? '#0B0E1A' : '#FBBF24'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.dailyTitle}>Skrzynka dnia — za darmo</Text>
              <Text style={s.dailySub}>{dailyReady ? 'Odbierz codziennie: monety, ekwipunek, czasem kolor lub ❄' : 'Odebrane — wróć jutro'}</Text>
            </View>
            {dailyReady
              ? <View style={s.dailyCta}><Text style={s.dailyCtaTxt}>ODBIERZ</Text></View>
              : <Check size={18} color="#FBBF24" />}
          </View>
        </PressableScale>

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

        {/* KATEGORIE */}
        <View style={s.chips}>
          {CATS.map(({ id, label, Icon }) => {
            const active = cat === id;
            return (
              <TouchableOpacity key={id} onPress={() => { haptic.tap(); setCat(id); }}
                style={[s.chip, active && s.chipOn]} activeOpacity={0.8}>
                <Icon size={14} color={active ? c.bg.primary : c.text.muted} />
                <Text style={[s.chipTxt, active && s.chipTxtOn]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── RYNEK — skrzynki (gacha) + sklep dnia (gwarantowane itemy), scalone w jedną
            zakładkę (2026-08-27, patrz komentarz przy `CATS` wyżej) ── */}
        {cat === 'market' && (
          <View style={{ gap: spacing[3] }}>
            <View style={{ gap: spacing[2] }}>
              <Text style={[s.subSection, { color: c.text.muted }]}>Skrzynki</Text>
              <Text style={s.blurbTop}>Losujesz ekwipunek, kolor kotka (im rzadszy tym trudniej), zamrożenie albo monety.</Text>
              {LOOT_BOXES.map(box => {
                const afford = coins >= box.cost;
                return (
                  <PressableScale key={box.id} onPress={() => onBuyBox(box)}>
                    <View style={[s.boxRow, { borderColor: box.color + '55' }]}>
                      <View style={[s.boxIcon, { backgroundColor: box.color + '1E', borderColor: box.color + '55' }]}>
                        <Text style={s.boxEmoji}>{box.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cellName}>{box.name}</Text>
                        <Text style={s.cellState}>{box.blurb}</Text>
                        <Text style={s.oddsTxt}>ekwipunek {Math.round(box.gearChance * 100)}% · kolor {Math.round(box.colorChance * 100)}% · ❄ {Math.round(box.freezeChance * 100)}% · reszta monety</Text>
                      </View>
                      <View style={[s.buyPill, !afford && { opacity: 0.5 }]}><Coins size={11} color="#FBBF24" /><Text style={s.buyPillTxt}>{box.cost}</Text></View>
                    </View>
                  </PressableScale>
                );
              })}
            </View>

            <View style={{ gap: spacing[2] }}>
              <Text style={[s.subSection, { color: c.text.muted }]}>Sklep dnia</Text>
              <Text style={s.blurbTop}>4 konkretne itemy ekwipunku na dziś — gwarantowany zakup, nie loteria.</Text>
              <Text style={s.refreshTxt}>Nowy zestaw za {fmtShopRefresh()} (codziennie o 6:00)</Text>
              {dailySlots.length === 0 && (
                <Text style={s.blurbTop}>Brak dostępnych itemów na twoim poziomie jeszcze.</Text>
              )}
              {/* Siatka 4 obok siebie, TYLKO ikona (2026-08-31, user: "zwiększymy do 4 itemów...
                  ustawić itemy po 4 obok siebie tylko z ikoną, mi po kliknięciu pokazuje się
                  popup ze statystykami i formularzem zakupu i porównania z założonym") —
                  dawniej pełnoszerokościowy wiersz z nazwą/rzadkością/ceną wprost na liście,
                  za wąski na 4 w rzędzie. Nazwa/rzadkość/cena/porównanie NIE zniknęły —
                  przeniosły się w całości do `GearPreviewModal` (już istniał, patrz
                  `gearPreview` state — ten sam popup co wcześniej, tu tylko zmienia się TRIGGER
                  z pełnego wiersza na mały kafelek). Kafelek zostaje z jedynym stanowym
                  wskaźnikiem (✓ posiadane/kupione) — bez niego nie dałoby się w ogóle
                  odróżnić dostępnego od odebranego bez otwierania popupu za każdym razem. */}
              <View style={s.dailyGrid}>
                {dailySlots.map(slot => {
                  const { item, rarity } = slot;
                  const dayKey = `gearDaily:${shopDayKey()}:${item.id}`;
                  const bought = !!dayClaims[dayKey];
                  const owned = alreadyOwnGear(item.id, rarity);
                  const meta = RARITY_META[rarity];
                  return (
                    <PressableScale key={item.id} onPress={() => { haptic.tap(); setGearPreview(slot); }} style={s.dailyTileWrap}>
                      <View style={[s.dailyTile, { borderColor: meta.color + '55', backgroundColor: meta.color + '14' }]}>
                        <Image source={item.icon} style={s.dailyTileImg} resizeMode="contain" />
                        {(bought || owned) && (
                          <View style={[s.dailyTileCheck, { backgroundColor: meta.color }]}>
                            <Check size={11} color="#0B0E1A" strokeWidth={3} />
                          </View>
                        )}
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ── STARTUPY (ekran ładowania) ───────────────────────────── */}
        {cat === 'startups' && (
          <View style={{ gap: spacing[2] }}>
            <Text style={s.blurbTop}>Zmieniają ekran ładowania apki. Zobaczysz przy następnym starcie.</Text>
            {(() => {
              const shown = startupById(previewStartupId ?? equippedStartup);
              const isPreview = !!previewStartupId && previewStartupId !== equippedStartup;
              return (
                <View style={{ gap: 5 }}>
                  <StartupPreview startup={shown} height={92} fontSize={30} />
                  <Text style={s.startupPreviewCap}>{isPreview ? 'podgląd' : 'teraz'}: {shown.name} · {ANIM_LABEL[shown.anim]}</Text>
                  <Text style={s.startupPreviewHint}>Stuknij startup poniżej, aby zobaczyć jego animację tutaj</Text>
                </View>
              );
            })()}
            {TIER_ORDER.map(tier => {
              const items = STARTUPS.filter(x => x.tier === tier && !ownedItems.includes(`startup:${x.id}`));
              if (!items.length) return null;
              return (
                <View key={tier} style={{ gap: spacing[2] }}>
                  <View style={s.subHead}>
                    <View style={[s.tierDot, { backgroundColor: TIER_META[tier].color }]} />
                    <Text style={[s.subSection, { color: TIER_META[tier].color }]}>{TIER_META[tier].label}</Text>
                  </View>
                  <View style={s.grid}>{items.map(renderStartupCell)}</View>
                </View>
              );
            })}
            {STARTUPS.every(x => x.cost === 0 || ownedItems.includes(`startup:${x.id}`)) && (
              <Text style={s.blurbTop}>Masz już wszystkie startupy — zobacz w Posiadane.</Text>
            )}
          </View>
        )}

        {/* ── POSIADANE — startupy (kosmetyka kotka jest w modalu imienia na /pet) ──── */}
        {cat === 'owned' && (() => {
          const ownedStartups = STARTUPS.filter(su => ownedItems.includes(`startup:${su.id}`));
          if (ownedStartups.length === 0) {
            return (
              <View style={s.emptyOwned}>
                <Backpack size={30} color={c.text.muted} />
                <Text style={s.emptyOwnedTxt}>Nic jeszcze nie kupione — zajrzyj do Startupów.</Text>
              </View>
            );
          }
          return (
            <View style={{ gap: spacing[3] }}>
              <Text style={s.blurbTop}>Masz {ownedStartups.length} z {STARTUPS.filter(su => su.cost > 0).length} startupów.</Text>
              <View style={s.grid}>{ownedStartups.map(renderStartupCell)}</View>
            </View>
          );
        })()}

        <Text style={s.hint}>Monety: questy (za dbanie o SIEBIE) + darmowa skrzynka dnia + głaskanie kota.</Text>
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
        message={pendingBuy ? `${pendingBuy.name} — ${pendingBuy.cost} monet` : ''}
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
        onBuy={(item, rarity, cost) => { setGearPreview(null); onBuyDaily(item.id, rarity, cost, item.name); }}
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
  ownedGear: Partial<Record<string, GearRarity>>;
  dayClaims: Record<string, true>;
  coins: number;
  onBuy: (item: DailyShopSlot['item'], rarity: DailyShopSlot['rarity'], cost: number) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  if (!slot) return null;
  const { item, rarity, cost } = slot;
  const meta = RARITY_META[rarity];
  const stat = SLOT_STAT[item.slot];
  const val = gearStatValue(item, rarity);
  const equippedId = equippedGear[item.slot];
  const equippedItem = equippedId ? gearById(equippedId) : undefined;
  const equippedRarity = equippedId ? ownedGear[equippedId] : undefined;
  const equippedVal = equippedItem && equippedRarity ? gearStatValue(equippedItem, equippedRarity) : 0;
  const delta = val - equippedVal;
  const dayKey = `gearDaily:${shopDayKey()}:${item.id}`;
  const bought = !!dayClaims[dayKey];
  // Posiadasz już to (lub lepsze)? Osobny stan od `bought` (2026-08-26 fix) — `bought` jest
  // TYLKO o dzisiejszym zakupie tego konkretnego slotu, więc item posiadany z KRZYŻA innego
  // dnia albo ze skrzynki wcześniej pokazywał tu mylący przycisk "Kup", mimo że kupno by nic
  // nie dało (patrz `buyDailyGear` w petStore.ts — teraz i tak by odrzuciło zakup).
  const ownedRarity = ownedGear[item.id];
  const alreadyHave = !!ownedRarity && RARITY_MULT[ownedRarity] >= RARITY_MULT[rarity];
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
              onPress={() => { haptic.tap(); onBuy(item, rarity, cost); }}
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
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 18, fontWeight: '800', color: c.text.primary, flex: 1 },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FBBF2440' },
  coinTxt: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },
  scroll: { paddingHorizontal: spacing[4], gap: spacing[3], paddingTop: spacing[1] },

  // przypięty freeze
  freezeHero: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: '#7DD3FC44', backgroundColor: '#7DD3FC12' },
  freezeIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#7DD3FC1E', borderWidth: 1, borderColor: '#7DD3FC44', alignItems: 'center', justifyContent: 'center' },
  freezeTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  freezeSub: { fontSize: 11, color: c.text.muted, marginTop: 1 },

  // kategorie
  chips: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  chipOn: { backgroundColor: c.text.primary, borderColor: c.text.primary },
  chipTxt: { fontSize: 12.5, fontWeight: '800', color: c.text.muted },
  chipTxtOn: { color: c.bg.primary },

  // wspólny wiersz (skrzynki / sklep dnia)
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  boxIcon: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  boxEmoji: { fontSize: 26 },
  boxImg: { width: 30, height: 30 },
  oddsTxt: { fontSize: 10, color: c.text.muted, marginTop: 3, fontWeight: '600' },
  blurbTop: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16 },
  refreshTxt: { fontSize: 10.5, color: c.text.muted, fontWeight: '700', marginTop: -4 },

  // Siatka Sklepu dnia — 4 kwadratowe kafelki obok siebie, tylo ikona (2026-08-31, patrz
  // komentarz przy JSX). `width:'23%'` + `justifyContent:'space-between'` (nie `gap`) —
  // odstęp między kafelkami wynika z ROZŁOŻENIA reszty szerokości, więc zawsze dokładnie 4 w
  // rzędzie bez ręcznego liczenia dp na różnych szerokościach ekranu. `aspectRatio:1` robi
  // kwadrat z dowolnej wyliczonej szerokości zamiast sztywnej wysokości w px.
  dailyGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing[2] },
  dailyTileWrap: { width: '23%' },
  dailyTile: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dailyTileImg: { width: '58%', height: '58%' },
  dailyTileCheck: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  subHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[1] },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  subSection: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  cell: { width: 96, alignItems: 'center', gap: 5, padding: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  cellName: { fontSize: 12, fontWeight: '700', color: c.text.primary },
  cellState: { fontSize: 10, color: c.text.muted },
  cost: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  costTxt: { fontSize: 11, fontWeight: '800', color: '#FBBF24' },

  buyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FBBF2440' },
  buyPillTxt: { fontSize: 12, fontWeight: '800', color: '#FBBF24' },

  // seria logowań

  // skrzynka dnia (darmowa, przypięta)
  dailyHero: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: '#FBBF2455', backgroundColor: '#FBBF2414' },
  dailyHeroDone: { borderColor: c.border.default, backgroundColor: c.bg.card },
  dailyIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FBBF24', alignItems: 'center', justifyContent: 'center' },
  dailyTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  dailySub: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  dailyCta: { backgroundColor: '#FBBF24', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  dailyCtaTxt: { fontSize: 11, fontWeight: '900', color: '#0B0E1A', letterSpacing: 0.5 },

  // startupy (kosmetyki splasha)
  startupPreviewCap: { fontSize: 11, color: c.text.secondary, fontWeight: '700', textAlign: 'center' },
  startupPreviewHint: { fontSize: 10, color: c.text.muted, textAlign: 'center' },
  startupSwatch: { width: 74, height: 40, borderRadius: 8, borderWidth: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  startupSwatchMark: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  animTag: { fontSize: 9, color: c.text.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  hint: { fontSize: 11, color: c.text.muted, textAlign: 'center', marginTop: spacing[2] },

  // Posiadane — pusty stan
  emptyOwned: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[6] },
  emptyOwnedTxt: { fontSize: 12.5, color: c.text.muted, textAlign: 'center', lineHeight: 17, maxWidth: 220 },

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
