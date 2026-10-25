import { useMemo, useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  PanResponder, GestureResponderEvent, PanResponderGestureState, Share,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, RotateCcw, Share2, Move, Undo2, FlipHorizontal2 } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import CatArtStatic from '@/components/pet/CatArtStatic';
import BossArt from '@/components/bosses/BossArt';
import RadialGlow from '@/components/ui/RadialGlow';
import GroundShadow from '@/components/ui/GroundShadow';
import { paletteById } from '@/utils/catPalettes';
import { BOSSES } from '@/utils/bosses';
import { useShallow } from 'zustand/react/shallow';
import { usePetStore } from '@/store/petStore';
import {
  useBattleLayoutDraft, ArenaBgKey, BattleLayoutDraft, BG_EXTRA_DEFAULT,
} from '@/store/battleLayoutDraftStore';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Edytor układu areny walki (2026-09-17, user: "Daj mi mozliwosc zmienic sam obrazek tla
// walk żebym dostosował i moze tez wielkość i pozycje pupila, bossa i ich pasków HP, wtedy
// wyeksportować i zrobisz dla wszystkich"). Cel: dać userowi WIZUALNY podgląd DOKŁADNIE tego
// co widzi w prawdziwej walce (te same komponenty CatArtStatic/BossArt/RadialGlow/GroundShadow,
// to samo tło+scrim+mgiełka co app/boss-fight.tsx — patrz komentarz przy tłu w JSX niżej).
//
// 2026-10-10 (user: "dawaj edytor lepszy pod każdego bosa możesz dać inny i pod kazde tlo inny
// i dodaj możliwość mi zmiany jasności tla jakby lub ścinki czarnej pomiędzy i modyfikacje typu
// Odbicie lustrzane i opcje cofnij") — trzy niezależne rozszerzenia:
//  1. Pozycja/rozmiar/cień/odbicie TERAZ per boss (`perBoss` w battleLayoutDraftStore.ts) —
//     przełączenie "Boss podglądu" przełącza też NA JEGO WŁASNE, osobno zapamiętane wartości
//     (fallback na bazowy `draft`, dopóki ten konkretny boss nic nie dostał).
//  2. Jasność/ściemnienie TERAZ per tło (`perBg`) — czarny overlay o regulowanej
//     nieprzezroczystości NAD tłem/gradientem/mgiełką.
//  3. Odbicie lustrzane (`catFlipped`/`bossFlipped`, `scaleX:-1` na wrapperze sprite'a) +
//     stos "Cofnij" (`history` w store, snapshot CAŁEGO stanu PRZED każdą mutacją — jeden
//     snapshot na GEST przeciągania, nie na każdy piksel ruchu, patrz `Draggable.onGrab`).
// Przy tej samej okazji: tło przestało być lokalnym, ograniczonym boksem (`sceneHeight=420`
// z WŁASNYM Image+gradientem wewnątrz) — renderuje się teraz PEŁNOEKRANOWO, POD
// headerem/scrollem, dokładnie jak w `app/boss-fight.tsx` od 2026-09-14 (ROOT CAUSE drugiego
// zgłoszenia "edytor nie odzwierciedla walki", ARCHITECTURE.md §287 — liczby pozycji/rozmiaru
// były już 1:1 zgodne, ale kadrowanie tła w ograniczonym boksie wizualnie wygląda inaczej niż
// to samo tło na całym ekranie).
// Świadomie NIE zmienia app/boss-fight.tsx samo z siebie — to jest TYLKO poligon do
// wypracowania liczb, podpięcie per-boss pozycjonowania/teł do realnej walki (ktoś dziś tam
// go nie ma, patrz `fightArenaBg`/`ARENA_BG_BY_KIND` w bossIcons.ts) to osobny krok PO
// eksporcie, na wyraźną prośbę.
//
// 2026-10-25 (§420, user: "zrób ten edytor dobrze, każdy element osobno, pełno ekranów" po
// zobaczeniu jak wszystkie 8 sekcji (tło/jasność/boss podglądu/rozmiar/pozycja/cień/odbicie/
// eksport) siedziały jedna pod drugą na JEDNYM długim scrollu) — przebudowa na wizard: 6
// osobnych KROKÓW (Tło → Pupil → Boss → Cień → Odbicie → Eksport), nawigacja Wstecz/Dalej na
// dole, kropki postępu pod nagłówkiem (tappable — skok bezpośrednio do kroku). Scena-podgląd
// (ten sam Draggable/CatArtStatic/BossArt co dotąd) NIE jest częścią żadnego kroku — zostaje
// PRZYPIĘTA nad przewijanym panelem sterowania, żeby zmiana widoczna była na bieżąco niezależnie
// od tego, który krok akurat edytujesz. Element NIEaktywny w danym kroku (np. boss podczas
// kroku "Pupil") dostaje przyciemnienie (`tileDim`) — czytelny sygnał "to nie ten krok", bez
// blokowania przeciągania (dalej działa, na wypadek drobnej korekty przy okazji).
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

// Kroki wizarda (§420) — kolejność = kolejność dawnych sekcji na jednym scrollu, teraz każda
// (albo para powiązanych, np. "Cień" dla obu sprite'ów naraz) jako osobny pełny ekran.
const STEP_TITLES = ['Tło', 'Pupil', 'Boss', 'Cień', 'Odbicie', 'Eksport'] as const;
const STEP_COUNT = STEP_TITLES.length;
const [STEP_BG, STEP_CAT, STEP_BOSS, STEP_SHADOW, STEP_FLIP, STEP_EXPORT] = [0, 1, 2, 3, 4, 5];

const SIZE_MIN = 60, SIZE_MAX = 260, OFFSET_MAX = 160;
const SHADOW_SCALE_MIN = 0.1, SHADOW_SCALE_MAX = 1.2, SHADOW_OFFSET_MAX = 60;
const DARKEN_MIN = 0, DARKEN_MAX = 0.85, DARKEN_STEP = 0.05;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
// Skala cienia/ściemnienia w krokach 0.02/0.05 — Stepper poniżej ma domyślny `step=5` (px, dla
// pozycji), za gruby dla ułamka (0.62 → 0.64), więc te sterowniki dostają własny, mały krok.
const SHADOW_SCALE_STEP = 0.02;
// `Stepper` formatuje wartość jako plain `{value}` — dla ułamków z małym krokiem to dawałoby
// np. "0.6200000000000001" (binarna niedokładność float). Zaokrąglamy do 2 miejsc PRZED
// wyświetleniem/zapisem, żeby export JSON i UI zawsze pokazywały czyste liczby.
const round2 = (v: number) => Math.round(v * 100) / 100;

// Wrapper przeciągalny dotykiem — POZYCJA jest kontrolowana przez rodzica (`x`/`y` w px,
// dodane jako translateX/Y NA WIERZCHU normalnego flex-layoutu, nie zamiast niego), więc
// element nadal startuje w swoim zwykłym, wyśrodkowanym miejscu i user go tylko DOPYCHA.
// `posRef`/`onDragRef` (2026-09-17) — bez tego PanResponder.create (wołane RAZ przez useRef)
// zamykałby się na `x`/`y`/`onDrag` z PIERWSZEGO renderu (stale closure); tu zawsze czyta
// aktualne wartości przez ref, a `gestureState.dx/dy` jest kumulatywne od `onPanResponderGrant`,
// więc pozycja startowa gestu jest jedynym punktem odniesienia potrzebnym w danym geście.
// `onGrab` (2026-10-10, "opcje cofnij") — wołane RAZ na `onPanResponderGrant`, PRZED pierwszym
// `onDrag` tego gestu, żeby rodzic zdążył zapisać snapshot "sprzed przeciągnięcia" na stos
// cofania — jeden snapshot na CAŁY gest, nie jeden na każdy piksel ruchu.
function Draggable({ x, y, onDrag, onGrab, children }: {
  x: number; y: number; onDrag: (nx: number, ny: number) => void; onGrab?: () => void; children: ReactNode;
}) {
  const posRef = useRef({ x, y });
  useEffect(() => { posRef.current = { x, y }; }, [x, y]);
  const startRef = useRef({ x, y });
  const onDragRef = useRef(onDrag);
  useEffect(() => { onDragRef.current = onDrag; }, [onDrag]);
  const onGrabRef = useRef(onGrab);
  useEffect(() => { onGrabRef.current = onGrab; }, [onGrab]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startRef.current = posRef.current; onGrabRef.current?.(); },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        onDragRef.current(startRef.current.x + g.dx, startRef.current.y + g.dy);
      },
      // 2026-10-11, user: "ten edytor do poprawy nic sie nie da ustawic" — root cause: ten
      // PanResponder żyje WEWNĄTRZ `ScrollView` (patrz JSX niżej), a bez tych dwóch handlerów
      // RN domyślnie POZWALA rodzicowi (ScrollView) przejąć gest w dowolnym momencie ruchu —
      // każdy przeciąg z choćby minimalną pionową składową (czyli praktycznie każdy ludzki
      // gest) odpalał scroll strony i PRZERYWAŁ `onPanResponderMove` w połowie, więc kotek/boss/
      // paski HP więzły tam gdzie akurat ScrollView ukradł responder. Ten gap istniał od
      // PIERWSZEJ wersji edytora (2026-08, commit 42fa780) — nie regresja z ostatniej rundy,
      // po prostu nigdy wcześniej nie zgłoszony tak jednoznacznie.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    }),
  ).current;

  return (
    <View style={{ transform: [{ translateX: x }, { translateY: y }] }} {...pan.panHandlers}>
      {children}
    </View>
  );
}

