import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Pressable, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LayoutDashboard, ListTodo, CalendarDays, Wallet, HeartPulse, ScanLine, Settings,
  Briefcase, Flame, FileText, CalendarPlus, TrendingUp, TrendingDown, CheckSquare,
} from 'lucide-react-native';
import { useUiActions } from '@/store/uiActions';
import { colors, spacing, radius } from '@/theme';
import { useColors, useIsLight } from '@/theme/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendarStore } from '@/store/calendarStore';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { haptic } from '@/utils/haptics';

type Props = { currentIndex: number };

const TAB_PATHS = ['/', '/tasks', '/stats', '/finances', '/health'] as const;

const TABS = [
  { Icon: LayoutDashboard },
  { Icon: ListTodo        },
  { Icon: CalendarDays    },
  { Icon: Wallet          },
  { Icon: HeartPulse      },
];

const TAB_ACCENTS = [
  null,
  colors.tabs.tasks,
  colors.tabs.calendar,
  colors.tabs.finances,
  '#8B5CF6',
] as const;

const PILL_H = 52;

export default function TabBar({ currentIndex }: Props) {
  const [open, setOpen]       = useState(false);
  const insets                = useSafeAreaInsets();
  const { color: timeAccent } = useTimeAccent();
  const c                     = useColors();
  const isLight               = useIsLight();
  const s                     = useMemo(() => makeStyles(c), [c]);

  const todayStr = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  const pendingCount  = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending').length);
  const overdueCount  = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending' && t.deadline && t.deadline.split('T')[0] < todayStr).length);
  const todayDueCount = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending' && (t.deadline?.split('T')[0] === todayStr || t.scheduledDate === todayStr)).length);

  const activeAccent = TAB_ACCENTS[currentIndex] ?? timeAccent;
  const openWorkPanel = useUiActions(s => s.openWorkPanel);

  // Animated "island" that slides under the active tab (Dynamic-Island feel).
  const [pillW, setPillW] = useState(0); // inner width of the tab row (measured)
  const tabW = pillW > 0 ? pillW / TABS.length : 0;
  const islandX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(islandX, {
      toValue: currentIndex * tabW,
      useNativeDriver: true, damping: 19, stiffness: 170, mass: 1,
    }).start();
  }, [currentIndex, tabW]);

  // Per-tab quick actions — a small row of round buttons (replaces the old "+").
  const ACTIONS: { icon: any; color: string; onPress: () => void }[] =
    currentIndex === 0 ? [
      { icon: Briefcase,   color: '#2AC68F',            onPress: () => openWorkPanel() },
      { icon: Flame,       color: '#F97316',            onPress: () => router.push('/habits' as any) },
      { icon: Settings,    color: '#8A93A8',            onPress: () => router.push('/settings' as any) },
    ] : currentIndex === 1 ? [
      { icon: FileText,    color: '#6C9EFF',            onPress: () => router.push('/notes?new=1' as any) },
      { icon: CheckSquare, color: colors.tabs.tasks,    onPress: () => router.push('/tasks/add' as any) },
    ] : currentIndex === 2 ? [
      { icon: CalendarPlus, color: colors.tabs.calendar, onPress: () => router.push('/calendar/add' as any) },
    ] : currentIndex === 3 ? [
      { icon: TrendingDown, color: colors.tabs.finances, onPress: () => router.push('/expenses/add?type=expense' as any) },
      { icon: TrendingUp,   color: colors.tabs.tasks,    onPress: () => router.push('/expenses/add?type=income' as any) },
      { icon: ScanLine,     color: colors.accent.blue,   onPress: () => router.push('/expenses/scan' as any) },
    ] : [];

  const badgeColor = overdueCount > 0 ? colors.accent.red
    : todayDueCount > 0 ? colors.accent.amber
    : colors.accent.green;
  const badgeCount = overdueCount > 0 ? overdueCount
    : todayDueCount > 0 ? todayDueCount
    : pendingCount;

  return (
    <>
      {/* ── Bar ────────────────────────────────────────────────────── */}
      {/* box-none: transparent areas pass touches through to the content
          behind, so only the FAB + pill are interactive and the bar floats. */}
      <View style={[s.container, { paddingBottom: (insets.bottom || 0) + 8 }]} pointerEvents="box-none">
        {/* Bottom scrim — content fades into the page bg under the bar (theme-aware
            so it isn't a dark band in light mode) */}
        <LinearGradient
          colors={['transparent', c.bg.primary + 'D9', c.bg.primary]}
          locations={[0, 0.55, 1]}
          style={[s.scrim, { height: (insets.bottom || 0) + 110 }]}
          pointerEvents="none"
        />
        {/* Per-tab action buttons — floating above the pill, no background */}
        <View style={s.fabRow} pointerEvents="box-none">
          {ACTIONS.map((a, i) => {
            const Icon = a.icon;
            return (
              <TouchableOpacity
                key={i}
                style={[s.actionFab, { borderColor: a.color + '66', backgroundColor: c.bg.elevated }]}
                onPress={() => { haptic.tap(); a.onPress(); }}
                activeOpacity={0.85}
              >
                <Icon size={21} color={a.color} strokeWidth={2.2} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4-tab pill — frosted glass with a faint accent hairline */}
        <LinearGradient
          colors={[activeAccent + '55', c.fill.subtle, activeAccent + '33']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.pillBorder}
        >
        <BlurView intensity={isLight ? 40 : 32} tint={isLight ? 'light' : 'dark'} style={s.pill}>
          {/* Sliding island under the active tab */}
          {tabW > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                s.island,
                {
                  width: tabW - 4,
                  backgroundColor: activeAccent + '30',
                  borderColor: activeAccent + '5A',
                  transform: [{ translateX: islandX }],
                },
              ]}
            />
          )}
          <View style={s.tabRow} onLayout={e => setPillW(e.nativeEvent.layout.width)}>
            {TABS.map(({ Icon }, i) => {
              const focused   = currentIndex === i;
              const accent    = TAB_ACCENTS[i] ?? timeAccent;
              const showBadge = i === 1 && pendingCount > 0;
              return (
                <TouchableOpacity
                  key={i}
                  style={s.tabItem}
                  onPress={() => {
                    haptic.tap();
                    if (currentIndex !== i) router.navigate(TAB_PATHS[i] as any);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.iconWrap}>
                    <Icon
                      size={focused ? 23 : 20}
                      color={focused ? accent : c.text.muted}
                      strokeWidth={focused ? 2.4 : 1.6}
                    />
                    {showBadge && (
                      <View style={[s.badge, { backgroundColor: badgeColor }]}>
                        <Text style={s.badgeText}>{badgeCount > 99 ? '99' : badgeCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
        </LinearGradient>
      </View>
    </>
  );
}

const makeStyles = (c: typeof colors) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 4,
    backgroundColor: 'transparent',
  },

  fabRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 4,
    marginBottom: 6,
    gap: 8,
  },
  actionFab: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.32, shadowRadius: 9,
  },

  scrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
  },
  pillBorder: {
    borderRadius: 29,
    padding: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.45, shadowRadius: 14,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: c.fill.strong,
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },

  tabRow: { flexDirection: 'row', flex: 1 },
  tabItem: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  island: {
    position: 'absolute',
    left: 8, top: 4, bottom: 4,
    borderRadius: 999,   // full capsule → matches the rounded pill (was a boxy 18)
    borderWidth: 1,
  },
  iconWrap: { position: 'relative', zIndex: 1 },

  badge: {
    position: 'absolute', top: -5, right: -8,
    minWidth: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2, borderWidth: 1.5, borderColor: c.bg.elevated,
  },
  badgeText: { fontSize: 8, fontWeight: '700', color: '#FFFFFF', lineHeight: 11 },

  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999, elevation: 30,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  quickMenu: {
    position: 'absolute', right: 24,
    gap: spacing[2], alignItems: 'flex-end',
  },
  quickItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4], paddingVertical: 13,
    borderWidth: 0.5, borderColor: c.border.default,
    minWidth: 190,
  },
  quickPlus: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 13, fontWeight: '700', color: c.text.primary,
    letterSpacing: 0.6, flex: 1,
  },
});
