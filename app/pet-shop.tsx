import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Coins, Check, Snowflake, Gift, Rocket, Flame, Backpack, Sparkles } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BoxRevealModal from '@/components/pet/BoxRevealModal';
import StartupPreview from '@/components/pet/StartupPreview';
import PupilNavbar from '@/components/pet/PupilNavbar';
import { usePetStore, loginBonusCoins, levelFromXp } from '@/store/petStore';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { SHOP_COLORS, TIER_META, CosmeticTier } from '@/utils/petShop';
import { LOOT_BOXES, DAILY_BOX, LootBox, rollBox, BoxReward } from '@/utils/petBoxes';
import { STARTUPS, startupById, ANIM_LABEL, Startup } from '@/utils/petStartups';
import { dailyShopSlots, RARITY_META, SLOT_META } from '@/utils/gear';
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

// Sklep (2026-08-19, restrukturyzacja) — kosmetyka kotka (kolory/oczy/nosek/dodatki)
// PRZENIESIONA do PetCustomizeModal (modal edycji imienia na /pet) — user: "nie przecież
// kliknięciem głaskam kotka to nie może... lepiej dać przy edycji imienia". Ten ekran zostaje
// czysto "co kupić za gold": skrzynki (gacha), sklep dnia (3 konkretne itemy ekwipunku,
// gwarantowany zakup, roluje się co dzień), startupy (kosmetyk ekranu ładowania — TO
// zostaje tu, to nie "kotek"), posiadane (startupy).
type Cat = 'boxes' | 'daily' | 'startups' | 'owned';
const CATS: { id: Cat; label: string; Icon: any }[] = [
  { id: 'boxes',    label: 'Skrzynki',   Icon: Gift },
  { id: 'daily',    label: 'Sklep dnia', Icon: Sparkles },
  { id: 'startups', label: 'Startupy',   Icon: Rocket },
  { id: 'owned',    label: 'Posiadane',  Icon: Backpack },
];
const TIER_ORDER: CosmeticTier[] = ['basic', 'rare', 'epic'];

