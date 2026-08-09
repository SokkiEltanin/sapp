import { useRef, useEffect, useState, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Cat, Swords, ShoppingBag, Trophy } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Floating tab bar for the pupil section (Pupil/Bossy/Sklep/Trofea) — these 4
// screens are flat sibling routes with no shared layout (app/pet.tsx, bosses.tsx,
// pet-shop.tsx, achievements.tsx), and today the ONLY way to move between them is
// router.back() to wherever you came from and tap again (user complaint: "nie
// zrobiłeś navbar... i wgle"). Mirrors the main TabBar's frosted-pill + sliding-
// island visual language (src/components/ui/TabBar.tsx) since these screens are
// never on screen at the same time as the main tab bar (they're root-level Stack
// routes outside the (tabs) group), so there's no visual clash to worry about.
export type PupilTab = 'pet' | 'bosses' | 'shop' | 'trophies';

const TABS: { key: PupilTab; Icon: typeof Cat; path: string; accent: string }[] = [
  { key: 'pet',      Icon: Cat,         path: '/pet',          accent: '#2AC68F' },
  { key: 'bosses',   Icon: Swords,      path: '/bosses',       accent: '#38BDF8' },
  { key: 'shop',     Icon: ShoppingBag, path: '/pet-shop',     accent: '#A78BFA' },
  { key: 'trophies', Icon: Trophy,      path: '/achievements', accent: '#FBBF24' },
];

export default function PupilNavbar({ current }: { current: PupilTab }) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const currentIndex = Math.max(0, TABS.findIndex(t => t.key === current));
  const activeAccent = TABS[currentIndex].accent;

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
}));
