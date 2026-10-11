import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Animated, Easing, Image, useWindowDimensions } from 'react-native';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { CRATE_META } from '@/utils/crates';
import { BoxReward } from '@/utils/petBoxes';
import { RARITY_META, gearById, GEAR_ITEMS } from '@/utils/gear';
import { itemById, COMBAT_ITEMS, CombatItemId } from '@/utils/combatItems';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Cząstka lecąca od (sx,sy) do (ex,ey) — monety/iskry na zewnątrz.
function Fly({ sx, sy, ex, ey, emoji, size }: { sx: number; sy: number; ex: number; ey: number; emoji: string; size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, []);
  const tx = a.interpolate({ inputRange: [0, 1], outputRange: [sx, ex] });
  const ty = a.interpolate({ inputRange: [0, 1], outputRange: [sy, ey] });
  const op = a.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const sc = a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.15, 0.7] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }}>
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
}

// 2026-09-11, user: "zrobić animacje jakby jej rozpadania... zrobić jak w ceesie tez z
// animacja tylko jeszcze dodać przycisk otwórz i wtedy losuje sie jak w ceesie... ze
// przelatują te itemy tak i zatrzymuje sie na jednym" — reel jak w case-openingach: pasek
// ikon przelatuje, zwalnia i zatrzymuje się DOKŁADNIE na już-wylosowanej (przez rollBox(),
// PRZED tą animacją) nagrodzie pod wskaźnikiem na środku. `REEL_ITEM_W` = pełny "pitch" (skok)
// jednej komórki (szerokość + odstępy razem), nie tylko widoczny box — matematyka
// przesunięcia (`finalX` w `doOpen`) musi liczyć w tych samych jednostkach.
// Komórka powiększona 78→120 (+54%, 2026-09-13, user: "animacja jest za mała powieksz ja
// o 50 prc minimum") — reszta rozmiarów reela (`reelCell`/`reelCellImg`/`reelCellEmoji`)
// skalowana razem z nią w stylach niżej. `REEL_WINDOW_W` (widoczne okno) NIE jest już
// stałą — sztywne ×1.5 (264→396) przelewałoby się poza wąskie telefony (Xiaomi/starsze
// Samsungi ~360dp szerokości), więc jest teraz liczone z realnej szerokości ekranu
// wewnątrz komponentu (patrz `reelWindowW`), ten sam wzorzec co `catSize` w pet.tsx.
const REEL_ITEM_W = 120;
const REEL_LENGTH = 40;
const REEL_TARGET_INDEX = 34; // kilka komórek zapasu PO celu na jitter (patrz `doOpen`)

interface ReelCell { key: string; icon?: any; emoji?: string; color: string }

// Pula "wypełniaczy" reela — NIE prawdziwe kandydatury na nagrodę (ta jest już ustalona przez
// rollBox() PRZED animacją), czysto wizualny szum żeby pasek wyglądał jak prawdziwy gacha-case.
// Mieszanka ikon ekwipunku (GEAR_ITEMS, wszystkie sloty/rarity na raz — sam wygląd, nie realna
// rzadkość) + ikon umiejętności bossów (COMBAT_ITEMS, poziom 1) + kilku monet.
const FILLER_ICONS: { icon?: any; emoji?: string }[] = [
  ...GEAR_ITEMS.map(g => ({ icon: g.icon })),
  ...(Object.keys(COMBAT_ITEMS) as CombatItemId[]).map(id => ({ icon: COMBAT_ITEMS[id].icons[0] })),
  { emoji: '🪙' }, { emoji: '🪙' }, { emoji: '🪙' },
];
// 2026-10-11, user: "mam wrażenie ze kolor monetek sie nie zgadza bo losuje szary czasami i
// daje jak niebieski lub zielony a tego nie widac" — ROOT CAUSE: te kolory wypełniaczy brały
// `RARITY_META` (paleta RZADKOŚCI EKWIPUNKU: szary/ZIELONY/niebieski/różowy/fiolet), a realny
// wylosowany wynik dla monet/perków bossa koloruje się `CRATE_META` (paleta TIERU SKRZYNKI:
// szary/niebieski/FIOLET/złoty — patrz `rewardCell` niżej) — DWIE RÓŻNE palety z tym samym
// słowem "rare"/"epic" ale innym kolorem (`RARITY_META.rare`=zielony vs `CRATE_META.rare`=
// niebieski, `RARITY_META.epic`=niebieski vs `CRATE_META.epic`=fiolet). Efekt: user widział w
// locie zielony (niemożliwy wynik dla monet — ta paleta go w ogóle nie ma) i mylił niebieski
// `RARITY_META.epic` z niebieskim `CRATE_META.rare`. Fix: wypełniacze biorą TERAZ `CRATE_META`
// — ta sama paleta co realny możliwy wynik (dla gearu też, bo gear i tak dostaje WŁASNY kolor
// z `RARITY_META` dopiero na trafionej komórce `rewardCell`, nigdy z wypełniaczy) — każdy
// kolor widziany w locie jest teraz faktycznie osiągalnym wynikiem, nie fałszywą obietnicą.
const FILLER_COLORS = [CRATE_META.basic.color, CRATE_META.basic.color, CRATE_META.basic.color,
  CRATE_META.rare.color, CRATE_META.rare.color, CRATE_META.epic.color, CRATE_META.legendary.color];

