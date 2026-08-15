import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Coins, Check, Snowflake, Gift, Palette, Sparkles, Rocket, Flame, Backpack } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CatArt from '@/components/pet/CatArt';
import BoxRevealModal from '@/components/pet/BoxRevealModal';
import StartupPreview from '@/components/pet/StartupPreview';
import PupilNavbar from '@/components/pet/PupilNavbar';
import { usePetStore, loginBonusCoins } from '@/store/petStore';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { SHOP_COLORS, STRIPES, TIER_META, CosmeticTier } from '@/utils/petShop';
import { LOOT_BOXES, DAILY_BOX, LootBox, rollBox, BoxReward } from '@/utils/petBoxes';
import { STARTUPS, startupById, SPLASH_BG, ANIM_LABEL, Startup } from '@/utils/petStartups';
import { paletteById } from '@/utils/catPalettes';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const FREEZE_COST = 50;   // monet za jedno zamrożenie serii
// Ulepszenia HP/ATK PRZENIESIONE do pet-stats.tsx (2026-08-10, user: "ulepszenia statystyk
// niech będą w statystykach a nie w sklepie") — ten ekran zostaje czysto kosmetyczny.
const WHISKERS_COST = 55;   // wąsy
const LEGSTRIPES_COST = 65; // pręgi na łapkach
const EYE_COST = 50;        // kolor oczu (każdy poza domyślnym)
// głębsze/bogatsze odcienie (user: „dodaj głębi / lekko ciemniejsze"). Zapis "hexL|hexR"
// = heterochromia (inny kolor każdego oka). W CatArt tęczówka dostaje ciemny rąbek + źrenicę.
const EYE_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'default', name: 'Domyślne',    hex: '' },
  { id: 'green',   name: 'Zielone',     hex: '#2E8B57' },
  { id: 'amber',   name: 'Bursztyn',    hex: '#B5791F' },
  { id: 'blue',    name: 'Niebieskie',  hex: '#2F6BB0' },
  { id: 'copper',  name: 'Miedziane',   hex: '#9E4E2C' },
  { id: 'gold',    name: 'Złote',       hex: '#B8901F' },
  { id: 'teal',    name: 'Turkusowe',   hex: '#2E9E9E' },
  { id: 'hazel',   name: 'Piwne',       hex: '#8A6B3B' },
  { id: 'ice',     name: 'Lodowe',      hex: '#6FA8C7' },
  { id: 'hetero1', name: 'Hetero z-n',  hex: '#2E8B57|#2F6BB0' },
  { id: 'hetero2', name: 'Hetero b-z',  hex: '#B5791F|#2E8B57' },
  { id: 'hetero3', name: 'Hetero z-b',  hex: '#2E8B57|#B5791F' },
  { id: 'hetero4', name: 'Hetero n-m',  hex: '#2F6BB0|#9E4E2C' },
];
const NOSE_COST = 40;
const NOSE_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'default', name: 'Domyślny', hex: '' },
  { id: 'pink',    name: 'Różowy',   hex: '#E39AA6' },
  { id: 'brick',   name: 'Ceglasty', hex: '#B5674E' },
  { id: 'coal',    name: 'Węglowy',  hex: '#2E2E36' },
  { id: 'mauve',   name: 'Wrzosowy', hex: '#C58BA0' },
];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Cat = 'boxes' | 'colors' | 'startups' | 'extras' | 'owned';
const CATS: { id: Cat; label: string; Icon: any }[] = [
  { id: 'boxes',    label: 'Skrzynki',  Icon: Gift },
  { id: 'colors',   label: 'Kolory',    Icon: Palette },
  { id: 'startups', label: 'Startupy',  Icon: Rocket },
  { id: 'extras',   label: 'Dodatki',   Icon: Sparkles },
  { id: 'owned',    label: 'Posiadane', Icon: Backpack },
];
const TIER_ORDER: CosmeticTier[] = ['basic', 'rare', 'epic'];

