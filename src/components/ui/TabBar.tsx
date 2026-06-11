import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Pressable, Animated, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LayoutDashboard, ListTodo, CalendarDays, Wallet, Plus, SlidersHorizontal, ScanLine, Settings,
} from 'lucide-react-native';
import { useUiActions } from '@/store/uiActions';
import { colors, spacing, radius } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendarStore } from '@/store/calendarStore';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { haptic } from '@/utils/haptics';

type Props = { currentIndex: number };

const TAB_PATHS = ['/', '/tasks', '/stats', '/finances'] as const;

const TABS = [
  { Icon: LayoutDashboard },
  { Icon: ListTodo        },
  { Icon: CalendarDays    },
  { Icon: Wallet          },
];

const TAB_ACCENTS = [
  null,
  colors.tabs.tasks,
  colors.tabs.calendar,
  colors.tabs.finances,
] as const;

const QUICK_ACTIONS = [
  { label: 'NOTATKA',     color: '#6C9EFF',            route: '/notes?new=1'   },
  { label: 'NAWYK',       color: '#F97316',            route: '/habits'        },
  { label: 'HUMOR',       color: colors.accent.purple, route: '/(tabs)/mood'   },
  { label: 'ZDROWIE',     color: '#34D399',            route: '/(tabs)/health' },
  { label: 'WYD/PRZYCH',  color: colors.accent.red,    route: '/expenses/add'  },
  { label: 'ZADANIE',     color: colors.tabs.tasks,    route: '/tasks/add'     },
  { label: 'PARSER PAR.', color: colors.accent.blue,   route: '/expenses/scan' },
];

const FINANCE_ACTIONS = [
  { label: 'WYDATEK',  color: colors.tabs.finances, route: '/expenses/add?type=expense' },
  { label: 'PRZYCHÓD', color: colors.tabs.tasks,    route: '/expenses/add?type=income'  },
];

const MAX_ACTIONS = Math.max(QUICK_ACTIONS.length, FINANCE_ACTIONS.length);

const FAB_SIZE = 48;
const PILL_H   = 52;

