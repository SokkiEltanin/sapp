import { useMemo, useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  PanResponder, GestureResponderEvent, PanResponderGestureState, Share,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, RotateCcw, Share2, Move } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import CatArtStatic from '@/components/pet/CatArtStatic';
import BossArt from '@/components/bosses/BossArt';
import RadialGlow from '@/components/ui/RadialGlow';
import GroundShadow from '@/components/ui/GroundShadow';
import { paletteById } from '@/utils/catPalettes';
import { BOSSES } from '@/utils/bosses';
import { useShallow } from 'zustand/react/shallow';
import { usePetStore } from '@/store/petStore';
import { useBattleLayoutDraft, ArenaBgKey, BattleLayoutDraft } from '@/store/battleLayoutDraftStore';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Edytor układu areny walki (2026-09-17, user: "Daj mi mozliwosc zmienic sam obrazek tla
// walk żebym dostosował i moze tez wielkość i pozycje pupila, bossa i ich pasków HP, wtedy
// wyeksportować i zrobisz dla wszystkich"). Cel: dać userowi WIZUALNY podgląd DOKŁADNIE tego
// co widzi w prawdziwej walce (te same komponenty CatArtStatic/BossArt/RadialGlow/GroundShadow, ta
// sama grafika tła+scrim+mgiełka co app/boss-fight.tsx), z możliwością:
//  1. wyboru tła areny (jedno z istniejących LOKALIZACJA_*/LOKACJA_KAMPANIA),
//  2. przeciągnięcia pupila/bossa/paska HP pupila/paska HP bossa NIEZALEŻNIE (dziś w realnej
//     walce te 4 elementy nie mają ŻADNEGO własnego offsetu — patrz komentarz w
//     `battleLayoutDraftStore.ts`),
//  3. zmiany rozmiaru pupila/bossa,
//  4. eksportu wyniku (JSON do zaznaczenia/skopiowania albo Udostępnij) — user wkleja mi to
//     w rozmowie, a ja podpinam te wartości jako nowe stałe w boss-fight.tsx, GLOBALNIE dla
//     wszystkich trybów walki (kampania/raid/event/quest/mad/misja dzielą tę samą arenę).
// Świadomie NIE zmienia app/boss-fight.tsx samo z siebie — to jest TYLKO poligon do
// wypracowania liczb, podpięcie do realnej walki to osobny krok PO eksporcie.
export { ErrorBoundary } from '@/components/RouteErrorBoundary';

const BG_SOURCES: Record<ArenaBgKey, any> = {
  gorskislas: require('../assets/lokalizacje/LOKALIZACJA_GORKISLAS.png'),
  lodowa: require('../assets/lokalizacje/LOKALIZACJA_LODOWA.png'),
  jungla: require('../assets/lokalizacje/LOKALIZACJA_JUNGLA.png'),
  kampania: require('../assets/lokalizacje/LOKACJA_KAMPANIA.png'),
};
const BG_LABELS: Record<ArenaBgKey, string> = {
  gorskislas: 'Górskiej Las (domyślne)', lodowa: 'Lodowa Kraina', jungla: 'Dżungla', kampania: 'Kampania (nieużywane)',
};
const BG_KEYS = Object.keys(BG_SOURCES) as ArenaBgKey[];

const SIZE_MIN = 60, SIZE_MAX = 260, OFFSET_MAX = 160;
const SHADOW_SCALE_MIN = 0.1, SHADOW_SCALE_MAX = 1.2, SHADOW_OFFSET_MAX = 60;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
// Skala cienia w krokach 0.02 — Stepper poniżej ma domyślny `step=5` (px, dla pozycji),
// za gruby dla ułamka (0.62 → 0.64), więc te sterowniki dostają własny, mały krok.
const SHADOW_SCALE_STEP = 0.02;
// `Stepper` formatuje wartość jako plain `{value}` — dla ułamków z `SHADOW_SCALE_STEP` to
// dawałoby np. "0.6200000000000001" (binarna niedokładność float). Zaokrąglamy do 2 miejsc
// PRZED wyświetleniem/zapisem, żeby export JSON i UI zawsze pokazywały czyste liczby.
const round2 = (v: number) => Math.round(v * 100) / 100;

// Wrapper przeciągalny dotykiem — POZYCJA jest kontrolowana przez rodzica (`x`/`y` w px,
// dodane jako translateX/Y NA WIERZCHU normalnego flex-layoutu, nie zamiast niego), więc
// element nadal startuje w swoim zwykłym, wyśrodkowanym miejscu i user go tylko DOPYCHA.
// `posRef`/`onDragRef` (2026-09-17) — bez tego PanResponder.create (wołane RAZ przez useRef)
// zamykałby się na `x`/`y`/`onDrag` z PIERWSZEGO renderu (stale closure); tu zawsze czyta
// aktualne wartości przez ref, a `gestureState.dx/dy` jest kumulatywne od `onPanResponderGrant`,
// więc pozycja startowa gestu jest jedynym punktem odniesienia potrzebnym w danym geście.
function Draggable({ x, y, onDrag, onRelease, children }: {
  x: number; y: number; onDrag: (nx: number, ny: number) => void; onRelease?: () => void; children: ReactNode;
}) {
  const posRef = useRef({ x, y });
  useEffect(() => { posRef.current = { x, y }; }, [x, y]);
  const startRef = useRef({ x, y });
  const onDragRef = useRef(onDrag);
  useEffect(() => { onDragRef.current = onDrag; }, [onDrag]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startRef.current = posRef.current; },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        onDragRef.current(startRef.current.x + g.dx, startRef.current.y + g.dy);
      },
      onPanResponderRelease: () => onRelease?.(),
    }),
  ).current;

  return (
    <View style={{ transform: [{ translateX: x }, { translateY: y }] }} {...pan.panHandlers}>
      {children}
    </View>
  );
}

