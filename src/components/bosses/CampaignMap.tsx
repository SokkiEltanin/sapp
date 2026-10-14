import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path, Rect, Pattern, Circle, Defs } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Lock, Swords } from 'lucide-react-native';
import BossArt from './BossArt';
import PressableScale from '@/components/ui/PressableScale';
import { Boss, mysteryBossName, fmtEnergyCountdown } from '@/utils/bosses';
import { layoutBossMap } from '@/utils/bossMapLayout';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

// Mapa bossów — PRZEBUDOWA OD ZERA (2026-10-14, user po zrzucie: "zrob caloekranowa te
// mapę... rozmieścić bosy na koordynatach potem polacz sciezkami po kolei jak w dragon mania
// legends... teraz duplikujesz mapę wielokrotnie i ma scrolla dziwnie... chodziło o
// przebudowę całej zakładki bossów od zera"). Poprzednia wersja (jeden pionowy ScrollView,
// węzły kołysane sinusoidą TYLKO w poziomie, Y rosnące liniowo z indeksem) dawała okresowo
// powtarzający się kształt — stąd wrażenie "duplikowania się" mapy. Ta wersja:
// 1. PRAWDZIWA mapa 2D — węzły rozmieszczone proceduralnym spacerem (`layoutBossMap`,
//    bossMapLayout.ts) łamiącym kierunek w KAŻDĄ stronę (nie tylko X), więc trasa realnie
//    wije się po płaszczyźnie, nie powtarza okresowego wzoru.
// 2. Swobodne przesuwanie + pinch-zoom (`Gesture.Pan`+`Gesture.Pinch`, react-native-gesture-
//    handler — już w projekcie, ten sam "nowy" `Gesture`/`GestureDetector` styl co
//    `(tabs)/_layout.tsx`/`DashEditRow.tsx`/`MoodEnergyGrid.tsx`, nie legacy
//    Pan/PinchGestureHandler) zamiast samego pionowego scrolla.
// 3. Kamera "wskakuje" (jump, NIE animowany scroll) na aktualnego bossa przy pierwszym
//    zmierzeniu viewportu (`onLayout`) — eliminuje CAŁĄ klasę wyścigów czasowych, które
//    psuły starą wersję (setTimeout(0) kontra natywny layout ScrollView).
// 4. "Mgła" przeprojektowana pod 2D — stary gradient działał tylko bo trasa była ściśle
//    pionowa (można było "zasłonić wszystko poniżej Y"). W prawdziwym 2D nie ma jednego
//    "poniżej" — fog realizowany teraz PER-SEGMENT ścieżki (nieodkryty odcinek rysowany
//    prawie czarnym, ledwo widocznym kolorem zamiast jasnego akcentu) + per-węzeł (locked =
//    czarna sylwetka + kłódka, już istniało, zostaje).
const NODE = 60;
const POPUP_W = 248;
const MIN_SCALE = 0.35;
const MAX_SCALE = 1.8;
const GRID = 56;

type Popup = { kind: 'current' | 'defeated'; boss: Boss };