export default function TabBar({ currentIndex }: Props) {
  const [open, setOpen]       = useState(false);
  const insets                = useSafeAreaInsets();
  const { color: timeAccent } = useTimeAccent();

  const todayStr = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  const pendingCount  = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending').length);
  const overdueCount  = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending' && t.deadline && t.deadline.split('T')[0] < todayStr).length);
  const todayDueCount = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending' && (t.deadline?.split('T')[0] === todayStr || t.scheduledDate === todayStr)).length);

  const activeAccent = TAB_ACCENTS[currentIndex] ?? timeAccent;
  const triggerTasksSort = useUiActions(s => s.triggerTasksSort);

  const fabProgress  = useRef(new Animated.Value(0)).current;
  const itemAnims    = useRef(Array.from({ length: MAX_ACTIONS }, () => new Animated.Value(0))).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const menuBase = (insets.bottom || 16) + 8 + PILL_H + 12 + FAB_SIZE + 12;

  const menuActions = currentIndex === 3 ? FINANCE_ACTIONS : QUICK_ACTIONS;

  const openMenu = () => {
    setOpen(true);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(fabProgress,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ...menuActions.map((_, i) => {
        itemAnims[i].setValue(0);
        return Animated.spring(itemAnims[i], {
          toValue: 1, useNativeDriver: true,
          damping: 16, stiffness: 220, delay: i * 40,
        } as any);
      }),
    ]).start();
  };

  const handleFabPress = () => {
    haptic.tap();
    if (open) { closeMenu(); return; }
    if (currentIndex === 1) {
      router.push('/tasks/add' as any);
    } else if (currentIndex === 2) {
      router.push('/calendar/add' as any);
    } else {
      openMenu();
    }
  };

  const closeMenu = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(fabProgress,  { toValue: 0, duration: 180, useNativeDriver: true }),
      ...itemAnims.map(anim =>
        Animated.timing(anim, { toValue: 0, duration: 130, useNativeDriver: true })
      ),
    ]).start(() => { setOpen(false); cb?.(); });
  };

  const fabRotate = fabProgress.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '45deg'], extrapolate: 'clamp',
  });

  const badgeColor = overdueCount > 0 ? colors.accent.red
    : todayDueCount > 0 ? colors.accent.amber
    : colors.accent.green;
  const badgeCount = overdueCount > 0 ? overdueCount
    : todayDueCount > 0 ? todayDueCount
    : pendingCount;

  return (
    <>
      {/* ── Quick actions menu ─────────────────────────────────────── */}
      <Modal
        visible={open}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => closeMenu()}
      >
        <Animated.View style={[s.backdrop, { opacity: backdropAnim }]} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMenu()} />
        </Animated.View>

        <View style={[s.quickMenu, { bottom: menuBase + 12 }]}>
          {menuActions.map((action, i) => {
            const translateY = itemAnims[i].interpolate({
              inputRange: [0, 1], outputRange: [20, 0], extrapolate: 'clamp',
            });
            return (
              <Animated.View key={action.label} style={{ opacity: itemAnims[i], transform: [{ translateY }] }}>
                <TouchableOpacity
                  style={s.quickItem}
                  onPress={() => { haptic.tap(); closeMenu(() => router.push(action.route as any)); }}
                  activeOpacity={0.8}
                >
                  <View style={[s.quickPlus, { backgroundColor: action.color + '22' }]}>
                    <Plus size={14} color={action.color} strokeWidth={2.8} />
                  </View>
                  <Text style={s.quickLabel}>{action.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </Modal>

      {/* ── Bar ────────────────────────────────────────────────────── */}
      {/* box-none: transparent areas pass touches through to the content
          behind, so only the FAB + pill are interactive and the bar floats. */}
      <View style={[s.container, { paddingBottom: (insets.bottom || 0) + 8 }]} pointerEvents="box-none">
        {/* Bottom scrim — content fades out under the bar */}
        <LinearGradient
          colors={['transparent', 'rgba(10,12,12,0.55)', colors.bg.primary]}
          locations={[0, 0.55, 1]}
          style={[s.scrim, { height: (insets.bottom || 0) + 120 }]}
          pointerEvents="none"
        />
        {/* FAB row — floating above pill, no background */}
        <View style={s.fabRow} pointerEvents="box-none">
          {/* Secondary: settings button for dashboard tab */}
          {currentIndex === 0 && (
            <TouchableOpacity
              style={[s.sortFab, { borderColor: activeAccent + '50' }]}
              onPress={() => { haptic.tap(); router.push('/settings' as any); }}
              activeOpacity={0.85}
            >
              <Settings size={18} color={activeAccent} />
            </TouchableOpacity>
          )}
          {/* Secondary: sort button for tasks tab */}
          {currentIndex === 1 && (
            <TouchableOpacity
              style={[s.sortFab, { borderColor: activeAccent + '50' }]}
              onPress={() => { haptic.tap(); triggerTasksSort(); }}
              activeOpacity={0.85}
            >
              <SlidersHorizontal size={18} color={activeAccent} />
            </TouchableOpacity>
          )}
          {/* Secondary: scan receipt for finances tab */}
          {currentIndex === 3 && (
            <TouchableOpacity
              style={[s.sortFab, { borderColor: activeAccent + '50' }]}
              onPress={() => { haptic.tap(); router.push('/expenses/scan' as any); }}
              activeOpacity={0.85}
            >
              <ScanLine size={18} color={activeAccent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.fab, { backgroundColor: activeAccent, shadowColor: activeAccent }]}
            onPress={handleFabPress}
            activeOpacity={0.85}
          >
            <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
              <Plus size={22} color={colors.bg.primary} strokeWidth={2.8} />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* 4-tab pill — frosted glass with a faint accent hairline */}
        <LinearGradient
          colors={[activeAccent + '55', 'rgba(255,255,255,0.06)', activeAccent + '33']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.pillBorder}
        >
        <BlurView intensity={32} tint="dark" style={s.pill}>
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
                {focused && (
                  <View style={[s.activePill, { backgroundColor: accent + '40', borderWidth: 1, borderColor: accent + '55' }]} />
                )}
                <View style={s.iconWrap}>
                  <Icon
                    size={20}
                    color={focused ? accent : colors.text.muted}
                    strokeWidth={focused ? 2.2 : 1.5}
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
        </BlurView>
        </LinearGradient>
      </View>
    </>
  );
}

const s = StyleSheet.create({
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
  fab: {
    width: FAB_SIZE, height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    elevation: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 16,
  },
  sortFab: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(18,18,18,0.97)',
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },

  scrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
  },
  pillBorder: {
    borderRadius: 29,
    padding: 1,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.45, shadowRadius: 14,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16,17,17,0.66)',
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    width: '100%', height: '100%',
    borderRadius: 20,
  },
  iconWrap: { position: 'relative', zIndex: 1 },

  badge: {
    position: 'absolute', top: -5, right: -8,
    minWidth: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2, borderWidth: 1.5, borderColor: colors.black,
  },
  badgeText: { fontSize: 8, fontWeight: '700', color: colors.white, lineHeight: 11 },

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
    backgroundColor: 'rgba(22,22,22,0.98)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4], paddingVertical: 13,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 190,
  },
  quickPlus: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 13, fontWeight: '700', color: colors.text.primary,
    letterSpacing: 0.6, flex: 1,
  },
});
