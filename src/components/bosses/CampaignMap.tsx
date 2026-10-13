import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Image, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Lock, Swords } from 'lucide-react-native';
import BossArt from './BossArt';
import PressableScale from '@/components/ui/PressableScale';
import { Boss, mysteryBossName, fmtEnergyCountdown } from '@/utils/bosses';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

// Mapa kampanii (2026-10-12, przebudowa 2026-10-13 po zrzucie ekranu — user: "wrzuć tę mapę
// w tło zmniejsz jasność... żeby to wyglądało jak podróż... ta ikonka aktualna niech się
// pokazuje jak inne mała i po kliknięciu pokazuje się powiększony i przycisk walki popup...
// pokonani niech na szaro się pokazują albo przekreśleni czarnym X... i elementów niech będą
// popupy gdzieś przy krawędziach żeby to było pełnoekranowe"). Cztery zmiany względem
// pierwszej wersji:
// 1. Tło — prawdziwa, dostarczona grafika mapy (topograficzny pergamin, assets/lokalizacje/
//    LOKACJA_MAPA_KAMPANII.jpg), kafelkowana (`resizeMode="repeat"`, zwykły RN `Image`, NIE
//    expo-image — ten jedyny tu potrzebuje natywnego tile'owania, którego expo-image nie ma)
//    bo trasa bywa dużo wyższa niż pojedyncza grafika (kampania już ~44 bossów, celuje w
//    ~100+). Ciemny scrim NA WIERZCHU (user: "zmniejsz jasność") — ten sam 3-stopniowy
//    gradient-w-dół co tło lokacji w boss-fight.tsx, dla spójności.
// 2. Dawny hero card aktualnego bossa (duży portret/taunt/WALCZ, NAD mapą w bosses.tsx)
//    USUNIĘTY CAŁKOWICIE — ta sama treść żyje teraz w POPUPIE otwieranym tapnięciem węzła
//    aktualnego bossa, który na samej mapie ma TEN SAM rozmiar co pokonani/zablokowani (był
//    już taki od pierwszej wersji — to hero card obok mapy sprawiał wrażenie dublowania, nie
//    sam węzeł).
// 3. Pokonani — zamiast zielonej odznaki ✓, portret przyciemniony (opacity 0.35) + duże
//    czarne X na wierzchu. Tap dalej działa, teraz jako popup (nie toast) z nazwą+lootem.
// 4. Popupy (aktualny i pokonany) to NIE pełnoekranowy `Modal` — absolutnie pozycjonowane
//    karty WEWNĄTRZ tej samej przewijanej treści co węzły (ta sama przestrzeń współrzędnych
//    co `nodeX`/`nodeY`), zakotwiczone PRZY tapniętym węźle i przesunięte żeby nie wyjść
//    poza krawędzie mapy — mapa może być prawie pełnoekranowa, bo żadna interakcja nie
//    wymaga własnego, osobnego miejsca na ekranie.
const NODE = 56;
const ROW_GAP = 92;
const AMP = 70;          // maks. poziome wychylenie węzła od środka (wężowa ścieżka)
const TOP_PAD = 36;
const BOTTOM_PAD = 48;
const POPUP_W = 224;
const MAP_BG = require('../../../assets/lokalizacje/LOKALIZACJA_MAPA_KAMPANII.jpg');

function nodeX(i: number) { return Math.sin(i * 0.85) * AMP; }
function nodeY(i: number) { return TOP_PAD + i * ROW_GAP; }

type Popup = { kind: 'current' | 'defeated'; boss: Boss; nodeX: number; nodeY: number };

