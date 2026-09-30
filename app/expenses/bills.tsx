import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, TrendingUp, TrendingDown, Minus, Receipt } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useExpensesStore } from '@/store/expensesStore';
import { buildBillTrends } from '@/utils/billTrends';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { plPlural } from '@/utils/plural';

// "Rachunki" — wykres zmian stałych opłat (2026-09-30, user: "możemy dodać stałe opłaty
// mieszkanie/prąd/internet żeby był wykres który pokazuje czy są jakieś zmiany, głównie
// chodzi o prąd bo mieszkanie i internet raczej się nie zmienia"). Dane budowane czysto z
// `BILL_TYPES`-dopasowanych wydatków (`billTrends.ts`, ta sama definicja "co jest
// rachunkiem za prąd" co filtr "Rachunki" w Finansach i sugestia "stały rachunek" na
// dashboardzie) — zero nowego wpisywania, tylko wykres z danych które appka już ma.
// Sortowanie: najbardziej zmienny rachunek pierwszy (prąd naturalnie wypłynie na górę,
// stabilny czynsz/internet spadnie niżej — dokładnie ten priorytet, o który user prosił).

export { ErrorBoundary } from '@/components/RouteErrorBoundary';

// Akcenty są IDENTYCZNE między light/dark (patrz lightColors.ts), więc `colors.accent.*`
// ze statycznego importu jest bezpieczne — ale `text.muted` (przypadek "bez zmian") JUŻ
// się różni między motywami, więc ta funkcja bierze `c` z `useColors()` wołającego, nie
// statycznego importu, żeby neutralny kolor poprawnie reagował na zmianę motywu.
function trendColor(changePct: number | null, c: ReturnType<typeof useColors>): string {
  if (changePct == null || changePct === 0) return c.text.muted;
  return changePct > 0 ? colors.accent.red : colors.accent.green;
}

export default function BillsScreen() {
  const colors = useColors();
  const s = useMemo(() => makeS(colors), [colors]);
  const expenses = useExpensesStore(st => st.expenses);
  const trends = useMemo(() => buildBillTrends(expenses), [expenses]);

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.header}>
        <PressableScale onPress={() => { haptic.tap(); router.back(); }} style={s.closeBtn}>
          <ChevronLeft size={20} color={colors.text.secondary} />
        </PressableScale>
        <Text style={s.title}>Rachunki</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[3], paddingBottom: 40 }}>
        {trends.length === 0 ? (
          <View style={s.empty}>
            <Receipt size={32} color={colors.text.muted} />
            <Text style={s.emptyTitle}>Jeszcze za mało danych</Text>
            <Text style={s.emptyBody}>
              Potrzeba co najmniej dwóch zapłaconych rachunków tego samego typu (np. dwa
              razy prąd), żeby pokazać trend. Dodaj wydatek z notatką/sklepem typu „PGE",
              „czynsz" albo „Internet" — appka sama go rozpozna.
            </Text>
          </View>
        ) : (
          trends.map(t => {
            const IconComp: any = (LucideIcons as any)[t.icon];
            const tc = trendColor(t.changePct, colors);
            const TrendIcon = t.changePct == null || t.changePct === 0 ? Minus : t.changePct > 0 ? TrendingUp : TrendingDown;
            // Słupki z podpisaną kwotą I datą PRZY KAŻDYM punkcie (2026-09-30, user
            // zrzutem "gdzie dane i w ogóle" — pierwsza wersja z WaveChart pokazywała
            // gołą linię + tylko pierwszą/ostatnią datę, więc skok typu "+198%" nie dało
            // się zweryfikować bez zgadywania, która płatność była tym dołkiem). Ten sam
            // przepis co słupki w usage-stats.tsx (§204, identyczny powód zgłoszenia:
            // "żeby tam były realnie widoczne szczegóły dane") — wartość NAD słupkiem,
            // etykieta pod nim, nie abstrakcyjna fala.
            const maxAmt = Math.max(...t.points.map(p => p.amount), 1);
            return (
              <View key={t.tag} style={s.card}>
                <View style={s.cardHead}>
                  <View style={s.iconWrap}>
                    {IconComp && <IconComp size={16} color={colors.text.secondary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName}>{t.name}</Text>
                    <Text style={s.cardMeta}>
                      {t.points.length} {plPlural(t.points.length, 'płatność', 'płatności', 'płatności')} · śr. {t.avgAmount.toFixed(0)} zł
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.cardAmount}>{t.lastAmount.toFixed(2)} zł</Text>
                    <View style={s.changeRow}>
                      <TrendIcon size={11} color={tc} />
                      <Text style={[s.changeText, { color: tc }]}>
                        {t.changePct == null || t.changePct === 0 ? 'bez zmian' : `${t.changePct > 0 ? '+' : ''}${t.changePct}%`}
                      </Text>
                    </View>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.barsRow}>
                    {t.points.map((p, i) => {
                      const h = Math.max(4, (p.amount / maxAmt) * 64);
                      return (
                        <View key={`${t.tag}-${p.date}-${i}`} style={s.barCol}>
                          <View style={s.barWrap}>
                            <Text style={s.barValue}>{p.amount.toFixed(0)}</Text>
                            <View style={[s.bar, { height: h, backgroundColor: tc }]} />
                          </View>
                          <Text style={s.barDateLabel} numberOfLines={1}>{fmtShort(p.date)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function fmtShort(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: c.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  title: { ...typography.h4, color: c.text.primary },

  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[10], paddingHorizontal: spacing[4] },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  emptyBody: { fontSize: 12.5, color: c.text.muted, textAlign: 'center', lineHeight: 18 },

  card: {
    backgroundColor: c.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3], gap: spacing[2],
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.border.subtle,
  },
  cardName: { fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  cardMeta: { fontSize: 10.5, color: c.text.muted, marginTop: 1 },
  cardAmount: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  changeText: { fontSize: 10.5, fontWeight: '700' },

  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3], paddingTop: spacing[1] },
  barCol: { alignItems: 'center', width: 38 },
  barWrap: { height: 78, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  bar: { width: 14, borderRadius: 4, minHeight: 3 },
  barValue: { fontSize: 9, fontWeight: '700', color: c.text.secondary, marginBottom: 3 },
  barDateLabel: { fontSize: 8.5, color: c.text.muted, marginTop: 3 },
}));
