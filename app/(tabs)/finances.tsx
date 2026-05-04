import { View, Text, StyleSheet, RefreshControl, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, ScanLine, BarChart2 } from 'lucide-react-native';

import ScreenHeader from '@/components/ui/ScreenHeader';
import AnimatedButton from '@/components/ui/AnimatedButton';
import PressableScale from '@/components/ui/PressableScale';
import ExpenseItem from '@/components/expenses/ExpenseItem';
import ExpenseSummaryCard from '@/components/expenses/ExpenseSummaryCard';
import { useExpenses } from '@/hooks/useExpenses';
import { formatDate } from '@/utils/date';
import { colors, spacing, typography, radius } from '@/theme';

export default function FinancesScreen() {
  const { grouped, stats, isLoading, reload, remove } = useExpenses();

  const sections = grouped.map(([date, items]) => ({
    title: formatDate(date + 'T12:00:00'),
    data: items,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Finanse"
        subtitle={new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
        accentColor={colors.expenses}
        rightSlot={
          <View style={styles.headerActions}>
            <PressableScale onPress={() => router.push('/expenses/scan')} style={styles.iconBtn}>
              <ScanLine size={20} color={colors.text.secondary} />
            </PressableScale>
            <PressableScale onPress={() => router.push('/expenses/stats')} style={styles.iconBtn}>
              <BarChart2 size={20} color={colors.text.secondary} />
            </PressableScale>
          </View>
        }
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.text.muted} />
        }
        ListHeaderComponent={
          <ExpenseSummaryCard
            monthExpenses={stats.monthExpenses}
            monthIncome={stats.monthIncome}
            thisWeek={stats.thisWeek}
            lastWeek={stats.lastWeek}
            topCategory={stats.topCategory}
          />
        }
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
        )}
        renderItem={({ item, index }) => (
          <View style={styles.listPadding}>
            <ExpenseItem
              expense={item}
              index={index}
              onPress={(e) => router.push(`/expenses/${e.id}` as any)}
              onLongPress={() => remove(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Brak transakcji</Text>
              <Text style={styles.emptySubtitle}>
                Dotknij "Nowa transakcja" żeby dodać pierwszy wpis
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        stickySectionHeadersEnabled={false}
      />

      <View style={styles.fab}>
        <AnimatedButton
          onPress={() => router.push('/expenses/add')}
          label="Nowa transakcja"
          icon={<Plus size={18} color={colors.bg.primary} />}
          size="lg"
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  headerActions: { flexDirection: 'row', gap: spacing[2] },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border.default,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2],
  },
  sectionDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sectionTitle: {
    ...typography.label, color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11,
  },
  listPadding: { paddingHorizontal: spacing[4] },
  empty: { alignItems: 'center', paddingTop: spacing[12], paddingHorizontal: spacing[8], gap: spacing[3] },
  emptyTitle: { ...typography.h3, color: colors.text.secondary },
  emptySubtitle: { ...typography.body, color: colors.text.muted, textAlign: 'center', lineHeight: 22 },
  fab: { position: 'absolute', bottom: spacing[6], left: spacing[4], right: spacing[4] },
});

