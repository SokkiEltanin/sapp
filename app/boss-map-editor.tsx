import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Rect, Pattern, Circle, Defs } from 'react-native-svg';
import { ChevronLeft, RotateCcw, X as XIcon } from 'lucide-react-native';

import BossArt from '@/components/bosses/BossArt';
import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Stepper from '@/components/ui/Stepper';
import { BOSSES } from '@/utils/bosses';
import { layoutBossMap, applyLaneOverrides, catmullRomPath, centerScrollY, xToLane, LANES, MapNode } from '@/utils/bossMapLayout';
import { baseBossId } from '@/utils/madBosses';
import { useBossMapLayoutStore } from '@/store/bossMapLayoutStore';
import { useCampaignMapStyleStore } from '@/store/campaignMapStyleStore';
import { usePetStore } from '@/store/petStore';
import { spacing, typography, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const BASE_NODE = 60;
const GRID = 56;

// Edytor mapy bossów — PRZEBUDOWA OD ZERA #3 (2026-10-23, §412). Poprzednia wersja (od §322,
// swobodny drag palcem po płótnie, `PanResponder` per węzeł) miała DWA nierozwiązane problemy:
// (1) `ScrollView`-rodzic potrafił przejąć gest w trakcie ruchu mimo `onPanResponderTerminationRequest`
// (user: "nic praktycznie nie mogę zrobić [w edytorze]"), (2) swobodny X/Y pozwalał ustawić
// bossa w pozycji łamiącej "Y ściśle rośnie z indeksem", co było źródłem samoprzecinającej się
// trasy na PRAWDZIWEJ mapie (§403/§410, user retestował §410 po OTA i dalej było źle — "musimy
// ją chyba wywalić i zbudować od zera"). Nowy model usuwa OBA problemy naraz, strukturalnie:
// Y nie jest tu już NIGDZIE edytowalne (zawsze `f(indeks)`, patrz `applyLaneOverrides` w
// bossMapLayout.ts), a X to wybór jednego z `LANES` DYSKRETNYCH torów przez TAP na numerku/
// węźle + Stepper w panelu niżej — żadnego gestu przeciągania, więc nie ma już z kim/czym
// ScrollView mógłby "walczyć" o responder.
export default function BossMapEditorScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  // Style na żywo z Kreatora mapy bossów (2026-10-18, §379) — ten sam `campaignMapStyleStore`
  // co `CampaignMap.tsx`, żeby podgląd w edytorze i realny render mapy się zgadzały.
  const mapStyle = useCampaignMapStyleStore(st => st.live);
  const NODE = mapStyle.nodeSize;
  const laneOverrides = useBossMapLayoutStore(st => st.lanes);
  // Bramka hydratacji (2026-10-23, §413) — ten sam fix co `CampaignMap.tsx`: `lanes` czyta się
  // jako `{}` zanim store wczyta się z dysku, więc bez tej flagi pierwszy render edytora mógłby
  // (rzadziej niż na prawdziwej mapie, bo edytor zwykle otwiera się później w nawigacji) na
  // chwilę pokazać czysto proceduralny układ zamiast zapisanych torów.
  const lanesHydrated = useBossMapLayoutStore(st => st._hydrated);
  const setLane = useBossMapLayoutStore(st => st.setLane);
  const resetLane = useBossMapLayoutStore(st => st.resetLane);
  const resetAll = useBossMapLayoutStore(st => st.resetAll);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [confirmReset, setConfirmReset] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Lista "skocz do bossa" (2026-10-17) — przy 20+ bossach płótno łatwo robi się dłuższe niż
  // kilka ekranów; tapnięcie numeru centruje kamerę na TYM bosie, niezależnie jak daleko jest.
  const defeatedBosses = usePetStore(st => st.defeatedBosses);
  const currentIdx = useMemo(() => {
    const idx = BOSSES.findIndex(b => !defeatedBosses.includes(b.id));
    return idx === -1 ? BOSSES.length - 1 : idx;
  }, [defeatedBosses]);
  // Wybór bossa do edycji (2026-10-18, §376, zachowane w §412) — tapnięcie węzła NA PŁÓTNIE
  // albo numerka w górnym rzędzie wybiera bossa do panelu niżej, gdzie ustawia się jego tor.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // `baseBossId` — klucze `bossMapLayoutStore` są BAZOWE id (bez `mad_` prefiksu), dokładnie
  // jak czyta je `CampaignMap.tsx` — kampania i MAD dzielą jeden fizyczny układ.
  const ids = useMemo(() => BOSSES.map(b => baseBossId(b.id)), []);
  const { nodes, width: canvasW, height: canvasH } = useMemo(() => {
    const base = layoutBossMap(BOSSES.length, viewport.w || 340);
    return applyLaneOverrides(base.nodes, ids, laneOverrides, base.width);
  }, [ids, viewport.w, laneOverrides]);
  const pathD = useMemo(() => catmullRomPath(nodes), [nodes]);
  const initialTargetY = centerScrollY(nodes, currentIdx, viewport.h);
  const jumpTo = (idx: number) => {
    haptic.tap();
    setSelectedIdx(idx);
    scrollRef.current?.scrollTo({ y: centerScrollY(nodes, idx, viewport.h), animated: true });
  };

  const onLayoutViewport = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
  };

  const selectBoss = (idx: number) => { haptic.tap(); setSelectedIdx(idx); };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Edytor mapy</Text>
        <PressableScale onPress={() => { haptic.tap(); setConfirmReset(true); }} style={s.resetBtn}>
          <RotateCcw size={18} color={c.text.secondary} />
        </PressableScale>
      </View>
      <Text style={s.hint}>Tapnij bossa lub numerek, żeby go wybrać i ustawić jego tor niżej.</Text>

      {/* Lista "skocz do bossa" — numerki odpowiadają odznace na węźle. Kropka w rogu — pokazuje
          który boss ma RĘCZNIE ustawiony tor (`laneOverrides[id]` istnieje) a który dalej
          używa domyślnego, proceduralnego toru. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.jumpRow} contentContainerStyle={s.jumpRowContent}>
        {BOSSES.map((b, i) => (
          <PressableScale key={b.id} onPress={() => jumpTo(i)}
            style={[s.jumpChip, i === currentIdx && { backgroundColor: '#38BDF8', borderColor: '#38BDF8' }, i === selectedIdx && i !== currentIdx && { borderColor: '#FB923C' }]}>
            <Text style={[s.jumpChipTxt, i === currentIdx && { color: '#05060A' }]}>{i + 1}</Text>
            {laneOverrides[baseBossId(b.id)] != null && <View style={s.jumpChipDot} />}
          </PressableScale>
        ))}
      </ScrollView>

      <View style={s.stageWrap} onLayout={onLayoutViewport}>
        {viewport.w > 0 && viewport.h > 0 && lanesHydrated && (
        <ScrollView
          key={`${viewport.w}x${viewport.h}`}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentOffset={{ x: 0, y: initialTargetY }}
        >
          <View style={{ width: canvasW, height: canvasH }}>
            <Svg width={canvasW} height={canvasH} style={StyleSheet.absoluteFillObject}>
              <Defs>
                <Pattern id="mapGrid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <Circle cx={GRID / 2} cy={GRID / 2} r={1.6} fill={`rgba(255,255,255,${mapStyle.gridOpacity})`} />
                </Pattern>
              </Defs>
              <Rect x={0} y={0} width={canvasW} height={canvasH} fill="#0B0E14" />
              <Rect x={0} y={0} width={canvasW} height={canvasH} fill="url(#mapGrid)" />
              {/* `key={pathD}` (§403) — wymusza remount natywnego `<Path>` przy każdej zmianie
                  geometrii, zamiast liczyć na to że update-w-miejscu `d` propu zawsze się odda
                  na Androidzie. */}
              {!!pathD && <Path key={pathD} d={pathD} stroke="#38BDF8" strokeWidth={mapStyle.pathWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            </Svg>

            {BOSSES.map((b, i) => {
              const n = nodes[i];
              const selected = selectedIdx === i;
              return (
                <PressableScale key={b.id} onPress={() => selectBoss(i)} style={st_node(n, NODE)}>
                  <View style={[s.portrait, { width: NODE, height: NODE, borderRadius: NODE / 2 }, selected && s.portraitSelected]}>
                    <Text style={s.badge}>{i + 1}</Text>
                    <BossArt id={b.id} emoji={b.emoji} size={NODE} mystery={false} />
                  </View>
                  <Text style={s.nodeLabel} numberOfLines={1}>{b.name}</Text>
                </PressableScale>
              );
            })}
          </View>
        </ScrollView>
        )}
      </View>

      {/* Panel edycji wybranego bossa (§376, przebudowany w §412: tor zamiast X/Y) — pojedynczy
          `Stepper` 1..LANES (wyświetlany jako "Tor" 1-indeksowo dla usera, store trzyma
          0-indeksowo) + reset TYLKO tego bossa. `position: 'absolute'` — panel NIE jest zwykłym
          flex sibling'em `stageWrap` (flex:1), żeby nie zmieniać jego zmierzonej wysokości
          (→ remount ScrollView przez `key` → reset scrolla) przy każdym pojawieniu/zniknięciu. */}
      {selectedIdx != null && (() => {
        const b = BOSSES[selectedIdx];
        const n = nodes[selectedIdx];
        const lane = xToLane(n.x, canvasW);
        const hasOverride = laneOverrides[baseBossId(b.id)] != null;
        return (
          <View style={s.editPanel}>
            <View style={s.editPanelHead}>
              <BossArt id={b.id} emoji={b.emoji} size={28} mystery={false} />
              <View style={{ flex: 1 }}>
                <Text style={s.editPanelTitle} numberOfLines={1}>{b.name}</Text>
                <Text style={s.editPanelSub}>{hasOverride ? 'Tor ustawiony ręcznie' : 'Tor domyślny (automatyczny)'}</Text>
              </View>
              <PressableScale onPress={() => { haptic.tap(); setSelectedIdx(null); }} style={s.editPanelClose}>
                <XIcon size={16} color={c.text.muted} />
              </PressableScale>
            </View>
            <Stepper label="Tor" value={lane + 1} min={1} max={LANES} step={1}
              onChange={(v) => setLane(baseBossId(b.id), v - 1)} />
            <PressableScale
              onPress={() => { haptic.success(); resetLane(baseBossId(b.id)); toast.success(`Zresetowano tor: ${b.name}`); }}
              style={s.editPanelReset}
            >
              <RotateCcw size={14} color={c.text.secondary} />
              <Text style={s.editPanelResetTxt}>Resetuj tego bossa (domyślny tor)</Text>
            </PressableScale>
          </View>
        );
      })()}

      <ConfirmDialog
        visible={confirmReset}
        title="Zresetować układ mapy?"
        message="Wszyscy bossowie wrócą do domyślnego, automatycznego rozmieszczenia."
        confirmLabel="Resetuj"
        onConfirm={() => { resetAll(); setConfirmReset(false); haptic.success(); toast.success('Przywrócono domyślny układ'); }}
        onCancel={() => setConfirmReset(false)}
      />
    </SafeAreaView>
  );
}

