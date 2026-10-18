import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, PanResponder, PanResponderInstance, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Rect, Pattern, Circle, Defs } from 'react-native-svg';
import { ChevronLeft, RotateCcw, X as XIcon } from 'lucide-react-native';

import BossArt from '@/components/bosses/BossArt';
import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Stepper from '@/components/ui/Stepper';
import { BOSSES } from '@/utils/bosses';
import { layoutBossMap, applyLayoutOverrides, catmullRomPath, centerScrollY, MapNode } from '@/utils/bossMapLayout';
import { useBossMapLayoutStore } from '@/store/bossMapLayoutStore';
import { usePetStore } from '@/store/petStore';
import { spacing, typography, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const NODE = 56;
const GRID = 56;

// Edytor mapy bossów (2026-10-14, ARCHITECTURE.md §322) — user po pięciu rundach prób na
// proceduralnie generowanej mapie: "Moze zrobisz edytor ja sam ustawie wszystko mapę ścieżkę
// i wgle (w sensie porozmieszczam punkty a ścieżkę polaczy soe sama z jakas tam modyfikacja
// smooth". Najpierw zrobiony jako Artifact (web, poza appką) — user: "Ale to w apce xddd" —
// więc TU, w samym Sapp. Każdy boss to osobny, przeciągalny węzeł (`PanResponder`, NIE
// `Gesture.Pan` na całym płótnie — to świadomie inna, dużo prostsza klasa gestu niż ta która
// psuła się w CampaignMap.tsx: pojedynczy, mały, niezależny obiekt przeciągany w swoich
// własnych, lokalnych współrzędnych, bez KAMERY/transformu/klamrowania granic całego płótna
// do pomylenia). Pozycja zapisuje się do `bossMapLayoutStore` DOPIERO przy puszczeniu palca
// (nie na każdą klatkę przeciągania) — każdy inny węzeł re-renderowałby się niepotrzebnie
// przy każdym pikselu ruchu, gdyby store aktualizował się w locie.
export default function BossMapEditorScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const overrides = useBossMapLayoutStore(st => st.positions);
  const setPosition = useBossMapLayoutStore(st => st.setPosition);
  const resetPosition = useBossMapLayoutStore(st => st.resetPosition);
  const resetAll = useBossMapLayoutStore(st => st.resetAll);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [confirmReset, setConfirmReset] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Lista "skocz do bossa" (2026-10-17, user: "jak nie widac bosa i wystaje za ekran to jak
  // mam go przeciągnąć" — przy 20+ bossach i ROW_GAP=170 płótno łatwo robi się dłuższe niż
  // kilka ekranów, a edytor dotąd zawsze otwierał się na samej górze, bez ŻADNEGO sposobu
  // dotrzeć do bossa poza bieżącym widokiem poza ręcznym przewijaniem na oślep). Ten sam
  // `centerScrollY` co BUG #6 w `CampaignMap.tsx` (§343) — jedna definicja "jak wycentrować
  // kamerę na węźle", teraz używana w DWÓCH miejscach zamiast tylko w prawdziwej mapie.
  const defeatedBosses = usePetStore(st => st.defeatedBosses);
  const currentIdx = useMemo(() => {
    const idx = BOSSES.findIndex(b => !defeatedBosses.includes(b.id));
    return idx === -1 ? BOSSES.length - 1 : idx;
  }, [defeatedBosses]);
  // Pozycja PRZECIĄGANEGO węzła podczas gestu — lokalny stan, NIE store (patrz komentarz
  // wyżej). `null` gdy nic nie jest aktualnie przeciągane.
  const [dragPos, setDragPos] = useState<{ idx: number; x: number; y: number } | null>(null);
  // Wybór bossa do edycji precyzyjnej (2026-10-18, §376) — user: "wybieram bosa i wybieram
  // pozycję i mogę zresetować na środek ekranu... nie mam możliwości zobaczyć innych edycji"
  // (porównanie do panelu właściwości X/Y + reset w systemie wolnego płótna z tej samej sesji,
  // §359). Dotąd jedyny sposób zmiany pozycji to przeciąganie palcem (precyzyjne ustawienie
  // "na pikselu" trudne) i jedyny reset to GLOBALNY `resetAll()` (wszyscy bossowie naraz) —
  // `resetPosition(id)` w `bossMapLayoutStore.ts` istniał od Fazy edytora (§322), ale nigdy nie
  // był podpięty do ŻADNEGO przycisku w UI. Tapnięcie chipu "skocz do bossa" ALBO złapanie
  // węzła (start przeciągania) teraz RÓWNIEŻ wybiera bossa do panelu niżej.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const ids = useMemo(() => BOSSES.map(b => b.id), []);
  const { nodes: baseNodes, width: canvasW, height: canvasH } = useMemo(() => {
    const base = layoutBossMap(BOSSES.length, viewport.w || 340);
    return applyLayoutOverrides(base.nodes, ids, overrides, base.width);
  }, [ids, viewport.w, overrides]);
  // Węzeł aktualnie przeciągany pokazuje się w `dragPos` (żywa pozycja gestu), reszta z
  // `baseNodes` (ostatnio zapisane) — scalone w jedną tablicę do rysowania ścieżki na żywo.
  const nodes: MapNode[] = useMemo(
    () => (dragPos ? baseNodes.map((n, i) => (i === dragPos.idx ? { x: dragPos.x, y: dragPos.y } : n)) : baseNodes),
    [baseNodes, dragPos],
  );
  const pathD = useMemo(() => catmullRomPath(nodes), [nodes]);
  const initialTargetY = centerScrollY(baseNodes, currentIdx, viewport.h);
  const jumpTo = (idx: number) => {
    haptic.tap();
    setSelectedIdx(idx);
    scrollRef.current?.scrollTo({ y: centerScrollY(baseNodes, idx, viewport.h), animated: true });
  };

  const onLayoutViewport = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
  };

  // `PanResponder.create` jest tworzony RAZ (ref, nie co render) — jego callbacki muszą więc
  // czytać ŚWIEŻE `nodes`/`canvasW` przez ref, nie przez domknięcie z chwili stworzenia
  // (dlatego te dwa `ref`y są zadeklarowane PRZED blokiem tworzącym respondery, mimo że same
  // callbacki i tak wykonują się dopiero później, już po pełnym przebiegu renderu).
  const nodesRef = useRef(baseNodes);
  nodesRef.current = baseNodes;
  const canvasWRef = useRef(canvasW);
  canvasWRef.current = canvasW;

  const responders = useRef<PanResponderInstance[]>([]);
  if (responders.current.length !== BOSSES.length) {
    responders.current = BOSSES.map((b, i) => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        haptic.tap();
        setSelectedIdx(i);
        setDragPos({ idx: i, x: nodesRef.current[i].x, y: nodesRef.current[i].y });
      },
      onPanResponderMove: (_e, g) => {
        setDragPos((prev) => {
          if (!prev || prev.idx !== i) return prev;
          const base = nodesRef.current[i];
          const nx = Math.max(0, Math.min(canvasWRef.current, base.x + g.dx));
          const ny = Math.max(20, base.y + g.dy);
          return { idx: i, x: nx, y: ny };
        });
      },
      onPanResponderRelease: () => {
        setDragPos((prev) => {
          if (prev && prev.idx === i) setPosition(b.id, Math.round(prev.x), Math.round(prev.y));
          return null;
        });
      },
      onPanResponderTerminate: () => setDragPos(null),
      // Bez tych dwóch węzeł da się złapać (onStartShouldSetPanResponder), ale otaczający
      // `ScrollView` (ten sam ekran) PRZEJMUJE gest w trakcie ruchu, gdy wykryje pionowy pan —
      // domyślne zachowanie RN gdy `onPanResponderTerminationRequest` nie jest podane to
      // ZEZWÓL na przejęcie. Na Androidzie (user testuje na `com.sokki.sapp`) dochodzi do tego
      // RÓWNOLEGLE natywny responder systemu widoków — `onShouldBlockNativeResponder` blokuje
      // i jego. User zrzutem: "nic praktycznie nie mogę zrobić [w edytorze]" — to dokładnie
      // objaw przejętego w locie gestu (haptic na starcie łapania działa, ale ruch palca nie
      // przesuwa węzła, bo ScrollView już przejął responder zanim palec zdążył się przesunąć).
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    }));
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Edytor mapy</Text>
        <PressableScale onPress={() => { haptic.tap(); setConfirmReset(true); }} style={s.resetBtn}>
          <RotateCcw size={18} color={c.text.secondary} />
        </PressableScale>
      </View>
      <Text style={s.hint}>Przeciągnij bossa palcem ALBO tapnij go/numerek, żeby wybrać i ustawić pozycję precyzyjnie niżej.</Text>

      {/* Lista "skocz do bossa" — numerki odpowiadają odznace na węźle. Rozwiązuje "nie widzę
          bossa, jak mam go przeciągnąć": zamiast przewijać na oślep, tapnięcie numeru centruje
          kamerę na TYM bosie, NIEZALEŻNIE jak daleko jest na płótnie. Kropka w rogu (§376,
          user: "nie mam możliwości wgle zobaczyć innych edycji") — pokazuje, który boss ma
          RĘCZNIE ustawioną pozycję (`overrides[b.id]` istnieje) a który dalej używa
          domyślnego, proceduralnego układu — dotąd nie było ŻADNEGO sposobu to odróżnić bez
          przeciągnięcia go i patrzenia czy "wraca" po resecie. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.jumpRow} contentContainerStyle={s.jumpRowContent}>
        {BOSSES.map((b, i) => (
          <PressableScale key={b.id} onPress={() => jumpTo(i)}
            style={[s.jumpChip, i === currentIdx && { backgroundColor: '#38BDF8', borderColor: '#38BDF8' }, i === selectedIdx && i !== currentIdx && { borderColor: '#FB923C' }]}>
            <Text style={[s.jumpChipTxt, i === currentIdx && { color: '#05060A' }]}>{i + 1}</Text>
            {overrides[b.id] != null && <View style={s.jumpChipDot} />}
          </PressableScale>
        ))}
      </ScrollView>

      <View style={s.stageWrap} onLayout={onLayoutViewport}>
        {viewport.w > 0 && viewport.h > 0 && (
        <ScrollView
          key={`${viewport.w}x${viewport.h}`}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!dragPos}
          contentOffset={{ x: 0, y: initialTargetY }}
        >
          <View style={{ width: canvasW, height: canvasH }}>
            <Svg width={canvasW} height={canvasH} style={StyleSheet.absoluteFillObject}>
              <Defs>
                <Pattern id="mapGrid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <Circle cx={GRID / 2} cy={GRID / 2} r={1.6} fill="rgba(255,255,255,0.08)" />
                </Pattern>
              </Defs>
              <Rect x={0} y={0} width={canvasW} height={canvasH} fill="#0B0E14" />
              <Rect x={0} y={0} width={canvasW} height={canvasH} fill="url(#mapGrid)" />
              {!!pathD && <Path d={pathD} stroke="#38BDF8" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            </Svg>

            {BOSSES.map((b, i) => {
              const n = nodes[i];
              const dragging = dragPos?.idx === i;
              const selected = selectedIdx === i && !dragging;
              return (
                <View
                  key={b.id}
                  {...responders.current[i].panHandlers}
                  style={[st_node(n, dragging)]}
                >
                  <View style={[s.portrait, dragging && s.portraitDragging, selected && s.portraitSelected]}>
                    <Text style={s.badge}>{i + 1}</Text>
                    <BossArt id={b.id} emoji={b.emoji} size={NODE} mystery={false} />
                  </View>
                  <Text style={s.nodeLabel} numberOfLines={1}>{b.name}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
        )}
      </View>

      {/* Panel edycji wybranego bossa (§376) — X/Y precyzyjnie (Stepper, nie tylko
          przeciąganie palcem) + reset TYLKO tego bossa (`resetPosition`, istniał w store od
          §322, nigdy nie podpięty do UI). Czyta `nodes[selectedIdx]` — ta sama, scalona z
          `dragPos` wartość co rysowanie na płótnie, więc jeśli user WŁAŚNIE przeciąga
          wybranego bossa, suwaki pokazują żywą pozycję, nie starą. */}
      {selectedIdx != null && (() => {
        const b = BOSSES[selectedIdx];
        const n = nodes[selectedIdx];
        return (
          <View style={s.editPanel}>
            <View style={s.editPanelHead}>
              <BossArt id={b.id} emoji={b.emoji} size={28} mystery={false} />
              <View style={{ flex: 1 }}>
                <Text style={s.editPanelTitle} numberOfLines={1}>{b.name}</Text>
                <Text style={s.editPanelSub}>{overrides[b.id] != null ? 'Pozycja ustawiona ręcznie' : 'Pozycja domyślna (automatyczna)'}</Text>
              </View>
              <PressableScale onPress={() => { haptic.tap(); setSelectedIdx(null); }} style={s.editPanelClose}>
                <XIcon size={16} color={c.text.muted} />
              </PressableScale>
            </View>
            <Stepper label="Pozycja X" value={Math.round(n.x)} min={0} max={Math.round(canvasW)} step={8}
              onChange={(v) => setPosition(b.id, v, Math.round(n.y))} />
            <Stepper label="Pozycja Y" value={Math.round(n.y)} min={20} max={Math.round(canvasH) - 20} step={8}
              onChange={(v) => setPosition(b.id, Math.round(n.x), v)} />
            <PressableScale
              onPress={() => { haptic.success(); resetPosition(b.id); toast.success(`Zresetowano pozycję: ${b.name}`); }}
              style={s.editPanelReset}
            >
              <RotateCcw size={14} color={c.text.secondary} />
              <Text style={s.editPanelResetTxt}>Resetuj tego bossa (domyślna pozycja)</Text>
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

function st_node(n: MapNode, dragging: boolean) {
  return {
    position: 'absolute' as const,
    left: n.x - NODE / 2, top: n.y - NODE / 2,
    width: NODE + 24, marginLeft: -12,
    alignItems: 'center' as const,
    zIndex: dragging ? 10 : 1,
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
  portrait: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12161F', borderWidth: 2, borderColor: '#262c3a' },
  portraitDragging: { borderColor: '#FB923C', shadowColor: '#FB923C', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  portraitSelected: { borderColor: '#FB923C' },
  badge: {
    position: 'absolute', top: -6, left: -6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#05060A', borderWidth: 1, borderColor: '#262c3a', color: c.text.muted,
    fontSize: 9.5, fontWeight: '700', textAlign: 'center', lineHeight: 17, overflow: 'hidden', zIndex: 2,
  },
  nodeLabel: { fontSize: 10, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  editPanel: {
    backgroundColor: c.bg.secondary, borderTopWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3], gap: spacing[1],
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
