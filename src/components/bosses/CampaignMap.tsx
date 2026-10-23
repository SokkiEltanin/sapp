import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect, Pattern, Circle, Defs } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Lock, Swords } from 'lucide-react-native';
import BossArt from './BossArt';
import PressableScale from '@/components/ui/PressableScale';
import { Boss, mysteryBossName, fmtEnergyCountdown } from '@/utils/bosses';
import { baseBossId } from '@/utils/madBosses';
import { layoutBossMap, applyLaneOverrides, catmullRomPath, centerScrollY } from '@/utils/bossMapLayout';
import { useBossMapLayoutStore } from '@/store/bossMapLayoutStore';
import { useCampaignMapStyleStore, CampaignMapStyle } from '@/store/campaignMapStyleStore';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

// Mapa bossów — PRZEBUDOWA OD ZERA #2 (2026-10-14). Pierwsza przebudowa (PR #419-#426, ten sam
// plik: pełnoekranowa, swobodny pan+pinch-zoom na losowym 2D spacerze) przeszła CZTERY rundy
// poprawek (klamrowanie kamery, pivot zoomu, wyścig z hydratacją store'u) i user DALEJ zgłaszał
// złamaną mapę ("boss niektóre sa porozrzucane zle... nie widać zupełnie tego aktualnego...
// linią wgle przerwa sie kolorem... przybliżenie słabo działa... Możesz zrobic to nawet od
// zera???"). Każda pojedyncza poprawka była matematycznie poprawna dla sprawdzonego scenariusza
// (zweryfikowane bezpośrednim odpaleniem kodu w jest, nie zgadywaniem) — ale CAŁY system
// (losowy spacer 2D + ręczna matematyka kamery/klamrowania/pivotu na współdzielonych shared
// values) miał za dużo ruchomych części naraz, żeby debugować na ślepo, bez dostępu do
// urządzenia, w nieskończoność. Zamiast kolejnej łatki na tę samą architekturę:
//
// 1. **Layout** (`bossMapLayout.ts`) — zamiast losowego spaceru w DOWOLNYM kierunku (mógł się
//    teoretycznie zapętlić na siebie), nowy układ to wąski zygzak PO TORACH: X ograniczony do
//    stałej szerokości ekranu, Y ŚCIŚLE rośnie z indeksem — MATEMATYCZNIE wykluczone
//    samoprzecięcia, niezależnie od rosteru/seeda (dowód: test w bossMapLayout.test.ts).
// 2. **Kamera** — zwykły, natywny pionowy `ScrollView` zamiast własnej matematyki
//    translateX/Y/scale na Reanimated shared values. "Wskakiwanie" na aktualnego bossa to
//    jedno wywołanie `scrollTo({y, animated:false})` — RN SAM przycina do granic treści,
//    więc CAŁA klasa bugów klamrowania/pivotu z poprzedniej wersji nie istnieje strukturalnie,
//    nie tylko "jest załatana". Swobodny pan w poziomie i pinch-zoom (user pierwotnie
//    potwierdził AskUserQuestion) są tu ŚWIADOMIE wycięte — RN `ScrollView` wspiera naturalny
//    pinch-zoom TYLKO na iOS (`@platform ios` w źródle RN), więc odtworzenie go na Androidzie
//    wymagałoby z powrotem własnej matematyki gestów, czyli dokładnie tego samego źródła
//    bugów od nowa. Kompromis uczciwie przyjęty na rzecz mapy która DZIAŁA, zamiast efektownej
//    która nie działa czwarty raz z rzędu.
// 3. **Tło/mgła/popup/węzły** — bez zmian względem poprzedniej wersji (to NIE było źródłem
//    zgłoszonych problemów, zweryfikowane przez bezpośrednie odpalenie layoutu w testach).
// `BASE_NODE` — domyślny rozmiar węzła, używany TYLKO jako baza w statycznym `st` niżej
// (StyleSheet.create poza komponentem, nie może reagować na store). Realny, aktualny rozmiar
// to `mapStyle.nodeSize` (§332) — komponent ma WŁASNĄ, przesłaniającą stałą `NODE` w swoim
// zakresie (patrz niżej), a wszystkie rozmiary zależne od niej w `st` są nadpisywane inline.
const BASE_NODE = 60;
const POPUP_W = 248;
const GRID = 56;