function Stepper({ label, value, onChange, onCommit, step = 5, min, max }: {
  label: string; value: number; onChange: (v: number) => void; onCommit?: () => void; step?: number; min: number; max: number;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  return (
    <View style={s.stepperRow}>
      <Text style={s.stepperLabel}>{label}</Text>
      <View style={s.stepperCtrl}>
        <TouchableOpacity style={s.stepperBtn} onPress={() => { haptic.tap(); onCommit?.(); onChange(clamp(value - step, min, max)); }}>
          <Text style={s.stepperBtnTxt}>−</Text>
        </TouchableOpacity>
        <Text style={s.stepperValue}>{value}</Text>
        <TouchableOpacity style={s.stepperBtn} onPress={() => { haptic.tap(); onCommit?.(); onChange(clamp(value + step, min, max)); }}>
          <Text style={s.stepperBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BattleLayoutLab() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();
  const { draft, perBoss, perBg, set, setBgExtra, setBg, reset, resetBoss, undo, history, pushUndoSnapshot } = useBattleLayoutDraft();
  const [bossIdx, setBossIdx] = useState(0);
  const [step, setStep] = useState(0);
  const goNext = () => { haptic.tap(); setStep((v) => Math.min(v + 1, STEP_COUNT - 1)); };
  const goBack = () => { haptic.tap(); setStep((v) => Math.max(v - 1, 0)); };

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

  // Wartości EFEKTYWNE dla aktualnie oglądanego bossa/tła — bazowy `draft`/`BG_EXTRA_DEFAULT`
  // jako fallback, nadpisany tym co ten KONKRETNY boss/tło ma już zapisane w `perBoss`/`perBg`
  // (patrz komentarz przy store'ie). Żaden pojedynczy obiekt nie jest "tym co się edytuje" —
  // `set`/`setBgExtra` zawsze piszą do `perBoss[boss.id]`/`perBg[draft.bg]`, nigdy do `draft`
  // wprost, więc ten `useMemo` zawsze poprawnie odzwierciedla ostatni zapis.
  const eff: BattleLayoutDraft = useMemo(() => ({ ...draft, ...perBoss[boss.id] }), [draft, perBoss, boss.id]);
  const bgExtra = useMemo(() => ({ ...BG_EXTRA_DEFAULT, ...perBg[draft.bg] }), [perBg, draft.bg]);
  const hasBossOverride = !!perBoss[boss.id];

  const setPatch = useCallback((patch: Partial<BattleLayoutDraft>) => set(boss.id, patch), [set, boss.id]);
  const pushUndo = pushUndoSnapshot;

  // Wysokość wspólnej kolumny portretu — musi zgadzać się z `TILE_PORTRAIT_HEIGHT` w
  // boss-fight.tsx (patrz ARCHITECTURE.md §173, root cause #7).
  const portraitColHeight = Math.max(eff.catSize, eff.bossSize) + 18;
  const exportJson = useMemo(() => JSON.stringify({ draft, perBoss, perBg }, null, 2), [draft, perBoss, perBg]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Tło CAŁEGO ekranu (2026-10-10, dociągnięte do architektury `boss-fight.tsx` z
          2026-09-14) — Image absolutnie wypełniający cały SafeAreaView, POD headerem/scrollem,
          nie boksowany lokalny podgląd jak dotąd (patrz komentarz na górze pliku). Scrim (ten
          sam 3-stopniowy czarny gradient co realna arena) + jednolita jasnoszara "mgiełka"
          (identyczny przepis), NAD którymi nowa, regulowana warstwa ściemnienia
          (`bgExtra.darken`, "Jasność tła" niżej) — user dostroił, nie zgaduje ile ciemniej. */}
      <Image source={BG_SOURCES[draft.bg]} style={StyleSheet.absoluteFillObject} contentFit="cover" pointerEvents="none" />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.55)'] as [string, string, string]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(160,165,175,0.16)' }]} />
      {bgExtra.darken > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: bgExtra.darken }]} />
      )}

      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color="#fff" /></PressableScale>
        <Text style={s.headerTitle} numberOfLines={1}>Edytor układu walki</Text>
        <TouchableOpacity
          style={s.headerBtn}
          disabled={history.length === 0}
          onPress={() => { haptic.tap(); undo(); }}
        >
          <Undo2 size={18} color={history.length === 0 ? 'rgba(255,255,255,0.3)' : '#fff'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => { haptic.tap(); Alert.alert('Resetuj WSZYSTKO?', 'Wyzeruje bazowy układ ORAZ wszystkie osobno dostrojone bossy i tła. Nie da się cofnąć.', [{ text: 'Anuluj', style: 'cancel' }, { text: 'Resetuj', style: 'destructive', onPress: () => reset() }]); }}
        >
          <RotateCcw size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Pasek kroków wizarda (§420) — kropki tappable (skok bezpośrednio), tytuł
          aktualnego kroku pod spodem. ───────────────────────────────────────────────── */}
      <View style={s.stepRow}>
        {STEP_TITLES.map((title, i) => (
          <TouchableOpacity key={title} onPress={() => { haptic.tap(); setStep(i); }} style={s.stepDotWrap} hitSlop={6}>
            <View style={[s.stepDot, i === step && s.stepDotActive, i < step && s.stepDotDone]} />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.stepTitle}>Krok {step + 1}/{STEP_COUNT} · {STEP_TITLES[step]}</Text>

      {/* ── Scena — TE SAME komponenty/proporcje co realna walka — PRZYPIĘTA nad panelem
          kroków (nie przewija się z nim), widoczna niezależnie od tego, który krok edytujesz. */}
      <View style={s.arena}>
        <View style={s.vsRow}>
          <View style={[s.tile, step === STEP_BOSS && s.tileDim]}>
            <View style={[s.tilePortrait, { height: portraitColHeight }]}>
              <Draggable x={eff.catOffsetX} y={eff.catOffsetY} onGrab={pushUndo} onDrag={(x, y) => setPatch({ catOffsetX: Math.round(x), catOffsetY: Math.round(y) })}>
                <View style={[s.spriteBox, { width: eff.catSize, height: eff.catSize, transform: [{ scaleX: eff.catFlipped ? -1 : 1 }] }]}>
                  <RadialGlow size={eff.catSize * 1.5} color={palette.coat} opacity={0.22} />
                  {/* Wrapper = pełny footprint spriteBoxa (jak sam `GroundShadow`, `bottom:0`
                      wewnątrz nadal trafia w to samo miejsce), TYLKO żeby dało się przesunąć
                      `translateY` — bez tego wrappera cień skolapsowałby się do 0×0 i jego
                      "dół" wypadłby w środku spriteBoxa, nie na jego faktycznym dole. */}
                  <View style={[StyleSheet.absoluteFillObject, { transform: [{ translateY: eff.catShadowOffsetY }] }]}>
                    <GroundShadow width={eff.catSize * eff.catShadowScaleX} height={eff.catSize * eff.catShadowScaleY} opacity={0.5} />
                  </View>
                  <CatArtStatic size={eff.catSize} expression="content" palette={palette} stripes={catStripes}
                    eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes} />
                </View>
              </Draggable>
            </View>
            <Text style={s.tileLabel}>Pupil</Text>
            <Draggable x={eff.catHpOffsetX} y={eff.catHpOffsetY} onGrab={pushUndo} onDrag={(x, y) => setPatch({ catHpOffsetX: Math.round(x), catHpOffsetY: Math.round(y) })}>
              <View style={s.hpBlock}>
                <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: '72%', backgroundColor: '#2AC68F' }]} /></View>
                <Text style={s.tileHpTxt}>72 / 100</Text>
              </View>
            </Draggable>
          </View>

          <View style={[s.tile, step === STEP_CAT && s.tileDim]}>
            <View style={[s.tilePortrait, { height: portraitColHeight }]}>
              <Draggable x={eff.bossOffsetX} y={eff.bossOffsetY} onGrab={pushUndo} onDrag={(x, y) => setPatch({ bossOffsetX: Math.round(x), bossOffsetY: Math.round(y) })}>
                <View style={[s.spriteBox, { width: eff.bossSize, height: eff.bossSize, transform: [{ scaleX: eff.bossFlipped ? -1 : 1 }] }]}>
                  <RadialGlow size={eff.bossSize * 1.6} color="#F87171" opacity={0.25} />
                  <View style={[StyleSheet.absoluteFillObject, { transform: [{ translateY: eff.bossShadowOffsetY }] }]}>
                    <GroundShadow width={eff.bossSize * eff.bossShadowScaleX} height={eff.bossSize * eff.bossShadowScaleY} opacity={0.5} />
                  </View>
                  <BossArt id={boss.id} emoji={boss.emoji} size={eff.bossSize} />
                </View>
              </Draggable>
            </View>
            <Text style={s.tileLabel} numberOfLines={1}>{boss.name}</Text>
            <Draggable x={eff.bossHpOffsetX} y={eff.bossHpOffsetY} onGrab={pushUndo} onDrag={(x, y) => setPatch({ bossHpOffsetX: Math.round(x), bossHpOffsetY: Math.round(y) })}>
              <View style={s.hpBlock}>
                <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: '45%' }]} /></View>
                <Text style={s.tileHpTxt}>450 / 1000</Text>
              </View>
            </Draggable>
          </View>
        </View>
      </View>

      {(step === STEP_CAT || step === STEP_BOSS) && (
        <View style={s.hint}>
          <Move size={13} color="rgba(255,255,255,0.75)" />
          <Text style={s.hintTxt}>
            {step === STEP_CAT ? 'Przeciągnij pupila albo jego pasek HP żeby ustawić pozycję.' : 'Przeciągnij bossa albo jego pasek HP żeby ustawić pozycję.'}
          </Text>
        </View>
      )}

      {/* ── Panel kroku — TYLKO treść aktualnego kroku, `key={step}` resetuje scroll przy
          zmianie kroku zamiast dziedziczyć offset z poprzedniego. ─────────────────────────── */}
      <ScrollView key={step} style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {step === STEP_BG && (
          <>
            <Text style={s.sectionLabel}>Tło areny</Text>
            <View style={s.bgRow}>
              {BG_KEYS.map((key) => (
                <TouchableOpacity key={key} onPress={() => { haptic.tap(); setBg(key); }} style={s.bgThumbWrap}>
                  <Image source={BG_SOURCES[key]} style={[s.bgThumb, draft.bg === key && s.bgThumbActive]} contentFit="cover" />
                  <Text style={[s.bgThumbLabel, draft.bg === key && { color: c.accent.blue }]} numberOfLines={1}>{BG_LABELS[key]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Jasność tła (2026-10-10, "zmiany jasności tla jakby lub ścinki czarnej
                pomiędzy") — per KONKRETNE tło (`perBg[draft.bg]`), nie per boss: ten sam las
                użyty w dwóch różnych walkach powinien mieć tę samą jasność w obu. */}
            <Text style={s.sectionLabel}>Jasność tła — {BG_LABELS[draft.bg]}</Text>
            <View style={s.card}>
              {/* Bez `onCommit` — `setBgExtra` (w odróżnieniu od `set` dla perBoss) sam pcha
                  DOKŁADNIE jeden snapshot na każde wywołanie, patrz battleLayoutDraftStore.ts.
                  Dodatkowy `onCommit` tutaj podwajałby wpisy na stosie cofania. */}
              <Stepper label="Ściemnienie" value={round2(bgExtra.darken)} onChange={(v) => setBgExtra(draft.bg, { darken: round2(v) })} step={DARKEN_STEP} min={DARKEN_MIN} max={DARKEN_MAX} />
            </View>
          </>
        )}

        {step === STEP_CAT && (
          <>
            <Text style={s.sectionLabel}>Rozmiar</Text>
            <View style={s.card}>
              <Stepper label="Pupil" value={eff.catSize} onChange={(v) => setPatch({ catSize: v })} onCommit={pushUndo} min={SIZE_MIN} max={SIZE_MAX} />
            </View>

            <Text style={s.sectionLabel}>Pozycja (X / Y, px)</Text>
            <View style={s.card}>
              <Stepper label="Pupil X" value={eff.catOffsetX} onChange={(v) => setPatch({ catOffsetX: v })} onCommit={pushUndo} min={-OFFSET_MAX} max={OFFSET_MAX} />
              <Stepper label="Pupil Y" value={eff.catOffsetY} onChange={(v) => setPatch({ catOffsetY: v })} onCommit={pushUndo} min={-OFFSET_MAX} max={OFFSET_MAX} />
              <Stepper label="Pasek HP Pupila X" value={eff.catHpOffsetX} onChange={(v) => setPatch({ catHpOffsetX: v })} onCommit={pushUndo} min={-OFFSET_MAX} max={OFFSET_MAX} />
              <Stepper label="Pasek HP Pupila Y" value={eff.catHpOffsetY} onChange={(v) => setPatch({ catHpOffsetY: v })} onCommit={pushUndo} min={-OFFSET_MAX} max={OFFSET_MAX} />
            </View>
          </>
        )}

        {step === STEP_BOSS && (
          <>
            <View style={s.bossPickRow}>
              <Text style={s.sectionLabel}>Boss podglądu: {boss.name}{hasBossOverride ? ' •' : ''}</Text>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                {hasBossOverride && (
                  <TouchableOpacity style={s.bossNextBtn} onPress={() => { haptic.tap(); resetBoss(boss.id); }}>
                    <Text style={[s.bossNextTxt, { color: c.accent.red }]}>Resetuj tego</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.bossNextBtn} onPress={() => { haptic.tap(); setBossIdx((i) => (i + 1) % BOSSES.length); }}>
                  <Text style={s.bossNextTxt}>Następny →</Text>
                </TouchableOpacity>
              </View>
            </View>
            {hasBossOverride && (
              <Text style={s.overrideHint}>Ten boss ma własny, osobno zapamiętany układ (kropka obok nazwy wyżej) — zmiany niżej dotyczą TYLKO jego.</Text>
            )}

            <Text style={s.sectionLabel}>Rozmiar</Text>
            <View style={s.card}>
              <Stepper label="Boss" value={eff.bossSize} onChange={(v) => setPatch({ bossSize: v })} onCommit={pushUndo} min={SIZE_MIN} max={SIZE_MAX} />
            </View>

            <Text style={s.sectionLabel}>Pozycja (X / Y, px)</Text>
            <View style={s.card}>
              <Stepper label="Boss X" value={eff.bossOffsetX} onChange={(v) => setPatch({ bossOffsetX: v })} onCommit={pushUndo} min={-OFFSET_MAX} max={OFFSET_MAX} />
              <Stepper label="Boss Y" value={eff.bossOffsetY} onChange={(v) => setPatch({ bossOffsetY: v })} onCommit={pushUndo} min={-OFFSET_MAX} max={OFFSET_MAX} />
              <Stepper label="Pasek HP Bossa X" value={eff.bossHpOffsetX} onChange={(v) => setPatch({ bossHpOffsetX: v })} onCommit={pushUndo} min={-OFFSET_MAX} max={OFFSET_MAX} />
              <Stepper label="Pasek HP Bossa Y" value={eff.bossHpOffsetY} onChange={(v) => setPatch({ bossHpOffsetY: v })} onCommit={pushUndo} min={-OFFSET_MAX} max={OFFSET_MAX} />
            </View>
          </>
        )}

        {step === STEP_SHADOW && (
          <>
            {/* 2026-09-20, "cienie nie pasują skali" — dotąd JEDEN wspólny ułamek (0.62/0.18)
                rozmiaru portretu dla obu sprite'ów — działa dla bossa (PNG przycięty do
                sylwetki), nie dla kotka (SVG z pustym marginesem, patrz komentarz w
                battleLayoutDraftStore.ts). Niezależna skala X/Y + offsetY per sprite, osobna
                karta na element (§420 — "każdy element osobno"). */}
            <Text style={s.sectionLabel}>Cień — Pupil</Text>
            <View style={s.card}>
              <Stepper label="Szerokość" value={round2(eff.catShadowScaleX)} onChange={(v) => setPatch({ catShadowScaleX: round2(v) })} onCommit={pushUndo} step={SHADOW_SCALE_STEP} min={SHADOW_SCALE_MIN} max={SHADOW_SCALE_MAX} />
              <Stepper label="Wysokość" value={round2(eff.catShadowScaleY)} onChange={(v) => setPatch({ catShadowScaleY: round2(v) })} onCommit={pushUndo} step={SHADOW_SCALE_STEP} min={SHADOW_SCALE_MIN} max={SHADOW_SCALE_MAX} />
              <Stepper label="Pozycja Y" value={eff.catShadowOffsetY} onChange={(v) => setPatch({ catShadowOffsetY: v })} onCommit={pushUndo} min={-SHADOW_OFFSET_MAX} max={SHADOW_OFFSET_MAX} />
            </View>

            <Text style={s.sectionLabel}>Cień — Boss</Text>
            <View style={s.card}>
              <Stepper label="Szerokość" value={round2(eff.bossShadowScaleX)} onChange={(v) => setPatch({ bossShadowScaleX: round2(v) })} onCommit={pushUndo} step={SHADOW_SCALE_STEP} min={SHADOW_SCALE_MIN} max={SHADOW_SCALE_MAX} />
              <Stepper label="Wysokość" value={round2(eff.bossShadowScaleY)} onChange={(v) => setPatch({ bossShadowScaleY: round2(v) })} onCommit={pushUndo} step={SHADOW_SCALE_STEP} min={SHADOW_SCALE_MIN} max={SHADOW_SCALE_MAX} />
              <Stepper label="Pozycja Y" value={eff.bossShadowOffsetY} onChange={(v) => setPatch({ bossShadowOffsetY: v })} onCommit={pushUndo} min={-SHADOW_OFFSET_MAX} max={SHADOW_OFFSET_MAX} />
            </View>
          </>
        )}

        {step === STEP_FLIP && (
          <>
            {/* 2026-10-10, "modyfikacje typu Odbicie lustrzane" */}
            <Text style={s.sectionLabel}>Odbicie lustrzane — Pupil</Text>
            <View style={s.card}>
              <TouchableOpacity style={s.flipRow} onPress={() => { haptic.tap(); pushUndo(); setPatch({ catFlipped: !eff.catFlipped }); }}>
                <FlipHorizontal2 size={15} color={eff.catFlipped ? c.accent.blue : c.text.muted} />
                <Text style={[s.flipLabel, eff.catFlipped && { color: c.accent.blue, fontWeight: '800' }]}>Pupil {eff.catFlipped ? '(odbity)' : ''}</Text>
                <View style={[s.flipSwitch, eff.catFlipped && { backgroundColor: c.accent.blue }]}><View style={[s.flipKnob, eff.catFlipped && { marginLeft: 16 }]} /></View>
              </TouchableOpacity>
            </View>

            <Text style={s.sectionLabel}>Odbicie lustrzane — Boss</Text>
            <View style={s.card}>
              <TouchableOpacity style={s.flipRow} onPress={() => { haptic.tap(); pushUndo(); setPatch({ bossFlipped: !eff.bossFlipped }); }}>
                <FlipHorizontal2 size={15} color={eff.bossFlipped ? c.accent.blue : c.text.muted} />
                <Text style={[s.flipLabel, eff.bossFlipped && { color: c.accent.blue, fontWeight: '800' }]}>Boss {eff.bossFlipped ? '(odbity)' : ''}</Text>
                <View style={[s.flipSwitch, eff.bossFlipped && { backgroundColor: c.accent.blue }]}><View style={[s.flipKnob, eff.bossFlipped && { marginLeft: 16 }]} /></View>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === STEP_EXPORT && (
          <View style={s.exportBox}>
            <Text style={s.exportHint}>
              Zaznacz cały tekst i skopiuj, albo użyj „Udostępnij" — wklej mi to w rozmowie.
              Eksport niesie WSZYSTKO naraz: bazowy układ, każdego osobno dostrojonego bossa
              (`perBoss`) i jasność każdego tła (`perBg`).
            </Text>
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

      {/* ── Nawigacja wizarda ─────────────────────────────────────────────────────────── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + spacing[2] }]}>
        <PressableScale onPress={goBack} disabled={step === 0} style={[s.footerBtn, s.footerBtnGhost]}>
          <Text style={s.footerBtnGhostTxt}>Wstecz</Text>
        </PressableScale>
        {step < STEP_COUNT - 1 ? (
          <PressableScale onPress={goNext} style={[s.footerBtn, s.footerBtnPrimary]}>
            <Text style={s.footerBtnPrimaryTxt}>Dalej</Text>
            <ChevronRight size={16} color={c.bg.primary} />
          </PressableScale>
        ) : (
          <PressableScale onPress={() => { haptic.tap(); router.back(); }} style={[s.footerBtn, s.footerBtnPrimary]}>
            <Text style={s.footerBtnPrimaryTxt}>Zakończ</Text>
          </PressableScale>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: '#fff' },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] },

  // `scene`/`sceneHeight` USUNIĘTE (2026-10-10) — tło areny renderuje się teraz pełnoekranowo,
  // POD tym kontenerem (patrz Image/LinearGradient na górze JSX), `arena` to już tylko zwykły
  // pozycjonujący padding, ten sam co w boss-fight.tsx (`s.arena`).
  arena: { alignItems: 'center', padding: spacing[3] },
  vsRow: { flexDirection: 'row', gap: spacing[2], width: '100%' },
  tile: { flex: 1, minWidth: 0, alignItems: 'center', padding: spacing[2], gap: 6 },
  // `height` NIE tutaj — zawsze nadpisywany inline przez `portraitColHeight` (patrz JSX),
  // dawne sztywne 200 było martwą, mylącą wartością (wygrywa nadpisanie, ale czytelnik mógł
  // pomyśleć że faktycznie się liczy — patrz root cause #7 w ARCHITECTURE.md §173).
  tilePortrait: { width: '100%', justifyContent: 'center', alignItems: 'center' },
  spriteBox: { alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 12.5, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hpBlock: { width: '100%', gap: 4, alignItems: 'center' },
  tileHpTrack: { width: '100%', height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)', overflow: 'hidden' },
  tileHpFill: { height: '100%', borderRadius: 4, backgroundColor: '#EF4444' },
  tileHpTxt: { fontSize: 10, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingBottom: spacing[1] },
  // Białe + text-shadow (nie `c.text.muted`) — ten sam powód co `tileLabel`/`tileHpTxt` tuż
  // wyżej: ten tekst siedzi NAD zdjęciem areny, nie nad kartą tła, więc musi być czytelny
  // niezależnie od jasnego/ciemnego motywu.
  hintTxt: { fontSize: 11, color: '#fff', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  // ── Pasek kroków wizarda (§420) ──────────────────────────────────────────────────────
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing[2], paddingTop: spacing[1] },
  stepDotWrap: { padding: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDotActive: { backgroundColor: '#fff', width: 20 },
  stepDotDone: { backgroundColor: 'rgba(255,255,255,0.65)' },
  stepTitle: { fontSize: 12, fontWeight: '800', color: '#fff', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3, marginBottom: spacing[1] },
  // Element nieaktywny w aktualnym kroku (np. boss podczas kroku "Pupil") — przyciemnienie,
  // NIE wyłączenie interakcji (przeciąganie dalej działa, na wypadek drobnej korekty przy okazji).
  tileDim: { opacity: 0.35 },

  // ── Nawigacja wizarda ─────────────────────────────────────────────────────────────────
  footer: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.lg, paddingVertical: spacing[3] },
  footerBtnGhost: { backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  footerBtnGhostTxt: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
  footerBtnPrimary: { backgroundColor: c.accent.blue, flex: 2 },
  footerBtnPrimaryTxt: { fontSize: 13.5, fontWeight: '800', color: c.bg.primary },

  sectionLabel: { fontSize: 12.5, fontWeight: '800', color: c.text.secondary, marginTop: spacing[1] },
  overrideHint: { fontSize: 11, color: c.accent.blue, marginTop: -spacing[2], lineHeight: 15 },
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

  flipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[1] },
  flipLabel: { flex: 1, fontSize: 12.5, color: c.text.secondary, fontWeight: '600' },
  flipSwitch: { width: 36, height: 20, borderRadius: 10, backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default, padding: 2, justifyContent: 'center' },
  flipKnob: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },

  exportBox: { backgroundColor: c.bg.card, borderRadius: radius.lg, padding: spacing[3], gap: spacing[2], borderWidth: 1, borderColor: c.border.default },
  exportHint: { fontSize: 11, color: c.text.muted, lineHeight: 16 },
  exportText: { fontSize: 11, color: c.text.primary, fontFamily: 'monospace', backgroundColor: c.bg.elevated, borderRadius: radius.md, padding: spacing[2], minHeight: 220 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', paddingVertical: spacing[2], paddingHorizontal: spacing[4], borderRadius: radius.full, borderWidth: 1, borderColor: c.accent.blue + '55' },
  shareBtnTxt: { fontSize: 12, fontWeight: '700', color: c.accent.blue },
}));
