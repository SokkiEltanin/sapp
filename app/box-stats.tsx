import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Trash2, Coins } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import { useBoxStats } from '@/store/boxStatsStore';
import { computeBoxStats, BoxTypeStats } from '@/utils/boxStatsAnalysis';
import { boxById, DAILY_BOX, DAILY_BOX_ICON, BoxId } from '@/utils/petBoxes';
import { RARITY_META, GearRarity } from '@/utils/gear';
import { CRATE_META, CrateTier } from '@/utils/crates';

function boxLabel(boxId: BoxId, daily: boolean): string {
  return daily ? 'Skrzynka dnia' : boxById(boxId).name;
}

function boxIconOf(boxId: BoxId, daily: boolean) {
  return daily ? DAILY_BOX_ICON : boxById(boxId).icon;
}

function rarityLabel(rarity: string): { label: string; color: string } {
  if (rarity in RARITY_META) { const m = RARITY_META[rarity as GearRarity]; return { label: m.label, color: m.color }; }
  if (rarity in CRATE_META) { const m = CRATE_META[rarity as CrateTier]; return { label: m.label, color: m.color }; }
  return { label: rarity, color: colors.text.muted };
}

// Statystyki otwierania skrzynek Rynku (2026-09-15) — user: "niech mi tez da statystyki
// tam otwierania skrzynek (procentowe, zysk,strata itp itd zeby balansować trochę pozniej
// ... ale to nic nie zmieniaj ja pootwieram ze statystykami podzielonym per skrzynka zeby
// wiedzieć jak balansować nie q ciemno". Czysta instrumentacja — czyta WYŁĄCZNIE
// `boxStatsStore` (lokalne, patrz komentarz tam), nie zmienia żadnej wartości ekonomii w
// petBoxes.ts. Ten sam layout co `usage-stats.tsx` (§102) — karty + reset na dole.
export default function BoxStatsScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const events = useBoxStats(st => st.events);
  const reset = useBoxStats(st => st.reset);
  const [confirmReset, setConfirmReset] = useState(false);

  const groups = useMemo(() => computeBoxStats(events), [events]);
  const totalOpens = groups.reduce((sum, g) => sum + g.opens, 0);
  const totalCost = groups.reduce((sum, g) => sum + g.totalCost, 0);
  const totalNet = groups.reduce((sum, g) => sum + g.netCoins, 0);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.secondary} />
        </PressableScale>
        <Text style={s.headerTitle}>Statystyki skrzynek</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.intro}>
          Co faktycznie wypada ze skrzynek Rynku, per typ — WYŁĄCZNIE na tym urządzeniu, nigdzie nie wysyłane. Do balansowania: żadna szansa ani cena się tu nie zmienia, to tylko log wyników.
        </Text>

        <View style={s.summaryRow}>
          <View style={s.summaryTile}>
            <Text style={s.summaryVal}>{totalOpens}</Text>
            <Text style={s.summaryLabel}>otwarć łącznie</Text>
          </View>
          <View style={s.summaryTile}>
            <Text style={s.summaryVal}>{totalCost}</Text>
            <Text style={s.summaryLabel}>monet wydanych</Text>
          </View>
          <View style={s.summaryTile}>
            <Text style={[s.summaryVal, { color: totalNet >= 0 ? c.accent.green : c.accent.red }]}>{totalNet >= 0 ? '+' : ''}{totalNet}</Text>
            <Text style={s.summaryLabel}>bilans monet</Text>
          </View>
        </View>

        {groups.length === 0 ? (
          <View style={s.card}><Text style={s.empty}>Jeszcze za mało danych — otwórz kilka skrzynek.</Text></View>
        ) : (
          groups.map(g => <BoxCard key={`${g.daily ? 'daily' : 'paid'}:${g.boxId}`} g={g} s={s} c={c} />)
        )}

        <PressableScale onPress={() => { haptic.tap(); setConfirmReset(true); }}>
          <View style={s.resetBtn}>
            <Trash2 size={13} color={c.text.muted} />
            <Text style={s.resetText}>Wyczyść statystyki skrzynek</Text>
          </View>
        </PressableScale>
      </ScrollView>

      <ConfirmDialog
        visible={confirmReset}
        title="Wyczyścić statystyki skrzynek?"
        message="Cały log otwarć skrzynek zostanie wyzerowany. Tego nie można cofnąć."
        confirmLabel="Wyczyść"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { setConfirmReset(false); reset(); haptic.medium(); toast.success('Statystyki skrzynek wyczyszczone'); }}
      />
    </SafeAreaView>
  );
}