// `defeatedIds` nie jest tu potrzebne osobno — kampania leci ŚCIŚLE sekwencyjnie (patrz
// `current = BOSSES.find(b => !defeatedBosses.includes(b.id))` w bosses.tsx, komentarz przy
// `defeatedList`), więc "pokonany" ⟺ "indeks < currentIdx" w TEJ SAMEJ tablicy `bosses`.
// `energy`/`energyMax`/`energyRegenAt` opcjonalne — popup aktualnego bossa pokazuje hint
// "kolejna energia za..." i wyszarza WALCZ tylko gdy podane (ten sam hint co dawny hero card).
function CampaignMap({ bosses, currentId, onPressCurrent, energy, energyMax, energyRegenAt }: {
  bosses: Boss[]; currentId: string | null; onPressCurrent: () => void;
  energy?: number; energyMax?: number; energyRegenAt?: string | null;
}) {
  const c = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const mapW = Dimensions.get('window').width - spacing[4] * 2;
  const mapH = Math.max(480, Dimensions.get('window').height - 300);
  const centerX = mapW / 2;
  const [popup, setPopup] = useState<Popup | null>(null);

  const currentIdx = currentId ? bosses.findIndex(b => b.id === currentId) : bosses.length;
  const contentH = TOP_PAD + Math.max(bosses.length - 1, 0) * ROW_GAP + NODE + BOTTOM_PAD;

  // Popup zamyka się sam gdy postęp kampanii faktycznie się zmienia (np. wygrana walka
  // przesuwa `currentId`) — stary popup pokazywałby wtedy nieaktualny stan/przycisk.
  useEffect(() => { setPopup(null); }, [currentId]);

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

  // Popup zakotwiczony PRZY tapniętym węźle (nie wyśrodkowany modal) — klamrowany w
  // poziomie do szerokości mapy, w pionie pokazywany pod węzłem albo nad nim gdy węzeł jest
  // blisko dołu trasy (żeby nie wystawał poza przewijaną treść).
  const popupLeft = popup ? Math.min(Math.max(popup.nodeX + NODE / 2 - POPUP_W / 2, 8), mapW - POPUP_W - 8) : 0;
  const estH = popup?.kind === 'current' ? 236 : 110;
  const nearBottom = popup ? popup.nodeY > contentH - estH - NODE - 20 : false;
  const popupTop = popup ? (nearBottom ? Math.max(8, popup.nodeY - estH - 10) : popup.nodeY + NODE + 10) : 0;

  // `nestedScrollEnabled` (Android-only, no-op na iOS) — bez tego ta wewnętrzna ScrollView
  // żyje wewnątrz zewnętrznej strony (bosses.tsx) o tej samej osi i Android przechwytuje
  // CAŁY pan do zewnętrznej, czyniąc mapę nieprzewijalną dotykiem (user: "nie moge przesuwać
  // mapy").
  return (
    <View style={[st.wrap, { height: mapH }]}>
      <ScrollView ref={scrollRef} style={st.scroll} contentContainerStyle={{ height: contentH }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <Image source={MAP_BG} style={[StyleSheet.absoluteFillObject, { width: mapW, height: contentH }]} resizeMode="repeat" />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(8,10,16,0.55)', 'rgba(8,10,16,0.68)', 'rgba(8,10,16,0.8)'] as [string, string, string]}
          style={StyleSheet.absoluteFillObject}
        />

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
              <View style={st.portrait}>
                <BossArt id={b.id} emoji={b.emoji} size={NODE} mystery={isLocked} />
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
          if (isCurrent) {
            return (
              <PressableScale
                key={b.id}
                onPress={() => { haptic.tap(); setPopup({ kind: 'current', boss: b, nodeX: x, nodeY: y }); }}
                style={[st.nodeTouch, { left: x, top: y }]}
              >
                {node}
              </PressableScale>
            );
          }
          if (isDefeated) {
            return (
              <PressableScale
                key={b.id}
                onPress={() => { haptic.tap(); setPopup({ kind: 'defeated', boss: b, nodeX: x, nodeY: y }); }}
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

        {popup && (
          <>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPopup(null)} />
            <View style={[st.popup, { left: popupLeft, top: popupTop, width: POPUP_W }]}>
              <View style={{ alignItems: 'center' }}>
                <BossArt id={popup.boss.id} emoji={popup.boss.emoji} size={popup.kind === 'current' ? 84 : 56} mystery={false} />
              </View>
              <Text style={st.popupName}>{popup.boss.name}</Text>
              {popup.kind === 'current' ? (
                <>
                  <Text style={st.popupTaunt} numberOfLines={2}>„{popup.boss.taunt}"</Text>
                  <Text style={st.popupHp}>{popup.boss.hp} HP · <Text style={{ color: '#2AC68F', fontWeight: '800' }}>{popup.boss.weaknessLabel}</Text></Text>
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
              ) : (
                <Text style={st.popupDoneTxt}>Pokonany ✓ · {popup.boss.loot.name}</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing[3] },
  scroll: { flex: 1 },
  nodeTouch: { position: 'absolute', width: NODE, alignItems: 'center' },
  node: { position: 'absolute', width: NODE, alignItems: 'center' },
  portrait: { width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' },
  defeatedOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  badgeLock: {
    position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  nodeLabel: { fontSize: 9.5, fontWeight: '800', textAlign: 'center', marginTop: 4, width: NODE + 28, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  popup: {
    position: 'absolute', backgroundColor: '#161A1A', borderRadius: radius.lg, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)', padding: spacing[3], gap: 3,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  popupName: { fontSize: 14, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: 4 },
  popupTaunt: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', textAlign: 'center' },
  popupHp: { fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 2 },
  popupEnergyHint: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 2 },
  popupDoneTxt: { fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  attackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EF4444', borderRadius: radius.md, paddingVertical: 11 },
  attackTxt: { fontSize: 13.5, fontWeight: '900', color: '#fff' },
});

// memo: ekran-rodzic (bosses.tsx) re-renderuje się często (odliczanie energii) — props tego
// komponentu (bosses/currentId/onPressCurrent/energy*) zmieniają się tylko gdy REALNY postęp
// kampanii lub pula energii się zmienia, nie co tyknięcie zegara, więc memo faktycznie coś
// daje — POD WARUNKIEM że `onPressCurrent` jest stabilne (`useCallback` w bosses.tsx, patrz
// `goFight` tam), inaczej nowe closure na każdy render i tak łamałoby porównanie propsów.
export default memo(CampaignMap);