function rewardCell(reward: BoxReward): ReelCell {
  if (reward.type === 'gear') {
    const g = gearById(reward.itemId);
    return { key: 'reward', icon: g?.icon, color: RARITY_META[reward.rarity].color };
  }
  if (reward.type === 'combatItem') {
    const def = itemById(reward.itemId);
    return { key: 'reward', icon: def.icons[Math.min(reward.level, def.icons.length) - 1], color: CRATE_META[reward.rarity].color };
  }
  return { key: 'reward', emoji: '🪙', color: CRATE_META[reward.rarity].color };
}

function buildReel(reward: BoxReward): ReelCell[] {
  const cells: ReelCell[] = [];
  for (let i = 0; i < REEL_LENGTH; i++) {
    if (i === REEL_TARGET_INDEX) { cells.push(rewardCell(reward)); continue; }
    const f = FILLER_ICONS[Math.floor(Math.random() * FILLER_ICONS.length)];
    const color = FILLER_COLORS[Math.floor(Math.random() * FILLER_COLORS.length)];
    cells.push({ key: `f${i}`, icon: f.icon, emoji: f.emoji, color });
  }
  return cells;
}

// Odsłona nagrody ze skrzynki. Nagroda jest JUŻ WYLOSOWANA (`reward` prop), ale NIE jeszcze
// przyznana do store'u — `onRevealed` (2026-10-02, user: "nagroda powinna przyznawać się po
// animacji losowania bo tak to widać od razu po zlocie czy dostałem co, np. się zwiększa
// bardzo czy coś" — licznik monet w nagłówku `pet.tsx`/`pet-shop.tsx` czytał TEN SAM store,
// który wcześniej był mutowany w momencie kliknięcia "Otwórz", więc skakał widocznie w tle
// przez całe ~4s kręcenia reela, spoilerując wynik na wiele sekund przed jego odsłonięciem)
// odpala się DOKŁADNIE w momencie gdy reel się zatrzymuje i karta wyniku pojawia się na
// ekranie — wołający (pet.tsx/pet-shop.tsx) dopiero TU wykonuje `addCoins`/`grantGear`/
// `grantOrLevelCombatItem`, nie wcześniej.
//
// Dawny prop `dupeCoins` USUNIĘTY (2026-09-18) — od `grantGear`'s przejścia na trwałe
// instancje (patrz `GearInstance` w gear.ts) KAŻDY wylosowany gear jest zawsze naprawdę
// przyznany, nigdy po cichu kompensowany/odrzucany, więc karta "EKWIPUNEK! <nazwa>" już
// zawsze mówi prawdę — nie potrzeba osobnej "uczciwej" wersji na duplikat.
export default function BoxRevealModal({ visible, reward, boxColor, boxEmoji, boxIcon, onRevealed, onClose, sellInfo }: {
  visible: boolean; reward: BoxReward | null; boxColor: string; boxEmoji: string; boxIcon?: any;
  onRevealed?: () => void; onClose: () => void;
  // Sprzedaż loota WPROST z odsłony (2026-10-11, user: "mogę od razu loot sprzedać jak nie
  // chcę i pokazuje wtedy jak cos jest lepsze niż założone to czy na pewno") — tylko dla
  // `reward.type === 'gear'` (coins/combatItem nie mają mechaniki sprzedaży w tej appce).
  // Wołający (pet-shop.tsx/pet.tsx) liczy `coins`/`betterThanEquipped` (zna equippedGear/
  // ownedGear) i wykonuje REALNĄ sprzedaż w `onSell` — ten komponent zostaje czysto
  // prezentacyjny, tylko dopytuje (ConfirmDialog) gdy `betterThanEquipped`.
  sellInfo?: { coins: number; betterThanEquipped: boolean; onSell: () => void } | null;
}) {
  const [confirmSell, setConfirmSell] = useState(false);
  // Nowa faza `opening` (2026-09-12, user: "Animacja otwierania skrzynki możemy ja
  // powiększyć bo jest malutka i zrobic takie epickie przejście po kliknięciu otworz do
  // tego cesowego otwierania") — dotąd `doOpen()` przechodziło closed→spinning W TEJ SAMEJ
  // klatce, zero przejścia. `opening` to krótki (~480ms) "ładowanie i wybuch": skrzynka się
  // trzęsie i puchnie (shake+openScale), potem błysk światła (flash) podczas gdy skrzynka
  // znika (scale→0) — DOPIERO na końcu tego cut do `spinning`, więc reel "wyskakuje" z
  // błysku zamiast się po prostu podmieniać.
  const { width: winW } = useWindowDimensions();
  // Sufit 400 (~+51% vs starą stałą 264), ale nigdy szerszy niż ekran minus bezpieczny
  // margines — patrz komentarz przy `REEL_ITEM_W` wyżej.
  const reelWindowW = Math.min(400, winW - 48);
  const [phase, setPhase] = useState<'closed' | 'opening' | 'spinning' | 'revealed'>('closed');
  const [reel, setReel] = useState<ReelCell[]>([]);
  const [flies, setFlies] = useState<{ id: number; sx: number; sy: number; ex: number; ey: number; emoji: string; size: number }[]>([]);
  const reelX = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const openScale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  // "Pomiń" (2026-10-11, user: "zeby mocy otwierać je szybciej tez jak juz otworzyłem sporo
  // nie chce czekać na animacje do końca") — ten sam wzorzec co "Pomiń walkę" w
  // boss-fight.tsx: wynik jest już wylosowany (`reward` prop), spin to czysto kosmetyczny
  // ~3.4s pokaz. `finalXRef` trzyma dokładny cel spinu (liczony raz w `doOpen`), żeby skip
  // mógł skoczyć TAM, nie zostawić reela zatrzymanego w dowolnym miejscu w połowie komórki.
  const finalXRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setPhase('closed'); setFlies([]); setReel([]); reelX.setValue(0); burst.setValue(0);
    shake.setValue(0); openScale.setValue(1); flash.setValue(0); setConfirmSell(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || phase !== 'closed') return;
    const l = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [visible, phase]);

  const meta = reward
    ? (reward.type === 'gear' ? RARITY_META[reward.rarity] : CRATE_META[reward.rarity])
    : CRATE_META.basic;

  // Wyodrębnione z `.start(() => {...})` w `doOpen` (2026-10-11) — wołane zarówno gdy reel
  // naturalnie dojedzie do celu, JAK I przez `skipSpin` niżej, żeby nie duplikować logiki
  // "co się dzieje w momencie odsłony" w dwóch miejscach.
  const onReelLanded = () => {
    if (!reward) return;
    onRevealed?.();
    setPhase('revealed');
    haptic.success();
    Animated.spring(burst, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
    const n = (reward.rarity === 'legendary' || reward.rarity === 'mythic') ? 18 : reward.rarity === 'epic' ? 13 : 9;
    const em = reward.type === 'coins' ? '🪙' : '✨';
    setFlies(Array.from({ length: n }).map((_, i) => ({ id: i,
      sx: 0, sy: 0, ex: (Math.random() - 0.5) * 300, ey: -(50 + Math.random() * 230),
      emoji: i % 3 === 0 ? '✨' : em, size: 24 })));
  };

  const skipSpin = () => {
    if (phase !== 'spinning') return;
    haptic.tap();
    reelX.stopAnimation();
    reelX.setValue(finalXRef.current);
    onReelLanded();
  };

  const doOpen = () => {
    if (phase !== 'closed' || !reward) return;
    haptic.medium();
    setPhase('opening');
    // Etap 1: skrzynka trzęsie się i "puchnie" (ładuje energię przed wybuchem).
    Animated.parallel([
      Animated.timing(shake, { toValue: 1, duration: 260, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(openScale, { toValue: 1.18, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      haptic.medium();
      // Etap 2: błysk światła + skrzynka znika (scale→0) — reel podmieniany DOKŁADNIE gdy
      // błysk jest najjaśniejszy, więc wygląda jakby "wyskoczył" z eksplozji, nie jakby się
      // po prostu podmienił widok.
      Animated.parallel([
        Animated.timing(flash, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(openScale, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => {
        setReel(buildReel(reward));
        reelX.setValue(0);
        flash.setValue(0);
        setPhase('spinning');
        // Lekki losowy jitter (±30% szerokości komórki) — reel nie zatrzymuje się co do piksela w
        // TYM SAMYM miejscu za każdym razem, ale zawsze w granicach komórki nagrody (bezpieczne,
        // bo target ma 5 komórek zapasu PO sobie w REEL_LENGTH, patrz stałe wyżej).
        const jitter = (Math.random() - 0.5) * REEL_ITEM_W * 0.6;
        const finalX = reelWindowW / 2 - (REEL_TARGET_INDEX * REEL_ITEM_W + REEL_ITEM_W / 2) + jitter;
        finalXRef.current = finalX;
        Animated.timing(reelX, {
          toValue: finalX, duration: 3400, easing: Easing.bezier(0.1, 0.7, 0.2, 1), useNativeDriver: true,
        }).start(({ finished }) => {
          // `finished:false` = przerwane przez `skipSpin`'s `stopAnimation()` — ten już sam
          // wywołał `onReelLanded()`, więc TU trzeba go pominąć, inaczej odpaliłby się
          // podwójnie (raz z `skipSpin`, raz z tego callbacku).
          if (finished) onReelLanded();
        });
      });
    });
  };

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const shakeX = shake.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -10, 10, -7, 0] });
  const flashOpacity = flash.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0] });
  const flashScale = flash.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.6] });
  const glowScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const glowOp = burst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 0.28] });
  const cardScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const rewardTitle = reward?.type === 'gear' ? 'EKWIPUNEK!'
    : reward?.type === 'combatItem' ? (reward.isUpgrade ? 'PERK ULEPSZONY!' : 'NOWY PERK BOSSA!')
    : 'MONETY';

  return (
    <>
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={phase === 'revealed' ? onClose : undefined}>
        <View style={st.center} pointerEvents="box-none">
          {(phase === 'closed' || phase === 'opening') && (
            <>
              <Pressable onPress={doOpen} disabled={phase !== 'closed'} hitSlop={20}>
                <Animated.View style={{ transform: [
                  { translateY: phase === 'closed' ? bobY : 0 },
                  { translateX: phase === 'opening' ? shakeX : 0 },
                  { scale: phase === 'opening' ? openScale : 1 },
                ] }}>
                  <View style={st.box}>
                    {boxIcon
                      ? <Image source={boxIcon} style={st.boxImg} resizeMode="contain" />
                      : (<><View style={[st.boxLid, { backgroundColor: boxColor + '55' }]} /><Text style={st.boxEmoji}>{boxEmoji}</Text></>)}
                  </View>
                </Animated.View>
              </Pressable>
              {phase === 'closed' && <Text style={st.hint}>Stuknij, żeby otworzyć</Text>}
            </>
          )}
          {phase === 'opening' && (
            <Animated.View pointerEvents="none" style={[st.flash, { opacity: flashOpacity, transform: [{ scale: flashScale }] }]} />
          )}
          {phase === 'spinning' && (
            <>
              <View style={[st.reelWindow, { width: reelWindowW }]}>
                <Animated.View style={[st.reelStrip, { transform: [{ translateX: reelX }] }]}>
                  {reel.map(cell => (
                    <View key={cell.key} style={st.reelCellOuter}>
                      <View style={[st.reelCell, { borderColor: cell.color }]}>
                        {cell.icon
                          ? <Image source={cell.icon} style={st.reelCellImg} resizeMode="contain" />
                          : <Text style={st.reelCellEmoji}>{cell.emoji}</Text>}
                      </View>
                    </View>
                  ))}
                </Animated.View>
                <View style={st.reelFadeL} pointerEvents="none" />
                <View style={st.reelFadeR} pointerEvents="none" />
                <View style={[st.reelPointerTri, { left: reelWindowW / 2 - 10 }]} pointerEvents="none" />
                <View style={[st.reelPointerBar, { left: reelWindowW / 2 - 2 }]} pointerEvents="none" />
              </View>
              {/* "Pomiń" (2026-10-11) — ten sam wzorzec co "Pomiń walkę" w boss-fight.tsx:
                  wynik jest już wylosowany, spin to czysto kosmetyczny pokaz, user otwierający
                  wiele skrzynek z rzędu nie chce czekać ~3.4s za każdym razem. */}
              <Pressable onPress={skipSpin} hitSlop={12}>
                <Text style={st.skipTxt}>Pomiń</Text>
              </Pressable>
            </>
          )}
          {phase === 'revealed' && (
            <>
              <View style={st.revealWrap}>
                <Animated.View style={[st.glow, { backgroundColor: meta.color, transform: [{ scale: glowScale }], opacity: glowOp }]} />
                {flies.map(f => <Fly key={f.id} sx={f.sx} sy={f.sy} ex={f.ex} ey={f.ey} emoji={f.emoji} size={f.size} />)}
                <Animated.View style={[st.card, { borderColor: meta.color, transform: [{ scale: cardScale }] }]}>
                  <Text style={[st.tier, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                  {reward?.type === 'gear' ? (
                    <>
                      {(() => { const g = gearById(reward.itemId); return g
                        ? <Image source={g.icon} style={[st.gearImg, { borderColor: meta.color }]} resizeMode="contain" />
                        : <Text style={{ fontSize: 40 }}>🎁</Text>; })()}
                      <Text style={[st.rewardName, { color: meta.color }]}>{reward.name}</Text>
                    </>
                  ) : reward?.type === 'combatItem' ? (
                    <>
                      <Image source={itemById(reward.itemId).icons[Math.min(reward.level, itemById(reward.itemId).icons.length) - 1]}
                        style={[st.gearImg, { borderColor: meta.color }]} resizeMode="contain" />
                      <Text style={[st.rewardName, { color: meta.color }]}>{reward.name} {reward.isUpgrade ? `Lv.${reward.level}` : ''}</Text>
                    </>
                  ) : (
                    <Text style={st.coins}>+{reward?.coins} 🪙</Text>
                  )}
                  <Text style={st.rewardKind}>{rewardTitle}</Text>
                </Animated.View>
              </View>
              <Pressable style={[st.btn, { backgroundColor: meta.color }]} onPress={onClose}>
                <Text style={st.btnTxt}>Super!</Text>
              </Pressable>
              {reward?.type === 'gear' && sellInfo && (
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    haptic.tap();
                    if (sellInfo.betterThanEquipped) { setConfirmSell(true); return; }
                    sellInfo.onSell();
                    toast.success(`Sprzedano — +${sellInfo.coins} 🪙`);
                    onClose();
                  }}
                >
                  <Text style={st.sellTxt}>Sprzedaj za {sellInfo.coins} 🪙</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </Pressable>
    </Modal>
    {!!sellInfo && (
      <ConfirmDialog
        visible={confirmSell}
        title="Sprzedać mimo że lepsze?"
        message={`${reward?.type === 'gear' ? reward.name : 'Ten przedmiot'} ma wyższy stat niż to, co masz teraz założone w tym slocie. Sprzedaż da +${sellInfo.coins} 🪙, ale tracisz realne wzmocnienie. Na pewno?`}
        confirmLabel="Sprzedaj"
        cancelLabel="Zatrzymaj"
        destructive
        onConfirm={() => {
          sellInfo.onSell();
          toast.success(`Sprzedano — +${sellInfo.coins} 🪙`);
          setConfirmSell(false);
          onClose();
        }}
        onCancel={() => setConfirmSell(false)}
      />
    )}
    </>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 18 },
  // Skrzynka powiększona (2026-09-12, user: "Animacja otwierania skrzynki możemy ja
  // powiększyć bo jest malutka") — 128×104 → 192×156 (+50%), reszta (emoji/przycisk)
  // przeskalowana proporcjonalnie.
  // 2026-10-10, user: "zrob zeby skrzynki lewitowały same bez przycisku otoczki i stroke,
  // tylko same i po naciśnięciu w nią sie otwiera" — karta/obwódka (`backgroundColor`/
  // `borderWidth`/`borderRadius`/`overflow`) i osobny przycisk "Otwórz" usunięte: sama
  // grafika skrzynki teraz lewituje (`bob`) i jest klikalna (`Pressable` ją owija w JSX).
  box: { width: 192, height: 156, alignItems: 'center', justifyContent: 'center' },
  boxLid: { position: 'absolute', top: 0, left: 0, right: 0, height: 44 },
  boxEmoji: { fontSize: 68, marginTop: 16 },
  // Grafika skrzynki (2026-09-11) — gdy `boxIcon` podane (LOOT_BOXES/DAILY_BOX mają własne
  // PNG), zastępuje `boxLid`+`boxEmoji` całkowicie (jedna spójna grafika zamiast dwóch warstw).
  boxImg: { width: '100%', height: '100%' },
  hint: { color: '#E7EAEA', fontSize: 13.5, fontWeight: '700', textAlign: 'center', maxWidth: 240 },
  // "Pomiń" (2026-10-11) — ten sam styl co "Pomiń walkę" w boss-fight.tsx, dla spójności.
  skipTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)', textAlign: 'center', textDecorationLine: 'underline' },
  // "Sprzedaj" na odsłonie (2026-10-11) — ten sam wzorzec co skipTxt powyżej (drugorzędna,
  // podkreślona akcja pod głównym przyciskiem), nie pełnoprawny `st.btn`.
  sellTxt: { fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,0.75)', textAlign: 'center', textDecorationLine: 'underline', marginTop: 10 },
  // Błysk "wybuchu" między zamknięciem a reelem (2026-09-12) — rosnące, szybko gasnące
  // koło na środku modala, DOKŁADNIE w momencie cięcia closed→spinning (patrz `doOpen`).
  flash: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#FFFFFF',
  },

  // Reel (2026-09-11) — okno stałej szerokości (REEL_WINDOW_W) z `overflow:'hidden'`, pasek
  // komórek (`reelStrip`, `flexDirection:'row'`) jedzie pod spodem przez `translateX`.
  // `reelCellOuter` = pełny "pitch" komórki (REEL_ITEM_W, BEZ marginesów — cała matematyka
  // przesunięcia w `doOpen` liczy w tej jednostce), `reelCell` = mniejszy, wycentrowany box
  // wizualny w środku (zostawia "szczelinę" między komórkami bez psucia pitcha).
  // `width` NIE tutaj — liczony z ekranu (`reelWindowW`), patrz JSX. Wysokość 92→138 (+50%).
  reelWindow: { height: 138, overflow: 'hidden', position: 'relative', borderRadius: 16, backgroundColor: '#0E1113' },
  reelStrip: { flexDirection: 'row', height: '100%', alignItems: 'center' },
  reelCellOuter: { width: REEL_ITEM_W, height: '100%', alignItems: 'center', justifyContent: 'center' },
  reelCell: { width: REEL_ITEM_W - 15, height: 114, borderRadius: 14, borderWidth: 2, backgroundColor: '#161A1A', alignItems: 'center', justifyContent: 'center' },
  reelCellImg: { width: 66, height: 66 },
  reelCellEmoji: { fontSize: 45 },
  // Winieta po bokach okna — sygnalizuje "tu ikony wjeżdżają/wyjeżdżają", nie twardą krawędź.
  reelFadeL: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 36, backgroundColor: '#0E1113', opacity: 0.85 },
  reelFadeR: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, backgroundColor: '#0E1113', opacity: 0.85 },
  // `left` NIE tutaj — liczony z `reelWindowW` (centruje się na środku okna), patrz JSX.
  reelPointerBar: { position: 'absolute', top: 0, bottom: 0, width: 4, backgroundColor: '#FBBF24' },
  reelPointerTri: {
    position: 'absolute', top: -2, width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 14,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FBBF24',
  },

  revealWrap: { width: 240, height: 220, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110 },
  card: { minWidth: 190, paddingHorizontal: 26, paddingVertical: 20, borderRadius: 20, backgroundColor: '#161A1A', borderWidth: 2, alignItems: 'center', gap: 8 },
  tier: { fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  coins: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  gearImg: { width: 44, height: 44, borderRadius: 10, borderWidth: 2 },
  rewardName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  rewardKind: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5 },
  btn: { paddingHorizontal: 26, paddingVertical: 13, borderRadius: 14 },
  btnTxt: { color: '#07160F', fontSize: 15, fontWeight: '900' },
});
