import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Pressable, Animated, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  LayoutDashboard, ListTodo, CalendarDays, Wallet,
  Plus, ScanLine, CheckSquare, Smile, Flame, Receipt,
} from 'lucide-react-native';
import { colors, spacing, radius } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendarStore } from '@/store/calendarStore';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { haptic } from '@/utils/haptics';

type BottomTabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
  descriptors: Record<string, any>;
};

// Dashboard → Zadania → Kalendarz → Finanse
const TABS = [
  { name: 'index',    Icon: LayoutDashboard },
  { name: 'tasks',    Icon: ListTodo        },
  { name: 'stats',    Icon: CalendarDays    },
  { name: 'finances', Icon: Wallet          },
];

// null = dynamic time accent on home
const TAB_ACCENTS = [
  null,
  colors.tabs.tasks,    // #3DBE75 green
  colors.tabs.calendar, // #BF80FF violet
  colors.tabs.finances, // #EF4444 red
] as const;

const QUICK_ACTIONS = [
  { label: 'NAWYK',       color: '#F97316',            route: '/habits'         },
  { label: 'HUMOR',       color: colors.accent.purple, route: '/(tabs)/mood'    },
  { label: 'WYD/PRZYCH',  color: colors.accent.red,    route: '/expenses/add'   },
  { label: 'ZADANIE',     color: colors.tabs.tasks,    route: '/tasks/add'      },
  { label: 'PARSER PAR.', color: colors.accent.blue,   route: '/expenses/scan'  },
];

const FAB_SIZE = 48;
const PILL_H   = 52;

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const [open, setOpen]       = useState(false);
  const insets                = useSafeAreaInsets();
  const { color: timeAccent } = useTimeAccent();

  const todayStr = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  })();

  const pendingCount  = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending').length);
  const overdueCount  = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending' && t.deadline && t.deadline.split('T')[0] < todayStr).length);
  const todayDueCount = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending' && (t.deadline?.split('T')[0] === todayStr || t.scheduledDate === todayStr)).length);

  const activeAccent  = TAB_ACCENTS[state.index] ?? timeAccent;

  const fabProgress  = useRef(new Animated.Value(0)).current;
  const itemAnims    = useRef(QUICK_ACTIONS.map(() => new Animated.Value(0))).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const menuBase = (insets.bottom || 16) + 8 + PILL_H + 12 + FAB_SIZE + 12;

  const openMenu = () => {
    haptic.tap();
    setOpen(true);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(fabProgress,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ...itemAnims.map((anim, i) => {
        anim.setValue(0);
        return Animated.spring(anim, {
          toValue: 1, useNativeDriver: true,
          damping: 16, stiffness: 220, delay: i * 40,
        } as any);
      }),
    ]).start();
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
          {QUICK_ACTIONS.map((action, i) => {
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
      <LinearGradient
        colors={['rgba(0,0,0,0)', activeAccent + '28']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[s.container, { paddingBottom: (insets.bottom || 0) + 8 }]}
      >
        {/* FAB */}
        <View style={s.fabRow}>
          <TouchableOpacity
            style={[s.fab, { backgroundColor: activeAccent, shadowColor: activeAccent }]}
            onPress={open ? () => closeMenu() : openMenu}
            activeOpacity={0.85}
          >
            <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
              <Plus size={22} color={colors.bg.primary} strokeWidth={2.8} />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* 4-tab pill */}
        <View style={s.pill}>
          {TABS.map((tab, i) => {
            const focused    = state.index === i;
            const accent     = TAB_ACCENTS[i] ?? timeAccent;
            const showBadge  = tab.name === 'tasks' && pendingCount > 0;
            return (
              <TouchableOpacity
                key={tab.name}
                style={s.tabItem}
                onPress={() => { haptic.tap(); navigation.navigate(tab.name); }}
                activeOpacity={0.7}
              >
                {focused && (
                  <View style={[s.activePill, { backgroundColor: accent + '28' }]} />
                )}
                <View style={s.iconWrap}>
                  <tab.Icon
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
        </View>
      </LinearGradient>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },

  fabRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 4,
    marginBottom: 8,
  },
  fab: {
    width: FAB_SIZE, height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    elevation: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 16,
  },

  pill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(18,18,18,0.97)',
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 6,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.4, shadowRadius: 12,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    width: '80%', height: '100%',
    borderRadius: 16,
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