export default function PetShop() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { coins, ownedItems, catColor, catStripes, catEyeColor, catNoseColor, catWhiskers, catLegStripes, buyColor, buyStripes, buyEyeColor, buyNoseColor, buyWhiskers, buyLegStripes, buyItem, addCoins, spendCoins, buyStartup, grantStartup, equippedStartup, claimDailyBox, dayClaims, loginStreak } = usePetStore();
  const freezes    = useStreakFreezeStore(st => st.freezes);
  const addFreezes = useStreakFreezeStore(st => st.addFreezes);

  const [cat, setCat] = useState<Cat>('colors');
  const [reveal, setReveal] = useState<{ box: LootBox; reward: BoxReward } | null>(null);
  const [previewStartupId, setPreviewStartupId] = useState<string | null>(null);   // żywy podgląd startupu (przed kupnem)
  // podgląd kosmetyków kota PRZED kupnem — żeby zobaczyć kolor/pręgi/tabby bez płacenia
  const [pvColor, setPvColor] = useState<string | null>(null);
  const [pvStripes, setPvStripes] = useState<boolean | null>(null);
  const [pvEye, setPvEye] = useState<string | null>(null);   // hex podglądu oczu ('' = domyślne)
  const [pvNose, setPvNose] = useState<string | null>(null); // hex podglądu noska
  const [pvWhiskers, setPvWhiskers] = useState<boolean | null>(null);
  const [pvLeg, setPvLeg] = useState<boolean | null>(null);
  const clearPreviews = () => { setPvColor(null); setPvStripes(null); setPvEye(null); setPvNose(null); setPvWhiskers(null); setPvLeg(null); };

  // Potwierdzenie zakupu — żeby nie kupić przez przypadek (tylko przy PŁATNYCH akcjach;
  // założenie posiadanego / darmowa skrzynka dnia nie pytają). Themowany ConfirmDialog
  // zamiast Alert.alert (2026-08-15, user: "potwierdzenia nie są dokończone" — ten sam
  // fix co w pet-stats.tsx, patrz komentarz w ConfirmDialog.tsx).
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

  const onColor = (id: string, cost: number, name: string) => {
    haptic.tap();
    setPvColor(id);   // podgląd na kocie OD RAZU — też dla nieposiadanych (zobaczysz przed kupnem)
    const had = ownedItems.includes(id) || cost === 0;
    if (had) { if (buyColor(id, cost)) { setPvColor(null); haptic.success(); toast.success(`${name} — założone`); } return; }  // posiadane → tylko zakładasz
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmBuy(name, cost, () => { if (buyColor(id, cost)) { setPvColor(null); haptic.success(); toast.success(`Kupione: ${name}`); } });
  };
  const onStripes = () => {
    haptic.tap();
    const owned = ownedItems.includes('stripes');
    setPvStripes(owned ? !catStripes : true);   // podgląd efektu na kocie
    if (owned) { buyStripes(STRIPES.cost); setPvStripes(null); haptic.success(); return; }   // posiadane → tylko przełącz
    if (coins < STRIPES.cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${STRIPES.cost}`); return; }
    confirmBuy(STRIPES.name, STRIPES.cost, () => { if (buyStripes(STRIPES.cost)) { setPvStripes(null); haptic.success(); } });
  };
  // Kolor oczu: podgląd od razu, kup+ustaw / ustaw jeśli masz. 'default' (hex '') za darmo.
  const onEye = (id: string, hex: string, cost: number, name: string) => {
    haptic.tap();
    setPvEye(hex);
    const had = ownedItems.includes(`eye:${id}`) || cost === 0;
    if (had) { if (buyEyeColor(id, hex, cost)) { setPvEye(null); haptic.success(); toast.success(`Oczy: ${name}`); } return; }
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmBuy(`Oczy: ${name}`, cost, () => { if (buyEyeColor(id, hex, cost)) { setPvEye(null); haptic.success(); toast.success(`Kupione: oczy ${name}`); } });
  };
  // Kolor noska — jak kolor oczu.
  const onNose = (id: string, hex: string, cost: number, name: string) => {
    haptic.tap();
    setPvNose(hex);
    const had = ownedItems.includes(`nose:${id}`) || cost === 0;
    if (had) { if (buyNoseColor(id, hex, cost)) { setPvNose(null); haptic.success(); toast.success(`Nosek: ${name}`); } return; }
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmBuy(`Nosek: ${name}`, cost, () => { if (buyNoseColor(id, hex, cost)) { setPvNose(null); haptic.success(); toast.success(`Kupione: nosek ${name}`); } });
  };
  // Generyczny toggle-dodatek (wąsy / pręgi łapek / „M") — podgląd + kup / przełącz jeśli masz.
  const onToggleExtra = (key: string, cost: number, name: string, cur: boolean, setPv: (v: boolean | null) => void, buy: (c: number) => boolean) => {
    haptic.tap();
    const owned = ownedItems.includes(key);
    setPv(owned ? !cur : true);
    if (owned) { buy(cost); setPv(null); haptic.success(); return; }
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmBuy(name, cost, () => { if (buy(cost)) { setPv(null); haptic.success(); } });
  };
  // Wspólny wiersz toggle-dodatku (wąsy / pręgi łapek / „M"). `on` = stan ZAŁOŻONY.
  const extraRow = (key: string, name: string, desc: string, on: boolean, cost: number, onPress: () => void) => (
    <PressableScale onPress={onPress}>
      <View style={[s.boxRow, on && { borderColor: '#4DA8FF', backgroundColor: '#4DA8FF1E' }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.cellName}>{name}</Text>
          <Text style={s.cellState}>
            {ownedItems.includes(key)
              ? (on ? '● włączone — stuknij, aby wyłączyć' : '○ wyłączone — stuknij, aby włączyć')
              : desc}
          </Text>
        </View>
        {ownedItems.includes(key)
          ? <Check size={18} color="#4DA8FF" />
          : <View style={s.buyPill}><Coins size={11} color="#FBBF24" /><Text style={s.buyPillTxt}>{cost}</Text></View>}
      </View>
    </PressableScale>
  );

  // Kup skrzynkę → POTWIERDŹ → wylosuj → przyznaj nagrodę → pokaż odsłonę.
  const onBuyBox = (box: LootBox) => {
    haptic.tap();
    if (coins < box.cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${box.cost}`); return; }
    confirmBuy(box.name, box.cost, () => {
      if (!spendCoins(box.cost)) { haptic.error(); toast.error('Nie udało się kupić skrzynki'); return; }
      const reward = rollBox(box, SHOP_COLORS, ownedItems);
      if (reward.type === 'color') buyItem(reward.colorId, 0);
      else if (reward.type === 'startup') grantStartup(reward.startupId);
      else if (reward.type === 'coins') addCoins(reward.coins);
      else if (reward.type === 'freeze') addFreezes(reward.count);
      haptic.success();
      setReveal({ box, reward });
    }, 'Otwórz');
  };

  // Darmowa skrzynka dnia — raz dziennie: losuj i przyznaj (jak w sklepowej gaczy).
  const dailyReady = !dayClaims[`dailybox:${todayKey()}`];
  const onDailyBox = () => {
    haptic.tap();
    if (!dailyReady || !claimDailyBox()) { haptic.error(); toast.info('Skrzynkę dnia już odebrałeś — wróć jutro'); return; }
    const reward = rollBox(DAILY_BOX, SHOP_COLORS, ownedItems);
    if (reward.type === 'color') buyItem(reward.colorId, 0);
    else if (reward.type === 'startup') grantStartup(reward.startupId);
    else if (reward.type === 'coins') addCoins(reward.coins);
    else if (reward.type === 'freeze') addFreezes(reward.count);
    haptic.success();
    setReveal({ box: DAILY_BOX, reward });
  };

  // Startup (kosmetyk splasha): kup+ustaw, albo tylko ustaw jeśli już masz.
  const onStartup = (su: Startup) => {
    haptic.tap();
    setPreviewStartupId(su.id);   // najpierw pokaż animację w górnym boksie (podgląd przed kupnem)
    const had = ownedItems.includes(`startup:${su.id}`) || su.cost === 0;
    if (had) { if (buyStartup(su.id, su.cost)) { haptic.success(); toast.success(`${su.name} — ustawione`); } return; }  // posiadane → tylko ustawiasz
    if (coins < su.cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${su.cost}`); return; }
    confirmBuy(su.name, su.cost, () => { if (buyStartup(su.id, su.cost)) { haptic.success(); toast.success(`Kupione: ${su.name}`); } });
  };

  // co pokazać na wielkim podglądzie: nadpisania podglądu, inaczej faktycznie założone
  const shownColorId = pvColor ?? catColor;
  const worn = paletteById(shownColorId);
  const shownStripes = pvStripes ?? catStripes;
  const shownEye = pvEye ?? catEyeColor;
  const shownNose = pvNose ?? catNoseColor;
  const shownWhiskers = pvWhiskers ?? catWhiskers;
  const shownLeg = pvLeg ?? catLegStripes;
  const pvColorMeta = pvColor ? SHOP_COLORS.find(sc => sc.id === pvColor) : null;
  const pvUnowned = !!pvColor && !ownedItems.includes(pvColor) && pvColor !== catColor;

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

  const renderColorCell = (sc: typeof SHOP_COLORS[number]) => {
    const owned = ownedItems.includes(sc.id) || sc.cost === 0;
    const on = catColor === sc.id;
    const tier = TIER_META[sc.tier];
    return (
      <PressableScale key={sc.id} onPress={() => onColor(sc.id, sc.cost, sc.name)}>
        <View style={[s.cell, on && { borderColor: tier.color, backgroundColor: tier.color + '1E' }]}>
          <View style={[s.swatch, { backgroundColor: sc.palette.coat, borderColor: sc.palette.ear }]}>
            {on && <Check size={18} color={sc.palette.ink} />}
          </View>
          <Text style={s.cellName} numberOfLines={1}>{sc.name}</Text>
          {owned
            ? <Text style={[s.cellState, { color: on ? tier.color : c.text.muted }]}>{on ? 'założone' : 'kupione'}</Text>
            : <View style={s.cost}><Coins size={9} color="#FBBF24" /><Text style={s.costTxt}>{sc.cost}</Text></View>}
        </View>
      </PressableScale>
    );
  };

  const renderEyeCell = (ec: typeof EYE_COLORS[number]) => {
    const owned = ec.hex === '' || ownedItems.includes(`eye:${ec.id}`);
    const on = catEyeColor === ec.hex;
    const hetero = ec.hex.includes('|');
    const [hl, hr] = hetero ? ec.hex.split('|') : [ec.hex || '#2A2B36', ec.hex || '#2A2B36'];
    return (
      <PressableScale key={ec.id} onPress={() => onEye(ec.id, ec.hex, ec.hex === '' ? 0 : EYE_COST, ec.name)}>
        <View style={[s.eyeCell, on && { borderColor: '#4DA8FF', backgroundColor: '#4DA8FF1E' }]}>
          <View style={[s.eyeDot, { backgroundColor: hl, overflow: 'hidden' }]}>
            {hetero && <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', backgroundColor: hr }} />}
            {on && <Check size={12} color="#fff" />}
          </View>
          <Text style={s.eyeName} numberOfLines={1}>{ec.name}</Text>
          {!owned
            ? <View style={s.cost}><Coins size={9} color="#FBBF24" /><Text style={s.costTxt}>{EYE_COST}</Text></View>
            : <Text style={[s.cellState, { color: on ? '#4DA8FF' : c.text.muted }]}>{on ? 'na oczach' : 'masz'}</Text>}
        </View>
      </PressableScale>
    );
  };

  const renderNoseCell = (nc: typeof NOSE_COLORS[number]) => {
    const owned = nc.hex === '' || ownedItems.includes(`nose:${nc.id}`);
    const on = catNoseColor === nc.hex;
    return (
      <PressableScale key={nc.id} onPress={() => onNose(nc.id, nc.hex, nc.hex === '' ? 0 : NOSE_COST, nc.name)}>
        <View style={[s.eyeCell, on && { borderColor: '#4DA8FF', backgroundColor: '#4DA8FF1E' }]}>
          <View style={[s.eyeDot, { backgroundColor: nc.hex || '#2A2B36' }]}>{on && <Check size={12} color="#fff" />}</View>
          <Text style={s.eyeName} numberOfLines={1}>{nc.name}</Text>
          {!owned
            ? <View style={s.cost}><Coins size={9} color="#FBBF24" /><Text style={s.costTxt}>{NOSE_COST}</Text></View>
            : <Text style={[s.cellState, { color: on ? '#4DA8FF' : c.text.muted }]}>{on ? 'na nosku' : 'masz'}</Text>}
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
        <View style={s.preview}>
          {/* DUŻY żywy podgląd — animowany + klikalny; pokazuje TAKŻE styl, który właśnie
              stukasz w sklepie (przed kupnem). Dotknij kota = reakcja; przytrzymaj = liźnie
              łapkę — żeby na miejscu sprawdzić, czy animacje nie mają błędów. */}
          <CatArt size={208} expression="happy" palette={worn} stripes={shownStripes}
            eyeColor={shownEye} noseColor={shownNose} whiskers={shownWhiskers} legStripes={shownLeg} affection={90} />
          <Text style={s.previewCap}>
            {pvUnowned ? `podgląd: ${pvColorMeta?.name ?? ''} — kup, aby założyć na stałe`
              : 'dotknij kota (przytrzymaj = liźnie łapkę) · stuknij styl → zobaczysz na kocie'}
          </Text>
        </View>

        {/* PRZYPIĘTE: darmowa skrzynka dnia — główne nowe źródło monet */}
        <PressableScale onPress={onDailyBox}>
          <View style={[s.dailyHero, !dailyReady && s.dailyHeroDone]}>
            <View style={[s.dailyIcon, !dailyReady && { backgroundColor: '#FBBF2420' }]}>
              <Gift size={22} color={dailyReady ? '#0B0E1A' : '#FBBF24'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.dailyTitle}>Skrzynka dnia — za darmo</Text>
              <Text style={s.dailySub}>{dailyReady ? 'Odbierz codziennie: monety, czasem kolor lub ❄' : 'Odebrane — wróć jutro'}</Text>
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
              <TouchableOpacity key={id} onPress={() => { haptic.tap(); setCat(id); clearPreviews(); }}
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
            <Text style={s.blurbTop}>Losujesz kolor (im rzadszy tym trudniej), zamrożenie albo monety.</Text>
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
                      <Text style={s.oddsTxt}>kolor {Math.round(box.colorChance * 100)}%{box.startupChance ? ` · startup ${Math.round(box.startupChance * 100)}%` : ''} · ❄ {Math.round(box.freezeChance * 100)}% · reszta monety</Text>
                    </View>
                    <View style={[s.buyPill, !afford && { opacity: 0.5 }]}><Coins size={11} color="#FBBF24" /><Text style={s.buyPillTxt}>{box.cost}</Text></View>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        )}

        {/* ── KOLORY (grupowane wg rzadkości = kategorie) — tylko NIEPOSIADANE,
            kupione żyją w zakładce Posiadane, żeby siatka nie robiła się bałaganem ── */}
        {cat === 'colors' && TIER_ORDER.map(tier => {
          const items = SHOP_COLORS.filter(sc => sc.tier === tier && !ownedItems.includes(sc.id));
          if (!items.length) return null;
          return (
            <View key={tier} style={{ gap: spacing[2] }}>
              <View style={s.subHead}>
                <View style={[s.tierDot, { backgroundColor: TIER_META[tier].color }]} />
                <Text style={[s.subSection, { color: TIER_META[tier].color }]}>{TIER_META[tier].label}</Text>
              </View>
              <View style={s.grid}>{items.map(renderColorCell)}</View>
            </View>
          );
        })}
        {cat === 'colors' && SHOP_COLORS.every(sc => sc.cost === 0 || ownedItems.includes(sc.id)) && (
          <Text style={s.blurbTop}>Masz już wszystkie kolory — zobacz w Posiadane.</Text>
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

        {/* ── DODATKI ──────────────────────────────────────────────── */}
        {cat === 'extras' && (
          <View style={{ gap: spacing[2] }}>
            {/* Kolor oczu — mini paleta; stuknięcie od razu podgląda na kocie.
                Nieposiadane + zawsze Domyślne (nie jest „kupione", to reset). */}
            <View style={{ gap: 6 }}>
              <Text style={s.cellName}>Kolor oczu</Text>
              <View style={s.grid}>
                {EYE_COLORS.filter(ec => ec.hex === '' || !ownedItems.includes(`eye:${ec.id}`)).map(renderEyeCell)}
              </View>
            </View>

            {/* Kolor noska — mini paleta (solidne kolory), tak samo nieposiadane + Domyślny */}
            <View style={{ gap: 6 }}>
              <Text style={s.cellName}>Kolor noska</Text>
              <View style={s.grid}>
                {NOSE_COLORS.filter(nc => nc.hex === '' || !ownedItems.includes(`nose:${nc.id}`)).map(renderNoseCell)}
              </View>
            </View>

            <PressableScale onPress={onStripes}>
              <View style={[s.boxRow, catStripes && { borderColor: '#4DA8FF', backgroundColor: '#4DA8FF1E' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cellName}>{STRIPES.name}</Text>
                  <Text style={s.cellState}>
                    {ownedItems.includes('stripes')
                      ? (catStripes ? '● włączone — stuknij, aby wyłączyć' : '○ wyłączone — stuknij, aby włączyć')
                      : 'paski na ogonie'}
                  </Text>
                </View>
                {ownedItems.includes('stripes')
                  ? <Check size={18} color="#4DA8FF" />
                  : <View style={s.buyPill}><Coins size={11} color="#FBBF24" /><Text style={s.buyPillTxt}>{STRIPES.cost}</Text></View>}
              </View>
            </PressableScale>

            {extraRow('whiskers', 'Wąsy', 'cienkie wąsy od pyszczka', catWhiskers, WHISKERS_COST,
              () => onToggleExtra('whiskers', WHISKERS_COST, 'Wąsy', catWhiskers, setPvWhiskers, buyWhiskers))}
            {extraRow('legstripes', 'Pręgi na łapkach', 'poziome pręgi na łapkach', catLegStripes, LEGSTRIPES_COST,
              () => onToggleExtra('legstripes', LEGSTRIPES_COST, 'Pręgi na łapkach', catLegStripes, setPvLeg, buyLegStripes))}
          </View>
        )}

        {/* ── POSIADANE — wszystko kupione, w jednym miejscu (nie rozrzucone po siatkach) ── */}
        {cat === 'owned' && (() => {
          const ownedColors = SHOP_COLORS.filter(sc => ownedItems.includes(sc.id));
          const ownedStartups = STARTUPS.filter(su => ownedItems.includes(`startup:${su.id}`));
          const ownedEyes = EYE_COLORS.filter(ec => ec.hex !== '' && ownedItems.includes(`eye:${ec.id}`));
          const ownedNoses = NOSE_COLORS.filter(nc => nc.hex !== '' && ownedItems.includes(`nose:${nc.id}`));
          const hasStripes = ownedItems.includes('stripes');
          const hasWhiskers = ownedItems.includes('whiskers');
          const hasLeg = ownedItems.includes('legstripes');
          const totalOwned = ownedColors.length + ownedStartups.length + ownedEyes.length + ownedNoses.length
            + (hasStripes ? 1 : 0) + (hasWhiskers ? 1 : 0) + (hasLeg ? 1 : 0);
          const totalPossible = SHOP_COLORS.filter(sc => sc.cost > 0).length + STARTUPS.filter(su => su.cost > 0).length
            + EYE_COLORS.length - 1 + NOSE_COLORS.length - 1 + 3;

          if (totalOwned === 0) {
            return (
              <View style={s.emptyOwned}>
                <Backpack size={30} color={c.text.muted} />
                <Text style={s.emptyOwnedTxt}>Nic jeszcze nie kupione — zajrzyj do Kolorów, Startupów albo Dodatków.</Text>
              </View>
            );
          }

          return (
            <View style={{ gap: spacing[3] }}>
              <Text style={s.blurbTop}>Masz {totalOwned} z {totalPossible}.</Text>

              {ownedColors.length > 0 && (
                <View style={{ gap: spacing[2] }}>
                  <Text style={[s.subSection, { color: c.text.secondary }]}>Kolory</Text>
                  <View style={s.grid}>{ownedColors.map(renderColorCell)}</View>
                </View>
              )}

              {ownedStartups.length > 0 && (
                <View style={{ gap: spacing[2] }}>
                  <Text style={[s.subSection, { color: c.text.secondary }]}>Startupy</Text>
                  <View style={s.grid}>{ownedStartups.map(renderStartupCell)}</View>
                </View>
              )}

              {(ownedEyes.length > 0 || ownedNoses.length > 0 || hasStripes || hasWhiskers || hasLeg) && (
                <View style={{ gap: spacing[2] }}>
                  <Text style={[s.subSection, { color: c.text.secondary }]}>Dodatki</Text>
                  {ownedEyes.length > 0 && <View style={s.grid}>{ownedEyes.map(renderEyeCell)}</View>}
                  {ownedNoses.length > 0 && <View style={s.grid}>{ownedNoses.map(renderNoseCell)}</View>}
                  {hasStripes && extraRow('stripes', STRIPES.name, 'paski na ogonie', catStripes, STRIPES.cost, onStripes)}
                  {hasWhiskers && extraRow('whiskers', 'Wąsy', 'cienkie wąsy od pyszczka', catWhiskers, WHISKERS_COST,
                    () => onToggleExtra('whiskers', WHISKERS_COST, 'Wąsy', catWhiskers, setPvWhiskers, buyWhiskers))}
                  {hasLeg && extraRow('legstripes', 'Pręgi na łapkach', 'poziome pręgi na łapkach', catLegStripes, LEGSTRIPES_COST,
                    () => onToggleExtra('legstripes', LEGSTRIPES_COST, 'Pręgi na łapkach', catLegStripes, setPvLeg, buyLegStripes))}
                </View>
              )}
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
  preview: { alignItems: 'center', paddingVertical: spacing[2], gap: 4 },
  previewCap: { fontSize: 10.5, color: c.text.muted, fontWeight: '700' },

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

  // wspólny wiersz (skrzynki / dodatki)
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  boxIcon: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  boxEmoji: { fontSize: 26 },
  oddsTxt: { fontSize: 10, color: c.text.muted, marginTop: 3, fontWeight: '600' },
  blurbTop: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16 },

  // kolory
  subHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[1] },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  subSection: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  cell: { width: 96, alignItems: 'center', gap: 5, padding: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  eyeCell: { width: 92, alignItems: 'center', gap: 5, padding: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  eyeDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)' },
  eyeName: { fontSize: 11, fontWeight: '700', color: c.text.primary },
  swatch: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
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
  startupPreview: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing[4], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default },
  startupPreviewMark: { fontSize: 30, fontWeight: '900', letterSpacing: 1 },
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