type Popup = { kind: 'current' | 'defeated'; boss: Boss };

// `defeatedIds` nie jest tu potrzebne osobno — kampania leci ŚCIŚLE sekwencyjnie (patrz
// `current = BOSSES.find(b => !defeatedBosses.includes(b.id))` w bosses.tsx), więc "pokonany"
// ⟺ "indeks < currentIdx" w TEJ SAMEJ tablicy `bosses`. `variant`/`locked`/`lockMessage` —
// patrz komentarz w bosses.tsx przy wywołaniu z `variant="mad"`: ten sam komponent obsługuje
// kampanię i MAD (identyczna sekwencyjna logika), tylko inny kolor ścieżki/aury i ew. blokada
// poziomu w popupie aktualnego celu.
// `styleOverride` (2026-10-15, Kreator ekranów Faza 6, §332) — ten sam wzorzec co dashboard
// (§327): bez override karta czyta `live` ze store'a, kreator (`app/campaign-map-creator.tsx`)
// podaje `draft`.
function CampaignMap({ bosses, currentId, onPressCurrent, energy, energyMax, energyRegenAt, variant = 'campaign', locked, lockMessage, styleOverride }: {
  bosses: Boss[]; currentId: string | null; onPressCurrent: () => void;
  energy?: number; energyMax?: number; energyRegenAt?: string | null;
  variant?: 'campaign' | 'mad'; locked?: boolean; lockMessage?: string; styleOverride?: CampaignMapStyle;
}) {
  const isMad = variant === 'mad';
  const c = useColors();
  const liveMapStyle = useCampaignMapStyleStore(st => st.live);
  const mapStyle = styleOverride ?? liveMapStyle;
  const NODE = mapStyle.nodeSize;
  const [popup, setPopup] = useState<Popup | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const scrollRef = useRef<ScrollView>(null);

  const currentIdx = currentId ? bosses.findIndex(b => b.id === currentId) : bosses.length;
  // Edytor mapy (2026-10-14, ARCHITECTURE.md §322, PRZEBUDOWANY OD ZERA w §412) — nadpisanie
  // toru NADPISUJE X proceduralnego zygzaka dla danego bossa, Y jest ZAWSZE proceduralne (patrz
  // `applyLaneOverrides` w bossMapLayout.ts). Kluczowane BAZOWYM id (`baseBossId`) — TEN SAM
  // fizyczny układ obowiązuje kampanię i MAD (mapy się nie dubluje per wariant).
  const laneOverrides = useBossMapLayoutStore(st => st.lanes);
  // Bramka hydratacji (2026-10-23, §413, user zrzutem: "mapa dalej rozjechana mimo że dobrze
  // ustawiona w edytorze... może ty zmieniasz edytor nie tę mapę") — `lanes` czyta się jako
  // `{}` (pusty, domyślny stan) PRZED tym jak store wczyta się z dysku. Edytor otwiera się
  // PÓŹNIEJ w nawigacji (więcej czasu minęło = hydratacja prawie zawsze już skończona), więc
  // pokazywał prawdziwe tory — pierwszy render TEJ mapy (często pierwszy ekran po starcie
  // appki) czasem łapał moment z jeszcze PUSTYMI nadpisaniami, renderując czysto proceduralny
  // układ zamiast realnie zapisanego. Dopóki `!lanesHydrated`, komponent czeka (ten sam wzorzec
  // co gate na `viewport.w/h` niżej) zamiast pokazać mapę która zaraz "skoczy" pod userem.
  const lanesHydrated = useBossMapLayoutStore(st => st._hydrated);
  // Szerokość płótna = ZMIERZONA szerokość viewportu (nie stała) — gwarantuje że zygzak
  // zawsze dokładnie mieści się na ekranie, na KAŻDYM rozmiarze telefonu, bez poziomego
  // przycinania/scrolla. Dopóki viewport nie jest jeszcze zmierzony, 340 to bezpieczny
  // placeholder (pierwszy render i tak zaraz dostanie realny onLayout).
  const { nodes, width: canvasW, height: canvasH } = useMemo(() => {
    const base = layoutBossMap(bosses.length, viewport.w || 340);
    const ids = bosses.map(b => baseBossId(b.id));
    return applyLaneOverrides(base.nodes, ids, laneOverrides, base.width);
  }, [bosses, viewport.w, laneOverrides]);
  const litColor = isMad ? '#EF4444' : '#38BDF8';

  const onLayoutViewport = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
  };

  // Kamera na aktualnym bossie — user: "domyślnie popakuje sie pozycja bosa aktualnego do
  // pokonania". BUG #6 (2026-10-16, user: "wgle nie da się klikać w nich teraz... nie widzę
  // zupełnie bossa aktualnego albo się nie renderuje albo jest poza ekranem (jak część bosów
  // ucina)") — dotyk DZIAŁAŁ (haptic/scale się odpalały), problem był wyłącznie w tym GDZIE
  // kamera wylądowała. BUG #4/#5 (historia niżej w komentarzach usuniętych stąd, patrz git
  // blame) próbowały naprawić to serią odroczonych powtórzeń imperatywnego
  // `scrollTo({animated:false})` (0/60/250/600ms) — ZAŁOŻENIE: jeden z powtórzeń trafi w
  // moment, gdy natywny scroll-responder jest już podłączony. To wciąż WYŚCIG, nie naprawa:
  // na wolniejszym urządzeniu/dłuższej animacji przejścia ekranu WSZYSTKIE powtórzenia mogą
  // wylądować przed podłączeniem responder'a i zostać po cichu zgubione (bez błędu) —
  // kamera zostaje na pozycji (0,0), czyli widać tylko najwcześniejsze (dawno pokonane) węzły,
  // a aktualny — zwykle dalej na liście — jest całkowicie poza widokiem. Dokładnie zgłoszony
  // objaw.
  //
  // Naprawa strukturalna, nie kolejna łatka czasowa: `contentOffset` na `ScrollView` ustawia
  // pozycję scrolla PRZY MONTAŻU, na poziomie natywnym — nie ma tu ŻADNEGO wyścigu z animacją
  // przejścia, bo wartość jest częścią tworzenia widoku, nie komendą wysyłaną PO fakcie.
  // `key={viewport.w x viewport.h}` wymusza REMOUNT (nie tylko update propu — `contentOffset`
  // czytany jest tylko przy montażu, update na żywym ScrollView nic by nie zrobił) gdy
  // zmierzony rozmiar faktycznie się zmieni — to jest naprawa TEJ SAMEJ klasy problemu co
  // BUG #4 (RN/Android dostarcza `onLayout` wielokrotnie przy starcie, pierwszy przebieg bywa
  // tymczasowy), ale bez ręcznego strażnika do pomylenia: każdy NOWY rozmiar dostaje świeży,
  // poprawnie wycelowany montaż.
  const idxForCenter = currentId ? currentIdx : nodes.length - 1;
  const targetY = centerScrollY(nodes, idxForCenter, viewport.h);

  // Dla zmiany `currentId` PO TYM jak ekran jest już zamontowany i widoczny (np. wygrana walka,
  // powrót na mapę) — tu nie ma wyścigu z animacją przejścia (ekran już stoi), więc zwykły
  // animowany `scrollTo` jest bezpieczny i daje ładny, widoczny ruch kamery do nowego celu.
  const mountedCurrentId = useRef(currentId);
  useEffect(() => {
    if (mountedCurrentId.current === currentId) return;
    mountedCurrentId.current = currentId;
    if (!viewport.h || nodes.length === 0) return;
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [currentId]);

  // Pełna trasa — zawsze rysowana prawie czarnym, ledwo widocznym kolorem ("mgła" — user:
  // "te Ścieżki dalej mają byc czarno mgła zasłonięte"), + osobny, krótszy odcinek TYLKO do
  // aktualnego węzła w jaskrawym kolorze akcentu NA WIERZCHU ("odkryta" część trasy). Krzywa
  // Catmull-Rom (`catmullRomPath`, §322) zamiast łamanych odcinków prosto-w-prosto — user:
  // "ścieżka połączy się sama z jakąś tam modyfikacją smooth" — ta sama funkcja co w edytorze
  // mapy, więc podgląd w edytorze i realny render się zgadzają.
  const fullPathD = useMemo(() => catmullRomPath(nodes), [nodes]);
  const litEnd = Math.min(currentIdx, nodes.length - 1);
  const litPathD = useMemo(() => (litEnd < 1 ? '' : catmullRomPath(nodes.slice(0, litEnd + 1))), [nodes, litEnd]);

  if (bosses.length === 0) return null;

  const popupLeft = viewport.w ? (viewport.w - POPUP_W) / 2 : 0;
  const popupTop = viewport.h ? viewport.h / 2 - 140 : 0;

  return (
    <View style={st.wrap} onLayout={onLayoutViewport}>
      {/* `viewport.w/h` dopiero po pierwszym `onLayout` — jeden pominięty frame (samo tło
          `wrap`, bez treści) jest tańszy i bezpieczniejszy niż montowanie ScrollView z
          `contentOffset` liczonym z zerowego viewportu, które i tak trzeba by było potem
          poprawiać. `key` wymusza remount (nie sam update propu — `contentOffset` RN czyta
          TYLKO przy montażu) gdy zmierzony rozmiar się zmieni, patrz komentarz przy BUG #6
          wyżej. */}
      {viewport.w > 0 && viewport.h > 0 && lanesHydrated && (
      <ScrollView
        key={`${viewport.w}x${viewport.h}`}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ width: canvasW, height: canvasH }}
        contentOffset={{ x: 0, y: targetY }}
      >
        {/* Tło WEKTOROWE (user: "laguje... zrób wektorem, żeby nie lagowało") — siatka
            punktów w tym samym `Svg` co ścieżka, czysta geometria, bez kosztownej
            re-rasteryzacji bitmapy pod transformem (stary bug z Image+resizeMode="repeat"). */}
        <Svg width={canvasW} height={canvasH} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <Pattern id="mapGrid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <Circle cx={GRID / 2} cy={GRID / 2} r={1.6} fill={`rgba(255,255,255,${mapStyle.gridOpacity})`} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={canvasW} height={canvasH} fill={isMad ? '#1E0A0C' : '#0B0E14'} />
          <Rect x={0} y={0} width={canvasW} height={canvasH} fill="url(#mapGrid)" />
          {/* `key={fullPathD}`/`key={litPathD}` (§403, user zrzutem: "mapa kampanii rozjechana
              względem tego jak ustawiłem... bossy rozjechane od tej linii wgle nie tak jak
              trzeba mimo że w edytorze wszystko pięknie") — węzły (`View`, zwykłe RN-owe
              `left`/`top`) i ścieżka (`<Path d=...>`, native-SVG prop) pochodzą z DOKŁADNIE
              TEJ SAMEJ tablicy `nodes` w TYM SAMYM renderze (patrz `n = nodes[i]` niżej) —
              więc jeśli węzły i linia wizualnie się rozjeżdżają mimo to, jedyne logiczne
              wytłumaczenie to natywna nie-aktualizacja samego `<Path>` (`d` prop na Androidzie
              bywa "sklejony" po pierwszym montażu, ten sam problem klasy co udokumentowane w
              CLAUDE.md "SVG-propy stutterują" i ten sam fix co `key` na `ScrollView` wyżej w
              tym pliku) — np. po asynchronicznej hydratacji `bossMapLayoutStore` (nadpisania
              pozycji z edytora wczytują się PO pierwszym montażu). `key` na stringu `d`
              wymusza REMOUNT świeżego natywnego węzła Path zamiast update-w-miejscu za każdym
              razem, gdy geometria faktycznie się zmienia — gwarancja zgodności z węzłami
              kosztem rzadkiego remountu taniego elementu (ścieżka zmienia się tylko przy
              zmianie rosteru/nadpisań/rozmiaru viewportu, nie co klatkę). */}
          {!!fullPathD && <Path key={fullPathD} d={fullPathD} stroke="rgba(4,5,8,0.9)" strokeWidth={mapStyle.pathWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          {!!litPathD && <Path key={litPathD} d={litPathD} stroke={litColor} strokeWidth={mapStyle.pathWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </Svg>

        {/* MAD: scrim lekko czerwony zamiast neutralnie-ciemnego. */}
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
          const ringSize = NODE + 14;
          const node = (
            <View style={[st.node, { left: x, top: y, width: NODE }]}>
              <View style={[st.portrait, { width: NODE, height: NODE }]}>
                {isCurrent && (
                  <View
                    style={[st.currentRing, {
                      borderColor: litColor, borderWidth: mapStyle.ringWidth,
                      width: ringSize, height: ringSize, borderRadius: ringSize / 2,
                    }]}
                    pointerEvents="none"
                  />
                )}
                <BossArt id={b.id} emoji={b.emoji} size={NODE} mystery={isLocked} powered={isMad && !isLocked} />
                {isDefeated && (
                  <View style={st.defeatedOverlay} pointerEvents="none">
                    <X size={NODE * 0.62} color="rgba(0,0,0,0.82)" strokeWidth={3.5} />
                  </View>
                )}
              </View>
              {isLocked && <View style={st.badgeLock}><Lock size={10} color="rgba(255,255,255,0.75)" /></View>}
              <Text style={[st.nodeLabel, { width: NODE + 32, color: isLocked ? c.text.muted : '#fff' }, isDefeated && { color: 'rgba(255,255,255,0.5)' }]} numberOfLines={1}>
                {isLocked ? mysteryBossName(b.id) : b.name}
              </Text>
            </View>
          );
          if (isCurrent || isDefeated) {
            return (
              <PressableScale
                key={b.id}
                onPress={() => { haptic.tap(); setPopup({ kind: isCurrent ? 'current' : 'defeated', boss: b }); }}
                style={[st.nodeTouch, { left: x, top: y, width: NODE }]}
              >
                {node}
              </PressableScale>
            );
          }
          return <View key={b.id}>{node}</View>;
        })}
      </ScrollView>
      )}

      {popup && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable style={st.popupBackdrop} onPress={() => setPopup(null)} />
          <View style={[st.popup, { left: popupLeft, top: popupTop, width: POPUP_W, borderRadius: mapStyle.popupRadius }]}>
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
  // Wartości NODE-zależne tu to tylko BAZA — realny, aktualny rozmiar nadpisywany inline
  // w JSX z `mapStyle.nodeSize` (§332), bo ten statyczny obiekt nie może reagować na store.
  nodeTouch: { position: 'absolute', width: BASE_NODE, alignItems: 'center' },
  node: { position: 'absolute', width: BASE_NODE, alignItems: 'center' },
  portrait: { width: BASE_NODE, height: BASE_NODE, alignItems: 'center', justifyContent: 'center' },
  currentRing: {
    position: 'absolute', left: -7, top: -7, width: BASE_NODE + 14, height: BASE_NODE + 14,
    borderRadius: (BASE_NODE + 14) / 2, borderWidth: 2.5,
  },
  defeatedOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  badgeLock: {
    position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  nodeLabel: { fontSize: 10, fontWeight: '800', textAlign: 'center', marginTop: 4, width: BASE_NODE + 32, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

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