export default function PetShop() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { coins, xp, ownedItems, buyItem, addCoins, spendCoins, buyStartup, grantStartup, equippedStartup,
    claimDailyBox, dayClaims, loginStreak, grantGear, buyDailyGear } = usePetStore();
  const petLevel = levelFromXp(xp).level;
  const freezes    = useStreakFreezeStore(st => st.freezes);
  const addFreezes = useStreakFreezeStore(st => st.addFreezes);

  const [cat, setCat] = useState<Cat>('boxes');
  const [reveal, setReveal] = useState<{ box: LootBox; reward: BoxReward } | null>(null);
  const [previewStartupId, setPreviewStartupId] = useState<string | null>(null);

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
      const reward = rollBox(box, SHOP_COLORS, ownedItems, petLevel);
      if (reward.type === 'color') buyItem(reward.colorId, 0);
      else if (reward.type === 'startup') grantStartup(reward.startupId);
      else if (reward.type === 'coins') addCoins(reward.coins);
      else if (reward.type === 'freeze') addFreezes(reward.count);
      else if (reward.type === 'gear') grantGear(reward.itemId, reward.rarity);
      haptic.success();
      setReveal({ box, reward });
    }, 'Otwórz');
  };

  // Darmowa skrzynka dnia — raz dziennie: losuj i przyznaj (jak w sklepowej gaczy).
  const dailyReady = !dayClaims[`dailybox:${todayKey()}`];
  const onDailyBox = () => {
    haptic.tap();
    if (!dailyReady || !claimDailyBox()) { haptic.error(); toast.info('Skrzynkę dnia już odebrałeś — wróć jutro'); return; }
    const reward = rollBox(DAILY_BOX, SHOP_COLORS, ownedItems, petLevel);
    if (reward.type === 'color') buyItem(reward.colorId, 0);
    else if (reward.type === 'startup') grantStartup(reward.startupId);
    else if (reward.type === 'coins') addCoins(reward.coins);
    else if (reward.type === 'freeze') addFreezes(reward.count);
    else if (reward.type === 'gear') grantGear(reward.itemId, reward.rarity);
    haptic.success();
    setReveal({ box: DAILY_BOX, reward });
  };

  // Sklep dnia — 3 KONKRETNE itemy ekwipunku, gwarantowany zakup (nie loteria), roluje się
  // co dzień (dailyShopSlots w gear.ts, deterministycznie po dacie).
  const dailySlots = useMemo(() => dailyShopSlots(todayKey(), petLevel), [petLevel]);
  const onBuyDaily = (itemId: string, rarity: ReturnType<typeof dailyShopSlots>[number]['rarity'], cost: number, name: string) => {
    haptic.tap();
    const dayKey = `gearDaily:${todayKey()}:${itemId}`;
    if (dayClaims[dayKey]) return;
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

        {/* Seria logowań — nowe źródło monet (bonus przyznawany przy wejściu na pulpit) */}
        {loginStreak > 0 && (
          <View style={s.loginStrip}>
            <Flame size={14} color="#FB923C" />
            <Text style={s.loginTxt}>Seria logowań: {loginStreak} {loginStreak === 1 ? 'dzień' : 'dni'}</Text>
            <View style={{ flex: 1 }} />
            <Text style={s.loginNext}>jutro +{loginBonusCoins(loginStreak + 1)}</Text>
          </View>
        )}

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

        {/* ── SKRZYNKI ─────────────────────────────────────────────── */}
        {cat === 'boxes' && (
          <View style={{ gap: spacing[2] }}>
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
        )}

        {/* ── SKLEP DNIA — gwarantowane itemy ekwipunku, roluje się codziennie ──────── */}
        {cat === 'daily' && (
          <View style={{ gap: spacing[2] }}>
            <Text style={s.blurbTop}>3 konkretne itemy ekwipunku na dziś — gwarantowany zakup, nie loteria. Nowy zestaw jutro.</Text>
            {dailySlots.length === 0 && (
              <Text style={s.blurbTop}>Brak dostępnych itemów na twoim poziomie jeszcze.</Text>
            )}
            {dailySlots.map(({ item, rarity, cost }) => {
              const dayKey = `gearDaily:${todayKey()}:${item.id}`;
              const bought = !!dayClaims[dayKey];
              const meta = RARITY_META[rarity];
              const afford = coins >= cost;
              return (
                <PressableScale key={item.id} onPress={() => !bought && onBuyDaily(item.id, rarity, cost, item.name)}>
                  <View style={[s.boxRow, { borderColor: meta.color + '55' }]}>
                    <View style={[s.boxIcon, { backgroundColor: meta.color + '1E', borderColor: meta.color + '55' }]}>
                      <Text style={s.boxEmoji}>{SLOT_META[item.slot].icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cellName}>{item.name}</Text>
                      <Text style={[s.cellState, { color: meta.color }]}>{meta.label} · {SLOT_META[item.slot].label}</Text>
                    </View>
                    {bought
                      ? <Check size={18} color={meta.color} />
                      : <View style={[s.buyPill, !afford && { opacity: 0.5 }]}><Coins size={11} color="#FBBF24" /><Text style={s.buyPillTxt}>{cost}</Text></View>}
                  </View>
                </PressableScale>
              );
            })}
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
    </SafeAreaView>
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
  oddsTxt: { fontSize: 10, color: c.text.muted, marginTop: 3, fontWeight: '600' },
  blurbTop: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16 },

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
  loginStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: '#FB923C3A', backgroundColor: '#FB923C12' },
  loginTxt: { fontSize: 12, fontWeight: '800', color: c.text.primary },
  loginNext: { fontSize: 11, fontWeight: '800', color: '#FB923C' },

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
}));
