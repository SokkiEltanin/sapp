import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Animated, Easing, Image } from 'react-native';
import { CRATE_META } from '@/utils/crates';
import { BoxReward } from '@/utils/petBoxes';
import { RARITY_META, gearById, GEAR_ITEMS } from '@/utils/gear';
import { itemById, COMBAT_ITEMS, CombatItemId } from '@/utils/combatItems';
import { haptic } from '@/utils/haptics';

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
const REEL_ITEM_W = 78;
const REEL_WINDOW_W = 264;
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
// Głównie common/rare obwódki, rzadki błysk epickiego/legendarnego/mitycznego dla smaku —
// czysto kosmetyczne, nie powiązane z realną rzadkością danego wypełniacza.
const FILLER_COLORS = [RARITY_META.common.color, RARITY_META.common.color, RARITY_META.common.color,
  RARITY_META.rare.color, RARITY_META.rare.color, RARITY_META.epic.color, RARITY_META.legendary.color, RARITY_META.mythic.color];

function rewardCell(reward: BoxReward, dupeCoins?: number): ReelCell {
  const isDupe = reward.type === 'gear' && !!dupeCoins;
  if (reward.type === 'gear') {
    const g = gearById(reward.itemId);
    return { key: 'reward', icon: g?.icon, color: isDupe ? RARITY_META.common.color : RARITY_META[reward.rarity].color };
  }
  if (reward.type === 'combatItem') {
    const def = itemById(reward.itemId);
    return { key: 'reward', icon: def.icons[Math.min(reward.level, def.icons.length) - 1], color: CRATE_META[reward.rarity].color };
  }
  return { key: 'reward', emoji: '🪙', color: CRATE_META[reward.rarity].color };
}

function buildReel(reward: BoxReward, dupeCoins?: number): ReelCell[] {
  const cells: ReelCell[] = [];
  for (let i = 0; i < REEL_LENGTH; i++) {
    if (i === REEL_TARGET_INDEX) { cells.push(rewardCell(reward, dupeCoins)); continue; }
    const f = FILLER_ICONS[Math.floor(Math.random() * FILLER_ICONS.length)];
    const color = FILLER_COLORS[Math.floor(Math.random() * FILLER_COLORS.length)];
    cells.push({ key: `f${i}`, icon: f.icon, emoji: f.emoji, color });
  }
  return cells;
}