// `defeatedIds` nie jest tu potrzebne osobno — kampania leci ŚCIŚLE sekwencyjnie (patrz
// `current = BOSSES.find(b => !defeatedBosses.includes(b.id))` w bosses.tsx), więc "pokonany"
// ⟺ "indeks < currentIdx" w TEJ SAMEJ tablicy `bosses`. `variant`/`locked`/`lockMessage` —
// patrz komentarz w bosses.tsx przy wywołaniu z `variant="mad"`: ten sam komponent obsługuje
// kampanię i MAD (identyczna sekwencyjna logika), tylko inny kolor ścieżki/aury i ew. blokada
// poziomu w popupie aktualnego celu.
function CampaignMap({ bosses, currentId, onPressCurrent, energy, energyMax, energyRegenAt, variant = 'campaign', locked, lockMessage }: {
  bosses: Boss[]; currentId: string | null; onPressCurrent: () => void;
  energy?: number; energyMax?: number; energyRegenAt?: string | null;
  variant?: 'campaign' | 'mad'; locked?: boolean; lockMessage?: string;
}) {
  const isMad = variant === 'mad';
  const c = useColors();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const currentIdx = currentId ? bosses.findIndex(b => b.id === currentId) : bosses.length;
  const { nodes, width: canvasW, height: canvasH } = useMemo(() => layoutBossMap(bosses.length), [bosses.length]);
  const litColor = isMad ? '#EF4444' : '#38BDF8';

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  // Kamera wskakuje na aktualnego bossa — user: "domyślnie popakuje sie pozycja bosa
  // aktualnego do pokonania". `onLayout` (nie efekt+Dimensions) bo musi znać REALNY, zmierzony
  // rozmiar TEGO konkretnego kontenera (zależny od layoutu ekranu-rodzica, nie całego okna).
  //
  // BUG #2 (user, 2026-10-14, po PR #424, zrzut: "boss nie sa w dobrym miejscu linią jest
  // zła... aktualny boss wgle jest nie widoczny i nie mogę z nim zawalczyć") — TO NIE był ten
  // sam bug co w PR #424 (tamten — brak przycinania do granic płótna — jest naprawiony,
  // przycinanie niżej zostaje bez zmian). Prawdziwa przyczyna: centrowanie było jednorazowe
  // (`centered.current` ustawiane raz na zawsze), odpalane przy PIERWSZYM `onLayout`. Ale
  // `defeatedBosses` (petStore, `persist`+AsyncStorage, patrz `_hydrated` w petStore.ts) ładuje
  // się ASYNCHRONICZNIE — pierwszy `onLayout` tego ekranu często odpala się ZANIM store się
  // zrehydrował, czyli z DOMYŚLNYM `defeatedBosses=[]` → `current`/`currentId` w bosses.tsx w
  // tym momencie to BOSSES[0], nie prawdziwy aktualny boss gracza. Kamera centrowała się raz
  // na boss #0 i WIĘCEJ SIĘ NIE PRZESUWAŁA, nawet gdy chwilę później store się zrehydrował i
  // `currentId` zmienił się na prawdziwego bossa — stąd "losowy", niepowiązany z realnym
  // postępem fragment mapy, prawdziwy aktualny boss poza ekranem, a "chaos" to po prostu
  // pomieszane pokonane/zablokowane węzły widziane w oderwaniu od kontekstu trasy.
  //
  // Naprawa: zamiast jednorazowego flaga, pamiętamy NA KTÓRE `currentId` kamera jest aktualnie
  // wyśrodkowana (`centeredOn`) i re-centrujemy za każdym razem gdy `currentId` się ZMIENI
  // (efekt niżej) — czy to po hydratacji store'u, czy po pokonaniu bossa i powrocie na mapę.
  // Ręczne przesunięcie/zoom gracza NIE jest nadpisywane, dopóki `currentId` się nie zmieni.
  const centeredOn = useRef<string | null | undefined>(undefined);
  const recenter = useCallback((width: number, height: number) => {
    if (!width || !height || nodes.length === 0) return;
    const idx = Math.max(0, Math.min(currentIdx, nodes.length - 1));
    const node = nodes[idx];
    const s = scale.value;
    const minTX = Math.min(0, width - canvasW * s);
    const maxTX = Math.max(0, width - canvasW * s);
    const minTY = Math.min(0, height - canvasH * s);
    const maxTY = Math.max(0, height - canvasH * s);
    let tx = width / 2 - node.x * s;
    let ty = height / 2 - node.y * s;
    if (tx < minTX) tx = minTX; else if (tx > maxTX) tx = maxTX;
    if (ty < minTY) ty = minTY; else if (ty > maxTY) ty = maxTY;
    translateX.value = tx;
    translateY.value = ty;
    startX.value = tx;
    startY.value = ty;
  }, [nodes, currentIdx, canvasW, canvasH, scale, translateX, translateY, startX, startY]);

  const onLayoutViewport = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
  };

  useEffect(() => {
    if (centeredOn.current === currentId) return;
    if (!viewport.w || !viewport.h) return;
    centeredOn.current = currentId;
    recenter(viewport.w, viewport.h);
  }, [currentId, viewport.w, viewport.h, recenter]);

  const pan = Gesture.Pan()
    .minDistance(4)
    .onUpdate((e) => {
      'worklet';
      const s = scale.value;
      const minTX = Math.min(0, viewport.w - canvasW * s);
      const maxTX = Math.max(0, viewport.w - canvasW * s);
      const minTY = Math.min(0, viewport.h - canvasH * s);
      const maxTY = Math.max(0, viewport.h - canvasH * s);
      let nx = startX.value + e.translationX;
      let ny = startY.value + e.translationY;
      if (nx < minTX) nx = minTX; else if (nx > maxTX) nx = maxTX;
      if (ny < minTY) ny = minTY; else if (ny > maxTY) ny = maxTY;
      translateX.value = nx;
      translateY.value = ny;
    })
    .onEnd(() => {
      'worklet';
      startX.value = translateX.value;
      startY.value = translateY.value;
    });

  // BUG (druga część tego samego zgłoszenia): bez przeliczania translate przy zoomie, pinch
  // zmieniał tylko `scale` wokół domyślnego pivotu RN — czyli ŚRODKA WŁASNEGO BOUNDING-BOXU
  // widoku (RN nie ma `transform-origin:0 0` domyślnie), co jest NIEZGODNE z matematyką
  // przycinania powyżej (ona zakłada origin w (0,0) płótna). Efekt: po zoomie przycięte
  // granice i realnie renderowany obraz się rozjeżdżały — stąd też czarne pasy, nie tylko z
  // centrowania. Naprawa dwuczęściowa: (1) `transformOrigin:'0 0'` na `canvasStyle` niżej —
  // teraz origin matematyki i renderu się zgadzają; (2) tu — przy zoomie przeliczamy
  // translate tak, by punkt płótna leżący pod ŚRODKIEM VIEWPORTU (prostszy, bezpieczny wybór
  // niż dynamiczny focal point dwóch palców) został wizualnie na miejscu, a wynik i tak
  // przycinamy tą samą formułą co pan/initial-center.
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      let s = startScale.value * e.scale;
      if (s < MIN_SCALE) s = MIN_SCALE; else if (s > MAX_SCALE) s = MAX_SCALE;
      const ratio = s / startScale.value;
      const cx = viewport.w / 2;
      const cy = viewport.h / 2;
      let nx = cx - (cx - startX.value) * ratio;
      let ny = cy - (cy - startY.value) * ratio;
      const minTX = Math.min(0, viewport.w - canvasW * s);
      const maxTX = Math.max(0, viewport.w - canvasW * s);
      const minTY = Math.min(0, viewport.h - canvasH * s);
      const maxTY = Math.max(0, viewport.h - canvasH * s);
      if (nx < minTX) nx = minTX; else if (nx > maxTX) nx = maxTX;
      if (ny < minTY) ny = minTY; else if (ny > maxTY) ny = maxTY;
      scale.value = s;
      translateX.value = nx;
      translateY.value = ny;
    })
    .onEnd(() => {
      'worklet';
      startScale.value = scale.value;
      startX.value = translateX.value;
      startY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    transformOrigin: '0 0',
  }));

  // Pełna trasa — zawsze rysowana prawie czarnym, ledwo widocznym kolorem ("mgła" — user:
  // "te Ścieżki dalej mają byc czarno mgła zasłonięte"), + osobny, krótszy odcinek TYLKO do
  // aktualnego węzła w jaskrawym kolorze akcentu NA WIERZCHU ("odkryta" część trasy.
  const fullPathD = useMemo(() => (
    nodes.length < 2 ? '' : nodes.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x} ${n.y}`).join(' ')
  ), [nodes]);
  const litEnd = Math.min(currentIdx, nodes.length - 1);
  const litPathD = useMemo(() => (
    litEnd < 1 ? '' : nodes.slice(0, litEnd + 1).map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x} ${n.y}`).join(' ')
  ), [nodes, litEnd]);

  if (bosses.length === 0) return null;

  const popupLeft = viewport.w ? (viewport.w - POPUP_W) / 2 : 0;
  const popupTop = viewport.h ? viewport.h / 2 - 140 : 0;

  return (
    <View style={st.wrap} onLayout={onLayoutViewport}>
      <GestureDetector gesture={composed}>
        <Reanimated.View style={[{ width: canvasW, height: canvasH }, canvasStyle]}>
          {/* Tło WEKTOROWE, nie zdjęcie (user: "laguje... zrób wektorem, żeby nie lagowało").
              Poprzednio: `Image` 3000×2000 JPG z `resizeMode="repeat"` kafelkowane na całym
              płótnie — Android musi to tile'ować/rasteryzować na nowo przy KAŻDEJ zmianie
              scale/translate z gestu (60fps podczas pan/pinch), bo kafelkowanie bitmapy pod
              transformem nie jest darmowe jak proste skalowanie jednej warstwy. Siatka punktów
              w tym samym `Svg` co ścieżka to czysta wektorowa geometria — silnik rysuje ją
              razem z resztą mapy jedną warstwą, skalowanie/przesuwanie to tylko transform GPU,
              bez re-rasteryzacji zawartości. */}
          <Svg width={canvasW} height={canvasH} style={StyleSheet.absoluteFillObject}>
            <Defs>
              <Pattern id="mapGrid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <Circle cx={GRID / 2} cy={GRID / 2} r={1.6} fill="rgba(255,255,255,0.08)" />
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width={canvasW} height={canvasH} fill={isMad ? '#1E0A0C' : '#0B0E14'} />
            <Rect x={0} y={0} width={canvasW} height={canvasH} fill="url(#mapGrid)" />
            {!!fullPathD && <Path d={fullPathD} stroke="rgba(4,5,8,0.9)" strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {!!litPathD && <Path d={litPathD} stroke={litColor} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </Svg>

          {/* MAD: scrim lekko czerwony zamiast neutralnie-ciemnego (user: "mapa zmienia kolor
              na lekko czerwony"). Zostaje jako `LinearGradient` — to prosty 2-kolorowy
              gradient na całej warstwie, nie kafelkowana bitmapa, więc nie jest tu źródłem
              laga. */}
          <LinearGradient
            pointerEvents="none"
            colors={(isMad
              ? ['rgba(40,8,10,0.25)', 'rgba(40,8,10,0.4)', 'rgba(40,8,10,0.55)']
              : ['rgba(8,10,16,0.25)', 'rgba(8,10,16,0.4)', 'rgba(8,10,16,0.55)']) as [string, string, string]}
            style={StyleSheet.absoluteFillObject}
          />

          {bosses.map((b, i) => {
            const isDefeated = i < currentIdx;
            const isCurrent = i === currentIdx;
            const isLocked = i > currentIdx;
            const n = nodes[i];
            const x = n.x - NODE / 2;
            const y = n.y - NODE / 2;
            const node = (
              <View style={[st.node, { left: x, top: y }]}>
                <View style={st.portrait}>
                  {isCurrent && <View style={[st.currentRing, { borderColor: litColor }]} pointerEvents="none" />}
                  <BossArt id={b.id} emoji={b.emoji} size={NODE} mystery={isLocked} powered={isMad && !isLocked} />
                  {isDefeated && (
                    <View style={st.defeatedOverlay} pointerEvents="none">
                      <X size={NODE * 0.62} color="rgba(0,0,0,0.82)" strokeWidth={3.5} />
                    </View>
                  )}
                </View>
                {isLocked && <View style={st.badgeLock}><Lock size={10} color="rgba(255,255,255,0.75)" /></View>}
                <Text style={[st.nodeLabel, { color: isLocked ? c.text.muted : '#fff' }, isDefeated && { color: 'rgba(255,255,255,0.5)' }]} numberOfLines={1}>
                  {isLocked ? mysteryBossName(b.id) : b.name}
                </Text>
              </View>
            );
            if (isCurrent || isDefeated) {
              return (
                <PressableScale
                  key={b.id}
                  onPress={() => { haptic.tap(); setPopup({ kind: isCurrent ? 'current' : 'defeated', boss: b }); }}
                  style={[st.nodeTouch, { left: x, top: y }]}
                >
                  {node}
                </PressableScale>
              );
            }
            return <View key={b.id}>{node}</View>;
          })}
        </Reanimated.View>
      </GestureDetector>

      {popup && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable style={st.popupBackdrop} onPress={() => setPopup(null)} />
          <View style={[st.popup, { left: popupLeft, top: popupTop, width: POPUP_W }]}>
            <View style={{ alignItems: 'center' }}>
              <BossArt id={popup.boss.id} emoji={popup.boss.emoji} size={popup.kind === 'current' ? 88 : 60} mystery={false} powered={isMad} />
            </View>
            {isMad && <Text style={st.popupMadKicker}>OSZALAŁY WARIANT</Text>}
            <Text style={st.popupName}>{popup.boss.name}</Text>
            {popup.kind === 'current' ? (
              <>
                <Text style={st.popupTaunt} numberOfLines={2}>„{popup.boss.taunt}"</Text>
                <Text style={st.popupHp}>{popup.boss.hp} HP · <Text style={{ color: '#2AC68F', fontWeight: '800' }}>{popup.boss.weaknessLabel}</Text></Text>
                {locked ? (
                  <View style={st.popupLockBox}>
                    <Lock size={13} color="rgba(255,255,255,0.6)" />
                    <Text style={st.popupLockTxt}>{lockMessage}</Text>
                  </View>
                ) : (
                  <>
                    {energy != null && energyMax != null && energy < energyMax && energyRegenAt && (
                      <Text style={st.popupEnergyHint}>Kolejna energia za {fmtEnergyCountdown(energyRegenAt)}</Text>
                    )}
                    <PressableScale onPress={() => { haptic.tap(); setPopup(null); onPressCurrent(); }} style={{ width: '100%', marginTop: spacing[2] }}>
                      <View style={[st.attackBtn, energy != null && energy <= 0 && { opacity: 0.5 }]}>
                        <Swords size={15} color="#fff" />
                        <Text style={st.attackTxt}>WALCZ!</Text>
                      </View>
                    </PressableScale>
                  </>
                )}
              </>
            ) : (
              // MAD pokonany daje coiny+XP (patrz boss-fight.tsx `victory.kind === 'mad'`), NIE
              // przedmiot loot jak kampania — `madBossFor` dziedziczy pole `loot` z bazowego
              // bossa, ale ono nie jest tym co realnie przyznaje walka z MAD.
              <Text style={st.popupDoneTxt}>
                {isMad ? `Pokonany ✓ · +${popup.boss.xp} XP` : `Pokonany ✓ · ${popup.boss.loot.name}`}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#05060A' },
  nodeTouch: { position: 'absolute', width: NODE, alignItems: 'center' },
  node: { position: 'absolute', width: NODE, alignItems: 'center' },
  portrait: { width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' },
  currentRing: {
    position: 'absolute', left: -7, top: -7, width: NODE + 14, height: NODE + 14,
    borderRadius: (NODE + 14) / 2, borderWidth: 2.5,
  },
  defeatedOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  badgeLock: {
    position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  nodeLabel: { fontSize: 10, fontWeight: '800', textAlign: 'center', marginTop: 4, width: NODE + 32, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  popupBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  popup: {
    position: 'absolute', backgroundColor: '#161A1A', borderRadius: radius.lg, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)', padding: spacing[4], gap: 3,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  popupMadKicker: { fontSize: 9.5, fontWeight: '900', color: '#DC2626', letterSpacing: 1, textAlign: 'center', marginTop: 4 },
  popupName: { fontSize: 15, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: 4 },
  popupTaunt: { fontSize: 11.5, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', textAlign: 'center' },
  popupHp: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 2 },
  popupEnergyHint: { fontSize: 10.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 2 },
  popupDoneTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  popupLockBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2] },
  popupLockTxt: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 15 },
  attackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EF4444', borderRadius: radius.md, paddingVertical: 12 },
  attackTxt: { fontSize: 14, fontWeight: '900', color: '#fff' },
});

// memo: ekran-rodzic (bosses.tsx) re-renderuje się często (odliczanie energii) — props tego
// komponentu (bosses/currentId/onPressCurrent/energy*) zmieniają się tylko gdy REALNY postęp
// kampanii lub pula energii się zmienia, nie co tyknięcie zegara, więc memo faktycznie coś
// daje — POD WARUNKIEM że `onPressCurrent` jest stabilne (`useCallback` w bosses.tsx) i
// `bosses` ma stabilną referencję w trybie MAD (`useMemo` tam) — inaczej nowe closure/tablica
// na każdy render i tak łamałoby porównanie propsów.
export default memo(CampaignMap);
