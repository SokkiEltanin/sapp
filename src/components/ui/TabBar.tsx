import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Pressable, Animated, Modal,
} from 'react-native';
import { router } from 'expo-router';
import {
  LayoutDashboard, ListTodo, Wallet,
  Plus, Receipt, TrendingUp, CalendarPlus, CheckSquare, X,
  Smile, Zap,
} from 'lucide-react-native';
import { colors, spacing, radius } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendarStore } from '@/store/calendarStore';

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
  { label: 'Nowe zadanie', Icon: CheckSquare, color: colors.accent.purple, route: '/tasks/add' },
  { label: 'Wydatek',      Icon: Receipt,     color: colors.accent.red,    route: '/expenses/add' },
  { label: 'Przychód',     Icon: TrendingUp,  color: colors.accent.green,  route: '/expenses/add?type=income' },
  { label: 'Event',        Icon: CalendarPlus, color: colors.accent.blue,  route: '/calendar/add' },
  { label: 'Nastrój',      Icon: Smile,       color: colors.accent.pink,   route: '/(tabs)/mood' },
  { label: 'Nawyki',       Icon: Zap,         color: colors.accent.purple, route: '/habits' },
];

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const pendingCount = useCalendarStore(s => s.tasks.filter(t => t.status === 'pending').length);

  const fabProgress  = useRef(new Animated.Value(0)).current;
  const itemAnims    = useRef(QUICK_ACTIONS.map(() => new Animated.Value(0))).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const tabBarH = 60 + (insets.bottom || 16);

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

  // Tab 0 = index, Tab 1 = tasks, Tab 2 = finances
  const leftTab  = TABS[0];
  const rightTabs = TABS.slice(1);

  return (
    <>
      <Modal
        visible={open}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => closeMenu()}
      >
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMenu()} />
        </Animated.View>

        <View style={[styles.quickMenu, { bottom: tabBarH + 12 }]}>
          {QUICK_ACTIONS.map((action, i) => {
            const translateY = itemAnims[i].interpolate({
              inputRange: [0, 1], outputRange: [20, 0], extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={action.label}
                style={{ opacity: itemAnims[i], transform: [{ translateY }] }}
              >
                <TouchableOpacity
                  style={styles.quickItem}
                  onPress={() => closeMenu(() => router.push(action.route as any))}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickLabel}>{action.label}</Text>
                  <View style={[styles.quickIcon, { backgroundColor: action.color + '22', borderColor: action.color + '50' }]}>
                    <action.Icon size={18} color={action.color} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </Modal>

      <View style={[styles.bar, { paddingBottom: insets.bottom || spacing[3] }]}>
        {/* Left: Today */}
        {(() => {
          const focused = state.index === 0;
          const Tab = leftTab;
          return (
            <TouchableOpacity
              key={Tab.name}
              style={styles.tabItem}
              onPress={() => navigation.navigate(Tab.name)}
              activeOpacity={0.7}
            >
              <Tab.Icon size={22} color={focused ? colors.text.primary : colors.text.muted} strokeWidth={focused ? 2 : 1.5} />
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{Tab.label}</Text>
              {focused && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })()}

        {/* Center FAB */}
        <View style={styles.fabWrap}>
          <TouchableOpacity
            style={styles.fab}
            onPress={open ? () => closeMenu() : openMenu}
            activeOpacity={0.85}
          >
            <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
              <Plus size={22} color={colors.text.inverse} strokeWidth={2.5} />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Right: Tasks + Finances */}
        {rightTabs.map((tab, i) => {
          const focused = state.index === i + 1;
          const showBadge = tab.name === 'tasks' && pendingCount > 0;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                <tab.Icon size={22} color={focused ? colors.text.primary : colors.text.muted} strokeWidth={focused ? 2 : 1.5} />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingCount > 99 ? '99' : pendingCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{tab.label}</Text>
              {focused && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing[2],
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing[1],
    position: 'relative',
  },
  tabLabel: { fontSize: 9, fontWeight: '500', color: colors.text.muted, letterSpacing: 0.2 },
  tabLabelActive: { color: colors.text.primary },
  activeDot: {
    position: 'absolute',
    bottom: -spacing[1],
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: colors.text.primary,
  },

  iconWrap: { position: 'relative' },
  badge: {
    position: 'absolute', top: -5, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.accent.red,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.bg.card,
  },
  badgeText: { fontSize: 8, fontWeight: '700', color: '#fff', lineHeight: 11 },

  fabWrap: { flex: 1, alignItems: 'center', marginTop: -20 },
  fab: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.text.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.bg.primary,
    elevation: 4,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  quickMenu: {
    position: 'absolute',
    right: spacing[5],
    gap: spacing[3],
    alignItems: 'flex-end',
  },
  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  quickIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  quickLabel: {
    fontSize: 13, fontWeight: '600',
    color: colors.text.primary,
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});
