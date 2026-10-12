import { memo, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Lock } from 'lucide-react-native';
import BossArt from './BossArt';
import PressableScale from '@/components/ui/PressableScale';
import { Boss, mysteryBossName } from '@/utils/bosses';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Mapa kampanii (2026-10-12, user: "chciałem zrobić MAPĘ jakby na której są te bosy i w nie
// się klika i idzie po kolei jak teraz a reszta mapy zasłonięta jest mgłą") — zastępuje dawną
// płaską listę "pokonani (zwinięci) + reszta z kłódkami" pod hero-cardem aktualnego bossa
// (ten HERO CARD ZOSTAJE bez zmian — realna akcja WALCZ/energia/taunt żyje tam, mapa jest
// WIZUALNYM PRZEGLĄDEM postępu, nie nowym miejscem do klikania WALCZ poza skrótem na aktualnym
// węźle). Wężowa ścieżka (sinus, nie siatka) z węzłami-portretami, SVG-linia łącząca je,
// mgła (LinearGradient) naciągnięta na segment ZA aktualnym węzłem. Kampania rośnie już do
// ~44 bossów (user generuje kilka dziennie, celuje w ~100+) — ScrollView, nie wszystko na
// raz, auto-scroll do aktualnego węzła przy montowaniu (żeby nie lądować zawsze na górze listy
// pokonanych).
const NODE = 56;
const ROW_GAP = 92;
const AMP = 70;          // maks. poziome wychylenie węzła od środka (wężowa ścieżka)
const TOP_PAD = 36;
const BOTTOM_PAD = 48;

function nodeX(i: number) { return Math.sin(i * 0.85) * AMP; }
function nodeY(i: number) { return TOP_PAD + i * ROW_GAP; }

// `defeatedIds` nie jest tu potrzebne osobno — kampania leci ŚCIŚLE sekwencyjnie (patrz
// `current = BOSSES.find(b => !defeatedBosses.includes(b.id))` w bosses.tsx, komentarz przy
// `defeatedList`), więc "pokonany" ⟺ "indeks < currentIdx" w TEJ SAMEJ tablicy `bosses`.
function CampaignMap({ bosses, currentId, onPressCurrent }: {
  bosses: Boss[]; currentId: string | null; onPressCurrent: () => void;
}) {
  const c = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const mapW = Dimensions.get('window').width - spacing[4] * 2;
  const centerX = mapW / 2;

  const currentIdx = currentId ? bosses.findIndex(b => b.id === currentId) : bosses.length;
  const contentH = TOP_PAD + Math.max(bosses.length - 1, 0) * ROW_GAP + NODE + BOTTOM_PAD;

  // Pełna trasa w jednym kolorze (przebyta już droga), + osobny, krótszy `Path` TYLKO do
  // aktualnego węzła w kolorze akcentu NA WIERZCHU — czyta się jako "oświetlony odcinek
  // ścieżki", reszta (pod mgłą niżej) zostaje matowa bez komplikowania się z maskami/clipami.
  const fullPathD = useMemo(() => {
    if (bosses.length < 2) return '';
    return bosses.map((_, i) => `${i === 0 ? 'M' : 'L'} ${centerX + nodeX(i)} ${nodeY(i) + NODE / 2}`).join(' ');
  }, [bosses.length, centerX]);
  const litPathD = useMemo(() => {
    const end = Math.min(currentIdx, bosses.length - 1);
    if (end < 1) return '';
    return Array.from({ length: end + 1 }, (_, i) => `${i === 0 ? 'M' : 'L'} ${centerX + nodeX(i)} ${nodeY(i) + NODE / 2}`).join(' ');
  }, [currentIdx, bosses.length, centerX]);

  // Auto-scroll do aktualnego węzła RAZ przy montowaniu (nie na każdy render — ekran-rodzic
  // re-renderuje się często, np. co tyknięcie odliczania energii, nie chcemy szarpać scrolla).
  useEffect(() => {
    const idx = currentIdx >= 0 ? currentIdx : Math.max(bosses.length - 1, 0);
    const targetY = Math.max(0, nodeY(idx) - 260);
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: targetY, animated: false }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bosses.length === 0) return null;

  // Mgła naciągnięta na segment ZA aktualnym węzłem (user: "reszta mapy zasłonięta jest
  // mgłą") — zaczyna się TUŻ nad aktualnym węzłem (lekki overlap, żeby nie było twardej
  // krawędzi na jego wysokości) i sięga do samego dołu trasy. Kampania w 100% ukończona
  // (`currentIdx >= bosses.length`, nic już zablokowane) → brak mgły w ogóle, nie
  // "przyklejona" do ostatniego (w tym wypadku POKONANEGO) węzła.
  const hasLocked = currentIdx < bosses.length;
  const fogStartY = hasLocked ? Math.max(0, nodeY(currentIdx) - NODE * 0.6) : contentH;
  const fogH = contentH - fogStartY;

  return (
    <View style={st.wrap}>
      <ScrollView ref={scrollRef} style={st.scroll} contentContainerStyle={{ height: contentH }} showsVerticalScrollIndicator={false}>
        <Svg width={mapW} height={contentH} style={StyleSheet.absoluteFillObject}>
          {!!fullPathD && <Path d={fullPathD} stroke={c.border.default} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />}
          {!!litPathD && <Path d={litPathD} stroke="#38BDF8" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </Svg>

        {bosses.map((b, i) => {
          const isDefeated = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isLocked = i > currentIdx;
          const x = centerX + nodeX(i) - NODE / 2;
          const y = nodeY(i);
          const node = (
            <View style={[st.node, { left: x, top: y }]}>
              {isCurrent && <View style={st.currentRing} />}
              <View style={[st.portrait, isDefeated && { opacity: 0.6 }]}>
                <BossArt id={b.id} emoji={b.emoji} size={NODE} mystery={isLocked} />
              </View>
              {isDefeated && <View style={st.badgeDone}><Check size={11} color="#07160F" strokeWidth={3} /></View>}
              {isLocked && <View style={st.badgeLock}><Lock size={10} color="rgba(255,255,255,0.75)" /></View>}
              <Text style={[st.nodeLabel, { color: isLocked ? c.text.muted : c.text.primary }]} numberOfLines={1}>
                {isLocked ? mysteryBossName(b.id) : b.name}
              </Text>
            </View>
          );
          if (isCurrent) {
            return (
              <PressableScale key={b.id} onPress={() => { haptic.tap(); onPressCurrent(); }} style={[st.nodeTouch, { left: x, top: y }]}>
                {node}
              </PressableScale>
            );
          }
          if (isDefeated) {
            return (
              <PressableScale
                key={b.id}
                onPress={() => { haptic.tap(); toast.info(`${b.name} — pokonany · ${b.loot.name}`); }}
                style={[st.nodeTouch, { left: x, top: y }]}
              >
                {node}
              </PressableScale>
            );
          }
          return <View key={b.id}>{node}</View>;
        })}

        <LinearGradient
          pointerEvents="none"
          colors={['rgba(8,10,16,0)', 'rgba(8,10,16,0.85)', 'rgba(8,10,16,0.96)'] as [string, string, string]}
          locations={[0, 0.3, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: fogStartY, height: Math.max(fogH, 0) }}
        />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { height: 420, borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing[3] },
  scroll: { flex: 1 },
  nodeTouch: { position: 'absolute', width: NODE, alignItems: 'center' },
  node: { position: 'absolute', width: NODE, alignItems: 'center' },
  portrait: { width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' },
  currentRing: {
    position: 'absolute', width: NODE + 16, height: NODE + 16, borderRadius: (NODE + 16) / 2,
    borderWidth: 2.5, borderColor: '#38BDF8', top: -8,
  },
  badgeDone: {
    position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#2AC68F', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#07160F',
  },
  badgeLock: {
    position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  nodeLabel: { fontSize: 9.5, fontWeight: '800', textAlign: 'center', marginTop: 4, width: NODE + 28 },
});

// memo: ekran-rodzic (bosses.tsx) re-renderuje się często (odliczanie energii) — props tego
// komponentu (bosses/currentId/onPressCurrent) zmieniają się tylko gdy REALNY postęp
// kampanii się zmienia, nie co tyknięcie zegara, więc memo faktycznie coś daje — POD
// WARUNKIEM że `onPressCurrent` jest stabilne (`useCallback` w bosses.tsx, patrz `goFight`
// tam), inaczej nowe closure na każdy render i tak łamałoby porównanie propsów.
export default memo(CampaignMap);
