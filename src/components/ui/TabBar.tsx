import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Pressable, Animated, Modal,
} from 'react-native';
import { router } from 'expo-router';
import {
  LayoutDashboard, ListTodo, Wallet,
  Plus, Receipt, TrendingUp, CalendarPlus, CheckSquare, X,
  Smile, Zap, ScanLine, NotebookPen,
} from 'lucide-react-native';
import { colors, spacing, radius } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendarStore } from '@/store/calendarStore';
import { useTimeAccent } from '@/hooks/useTimeAccent';

type BottomTabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
  descriptors: Record<string, any>;
};

const TABS = [
  { name: 'index',    label: 'Dziś',    Icon: LayoutDashboard },
  { name: 'tasks',    label: 'Zadania', Icon: ListTodo },
  { name: 'finances', label: 'Finanse', Icon: Wallet },
];

const QUICK_ACTIONS = [
  { label: 'Nowe zadanie',    Icon: CheckSquare,  color: colors.accent.purple, route: '/tasks/add' },
  { label: 'Wydatek',         Icon: Receipt,      color: colors.accent.red,    route: '/expenses/add' },
  { label: 'Przychód',        Icon: TrendingUp,   color: colors.accent.green,  route: '/expenses/add?type=income' },
  { label: 'Skan paragonu',   Icon: ScanLine,     color: colors.accent.blue,   route: '/expenses/scan' },
  { label: 'Event',           Icon: CalendarPlus, color: colors.accent.blue,   route: '/calendar/add' },
  { label: 'Nastrój',         Icon: Smile,        color: colors.accent.pink,   route: '/(tabs)/mood' },
  { label: 'Notatka',         Icon: NotebookPen,  color: colors.accent.amber,  route: '/notes' },
];

const FAB_SIZE = 52;
const FAB_OVERLAP = 20;

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const pendingCount = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending').length);
  const { color: accentColor } = useTimeAccent();

  const fabProgress  = useRef(new Animated.Value(0)).current;
  const itemAnims    = useRef(QUICK_ACTIONS.map(() => new Animated.Value(0))).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const pillH    = 64;
  const menuBase = FAB_SIZE - FAB_OVERLAP + pillH + (insets.bottom || 16) + 16;

  const openMenu = () => {
    setOpen(true);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(fabProgress,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ...itemAnims.map((anim, i) => {
        anim.setValue(0);
        return Animated.spring(anim, {
          toValue: 1, useNativeDriver: true,
          damping: 16, stiffness: 220, delay: i * 35,
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
        <Animated.View
          style={[s.backdrop, { opacity: backdropAnim }]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMenu()} />
        </Animated.View>

        <View style={[s.quickMenu, { bottom: menuBase + 12 }]}>
          {QUICK_ACTIONS.map((action, i) => {
            const translateY = itemAnims[i].interpolate({
              inputRange: [0, 1], outputRange: [16, 0], extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={action.label}
                style={{ opacity: itemAnims[i], transform: [{ translateY }] }}
              >
                <TouchableOpacity
                  style={s.quickItem}
                  onPress={() => closeMenu(() => router.push(action.route as any))}
                  activeOpacity={0.8}
                >
                  <Text style={s.quickLabel}>{action.label}</Text>
                  <View style={[s.quickIcon, { backgroundColor: action.color + '1A', borderColor: action.color + '44' }]}>
                    <action.Icon size={17} color={action.color} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </Modal>

      {/* ── Bar container ──────────────────────────────────────────── */}
      <View style={[s.container, { paddingBottom: (insets.bottom || 0) + 8 }]}>

        {/* FAB — floats above pill center */}
        <View style={s.fabRow} pointerEvents="box-none">
          <TouchableOpacity
            style={[s.fab, { shadowColor: accentColor }]}
            onPress={open ? () => closeMenu() : openMenu}
            activeOpacity={0.85}
          >
            <View style={[s.fabInner, { borderColor: accentColor + '60' }]}>
              <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
                <Plus size={20} color={accentColor} strokeWidth={2.5} />
              </Animated.View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Pill */}
        <View style={s.pill}>
          {TABS.map((tab, i) => {
            const focused = state.index === i;
            const showBadge = tab.name === 'tasks' && pendingCount > 0;
            return (
              <TouchableOpacity
                key={tab.name}
                style={s.tabItem}
                onPress={() => navigation.navigate(tab.name)}
                activeOpacity={0.75}
              >
                <View style={s.iconWrap}>
                  <tab.Icon
                    size={21}
                    color={focused ? '#FFFFFF' : colors.text.secondary}
                    strokeWidth={focused ? 2 : 1.5}
                  />
                  {showBadge && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{pendingCount > 99 ? '99' : pendingCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.tabLabel, focused && s.tabLabelActive]}>
                  {tab.label}
                </Text>
                {focused && (
                  <View style={[s.activeLine, { backgroundColor: accentColor }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 0,
    backgroundColor: 'transparent',
  },

  // ── FAB row ─────────────────────────────────────────────────────
  fabRow: {
    alignItems: 'center',
    marginBottom: -FAB_OVERLAP,
    zIndex: 10,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  fabInner: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },

  // ── Pill ────────────────────────────────────────────────────────
  pill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(14,14,14,0.98)',
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingTop: FAB_OVERLAP + 4,
    paddingBottom: 10,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },

  // ── Tab items ────────────────────────────────────────────────────
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  iconWrap: { position: 'relative' },
  tabLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    marginTop: 2,
  },

  // ── Badge ────────────────────────────────────────────────────────
  badge: {
    position: 'absolute', top: -5, right: -8,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: colors.accent.red,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  badgeText: { fontSize: 8, fontWeight: '700', color: '#fff', lineHeight: 11 },

  // ── Quick actions menu ───────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  quickMenu: {
    position: 'absolute',
    right: 24,
    gap: spacing[3],
    alignItems: 'flex-end',
  },
  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  quickIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  quickLabel: {
    fontSize: 13, fontWeight: '600',
    color: colors.text.primary,
    backgroundColor: 'rgba(18,18,18,0.96)',
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});