function Stepper({ label, value, onChange, step = 5, min, max }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min: number; max: number;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  return (
    <View style={s.stepperRow}>
      <Text style={s.stepperLabel}>{label}</Text>
      <View style={s.stepperCtrl}>
        <TouchableOpacity style={s.stepperBtn} onPress={() => { haptic.tap(); onChange(clamp(value - step, min, max)); }}>
          <Text style={s.stepperBtnTxt}>−</Text>
        </TouchableOpacity>
        <Text style={s.stepperValue}>{value}</Text>
        <TouchableOpacity style={s.stepperBtn} onPress={() => { haptic.tap(); onChange(clamp(value + step, min, max)); }}>
          <Text style={s.stepperBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BattleLayoutLab() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { draft, set, reset } = useBattleLayoutDraft();
  const [bossIdx, setBossIdx] = useState(0);
  const [showExport, setShowExport] = useState(false);

  // useShallow (nie goły obiekt-literał jako selektor) — ten sam anti-pattern, którego
  // naprawiałem cały tę sesję gdzie indziej (niestabilna referencja = nowy obiekt przy
  // KAŻDYM renderze store'u, nie tylko przy zmianie tych konkretnych pól).
  const { catColor, catStripes, catEyeColor, catNoseColor, catWhiskers, catLegStripes } = usePetStore(
    useShallow((st) => ({
      catColor: st.catColor, catStripes: st.catStripes, catEyeColor: st.catEyeColor,
      catNoseColor: st.catNoseColor, catWhiskers: st.catWhiskers, catLegStripes: st.catLegStripes,
    })),
  );
  const palette = useMemo(() => paletteById(catColor), [catColor]);
  const boss = BOSSES[bossIdx % BOSSES.length];

  const setPatch = useCallback((patch: Partial<BattleLayoutDraft>) => set(patch), [set]);

  const sceneHeight = 420;
  // Musi zgadzać się z `TILE_PORTRAIT_HEIGHT` w boss-fight.tsx (`Math.max(PORTRAIT_SIZE,
  // CAT_PORTRAIT_SIZE) + 18`) — ROOT CAUSE #7 (2026-09-23, user: "ten edytor dziwny i chyba
  // nie jeden do jeden"): tu było na sztywno 200px, realna arena liczy Math.max(bossSize,
  // catSize)+18 (=223 przy defaultowych 150/205) — 23px różnicy w wysokości kolumny portretu
  // PRZESUWAŁO pionowy środek (skąd liczy się offset Y=0) o ~11px między Edytorem a realną
  // walką, więc wytunowana w Edytorze pozycja NIE lądowała 1:1 w grze.
  const portraitColHeight = Math.max(draft.catSize, draft.bossSize) + 18;
  const exportJson = useMemo(() => JSON.stringify(draft, null, 2), [draft]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle} numberOfLines={1}>Edytor układu walki</Text>
        <TouchableOpacity
          style={s.resetBtn}
          onPress={() => { haptic.tap(); reset(); }}
        >
          <RotateCcw size={18} color={c.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Scena — TE SAME komponenty/proporcje co realna walka ─────────────────────── */}
        <View style={[s.scene, { height: sceneHeight }]}>
          <Image source={BG_SOURCES[draft.bg]} style={StyleSheet.absoluteFillObject} contentFit="cover" pointerEvents="none" />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.55)'] as [string, string, string]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(160,165,175,0.16)' }]} />

          <View style={s.vsRow}>
            <View style={s.tile}>
              <View style={[s.tilePortrait, { height: portraitColHeight }]}>
                <Draggable x={draft.catOffsetX} y={draft.catOffsetY} onDrag={(x, y) => setPatch({ catOffsetX: Math.round(x), catOffsetY: Math.round(y) })}>
                  <View style={[s.spriteBox, { width: draft.catSize, height: draft.catSize }]}>
                    <RadialGlow size={draft.catSize * 1.5} color={palette.coat} opacity={0.22} />
                    {/* Wrapper = pełny footprint spriteBoxa (jak sam `GroundShadow`, `bottom:0`
                        wewnątrz nadal trafia w to samo miejsce), TYLKO żeby dało się przesunąć
                        `translateY` — bez tego wrappera cień skolapsowałby się do 0×0 i jego
                        "dół" wypadłby w środku spriteBoxa, nie na jego faktycznym dole. */}
                    <View style={[StyleSheet.absoluteFillObject, { transform: [{ translateY: draft.catShadowOffsetY }] }]}>
                      <GroundShadow width={draft.catSize * draft.catShadowScaleX} height={draft.catSize * draft.catShadowScaleY} opacity={0.5} />
                    </View>
                    <CatArtStatic size={draft.catSize} expression="content" palette={palette} stripes={catStripes}
                      eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes} />
                  </View>
                </Draggable>
              </View>
              <Text style={s.tileLabel}>Pupil</Text>
              <Draggable x={draft.catHpOffsetX} y={draft.catHpOffsetY} onDrag={(x, y) => setPatch({ catHpOffsetX: Math.round(x), catHpOffsetY: Math.round(y) })}>
                <View style={s.hpBlock}>
                  <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: '72%', backgroundColor: '#2AC68F' }]} /></View>
                  <Text style={s.tileHpTxt}>72 / 100</Text>
                </View>
              </Draggable>
            </View>

            <View style={s.tile}>
              <View style={[s.tilePortrait, { height: portraitColHeight }]}>
                <Draggable x={draft.bossOffsetX} y={draft.bossOffsetY} onDrag={(x, y) => setPatch({ bossOffsetX: Math.round(x), bossOffsetY: Math.round(y) })}>
                  <View style={[s.spriteBox, { width: draft.bossSize, height: draft.bossSize }]}>
                    <RadialGlow size={draft.bossSize * 1.6} color="#F87171" opacity={0.25} />
                    <View style={[StyleSheet.absoluteFillObject, { transform: [{ translateY: draft.bossShadowOffsetY }] }]}>
                      <GroundShadow width={draft.bossSize * draft.bossShadowScaleX} height={draft.bossSize * draft.bossShadowScaleY} opacity={0.5} />
                    </View>
                    <BossArt id={boss.id} emoji={boss.emoji} size={draft.bossSize} />
                  </View>
                </Draggable>
              </View>
              <Text style={s.tileLabel} numberOfLines={1}>{boss.name}</Text>
              <Draggable x={draft.bossHpOffsetX} y={draft.bossHpOffsetY} onDrag={(x, y) => setPatch({ bossHpOffsetX: Math.round(x), bossHpOffsetY: Math.round(y) })}>
                <View style={s.hpBlock}>
                  <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: '45%' }]} /></View>
                  <Text style={s.tileHpTxt}>450 / 1000</Text>
                </View>
              </Draggable>
            </View>
          </View>
        </View>

        <View style={s.hint}>
          <Move size={13} color={c.text.muted} />
          <Text style={s.hintTxt}>Przeciągnij pupila, bossa albo pasek HP żeby ustawić pozycję.</Text>
        </View>

        {/* ── Tło areny ──────────────────────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Tło areny</Text>
        <View style={s.bgRow}>
          {BG_KEYS.map((key) => (
            <TouchableOpacity key={key} onPress={() => { haptic.tap(); setPatch({ bg: key }); }} style={s.bgThumbWrap}>
              <Image source={BG_SOURCES[key]} style={[s.bgThumb, draft.bg === key && s.bgThumbActive]} contentFit="cover" />
              <Text style={[s.bgThumbLabel, draft.bg === key && { color: c.accent.blue }]} numberOfLines={1}>{BG_LABELS[key]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Boss podglądu ──────────────────────────────────────────────────────────── */}
        <View style={s.bossPickRow}>
          <Text style={s.sectionLabel}>Boss podglądu: {boss.name}</Text>
          <TouchableOpacity style={s.bossNextBtn} onPress={() => { haptic.tap(); setBossIdx((i) => (i + 1) % BOSSES.length); }}>
            <Text style={s.bossNextTxt}>Następny →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Rozmiary ───────────────────────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Rozmiar</Text>
        <View style={s.card}>
          <Stepper label="Pupil" value={draft.catSize} onChange={(v) => setPatch({ catSize: v })} min={SIZE_MIN} max={SIZE_MAX} />
          <Stepper label="Boss" value={draft.bossSize} onChange={(v) => setPatch({ bossSize: v })} min={SIZE_MIN} max={SIZE_MAX} />
        </View>

        {/* ── Pozycja (numerycznie, jako zapasowa droga do przeciągania) ────────────────── */}
        <Text style={s.sectionLabel}>Pozycja (X / Y, px)</Text>
        <View style={s.card}>
          <Stepper label="Pupil X" value={draft.catOffsetX} onChange={(v) => setPatch({ catOffsetX: v })} min={-OFFSET_MAX} max={OFFSET_MAX} />
          <Stepper label="Pupil Y" value={draft.catOffsetY} onChange={(v) => setPatch({ catOffsetY: v })} min={-OFFSET_MAX} max={OFFSET_MAX} />
          <Stepper label="Boss X" value={draft.bossOffsetX} onChange={(v) => setPatch({ bossOffsetX: v })} min={-OFFSET_MAX} max={OFFSET_MAX} />
          <Stepper label="Boss Y" value={draft.bossOffsetY} onChange={(v) => setPatch({ bossOffsetY: v })} min={-OFFSET_MAX} max={OFFSET_MAX} />
          <Stepper label="Pasek HP Pupila X" value={draft.catHpOffsetX} onChange={(v) => setPatch({ catHpOffsetX: v })} min={-OFFSET_MAX} max={OFFSET_MAX} />
          <Stepper label="Pasek HP Pupila Y" value={draft.catHpOffsetY} onChange={(v) => setPatch({ catHpOffsetY: v })} min={-OFFSET_MAX} max={OFFSET_MAX} />
          <Stepper label="Pasek HP Bossa X" value={draft.bossHpOffsetX} onChange={(v) => setPatch({ bossHpOffsetX: v })} min={-OFFSET_MAX} max={OFFSET_MAX} />
          <Stepper label="Pasek HP Bossa Y" value={draft.bossHpOffsetY} onChange={(v) => setPatch({ bossHpOffsetY: v })} min={-OFFSET_MAX} max={OFFSET_MAX} />
        </View>

        {/* ── Cień (2026-09-20, "cienie nie pasują skali") ──────────────────────────────
            Dotąd JEDEN wspólny ułamek (0.62/0.18) rozmiaru portretu dla obu sprite'ów —
            działa dla bossa (PNG przycięty do sylwetki), nie dla kotka (SVG z pustym
            marginesem, patrz komentarz w battleLayoutDraftStore.ts). Niezależna skala X/Y +
            offsetY per sprite, żeby dostroić wizualnie na oko, nie zgadywać ułamkiem. */}
        <Text style={s.sectionLabel}>Cień — szerokość / wysokość / pozycja</Text>
        <View style={s.card}>
          <Stepper label="Pupil — szerokość" value={round2(draft.catShadowScaleX)} onChange={(v) => setPatch({ catShadowScaleX: round2(v) })} step={SHADOW_SCALE_STEP} min={SHADOW_SCALE_MIN} max={SHADOW_SCALE_MAX} />
          <Stepper label="Pupil — wysokość" value={round2(draft.catShadowScaleY)} onChange={(v) => setPatch({ catShadowScaleY: round2(v) })} step={SHADOW_SCALE_STEP} min={SHADOW_SCALE_MIN} max={SHADOW_SCALE_MAX} />
          <Stepper label="Pupil — pozycja Y" value={draft.catShadowOffsetY} onChange={(v) => setPatch({ catShadowOffsetY: v })} min={-SHADOW_OFFSET_MAX} max={SHADOW_OFFSET_MAX} />
          <Stepper label="Boss — szerokość" value={round2(draft.bossShadowScaleX)} onChange={(v) => setPatch({ bossShadowScaleX: round2(v) })} step={SHADOW_SCALE_STEP} min={SHADOW_SCALE_MIN} max={SHADOW_SCALE_MAX} />
          <Stepper label="Boss — wysokość" value={round2(draft.bossShadowScaleY)} onChange={(v) => setPatch({ bossShadowScaleY: round2(v) })} step={SHADOW_SCALE_STEP} min={SHADOW_SCALE_MIN} max={SHADOW_SCALE_MAX} />
          <Stepper label="Boss — pozycja Y" value={draft.bossShadowOffsetY} onChange={(v) => setPatch({ bossShadowOffsetY: v })} min={-SHADOW_OFFSET_MAX} max={SHADOW_OFFSET_MAX} />
        </View>

        {/* ── Eksport ────────────────────────────────────────────────────────────────── */}
        <TouchableOpacity style={s.exportBtn} onPress={() => { haptic.tap(); setShowExport((v) => !v); }}>
          <Share2 size={15} color={c.bg.primary} />
          <Text style={s.exportBtnTxt}>{showExport ? 'Zwiń eksport' : 'Eksportuj układ'}</Text>
        </TouchableOpacity>
        {showExport && (
          <View style={s.exportBox}>
            <Text style={s.exportHint}>Zaznacz cały tekst i skopiuj, albo użyj „Udostępnij" — wklej mi to w rozmowie, podepnę te wartości do walki dla wszystkich bossów.</Text>
            <TextInput
              value={exportJson}
              editable={false}
              multiline
              selectTextOnFocus
              style={s.exportText}
            />
            <TouchableOpacity
              style={s.shareBtn}
              onPress={() => { haptic.tap(); Share.share({ message: exportJson }).catch(() => {}); }}
            >
              <Share2 size={13} color={c.accent.blue} />
              <Text style={s.shareBtnTxt}>Udostępnij</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  resetBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] },

  scene: { width: '100%', borderRadius: radius.xl, overflow: 'hidden', position: 'relative', justifyContent: 'flex-end' },
  // paddingBottom = spacing[3] (nie spacing[4]) — musi zgadzać się z realną walką, gdzie
  // JEDYNE obicie treści od krawędzi to `arena`'s jednolite `padding: spacing[3]` na
  // wszystkie 4 strony (boss-fight.tsx); osobny, większy `paddingBottom` tutaj dawał
  // dodatkowe ~4px rozjazdu w pionie względem realnej areny (2026-09-23, user #7).
  vsRow: { flexDirection: 'row', gap: spacing[2], width: '100%', paddingHorizontal: spacing[3], paddingBottom: spacing[3] },
  tile: { flex: 1, minWidth: 0, alignItems: 'center', padding: spacing[2], gap: 6 },
  tilePortrait: { height: 200, width: '100%', justifyContent: 'center', alignItems: 'center' },
  spriteBox: { alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 12.5, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hpBlock: { width: '100%', gap: 4, alignItems: 'center' },
  tileHpTrack: { width: '100%', height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)', overflow: 'hidden' },
  tileHpFill: { height: '100%', borderRadius: 4, backgroundColor: '#EF4444' },
  tileHpTxt: { fontSize: 10, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  hintTxt: { fontSize: 11, color: c.text.muted },

  sectionLabel: { fontSize: 12.5, fontWeight: '800', color: c.text.secondary, marginTop: spacing[1] },
  bgRow: { flexDirection: 'row', gap: spacing[2] },
  bgThumbWrap: { flex: 1, alignItems: 'center', gap: 4 },
  bgThumb: { width: '100%', height: 60, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  bgThumbActive: { borderColor: c.accent.blue },
  bgThumbLabel: { fontSize: 9, color: c.text.muted, textAlign: 'center' },

  bossPickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bossNextBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
  bossNextTxt: { fontSize: 12, fontWeight: '700', color: c.accent.blue },

  card: { backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[3], gap: spacing[2], borderWidth: 1, borderColor: c.border.default },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperLabel: { fontSize: 12.5, color: c.text.secondary, fontWeight: '600' },
  stepperCtrl: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  stepperBtn: { width: 30, height: 30, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
  stepperBtnTxt: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  stepperValue: { fontSize: 13, fontWeight: '800', color: c.text.primary, minWidth: 36, textAlign: 'center' },

  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], backgroundColor: c.accent.blue, borderRadius: radius.lg, paddingVertical: spacing[3], marginTop: spacing[2] },
  exportBtnTxt: { fontSize: 13, fontWeight: '800', color: c.bg.primary },
  exportBox: { backgroundColor: c.bg.card, borderRadius: radius.lg, padding: spacing[3], gap: spacing[2], borderWidth: 1, borderColor: c.border.default },
  exportHint: { fontSize: 11, color: c.text.muted, lineHeight: 16 },
  exportText: { fontSize: 11, color: c.text.primary, fontFamily: 'monospace', backgroundColor: c.bg.elevated, borderRadius: radius.md, padding: spacing[2], minHeight: 220 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', paddingVertical: spacing[2], paddingHorizontal: spacing[4], borderRadius: radius.full, borderWidth: 1, borderColor: c.accent.blue + '55' },
  shareBtnTxt: { fontSize: 12, fontWeight: '700', color: c.accent.blue },
}));