function BoxCard({ g, s, c }: { g: BoxTypeStats; s: ReturnType<typeof makeStyles>; c: typeof colors }) {
  const icon = boxIconOf(g.boxId, g.daily);
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        {icon ? <Image source={icon} style={s.boxIcon} contentFit="contain" /> : null}
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{boxLabel(g.boxId, g.daily)}{g.daily ? ' · darmowa' : ''}</Text>
          <Text style={s.cardSub}>{g.opens} otwarć{!g.daily ? ` · ${g.totalCost} monet wydanych` : ''}</Text>
        </View>
        {!g.daily && (
          <View style={s.netPill}>
            <Coins size={11} color={g.netCoins >= 0 ? c.accent.green : c.accent.red} />
            <Text style={[s.netPillTxt, { color: g.netCoins >= 0 ? c.accent.green : c.accent.red }]}>{g.netCoins >= 0 ? '+' : ''}{g.netCoins}</Text>
          </View>
        )}
      </View>

      {/* Rozkład typu nagrody — monety/ekwipunek/umiejętność jako jeden pasek segmentowy. */}
      <View style={s.typeBar}>
        {g.coinsPct > 0 && <View style={{ flex: g.coinsPct, backgroundColor: '#FBBF24' }} />}
        {g.gearPct > 0 && <View style={{ flex: g.gearPct, backgroundColor: c.accent.blue }} />}
        {g.combatItemPct > 0 && <View style={{ flex: g.combatItemPct, backgroundColor: c.accent.purple }} />}
      </View>
      <View style={s.typeLegendRow}>
        <LegendDot color="#FBBF24" label={`monety ${Math.round(g.coinsPct)}%`} />
        <LegendDot color={c.accent.blue} label={`ekwipunek ${Math.round(g.gearPct)}%`} />
        <LegendDot color={c.accent.purple} label={`umiejętność ${Math.round(g.combatItemPct)}%`} />
      </View>

      {g.coinRarityBreakdown.length > 0 && (
        <View style={s.subSection}>
          <Text style={s.subSectionTitle}>Nagrody monetowe — rozkład rzadkości</Text>
          {g.coinRarityBreakdown.map(r => {
            const meta = rarityLabel(r.rarity);
            return (
              <View key={r.rarity} style={s.rarityRow}>
                <View style={[s.rarityDot, { backgroundColor: meta.color }]} />
                <Text style={s.rarityLabel}>{meta.label}</Text>
                <Text style={s.rarityPct}>{Math.round(r.pct)}% · {r.count}×</Text>
                <Text style={s.rarityAvg}>śr. {Math.round(r.avgCoins ?? 0)} monet</Text>
              </View>
            );
          })}
        </View>
      )}

      {g.gearRarityBreakdown.length > 0 && (
        <View style={s.subSection}>
          <Text style={s.subSectionTitle}>Ekwipunek — rozkład rzadkości</Text>
          {g.gearRarityBreakdown.map(r => {
            const meta = rarityLabel(r.rarity);
            return (
              <View key={r.rarity} style={s.rarityRow}>
                <View style={[s.rarityDot, { backgroundColor: meta.color }]} />
                <Text style={s.rarityLabel}>{meta.label}</Text>
                <Text style={s.rarityPct}>{Math.round(r.pct)}% · {r.count}×</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 10, color: colors.text.muted }}>{label}</Text>
    </View>
  );
}

const makeStyles = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: c.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  headerTitle: { ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },
  intro: { fontSize: 12, color: c.text.muted, lineHeight: 17 },
  summaryRow: { flexDirection: 'row', gap: spacing[2] },
  summaryTile: {
    flex: 1, alignItems: 'center', gap: 2,
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    paddingVertical: spacing[3],
  },
  summaryVal: { fontSize: 20, fontWeight: '900', color: c.text.primary },
  summaryLabel: { fontSize: 10, color: c.text.muted, textAlign: 'center' },
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: c.border.default,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  boxIcon: { width: 34, height: 34 },
  cardTitle: { ...typography.bodySmall, fontWeight: '700', color: c.text.primary },
  cardSub: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  netPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm,
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.subtle,
  },
  netPillTxt: { fontSize: 11.5, fontWeight: '800' },
  typeBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: c.bg.elevated },
  typeLegendRow: { flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' },
  subSection: { gap: 4, paddingTop: spacing[1], borderTopWidth: 1, borderTopColor: c.border.subtle },
  subSectionTitle: { fontSize: 10.5, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  rarityDot: { width: 7, height: 7, borderRadius: 4 },
  rarityLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: c.text.primary },
  rarityPct: { fontSize: 11, color: c.text.secondary, fontWeight: '700' },
  rarityAvg: { fontSize: 10.5, color: c.text.muted, minWidth: 78, textAlign: 'right' },
  empty: { fontSize: 12, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[2] },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  resetText: { fontSize: 12, fontWeight: '700', color: c.text.secondary },
}));