// Odsłona nagrody ze skrzynki. Nagroda jest JUŻ wylosowana i przyznana — tu tylko celebracja:
// "Otwórz" → reel przelatuje i zwalnia na wylosowanym itemie → wybuch + cząstki + karta.
//
// `dupeCoins` (2026-08-27, user: "jak w skrzynce daily wydropiłem to mi zniknął po prostu
// nic nie dostałem") — gdy wylosowany gear to duplikat (już posiadany w ≥ tej rzadkości),
// `petStore.grantGear` go NIE przyznaje, tylko kompensuje monetami (patrz komentarz tam).
// Pokazywanie zwykłej karty "EKWIPUNEK! <nazwa>" w tej sytuacji byłoby kłamstwem — user
// widziałby że "dostał" item, którego naprawdę nie ma w ekwipunku. Ten prop przełącza kartę
// na uczciwą wersję: monety zamiast ikony/nazwy itemu, ta sama logika cząstek co przy
// zwykłej wygranej monet.
export default function BoxRevealModal({ visible, reward, boxColor, boxEmoji, dupeCoins, onClose }: {
  visible: boolean; reward: BoxReward | null; boxColor: string; boxEmoji: string; dupeCoins?: number; onClose: () => void;
}) {
  const [phase, setPhase] = useState<'closed' | 'spinning' | 'revealed'>('closed');
  const [reel, setReel] = useState<ReelCell[]>([]);
  const [flies, setFlies] = useState<{ id: number; sx: number; sy: number; ex: number; ey: number; emoji: string; size: number }[]>([]);
  const reelX = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setPhase('closed'); setFlies([]); setReel([]); reelX.setValue(0); burst.setValue(0);
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

  const doOpen = () => {
    if (phase !== 'closed' || !reward) return;
    haptic.medium();
    setReel(buildReel(reward, dupeCoins));
    reelX.setValue(0);
    setPhase('spinning');
    // Lekki losowy jitter (±30% szerokości komórki) — reel nie zatrzymuje się co do piksela w
    // TYM SAMYM miejscu za każdym razem, ale zawsze w granicach komórki nagrody (bezpieczne,
    // bo target ma 5 komórek zapasu PO sobie w REEL_LENGTH, patrz stałe wyżej).
    const jitter = (Math.random() - 0.5) * REEL_ITEM_W * 0.6;
    const finalX = REEL_WINDOW_W / 2 - (REEL_TARGET_INDEX * REEL_ITEM_W + REEL_ITEM_W / 2) + jitter;
    Animated.timing(reelX, {
      toValue: finalX, duration: 3400, easing: Easing.bezier(0.1, 0.7, 0.2, 1), useNativeDriver: true,
    }).start(() => {
      setPhase('revealed');
      haptic.success();
      Animated.spring(burst, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
      const isDupe = reward.type === 'gear' && !!dupeCoins;
      const n = (reward.rarity === 'legendary' || reward.rarity === 'mythic') ? 18 : reward.rarity === 'epic' ? 13 : 9;
      const em = (reward.type === 'coins' || isDupe) ? '🪙' : '✨';
      setFlies(Array.from({ length: n }).map((_, i) => ({ id: i,
        sx: 0, sy: 0, ex: (Math.random() - 0.5) * 300, ey: -(50 + Math.random() * 230),
        emoji: i % 3 === 0 ? '✨' : em, size: 24 })));
    });
  };

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const glowScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const glowOp = burst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 0.28] });
  const cardScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const isDupe = reward?.type === 'gear' && !!dupeCoins;
  const rewardTitle = isDupe ? 'MASZ JUŻ TEN PRZEDMIOT'
    : reward?.type === 'gear' ? 'EKWIPUNEK!'
    : reward?.type === 'combatItem' ? (reward.isUpgrade ? 'PERK ULEPSZONY!' : 'NOWY PERK BOSSA!')
    : 'MONETY';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={phase === 'revealed' ? onClose : undefined}>
        <View style={st.center} pointerEvents="box-none">
          {phase === 'closed' && (
            <>
              <Animated.View style={{ transform: [{ translateY: bobY }] }}>
                <View style={[st.box, { borderColor: boxColor }]}>
                  <View style={[st.boxLid, { backgroundColor: boxColor + '55' }]} />
                  <Text style={st.boxEmoji}>{boxEmoji}</Text>
                </View>
              </Animated.View>
              <Pressable onPress={doOpen} style={[st.openBtn, { backgroundColor: boxColor }]} hitSlop={10}>
                <Text style={st.openBtnTxt}>Otwórz</Text>
              </Pressable>
            </>
          )}
          {phase === 'spinning' && (
            <View style={st.reelWindow}>
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
              <View style={st.reelPointerTri} pointerEvents="none" />
              <View style={st.reelPointerBar} pointerEvents="none" />
            </View>
          )}
          {phase === 'revealed' && (
            <>
              <View style={st.revealWrap}>
                <Animated.View style={[st.glow, { backgroundColor: meta.color, transform: [{ scale: glowScale }], opacity: glowOp }]} />
                {flies.map(f => <Fly key={f.id} sx={f.sx} sy={f.sy} ex={f.ex} ey={f.ey} emoji={f.emoji} size={f.size} />)}
                <Animated.View style={[st.card, { borderColor: meta.color, transform: [{ scale: cardScale }] }]}>
                  <Text style={[st.tier, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                  {reward?.type === 'gear' && isDupe ? (
                    <>
                      <Text style={st.coins}>+{dupeCoins} 🪙</Text>
                      <Text style={st.rewardName}>{reward.name} (już masz)</Text>
                    </>
                  ) : reward?.type === 'gear' ? (
                    <>
                      {(() => { const g = gearById(reward.itemId); return g
                        ? <Image source={g.icon} style={[st.gearImg, { borderColor: meta.color }]} resizeMode="contain" />
                        : <Text style={{ fontSize: 40 }}>🎁</Text>; })()}
                      <Text style={st.rewardName}>{reward.name}</Text>
                    </>
                  ) : reward?.type === 'combatItem' ? (
                    <>
                      <Image source={itemById(reward.itemId).icons[Math.min(reward.level, itemById(reward.itemId).icons.length) - 1]}
                        style={[st.gearImg, { borderColor: meta.color }]} resizeMode="contain" />
                      <Text style={st.rewardName}>{reward.name} {reward.isUpgrade ? `Lv.${reward.level}` : ''}</Text>
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
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 18 },
  box: { width: 128, height: 104, borderRadius: 16, backgroundColor: '#161A1A', borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  boxLid: { position: 'absolute', top: 0, left: 0, right: 0, height: 30 },
  boxEmoji: { fontSize: 48, marginTop: 12 },
  openBtn: { paddingHorizontal: 30, paddingVertical: 13, borderRadius: 14 },
  openBtnTxt: { color: '#07160F', fontSize: 15, fontWeight: '900' },

  // Reel (2026-09-11) — okno stałej szerokości (REEL_WINDOW_W) z `overflow:'hidden'`, pasek
  // komórek (`reelStrip`, `flexDirection:'row'`) jedzie pod spodem przez `translateX`.
  // `reelCellOuter` = pełny "pitch" komórki (REEL_ITEM_W, BEZ marginesów — cała matematyka
  // przesunięcia w `doOpen` liczy w tej jednostce), `reelCell` = mniejszy, wycentrowany box
  // wizualny w środku (zostawia "szczelinę" między komórkami bez psucia pitcha).
  reelWindow: { width: REEL_WINDOW_W, height: 92, overflow: 'hidden', position: 'relative', borderRadius: 16, backgroundColor: '#0E1113' },
  reelStrip: { flexDirection: 'row', height: '100%', alignItems: 'center' },
  reelCellOuter: { width: REEL_ITEM_W, height: '100%', alignItems: 'center', justifyContent: 'center' },
  reelCell: { width: REEL_ITEM_W - 10, height: 76, borderRadius: 12, borderWidth: 2, backgroundColor: '#161A1A', alignItems: 'center', justifyContent: 'center' },
  reelCellImg: { width: 44, height: 44 },
  reelCellEmoji: { fontSize: 30 },
  // Winieta po bokach okna — sygnalizuje "tu ikony wjeżdżają/wyjeżdżają", nie twardą krawędź.
  reelFadeL: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 28, backgroundColor: '#0E1113', opacity: 0.85 },
  reelFadeR: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 28, backgroundColor: '#0E1113', opacity: 0.85 },
  reelPointerBar: { position: 'absolute', left: REEL_WINDOW_W / 2 - 1.5, top: 0, bottom: 0, width: 3, backgroundColor: '#FBBF24' },
  reelPointerTri: {
    position: 'absolute', left: REEL_WINDOW_W / 2 - 7, top: -2, width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 9,
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
