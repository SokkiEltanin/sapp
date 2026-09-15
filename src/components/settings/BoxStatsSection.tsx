import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { PackageOpen, Trash2, ChevronLeft, BarChart3 } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import { useBoxStats } from '@/store/boxStatsStore';
import { computeBoxStats } from '@/utils/boxStatsAnalysis';

// "Statystyki skrzynek" — szybki podgląd w Ustawienia → Dane (2026-09-15), sąsiad
// `UsageStatsSection`, ten sam wzorzec: mała karta + link do pełnego panelu
// (`/box-stats`). User: "niech mi tez da statystyki tam otwierania skrzynek (procentowe,
// zysk,strata itp itd zeby balansować trochę pozniej)". Czyta WYŁĄCZNIE `boxStatsStore`
// (lokalne, nigdzie niewysyłane, patrz komentarz tam).
export default function BoxStatsSection() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const events = useBoxStats(st => st.events);
  const reset = useBoxStats(st => st.reset);
  const [confirmReset, setConfirmReset] = useState(false);

  const groups = useMemo(() => computeBoxStats(events), [events]);
  const totalOpens = groups.reduce((sum, g) => sum + g.opens, 0);
  const totalNet = groups.reduce((sum, g) => sum + g.netCoins, 0);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <PackageOpen size={15} color={c.text.secondary} />
        <Text style={s.title}>Statystyki skrzynek (lokalnie)</Text>
      </View>
      <Text style={s.sub}>
        Co faktycznie wypada ze skrzynek Rynku, per typ — do balansowania. Tylko na tym urządzeniu, nigdzie nie wysyłane.
      </Text>

      <PressableScale onPress={() => { haptic.tap(); router.push('/box-stats' as any); }}>
        <View style={s.panelLinkBtn}>
          <BarChart3 size={14} color={c.accent.blue} />
          <Text style={s.panelLinkText}>Zobacz pełny panel</Text>
          <ChevronLeft size={14} color={c.accent.blue} style={{ transform: [{ rotate: '180deg' }] }} />
        </View>
      </PressableScale>

      {totalOpens === 0 ? (
        <Text style={s.empty}>Jeszcze za mało danych.</Text>
      ) : (
        <>
          <Text style={s.totalLine}>
            {totalOpens} otwarć łącznie · bilans monet: <Text style={{ color: totalNet >= 0 ? c.accent.green : c.accent.red, fontWeight: '800' }}>{totalNet >= 0 ? '+' : ''}{totalNet}</Text>
          </Text>
          <PressableScale onPress={() => { haptic.tap(); setConfirmReset(true); }}>
            <View style={s.resetBtn}>
              <Trash2 size={13} color={c.text.muted} />
              <Text style={s.resetText}>Wyczyść statystyki skrzynek</Text>
            </View>
          </PressableScale>
        </>
      )}

      <ConfirmDialog
        visible={confirmReset}
        title="Wyczyścić statystyki skrzynek?"
        message="Cały log otwarć skrzynek zostanie wyzerowany. Tego nie można cofnąć."
        confirmLabel="Wyczyść"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { setConfirmReset(false); reset(); haptic.medium(); toast.success('Statystyki skrzynek wyczyszczone'); }}
      />
    </View>
  );
}

const makeStyles = themedStyles((c: typeof colors) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: c.border.default, marginTop: spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { ...typography.body, fontWeight: '700', color: c.text.primary },
  sub: { fontSize: 12, color: c.text.muted, lineHeight: 17, marginTop: -spacing[1] },
  panelLinkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[2], borderRadius: radius.md,
    borderWidth: 1, borderColor: c.accent.blue + '40', backgroundColor: c.accent.blue + '14',
  },
  panelLinkText: { fontSize: 12, fontWeight: '700', color: c.accent.blue },
  empty: { fontSize: 12, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[2] },
  totalLine: { fontSize: 11, color: c.text.muted, fontWeight: '600' },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[2], borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  resetText: { fontSize: 12, fontWeight: '700', color: c.text.secondary },
}));
