import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Activity, Trash2, ChevronDown } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import { useUsageStats } from '@/store/usageStatsStore';
import { screenInfoFor } from '@/utils/screenStats';

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `dziś ${time}`;
  return `${d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} ${time}`;
}

// "Statystyki apki" — lokalny licznik otwarć ekranów (2026-09-12, user: "coś ala meta
// pixel z kliknięciem gdzie klikam... i dodać w ustawieniach statystyki apki... Pixel
// tylko w apce nigdzie nie wysyłać tego chce zupełnie obieg zamknięty"). Czyta
// `usageStatsStore.ts` — zapisywany WYŁĄCZNIE przez `app/_layout.tsx` (jedno miejsce,
// patrz komentarz tam), nigdy nie wysyłany nigdzie; jeśli user zechce podesłać dane do
// analizy, jedzie to razem z resztą przez istniejący eksport JSON w `BackupSection`
// (ten sam AsyncStorage klucz trafia do `config` snapshotu automatycznie).
export default function UsageStatsSection() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const screens = useUsageStats(st => st.screens);
  const reset = useUsageStats(st => st.reset);
  const [showAll, setShowAll] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const rows = useMemo(() => {
    return Object.entries(screens)
      .map(([id, stat]) => ({ id, label: screenInfoFor(id)?.label ?? id, ...stat }))
      .sort((a, b) => b.count - a.count);
  }, [screens]);

  const totalOpens = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Activity size={15} color={c.text.secondary} />
        <Text style={s.title}>Statystyki apki (lokalnie)</Text>
      </View>
      <Text style={s.sub}>
        Ile razy i kiedy otwierałeś poszczególne ekrany — TYLKO na tym urządzeniu, nigdzie nie wysyłane. Chcesz mi to podesłać do analizy? Użyj eksportu JSON wyżej — te dane jadą razem z resztą.
      </Text>

      {rows.length === 0 ? (
        <Text style={s.empty}>Jeszcze za mało danych.</Text>
      ) : (
        <>
          <Text style={s.totalLine}>{totalOpens} otwarć ekranów łącznie · {rows.length} różnych ekranów</Text>
          <View style={s.list}>
            {(showAll ? rows : rows.slice(0, 6)).map((r, i) => (
              <View key={r.id} style={[s.row, i > 0 && s.rowBorder]}>
                <Text style={s.rowLabel} numberOfLines={1}>{r.label}</Text>
                <Text style={s.rowWhen}>{fmtWhen(r.lastOpenedAt)}</Text>
                <Text style={s.rowCount}>{r.count}×</Text>
              </View>
            ))}
          </View>
          {rows.length > 6 && (
            <PressableScale onPress={() => { haptic.tap(); setShowAll(v => !v); }}>
              <View style={s.moreRow}>
                <Text style={s.moreText}>{showAll ? 'Pokaż mniej' : `Pokaż wszystkie (${rows.length})`}</Text>
                <ChevronDown size={14} color={c.text.muted} style={showAll ? { transform: [{ rotate: '180deg' }] } : undefined} />
              </View>
            </PressableScale>
          )}
          <PressableScale onPress={() => { haptic.tap(); setConfirmReset(true); }}>
            <View style={s.resetBtn}>
              <Trash2 size={13} color={c.text.muted} />
              <Text style={s.resetText}>Wyczyść statystyki</Text>
            </View>
          </PressableScale>
        </>
      )}

      <ConfirmDialog
        visible={confirmReset}
        title="Wyczyścić statystyki?"
        message="Liczniki otwarć ekranów zostaną wyzerowane. Tego nie można cofnąć."
        confirmLabel="Wyczyść"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { setConfirmReset(false); reset(); haptic.medium(); toast.success('Statystyki wyczyszczone'); }}
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
  empty: { fontSize: 12, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[2] },
  totalLine: { fontSize: 11, color: c.text.muted, fontWeight: '600' },
  list: { borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text.primary },
  rowWhen: { fontSize: 11, color: c.text.muted },
  rowCount: { fontSize: 12, fontWeight: '800', color: c.text.secondary, minWidth: 28, textAlign: 'right' },
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing[1] },
  moreText: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[2], borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  resetText: { fontSize: 12, fontWeight: '700', color: c.text.secondary },
}));
