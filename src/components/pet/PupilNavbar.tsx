import { useRef, useEffect, useState, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { usePetQuests } from '@/hooks/usePetQuests';
import { PupilTab, PUPIL_NAV_TABS } from '@/data/pupilNavTabs';
import { useCanvasComponentsStore, CanvasItem } from '@/store/canvasComponentsStore';
import { isShapeType, ShapeComponentType, ShapeStyle } from '@/store/shapeStyleDefaults';
import { ShapeTile } from '@/components/canvas/ShapeTile';
import { IconTile } from '@/components/canvas/IconTile';
import { IconTileStyle } from '@/store/iconTileStyleDefaults';
import { NavTabTile } from '@/components/canvas/NavTabTile';

// Floating tab bar for the pupil section (Pupil/Bosy/Sklep/Statystyki) — these 4
// screens are flat sibling routes with no shared layout (app/pet.tsx, bosses.tsx,
// pet-shop.tsx, pet-stats.tsx), and the only way to move between them otherwise is
// router.back() to wherever you came from and tap again (user complaint: "nie
// zrobiłeś navbar... i wgle"). Mirrors the main TabBar's frosted-pill + sliding-
// island visual language (src/components/ui/TabBar.tsx) since these screens are
// never on screen at the same time as the main tab bar (they're root-level Stack
// routes outside the (tabs) group), so there's no visual clash to worry about.
// `trophies`/achievements.tsx was dropped from this bar (2026-08-09, user gave an
// explicit 4-tab list without it) — general life achievements still reach it via
// Settings/dashboard, just not from here.
// `stats` (pet power + itemy bojowe) tab USUNIĘTY (2026-08-19, user: "statystyki były w
// zakładce z kotkiem i itemami, i misja tam będzie a reszta zadań będzie w osobnej
// zakładce") — jego zawartość wchłonięta do `/pet` (app/pet.tsx), a zwolniony 4. slot
// dostał NOWĄ zakładkę questów (`/pet-quests`, wcześniej żyły na `/pet` razem z kotkiem).
// `PupilTab`/`TABS` PRZENIESIONE do `src/data/pupilNavTabs.ts` (Faza §392, 2026-10-19) — jedno
// źródło prawdy współdzielone z systemem płótna (`ScreenCanvas.tsx`'s nowy typ `'navTab'`),
// zero zmiany zachowania (ten sam kształt danych/kolejność, re-eksportowane tu jako `TABS` żeby
// nie przepisywać reszty tego pliku).
const TABS = PUPIL_NAV_TABS;

// Własny, zaprojektowany na płótnie navbar (Faza §392) — user: "pełna przebudowa jak Figma".
// Renderuje itemy `screenKey='navbar'` (kolejna, niezależna podprzestrzeń w
// `canvasComponentsStore.ts`) w ich zapisanych pozycjach/rozmiarach, READ-ONLY (bez
// gestów/chrome edytora — ten sam duch co `viewOnly` w `ScreenCanvasBase`, ale bespoke: ten
// komponent NIE używa `ScreenCanvas.tsx` wprost, bo potrzebuje WŁASNEGO zachowania tapnięcia na
// `navTab` — nawigacja (`router.replace`), nie metric-picker). Wołający (`PupilNavbar` niżej)
// GWARANTUJE, że to się renderuje TYLKO gdy wszystkie 4 wymagane taby są podpięte — ten
// komponent sam nie waliduje nic, ufa wołającemu (ten sam podział odpowiedzialności co
// `CanvasPlacedItem`/`ScreenCanvas.tsx`: chrome/gest kontra treść).
function CustomPupilNavbarContent({ items, current, bottomInset }: {
  items: CanvasItem[];
  current: PupilTab;
  bottomInset: number;
}) {
  const sorted = [...items].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const barHeight = Math.max(64, ...items.map(i => i.y + i.height));
  return (
    <View style={[s2.wrap, { height: barHeight + bottomInset + 8, paddingBottom: bottomInset + 8 }]} pointerEvents="box-none">
      {sorted.map(item => {
        const sizeStyle = { position: 'absolute' as const, left: item.x, top: item.y, width: item.width, height: item.height };
        if (item.componentType === 'navTab') {
          const tab = item.bindingKey ? PUPIL_NAV_TABS.find(t => t.key === item.bindingKey) ?? null : null;
          return (
            <View key={item.id} style={sizeStyle}>
              <NavTabTile
                tab={tab}
                active={tab?.key === current}
                onPress={() => { if (!tab || tab.key === current) return; haptic.tap(); router.replace(tab.path as any); }}
                sizeStyle={{ flex: 1 }}
              />
            </View>
          );
        }
        if (isShapeType(item.componentType)) {
          return (
            <View key={item.id} style={sizeStyle} pointerEvents="none">
              <ShapeTile kind={item.componentType as ShapeComponentType} style={item.style as ShapeStyle} width={item.width} height={item.height} onPress={() => {}} sizeStyle={{ flex: 1 }} />
            </View>
          );
        }
        if (item.componentType === 'iconTile') {
          return (
            <View key={item.id} style={sizeStyle} pointerEvents="none">
              <IconTile style={item.style as IconTileStyle} onPress={() => {}} sizeStyle={{ flex: 1 }} />
            </View>
          );
        }
        // Inne typy (streakTile/dataField/itd.) nie mają sensu na navbarze (nie są dodawalne
        // tu, patrz `ScreenCanvas.tsx`'s przycisk "Przycisk nawigacji" ograniczony do
        // `screenKey==='navbar'` — ale ten typ NIE blokuje innych typów od bycia dodanymi tutaj
        // przez user'a, który np. skopiował/przeniósł item z innego ekranu) — defensywnie
        // pomiń, nie crashuj.
        return null;
      })}
    </View>
  );
}

export default function PupilNavbar({ current }: { current: PupilTab }) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const currentIndex = Math.max(0, TABS.findIndex(t => t.key === current));
  const activeAccent = TABS[currentIndex].accent;
  // "Ping" na zakładce questów (2026-08-22, user: "dodaj ping na zakladce questów ze coś jest
  // tam do odebrania") — navbar żyje na WSZYSTKICH 4 ekranach Pupila, więc badge musi być
  // widoczny nawet gdy user jest np. na Bossach, nie tylko po wejściu na sam ekran Zadań.
  // `usePetQuests()` wołany tu niezależnie od pet-quests.tsx — ten sam wzorzec co
  // `usePetHealthSync` (patrz komentarz w hooku), akceptowany koszt lekkiego podwojenia
  // odczytu na rzecz jednego źródła prawdy zamiast osobnej, potencjalnie rozjeżdżającej się
  // logiki liczenia "czy jest coś do odebrania".
  const { quests, missed } = usePetQuests();
  const hasClaimable = quests.claimableCount > 0 || missed.length > 0;

  // Walidacja własnego navbaru (§392) — TU, nie w `navbar-editor.tsx` (ten ekran TEŻ waliduje,
  // ale to jest niezależna, OSTATNIA linia obrony: nawet gdyby user ręcznie zmanipulował store
  // (np. stary stan AsyncStorage z buga), ŻYWY navbar sam sprawdza kompletność PRZED użyciem
  // custom-renderu, nigdy nie ufa samej fladze `customNavbarEnabled` bez weryfikacji).
  const allItems = useCanvasComponentsStore(st => st.items);
  const customNavbarEnabled = useCanvasComponentsStore(st => st.customNavbarEnabled);
  const navbarItems = useMemo(() => allItems.filter(i => i.screenKey === 'navbar'), [allItems]);
  const isCustomValid = useMemo(() => {
    if (!customNavbarEnabled || navbarItems.length === 0) return false;
    const boundKeys = new Set(navbarItems.filter(i => i.componentType === 'navTab' && i.bindingKey).map(i => i.bindingKey));
    return PUPIL_NAV_TABS.every(t => boundKeys.has(t.key));
  }, [customNavbarEnabled, navbarItems]);

  // Sliding island under the active tab — identical spring feel to the main TabBar.
  const [pillW, setPillW] = useState(0);
  const tabW = pillW > 0 ? pillW / TABS.length : 0;
  const islandX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(islandX, {
      toValue: currentIndex * tabW,
      useNativeDriver: true, damping: 19, stiffness: 170, mass: 1,
    }).start();
  }, [currentIndex, tabW]);

  if (isCustomValid) {
    return <CustomPupilNavbarContent items={navbarItems} current={current} bottomInset={insets.bottom || 0} />;
  }

  return (
    <View style={[s.container, { paddingBottom: (insets.bottom || 0) + 8 }]} pointerEvents="box-none">
      <LinearGradient
        colors={['transparent', c.bg.primary + 'D9', c.bg.primary]}
        locations={[0, 0.55, 1]}
        style={[s.scrim, { height: (insets.bottom || 0) + 96 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[activeAccent + '55', c.fill.subtle, activeAccent + '33']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.pillBorder}
      >
        <View style={[s.pill, { backgroundColor: c.bg.elevated }]}>
          {tabW > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[s.island, {
                width: tabW - 4,
                backgroundColor: activeAccent + '30',
                borderColor: activeAccent + '5A',
                transform: [{ translateX: islandX }],
              }]}
            />
          )}
          <View style={s.tabRow} onLayout={e => setPillW(e.nativeEvent.layout.width)}>
            {TABS.map((t) => {
              const focused = current === t.key;
              const Icon = t.Icon;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={s.tabItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (focused) return;
                    haptic.tap();
                    // replace, not push — these are lateral hub tabs, not a drill-down
                    // stack, so hopping Pupil->Bossy->Sklep shouldn't grow the back stack.
                    router.replace(t.path as any);
                  }}
                >
                  <Icon size={focused ? 23 : 20} color={focused ? t.accent : c.text.muted} strokeWidth={focused ? 2.4 : 1.6} />
                  {t.key === 'quests' && hasClaimable && <View style={s.badge} pointerEvents="none" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 4, backgroundColor: 'transparent' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  pillBorder: { borderRadius: 29, padding: 1, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.45, shadowRadius: 14 },
  pill: { flexDirection: 'row', borderRadius: 28, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 6 },
  tabRow: { flexDirection: 'row', flex: 1 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, position: 'relative' },
  island: { position: 'absolute', left: 8, top: 4, bottom: 4, borderRadius: 999, borderWidth: 1 },
  badge: { position: 'absolute', top: 6, right: '28%', width: 8, height: 8, borderRadius: 4, backgroundColor: '#FBBF24', borderWidth: 1.5, borderColor: c.bg.elevated },
}));

// Styl `CustomPupilNavbarContent` — bez theme (pozycjonowanie absolutne itemów z płótna, kolor
// idzie z WŁASNEGO stylu każdego itemu, nie z theme appki).
const s2 = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