function st_node(n: MapNode, node: number) {
  return {
    position: 'absolute' as const,
    left: n.x - node / 2, top: n.y - node / 2,
    width: node + 24, marginLeft: -12,
    alignItems: 'center' as const,
  };
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  resetBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 11.5, color: c.text.muted, textAlign: 'center', paddingHorizontal: spacing[4], paddingBottom: spacing[2] },

  jumpRow: { flexGrow: 0, paddingBottom: spacing[2] },
  jumpRowContent: { paddingHorizontal: spacing[3], gap: 6 },
  jumpChip: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#12161F', borderWidth: 1, borderColor: '#262c3a',
  },
  jumpChipTxt: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.6)' },
  jumpChipDot: {
    position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#FB923C', borderWidth: 1, borderColor: '#05060A',
  },

  stageWrap: { flex: 1, overflow: 'hidden', backgroundColor: '#05060A' },
  // `BASE_NODE` tu to tylko baza statyczna — realny, aktualny rozmiar z `campaignMapStyleStore`
  // nadpisywany inline w JSX (`NODE` w ciele komponentu), ten sam zabieg co CampaignMap.tsx.
  portrait: { width: BASE_NODE, height: BASE_NODE, borderRadius: BASE_NODE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12161F', borderWidth: 2, borderColor: '#262c3a' },
  portraitSelected: { borderColor: '#FB923C', shadowColor: '#FB923C', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  badge: {
    position: 'absolute', top: -6, left: -6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#05060A', borderWidth: 1, borderColor: '#262c3a', color: c.text.muted,
    fontSize: 9.5, fontWeight: '700', textAlign: 'center', lineHeight: 17, overflow: 'hidden', zIndex: 2,
  },
  nodeLabel: { fontSize: 10, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  editPanel: {
    // `position: 'absolute'` (patrz komentarz przy renderze) — panel NIE jest zwykłym flex
    // sibling'em `stageWrap`, żeby nie zmieniać jego zmierzonej wysokości (→ remount
    // ScrollView przez `key` → reset scrolla) przy każdym pojawieniu/zniknięciu. Overlay nie
    // zmienia rozmiaru `stageWrap` wcale, więc `viewport`/`key` zostają stabilne.
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: c.bg.secondary, borderTopWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3], gap: spacing[1],
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  editPanelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  editPanelTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  editPanelSub: { fontSize: 10.5, color: c.text.muted, marginTop: 1 },
  editPanelClose: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  editPanelReset: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing[1], paddingVertical: spacing[2], borderRadius: radius.md,
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
  },
  editPanelResetTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary },
}));
